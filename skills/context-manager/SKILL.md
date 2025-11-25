---
name: context-manager
description: 대화형으로 MCP 서버, 에이전트, 슬래시 명령어를 선택하여 컨텍스트 윈도우를 최적화합니다
---

# Context Manager Skill

## Purpose
이 스킬은 Claude Code의 컨텍스트 윈도우를 최적화하기 위해 MCP 서버, Custom Agent, Slash Command를 프로젝트별로 대화형 선택하고 설정 파일을 생성합니다.

## When to Use
다음 상황에서 이 스킬을 활성화합니다:
1. 사용자가 "컨텍스트 설정", "컨텍스트 관리", "토큰 최적화"를 요청할 때
2. `/context-setup` 명령어가 실행될 때
3. 새 프로젝트에서 처음 작업을 시작할 때 (자동 감지 후 추천)

## Workflow

### Step 1: 프로젝트 분석
프로젝트 루트의 파일들을 분석하여 프로젝트 타입을 감지합니다.

분석 대상:
- `package.json` (Node.js/JavaScript 프로젝트)
- `requirements.txt`, `pyproject.toml` (Python 프로젝트)
- `go.mod` (Go 프로젝트)
- `Cargo.toml` (Rust 프로젝트)
- `pom.xml`, `build.gradle` (Java 프로젝트)

### Step 2: 프리셋 추천
감지된 프로젝트 타입에 맞는 프리셋을 추천합니다.

**AskUserQuestion 사용:**
```
AskUserQuestion: "프로젝트에 맞는 컨텍스트 프리셋을 선택해주세요"
Options:
- Web Development (추천) - React/Vue/Next.js용, ~28k 토큰 절약
- API Development - 백엔드/API 개발용, ~25k 토큰 절약
- Data Science - ML/AI/데이터 분석용, ~30k 토큰 절약
- Minimal - 최소 설정, ~45k 토큰 절약
- Custom - 직접 선택
```

### Step 3: 상세 설정 (Custom 선택 시)
사용자가 Custom을 선택하면 카테고리별로 선택합니다.

**MCP 서버 선택:**
```
AskUserQuestion: "활성화할 MCP 서버를 선택해주세요"
Options:
- GitHub (PR/이슈 관리) - ~8k tokens
- Playwright (브라우저 자동화) - ~12k tokens
- Brave Search (웹 검색) - ~3k tokens
- 모두 선택
multiSelect: true
```

**에이전트 카테고리 선택:**
```
AskUserQuestion: "어떤 분야의 에이전트가 필요하신가요?"
Options:
- Frontend (React, Vue, CSS 등)
- Backend (API, DB, Security 등)
- Mobile (iOS, Android, Flutter)
- DevOps (Docker, K8s, CI/CD)
- AI/ML (ML, DL, NLP 등)
multiSelect: true
```

### Step 4: 설정 파일 생성
선택에 따라 다음 파일들을 생성합니다:

1. **`.claude/context-profile.json`**: 프로젝트 컨텍스트 설정
2. **`.claude/.mcp.json`**: MCP 서버 설정 (선택된 서버만 포함)

### Step 5: 재시작 안내
MCP 설정은 세션 재시작 후 적용됩니다.

```
설정이 완료되었습니다!

생성된 파일:
- .claude/context-profile.json
- .claude/.mcp.json

활성화된 MCP 서버: github, playwright, brave-search
활성화된 에이전트: react-expert, css-expert, nodejs-expert
예상 토큰 절약: ~28,000 tokens (14%)

MCP 설정을 적용하려면 Claude Code를 재시작해주세요.
```

## Response Templates

### 프로젝트 분석 결과
```
프로젝트를 분석했습니다.

**감지된 프로젝트 타입**: Web Development (React + TypeScript)
**신뢰도**: 85%
**추천 프리셋**: web-dev
**예상 토큰 절약**: ~28,000 tokens

[AskUserQuestion으로 프리셋 선택 제시]
```

### 설정 완료
```
컨텍스트 설정이 완료되었습니다!

**프로필**: Web Development
**프로젝트**: G:\ai-dev\my-project

### 활성화된 MCP 서버 (3/6)
- github
- playwright
- brave-search

### 활성화된 에이전트 (5/55)
- react-expert
- css-expert
- nodejs-expert
- frontend-optimizer
- ui-ux-designer

### 생성된 파일
- .claude/context-profile.json
- .claude/.mcp.json

### 예상 토큰 절약
~28,000 tokens (14% 절약)

MCP 설정을 적용하려면 Claude Code를 재시작해주세요.
변경하려면 `/context-setup`을 실행하세요.
```

### 현재 상태 표시 (/context-status)
```
## 현재 컨텍스트 상태

**프로필**: Web Development
**프로젝트**: G:\ai-dev\my-project

### MCP 서버 (3/6 활성)
[x] github
[x] playwright
[x] brave-search
[ ] filesystem (비활성)
[ ] openrouter (비활성)
[ ] context7 (비활성)

### 에이전트 (5/55 활성)
[x] react-expert, css-expert, nodejs-expert, frontend-optimizer, ui-ux-designer

### 예상 토큰 절약
~28,000 tokens
```

## Best Practices

1. **프로젝트 분석 먼저**: 무작정 질문하지 말고 프로젝트 파일을 먼저 분석
2. **추천 제공**: 분석 결과 기반으로 적절한 프리셋 추천
3. **간결한 선택지**: AskUserQuestion 옵션은 4개 이내로 유지
4. **토큰 절약량 표시**: 각 선택의 영향을 명확히 전달
5. **재시작 안내**: MCP 설정 변경 시 반드시 재시작 필요 안내

## Integration

이 스킬은 다음과 연동됩니다:
- `SessionStart` 훅: 프로젝트 프로필 존재 여부 확인 및 안내
- `/context-setup` 명령어: 이 스킬 활성화
- `/context-status` 명령어: 현재 상태 표시

## Available Presets

| 프리셋 | 설명 | MCP 서버 | 토큰 절약 |
|--------|------|----------|-----------|
| minimal | 최소 설정 | 없음 | ~45k |
| web-dev | 웹 프론트엔드 | github, playwright, brave-search | ~28k |
| api-dev | 백엔드 API | github, brave-search, context7 | ~25k |
| data-science | 데이터/ML | brave-search, context7, github | ~30k |

## Notes

- 프로젝트별 `.claude/.mcp.json`이 글로벌 설정보다 우선 적용됩니다
- 에이전트 활성화/비활성화는 시스템 프롬프트 지시로 처리됩니다
- 설정 파일은 git에 커밋하여 팀과 공유할 수 있습니다
