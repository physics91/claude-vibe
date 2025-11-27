#Requires -Version 5.1
<#
.SYNOPSIS
    Error handling module for Claude-Vibe plugin.

.DESCRIPTION
    Provides standardized error codes, user-friendly messages, and solution suggestions.
    Supports both Korean and English messages based on system locale or explicit setting.

.NOTES
    Author: Claude-Vibe
    Version: 1.0.0
#>

#region Error Code Definitions

<#
Error Code Ranges:
    CVIBE-1xx: Parsing errors
    CVIBE-2xx: Cache errors
    CVIBE-3xx: Storage errors
    CVIBE-4xx: Configuration errors
    CVIBE-5xx: Hook execution errors
    CVIBE-6xx: Skill/Command errors
    CVIBE-9xx: General/Unknown errors
#>

$script:ErrorDefinitions = @{
    # Parsing Errors (1xx)
    'CVIBE-101' = @{
        en = @{
            message = "AGENTS.md parsing failed"
            cause = "Invalid markdown format or structure"
            solution = "Check that headers use '## Section Name' format and content is valid markdown"
        }
        ko = @{
            message = "AGENTS.md 파싱 실패"
            cause = "잘못된 마크다운 형식 또는 구조"
            solution = "'## 섹션명' 형식의 헤더와 올바른 마크다운 구문을 확인하세요"
        }
    }
    'CVIBE-102' = @{
        en = @{
            message = "AGENTS.md file not found"
            cause = "The specified AGENTS.md file does not exist"
            solution = "Create AGENTS.md in your project root or run '/init-agents' command"
        }
        ko = @{
            message = "AGENTS.md 파일을 찾을 수 없음"
            cause = "지정된 AGENTS.md 파일이 존재하지 않습니다"
            solution = "프로젝트 루트에 AGENTS.md를 생성하거나 '/init-agents' 명령을 실행하세요"
        }
    }
    'CVIBE-103' = @{
        en = @{
            message = "AGENTS.md content too large"
            cause = "File exceeds maximum size limit"
            solution = "Reduce content size or split into multiple local AGENTS.md files"
        }
        ko = @{
            message = "AGENTS.md 내용이 너무 큼"
            cause = "파일이 최대 크기 제한을 초과했습니다"
            solution = "내용을 줄이거나 여러 개의 로컬 AGENTS.md 파일로 분리하세요"
        }
    }
    'CVIBE-104' = @{
        en = @{
            message = "Invalid section structure"
            cause = "Section headers or hierarchy is malformed"
            solution = "Ensure proper header hierarchy (# > ## > ###) without skipping levels"
        }
        ko = @{
            message = "잘못된 섹션 구조"
            cause = "섹션 헤더 또는 계층 구조가 올바르지 않습니다"
            solution = "헤더 계층(# > ## > ###)이 레벨을 건너뛰지 않도록 확인하세요"
        }
    }

    # Cache Errors (2xx)
    'CVIBE-201' = @{
        en = @{
            message = "Cache directory creation failed"
            cause = "Unable to create cache directory"
            solution = "Check write permissions for ~/.claude/claude-vibe/cache/"
        }
        ko = @{
            message = "캐시 디렉토리 생성 실패"
            cause = "캐시 디렉토리를 생성할 수 없습니다"
            solution = "~/.claude/claude-vibe/cache/ 디렉토리의 쓰기 권한을 확인하세요"
        }
    }
    'CVIBE-202' = @{
        en = @{
            message = "Cache read failed"
            cause = "Unable to read cache file"
            solution = "Cache will be rebuilt automatically. If persistent, delete cache file manually"
        }
        ko = @{
            message = "캐시 읽기 실패"
            cause = "캐시 파일을 읽을 수 없습니다"
            solution = "캐시가 자동으로 재구축됩니다. 계속 발생하면 캐시 파일을 수동으로 삭제하세요"
        }
    }
    'CVIBE-203' = @{
        en = @{
            message = "Cache write failed"
            cause = "Unable to write cache file"
            solution = "Check disk space and write permissions. Plugin will continue without caching"
        }
        ko = @{
            message = "캐시 쓰기 실패"
            cause = "캐시 파일을 쓸 수 없습니다"
            solution = "디스크 공간과 쓰기 권한을 확인하세요. 캐싱 없이 플러그인이 계속 실행됩니다"
        }
    }
    'CVIBE-204' = @{
        en = @{
            message = "Cache cleanup failed"
            cause = "Unable to remove expired cache entries"
            solution = "Non-critical error. Clear cache manually if needed: ~/.claude/claude-vibe/cache/"
        }
        ko = @{
            message = "캐시 정리 실패"
            cause = "만료된 캐시 항목을 제거할 수 없습니다"
            solution = "심각하지 않은 오류입니다. 필요시 수동으로 캐시를 삭제하세요: ~/.claude/claude-vibe/cache/"
        }
    }
    'CVIBE-205' = @{
        en = @{
            message = "Cache retrieval failed"
            cause = "Error while checking cache validity"
            solution = "Cache will be bypassed. Data will be loaded from files directly"
        }
        ko = @{
            message = "캐시 검색 실패"
            cause = "캐시 유효성 확인 중 오류 발생"
            solution = "캐시를 건너뛰고 파일에서 직접 데이터를 로드합니다"
        }
    }
    'CVIBE-206' = @{
        en = @{
            message = "Cache storage failed"
            cause = "Unable to store data in cache"
            solution = "Non-critical error. Plugin continues normally without caching this data"
        }
        ko = @{
            message = "캐시 저장 실패"
            cause = "캐시에 데이터를 저장할 수 없습니다"
            solution = "심각하지 않은 오류입니다. 이 데이터의 캐싱 없이 플러그인이 계속 실행됩니다"
        }
    }
    'CVIBE-207' = @{
        en = @{
            message = "Cache clear failed"
            cause = "Unable to clear cache entries"
            solution = "Delete cache directory manually: ~/.claude/claude-vibe/cache/"
        }
        ko = @{
            message = "캐시 삭제 실패"
            cause = "캐시 항목을 삭제할 수 없습니다"
            solution = "캐시 디렉토리를 수동으로 삭제하세요: ~/.claude/claude-vibe/cache/"
        }
    }
    'CVIBE-208' = @{
        en = @{
            message = "Hash collection failed"
            cause = "Unable to compute file hashes for cache validation"
            solution = "Non-critical error. Cache validation will be skipped"
        }
        ko = @{
            message = "해시 수집 실패"
            cause = "캐시 유효성 검사용 파일 해시를 계산할 수 없습니다"
            solution = "심각하지 않은 오류입니다. 캐시 유효성 검사를 건너뜁니다"
        }
    }

    # Storage Errors (3xx)
    'CVIBE-301' = @{
        en = @{
            message = "Context storage failed"
            cause = "Unable to save context to disk"
            solution = "Check write permissions for ~/.claude/claude-vibe/ directory"
        }
        ko = @{
            message = "컨텍스트 저장 실패"
            cause = "컨텍스트를 디스크에 저장할 수 없습니다"
            solution = "~/.claude/claude-vibe/ 디렉토리의 쓰기 권한을 확인하세요"
        }
    }
    'CVIBE-302' = @{
        en = @{
            message = "Context load failed"
            cause = "Unable to read saved context"
            solution = "Context will be rebuilt. Previous session data may be lost"
        }
        ko = @{
            message = "컨텍스트 로드 실패"
            cause = "저장된 컨텍스트를 읽을 수 없습니다"
            solution = "컨텍스트가 재구축됩니다. 이전 세션 데이터가 손실될 수 있습니다"
        }
    }
    'CVIBE-303' = @{
        en = @{
            message = "Log file write failed"
            cause = "Unable to write to log file"
            solution = "Check write permissions for logs/ directory. Plugin continues without logging"
        }
        ko = @{
            message = "로그 파일 쓰기 실패"
            cause = "로그 파일에 쓸 수 없습니다"
            solution = "logs/ 디렉토리의 쓰기 권한을 확인하세요. 로깅 없이 플러그인이 계속 실행됩니다"
        }
    }

    # Configuration Errors (4xx)
    'CVIBE-401' = @{
        en = @{
            message = "Invalid plugin configuration"
            cause = "plugin.json contains invalid settings"
            solution = "Verify plugin.json syntax and required fields. See documentation for schema"
        }
        ko = @{
            message = "잘못된 플러그인 설정"
            cause = "plugin.json에 잘못된 설정이 포함되어 있습니다"
            solution = "plugin.json 구문과 필수 필드를 확인하세요. 스키마는 문서를 참조하세요"
        }
    }
    'CVIBE-402' = @{
        en = @{
            message = "Preset not found"
            cause = "Specified preset does not exist"
            solution = "Check available presets with 'claude-vibe:list-presets' or use a valid preset name"
        }
        ko = @{
            message = "프리셋을 찾을 수 없음"
            cause = "지정된 프리셋이 존재하지 않습니다"
            solution = "'claude-vibe:list-presets'로 사용 가능한 프리셋을 확인하거나 올바른 프리셋명을 사용하세요"
        }
    }
    'CVIBE-403' = @{
        en = @{
            message = "Invalid hooks configuration"
            cause = "hooks.json contains invalid hook definitions"
            solution = "Ensure hooks.json has correct 'hooks' wrapper and valid event names"
        }
        ko = @{
            message = "잘못된 훅 설정"
            cause = "hooks.json에 잘못된 훅 정의가 포함되어 있습니다"
            solution = "hooks.json에 올바른 'hooks' 래퍼와 유효한 이벤트 이름이 있는지 확인하세요"
        }
    }

    # Hook Execution Errors (5xx)
    'CVIBE-501' = @{
        en = @{
            message = "Hook execution failed"
            cause = "Error occurred during hook script execution"
            solution = "Check hook script for errors. Plugin gracefully degrades to continue operation"
        }
        ko = @{
            message = "훅 실행 실패"
            cause = "훅 스크립트 실행 중 오류가 발생했습니다"
            solution = "훅 스크립트의 오류를 확인하세요. 플러그인은 정상 작동을 위해 우아하게 저하됩니다"
        }
    }
    'CVIBE-502' = @{
        en = @{
            message = "Hook timeout"
            cause = "Hook script exceeded execution time limit"
            solution = "Optimize hook script or increase timeout. Long operations should be async"
        }
        ko = @{
            message = "훅 시간 초과"
            cause = "훅 스크립트가 실행 시간 제한을 초과했습니다"
            solution = "훅 스크립트를 최적화하거나 타임아웃을 늘리세요. 긴 작업은 비동기로 처리해야 합니다"
        }
    }
    'CVIBE-503' = @{
        en = @{
            message = "Required module not found"
            cause = "A required PowerShell module could not be loaded"
            solution = "Ensure all lib/ modules are present. Reinstall plugin if necessary"
        }
        ko = @{
            message = "필수 모듈을 찾을 수 없음"
            cause = "필수 PowerShell 모듈을 로드할 수 없습니다"
            solution = "모든 lib/ 모듈이 있는지 확인하세요. 필요시 플러그인을 재설치하세요"
        }
    }

    # Skill/Command Errors (6xx)
    'CVIBE-601' = @{
        en = @{
            message = "Skill activation failed"
            cause = "Unable to activate the requested skill"
            solution = "Check skill definition in skills/ directory. Skill name may be invalid"
        }
        ko = @{
            message = "스킬 활성화 실패"
            cause = "요청한 스킬을 활성화할 수 없습니다"
            solution = "skills/ 디렉토리의 스킬 정의를 확인하세요. 스킬 이름이 잘못되었을 수 있습니다"
        }
    }
    'CVIBE-602' = @{
        en = @{
            message = "Command not found"
            cause = "Specified slash command does not exist"
            solution = "Check available commands in commands/ directory"
        }
        ko = @{
            message = "명령을 찾을 수 없음"
            cause = "지정된 슬래시 명령이 존재하지 않습니다"
            solution = "commands/ 디렉토리의 사용 가능한 명령을 확인하세요"
        }
    }

    # General Errors (9xx)
    'CVIBE-901' = @{
        en = @{
            message = "Unknown error occurred"
            cause = "An unexpected error occurred"
            solution = "Check logs for details. Report issue at github.com/anthropics/claude-code/issues"
        }
        ko = @{
            message = "알 수 없는 오류 발생"
            cause = "예상치 못한 오류가 발생했습니다"
            solution = "로그에서 자세한 내용을 확인하세요. github.com/anthropics/claude-code/issues에 이슈를 보고하세요"
        }
    }
    'CVIBE-902' = @{
        en = @{
            message = "Operation aborted"
            cause = "Operation was cancelled or interrupted"
            solution = "Retry the operation. If persistent, check system resources"
        }
        ko = @{
            message = "작업 중단됨"
            cause = "작업이 취소되었거나 중단되었습니다"
            solution = "작업을 다시 시도하세요. 계속 발생하면 시스템 리소스를 확인하세요"
        }
    }
}

