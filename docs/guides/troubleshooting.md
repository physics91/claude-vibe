# Claude-Vibe Troubleshooting Guide

이 가이드는 Claude-Vibe 플러그인 사용 중 발생할 수 있는 일반적인 문제와 해결 방법을 다룹니다.

## Quick Diagnostics

문제 발생 시 다음 명령을 실행하여 상태를 확인하세요:

```powershell
# 1. 모듈 로드 테스트
cd <your-project>
powershell -ExecutionPolicy Bypass -Command ". ./lib/core/parser.ps1; Write-Host 'OK'"

# 2. E2E 테스트 실행
./tests/e2e/run-e2e-tests.ps1

# 3. 로그 확인
Get-Content ./logs/*.log | Select-Object -Last 50
```

---

## Common Issues

### 1. AGENTS.md가 인식되지 않음

**증상:**
- 세션 시작 시 AGENTS.md 내용이 표시되지 않음
- `/init-agents` 명령 후에도 인식 안됨

**원인:**
1. 파일이 올바른 위치에 없음
2. 파일명 대소문자 불일치
3. 파싱 오류

**해결:**
```powershell
# 파일 위치 확인
Test-Path -LiteralPath "AGENTS.md"

# 파일명 확인 (대소문자 구분)
Get-ChildItem -Filter "*agents*" -File

# 수동 파싱 테스트
. ./lib/core/parser.ps1
$result = Read-AgentsMdFile -Path "AGENTS.md" -Verbose
$result | ConvertTo-Json -Depth 5
```

**체크리스트:**
- [ ] 파일명이 정확히 `AGENTS.md`인가? (대소문자 구분)
- [ ] 프로젝트 루트에 있는가?
- [ ] UTF-8 인코딩인가?
- [ ] 마크다운 구문이 올바른가?

---

### 2. 캐시 관련 문제

**증상:**
- AGENTS.md 수정 후 변경사항이 반영되지 않음
- `[CVIBE-2xx]` 오류 메시지

**해결:**
```powershell
# 캐시 삭제
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\claude-vibe\cache" -ErrorAction SilentlyContinue

# 또는 PowerShell에서
. ./lib/core/cache.ps1
Clear-AgentsMdCache
```

**캐시 위치:**
- Windows: `%USERPROFILE%\.claude\claude-vibe\cache\`
- Unix: `~/.claude/claude-vibe/cache/`

---

### 3. 훅이 실행되지 않음

**증상:**
- 프롬프트 분석이 작동하지 않음
- 세션 시작 시 컨텍스트가 주입되지 않음

**원인:**
1. 훅 설정 오류
2. PowerShell 실행 정책
3. 모듈 로드 실패

**해결:**

```powershell
# 훅 직접 테스트
$testInput = '{"session_id": "test", "cwd": "C:\\MyProject"}'
$testInput | powershell -ExecutionPolicy Bypass -File ./hooks/session-start.ps1

# 실행 정책 확인
Get-ExecutionPolicy -List

# 실행 정책 변경 (관리자 권한 필요)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**hooks.json 확인:**
```json
{
  "hooks": {
    "UserPromptSubmit": [...],
    "PreCompact": [...],
    "SessionStart": [...]
  }
}
```

---

### 4. 스킬이 활성화되지 않음

**증상:**
- `skill: "claude-vibe:prompt-clarifier"` 출력이 없음
- 모호한 프롬프트에도 질문이 표시되지 않음

**원인:**
1. 프롬프트 분석기 오류
2. 임계값 설정
3. 스킬 파일 누락

**해결:**

```powershell
# 프롬프트 분석 테스트
. ./lib/core/prompt-analyzer.ps1
$result = Test-PromptAmbiguity -Prompt "fix this" -Verbose
$result | ConvertTo-Json

# 스킬 파일 확인
Test-Path "./skills/prompt-clarifier/SKILL.md"
```

**임계값 조정 (필요시):**
```powershell
# lib/core/prompt-analyzer.ps1에서
$AMBIGUITY_THRESHOLD = 0.4  # 기본값, 낮출수록 더 많이 활성화
```

---

### 5. 인코딩 문제

