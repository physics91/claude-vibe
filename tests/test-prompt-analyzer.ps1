# Test script for Prompt Analyzer

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Get the project root
$projectRoot = Split-Path -Parent $PSScriptRoot

# Import the analyzer module
. "$projectRoot\lib\core\prompt-analyzer.ps1"
. "$projectRoot\lib\core\clarification-generator.ps1"

Write-Host "=== Prompt Analyzer Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# Test cases
$testCases = @(
    @{
        Name          = "Too short prompt"
        Prompt        = "fix this"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "Clear prompt with file path + specific change"
        Prompt        = "In src/utils/validation.ts, update the emailValidator regex to match RFC 5322."
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "Pronoun-heavy vague instructions"
        Prompt        = "Make it work like that and put it there."
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "Only project type mentioned"
        Prompt        = "make a website"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "Detailed request with tech stack"
        Prompt        = "Create a Todo app using React and TypeScript with user authentication. Use PostgreSQL and Prisma for the backend."
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "Vague optimization request"
        Prompt        = "optimize the code"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "Specific optimization request"
        Prompt        = "Improve rendering performance in src/components/DataTable.tsx. Rendering 10,000 rows currently takes ~3 seconds."
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "Database mentioned (missing tech stack)"
        Prompt        = "Connect a database"
        ShouldBeAmbiguous = $true
    }
)

$passed = 0
$failed = 0

foreach ($test in $testCases) {
    Write-Host "Test: $($test.Name)" -ForegroundColor Yellow
    Write-Host "  Prompt: '$($test.Prompt)'"

    $result = Test-PromptAmbiguity -Prompt $test.Prompt

    $isCorrect = $result.IsAmbiguous -eq $test.ShouldBeAmbiguous

    if ($isCorrect) {
        Write-Host "  PASS" -ForegroundColor Green
        $passed++
    }
    else {
        Write-Host "  FAIL" -ForegroundColor Red
        Write-Host "    Expected: Ambiguous=$($test.ShouldBeAmbiguous)" -ForegroundColor Red
        Write-Host "    Got: Ambiguous=$($result.IsAmbiguous), Score=$($result.AmbiguityScore)" -ForegroundColor Red
        $failed++
    }
 
    Write-Host "  Score: $($result.AmbiguityScore)"

    $reasons = @($result.Reasons | Where-Object { $_ -and -not [string]::IsNullOrWhiteSpace($_) })
    if ($reasons.Count -gt 0) {
        Write-Host "  Reasons: $($reasons -join ', ')"
    }

    $questions = @($result.Questions | Where-Object { $_ -and -not [string]::IsNullOrWhiteSpace($_) })
    if ($questions.Count -gt 0) {
        Write-Host "  Questions:"
        foreach ($q in $questions) {
            Write-Host "    - $q"
        }
    }
    Write-Host ""
}

# Test clarification generation
Write-Host "=== Testing Clarification Generation ===" -ForegroundColor Cyan
Write-Host ""

$ambiguousPrompt = "make a website"
$analysis = Test-PromptAmbiguity -Prompt $ambiguousPrompt

if ($analysis.IsAmbiguous) {
    $clarification = New-ClarificationPrompt -AnalysisResult $analysis
    Write-Host "Generated Clarification:" -ForegroundColor Yellow
    Write-Host $clarification
    Write-Host ""

    $contextPrompt = Get-ContextEnhancedPrompt -OriginalPrompt $ambiguousPrompt -AnalysisResult $analysis
    Write-Host "Context for Claude:" -ForegroundColor Yellow
    Write-Host $contextPrompt
}

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Total: $($passed + $failed)"

if ($failed -eq 0) {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`nSome tests failed" -ForegroundColor Red
    exit 1
}
