#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Prompt Analyzer Module for detecting ambiguity in user prompts.

.DESCRIPTION
    Analyzes user prompts to detect various types of ambiguity and generates
    appropriate clarification questions to improve prompt quality.

.NOTES
    Author: claude-vibe
    Version: 2.0.0
#>

#region Module Dependencies
. (Join-Path $PSScriptRoot "..\utils\require-modules.ps1") -ModuleName 'prompt-analyzer'
#endregion

#region Configuration Constants

# Ambiguity score weights
$script:SCORE_TOO_SHORT = 30
$script:SCORE_VAGUE_VERB = 15
$script:SCORE_EXCESSIVE_PRONOUNS = 20
$script:SCORE_MISSING_DETAILS = 25
$script:SCORE_MISSING_CODE_CONTEXT = 20
$script:SCORE_VAGUE_OPTIMIZATION = 15
$script:SCORE_INSUFFICIENT_REQUIREMENTS = 20
$script:SCORE_MISSING_TECH_STACK = 15

# Thresholds
$script:MIN_WORD_COUNT = Get-ConstantValue -Name 'MIN_WORD_COUNT_SHORT' -Default 5
$script:MinWordCountWithProject = Get-ConstantValue -Name 'MIN_WORD_COUNT_WITH_PROJECT' -Default 15
$script:MIN_WORD_COUNT_CREATE = Get-ConstantValue -Name 'MIN_WORD_COUNT_CODING' -Default 10
$script:MAX_PRONOUN_COUNT = 2

# Detection patterns
$script:VAGUE_VERBS = @('fix', 'change', 'improve', 'optimize', 'handle', 'update', 'modify')
$script:PRONOUNS = @('this', 'that', 'it', 'these', 'those')
$script:PROJECT_TYPES = @('website', 'app', 'application', 'system', 'tool', 'service', 'program')
$script:CODING_KEYWORDS = @('code', 'function', 'class', 'method', 'module', 'component')
$script:FILE_EXTENSIONS_PATTERN = '\.js|\.py|\.java|\.ts|\.ps1|\.md|/|\\'
$script:OPTIMIZATION_ASPECTS = 'performance|speed|memory|size|readability'
$script:TECH_STACK_PATTERN = 'mysql|postgres|mongodb|sqlite|redis|rest|graphql'

#endregion

#region Private Helper Functions

<#
.SYNOPSIS
    Counts occurrences of patterns in text.

.PARAMETER Text
    The text to search in.

.PARAMETER Patterns
    Array of patterns to search for.

.OUTPUTS
    Total count of all pattern matches.
#>
function Get-PatternMatchCount {
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [array]$Patterns
    )

    $count = 0
    foreach ($pattern in $Patterns) {
        $count += ([regex]::Matches($Text, $pattern, 'IgnoreCase')).Count
    }
    return $count
}

<#
.SYNOPSIS
    Checks if any pattern matches the text.

.PARAMETER Text
    The text to search in.

.PARAMETER Patterns
    Array of patterns to search for.

.OUTPUTS
    $true if any pattern matches, $false otherwise.
#>
function Test-PatternMatch {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [array]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Text -match $pattern) {
            return $true
        }
    }
    return $false
}

<#
.SYNOPSIS
    Finds the first matching pattern in text.

.PARAMETER Text
    The text to search in.

.PARAMETER Patterns
    Array of patterns to search for.

.OUTPUTS
    The matching pattern or $null.
#>
function Get-FirstMatchingPattern {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [array]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Text -match $pattern) {
            return $pattern
        }
    }
    return $null
}

#endregion

#region Public Functions

<#
.SYNOPSIS
    Analyzes a user prompt for ambiguity.

