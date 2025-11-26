#Requires -Version 5.1
<#
.SYNOPSIS
    SessionStart hook for AGENTS Context Preserver plugin.

.DESCRIPTION
    Loads preserved context after compaction and formats it as markdown
    for injection into the new session. This hook is called by Claude Code
    when a new session starts.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0

    Input: JSON via stdin
    Output: Markdown text to stdout
    Exit Codes:
      0 - Success (output markdown or empty string)
      2 - Blocking error

.EXAMPLE
    $input | .\session-start.ps1
#>

[CmdletBinding()]
param()

# Set strict mode for safety
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Source Required Modules

$scriptRoot = $PSScriptRoot
$libPath = Join-Path (Split-Path $scriptRoot -Parent) "lib"

try {
    . "$libPath\core\parser.ps1"
    . "$libPath\core\storage.ps1"
    . "$libPath\utils\security.ps1"
    . "$libPath\core\preset-manager.ps1"
    . "$libPath\core\project-detector.ps1"
    . "$libPath\core\mcp-config-generator.ps1"
} catch {
    # Graceful degradation - output empty string on module load failure
    Write-Output ""
    exit 0
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Safely gets a nested property from a hashtable without StrictMode errors.

.PARAMETER Hash
    The hashtable to access.

.PARAMETER Keys
    Array of keys to traverse.

.PARAMETER Default
    Default value if path doesn't exist.

.OUTPUTS
    The value at the path or the default.
#>
function Get-SafeHashValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Hash,

        [Parameter(Mandatory = $true)]
        [string[]]$Keys,

        [Parameter()]
        $Default = $null
    )

    if ($null -eq $Hash) {
        return $Default
    }

    $current = $Hash
    foreach ($key in $Keys) {
        if ($null -eq $current) {
            return $Default
        }

        if ($current -is [hashtable]) {
            if (-not $current.ContainsKey($key)) {
                return $Default
            }
            $current = $current[$key]
        } elseif ($current -is [PSCustomObject]) {
            $prop = $current.PSObject.Properties[$key]
            if ($null -eq $prop) {
                return $Default
            }
            $current = $prop.Value
        } else {
            return $Default
        }
    }

    # Return default if final value is null
    if ($null -eq $current) {
        return $Default
    }

    return $current
}

<#
.SYNOPSIS
    Formats task progress as markdown checkbox list.

.PARAMETER Progress
    Hashtable containing completed, in_progress, and pending arrays.

.OUTPUTS
    System.String
    Formatted markdown progress section.
