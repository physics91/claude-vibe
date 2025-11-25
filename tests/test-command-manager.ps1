# Command Manager Unit Tests
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Get the project root
$projectRoot = Split-Path -Parent $PSScriptRoot

# Import the module
. "$projectRoot\lib\core\command-manager.ps1"

Write-Host "=== Command Manager Unit Tests ===" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

# Helper function
function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$Test
    )

    Write-Host "Testing: $Name" -ForegroundColor Yellow
    try {
        & $Test
        Write-Host "  PASSED" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        return $false
    }
}

# Test 1: Get-ManagedCommands returns array
if (Test-Case "Get-ManagedCommands returns array" {
    $commands = Get-ManagedCommands
    if ($commands -isnot [array]) {
        throw "Expected array, got $($commands.GetType().Name)"
    }
}) { $passed++ } else { $failed++ }

# Test 2: Get-ManagedCommands finds sample commands
if (Test-Case "Get-ManagedCommands finds sample commands" {
    $commands = Get-ManagedCommands
    if ($commands.Count -lt 1) {
        throw "Expected at least 1 command, found $($commands.Count)"
    }
    $names = $commands | ForEach-Object { $_.name }
    if ($names -notcontains "analyze-code") {
        throw "Expected to find 'analyze-code' command"
    }
}) { $passed++ } else { $failed++ }

# Test 3: Get-CommandInfo parses frontmatter
if (Test-Case "Get-CommandInfo parses frontmatter correctly" {
    $cmdPath = Join-Path $projectRoot "managed-commands\analyze-code.md"
    $info = Get-CommandInfo -FilePath $cmdPath
    if (-not $info) {
        throw "Failed to get command info"
    }
    if ($info.name -ne "analyze-code") {
        throw "Expected name 'analyze-code', got '$($info.name)'"
    }
    if (-not $info.description) {
        throw "Expected description to be parsed"
    }
}) { $passed++ } else { $failed++ }

# Test 4: Get-CommandInfo estimates tokens
if (Test-Case "Get-CommandInfo estimates tokens" {
    $cmdPath = Join-Path $projectRoot "managed-commands\analyze-code.md"
    $info = Get-CommandInfo -FilePath $cmdPath
    if ($info.estimatedTokens -lt 50) {
        throw "Token estimate too low: $($info.estimatedTokens)"
    }
}) { $passed++ } else { $failed++ }

# Test 5: Format-CommandList produces output
if (Test-Case "Format-CommandList produces markdown output" {
    $output = Format-CommandList -EnabledCommands @("analyze-code")
    if (-not $output) {
        throw "Expected output, got empty"
    }
    if ($output -notmatch "\[x\].*analyze-code") {
        throw "Expected enabled analyze-code to be checked"
    }
}) { $passed++ } else { $failed++ }

# Test 6: Get-CommandTokenSavings calculates correctly
if (Test-Case "Get-CommandTokenSavings calculates savings" {
    $savings = Get-CommandTokenSavings -EnabledCommands @("analyze-code")
    $allEnabled = Get-CommandTokenSavings -EnabledCommands @("*")

    if ($savings -lt 0) {
        throw "Savings should not be negative"
    }
    if ($allEnabled -ne 0) {
        throw "All enabled should have 0 savings, got $allEnabled"
    }
}) { $passed++ } else { $failed++ }

# Test 7: Enable/Disable in temp directory
if (Test-Case "Enable/Disable commands in temp project" {
    $tempProject = Join-Path $env:TEMP "command-test-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempProject -Force | Out-Null

    try {
        # Enable a command
        $enabled = Enable-ProjectCommand -ProjectRoot $tempProject -CommandName "analyze-code"
        if (-not $enabled) {
            throw "Failed to enable command"
        }

        # Check file exists
        $cmdPath = Join-Path $tempProject ".claude\commands\analyze-code.md"
        if (-not (Test-Path $cmdPath)) {
            throw "Command file not created at $cmdPath"
        }

        # Get enabled commands
        $enabledCmds = Get-EnabledProjectCommands -ProjectRoot $tempProject
        if ($enabledCmds -notcontains "analyze-code") {
            throw "analyze-code not in enabled list"
        }

        # Disable the command
        $disabled = Disable-ProjectCommand -ProjectRoot $tempProject -CommandName "analyze-code"
        if (-not $disabled) {
            throw "Failed to disable command"
        }

        # Check file removed
        if (Test-Path $cmdPath) {
            throw "Command file not removed"
        }
    }
    finally {
        Remove-Item -Path $tempProject -Recurse -Force -ErrorAction SilentlyContinue
    }
}) { $passed++ } else { $failed++ }

# Test 8: Set-ProjectCommands batch operation
if (Test-Case "Set-ProjectCommands handles batch enable/disable" {
    $tempProject = Join-Path $env:TEMP "command-batch-test-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempProject -Force | Out-Null

    try {
        # Enable multiple commands
        $result = Set-ProjectCommands -ProjectRoot $tempProject -EnabledCommands @("analyze-code", "review-pr")

        if ($result.enabled.Count -lt 2) {
            throw "Expected at least 2 commands enabled"
        }

        # Disable one
        $result2 = Set-ProjectCommands -ProjectRoot $tempProject -DisabledCommands @("analyze-code")

        $remaining = Get-EnabledProjectCommands -ProjectRoot $tempProject
        if ($remaining -contains "analyze-code") {
            throw "analyze-code should be disabled"
        }
    }
    finally {
        Remove-Item -Path $tempProject -Recurse -Force -ErrorAction SilentlyContinue
    }
}) { $passed++ } else { $failed++ }

# Test 9: Security - Cannot disable non-managed command
if (Test-Case "Cannot disable non-managed command (security)" {
    $tempProject = Join-Path $env:TEMP "command-security-test-$(Get-Random)"
    $cmdDir = Join-Path $tempProject ".claude\commands"
    New-Item -ItemType Directory -Path $cmdDir -Force | Out-Null

    try {
        # Create a non-managed command file
        $nonManagedPath = Join-Path $cmdDir "custom-user-command.md"
        "# Custom command" | Set-Content -Path $nonManagedPath

        # Try to disable it (should fail/return false)
        $result = Disable-ProjectCommand -ProjectRoot $tempProject -CommandName "custom-user-command"

        # File should still exist (not deleted)
        if (-not (Test-Path $nonManagedPath)) {
            throw "Non-managed command file was deleted - security issue!"
        }
    }
    finally {
        Remove-Item -Path $tempProject -Recurse -Force -ErrorAction SilentlyContinue
    }
}) { $passed++ } else { $failed++ }

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Total:  $($passed + $failed)"

if ($failed -gt 0) {
    exit 1
} else {
    Write-Host ""
    Write-Host "All command manager tests passed!" -ForegroundColor Green
    exit 0
}
