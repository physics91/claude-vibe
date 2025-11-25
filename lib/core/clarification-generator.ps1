#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Clarification Generator Module for creating user-friendly clarification prompts.

.DESCRIPTION
    Generates clarification questions and surveys based on prompt analysis results
    to help users provide more specific requirements.

.NOTES
    Author: claude-vibe
    Version: 2.0.0
#>

#region Module Dependencies

$script:ModuleDependencies = @(
    @{ Name = 'constants'; Path = "$PSScriptRoot\constants.ps1" }
)

foreach ($dep in $script:ModuleDependencies) {
    if (-not (Test-Path -LiteralPath $dep.Path)) {
        throw "Required module not found: $($dep.Name) at $($dep.Path)"
    }
    try {
        . $dep.Path
    }
    catch {
        throw "Failed to load required module '$($dep.Name)': $($_.Exception.Message)"
    }
}

#endregion

#region Configuration

# Survey options for different ambiguity types
$script:TECH_STACK_OPTIONS = @(
    "React + Node.js + MongoDB",
    "Vue + Express + PostgreSQL",
    "Vanilla JS + Python + SQLite",
    "Custom input"
)

$script:FEATURE_OPTIONS = @(
    "User authentication/login",
    "Database CRUD",
    "File upload",
    "Real-time communication",
    "Payment system",
    "Admin dashboard"
)

$script:OPTIMIZATION_OPTIONS = @(
    "Execution speed/performance improvement",
    "Memory usage reduction",
    "Bundle size reduction",
    "Code readability improvement",
    "All of the above"
)

$script:PROJECT_SCALE_OPTIONS = @(
    "Simple prototype/MVP",
    "Small to medium project",
    "Large enterprise-grade",
    "Not sure"
)

#endregion

#region Public Functions

<#
.SYNOPSIS
    Creates a clarification prompt message from analysis results.

.DESCRIPTION
    Generates a user-friendly markdown message asking clarification questions
    based on the detected ambiguity in the user's prompt.

.PARAMETER AnalysisResult
    The hashtable result from Test-PromptAmbiguity function.

.OUTPUTS
    Formatted markdown string or $null if not ambiguous.
#>
function New-ClarificationPrompt {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$AnalysisResult
    )

    if (-not $AnalysisResult.IsAmbiguous) {
        return $null
    }

    $questions = $AnalysisResult.Questions
    if ($questions.Count -eq 0) {
        return $null
    }

    # Build clarification message
    $clarificationMessage = @"
## Prompt Clarification Needed

Your prompt may be somewhat ambiguous. Please answer the following questions for more accurate results:

"@

    # Add numbered questions
    for ($i = 0; $i -lt $questions.Count; $i++) {
        $clarificationMessage += "`n$($i + 1). $($questions[$i])"
    }

    # Add helpful tips
    $clarificationMessage += @"


### Tips for Better Prompts:
- Specify **concrete tech stack** (e.g., React, Node.js, PostgreSQL)
- Mention **file paths** or **code locations**
- Clearly explain **desired results**
- Specify **constraints** or **requirements**

---
*Original Prompt:* "$($AnalysisResult.OriginalPrompt)"
*Ambiguity Score:* $($AnalysisResult.AmbiguityScore)/100
"@

    return $clarificationMessage
}

<#
.SYNOPSIS
    Creates an enhanced prompt with context for AI assistants.

.DESCRIPTION
    Generates a context-rich prompt that instructs the AI to ask clarification
    questions before proceeding with the task.

.PARAMETER OriginalPrompt
    The user's original prompt.

.PARAMETER AnalysisResult
    The hashtable result from Test-PromptAmbiguity function.

.OUTPUTS
    Formatted context prompt string.
#>
function Get-ContextEnhancedPrompt {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$OriginalPrompt,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$AnalysisResult
    )

    $questionsFormatted = $AnalysisResult.Questions | ForEach-Object { "- $_" } | Out-String

    $contextPrompt = @"
**[Vibe Coding Assistant - Prompt Clarification Mode]**

The user submitted the following prompt:
"$OriginalPrompt"

This prompt has been analyzed and found to be potentially ambiguous (score: $($AnalysisResult.AmbiguityScore)/100).

**Detected Issues:**
$($AnalysisResult.Reasons -join ", ")

**Suggested Clarification Questions:**
$questionsFormatted

**Instructions:**
Please ask the user these clarification questions in a friendly, conversational manner before proceeding with the task.
Guide them to provide:
1. Specific technical requirements
2. Technology stack preferences
3. File paths or code locations (if applicable)
4. Any constraints or special requirements

After receiving their answers, proceed with the task using the enhanced context.
"@

    return $contextPrompt
}

<#
.SYNOPSIS
    Creates a survey structure for interactive clarification.

.DESCRIPTION
    Generates a structured survey with multiple choice and checkbox questions
    based on the detected ambiguity types.

.PARAMETER AnalysisResult
    The hashtable result from Test-PromptAmbiguity function.

.OUTPUTS
    Hashtable containing survey title and questions array.
#>
function Format-QuickSurvey {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$AnalysisResult
    )

    $survey = @{
        Title     = "Prompt Clarification Survey"
        Questions = @()
    }

    $reasons = $AnalysisResult.Reasons

    # Generate survey questions based on analysis
    if ($reasons -contains "MISSING_TECH_STACK") {
        $survey.Questions += @{
            Question = "What tech stack would you like to use?"
            Type     = "multiple_choice"
            Options  = $script:TECH_STACK_OPTIONS
        }
    }

    if ($reasons -contains "MISSING_DETAILS") {
        $survey.Questions += @{
            Question = "Select main features (multiple selection allowed)"
            Type     = "checkbox"
            Options  = $script:FEATURE_OPTIONS
        }
    }

    if ($reasons -contains "VAGUE_OPTIMIZATION") {
        $survey.Questions += @{
            Question = "What optimization would you like?"
            Type     = "multiple_choice"
            Options  = $script:OPTIMIZATION_OPTIONS
        }
    }

    if ($reasons -contains "INSUFFICIENT_REQUIREMENTS") {
        $survey.Questions += @{
            Question = "What is the project scale?"
            Type     = "multiple_choice"
            Options  = $script:PROJECT_SCALE_OPTIONS
        }
    }

    return $survey
}

#endregion

#region Module Export

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'New-ClarificationPrompt',
        'Get-ContextEnhancedPrompt',
        'Format-QuickSurvey'
    )
}

#endregion