.DESCRIPTION
    Examines the prompt for various ambiguity indicators including:
    - Too short prompts
    - Vague verbs
    - Excessive pronouns
    - Missing project details
    - Missing code context
    - Vague optimization requests
    - Insufficient requirements
    - Missing technology stack

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

    $ambiguityScore = 0
    $ambiguityReasons = @()
    $questions = @()

    # Get word count
    $wordCount = ($Prompt -split '\s+').Count

    # 1. Check prompt length (too short)
    if ($wordCount -lt $script:MIN_WORD_COUNT) {
        $ambiguityScore += $script:SCORE_TOO_SHORT
        $ambiguityReasons += "TOO_SHORT"
        $questions += "What specific task would you like to accomplish?"
    }

    # 2. Check for vague verbs
    $matchedVerb = Get-FirstMatchingPattern -Text $Prompt -Patterns $script:VAGUE_VERBS
    if ($null -ne $matchedVerb -and $matchedVerb -ne '') {
        $ambiguityScore += $script:SCORE_VAGUE_VERB
        $ambiguityReasons += "VAGUE_VERB"
        $verbForQuestion = $matchedVerb
        $questions += "Which specific aspect do you want to ${verbForQuestion}? (e.g., performance, readability, structure)"
    }

    # 3. Check for excessive pronouns
    $pronounCount = Get-PatternMatchCount -Text $Prompt -Patterns $script:PRONOUNS
    if ($pronounCount -ge $script:MAX_PRONOUN_COUNT) {
        $ambiguityScore += $script:SCORE_EXCESSIVE_PRONOUNS
        $ambiguityReasons += "EXCESSIVE_PRONOUNS"
        $questions += "Which specific file or code are you referring to?"
    }

    # 4. Check for project type without specifics
    $hasProjectType = Test-PatternMatch -Text $Prompt -Patterns $script:PROJECT_TYPES
    if ($hasProjectType -and $wordCount -lt $script:MinWordCountWithProject) {
        $ambiguityScore += $script:SCORE_MISSING_DETAILS
        $ambiguityReasons += "MISSING_DETAILS"
        $questions += "What are the main features needed?"
        $questions += "What technology stack would you like to use? (e.g., React, Vue, Node.js)"
    }

    # 5. Check for missing context in coding tasks
    $hasCodingKeyword = Test-PatternMatch -Text $Prompt -Patterns $script:CODING_KEYWORDS
    if ($hasCodingKeyword) {
        if (-not ($Prompt -match $script:FILE_EXTENSIONS_PATTERN)) {
            $ambiguityScore += $script:SCORE_MISSING_CODE_CONTEXT
            $ambiguityReasons += "MISSING_CODE_CONTEXT"
            $questions += "Which file's code are you referring to?"
        }
    }

    # 6. Check for optimization without specifying aspect
    if ($Prompt -match 'optimize') {
        if (-not ($Prompt -match $script:OPTIMIZATION_ASPECTS)) {
            $ambiguityScore += $script:SCORE_VAGUE_OPTIMIZATION
            $ambiguityReasons += "VAGUE_OPTIMIZATION"
            $questions += "Which aspect of optimization? (performance, memory, code size, readability)"
        }
    }

    # 7. Check for "make" or "create" without details
    if ($Prompt -match 'create|make|build') {
        if ($wordCount -lt $script:MIN_WORD_COUNT_CREATE) {
            $ambiguityScore += $script:SCORE_INSUFFICIENT_REQUIREMENTS
            $ambiguityReasons += "INSUFFICIENT_REQUIREMENTS"
            $questions += "What are the requirements or constraints?"
        }
    }

    # 8. Check for database/API without tech stack
    if ($Prompt -match 'database|db|api') {
        if (-not ($Prompt -match $script:TECH_STACK_PATTERN)) {
            $ambiguityScore += $script:SCORE_MISSING_TECH_STACK
            $ambiguityReasons += "MISSING_TECH_STACK"
            $questions += "Which database/API technology would you like to use?"
        }
    }

    # Determine if prompt is ambiguous (using threshold from constants)
    $threshold = Get-ConstantValue -Name 'AMBIGUITY_THRESHOLD' -Default 40
    $isAmbiguous = $ambiguityScore -ge $threshold

    return @{
        IsAmbiguous     = $isAmbiguous
        AmbiguityScore  = $ambiguityScore
        Reasons         = $ambiguityReasons
        Questions       = $questions | Select-Object -Unique
        OriginalPrompt  = $Prompt
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



