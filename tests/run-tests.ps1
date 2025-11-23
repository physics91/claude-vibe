#Requires -Version 5.1

<#
.SYNOPSIS
    Run all unit tests for the AGENTS Context Preserver plugin.
#>

[CmdletBinding()]
param()

Set-Location -Path $PSScriptRoot
Import-Module Pester -RequiredVersion 5.7.1 -ErrorAction SilentlyContinue

if (-not (Get-Module Pester)) {
    Import-Module Pester -MinimumVersion 5.0 -ErrorAction Stop
}

$config = New-PesterConfiguration
$config.Run.Path = '.\tests\unit'
$config.Output.Verbosity = 'Detailed'
$config.TestResult.Enabled = $true
$config.TestResult.OutputPath = '.\test-results.xml'

Invoke-Pester -Configuration $config