**증상:**
- 한글이 깨져서 표시됨
- 특수문자 오류

**해결:**
```powershell
# PowerShell 인코딩 설정
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 파일 인코딩 확인
$content = Get-Content -Path "AGENTS.md" -Raw -Encoding UTF8
```

**AGENTS.md 저장 시:**
- 항상 UTF-8 (BOM 없음)으로 저장
- Windows 메모장은 UTF-8 with BOM으로 저장하므로 주의

---

### 6. 권한 오류

**증상:**
- `[CVIBE-201]` Cache directory creation failed
- `[CVIBE-301]` Context storage failed

**해결:**
```powershell
# 디렉토리 권한 확인
Get-Acl "$env:USERPROFILE\.claude"

# 수동 디렉토리 생성
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\claude-vibe\cache"

# 권한 수정 (관리자 권한)
icacls "$env:USERPROFILE\.claude" /grant "${env:USERNAME}:(OI)(CI)F"
```

---

## Debug Mode

상세한 디버그 정보를 얻으려면:

```powershell
# Verbose 모드로 실행
$VerbosePreference = 'Continue'

# 또는 개별 명령에 -Verbose 추가
$result = Format-AgentsMdSummary -ProjectRoot "." -Verbose
```

---

## Log Files

로그 파일 위치:
- 플러그인 로그: `./logs/`
- Claude Code 로그: `~/.claude/logs/`

로그 분석:
```powershell
# 최근 오류 찾기
Get-ChildItem ./logs/*.log | ForEach-Object {
    Select-String -Path $_.FullName -Pattern "ERROR|WARN|CVIBE-"
}

# 특정 에러 코드 검색
Select-String -Path ./logs/*.log -Pattern "CVIBE-\d{3}"
```

---

## Performance Issues

**증상:**
- 세션 시작이 느림
- 훅 실행 시간이 오래 걸림

**해결:**

1. **캐싱 확인:**
   ```powershell
   # 캐시가 작동하는지 확인
   . ./lib/core/cache.ps1
   $hashes = Get-FileHashesForCache -ProjectRoot "."
   $cached = Get-AgentsMdCache -ProjectRoot "." -FileHashes $hashes
   Write-Host "Cache hit: $($null -ne $cached)"
   ```

2. **AGENTS.md 크기 줄이기:**
   - 최대 권장 크기: 50KB
   - 불필요한 내용 제거
   - 로컬 AGENTS.md로 분리

3. **로컬 파일 탐색 줄이기:**
   - `node_modules`, `.git` 등은 자동 제외됨
   - `LocalMaxDepth` 줄이기 (기본값: 3)

---

## Reset Everything

모든 설정을 초기화하려면:

```powershell
# 1. 캐시 삭제
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\claude-vibe" -ErrorAction SilentlyContinue

# 2. 로그 삭제
Remove-Item -Recurse -Force "./logs" -ErrorAction SilentlyContinue

# 3. Claude Code 재시작
# (터미널에서 Claude Code 재실행)
```

---

## Getting Help

문제가 해결되지 않으면:

1. **이슈 보고:**
   - https://github.com/anthropics/claude-code/issues

2. **필요한 정보:**
   - 에러 메시지 전체
   - PowerShell 버전: `$PSVersionTable`
   - OS 버전
   - 로그 파일 (민감 정보 제거)

3. **재현 단계:**
   - 문제를 재현하는 최소한의 단계
   - 예상 동작과 실제 동작

---

## Error Code Quick Reference

| Code Range | Category | Quick Fix |
|------------|----------|-----------|
| CVIBE-1xx | Parsing | AGENTS.md 구문 확인 |
| CVIBE-2xx | Cache | 캐시 삭제 |
| CVIBE-3xx | Storage | 권한 확인 |
| CVIBE-4xx | Config | 설정 파일 확인 |
| CVIBE-5xx | Hook | 모듈 재설치 |
| CVIBE-6xx | Skill | 스킬 파일 확인 |
| CVIBE-9xx | General | 로그 확인 후 이슈 보고 |

자세한 에러 코드 설명: [Error Handler API](../api/error-handler.md)
