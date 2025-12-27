#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Step {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [scriptblock]$ScriptBlock
    )

    Write-Host ""
    Write-Host "== $Name ==" -ForegroundColor Cyan

    & $ScriptBlock
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed with exit code $($LASTEXITCODE): $Name"
    }
}

function Test-CommandAvailable {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$CommandName
    )

    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

Invoke-Step -Name "Lint AGENTS files" -ScriptBlock {
    if (-not (Test-CommandAvailable -CommandName 'node')) {
        throw "node is required but was not found on PATH."
    }

    & node (Join-Path $projectRoot "tools/lint-agents.js") --root $projectRoot --no-global --strict
}

Invoke-Step -Name "Node.js tests (hooks)" -ScriptBlock {
    if (-not (Test-CommandAvailable -CommandName 'node')) {
        throw "node is required but was not found on PATH."
    }

    & node (Join-Path $projectRoot "tests/hooks.test.js")
}

Invoke-Step -Name "Node.js tests (lint-agents)" -ScriptBlock {
    & node (Join-Path $projectRoot "tests/lint-agents.test.js")
}

Invoke-Step -Name "Node.js tests (inject-agents)" -ScriptBlock {
    & node (Join-Path $projectRoot "tests/inject-agents.test.js")
}

Invoke-Step -Name "Node.js tests (E2E)" -ScriptBlock {
    & node (Join-Path $projectRoot "tests/e2e-test.js")
}

Invoke-Step -Name "PowerShell tests (prompt analyzer)" -ScriptBlock {
    if (-not (Test-CommandAvailable -CommandName 'powershell')) {
        throw "Windows PowerShell (powershell.exe) is required to run legacy PowerShell tests on Windows."
    }

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tests/test-prompt-analyzer.ps1")
}

Invoke-Step -Name "PowerShell tests (command manager)" -ScriptBlock {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tests/test-command-manager.ps1")
}

Invoke-Step -Name "PowerShell tests (context manager)" -ScriptBlock {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tests/test-context-manager.ps1")
}

Invoke-Step -Name "PowerShell tests (E2E scenarios)" -ScriptBlock {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tests/test-e2e-scenarios.ps1")
}

Invoke-Step -Name "PowerShell E2E tests (vibe coding assistant)" -ScriptBlock {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tests/e2e/run-e2e-tests.ps1")
}

Write-Host ""
Write-Host "All tests passed." -ForegroundColor Green
