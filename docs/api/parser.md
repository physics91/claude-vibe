# Parser Module API Reference

`lib/core/parser.ps1`

AGENTS.md 파일을 파싱하고 구조화된 데이터로 변환하는 모듈입니다.

## Functions

### Get-AgentsMdHash

SHA256 해시를 계산합니다.

```powershell
Get-AgentsMdHash -Content <string>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Content | string | Yes | 해시를 계산할 콘텐츠 |

**Returns:** `string` - SHA256 해시 (소문자 16진수)

**Example:**
```powershell
$hash = Get-AgentsMdHash -Content $fileContent
# Returns: "a1b2c3d4e5f6..."
```

---

### Compress-AgentsMdContent

대용량 콘텐츠를 요약하여 압축합니다.

```powershell
Compress-AgentsMdContent -Content <string> [-MaxSizeKB <int>]
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| Content | string | Yes | - | 압축할 콘텐츠 |
| MaxSizeKB | int | No | 50 | 최대 크기 (KB) |

**Returns:** `string` - 압축된 콘텐츠 (절단 표시 포함)

**Example:**
```powershell
$compressed = Compress-AgentsMdContent -Content $largeContent -MaxSizeKB 30
```

---

### ConvertFrom-AgentsMd

마크다운 콘텐츠를 구조화된 데이터로 파싱합니다.

```powershell
ConvertFrom-AgentsMd -Content <string>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Content | string | Yes | 파싱할 마크다운 콘텐츠 |

**Returns:** `hashtable`
```powershell
@{
    sections = @(
        @{
            heading = "Section Name"
            level = 2
            content = "Section content..."
            directives = @("directive 1", "directive 2")
        }
    )
    subagents = @(
        @{
            name = "agent-name"
            description = "Agent description"
            trigger = "trigger phrase"
        }
    )
    key_instructions = @("IMPORTANT: ...", "MUST: ...")
}
```

**Example:**
```powershell
$parsed = ConvertFrom-AgentsMd -Content $markdownContent
$parsed.sections | ForEach-Object { Write-Host $_.heading }
```

---

### Read-AgentsMdFile

단일 AGENTS.md 파일을 읽고 파싱합니다.

```powershell
Read-AgentsMdFile -Path <string> [-MaxSizeKB <int>]
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| Path | string | Yes | - | 파일 경로 |
| MaxSizeKB | int | No | 50 | 최대 크기 (KB) |

**Returns:** `hashtable` or `$null`
```powershell
@{
    path = "C:\Project\AGENTS.md"
    content = "file content..."
    hash = "a1b2c3d4..."
    truncated = $false
    parsed = @{ sections = @(); subagents = @(); key_instructions = @() }
}
```

**Example:**
```powershell
$file = Read-AgentsMdFile -Path "C:\Project\AGENTS.md"
if ($file) {
    Write-Host "Hash: $($file.hash)"
    Write-Host "Sections: $($file.parsed.sections.Count)"
}
```

---

### Get-AgentsMdFiles

모든 AGENTS.md 파일을 탐색합니다.

```powershell
Get-AgentsMdFiles -ProjectRoot <string> [-GlobalPath <string>] [-IncludeLocal <bool>] [-LocalMaxDepth <int>]
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| ProjectRoot | string | Yes | - | 프로젝트 루트 디렉토리 |
| GlobalPath | string | No | ~/.claude/AGENTS.md | 전역 AGENTS.md 경로 |
| IncludeLocal | bool | No | $true | 로컬 파일 포함 여부 |
| LocalMaxDepth | int | No | 3 | 로컬 파일 탐색 깊이 |

**Returns:** `hashtable`
```powershell
@{
    global = @{ path = "..."; content = "..."; hash = "..."; parsed = @{} }
    project = @{ path = "..."; content = "..."; hash = "..."; parsed = @{} }
    local = @(
        @{ path = "..."; content = "..."; hash = "..."; parsed = @{} }
    )
}
```

**Example:**
```powershell
$files = Get-AgentsMdFiles -ProjectRoot "C:\MyProject"
if ($files.project) {
    Write-Host "Found project AGENTS.md"
}
```

---

### Merge-AgentsMdConfigs

여러 AGENTS.md 설정을 우선순위에 따라 병합합니다.

```powershell
Merge-AgentsMdConfigs [-Global <hashtable>] [-Project <hashtable>] [-Local <array>]
```

**Priority Order:** Local > Project > Global

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Global | hashtable | No | 전역 파싱 결과 |
| Project | hashtable | No | 프로젝트 파싱 결과 |
| Local | array | No | 로컬 파싱 결과 배열 |

**Returns:** `hashtable` (ConvertFrom-AgentsMd와 동일한 구조)

**Example:**
```powershell
$merged = Merge-AgentsMdConfigs `
    -Global $global.parsed `
    -Project $project.parsed `
    -Local @($local1.parsed, $local2.parsed)
```

---

## Error Handling

모든 함수는 오류 발생 시 예외를 throw합니다. 호출 시 try-catch를 사용하세요:

```powershell
try {
    $result = Read-AgentsMdFile -Path $path -ErrorAction Stop
} catch {
    Write-Warning "파싱 실패: $($_.Exception.Message)"
}
```

## Dependencies

- `lib/utils/security.ps1` - 보안 유틸리티
