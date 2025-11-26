#Requires -Version 5.1
<#
.SYNOPSIS
    Skill Suggester module for zero-setup smart defaults.

.DESCRIPTION
    Automatically suggests appropriate skills based on project type,
    file patterns, and context changes. Part of A1. Zero-Setup Smart Defaults.

.NOTES
    Author: claude-vibe
    Version: 0.3.0
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Configuration

$script:SuggestionCooldownMinutes = 10
$script:LastSuggestionTime = @{}
$script:SuggestionStoragePath = Join-Path $env:USERPROFILE ".claude\claude-vibe\suggestions.json"

# Skill mappings by file extension
$script:ExtensionToSkill = @{
    ".py" = @("python-reviewer")
    ".ts" = @("code-reviewer", "test-generator")
    ".tsx" = @("code-reviewer", "nextjs-reviewer")
    ".js" = @("code-reviewer")
    ".jsx" = @("code-reviewer")
    ".go" = @("go-reviewer", "go-api-reviewer")
    ".rs" = @("rust-reviewer", "rust-api-reviewer")
    ".kt" = @("kotlin-android-reviewer", "kotlin-spring-reviewer")
    ".sql" = @("sql-optimizer", "schema-reviewer")
    ".dockerfile" = @("docker-reviewer")
    ".tf" = @("terraform-reviewer")
    ".yaml" = @("k8s-reviewer", "ci-cd-reviewer")
    ".yml" = @("k8s-reviewer", "ci-cd-reviewer")
}

# Skill mappings by directory pattern
$script:DirectoryToSkill = @{
    "tests" = @("test-generator", "coverage-analyzer")
    "test" = @("test-generator", "coverage-analyzer")
    "__tests__" = @("test-generator")
    "spec" = @("test-generator")
    "k8s" = @("k8s-reviewer")
    "kubernetes" = @("k8s-reviewer")
    "terraform" = @("terraform-reviewer")
    "infra" = @("terraform-reviewer", "infra-security-reviewer")
    ".github" = @("ci-cd-reviewer")
    "migrations" = @("migration-checker", "schema-reviewer")
}

# Framework detection patterns
$script:FrameworkSkills = @{
    "fastapi" = @("fastapi-reviewer", "python-reviewer")
    "django" = @("django-reviewer", "python-reviewer")
    "flask" = @("flask-reviewer", "python-reviewer")
    "nextjs" = @("nextjs-reviewer", "code-reviewer")
    "react" = @("code-reviewer", "perf-analyzer")
    "gin" = @("go-api-reviewer", "go-reviewer")
    "echo" = @("go-api-reviewer", "go-reviewer")
    "actix" = @("rust-api-reviewer", "rust-reviewer")
    "axum" = @("rust-api-reviewer", "rust-reviewer")
    "spring" = @("kotlin-spring-reviewer")
    "prisma" = @("orm-reviewer", "schema-reviewer")
    "typeorm" = @("orm-reviewer")
    "sqlalchemy" = @("orm-reviewer", "python-reviewer")
}

#endregion

#region Storage Functions

<#
.SYNOPSIS
    Loads suggestion history.

.OUTPUTS
    Suggestion history hashtable.
#>
function Get-SuggestionHistory {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    if (-not (Test-Path $script:SuggestionStoragePath)) {
        return @{
            suggestions = @()
            dismissed = @()
            accepted = @()
        }
    }

    try {
        $content = Get-Content $script:SuggestionStoragePath -Raw | ConvertFrom-Json

        return @{
            suggestions = @($content.suggestions)
            dismissed = @($content.dismissed)
            accepted = @($content.accepted)
        }
    } catch {
        return @{
            suggestions = @()
            dismissed = @()
            accepted = @()
        }
    }
}

<#
.SYNOPSIS
    Saves suggestion history.

.PARAMETER History
    The history hashtable to save.
#>
function Save-SuggestionHistory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$History
    )

    $dir = Split-Path $script:SuggestionStoragePath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $History | ConvertTo-Json -Depth 10 | Set-Content $script:SuggestionStoragePath -Encoding UTF8
}

#endregion

#region Skill Detection

<#
.SYNOPSIS
    Detects skills based on file extension.

.PARAMETER FilePath
    The file path to analyze.

.OUTPUTS
    Array of suggested skill names.
#>
function Get-SkillsByExtension {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()

    if ($script:ExtensionToSkill.ContainsKey($ext)) {
        return @($script:ExtensionToSkill[$ext])
    }

    # Special case for Dockerfile
    $fileName = [System.IO.Path]::GetFileName($FilePath).ToLower()
    if ($fileName -eq "dockerfile" -or $fileName -like "dockerfile.*") {
        return @("docker-reviewer")
    }

    return @()
}

