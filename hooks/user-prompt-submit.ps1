# User Prompt Submit Hook
# Analyzes user prompts and requests clarification if ambiguous

param()

$ErrorActionPreference = 'Stop'

try {
    # Get plugin root directory
    $pluginRoot = $env:CLAUDE_PLUGIN_ROOT
    if (-not $pluginRoot) {
        Write-Error "CLAUDE_PLUGIN_ROOT not set"
        exit 1
    }

    # Get user prompt from environment variable
    $userPrompt = $env:CLAUDE_PROMPT
    if (-not $userPrompt) {
        # No prompt to analyze, exit silently
        exit 0
    }

    # Import analyzer module
    $analyzerPath = Join-Path $pluginRoot "lib\core\prompt-analyzer.ps1"
    if (-not (Test-Path $analyzerPath)) {
        Write-Error "Analyzer module not found: $analyzerPath"
        exit 1
    }
    . $analyzerPath

    # Import clarification generator module
    $generatorPath = Join-Path $pluginRoot "lib\core\clarification-generator.ps1"
    if (-not (Test-Path $generatorPath)) {
        Write-Error "Clarification generator module not found: $generatorPath"
        exit 1
    }
    . $generatorPath

    # Analyze the prompt
    $analysis = Test-PromptAmbiguity -Prompt $userPrompt

    # If prompt is ambiguous, activate Prompt Clarifier Skill
    if ($analysis.IsAmbiguous) {
        # Prepare context for the Prompt Clarifier Skill
        $skillActivation = @"

<!-- VIBE CODING ASSISTANT: PROMPT CLARIFICATION NEEDED -->

**[Activate Skill: prompt-clarifier]**

The user submitted an ambiguous prompt. Use the **prompt-clarifier** skill to ask targeted clarification questions using AskUserQuestion with interactive selections.

**Analysis Results:**
- Ambiguity Score: $($analysis.AmbiguityScore)/100
- Issues Detected: $($analysis.Reasons -join ", ")

**Suggested Question Topics:**
$($analysis.Questions | ForEach-Object { "- $_" } | Out-String)

**Instructions:**
1. Acknowledge the user's request briefly
2. Use AskUserQuestion to present interactive selections for:
$(if ($analysis.Reasons -contains "MISSING_TECH_STACK") { "   - Technology stack preferences`n" })
$(if ($analysis.Reasons -contains "MISSING_DETAILS") { "   - Main features needed`n" })
$(if ($analysis.Reasons -contains "VAGUE_OPTIMIZATION") { "   - Optimization aspect (performance, memory, size, readability)`n" })
$(if ($analysis.Reasons -contains "INSUFFICIENT_REQUIREMENTS") { "   - Project scope/size`n" })
$(if ($analysis.Reasons -contains "MISSING_CODE_CONTEXT") { "   - File path or code location`n" })
3. After receiving answers, proceed with the enhanced context

**Original Prompt:** "$userPrompt"

"@

        # Output to Claude as additional context
        Write-Output $skillActivation

        # Log to file for debugging (optional)
        $logDir = Join-Path $pluginRoot "logs"
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }

        $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        $logFile = Join-Path $logDir "prompt-clarification_$timestamp.log"

        $logContent = @"
Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Original Prompt: $userPrompt
Ambiguity Score: $($analysis.AmbiguityScore)
Reasons: $($analysis.Reasons -join ", ")
Questions Generated: $($analysis.Questions.Count)

Questions:
$($analysis.Questions | ForEach-Object { "- $_" } | Out-String)
"@

        $logContent | Out-File -FilePath $logFile -Encoding UTF8
    }
    # If not ambiguous, do nothing (let the prompt pass through)

    exit 0
}
catch {
    # Log error but don't fail the hook
    $logDir = Join-Path $pluginRoot "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    $errorLog = Join-Path $logDir "hook-error.log"
    $_ | Out-File -FilePath $errorLog -Append -Encoding UTF8

    # Exit successfully to not block the user
    exit 0
}
