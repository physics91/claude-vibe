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
## 🔍 프롬프트 명확화 필요

입력하신 프롬프트가 다소 모호할 수 있습니다. 더 정확한 결과를 위해 아래 질문에 답변해 주세요:

"@

    # Add numbered questions
    for ($i = 0; $i -lt $questions.Count; $i++) {
        $clarificationMessage += "`n$($i + 1). $($questions[$i])"
    }

    # Add helpful tips
    $clarificationMessage += @"


### 💡 더 나은 프롬프트를 위한 팁:
- **구체적인 기술 스택** 명시 (예: React, Node.js, PostgreSQL)
- **파일 경로**나 **코드 위치** 언급
- **원하는 결과**를 명확하게 설명
- **제약사항**이나 **요구사항** 명시

---
*원래 프롬프트:* "$($AnalysisResult.OriginalPrompt)"
*모호도 점수:* $($AnalysisResult.AmbiguityScore)/100
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
        Title     = "프롬프트 명확화 설문"
        Questions = @()
    }

    # Generate survey questions based on analysis
    if ($AnalysisResult.Reasons -contains "MISSING_TECH_STACK") {
        $survey.Questions += @{
            Question = "사용하고 싶은 기술 스택이 있나요?"
            Type     = "multiple_choice"
            Options  = @(
                "React + Node.js + MongoDB",
                "Vue + Express + PostgreSQL",
                "Vanilla JS + Python + SQLite",
                "직접 입력"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "MISSING_DETAILS") {
        $survey.Questions += @{
            Question = "주요 기능을 선택해주세요 (여러 개 선택 가능)"
            Type     = "checkbox"
            Options  = @(
                "사용자 인증/로그인",
                "데이터 CRUD",
                "파일 업로드",
                "실시간 통신",
                "결제 시스템",
                "관리자 대시보드"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "VAGUE_OPTIMIZATION") {
        $survey.Questions += @{
            Question = "어떤 최적화를 원하시나요?"
            Type     = "multiple_choice"
            Options  = @(
                "실행 속도/성능 개선",
                "메모리 사용량 감소",
                "번들 크기 축소",
                "코드 가독성 향상",
                "모두"
            )
        }
    }

    if ($AnalysisResult.Reasons -contains "INSUFFICIENT_REQUIREMENTS") {
        $survey.Questions += @{
            Question = "프로젝트 규모는 어느 정도인가요?"
            Type     = "multiple_choice"
            Options  = @(
                "간단한 프로토타입/MVP",
                "중소 규모 프로젝트",
                "대규모 엔터프라이즈급",
                "잘 모르겠음"
            )
        }
    }

    return $survey
}
