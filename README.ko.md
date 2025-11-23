# AGENTS Context Preserver

Claude Code hooks를 활용하여 세션 컴팩션 시 AGENTS.md 컨텍스트를 자동으로 보존/복원하는 플러그인.

## 설치

### 방법 1: 플러그인 명령어 (권장)

```bash
# 마켓플레이스 추가
/plugin marketplace add physics91/claude-vibe

# 플러그인 설치
/plugin install agents-context-preserver@physics91
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

## 구조

```
├── .claude-plugin/
│   ├── plugin.json        # 플러그인 매니페스트
│   └── marketplace.json   # 마켓플레이스 정의
├── hooks/
│   ├── hooks.json         # 훅 설정
│   ├── pre-compact.ps1    # 컴팩션 전 컨텍스트 캡처
│   └── session-start.ps1  # 세션 시작 시 컨텍스트 복원
├── lib/
│   ├── core/
│   │   ├── parser.ps1     # AGENTS.md 파싱
│   │   └── storage.ps1    # 상태 저장/로드
│   └── utils/
│       └── security.ps1   # 보안 유틸리티
├── schemas/               # JSON 스키마
└── tests/                 # 테스트
```

## 주요 기능

- AGENTS.md 자동 파싱 (프로젝트/글로벌/로컬)
- 컴팩션 시 컨텍스트 자동 저장
- 세션 시작 시 컨텍스트 자동 복원
- 작업 상태 추적

## 요구사항

- Windows PowerShell 5.1+ 또는 PowerShell Core 7+
- Claude Code v1.0.0+

## 라이선스

MIT