#endregion

#region Language Detection

<#
.SYNOPSIS
    Gets the current language preference.

.DESCRIPTION
    Returns 'ko' for Korean or 'en' for English based on system locale
    or explicit setting.

.OUTPUTS
    System.String
    Returns 'ko' or 'en'.
#>
function Get-ErrorLanguage {
    [CmdletBinding()]
    [OutputType([string])]
    param()

    # Check environment variable override
    $envLang = $env:CVIBE_LANG
    if ($envLang -eq 'ko' -or $envLang -eq 'en') {
        return $envLang
    }

    # Check system culture
    try {
        $culture = [System.Globalization.CultureInfo]::CurrentUICulture
        if ($culture.Name -like 'ko*') {
            return 'ko'
        }
    } catch {
        # Ignore culture detection errors
    }

    return 'en'
}

#endregion

#region Error Formatting

<#
.SYNOPSIS
    Formats an error with code, message, cause, and solution.

.DESCRIPTION
    Creates a user-friendly error message with all relevant information.

.PARAMETER ErrorCode
    The error code (e.g., 'CVIBE-101').

.PARAMETER Details
    Optional additional details to append to the message.

.PARAMETER Language
    Language override ('ko' or 'en'). Uses system default if not specified.

.OUTPUTS
    System.String
    Returns formatted error message.

