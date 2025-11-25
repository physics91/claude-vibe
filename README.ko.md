# Claude Vibe

지능형 컨텍스트 관리와 프롬프트 최적화를 위한 Claude Code 플러그인.

## 설치

```bash
# 마켓플레이스 추가 & 설치
/plugin marketplace add physics91/claude-vibe
/plugin install claude-vibe@physics91
```

## 주요 기능

### 1. 컨텍스트 보존
세션 간 컨텍스트를 자동으로 저장하고 복원합니다.
- AGENTS.md 파싱 (프로젝트/글로벌/로컬)
- 컴팩션 시 컨텍스트 저장
- 세션 시작 시 컨텍스트 복원

### 2. 프롬프트 명확화
모호한 프롬프트를 감지하고 명확화 질문을 합니다.
- 누락된 기술 스택 감지
- 불명확한 지시사항 식별
- 인터랙티브 다중 선택

### 3. 컨텍스트 매니저 (신규)
MCP 서버, 에이전트, 커맨드를 프로젝트별로 제어하여 컨텍스트 윈도우를 최적화합니다.

```
/context-setup   # 대화형 설정
/context-status  # 현재 상태 확인
```

**프리셋:**
| 프리셋 | 설명 | 토큰 절약 |
|--------|------|----------|
| Minimal | 핵심 도구만 | ~45,000 |
| Web Dev | React/Vue/Next.js | ~28,000 |
| API Dev | 백엔드/마이크로서비스 | ~25,000 |
| Data Science | ML/AI 프로젝트 | ~30,000 |

**기능:**
- 프로젝트 타입 자동 감지 (package.json, requirements.txt 등)
- 프로젝트별 MCP 서버 제어 (`.claude/.mcp.json`)
- 관리형 슬래시 커맨드 (파일 기반 활성화/비활성화)
- 토큰 절약량 추정

## 구조

```
├── hooks/                  # 훅 스크립트
├── skills/                 # 스킬 (prompt-clarifier)
├── commands/               # 활성 슬래시 커맨드
├── managed-commands/       # 제어 가능한 커맨드
├── presets/                # 컨텍스트 프리셋
├── lib/core/               # 핵심 모듈
│   ├── parser.ps1
│   ├── storage.ps1
│   ├── prompt-analyzer.ps1
│   ├── preset-manager.ps1
│   ├── project-detector.ps1
│   ├── mcp-config-generator.ps1
│   └── command-manager.ps1
└── tests/                  # 테스트 스크립트
```

## 요구사항

- Claude Code v1.0.0+
- PowerShell 5.1+ (Windows) / Bash 4.0+ (Linux/macOS)
- Python 2.7+ 또는 3.x

## 테스트

```powershell
# 단위 테스트
.\tests\test-prompt-analyzer.ps1
.\tests\test-command-manager.ps1

# E2E 테스트
.\tests\test-e2e-scenarios.ps1
.\tests\e2e\run-e2e-tests.ps1
```

## 업데이트

```bash
/plugin install claude-vibe@physics91
```

## 라이선스

MIT
