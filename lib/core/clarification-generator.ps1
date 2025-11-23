# Clarification Generator Module
# Generates user-friendly clarification questions

function New-ClarificationPrompt {
    param (
        [Parameter(Mandatory = $true)]
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

function Get-ContextEnhancedPrompt {
    param (
        [Parameter(Mandatory = $true)]
        [string]$OriginalPrompt,

        [Parameter(Mandatory = $true)]
        [hashtable]$AnalysisResult
    )

    $contextPrompt = @"
**[Vibe Coding Assistant - Prompt Clarification Mode]**

The user submitted the following prompt:
"$OriginalPrompt"

This prompt has been analyzed and found to be potentially ambiguous (score: $($AnalysisResult.AmbiguityScore)/100).

**Detected Issues:**
$($AnalysisResult.Reasons -join ", ")

**Suggested Clarification Questions:**
$($AnalysisResult.Questions | ForEach-Object { "- $_" } | Out-String)

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

function Format-QuickSurvey {
    param (
        [Parameter(Mandatory = $true)]
        [hashtable]$AnalysisResult
    )

    $survey = @{
        Title     = "Prompt Clarification Survey"
        Questions = @()
    }

    # Generate survey questions based on analysis
    if ($AnalysisResult.Reasons -contains "MISSING_TECH_STACK") {
        $survey.Questions += @{
            Question = "What tech stack would you like to use?"
            Type     = "multiple_choice"
            Options  = @(
                "React + Node.js + MongoDB",
                "Vue + Express + PostgreSQL",
                "Vanilla JS + Python + SQLite",
                "Custom input"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "MISSING_DETAILS") {
        $survey.Questions += @{
            Question = "Select main features (multiple selection allowed)"
            Type     = "checkbox"
            Options  = @(
                "User authentication/login",
                "Database CRUD",
                "File upload",
                "Real-time communication",
                "Payment system",
                "Admin dashboard"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "VAGUE_OPTIMIZATION") {
        $survey.Questions += @{
            Question = "What optimization would you like?"
            Type     = "multiple_choice"
            Options  = @(
                "Execution speed/performance improvement",
                "Memory usage reduction",
                "Bundle size reduction",
                "Code readability improvement",
                "All of the above"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "INSUFFICIENT_REQUIREMENTS") {
        $survey.Questions += @{
            Question = "What is the project scale?"
            Type     = "multiple_choice"
            Options  = @(
                "Simple prototype/MVP",
                "Small to medium project",
                "Large enterprise-grade",
                "Not sure"
            )
        }
    }

    return $survey
}
