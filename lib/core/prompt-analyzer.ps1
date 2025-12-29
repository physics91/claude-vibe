#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Prompt Analyzer Module for detecting ambiguity in user prompts.

.DESCRIPTION
    Delegates prompt ambiguity analysis to the shared Node.js analyzer so all
    platforms use the same scoring rules and questions.

.NOTES
    Author: claude-vibe
    Version: 3.0.0
#>

#region Module Dependencies
. (Join-Path $PSScriptRoot "..\utils\require-modules.ps1") -ModuleName 'prompt-analyzer'
#endregion

#region Private Helper Functions

function Get-NodeCommand {
    [CmdletBinding()]
    [OutputType([string])]
    param()

    $nodeCmd = Get-Command -Name 'node' -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw "Node.js is required for prompt analysis but was not found on PATH."
    }

    return $nodeCmd.Source
}

function Invoke-PromptAnalyzerEngine {
    [CmdletBinding()]
    [OutputType([pscustomobject])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    $analyzerPath = Join-Path $PSScriptRoot 'prompt-analyzer.js'
    if (-not (Test-Path -LiteralPath $analyzerPath -PathType Leaf)) {
        throw "Shared analyzer not found: $analyzerPath"
    }

    $nodeCmd = Get-NodeCommand

    $analysisJson = $Prompt | & $nodeCmd $analyzerPath
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "Prompt analysis failed with exit code $exitCode."
    }

    if ($analysisJson -is [array]) {
        $analysisJson = $analysisJson -join "`n"
    }

    if ([string]::IsNullOrWhiteSpace($analysisJson)) {
        throw "Prompt analysis returned empty output."
    }

    return $analysisJson | ConvertFrom-Json -ErrorAction Stop
}

#endregion

#region Public Functions

<#
.SYNOPSIS
    Analyzes a user prompt for ambiguity.

.DESCRIPTION
    Returns a standardized ambiguity analysis based on shared rules.

.PARAMETER Prompt
    The user prompt to analyze.

.OUTPUTS
    Hashtable containing:
    - IsAmbiguous: Boolean indicating if prompt exceeds ambiguity threshold
    - AmbiguityScore: Numeric score (higher = more ambiguous)
    - Reasons: Array of detected ambiguity reasons
    - Questions: Array of clarification questions
    - OriginalPrompt: The original input prompt
#>
function Test-PromptAmbiguity {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Prompt
    )

    $analysis = Invoke-PromptAnalyzerEngine -Prompt $Prompt

    $reasons = @()
    if ($null -ne $analysis.reasons) {
        $reasons = @($analysis.reasons)
    }

    $questions = @()
    if ($null -ne $analysis.questions) {
        $questions = @($analysis.questions)
    }

    return @{
        IsAmbiguous    = [bool]$analysis.is_ambiguous
        AmbiguityScore = [int]$analysis.ambiguity_score
        Reasons        = $reasons
        Questions      = $questions
        OriginalPrompt = $analysis.original_prompt
    }
}

#endregion

#region Module Export

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Test-PromptAmbiguity'
    )
}

#endregion
