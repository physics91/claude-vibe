# Prompt Analyzer Module
# Analyzes user prompts to detect ambiguity

function Test-PromptAmbiguity {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    $ambiguityScore = 0
    $ambiguityReasons = @()
    $questions = @()

    # 1. Check prompt length (너무 짧은 프롬프트)
    $wordCount = ($Prompt -split '\s+').Count
    if ($wordCount -lt 5) {
        $ambiguityScore += 30
        $ambiguityReasons += "TOO_SHORT"
        $questions += "구체적으로 어떤 작업을 원하시나요?"
    }

    # 2. Check for vague verbs
    $vagueVerbs = @('fix', 'change', 'improve', 'optimize', 'handle', 'update', 'modify')
    foreach ($verb in $vagueVerbs) {
        if ($Prompt -match $verb) {
            $ambiguityScore += 15
            if (-not $ambiguityReasons.Contains("VAGUE_VERB")) {
                $ambiguityReasons += "VAGUE_VERB"
                $questions += "Which specific aspect do you want to $verb? (e.g., performance, readability, structure)"
            }
            break
        }
    }

    # 3. Check for pronouns
    $pronouns = @('this', 'that', 'it', 'these', 'those')
    $pronounCount = 0
    foreach ($pronoun in $pronouns) {
        $pronounCount += ([regex]::Matches($Prompt, $pronoun, 'IgnoreCase')).Count
    }
    if ($pronounCount -ge 2) {
        $ambiguityScore += 20
        $ambiguityReasons += "EXCESSIVE_PRONOUNS"
        $questions += "Which specific file or code are you referring to?"
    }

    # 4. Check for project type without specifics
    $projectTypes = @('website', 'app', 'application', 'system', 'tool', 'service', 'program')
    $hasProjectType = $false
    foreach ($type in $projectTypes) {
        if ($Prompt -match $type) {
            $hasProjectType = $true
            break
        }
    }

    if ($hasProjectType -and $wordCount -lt 15) {
        $ambiguityScore += 25
        $ambiguityReasons += "MISSING_DETAILS"
        $questions += "What are the main features needed?"
        $questions += "What technology stack would you like to use? (e.g., React, Vue, Node.js)"
    }

    # 5. Check for missing context in coding tasks
    $codingKeywords = @('code', 'function', 'class', 'method', 'module', 'component')
    $hasCodingKeyword = $false
    foreach ($keyword in $codingKeywords) {
        if ($Prompt -match $keyword) {
            $hasCodingKeyword = $true
            break
        }
    }

    if ($hasCodingKeyword) {
        # Check for file path or specific code reference
        if (-not ($Prompt -match '\.js|\.py|\.java|\.ts|\.ps1|\.md|/|\\')) {
            $ambiguityScore += 20
            $ambiguityReasons += "MISSING_CODE_CONTEXT"
            $questions += "Which file's code are you referring to?"
        }
    }

    # 6. Check for optimization without specifying aspect
    if ($Prompt -match 'optimize') {
        if (-not ($Prompt -match 'performance|speed|memory|size|readability')) {
            $ambiguityScore += 15
            $ambiguityReasons += "VAGUE_OPTIMIZATION"
            $questions += "Which aspect of optimization? (performance, memory, code size, readability)"
        }
    }

    # 7. Check for "make" or "create" without details
    if ($Prompt -match 'create|make|build') {
        if ($wordCount -lt 10) {
            $ambiguityScore += 20
            $ambiguityReasons += "INSUFFICIENT_REQUIREMENTS"
            $questions += "What are the requirements or constraints?"
        }
    }

    # 8. Check for database/API without tech stack
    if ($Prompt -match 'database|db|api') {
        if (-not ($Prompt -match 'mysql|postgres|mongodb|sqlite|redis|rest|graphql')) {
            $ambiguityScore += 15
            $ambiguityReasons += "MISSING_TECH_STACK"
            $questions += "Which database/API technology would you like to use?"
        }
    }

    # Determine if prompt is ambiguous (threshold: 40)
    $isAmbiguous = $ambiguityScore -ge 40

    return @{
        IsAmbiguous     = $isAmbiguous
        AmbiguityScore  = $ambiguityScore
        Reasons         = $ambiguityReasons
        Questions       = $questions | Select-Object -Unique
        OriginalPrompt  = $Prompt
    }
}
