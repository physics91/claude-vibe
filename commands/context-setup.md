---
description: 프로젝트 컨텍스트를 설정하고 최적화합니다 (MCP 서버, 에이전트 선택)
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
---

# Context Setup

프로젝트의 컨텍스트 설정을 대화형으로 구성합니다.

**[Activate Skill: context-manager]**

## 수행 작업

### 1. 프로젝트 분석
다음 파일들을 확인하여 프로젝트 타입을 감지합니다:
- `package.json` - dependencies 분석
- `requirements.txt` / `pyproject.toml` - Python 패키지 분석
- `go.mod` / `Cargo.toml` / `pom.xml` - 기타 언어 감지
- 디렉토리 구조 (src/pages, src/components 등)

### 2. 프리셋 추천
감지된 프로젝트 타입에 맞는 프리셋을 추천합니다:
- **web-dev**: React, Vue, Next.js 등 웹 프론트엔드
- **api-dev**: Express, FastAPI 등 백엔드 API
- **data-science**: Pandas, TensorFlow 등 데이터/ML
- **minimal**: 최소 설정 (최대 토큰 절약)

### 3. 대화형 선택
AskUserQuestion을 사용하여:
1. 프리셋 선택 또는 Custom 선택
2. Custom 선택 시 MCP 서버 개별 선택
3. Custom 선택 시 에이전트 카테고리 선택

### 4. 설정 파일 생성
- `.claude/context-profile.json`: 프로젝트 설정
- `.claude/.mcp.json`: MCP 서버 설정

### 5. 재시작 안내
MCP 설정 적용을 위해 Claude Code 재시작 안내

## 출력 예시

```
프로젝트를 분석 중입니다...

감지된 프로젝트: React + TypeScript (Next.js)
추천 프리셋: Web Development
예상 토큰 절약: ~28,000 tokens (14%)

[프리셋 선택 질문]

---

설정이 완료되었습니다!

활성화된 MCP 서버:
- github, playwright, brave-search

활성화된 에이전트:
- react-expert, vue-expert, css-expert, nodejs-expert, frontend-optimizer

생성된 파일:
- .claude/context-profile.json
- .claude/.mcp.json

MCP 설정을 적용하려면 Claude Code를 재시작해주세요.
```
