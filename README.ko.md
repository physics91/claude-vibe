# Claude Vibe

AI 기반 개발 워크플로우를 향상시키는 종합 Claude Code 플러그인. 지능형 컨텍스트 관리와 바이브 코딩을 위한 프롬프트 최적화 기능을 제공합니다.

## 설치

### 방법 1: 플러그인 명령어 (권장)

```bash
# 마켓플레이스 추가
/plugin marketplace add physics91/claude-vibe

# 플러그인 설치
/plugin install claude-vibe@physics91
```

### 방법 2: 수동 설치

```powershell
# 1. 프로젝트 클론
git clone https://github.com/physics91/claude-vibe.git
cd claude-vibe

# 2. settings.json에 hooks 직접 등록
```

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/pre-compact.ps1\""]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/session-start.ps1\""]
      }
    ]
  }
}
```

## 업데이트

### 최신 버전으로 업데이트

**방법 1: 플러그인 명령어로 재설치 (권장)**

```bash
# 재설치하여 최신 버전으로 업데이트
/plugin install claude-vibe@physics91
```

**방법 2: 수동 업데이트**

```bash
# 플러그인 디렉토리로 이동
cd ~/.claude/plugins/claude-vibe

# 최신 변경사항 가져오기
git pull origin main
```

### 현재 버전 확인

`.claude-plugin/plugin.json`에서 설치된 버전 확인:

```bash
cat ~/.claude/plugins/claude-vibe/.claude-plugin/plugin.json | grep version
```

또는 [CHANGELOG.md](./CHANGELOG.md)에서 버전 히스토리와 릴리즈 노트를 확인하세요.

**참고:** Claude Code는 현재 자동 플러그인 업데이트를 지원하지 않습니다. 새 버전이 출시되면 수동으로 업데이트해야 합니다.

## 구조

```
├── .claude-plugin/
│   ├── plugin.json        # 플러그인 매니페스트
│   └── marketplace.json   # 마켓플레이스 정의
├── hooks/
│   ├── hooks.json              # 훅 설정
│   ├── pre-compact.ps1         # 컴팩션 전 컨텍스트 캡처
│   ├── session-start.ps1       # 세션 시작 시 컨텍스트 복원
│   └── user-prompt-submit.ps1  # 프롬프트 분석 및 스킬 활성화
├── skills/
│   └── prompt-clarifier/
│       └── SKILL.md            # 프롬프트 명확화 스킬
├── lib/
│   ├── core/
│   │   ├── parser.ps1                  # AGENTS.md 파싱
│   │   ├── storage.ps1                 # 상태 저장/로드
│   │   ├── prompt-analyzer.ps1         # 프롬프트 모호도 감지
│   │   └── clarification-generator.ps1 # 질문 생성
│   └── utils/
│       └── security.ps1        # 보안 유틸리티
├── schemas/                    # JSON 스키마
└── tests/
    ├── test-*.ps1              # 테스트 스크립트
    └── test-prompt-analyzer.ps1 # 프롬프트 분석기 테스트
```

## 주요 기능

### 컨텍스트 보존
- AGENTS.md 자동 파싱 (프로젝트/글로벌/로컬)
- 컴팩션 시 컨텍스트 자동 저장
- 세션 시작 시 컨텍스트 자동 복원
- 작업 상태 추적

### 바이브 코딩 어시스턴트 (신규!)
- **지능형 프롬프트 분석**: 모호하거나 불명확한 프롬프트를 자동 감지
- **인터랙티브 명확화**: AskUserQuestion으로 다중 선택 옵션 제공
- **스마트 질문 생성**: 감지된 문제를 기반으로 타겟팅된 질문 생성
- **원활한 스킬 통합**: prompt-clarifier 스킬 자동 활성화
- **상세 로깅**: 지속적인 개선을 위한 프롬프트 품질 지표 추적

바이브 코딩 어시스턴트는 다음을 통해 더 나은 프롬프트 작성을 돕습니다:
- 누락된 기술 세부사항 감지 (기술 스택, 파일 경로, 요구사항)
- 모호한 지시사항 식별 (불명확한 동사, 과도한 대명사 사용)
- 빠른 명확화를 위한 인터랙티브 선택지 제공
- 더 효과적인 바이브 코딩 관행으로 안내

**작동 방식:**
1. 프롬프트 제출 → Hook이 모호도 분석
2. 모호할 경우 → prompt-clarifier 스킬 활성화
3. Claude가 명확화 질문 → 옵션 선택
4. 전체 컨텍스트로 진행 → 더 나은 결과!

## 요구사항

- Windows PowerShell 5.1+ 또는 PowerShell Core 7+
- Claude Code v1.0.0+

## 사용 예제

### 바이브 코딩 어시스턴트

플러그인은 프롬프트를 제출할 때 자동으로 분석합니다. 다음은 몇 가지 예제입니다:

#### 예제 1: 모호한 프롬프트
```
사용자: "웹사이트 만들어줘"
```

**Claude의 응답 (플러그인 사용 시):**
```
좋습니다. 웹사이트 개발을 도와드리겠습니다.
더 정확한 결과를 위해 몇 가지 질문드리겠습니다.