.EXAMPLE
    $errorMsg = Format-VibeError -ErrorCode 'CVIBE-101' -Details "Line 25"
#>
function Format-VibeError {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^CVIBE-\d{3}$')]
        [string]$ErrorCode,

        [Parameter()]
        [string]$Details,

        [Parameter()]
        [ValidateSet('ko', 'en')]
        [string]$Language
    )

    # Configuration
    $MaxDetailsLength = 200

    if (-not $Language) {
        try {
            $Language = Get-ErrorLanguage
        } catch {
            $Language = 'en'  # Graceful fallback
        }
    }

    # Defensive check: ensure ErrorDefinitions exists
    if (-not $script:ErrorDefinitions) {
        return "[$ErrorCode] Error occurred (error definitions not loaded)"
    }

    $definition = $script:ErrorDefinitions[$ErrorCode]

    # Fallback to generic error with defensive check
    if (-not $definition) {
        if ($script:ErrorDefinitions.ContainsKey('CVIBE-901')) {
            $definition = $script:ErrorDefinitions['CVIBE-901']
            $ErrorCode = 'CVIBE-901'
        } else {
            return "[$ErrorCode] Unknown error occurred"
        }
    }

    $localized = $definition[$Language]
    if (-not $localized) {
        $localized = $definition['en']
    }

    # Final fallback if localized data is missing
    if (-not $localized) {
        return "[$ErrorCode] Error occurred"
    }

    $result = [System.Text.StringBuilder]::new()

    # Format: [CVIBE-101] Message
    [void]$result.Append("[$ErrorCode] ")
    [void]$result.AppendLine($localized.message)

    # Add details if provided (with length limit to prevent info disclosure)
    if ($Details) {
        $cleanDetails = $Details -replace '\r?\n', ' '
        if ($cleanDetails.Length -gt $MaxDetailsLength) {
            $cleanDetails = $cleanDetails.Substring(0, $MaxDetailsLength - 3) + "..."
        }
        if ($Language -eq 'ko') {
            [void]$result.AppendLine("상세: $cleanDetails")
        } else {
            [void]$result.AppendLine("Details: $cleanDetails")
        }
    }

    # Add cause
    if ($Language -eq 'ko') {
        [void]$result.AppendLine("원인: $($localized.cause)")
    } else {
        [void]$result.AppendLine("Cause: $($localized.cause)")
    }

    # Add solution
    if ($Language -eq 'ko') {
        [void]$result.AppendLine("해결: $($localized.solution)")
    } else {
        [void]$result.AppendLine("Solution: $($localized.solution)")
    }

    return $result.ToString().TrimEnd()
}

