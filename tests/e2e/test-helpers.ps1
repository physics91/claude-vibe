# E2E Test Helpers
# Provides utility functions for end-to-end testing

function New-TestEnvironment {
    param (
        [Parameter(Mandatory = $true)]
        [string]$TestName
    )

    # Create temporary test directory
    $testDir = Join-Path $env:TEMP "claude-vibe-e2e-$TestName-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null

    # Create logs directory
    $logsDir = Join-Path $testDir "logs"
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

    return @{
        RootDir = $testDir
        LogsDir = $logsDir
    }
}

function Remove-TestEnvironment {
    param (
        [Parameter(Mandatory = $true)]
        [hashtable]$Environment
    )

    if (Test-Path $Environment.RootDir) {
        Remove-Item -Path $Environment.RootDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-HookWithPrompt {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PluginRoot,

        [Parameter(Mandatory = $true)]
        [string]$Prompt,

        [Parameter(Mandatory = $true)]
        [hashtable]$Environment
    )

    # Set environment variables
    $env:CLAUDE_PLUGIN_ROOT = $PluginRoot
    $env:CLAUDE_PROMPT = $Prompt

    # Execute hook script
    $hookScript = Join-Path $PluginRoot "hooks\user-prompt-submit.ps1"

    try {
        $output = & powershell -ExecutionPolicy Bypass -File $hookScript 2>&1 | Out-String

        return @{
            Success = $LASTEXITCODE -eq 0
            Output  = $output
            ExitCode = $LASTEXITCODE
        }
    }
    catch {
        return @{
            Success = $false
            Output  = $_.Exception.Message
            ExitCode = 1
        }
    }
    finally {
        # Clean up environment variables
        Remove-Item Env:\CLAUDE_PLUGIN_ROOT -ErrorAction SilentlyContinue
        Remove-Item Env:\CLAUDE_PROMPT -ErrorAction SilentlyContinue
    }
}

function Test-SkillActivation {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Output
    )

    # Check if output contains skill activation marker
    return $Output -match "VIBE CODING ASSISTANT: PROMPT CLARIFICATION NEEDED" -and
           $Output -match "\[Activate Skill: prompt-clarifier\]"
}

function Test-AmbiguityDetection {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Output,

        [Parameter(Mandatory = $true)]
        [string[]]$ExpectedReasons
    )

    foreach ($reason in $ExpectedReasons) {
        if ($Output -notmatch $reason) {
            return $false
        }
    }

    return $true
}

function Get-LogFiles {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PluginRoot
    )

    $logsDir = Join-Path $PluginRoot "logs"

    if (-not (Test-Path $logsDir)) {
        return @()
    }

    return Get-ChildItem -Path $logsDir -Filter "*.log" | Sort-Object LastWriteTime -Descending
}

function Test-LogFileContains {
    param (
        [Parameter(Mandatory = $true)]
        [string]$LogFile,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedContent
    )

    if (-not (Test-Path $LogFile)) {
        return $false
    }

    $content = Get-Content -Path $LogFile -Raw
    return $content -match $ExpectedContent
}

function Write-TestResult {
    param (
        [Parameter(Mandatory = $true)]
        [string]$TestName,

        [Parameter(Mandatory = $true)]
        [bool]$Passed,

        [string]$Message = ""
    )

    if ($Passed) {
        Write-Host "  ✓ $TestName" -ForegroundColor Green
        if ($Message) {
            Write-Host "    $Message" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "  ✗ $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "    $Message" -ForegroundColor Yellow
        }
    }

    return $Passed
}

function Assert-Equal {
    param (
        [Parameter(Mandatory = $true)]
        $Expected,

        [Parameter(Mandatory = $true)]
        $Actual,

        [string]$Message = ""
    )

    if ($Expected -ne $Actual) {
        $msg = "Expected: $Expected, Actual: $Actual"
        if ($Message) {
            $msg = "$Message - $msg"
        }
        throw $msg
    }
}

function Assert-Contains {
    param (
        [Parameter(Mandatory = $true)]
        [string]$String,

        [Parameter(Mandatory = $true)]
        [string]$Substring,

        [string]$Message = ""
    )

    if ($String -notmatch [regex]::Escape($Substring)) {
        $msg = "String does not contain: $Substring"
        if ($Message) {
            $msg = "$Message - $msg"
        }
        throw $msg
    }
}

function Assert-NotContains {
    param (
        [Parameter(Mandatory = $true)]
        [string]$String,

        [Parameter(Mandatory = $true)]
        [string]$Substring,

        [string]$Message = ""
    )

    if ($String -match [regex]::Escape($Substring)) {
        $msg = "String should not contain: $Substring"
        if ($Message) {
            $msg = "$Message - $msg"
        }
        throw $msg
    }
}
