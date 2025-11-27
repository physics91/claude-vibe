# Cache Module API Reference

`lib/core/cache.ps1`

AGENTS.md 파싱 결과를 캐싱하여 성능을 향상시키는 모듈입니다.

## Configuration

기본 설정값:

| Setting | Default | Description |
|---------|---------|-------------|
| CacheDir | `~/.claude/claude-vibe/cache` | 캐시 디렉토리 |
| CacheFileName | `agents-md-cache.json` | 캐시 파일명 |
| DefaultTTLSeconds | 300 (5분) | 기본 TTL |
| MaxCacheEntries | 10 | 최대 캐시 항목 수 |
| CacheVersion | 1.0.0 | 캐시 스키마 버전 |

## Functions

### Get-AgentsMdCache

캐시에서 AGENTS.md 데이터를 검색합니다.

```powershell
Get-AgentsMdCache -ProjectRoot <string> -FileHashes <hashtable>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ProjectRoot | string | Yes | 프로젝트 루트 (캐시 키) |
| FileHashes | hashtable | Yes | 현재 파일 해시들 |

**FileHashes Structure:**
```powershell
@{
    global = "hash-string"
    project = "hash-string"
    local = @("hash1", "hash2")
}
```

**Returns:** `hashtable` or `$null`
- 캐시 히트: 병합된 AGENTS.md 설정
- 캐시 미스: `$null`

**Example:**
```powershell
$hashes = Get-FileHashesForCache -ProjectRoot $projectRoot
$cached = Get-AgentsMdCache -ProjectRoot $projectRoot -FileHashes $hashes

if ($null -ne $cached) {
    Write-Host "Cache hit!"
    $merged = $cached
}
```

---

### Set-AgentsMdCache

AGENTS.md 데이터를 캐시에 저장합니다.

```powershell
Set-AgentsMdCache -ProjectRoot <string> -Data <hashtable> -FileHashes <hashtable> [-TTLSeconds <int>]
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| ProjectRoot | string | Yes | - | 프로젝트 루트 |
| Data | hashtable | Yes | - | 캐시할 데이터 |
| FileHashes | hashtable | Yes | - | 파일 해시들 |
| TTLSeconds | int | No | 300 | 커스텀 TTL |

**Returns:** `bool` - 성공 여부

**Security (v0.4.1+):**
- 데이터는 저장 전 `Remove-SensitiveData`를 통해 자동 sanitization됨
- API 키, 토큰, 비밀번호 등이 자동으로 `[REDACTED]`로 치환됨

**Example:**
```powershell
$success = Set-AgentsMdCache `
    -ProjectRoot $projectRoot `
    -Data $mergedConfig `
    -FileHashes $hashes `
    -TTLSeconds 600  # 10분
```

---

### Clear-AgentsMdCache

캐시를 삭제합니다.

```powershell
Clear-AgentsMdCache [-ProjectRoot <string>]
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ProjectRoot | string | No | 특정 프로젝트만 삭제 (생략 시 전체 삭제) |

**Returns:** `bool` - 성공 여부

**Example:**
```powershell
# 특정 프로젝트 캐시 삭제
Clear-AgentsMdCache -ProjectRoot "C:\MyProject"

# 전체 캐시 삭제
Clear-AgentsMdCache
```

---

### Get-FileHashesForCache

캐시 검증용 파일 해시를 수집합니다.

```powershell
Get-FileHashesForCache -ProjectRoot <string> [-GlobalPath <string>] [-IncludeLocal <bool>] [-LocalMaxDepth <int>]
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| ProjectRoot | string | Yes | - | 프로젝트 루트 |
| GlobalPath | string | No | ~/.claude/AGENTS.md | 전역 파일 경로 |
| IncludeLocal | bool | No | $true | 로컬 파일 포함 |
| LocalMaxDepth | int | No | 3 | 탐색 깊이 |

**Returns:** `hashtable`
```powershell
@{
    global = "hash-or-empty"
    project = "hash-or-empty"
    local = @("hash1", "hash2")
}
```

**Example:**
```powershell
$hashes = Get-FileHashesForCache -ProjectRoot "C:\MyProject"
```

---

## Cache Invalidation

캐시는 다음 조건에서 무효화됩니다:

1. **TTL 만료**: 기본 5분 후 만료
2. **파일 해시 변경**: AGENTS.md 파일 내용이 변경됨
3. **캐시 버전 불일치**: 플러그인 업데이트 시
4. **수동 삭제**: `Clear-AgentsMdCache` 호출

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| CVIBE-201 | Cache directory creation failed | 쓰기 권한 확인 |
| CVIBE-202 | Cache read failed | 캐시 자동 재구축 |
| CVIBE-203 | Cache write failed | 디스크 공간 확인 |
| CVIBE-204 | Cache cleanup failed | 수동 삭제 |
| CVIBE-205 | Cache retrieval failed | 캐시 우회됨 |
| CVIBE-206 | Cache storage failed | 비심각 오류 |
| CVIBE-207 | Cache clear failed | 수동 삭제 |
| CVIBE-208 | Hash collection failed | 캐시 검증 건너뜀 |

## Usage Pattern

```powershell
# 캐싱을 활용한 AGENTS.md 로딩
function Get-MergedAgentsConfig {
    param([string]$ProjectRoot)

    # 1. 해시 수집
    $hashes = Get-FileHashesForCache -ProjectRoot $ProjectRoot

    # 2. 캐시 확인
    $cached = Get-AgentsMdCache -ProjectRoot $ProjectRoot -FileHashes $hashes
    if ($cached) {
        return $cached
    }

    # 3. 파일에서 로드
    $files = Get-AgentsMdFiles -ProjectRoot $ProjectRoot
    $merged = Merge-AgentsMdConfigs -Global $files.global?.parsed -Project $files.project?.parsed

    # 4. 캐시 저장
    $fileHashes = @{
        global = $files.global?.hash ?? ""
        project = $files.project?.hash ?? ""
        local = @($files.local | ForEach-Object { $_.hash })
    }
    Set-AgentsMdCache -ProjectRoot $ProjectRoot -Data $merged -FileHashes $fileHashes

    return $merged
}
```

## Atomic Writes (v0.4.1+)

캐시 파일은 원자적 쓰기 패턴을 사용하여 데이터 손상을 방지합니다:

```
1. 임시 파일에 쓰기 (cache.json.tmp.randomsuffix)
2. 임시 파일 무결성 검증
3. 원자적 이동 (Move-Item)으로 대상 파일 교체
4. 실패 시 임시 파일 정리
```

이를 통해 다음을 방지합니다:
- 쓰기 중단으로 인한 손상
- 동시 접근으로 인한 데이터 손실
- 부분 쓰기 상태

## Dependencies

- `lib/core/parser.ps1` - Get-AgentsMdHash 함수 사용
- `lib/utils/security.ps1` - Remove-SensitiveData 함수 사용 (v0.4.1+)