<#
.SYNOPSIS
    Writes a formatted error to the warning stream.

.DESCRIPTION
    Logs a user-friendly error message using Write-Warning.

.PARAMETER ErrorCode
    The error code (e.g., 'CVIBE-101').

.PARAMETER Details
    Optional additional details.

.PARAMETER Language
    Language override.

.EXAMPLE
    Write-VibeError -ErrorCode 'CVIBE-101' -Details "Invalid header at line 25"
#>
function Write-VibeError {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^CVIBE-\d{3}$')]
        [string]$ErrorCode,

        [Parameter()]
        [string]$Details,

        [Parameter()]
        [ValidateSet('ko', 'en')]
        [string]$Language
    )

    $formatted = Format-VibeError -ErrorCode $ErrorCode -Details $Details -Language $Language
    Write-Warning $formatted
}

<#
.SYNOPSIS
    Gets the error message for a code without full formatting.

.DESCRIPTION
    Returns just the message portion of an error definition.

.PARAMETER ErrorCode
    The error code.

.PARAMETER Language
    Language override.

.OUTPUTS
    System.String
    Returns the error message only.

.EXAMPLE
    $msg = Get-VibeErrorMessage -ErrorCode 'CVIBE-101'
#>
function Get-VibeErrorMessage {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^CVIBE-\d{3}$')]
        [string]$ErrorCode,

        [Parameter()]
        [ValidateSet('ko', 'en')]
        [string]$Language
    )

    if (-not $Language) {
        try {
            $Language = Get-ErrorLanguage
        } catch {
            $Language = 'en'  # Graceful fallback
        }
    }

    $definition = $script:ErrorDefinitions[$ErrorCode]
    if (-not $definition) {
        return "Unknown error: $ErrorCode"
    }

    $localized = $definition[$Language]
    if (-not $localized) {
        $localized = $definition['en']
    }

    return "[$ErrorCode] $($localized.message)"
}