#>
function Format-TaskProgress {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Progress
    )

    if ($null -eq $Progress) {
        return ""
    }

    $result = [System.Text.StringBuilder]::new()

    # Completed tasks
    $completedRaw = Get-SafeHashValue -Hash $Progress -Keys @('completed') -Default @()
    $completed = @(@($completedRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($completed.Count -gt 0) {
        [void]$result.AppendLine("**Completed**:")
        foreach ($task in $completed) {
            [void]$result.AppendLine("- [x] $task")
        }
        [void]$result.AppendLine("")
    }

    # In-progress tasks
    $inProgressRaw = Get-SafeHashValue -Hash $Progress -Keys @('in_progress') -Default @()
    $inProgress = @(@($inProgressRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($inProgress.Count -gt 0) {
        [void]$result.AppendLine("**In Progress**:")
        foreach ($task in $inProgress) {
            [void]$result.AppendLine("- [ ] $task")
        }
        [void]$result.AppendLine("")
    }

    # Pending tasks
    $pendingRaw = Get-SafeHashValue -Hash $Progress -Keys @('pending') -Default @()
    $pending = @(@($pendingRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($pending.Count -gt 0) {
        [void]$result.AppendLine("**Pending**:")
        foreach ($task in $pending) {
            [void]$result.AppendLine("- [ ] $task")
        }
        [void]$result.AppendLine("")
    }

    return $result.ToString().TrimEnd()
}

<#
.SYNOPSIS
    Summarizes AGENTS.md directives for context injection.

.PARAMETER AgentsData
    Parsed AGENTS.md data containing sections and key_instructions.

.OUTPUTS
    System.String
    Summarized markdown of key directives.
#>
function Format-AgentsSummary {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $AgentsData
    )

    if ($null -eq $AgentsData) {
        return ""
    }

    $result = [System.Text.StringBuilder]::new()

    # Key instructions (IMPORTANT, MUST, ALWAYS, NEVER, etc.)
    $keyInstructionsRaw = Get-SafeHashValue -Hash $AgentsData -Keys @('key_instructions') -Default @()
    $keyInstructions = @(@($keyInstructionsRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($keyInstructions.Count -gt 0) {
        [void]$result.AppendLine("**Key Directives**:")

        # Limit to top 10 key instructions
        $topInstructions = $keyInstructions | Select-Object -First 10
        foreach ($instruction in $topInstructions) {
            # Truncate long instructions
            $displayInstruction = if ($instruction.Length -gt 100) {
                $instruction.Substring(0, 97) + "..."
            } else {
                $instruction
            }
            [void]$result.AppendLine("- $displayInstruction")
        }

        if ($keyInstructions.Count -gt 10) {
            [void]$result.AppendLine("- ... and $($keyInstructions.Count - 10) more")
        }
        [void]$result.AppendLine("")
    }

    # Subagents if defined
    $subagentsRaw = Get-SafeHashValue -Hash $AgentsData -Keys @('subagents') -Default @()
    $subagents = @(@($subagentsRaw) | Where-Object { $_ -and ($_ -is [hashtable] -or $_ -is [PSCustomObject]) })
    if ($subagents.Count -gt 0) {
        [void]$result.AppendLine("**Available Subagents**:")
        foreach ($subagent in $subagents) {
            $name = Get-SafeHashValue -Hash $subagent -Keys @('name') -Default "unknown"
            $trigger = Get-SafeHashValue -Hash $subagent -Keys @('trigger')
            $triggerText = if ($trigger) { " (trigger: $trigger)" } else { "" }
            [void]$result.AppendLine("- **$name**$triggerText")
        }
        [void]$result.AppendLine("")
    }

    return $result.ToString().TrimEnd()
}

<#
.SYNOPSIS
    Formats AGENTS.md summary from project root for all sessions.

.DESCRIPTION
    Reads and merges AGENTS.md files from global, project, and local paths,
    then formats a comprehensive summary for session injection.
    This function is used for ALL sessions, not just post-compaction.

.PARAMETER ProjectRoot
    The project root directory to search for AGENTS.md files.

.OUTPUTS
    System.String
    Comprehensive markdown summary of AGENTS.md guidelines.
#>
function Format-AgentsMdSummary {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    try {
        # Get AGENTS.md files from all 3 layers
        $agentsMdFiles = Get-AgentsMdFiles -ProjectRoot $ProjectRoot -IncludeLocal $true -LocalMaxDepth 3

        if ($null -eq $agentsMdFiles) {
            return ""
        }

        # Check if any AGENTS.md exists
        $hasGlobal = $null -ne $agentsMdFiles.global
        $hasProject = $null -ne $agentsMdFiles.project
        $hasLocal = $agentsMdFiles.local -and $agentsMdFiles.local.Count -gt 0

        if (-not $hasGlobal -and -not $hasProject -and -not $hasLocal) {
            return ""
        }

        # Merge configs (Local > Project > Global priority)
        $globalParsed = if ($hasGlobal) { $agentsMdFiles.global.parsed } else { $null }
        $projectParsed = if ($hasProject) { $agentsMdFiles.project.parsed } else { $null }
        $localParsed = if ($hasLocal) {
            @($agentsMdFiles.local | ForEach-Object { $_.parsed } | Where-Object { $_ })
        } else { @() }

        $merged = Merge-AgentsMdConfigs -Global $globalParsed -Project $projectParsed -Local $localParsed

        if ($null -eq $merged) {
            return ""
        }

        $result = [System.Text.StringBuilder]::new()

        # Header
        [void]$result.AppendLine("## AGENTS.md Guidelines")
        [void]$result.AppendLine("")

        # Key instructions (IMPORTANT, MUST, ALWAYS, NEVER, etc.)
        $keyInstructionsRaw = Get-SafeHashValue -Hash $merged -Keys @('key_instructions') -Default @()
        $keyInstructions = @(@($keyInstructionsRaw) | Where-Object { $_ -and $_ -is [string] })
        if ($keyInstructions.Count -gt 0) {
            [void]$result.AppendLine("### Key Directives")
            $topInstructions = $keyInstructions | Select-Object -First 15
            foreach ($instruction in $topInstructions) {
                $displayInstruction = if ($instruction.Length -gt 120) {
                    $instruction.Substring(0, 117) + "..."
                } else {
                    $instruction
                }
                [void]$result.AppendLine("- $displayInstruction")
            }
            if ($keyInstructions.Count -gt 15) {
                [void]$result.AppendLine("- ... and $($keyInstructions.Count - 15) more")
            }
            [void]$result.AppendLine("")
        }

        # Subagents
        $subagentsRaw = Get-SafeHashValue -Hash $merged -Keys @('subagents') -Default @()
        $subagents = @(@($subagentsRaw) | Where-Object { $_ -and ($_ -is [hashtable] -or $_ -is [PSCustomObject]) })
        if ($subagents.Count -gt 0) {
            [void]$result.AppendLine("### Available Subagents")
            foreach ($subagent in $subagents) {
                $name = Get-SafeHashValue -Hash $subagent -Keys @('name') -Default "unknown"
                $trigger = Get-SafeHashValue -Hash $subagent -Keys @('trigger')
                $triggerText = if ($trigger) { " (trigger: $trigger)" } else { "" }
                [void]$result.AppendLine("- **$name**$triggerText")
            }
            [void]$result.AppendLine("")
        }

        # Sections summary (top-level sections only)
        $sectionsRaw = Get-SafeHashValue -Hash $merged -Keys @('sections') -Default @()
        $sections = @(@($sectionsRaw) | Where-Object { $_ -and ($_ -is [hashtable] -or $_ -is [PSCustomObject]) })
        $topLevelSections = @($sections | Where-Object {
            $level = Get-SafeHashValue -Hash $_ -Keys @('level') -Default 1
            $level -le 2
        })

        if ($topLevelSections.Count -gt 0) {
            [void]$result.AppendLine("### Document Structure")
            foreach ($section in $topLevelSections) {
                $heading = Get-SafeHashValue -Hash $section -Keys @('heading') -Default "Untitled"
                $directivesRaw = Get-SafeHashValue -Hash $section -Keys @('directives') -Default @()
                $directives = @(@($directivesRaw) | Where-Object { $_ -and $_ -is [string] })
                $directiveCount = $directives.Count
                if ($directiveCount -gt 0) {
                    [void]$result.AppendLine("- **$heading** ($directiveCount items)")
                } else {
                    [void]$result.AppendLine("- **$heading**")
                }
            }
            [void]$result.AppendLine("")
        }

        return $result.ToString().TrimEnd()
    }
    catch {
        # Graceful degradation - return empty on error
        return ""
    }
}

<#
.SYNOPSIS
    Formats complete context as markdown for session injection.

.PARAMETER Context
    The loaded context hashtable.

.PARAMETER SessionId
    The previous session ID (for display).

.OUTPUTS
    System.String
    Complete markdown formatted context.
#>
function Format-ContextAsMarkdown {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Context,

        [Parameter()]
        [string]$SessionId = ""
    )

    $result = [System.Text.StringBuilder]::new()

    # Header
    [void]$result.AppendLine("## Session Context Restored")
    [void]$result.AppendLine("")

    # Session Information
    [void]$result.AppendLine("### Session Information")

    # Extract session metadata using safe accessor
    $sessionIdValue = Get-SafeHashValue -Hash $Context -Keys @('session_id') -Default ""
    $previousSession = if ($sessionIdValue) {
        $sessionIdValue.Substring(0, [Math]::Min(8, $sessionIdValue.Length))
    } else {
        "unknown"
    }

    # Get compaction count from metadata
    $compactionNumber = Get-SafeHashValue -Hash $Context -Keys @('metadata', 'compaction_count') -Default 1

    $lastActive = Get-SafeHashValue -Hash $Context -Keys @('updated_at')
    if (-not $lastActive) {
        $lastActive = Get-SafeHashValue -Hash $Context -Keys @('created_at')
    }
    if (-not $lastActive) {
        $lastActive = [datetime]::UtcNow.ToString('o')
    }

    [void]$result.AppendLine("- **Previous Session**: $previousSession")
    [void]$result.AppendLine("- **Compaction #**: $compactionNumber")
    [void]$result.AppendLine("- **Last Active**: $lastActive")
    [void]$result.AppendLine("")

    # Current Objective - read from task_context.objective
    $objective = Get-SafeHashValue -Hash $Context -Keys @('task_context', 'objective')
    if ($objective) {
        [void]$result.AppendLine("### Current Objective")
        [void]$result.AppendLine($objective)
        [void]$result.AppendLine("")
    }

    # Progress - read from task_context.steps_completed
    $stepsCompletedRaw = Get-SafeHashValue -Hash $Context -Keys @('task_context', 'steps_completed') -Default @()
    $stepsCompleted = @(@($stepsCompletedRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($stepsCompleted.Count -gt 0) {
        [void]$result.AppendLine("### Progress")
        [void]$result.AppendLine("**Completed Steps**:")
        foreach ($step in $stepsCompleted) {
            [void]$result.AppendLine("- [x] $step")
        }
        [void]$result.AppendLine("")
    }

    # Key Decisions - read from task_context.key_decisions
    $keyDecisionsRaw = Get-SafeHashValue -Hash $Context -Keys @('task_context', 'key_decisions') -Default @()
    $keyDecisions = @(@($keyDecisionsRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($keyDecisions.Count -gt 0) {
        [void]$result.AppendLine("### Key Decisions")
        $decisionNum = 1
        foreach ($decision in $keyDecisions) {
            [void]$result.AppendLine("$decisionNum. $decision")
            $decisionNum++
        }
        [void]$result.AppendLine("")
    }

    # Active Files - read from working_context.files
    $filesRaw = Get-SafeHashValue -Hash $Context -Keys @('working_context', 'files') -Default @()
    $files = @(@($filesRaw) | Where-Object { $_ -and $_ -is [string] })
    if ($files.Count -gt 0) {
        [void]$result.AppendLine("### Active Files")
        foreach ($file in $files) {
            [void]$result.AppendLine("- $file")
        }
        [void]$result.AppendLine("")
    }

    # Recent Errors - read from working_context.recent_errors
    $recentErrorsRaw = Get-SafeHashValue -Hash $Context -Keys @('working_context', 'recent_errors') -Default @()
    $recentErrors = @(@($recentErrorsRaw) | Where-Object { $_ })
    if ($recentErrors.Count -gt 0) {
        [void]$result.AppendLine("### Recent Errors")
        foreach ($err in $recentErrors) {
            if ($err -is [hashtable]) {
                $errType = Get-SafeHashValue -Hash $err -Keys @('type') -Default "Error"
                $errMsg = Get-SafeHashValue -Hash $err -Keys @('message') -Default ""
                [void]$result.AppendLine("- **$errType**: $errMsg")
            } else {
                [void]$result.AppendLine("- $err")
            }
        }
        [void]$result.AppendLine("")
    }

    # Tool History - read from tool_history
    $toolHistoryRaw = Get-SafeHashValue -Hash $Context -Keys @('tool_history') -Default @()
    $toolHistory = @(@($toolHistoryRaw) | Where-Object { $_ })
    if ($toolHistory.Count -gt 0) {
        [void]$result.AppendLine("### Recent Tool Usage")
        $recentTools = $toolHistory | Select-Object -Last 10
        foreach ($tool in $recentTools) {
            if ($tool -is [hashtable]) {
                $toolName = Get-SafeHashValue -Hash $tool -Keys @('tool') -Default "unknown"
                $toolTarget = Get-SafeHashValue -Hash $tool -Keys @('target') -Default ""
                [void]$result.AppendLine("- **$toolName**: $toolTarget")
            } else {
                [void]$result.AppendLine("- $tool")
            }
        }
        [void]$result.AppendLine("")
    }

    # AGENTS.md Summary - read from agents_md.merged (Issue #3 fix)
    $agentsMd = Get-SafeHashValue -Hash $Context -Keys @('agents_md')
    if ($agentsMd) {
        [void]$result.AppendLine("### AGENTS.md Summary")

        # Use merged data if available (correct path)
        $agentsData = Get-SafeHashValue -Hash $agentsMd -Keys @('merged')
        if (-not $agentsData) {
            $agentsData = $agentsMd
        }

        $agentsSummary = Format-AgentsSummary -AgentsData $agentsData
        if (-not [string]::IsNullOrWhiteSpace($agentsSummary)) {
            [void]$result.AppendLine($agentsSummary)
        } else {
            [void]$result.AppendLine("*No key directives found*")
        }
        [void]$result.AppendLine("")
    }

    # Environment info - read from working_context.environment
    $envInfo = Get-SafeHashValue -Hash $Context -Keys @('working_context', 'environment')
    if ($envInfo) {
        [void]$result.AppendLine("### Environment")
        $cwd = Get-SafeHashValue -Hash $envInfo -Keys @('cwd')
        if ($cwd) {
            [void]$result.AppendLine("- **Working Directory**: $cwd")
        }
        $permMode = Get-SafeHashValue -Hash $envInfo -Keys @('permission_mode')
        if ($permMode) {
            [void]$result.AppendLine("- **Permission Mode**: $permMode")
        }
        [void]$result.AppendLine("")
    }

    return $result.ToString().TrimEnd()
}

<#
.SYNOPSIS
    Loads configuration and returns context file path.

.PARAMETER SessionId
    The session ID to use in the filename.

.OUTPUTS
    System.String
    Path to the context storage file.
#>
function Get-ContextStoragePathFromConfig {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SessionId
    )

    # Load configuration
    $configPath = Join-Path $env:USERPROFILE ".claude\claude-vibe\config.json"
    $storageDir = Get-DefaultStorageDir

    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        try {
            $loadedConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json | ConvertTo-HashtableRecursive
            if ($loadedConfig.storage_dir) {
                $storageDir = $loadedConfig.storage_dir
            }
        } catch {
            Write-Verbose "Failed to load config, using defaults: $($_.Exception.Message)"
        }
    }

    # Use shared helper for consistent path computation
    return Get-ContextFilePath -StorageDir $storageDir -SessionId $SessionId
}

<#
.SYNOPSIS
    Checks if this session should load preserved context.

.PARAMETER Input
    The hook input hashtable.

.OUTPUTS
    System.Boolean
    Returns $true if context should be loaded.
#>
function Test-ShouldLoadContext {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$HookInput
    )

    # Check for indicators that this is a post-compaction session

    # 1. Check if there's a transcript path (indicates continuation)
    if ($HookInput.ContainsKey('transcript_path') -and $HookInput.transcript_path) {
        # Check if there's a compaction marker file
        $transcriptDir = Split-Path $HookInput.transcript_path -Parent
        if ($transcriptDir) {
            $compactionMarker = Join-Path $transcriptDir ".compaction-marker"
            if (Test-Path -LiteralPath $compactionMarker -PathType Leaf) {
                return $true
            }
        }
    }

    # 2. Check for explicit compact indicator in session data
    if (($HookInput.ContainsKey('is_compaction') -and $HookInput.is_compaction -eq $true) -or
        ($HookInput.ContainsKey('after_compact') -and $HookInput.after_compact -eq $true)) {
        return $true
    }

    # 3. Check for preserved context file existence using session_id
    if ($HookInput.ContainsKey('session_id') -and $HookInput.session_id) {
        $contextPath = Get-ContextStoragePathFromConfig -SessionId $HookInput.session_id
        if (Test-Path -LiteralPath $contextPath -PathType Leaf) {
            # Check if context was recently saved (within last 5 minutes)
            $contextFile = Get-Item -LiteralPath $contextPath
            $age = ([datetime]::UtcNow - $contextFile.LastWriteTimeUtc).TotalMinutes

            if ($age -le 5) {
                # Recent context file - likely from compaction
                return $true
            }
        }
    }

    # Default: don't load context for fresh sessions
    return $false
}

#endregion

#region Context Profile Functions

<#
.SYNOPSIS
    Formats the active context profile as markdown.

.PARAMETER Profile
    The context profile hashtable.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    System.String
    Formatted markdown for the active profile.
#>
function Format-ContextProfileStatus {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Profile,

        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $result = [System.Text.StringBuilder]::new()

    [void]$result.AppendLine("")
    [void]$result.AppendLine("## Active Context Profile")
    [void]$result.AppendLine("")

    $profileName = Get-SafeHashValue -Hash $Profile -Keys @('displayName') -Default ""
    if (-not $profileName) {
        $profileName = Get-SafeHashValue -Hash $Profile -Keys @('name') -Default "custom"
    }

    [void]$result.AppendLine("**Profile**: $profileName")
    [void]$result.AppendLine("**Project**: $ProjectRoot")

    # MCP servers
    $mcpEnabled = Get-SafeHashValue -Hash $Profile -Keys @('mcp', 'enabled') -Default @()
    if ($mcpEnabled -and $mcpEnabled.Count -gt 0 -and $mcpEnabled[0] -ne "*") {
        [void]$result.AppendLine("**MCP Servers**: $($mcpEnabled -join ', ')")
    }

    # Agents
    $agentsEnabled = Get-SafeHashValue -Hash $Profile -Keys @('agents', 'enabled') -Default @()
    if ($agentsEnabled -and $agentsEnabled.Count -gt 0 -and $agentsEnabled[0] -ne "*") {
        $agentCount = $agentsEnabled.Count
        [void]$result.AppendLine("**Agents**: $agentCount enabled")
    }

    # Token savings
    $tokenSaved = Get-SafeHashValue -Hash $Profile -Keys @('estimatedTokenSaved') -Default 0
    if ($tokenSaved -gt 0) {
        [void]$result.AppendLine("**Estimated Token Savings**: ~$tokenSaved tokens")
    }

    [void]$result.AppendLine("")
    [void]$result.AppendLine("To modify: ``/context-setup``")

    return $result.ToString()
}

<#
.SYNOPSIS
    Formats a context optimization suggestion when no profile exists.

.PARAMETER Detection
    The project detection result.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    System.String
    Formatted markdown suggestion.
#>
function Format-ContextOptimizationSuggestion {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Detection,

        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    # Only suggest if confidence is high enough
    if ($Detection.confidence -lt 0.3) {
        return ""
    }

    $result = [System.Text.StringBuilder]::new()

    [void]$result.AppendLine("")
    [void]$result.AppendLine("## Context Optimization Available")
    [void]$result.AppendLine("")

    $detectedType = $Detection.detectedType
    $preset = Get-PresetByName -Name $Detection.recommendedPreset

    $displayName = if ($preset) {
        Get-SafeHashValue -Hash $preset -Keys @('displayName') -Default $detectedType
    } else {
        $detectedType
    }

    $confidence = [math]::Round($Detection.confidence * 100)

    [void]$result.AppendLine("**Detected Project Type**: $displayName ($confidence% confidence)")
    [void]$result.AppendLine("**Recommended Preset**: $($Detection.recommendedPreset)")

    if ($preset -and $preset.estimatedTokenSaved) {
        [void]$result.AppendLine("**Estimated Token Savings**: ~$($preset.estimatedTokenSaved) tokens")
    }

    [void]$result.AppendLine("")
    [void]$result.AppendLine("Run ``/context-setup`` to optimize your context window.")

    return $result.ToString()
}

<#
.SYNOPSIS
    Gets context profile information for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    System.String
    Formatted markdown or empty string.
#>
function Get-ContextProfileInfo {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    try {
        # Check for existing profile
        $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

        if ($profile) {
            return Format-ContextProfileStatus -Profile $profile -ProjectRoot $ProjectRoot
        }

        # No profile - try to detect and suggest
        $detection = Detect-ProjectType -ProjectRoot $ProjectRoot

        if ($detection -and $detection.detectedType -ne "unknown") {
            return Format-ContextOptimizationSuggestion -Detection $detection -ProjectRoot $ProjectRoot
        }

        return ""
    }
    catch {
        # Graceful degradation
        return ""
    }
}

#endregion

#region Main Execution

try {
    # Read JSON input from stdin
    $inputJson = [Console]::In.ReadToEnd()

    if ([string]::IsNullOrWhiteSpace($inputJson)) {
        # No input - return empty string
        Write-Output ""
        exit 0
    }

    # Parse JSON input
    $parsed = $inputJson | ConvertFrom-Json | ConvertTo-HashtableRecursive

    # Handle case where pipeline returns array (take first element)
    $hookInput = if ($parsed -is [array]) {
        if ($parsed.Count -gt 0) { $parsed[0] } else { $null }
    } else {
        $parsed
    }

    if ($null -eq $hookInput -or $hookInput -isnot [hashtable]) {
        # Invalid input - return empty string
        Write-Output ""
        exit 0
    }

    # Validate required fields
    if (-not $hookInput.session_id) {
        Write-Output ""
        exit 0
    }

    # Get project root from hook input
    $projectRoot = Get-SafeHashValue -Hash $hookInput -Keys @('cwd') -Default (Get-Location).Path

    # Check if we should load context
    $shouldLoad = Test-ShouldLoadContext -HookInput $hookInput

    if (-not $shouldLoad) {
        # Not a compaction session - but still inject AGENTS.md summary for all sessions
        $output = @()

        # AGENTS.md summary - always inject for every session
        $agentsSummary = Format-AgentsMdSummary -ProjectRoot $projectRoot
        if ($agentsSummary) {
            $output += $agentsSummary
        }

        # Context profile info
        $profileInfo = Get-ContextProfileInfo -ProjectRoot $projectRoot
        if ($profileInfo) {
            $output += $profileInfo
        }

        if ($output.Count -gt 0) {
            Write-Output ($output -join "`n`n")
        } else {
            Write-Output ""
        }
        exit 0
    }

    # Get context storage path using shared helper
    $contextPath = Get-ContextStoragePathFromConfig -SessionId $hookInput.session_id

    # Check if context file exists
    if (-not (Test-Path -LiteralPath $contextPath -PathType Leaf)) {
        Write-Output ""
        exit 0
    }

    # Load preserved context
    $context = Read-ContextState -StoragePath $contextPath -RecoverFromBackup $true

    if ($null -eq $context) {
        Write-Output ""
        exit 0
    }

    # Format context as markdown
    $markdown = Format-ContextAsMarkdown -Context $context -SessionId $hookInput.session_id

    # Add context profile status if available
    $projectRoot = Get-SafeHashValue -Hash $hookInput -Keys @('cwd') -Default (Get-Location).Path
    $profileInfo = Get-ContextProfileInfo -ProjectRoot $projectRoot

    if ($profileInfo) {
        $markdown = $markdown + $profileInfo
    }

    # Output markdown to stdout
    Write-Output $markdown

    # Optionally clean up context file after successful load
    # (commented out - may want to keep for debugging)
    # Remove-Item -LiteralPath $contextPath -Force -ErrorAction SilentlyContinue

    exit 0

} catch {
    # Graceful degradation on any error
    # Log error for debugging but don't block session start
    $errorMessage = $_.Exception.Message

    # Write to stderr for debugging (won't affect Claude Code)
    [Console]::Error.WriteLine("SessionStart hook error: $errorMessage")

    # Return empty string to allow session to continue
    Write-Output ""
    exit 0
}

#endregion
