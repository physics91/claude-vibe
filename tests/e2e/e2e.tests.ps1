#Requires -Version 5.1
#Requires -Modules Pester

<#
.SYNOPSIS
    End-to-end tests for AGENTS Context Preserver plugin.

.DESCRIPTION
    Tests the complete workflow including:
    - PreCompact hook saves context
    - SessionStart hook loads context
    - Full cycle preservation
    - Error handling and recovery
#>

BeforeAll {
    # Set up paths
    $script:PluginRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $script:HooksPath = Join-Path $script:PluginRoot "hooks"
    $script:LibPath = Join-Path $script:PluginRoot "lib"

    # Source required modules
    . "$script:LibPath\core\parser.ps1"
    . "$script:LibPath\core\storage.ps1"
    . "$script:LibPath\utils\security.ps1"

    # Create test environment
    $script:TestRoot = Join-Path $env:TEMP "AgentsE2ETest_$(Get-Random)"
    New-Item -Path $script:TestRoot -ItemType Directory -Force | Out-Null

    # Create project directory
    $script:ProjectDir = Join-Path $script:TestRoot "project"
    New-Item -Path $script:ProjectDir -ItemType Directory -Force | Out-Null

    # Create storage directory
    $script:StorageDir = Join-Path $script:TestRoot "storage"
    New-Item -Path $script:StorageDir -ItemType Directory -Force | Out-Null

    # Create project AGENTS.md
    $script:AgentsMdContent = @"
# Project AGENTS.md

## Guidelines
IMPORTANT: Follow these coding standards.
ALWAYS use TypeScript for new code.
NEVER commit directly to main.

### code-reviewer
Trigger: After code changes are complete
"@
    $agentsMdPath = Join-Path $script:ProjectDir "AGENTS.md"
    $script:AgentsMdContent | Out-File -FilePath $agentsMdPath -Encoding utf8

    # Create mock transcript (must be inside project directory for security validation)
    $script:TranscriptPath = Join-Path $script:ProjectDir "transcript.txt"
    $transcriptContent = @"
user: Help me implement a new feature for user authentication
assistant: I'll help you implement user authentication. Let me start by:
1. Creating the auth service
2. Adding login/logout endpoints

Read("src/services/auth.ts")
Write("src/services/auth.ts")
Edit("src/routes/auth.ts")

completed the auth service implementation
decided to use JWT tokens for authentication
error: Module not found 'jsonwebtoken'
fixed the dependency issue
"@
    $transcriptContent | Out-File -FilePath $script:TranscriptPath -Encoding utf8

    # Helper function to run hook with input
    function Invoke-HookWithInput {
        param(
            [string]$HookPath,
            [string]$InputJson
        )

        $process = $null
        try {
            # Use Process with proper stdin redirection
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = "powershell.exe"
            $psi.Arguments = "-ExecutionPolicy Bypass -File `"$HookPath`""
            $psi.UseShellExecute = $false
            $psi.RedirectStandardInput = $true
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.CreateNoWindow = $true

            $process = [System.Diagnostics.Process]::Start($psi)

            # Write input and close stdin (critical for ReadToEnd to return)
            $process.StandardInput.Write($InputJson)
            $process.StandardInput.Close()

            # Read output asynchronously to avoid deadlock
            $stdoutTask = $process.StandardOutput.ReadToEndAsync()
            $stderrTask = $process.StandardError.ReadToEndAsync()

            # Wait with timeout
            $completed = $process.WaitForExit(30000)  # 30 seconds

            if (-not $completed) {
                $process.Kill()
                throw "Hook execution timed out"
            }

            # Get async results
            $output = $stdoutTask.GetAwaiter().GetResult()
            $stderr = $stderrTask.GetAwaiter().GetResult()

            if (-not [string]::IsNullOrEmpty($stderr)) {
                Write-Host "Hook stderr: $stderr" -ForegroundColor Yellow
            }

            if ([string]::IsNullOrWhiteSpace($output)) {
                return $null
            }

            return $output.Trim()
        } finally {
            if ($null -ne $process -and -not $process.HasExited) {
                $process.Kill()
            }
            if ($null -ne $process) {
                $process.Dispose()
            }
        }
    }
}

AfterAll {
    # Clean up test environment
    if (Test-Path $script:TestRoot) {
        Remove-Item -Path $script:TestRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Describe "End-to-End Tests" {

    Context "PreCompact Hook" {

        It "Should save context with valid input" {
            $sessionId = "e2e-test-session-$(Get-Random)"
            $input = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            # Parse output JSON
            $output = $result | ConvertFrom-Json

            $output.continue | Should -Be $true
            $output.systemMessage | Should -Match "Context preserved"
        }

        It "Should create context file" {
            $sessionId = "e2e-file-test-$(Get-Random)"
            $input = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            # Check context file was created
            $contextPath = Get-ContextFilePath -StorageDir (Get-DefaultStorageDir) -SessionId $sessionId
            Test-Path -LiteralPath $contextPath | Should -Be $true
        }

        It "Should capture AGENTS.md content" {
            $sessionId = "e2e-agents-test-$(Get-Random)"
            $input = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input | Out-Null

            # Load context and verify AGENTS.md
            $contextPath = Get-ContextFilePath -StorageDir (Get-DefaultStorageDir) -SessionId $sessionId
            $context = Read-ContextState -StoragePath $contextPath

            $context.agents_md | Should -Not -BeNullOrEmpty
            $context.agents_md.project | Should -Not -BeNullOrEmpty
            $context.agents_md.merged | Should -Not -BeNullOrEmpty
        }

        It "Should extract transcript context" {
            $sessionId = "e2e-transcript-test-$(Get-Random)"
            $input = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input | Out-Null

            # Load context and verify transcript extraction
            $contextPath = Get-ContextFilePath -StorageDir (Get-DefaultStorageDir) -SessionId $sessionId
            $context = Read-ContextState -StoragePath $contextPath

            $context.task_context.objective | Should -Not -BeNullOrEmpty
            $context.tool_history.Count | Should -BeGreaterThan 0
        }

        It "Should reject missing session_id" {
            $input = @{
                cwd = $script:ProjectDir
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            $output = $result | ConvertFrom-Json
            $output.systemMessage | Should -Match "session_id"
        }

        It "Should reject missing cwd" {
            $input = @{
                session_id = "test-session"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            $output = $result | ConvertFrom-Json
            $output.systemMessage | Should -Match "cwd"
        }
    }

    Context "SessionStart Hook" {

        BeforeAll {
            # Create context for session-start tests
            $script:SessionStartTestId = "e2e-session-start-$(Get-Random)"

            # Save test context using pre-compact
            $input = @{
                session_id = $script:SessionStartTestId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input | Out-Null
        }

        It "Should load context for valid session" {
            $input = @{
                session_id = $script:SessionStartTestId
                is_compaction = $true
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $input

            # Should return markdown
            $result | Should -Match "Session Context Restored"
        }

        It "Should include session information" {
            $input = @{
                session_id = $script:SessionStartTestId
                is_compaction = $true
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $input

            $result | Should -Match "Previous Session"
            $result | Should -Match "Compaction"
        }

        It "Should include AGENTS.md summary" {
            $input = @{
                session_id = $script:SessionStartTestId
                is_compaction = $true
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $input

            $result | Should -Match "AGENTS.md Summary"
        }

        It "Should return empty for non-compaction session" {
            $input = @{
                session_id = "fresh-session-$(Get-Random)"
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $input

            $result | Should -BeNullOrEmpty
        }

        It "Should return empty for missing session_id" {
            $input = @{
                is_compaction = $true
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $input

            $result | Should -BeNullOrEmpty
        }
    }

    Context "Full Cycle" {

        It "Should preserve and restore context across compaction" {
            $sessionId = "e2e-full-cycle-$(Get-Random)"

            # Step 1: PreCompact - save context
            $preCompactInput = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $preCompactResult = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $preCompactInput

            $preCompactOutput = $preCompactResult | ConvertFrom-Json
            $preCompactOutput.continue | Should -Be $true

            # Step 2: SessionStart - load context
            $sessionStartInput = @{
                session_id = $sessionId
                is_compaction = $true
            } | ConvertTo-Json -Compress

            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $sessionStartResult = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson $sessionStartInput

            # Verify context was restored
            $sessionStartResult | Should -Match "Session Context Restored"
            $sessionStartResult | Should -Match "AGENTS.md Summary"
        }

        It "Should handle multiple compaction cycles" {
            $sessionId = "e2e-multi-cycle-$(Get-Random)"

            # First cycle
            $input = @{
                session_id = $sessionId
                cwd = $script:ProjectDir
                transcript_path = $script:TranscriptPath
                permission_mode = "default"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input | Out-Null

            # Second cycle (simulating another compaction)
            Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input | Out-Null

            # Verify context still valid
            $contextPath = Get-ContextFilePath -StorageDir (Get-DefaultStorageDir) -SessionId $sessionId
            $context = Read-ContextState -StoragePath $contextPath

            $context | Should -Not -BeNullOrEmpty
            $context.session_id | Should -Be $sessionId
        }
    }

    Context "Error Handling" {

        It "Should handle invalid JSON input gracefully" {
            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson "not valid json"

            $output = $result | ConvertFrom-Json
            $output.continue | Should -Be $true  # Should recover gracefully
        }

        It "Should handle non-existent project directory" {
            $input = @{
                session_id = "error-test-$(Get-Random)"
                cwd = "C:\NonExistent\Path\$(Get-Random)"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            $output = $result | ConvertFrom-Json
            # Should either fail gracefully or block with security error
            $output | Should -Not -BeNullOrEmpty
        }

        It "Should handle empty input" {
            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson ""

            $output = $result | ConvertFrom-Json
            $output.systemMessage | Should -Not -BeNullOrEmpty
        }

        It "SessionStart should return empty on error" {
            $sessionStartHook = Join-Path $script:HooksPath "session-start.ps1"
            $result = Invoke-HookWithInput -HookPath $sessionStartHook -InputJson "invalid"

            # Should return empty string on error (graceful degradation)
            $result | Should -BeNullOrEmpty
        }
    }

    Context "Security" {

        It "Should validate project directory exists" {
            $input = @{
                session_id = "security-test-$(Get-Random)"
                cwd = "C:\FakePath\$(Get-Random)"
                hook_event_name = "PreCompact"
            } | ConvertTo-Json -Compress

            $preCompactHook = Join-Path $script:HooksPath "pre-compact.ps1"
            $result = Invoke-HookWithInput -HookPath $preCompactHook -InputJson $input

            $output = $result | ConvertFrom-Json
            $output.systemMessage | Should -Match "directory|SECURITY|error"
        }
    }
}