<#
.SYNOPSIS
    Detects skills based on directory.

.PARAMETER FilePath
    The file path to analyze.

.OUTPUTS
    Array of suggested skill names.
#>
function Get-SkillsByDirectory {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    $dirPath = [System.IO.Path]::GetDirectoryName($FilePath)

    if (-not $dirPath) {
        return @()
    }

    $dirParts = $dirPath.Replace('\', '/').Split('/')

    $skills = @()

    foreach ($part in $dirParts) {
        $partLower = $part.ToLower()
        if ($script:DirectoryToSkill.ContainsKey($partLower)) {
            $skills += $script:DirectoryToSkill[$partLower]
        }
    }

    return @($skills | Select-Object -Unique)
}

<#
.SYNOPSIS
    Detects skills based on file content.

.PARAMETER Content
    The file content to analyze.

.OUTPUTS
    Array of suggested skill names.
#>
function Get-SkillsByContent {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $skills = @()
    $contentLower = $Content.ToLower()

    # Check for framework imports/patterns
    foreach ($framework in $script:FrameworkSkills.Keys) {
        if ($contentLower -match "import.*$framework|from.*$framework|require.*$framework") {
            $skills += $script:FrameworkSkills[$framework]
        }
    }

    # Security-related content
    if ($contentLower -match "password|secret|api[_-]?key|token|auth|credential") {
        $skills += "security-scanner"
    }

    # Performance-related content
    if ($contentLower -match "async|await|promise|concurrent|parallel|cache|optimize") {
        $skills += "perf-analyzer"
    }

    return @($skills | Select-Object -Unique)
}

<#
.SYNOPSIS
    Gets skill suggestions for a given context.

.PARAMETER FilePath
    The file path being worked on.

.PARAMETER Content
    Optional file content.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Skill suggestion result.
#>
function Get-SkillSuggestion {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter()]
        [string]$FilePath = "",

        [Parameter()]
        [string]$Content = "",

        [Parameter()]
        [string]$ProjectRoot = ""
    )

    $allSkills = @()
    $sources = @()

    # Get skills from file extension
    if ($FilePath) {
        $extSkills = Get-SkillsByExtension -FilePath $FilePath
        if ($extSkills.Count -gt 0) {
            $allSkills += $extSkills
            $sources += "file extension"
        }

        $dirSkills = Get-SkillsByDirectory -FilePath $FilePath
        if ($dirSkills.Count -gt 0) {
            $allSkills += $dirSkills
            $sources += "directory pattern"
        }
    }

    # Get skills from content
    if ($Content) {
        $contentSkills = Get-SkillsByContent -Content $Content
        if ($contentSkills.Count -gt 0) {
            $allSkills += $contentSkills
            $sources += "content analysis"
        }
    }

    # Remove duplicates and score
    $uniqueSkills = $allSkills | Group-Object | Sort-Object Count -Descending | ForEach-Object {
        @{
            skill = $_.Name
            score = $_.Count
        }
    }

    return @{
        skills = @($uniqueSkills)
        primary = if ($uniqueSkills.Count -gt 0) { $uniqueSkills[0].skill } else { "" }
        sources = @($sources | Select-Object -Unique)
        timestamp = [datetime]::UtcNow.ToString('o')
    }
}

#endregion

#region Context Change Detection

<#
.SYNOPSIS
    Detects if context has shifted to a different area.

.PARAMETER PreviousPath
    The previous file path.

.PARAMETER CurrentPath
    The current file path.

.OUTPUTS
    Context shift info or null.
