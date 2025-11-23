# Test script for Prompt Analyzer

$ErrorActionPreference = 'Stop'

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
        Name          = "너무 짧은 프롬프트"
        Prompt        = "이거 고쳐줘"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "명확한 프롬프트"
        Prompt        = "src/utils/validation.ts 파일의 emailValidator 함수에서 정규식을 RFC 5322 표준에 맞게 수정해주세요"
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "대명사 과다 사용"
        Prompt        = "이거를 저거처럼 고쳐서 그거에 넣어줘"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "프로젝트 타입만 언급"
        Prompt        = "웹사이트 만들어줘"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "기술 스택 포함한 상세 요청"
        Prompt        = "React와 TypeScript를 사용해서 사용자 인증 기능이 있는 Todo 앱을 만들어주세요. PostgreSQL과 Prisma를 백엔드로 사용합니다"
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "모호한 최적화 요청"
        Prompt        = "코드 최적화해줘"
        ShouldBeAmbiguous = $true
    },
    @{
        Name          = "구체적인 최적화 요청"
        Prompt        = "src/components/DataTable.tsx의 렌더링 성능을 개선해주세요. 현재 10,000개 행을 렌더링할 때 3초가 걸립니다"
        ShouldBeAmbiguous = $false
    },
    @{
        Name          = "데이터베이스 언급 (기술 스택 없음)"
        Prompt        = "데이터베이스 연결해줘"
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
        Write-Host "  ✓ PASSED" -ForegroundColor Green
        $passed++
    }
    else {
        Write-Host "  ✗ FAILED" -ForegroundColor Red
        Write-Host "    Expected: Ambiguous=$($test.ShouldBeAmbiguous)" -ForegroundColor Red
        Write-Host "    Got: Ambiguous=$($result.IsAmbiguous), Score=$($result.AmbiguityScore)" -ForegroundColor Red
        $failed++
    }

    Write-Host "  Score: $($result.AmbiguityScore)"
    if ($result.Reasons.Count -gt 0) {
        Write-Host "  Reasons: $($result.Reasons -join ', ')"
    }
    if ($result.Questions.Count -gt 0) {
        Write-Host "  Questions:"
        foreach ($q in $result.Questions) {
            Write-Host "    - $q"
        }
    }
    Write-Host ""
}

# Test clarification generation
Write-Host "=== Testing Clarification Generation ===" -ForegroundColor Cyan
Write-Host ""

$ambiguousPrompt = "웹사이트 만들어줘"
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
    Write-Host "`n✓ All tests passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "`n✗ Some tests failed" -ForegroundColor Red
    exit 1
}
