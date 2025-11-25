---
description: 현재 프로젝트의 컨텍스트 설정 상태를 표시합니다
allowed-tools: Read, Glob
---

# Context Status

현재 프로젝트의 컨텍스트 설정 상태를 확인합니다.

## 확인 사항

### 1. 프로젝트 프로필 확인
`.claude/context-profile.json` 파일을 읽어 현재 설정을 확인합니다.

### 2. MCP 설정 확인
`.claude/.mcp.json` 파일을 읽어 활성화된 MCP 서버를 확인합니다.

### 3. 전역 MCP 설정과 비교
`~/.claude/claude_code_config.json`과 비교하여 활성/비활성 상태를 표시합니다.

## 출력 형식

프로필이 있는 경우:
```
## 현재 컨텍스트 상태

**프로필**: [프로필 이름]
**프로젝트**: [프로젝트 경로]
**마지막 업데이트**: [날짜]

### MCP 서버 (N/M 활성)
[x] github - GitHub 연동
[x] playwright - 브라우저 자동화
[x] brave-search - 웹 검색
[ ] filesystem - 파일시스템 (비활성)
[ ] openrouter - AI 라우팅 (비활성)

### 활성화된 에이전트
react-expert, vue-expert, css-expert, nodejs-expert, frontend-optimizer

### 비활성화된 에이전트
ios-expert, android-expert, flutter-expert, ml-engineer, ...

### 토큰 절약
예상 절약량: ~28,000 tokens (14%)

---
설정 변경: /context-setup
```

프로필이 없는 경우:
```
## 컨텍스트 상태

이 프로젝트에는 컨텍스트 프로필이 설정되어 있지 않습니다.

**프로젝트 타입 감지 결과**: [감지된 타입]
**추천 프리셋**: [추천 프리셋]
**예상 토큰 절약**: ~[N] tokens

컨텍스트를 최적화하려면 `/context-setup`을 실행하세요.
```