[AskUserQuestion이 선택지와 함께 표시됨]

어떤 기술 스택을 사용하고 싶으신가요?
○ React + TypeScript + Node.js
○ Vue + JavaScript + Express
○ Vanilla JS + Python + FastAPI
○ 직접 입력할게요

[선택 후]

주요 기능을 선택해주세요 (여러 개 선택 가능):
□ 사용자 인증/로그인
□ 데이터베이스 CRUD
□ 파일 업로드
□ 실시간 통신 (WebSocket)
□ 결제 시스템
□ 관리자 대시보드

[선택 완료 후 Claude가 구현을 진행합니다]
```

#### 예제 2: 명확한 프롬프트
```
사용자: "React와 TypeScript를 사용해서 사용자 인증 기능이 있는 Todo 앱을 만들어주세요.
PostgreSQL과 Prisma를 백엔드로 사용합니다"
```

**결과:** 명확화 불필요 - Claude가 즉시 구현을 진행합니다.

### 테스트

#### 단위 테스트 - 프롬프트 분석기

단위 테스트 스위트를 실행하여 다양한 프롬프트가 어떻게 분석되는지 확인하세요:

```powershell
.\tests\test-prompt-analyzer.ps1
```

#### End-to-End 테스트

전체 워크플로우를 검증하는 e2e 테스트 스위트 실행:

```powershell
.\tests\e2e\run-e2e-tests.ps1
```

상세 출력을 원하면:

```powershell
.\tests\e2e\run-e2e-tests.ps1 -Verbose
```

**e2e 테스트 커버리지:**
- ✅ 모호한 프롬프트 감지 (7개 시나리오)
- ✅ 스킬 활성화 검증
- ✅ 예상되는 모호도 이유 검증
- ✅ 출력 구조 확인
- ✅ 로그 파일 생성 및 내용 확인
- ✅ 모듈 의존성 로딩

**출력 예시:**
```
================================
Vibe Coding Assistant E2E Tests
================================

Running 7 test scenarios...

Scenario: Ambiguous Prompt - Too Short
  Prompt: '이거 고쳐줘'
  ✓ Hook executes successfully
  ✓ Skill should be activated
  ✓ Expected ambiguity reasons detected
  ✓ Output contains required sections

Scenario: Clear Prompt - Specific with Tech Stack
  Prompt: 'React와 TypeScript를 사용해서...'
  ✓ Hook executes successfully
  ✓ Skill should NOT be activated
  ✓ Output is minimal (no clarification needed)

...

================================
Test Summary
================================
Total Tests: 25
Passed: 25
Failed: 0
Success Rate: 100%

✓ All tests passed!
```

### 로그 확인

프롬프트 분석 로그는 `logs/` 디렉토리에 저장됩니다:
- `prompt-clarification_*.log`: 모호한 프롬프트의 상세 분석
- `hook-error.log`: 훅 실행 중 발생한 오류

## 설정

### 모호도 임계값 조정

`lib/core/prompt-analyzer.ps1`을 편집하여 모호도 감지 임계값을 조정할 수 있습니다 (기본값: 40):

```powershell
# prompt-analyzer.ps1의 115번째 줄
$isAmbiguous = $ambiguityScore -ge 40  # 낮을수록 더 민감하게 감지
```

### 특정 검사 비활성화

`Test-PromptAmbiguity` 함수에서 원하지 않는 검사를 주석 처리하세요.

## 라이선스

MIT
