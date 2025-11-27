# Error Handler Module API Reference

`lib/utils/error-handler.ps1`

사용자 친화적 에러 메시지를 제공하는 모듈입니다. 한국어/영어 지원.

## Error Code Ranges

| Range | Category | Description |
|-------|----------|-------------|
| CVIBE-1xx | Parsing | AGENTS.md 파싱 관련 오류 |
| CVIBE-2xx | Cache | 캐시 관련 오류 |
| CVIBE-3xx | Storage | 저장소/파일 관련 오류 |
| CVIBE-4xx | Configuration | 설정 관련 오류 |
| CVIBE-5xx | Hook Execution | 훅 실행 관련 오류 |
| CVIBE-6xx | Skill/Command | 스킬/명령 관련 오류 |
| CVIBE-9xx | General | 일반/알 수 없는 오류 |

## Functions

### Format-VibeError

에러 코드를 사용자 친화적 메시지로 포맷합니다.

```powershell
Format-VibeError -ErrorCode <string> [-Details <string>] [-Language <string>]
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ErrorCode | string | Yes | 에러 코드 (예: 'CVIBE-101') |
| Details | string | No | 추가 세부 정보 |
| Language | string | No | 언어 ('ko' 또는 'en') |

**Returns:** `string` - 포맷된 에러 메시지

**Output Format:**
```
[CVIBE-101] AGENTS.md parsing failed
Details: Line 25 - invalid header
Cause: Invalid markdown format or structure
Solution: Check that headers use '## Section Name' format
```

**Example:**
```powershell
$errorMsg = Format-VibeError -ErrorCode 'CVIBE-101' -Details "Line 25"
Write-Warning $errorMsg
```

---

### Write-VibeError

에러를 Warning 스트림에 출력합니다.

```powershell
Write-VibeError -ErrorCode <string> [-Details <string>] [-Language <string>]
```

**Parameters:** `Format-VibeError`와 동일

**Example:**
```powershell
Write-VibeError -ErrorCode 'CVIBE-301' -Details "Permission denied"
```

---

### Get-VibeErrorMessage

에러 코드의 메시지 부분만 반환합니다.

```powershell
Get-VibeErrorMessage -ErrorCode <string> [-Language <string>]
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ErrorCode | string | Yes | 에러 코드 |
| Language | string | No | 언어 |

**Returns:** `string` - "[CVIBE-xxx] Message"

**Example:**
```powershell
$msg = Get-VibeErrorMessage -ErrorCode 'CVIBE-101'
# Returns: "[CVIBE-101] AGENTS.md parsing failed"
```

---

### Get-VibeErrorCodes

모든 정의된 에러 코드 목록을 반환합니다.

```powershell
Get-VibeErrorCodes [-Language <string>]
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Language | string | No | 메시지 언어 |

**Returns:** `array` of objects
```powershell
@(
    @{
        Code = "CVIBE-101"
        Message = "AGENTS.md parsing failed"
        Category = "Parsing"
    }
)
```

**Example:**
```powershell
Get-VibeErrorCodes -Language 'ko' | Format-Table Code, Message, Category
```

---

### Get-ErrorLanguage

현재 언어 설정을 반환합니다.

```powershell
Get-ErrorLanguage
```

**Returns:** `string` - 'ko' 또는 'en'

**Language Detection Order:**
1. `$env:CVIBE_LANG` 환경 변수
2. 시스템 UI 문화권 (Culture)
3. 기본값: 'en'

---

## Complete Error Code Reference

### Parsing Errors (1xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-101 | AGENTS.md parsing failed | AGENTS.md 파싱 실패 |
| CVIBE-102 | AGENTS.md file not found | AGENTS.md 파일을 찾을 수 없음 |
| CVIBE-103 | AGENTS.md content too large | AGENTS.md 내용이 너무 큼 |
| CVIBE-104 | Invalid section structure | 잘못된 섹션 구조 |

### Cache Errors (2xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-201 | Cache directory creation failed | 캐시 디렉토리 생성 실패 |
| CVIBE-202 | Cache read failed | 캐시 읽기 실패 |
| CVIBE-203 | Cache write failed | 캐시 쓰기 실패 |
| CVIBE-204 | Cache cleanup failed | 캐시 정리 실패 |
| CVIBE-205 | Cache retrieval failed | 캐시 검색 실패 |
| CVIBE-206 | Cache storage failed | 캐시 저장 실패 |
| CVIBE-207 | Cache clear failed | 캐시 삭제 실패 |
| CVIBE-208 | Hash collection failed | 해시 수집 실패 |

### Storage Errors (3xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-301 | Context storage failed | 컨텍스트 저장 실패 |
| CVIBE-302 | Context load failed | 컨텍스트 로드 실패 |
| CVIBE-303 | Log file write failed | 로그 파일 쓰기 실패 |

### Configuration Errors (4xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-401 | Invalid plugin configuration | 잘못된 플러그인 설정 |
| CVIBE-402 | Preset not found | 프리셋을 찾을 수 없음 |
| CVIBE-403 | Invalid hooks configuration | 잘못된 훅 설정 |

### Hook Execution Errors (5xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-501 | Hook execution failed | 훅 실행 실패 |
| CVIBE-502 | Hook timeout | 훅 시간 초과 |
| CVIBE-503 | Required module not found | 필수 모듈을 찾을 수 없음 |

### Skill/Command Errors (6xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-601 | Skill activation failed | 스킬 활성화 실패 |
| CVIBE-602 | Command not found | 명령을 찾을 수 없음 |

### General Errors (9xx)

| Code | EN Message | KO Message |
|------|------------|------------|
| CVIBE-901 | Unknown error occurred | 알 수 없는 오류 발생 |
| CVIBE-902 | Operation aborted | 작업 중단됨 |

---

## Usage Examples

### Basic Error Handling

```powershell
try {
    $result = Some-Operation -ErrorAction Stop
} catch {
    Write-VibeError -ErrorCode 'CVIBE-501' -Details $_.Exception.Message
    return $null  # Graceful degradation
}
```

### Language Override

```powershell
# Force Korean
$env:CVIBE_LANG = 'ko'

# Or per-call
Write-VibeError -ErrorCode 'CVIBE-101' -Language 'ko'
```

### Listing All Errors

```powershell
# Display all error codes in a table
Get-VibeErrorCodes | Format-Table -AutoSize

# Filter by category
Get-VibeErrorCodes | Where-Object { $_.Category -eq 'Cache' }
```

---

## Best Practices

1. **Always use error codes**: 직접 메시지를 쓰지 말고 에러 코드를 사용하세요
2. **Include details**: 디버깅에 도움되는 세부 정보를 포함하세요
3. **Graceful degradation**: 에러 후에도 플러그인이 계속 작동하도록 하세요
4. **Log and continue**: 심각하지 않은 오류는 경고만 하고 계속 진행하세요
