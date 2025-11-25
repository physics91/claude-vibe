#Requires -Version 5.1
<#
.SYNOPSIS
    PreCompact hook for AGENTS Context Preserver plugin.

.DESCRIPTION
    This hook is invoked by Claude Code before context compaction.
    It captures the current session context and saves it using the storage layer
    to preserve important information across compact operations.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0

    Exit Codes:
    - 0: Success
    - 2: Blocking error (prevents compact)
#>

#region Script Setup

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Output object template
$output = @{
    continue = $true
    suppressOutput = $false
    systemMessage = ""
}

#endregion

#region Main Execution

try {
    # Source required modules
    $scriptRoot = $PSScriptRoot
    $libPath = Join-Path (Split-Path $scriptRoot -Parent) "lib"

    . "$libPath\core\parser.ps1"
    . "$libPath\core\storage.ps1"
    . "$libPath\utils\security.ps1"

    #region Read and Parse Input

    # Read JSON input from stdin (use ReadToEnd to handle multi-line JSON)
    $inputContent = [Console]::In.ReadToEnd()

    if ([string]::IsNullOrWhiteSpace($inputContent)) {
        throw "No input received from stdin"
    }

    # Trim whitespace for clean parsing
    $inputContent = $inputContent.Trim()

    $hookInput = $inputContent | ConvertFrom-Json

    # Extract required fields
    $sessionId = $hookInput.session_id
    $transcriptPath = $hookInput.transcript_path
    $cwd = $hookInput.cwd
    $permissionMode = $hookInput.permission_mode
    $hookEventName = $hookInput.hook_event_name

    if ([string]::IsNullOrEmpty($sessionId)) {
        throw "session_id is required"
    }

    if ([string]::IsNullOrEmpty($cwd)) {
        throw "cwd is required"
    }

    #endregion

    #region Validate Paths (Fail-Closed Security)

    # Validate cwd is a safe project root
    try {
        $normalizedCwd = [System.IO.Path]::GetFullPath($cwd)
        if (-not (Test-Path -LiteralPath $normalizedCwd -PathType Container)) {
            throw "Project directory does not exist: $normalizedCwd"
        }
    } catch {
        # Path validation failure is blocking
        $output.continue = $false
        throw "SECURITY: Invalid project directory: $($_.Exception.Message)"
    }

    # Validate transcript_path if provided
    if (-not [string]::IsNullOrEmpty($transcriptPath)) {
        try {
            $validatedTranscript = Test-PathSecurity -Path $transcriptPath -ProjectRoot $normalizedCwd
        } catch {
            [Console]::Error.WriteLine("Transcript path validation failed: $($_.Exception.Message)")
            # Non-blocking - transcript is optional
            $transcriptPath = $null
        }
    }

    #endregion

    #region Load Configuration

    $configPath = Join-Path $env:USERPROFILE ".claude\claude-vibe\config.json"
    $config = @{
        storage_dir = Get-DefaultStorageDir  # Use shared helper
        max_context_size_kb = 100
        max_backups = 3
        max_agents_md_size_kb = 50
        local_agents_md_max_depth = 3
        include_local_agents_md = $true
        tool_history_limit = 50
        file_context_limit = 20
        error_context_limit = 10
    }

    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        try {
            $loadedConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json | ConvertTo-HashtableRecursive
            foreach ($key in $loadedConfig.Keys) {
                $config[$key] = $loadedConfig[$key]
            }
        } catch {
            [Console]::Error.WriteLine("Failed to load config, using defaults: $($_.Exception.Message)")
        }
    }

    #endregion

    #region Helper Functions

    function Get-TranscriptContext {
        <#
        .SYNOPSIS
            Extract context from transcript file.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [string]$TranscriptPath,

            [Parameter()]
            [int]$ToolHistoryLimit = 50,

            [Parameter()]
            [int]$FileContextLimit = 20,

            [Parameter()]
            [int]$ErrorContextLimit = 10
        )

        $context = @{
            objective = ""
            steps_completed = @()
            key_decisions = @()
            tool_history = @()
            working_files = @()
            recent_errors = @()
        }

        if ([string]::IsNullOrEmpty($TranscriptPath) -or -not (Test-Path -LiteralPath $TranscriptPath -PathType Leaf)) {
            return $context
        }

        try {
            $transcriptContent = Get-Content -LiteralPath $TranscriptPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue

            if ([string]::IsNullOrEmpty($transcriptContent)) {
                return $context
            }

            # Extract objective from first user message
            if ($transcriptContent -match '(?s)^\s*(?:user|human)\s*:\s*(.+?)(?=\n\s*(?:assistant|claude)\s*:|$)') {
                $context.objective = $Matches[1].Trim().Substring(0, [Math]::Min(500, $Matches[1].Trim().Length))
            }

            # Extract tool invocations
            $toolMatches = [regex]::Matches($transcriptContent, '(?i)(Read|Write|Edit|Glob|Grep|Bash)\s*\(\s*["\u0027]?([^"\u0027\)]+)["\u0027]?\s*\)')
            $toolHistory = [System.Collections.ArrayList]::new()

            foreach ($match in $toolMatches) {
                if ($toolHistory.Count -ge $ToolHistoryLimit) {
                    break
                }
                [void]$toolHistory.Add(@{
                    tool = $match.Groups[1].Value
                    target = $match.Groups[2].Value.Trim()
                })
            }
            $context.tool_history = $toolHistory.ToArray()

            # Extract file paths mentioned
            $fileMatches = [regex]::Matches($transcriptContent, '(?i)(?:file|path)\s*[=:]\s*["\u0027]?([^\s"\u0027\n]+\.[a-zA-Z0-9]+)')
            $workingFiles = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

            foreach ($match in $fileMatches) {
                if ($workingFiles.Count -ge $FileContextLimit) {
                    break
                }
                [void]$workingFiles.Add($match.Groups[1].Value)
            }
            $context.working_files = @($workingFiles)

            # Extract error messages
            $errorMatches = [regex]::Matches($transcriptContent, '(?i)(error|exception|failed|failure)[:\s]+([^\n]{10,200})')
            $recentErrors = [System.Collections.ArrayList]::new()

            foreach ($match in $errorMatches) {
                if ($recentErrors.Count -ge $ErrorContextLimit) {
                    break
                }
                [void]$recentErrors.Add(@{
                    type = $match.Groups[1].Value
                    message = $match.Groups[2].Value.Trim()
                })
            }
            $context.recent_errors = $recentErrors.ToArray()

            # Extract decision indicators
            $decisionMatches = [regex]::Matches($transcriptContent, '(?i)(decided|choosing|selected|using|implementing|approach)\s+[:\s]*([^\n]{10,150})')
            $keyDecisions = [System.Collections.ArrayList]::new()

            foreach ($match in $decisionMatches) {
                if ($keyDecisions.Count -ge 10) {
                    break
                }
                [void]$keyDecisions.Add($match.Groups[2].Value.Trim())
            }
            $context.key_decisions = $keyDecisions.ToArray()

            # Extract completed steps (based on common patterns)
            $stepMatches = [regex]::Matches($transcriptContent, '(?i)(completed|done|finished|created|updated|implemented|added|fixed|configured)\s+([^\n]{5,100})')
            $stepsCompleted = [System.Collections.ArrayList]::new()

            foreach ($match in $stepMatches) {
                if ($stepsCompleted.Count -ge 20) {
                    break
                }
                [void]$stepsCompleted.Add("$($match.Groups[1].Value) $($match.Groups[2].Value.Trim())")
            }
            $context.steps_completed = $stepsCompleted.ToArray()

            return $context

        } catch {
            [Console]::Error.WriteLine("Failed to parse transcript: $($_.Exception.Message)")
            return $context
        }
    }

    function Build-ContextState {
        <#
        .SYNOPSIS
            Assemble the complete context state object.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [string]$SessionId,

            [Parameter(Mandatory = $true)]
            [string]$ProjectRoot,

            [Parameter()]
            [hashtable]$AgentsMdFiles,

            [Parameter()]
            [hashtable]$TranscriptContext,

            [Parameter()]
            [string]$PermissionMode = "default"
        )

        $contextState = @{
            version = "1.0.0"
            session_id = $SessionId
            created_at = [datetime]::UtcNow.ToString('o')
            updated_at = [datetime]::UtcNow.ToString('o')

            # AGENTS.md content
            agents_md = @{
                global = $null
                project = $null
                local = @()
                merged = $null
            }

            # Task context from transcript
            task_context = @{
                objective = ""
                steps_completed = @()
                key_decisions = @()
                current_phase = ""
            }

            # Working context
            working_context = @{
                files = @()
                recent_errors = @()
                environment = @{
                    cwd = $ProjectRoot
                    permission_mode = $PermissionMode
                }
            }

            # Tool usage history
            tool_history = @()

            # Metadata
            metadata = @{
                hook_event = "PreCompact"
                project_root = $ProjectRoot
                context_size_bytes = 0
            }
        }

        # Populate AGENTS.md content
        if ($null -ne $AgentsMdFiles) {
            if ($null -ne $AgentsMdFiles.global) {
                $contextState.agents_md.global = @{
                    path = $AgentsMdFiles.global.path
                    hash = $AgentsMdFiles.global.hash
                    content = $AgentsMdFiles.global.content
                    truncated = $AgentsMdFiles.global.truncated
                }
            }

            if ($null -ne $AgentsMdFiles.project) {
                $contextState.agents_md.project = @{
                    path = $AgentsMdFiles.project.path
                    hash = $AgentsMdFiles.project.hash
                    content = $AgentsMdFiles.project.content
                    truncated = $AgentsMdFiles.project.truncated
                }
            }

            if ($null -ne $AgentsMdFiles.local -and $AgentsMdFiles.local.Count -gt 0) {
                $contextState.agents_md.local = @(foreach ($local in $AgentsMdFiles.local) {
                    @{
                        path = $local.path
                        hash = $local.hash
                        content = $local.content
                        truncated = $local.truncated
                    }
                })
            }

            # Merge configurations
            $globalParsed = if ($AgentsMdFiles.global) { $AgentsMdFiles.global.parsed } else { $null }
            $projectParsed = if ($AgentsMdFiles.project) { $AgentsMdFiles.project.parsed } else { $null }

            $contextState.agents_md.merged = Merge-AgentsMdConfigs `
                -Global $globalParsed `
                -Project $projectParsed `
                -Local $AgentsMdFiles.local
        }

        # Populate task context
        if ($null -ne $TranscriptContext) {
            $contextState.task_context.objective = $TranscriptContext.objective
            $contextState.task_context.steps_completed = $TranscriptContext.steps_completed
            $contextState.task_context.key_decisions = $TranscriptContext.key_decisions
            $contextState.working_context.files = $TranscriptContext.working_files
            $contextState.working_context.recent_errors = $TranscriptContext.recent_errors
            $contextState.tool_history = $TranscriptContext.tool_history
        }

        return $contextState
    }

    function Apply-SizeLimits {
        <#
        .SYNOPSIS
            Prune context data to meet size constraints.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [hashtable]$Context,

            [Parameter()]
            [int]$MaxSizeKB = 100
        )

        $maxBytes = $MaxSizeKB * 1024

        # Calculate current size
        $json = $Context | ConvertTo-Json -Depth 5 -Compress
        $currentBytes = [System.Text.Encoding]::UTF8.GetByteCount($json)

        if ($currentBytes -le $maxBytes) {
            $Context.metadata.context_size_bytes = $currentBytes
            return $Context
        }

        # Progressive pruning strategy
        $pruneSteps = @(
            # Step 1: Reduce tool history
            {
                param($ctx)
                if ($ctx.tool_history.Count -gt 20) {
                    $ctx.tool_history = $ctx.tool_history | Select-Object -Last 20
                }
            },
            # Step 2: Reduce file list
            {
                param($ctx)
                if ($ctx.working_context.files.Count -gt 10) {
                    $ctx.working_context.files = $ctx.working_context.files | Select-Object -Last 10
                }
            },
            # Step 3: Reduce steps completed
            {
                param($ctx)
                if ($ctx.task_context.steps_completed.Count -gt 10) {
                    $ctx.task_context.steps_completed = $ctx.task_context.steps_completed | Select-Object -Last 10
                }
            },
            # Step 4: Reduce errors
            {
                param($ctx)
                if ($ctx.working_context.recent_errors.Count -gt 5) {
                    $ctx.working_context.recent_errors = $ctx.working_context.recent_errors | Select-Object -Last 5
                }
            },
            # Step 5: Remove local AGENTS.md if too many
            {
                param($ctx)
                if ($ctx.agents_md.local.Count -gt 3) {
                    $ctx.agents_md.local = $ctx.agents_md.local | Select-Object -First 3
                }
            },
            # Step 6: Truncate AGENTS.md content further
            {
                param($ctx)
                $compressLimit = 20  # 20KB per file
                if ($ctx.agents_md.global -and $ctx.agents_md.global.content) {
                    $ctx.agents_md.global.content = Compress-AgentsMdContent -Content $ctx.agents_md.global.content -MaxSizeKB $compressLimit
                    $ctx.agents_md.global.truncated = $true
                }
                if ($ctx.agents_md.project -and $ctx.agents_md.project.content) {
                    $ctx.agents_md.project.content = Compress-AgentsMdContent -Content $ctx.agents_md.project.content -MaxSizeKB $compressLimit
                    $ctx.agents_md.project.truncated = $true
                }
            },
            # Step 7: Remove merged config details (keep only key instructions)
            {
                param($ctx)
                if ($ctx.agents_md.merged) {
                    $ctx.agents_md.merged.sections = @()
                    $ctx.agents_md.merged.subagents = @()
                }
            },
            # Step 8: Truncate objective
            {
                param($ctx)
                if ($ctx.task_context.objective.Length -gt 200) {
                    $ctx.task_context.objective = $ctx.task_context.objective.Substring(0, 200) + "..."
                }
            }
        )

        foreach ($pruneStep in $pruneSteps) {
            # Apply prune step
            & $pruneStep $Context

            # Recalculate size
            $json = $Context | ConvertTo-Json -Depth 5 -Compress
            $currentBytes = [System.Text.Encoding]::UTF8.GetByteCount($json)

            if ($currentBytes -le $maxBytes) {
                break
            }
        }

        $Context.metadata.context_size_bytes = $currentBytes
        $Context.metadata.pruned = $currentBytes -gt $maxBytes

        return $Context
    }

    #endregion

    #region Discover AGENTS.md Files

    $agentsMdFiles = Get-AgentsMdFiles `
        -ProjectRoot $cwd `
        -GlobalPath "~/.claude/AGENTS.md" `
        -IncludeLocal $config.include_local_agents_md `
        -LocalMaxDepth $config.local_agents_md_max_depth

    #endregion

    #region Read Transcript

    $transcriptContext = Get-TranscriptContext `
        -TranscriptPath $transcriptPath `
        -ToolHistoryLimit $config.tool_history_limit `
        -FileContextLimit $config.file_context_limit `
        -ErrorContextLimit $config.error_context_limit

    #endregion

    #region Build Context State

    $contextState = Build-ContextState `
        -SessionId $sessionId `
        -ProjectRoot $cwd `
        -AgentsMdFiles $agentsMdFiles `
        -TranscriptContext $transcriptContext `
        -PermissionMode $permissionMode

    #endregion

    #region Apply Size Limits

    $contextState = Apply-SizeLimits `
        -Context $contextState `
        -MaxSizeKB $config.max_context_size_kb

    #endregion

    #region Save Context with Lock

    $storageDir = $config.storage_dir
    if (-not (Test-Path -LiteralPath $storageDir -PathType Container)) {
        New-SecureDirectory -Path $storageDir -Force | Out-Null
    }

    # Use shared helper for consistent path computation
    $contextFilePath = Get-ContextFilePath -StorageDir $storageDir -SessionId $sessionId

    # Save with lock for concurrency safety
    Invoke-WithLock -ResourcePath $contextFilePath -TimeoutMs 5000 -Operation {
        Write-ContextState `
            -Context $contextState `
            -StoragePath $contextFilePath `
            -CreateBackup $true `
            -MaxBackups $config.max_backups
    } | Out-Null

    #endregion

    #region Prepare Output

    $sizeKB = [math]::Round($contextState.metadata.context_size_bytes / 1024, 1)
    $agentsCount = 0
    if ($agentsMdFiles.global) { $agentsCount++ }
    if ($agentsMdFiles.project) { $agentsCount++ }
    $agentsCount += $agentsMdFiles.local.Count

    $output.continue = $true
    $output.suppressOutput = $false
    $output.systemMessage = "Context preserved: ${sizeKB}KB saved ($agentsCount AGENTS.md files)"

    #endregion

} catch {
    # Determine if error is blocking (security violations) or recoverable (other errors)
    $errorMessage = $_.Exception.Message
    $isSecurityError = $errorMessage -match 'SECURITY:' -or
                       $_.Exception -is [PathValidationException] -or
                       $_.Exception -is [SecurityViolationException]

    if ($isSecurityError) {
        # Security errors block compaction
        $output.continue = $false
        $output.suppressOutput = $false
        $output.systemMessage = "Context preservation BLOCKED: $errorMessage"
    } else {
        # Other errors are recoverable warnings
        $output.continue = $true
        $output.suppressOutput = $false
        $output.systemMessage = "Context preservation warning: $errorMessage"
    }

    # Log detailed error for debugging
    $errorDetails = @{
        message = $errorMessage
        type = $_.Exception.GetType().FullName
        stack = $_.ScriptStackTrace
        timestamp = [datetime]::UtcNow.ToString('o')
        blocking = $isSecurityError
    }

    # Write error to stderr for logging (won't affect stdout JSON)
    [Console]::Error.WriteLine(($errorDetails | ConvertTo-Json -Compress))
}

#endregion

#region Output JSON Result

# Output the result as JSON to stdout
$outputJson = $output | ConvertTo-Json -Compress
Write-Output $outputJson

# Exit with appropriate code
if ($output.continue) {
    exit 0
} else {
    exit 2
}

#endregion