<#
.SYNOPSIS
    Lists all available error codes.

.DESCRIPTION
    Returns a list of all defined error codes with their messages.

.PARAMETER Language
    Language for messages.

.OUTPUTS
    Array of error code information.

.EXAMPLE
    Get-VibeErrorCodes | Format-Table
#>
function Get-VibeErrorCodes {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter()]
        [ValidateSet('ko', 'en')]
        [string]$Language
    )

    if (-not $Language) {
        try {
            $Language = Get-ErrorLanguage
        } catch {
            $Language = 'en'  # Graceful fallback
        }
    }

    $result = [System.Collections.ArrayList]::new()

    foreach ($code in $script:ErrorDefinitions.Keys | Sort-Object) {
        $def = $script:ErrorDefinitions[$code]
        $localized = $def[$Language]
        if (-not $localized) { $localized = $def['en'] }

        [void]$result.Add([PSCustomObject]@{
            Code = $code
            Message = $localized.message
            Category = switch -Regex ($code) {
                'CVIBE-1\d{2}' { 'Parsing' }
                'CVIBE-2\d{2}' { 'Cache' }
                'CVIBE-3\d{2}' { 'Storage' }
                'CVIBE-4\d{2}' { 'Configuration' }
                'CVIBE-5\d{2}' { 'Hook Execution' }
                'CVIBE-6\d{2}' { 'Skill/Command' }
                'CVIBE-9\d{2}' { 'General' }
                default { 'Unknown' }
            }
        })
    }

    return $result.ToArray()
}

#endregion

#region Export Functions

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Format-VibeError',
        'Write-VibeError',
        'Get-VibeErrorMessage',
        'Get-VibeErrorCodes',
        'Get-ErrorLanguage'
    )
}

#endregion
