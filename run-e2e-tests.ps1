#Requires -Version 5.1

<#
.SYNOPSIS
    Run E2E tests for the AGENTS Context Preserver plugin.
#>

[CmdletBinding()]
param()

Set-Location -Path $PSScriptRoot
Import-Module Pester -MinimumVersion 5.0 -ErrorAction Stop

$config = New-PesterConfiguration
$config.Run.Path = '.\tests\e2e'
$config.Output.Verbosity = 'Detailed'
$config.TestResult.Enabled = $true
$config.TestResult.OutputPath = '.\e2e-test-results.xml'

Invoke-Pester -Configuration $config