#>
function Test-ContextShift {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PreviousPath,

        [Parameter(Mandatory = $true)]
        [string]$CurrentPath
    )

    if (-not $PreviousPath -or -not $CurrentPath) {
        return $null
    }

    $prevDir = [System.IO.Path]::GetDirectoryName($PreviousPath)
    $currDir = [System.IO.Path]::GetDirectoryName($CurrentPath)

    if (-not $prevDir -or -not $currDir) {
        return $null
    }

    $prevParts = $prevDir.Replace('\', '/').Split('/')
    $currParts = $currDir.Replace('\', '/').Split('/')

    # Check for significant directory changes
    $significantDirs = @("src", "tests", "test", "lib", "api", "components", "pages", "utils", "models", "services")

    $prevSignificant = $prevParts | Where-Object { $significantDirs -contains $_.ToLower() } | Select-Object -Last 1
    $currSignificant = $currParts | Where-Object { $significantDirs -contains $_.ToLower() } | Select-Object -Last 1

    if ($prevSignificant -and $currSignificant -and $prevSignificant -ne $currSignificant) {
        return @{
            from = $prevSignificant
            to = $currSignificant
            type = "directory_shift"
            message = "Context shifted from $prevSignificant to $currSignificant"
        }
    }

    # Check for extension changes
    $prevExt = [System.IO.Path]::GetExtension($PreviousPath).ToLower()
    $currExt = [System.IO.Path]::GetExtension($CurrentPath).ToLower()

    if ($prevExt -ne $currExt) {
        $prevSkills = Get-SkillsByExtension -FilePath $PreviousPath
        $currSkills = Get-SkillsByExtension -FilePath $CurrentPath

        if ($prevSkills.Count -gt 0 -and $currSkills.Count -gt 0 -and
            ($prevSkills | Where-Object { $currSkills -contains $_ }).Count -eq 0) {
            return @{
                from = $prevExt
                to = $currExt
                type = "language_shift"
                message = "Switched from $prevExt to $currExt files"
            }
        }
    }

    return $null
}

#endregion

#region Suggestion Rate Limiting

<#
.SYNOPSIS
    Checks if a suggestion should be suppressed due to rate limiting.

.PARAMETER SuggestionType
    Type of suggestion.

.OUTPUTS
    Boolean indicating if suggestion should be suppressed.
#>
function Test-SuggestionRateLimit {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SuggestionType
    )

    if ($script:LastSuggestionTime.ContainsKey($SuggestionType)) {
        $lastTime = $script:LastSuggestionTime[$SuggestionType]
        $elapsed = ([datetime]::UtcNow - $lastTime).TotalMinutes

        if ($elapsed -lt $script:SuggestionCooldownMinutes) {
            return $true
        }
    }

    return $false
}

<#
.SYNOPSIS
    Records that a suggestion was shown.

.PARAMETER SuggestionType
    Type of suggestion.
#>
function Add-SuggestionShown {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SuggestionType
    )

    $script:LastSuggestionTime[$SuggestionType] = [datetime]::UtcNow

    # Also persist to history
    $history = Get-SuggestionHistory

    $history.suggestions += @{
        type = $SuggestionType
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    # Keep only recent
    if ($history.suggestions.Count -gt 100) {
        $history.suggestions = $history.suggestions | Select-Object -Last 100
    }

    Save-SuggestionHistory -History $history
}

<#
.SYNOPSIS
    Records user response to a suggestion.

.PARAMETER SuggestionType
    Type of suggestion.

.PARAMETER Accepted
    Whether the suggestion was accepted.
#>
function Add-SuggestionResponse {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SuggestionType,

        [Parameter(Mandatory = $true)]
        [bool]$Accepted
    )

    $history = Get-SuggestionHistory

    $entry = @{
        type = $SuggestionType
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    if ($Accepted) {
        $history.accepted += $entry
    } else {
        $history.dismissed += $entry
    }

    Save-SuggestionHistory -History $history
}

#endregion

#region First Interaction Detection

<#
.SYNOPSIS
    Checks if this is the first interaction for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Boolean indicating if this is first interaction.
#>
function Test-FirstInteraction {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    # Check if profile exists
    $profilePath = Join-Path $ProjectRoot ".claude\project-profile.json"

    return -not (Test-Path $profilePath)
}

<#
.SYNOPSIS
    Generates a first-interaction suggestion.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Detection
    Project detection result.

.OUTPUTS
    Formatted suggestion string.
#>
function Get-FirstInteractionSuggestion {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Detection
    )

    $result = [System.Text.StringBuilder]::new()

    [void]$result.AppendLine("")
    [void]$result.AppendLine("<!-- VIBE ZERO-SETUP SUGGESTION -->")
    [void]$result.AppendLine("")
    [void]$result.AppendLine("**Welcome to claude-vibe!**")
    [void]$result.AppendLine("")

    $projectType = $Detection.detectedType
    $preset = $Detection.recommendedPreset
    $confidence = [math]::Round($Detection.confidence * 100)

    [void]$result.AppendLine("Detected: **$projectType** project ($confidence% confidence)")
    [void]$result.AppendLine("Recommended preset: **$preset**")
    [void]$result.AppendLine("")
    [void]$result.AppendLine("Quick setup: ``/cs $preset`` or ``/context-setup``")
    [void]$result.AppendLine("")

    return $result.ToString()
}

#endregion

#region Export

Export-ModuleMember -Function @(
    'Get-SkillsByExtension',
    'Get-SkillsByDirectory',
    'Get-SkillsByContent',
    'Get-SkillSuggestion',
    'Test-ContextShift',
    'Test-SuggestionRateLimit',
    'Add-SuggestionShown',
    'Add-SuggestionResponse',
    'Test-FirstInteraction',
    'Get-FirstInteractionSuggestion'
)

#endregion
