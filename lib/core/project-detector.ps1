#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Project type detection module for Context Manager feature.

.DESCRIPTION
    Analyzes project files and dependencies to detect project type
    and recommend appropriate context presets.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Module Dependencies
# Required modules: preset-manager.ps1

$script:ModuleDependencies = @(
    @{ Name = 'preset-manager'; Path = "$PSScriptRoot\preset-manager.ps1" }
)

foreach ($dep in $script:ModuleDependencies) {
    if (-not (Test-Path -LiteralPath $dep.Path)) {
        throw "Required module not found: $($dep.Name) at $($dep.Path)"
    }
    try {
        . $dep.Path
    }
    catch {
        throw "Failed to load required module '$($dep.Name)': $($_.Exception.Message)"
    }
}

#endregion

#region Detection Scoring Constants

# Score weights for detection confidence calculation
$script:FileDetectionScore = 10       # Score per matched file
$script:DependencyDetectionScore = 15 # Score per matched dependency
$script:PatternDetectionScore = 5     # Score per matched pattern

#endregion

#region Detection Cache

# Cache for project detection results (performance optimization)
$script:DetectionCache = @{}

# Cache TTL in seconds (5 minutes default)
$script:DetectionCacheTtlSeconds = 300

# Maximum cache entries (prevent memory bloat)
$script:MaxCacheEntries = 100

<#
.SYNOPSIS
    Gets a cache key for a project root.

.PARAMETER ProjectRoot
    The project root path.

.OUTPUTS
    Normalized cache key string.
#>
function Get-DetectionCacheKey {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    try {
        # Normalize path for consistent cache keys
        $resolved = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
        return $resolved.ToLowerInvariant().TrimEnd('\', '/')
    }
    catch {
        return $ProjectRoot.ToLowerInvariant().TrimEnd('\', '/')
    }
}

<#
.SYNOPSIS
    Gets a cached detection result if available and not expired.

.PARAMETER ProjectRoot
    The project root path.

.OUTPUTS
    Cached result or $null if not found/expired.
#>
function Get-CachedDetection {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $key = Get-DetectionCacheKey -ProjectRoot $ProjectRoot

    if (-not $script:DetectionCache.ContainsKey($key)) {
        return $null
    }

    $entry = $script:DetectionCache[$key]
    $age = (Get-Date) - $entry.timestamp

    if ($age.TotalSeconds -gt $script:DetectionCacheTtlSeconds) {
        # Expired - remove from cache
        $script:DetectionCache.Remove($key)
        Write-Verbose "Cache expired for: $ProjectRoot"
        return $null
    }

    Write-Verbose "Cache hit for: $ProjectRoot (age: $([int]$age.TotalSeconds)s)"
    return $entry.result
}

<#
.SYNOPSIS
    Stores a detection result in the cache.

.PARAMETER ProjectRoot
    The project root path.

.PARAMETER Result
    The detection result to cache.
#>
function Set-CachedDetection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Result
    )

    $key = Get-DetectionCacheKey -ProjectRoot $ProjectRoot

    # Enforce max cache size (LRU-like: remove oldest entries)
    if ($script:DetectionCache.Count -ge $script:MaxCacheEntries) {
        $oldest = $script:DetectionCache.GetEnumerator() |
            Sort-Object { $_.Value.timestamp } |
            Select-Object -First 1
        if ($oldest) {
            $script:DetectionCache.Remove($oldest.Key)
            Write-Verbose "Cache evicted oldest entry"
        }
    }

    $script:DetectionCache[$key] = @{
        result = $Result
        timestamp = Get-Date
    }
    Write-Verbose "Cached detection for: $ProjectRoot"
}

<#
.SYNOPSIS
    Clears the detection cache.

.PARAMETER ProjectRoot
    Optional. Clear only cache for specific project root.
    If not specified, clears entire cache.
#>
function Clear-DetectionCache {
    [CmdletBinding()]
    param(
        [Parameter()]
        [string]$ProjectRoot
    )

    if ($ProjectRoot) {
        $key = Get-DetectionCacheKey -ProjectRoot $ProjectRoot
        if ($script:DetectionCache.ContainsKey($key)) {
            $script:DetectionCache.Remove($key)
            Write-Verbose "Cleared cache for: $ProjectRoot"
        }
    }
    else {
        $count = $script:DetectionCache.Count
        $script:DetectionCache.Clear()
        Write-Verbose "Cleared entire cache ($count entries)"
    }
}

<#
.SYNOPSIS
    Gets cache statistics.

.OUTPUTS
    Hashtable with cache statistics.
#>
function Get-DetectionCacheStats {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    $now = Get-Date
    $validCount = 0
    $expiredCount = 0

    foreach ($entry in $script:DetectionCache.Values) {
        $age = $now - $entry.timestamp
        if ($age.TotalSeconds -le $script:DetectionCacheTtlSeconds) {
            $validCount++
        }
        else {
            $expiredCount++
        }
    }

    return @{
        totalEntries = $script:DetectionCache.Count
        validEntries = $validCount
        expiredEntries = $expiredCount
        maxEntries = $script:MaxCacheEntries
        ttlSeconds = $script:DetectionCacheTtlSeconds
    }
}

#endregion

#region Project Detection Functions

<#
.SYNOPSIS
    Detects the project type based on files and dependencies.

.PARAMETER ProjectRoot
    The root directory of the project to analyze.

.PARAMETER SkipCache
    If specified, bypasses the cache and performs fresh detection.

.OUTPUTS
    Hashtable with detected type, confidence, and recommended preset.
#>
function Detect-ProjectType {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [switch]$SkipCache
    )

    if (-not (Test-Path $ProjectRoot)) {
        return @{
            detectedType = "unknown"
            confidence = 0
            recommendedPreset = "minimal"
            details = @{
                error = "Project root not found"
            }
        }
    }

    # Check cache first (unless SkipCache is specified)
    if (-not $SkipCache) {
        $cachedResult = Get-CachedDetection -ProjectRoot $ProjectRoot
        if ($null -ne $cachedResult) {
            return $cachedResult
        }
    }

    # Get all presets with detection rules
    $presets = Get-AllPresets
    $scores = @{}

    foreach ($preset in $presets) {
        $config = $preset.config
        # Safely check if detection property exists (StrictMode compatible)
        $hasDetection = $false
        if ($config -is [hashtable]) {
            $hasDetection = $config.ContainsKey('detection') -and $null -ne $config.detection
        } elseif ($config.PSObject.Properties.Name -contains 'detection') {
            $hasDetection = $null -ne $config.detection
        }
        if (-not $hasDetection) {
            continue
        }

        $score = 0
        $maxScore = 0
        $matches = @{
            files = @()
            dependencies = @()
            patterns = @()
        }

        # Check files
        if ($config.detection.files) {
            $maxScore += $config.detection.files.Count * $script:FileDetectionScore
            foreach ($file in $config.detection.files) {
                $filePath = Join-Path $ProjectRoot $file
                # Support glob patterns
                if ($file -match '\*') {
                    $foundFiles = Get-ChildItem -Path $ProjectRoot -Filter $file -ErrorAction SilentlyContinue
                    if ($foundFiles) {
                        $score += $script:FileDetectionScore
                        $matches.files += $file
                    }
                }
                elseif (Test-Path $filePath) {
                    $score += $script:FileDetectionScore
                    $matches.files += $file
                }
            }
        }

        # Check dependencies
        if ($config.detection.dependencies) {
            $maxScore += $config.detection.dependencies.Count * $script:DependencyDetectionScore
            $projectDeps = Get-ProjectDependencies -ProjectRoot $ProjectRoot

            foreach ($dep in $config.detection.dependencies) {
                if ($projectDeps -contains $dep) {
                    $score += $script:DependencyDetectionScore
                    $matches.dependencies += $dep
                }
            }
        }

        # Check directory patterns
        if ($config.detection.patterns) {
            $maxScore += $config.detection.patterns.Count * $script:PatternDetectionScore
            foreach ($pattern in $config.detection.patterns) {
                $patternPath = Join-Path $ProjectRoot $pattern
                $basePath = $patternPath -replace '\*\*.*$', ''
                if (Test-Path $basePath) {
                    $score += $script:PatternDetectionScore
                    $matches.patterns += $pattern
                }
            }
        }

        # Calculate confidence
        $confidence = if ($maxScore -gt 0) { [math]::Round($score / $maxScore, 2) } else { 0 }

        $scores[$preset.name] = @{
            score = $score
            maxScore = $maxScore
            confidence = $confidence
            matches = $matches
        }
    }

    # Find best match
    $bestPreset = $null
    $bestScore = 0
    $bestConfidence = 0

    foreach ($name in $scores.Keys) {
        if ($scores[$name].score -gt $bestScore) {
            $bestScore = $scores[$name].score
            $bestConfidence = $scores[$name].confidence
            $bestPreset = $name
        }
    }

    # Build and cache result
    $result = $null
    if ($bestPreset -and $bestConfidence -ge 0.3) {
        $result = @{
            detectedType = $bestPreset
            confidence = $bestConfidence
            recommendedPreset = $bestPreset
            details = @{
                scores = $scores
                matches = $scores[$bestPreset].matches
            }
        }
    }
    else {
        $result = @{
            detectedType = "unknown"
            confidence = 0
            recommendedPreset = "minimal"
            details = @{
                scores = $scores
                message = "No strong match found"
            }
        }
    }

    # Cache the result for future calls
    Set-CachedDetection -ProjectRoot $ProjectRoot -Result $result
    return $result
}

<#
.SYNOPSIS
    Gets project dependencies from various package managers.

.PARAMETER ProjectRoot
    The root directory of the project.

.OUTPUTS
    Array of dependency names.
#>
function Get-ProjectDependencies {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $dependencies = @()

    # Check package.json (Node.js)
    $packageJsonPath = Join-Path $ProjectRoot "package.json"
    $packageJson = Read-JsonFile -Path $packageJsonPath
    if ($null -ne $packageJson) {
        if ($packageJson.PSObject.Properties.Name -contains 'dependencies' -and $packageJson.dependencies) {
            $dependencies += $packageJson.dependencies.PSObject.Properties.Name
        }
        if ($packageJson.PSObject.Properties.Name -contains 'devDependencies' -and $packageJson.devDependencies) {
            $dependencies += $packageJson.devDependencies.PSObject.Properties.Name
        }
        if ($packageJson.PSObject.Properties.Name -contains 'peerDependencies' -and $packageJson.peerDependencies) {
            $dependencies += $packageJson.peerDependencies.PSObject.Properties.Name
        }
    }

    # Check requirements.txt (Python)
    $requirementsPath = Join-Path $ProjectRoot "requirements.txt"
    if (Test-Path $requirementsPath) {
        try {
            $lines = Get-Content -Path $requirementsPath
            foreach ($line in $lines) {
                $line = $line.Trim()
                if ($line -and -not $line.StartsWith('#')) {
                    # Extract package name (before ==, >=, <=, ~=, etc.)
                    $packageName = $line -replace '[<>=~!].*$', '' -replace '\[.*\]$', ''
                    if ($packageName) {
                        $dependencies += $packageName.Trim()
                    }
                }
            }
        }
        catch {
            Write-Verbose "Failed to parse requirements.txt: $_"
        }
    }

    # Check pyproject.toml (Python)
    $pyprojectPath = Join-Path $ProjectRoot "pyproject.toml"
    if (Test-Path $pyprojectPath) {
        try {
            $content = Get-Content -Path $pyprojectPath -Raw
            # Simple regex to extract dependencies (not a full TOML parser)
            if ($content -match 'dependencies\s*=\s*\[([\s\S]*?)\]') {
                $depSection = $Matches[1]
                $depMatches = [regex]::Matches($depSection, '"([^"]+)"')
                foreach ($match in $depMatches) {
                    $dep = $match.Groups[1].Value -replace '[<>=~!].*$', ''
                    $dependencies += $dep.Trim()
                }
            }
        }
        catch {
            Write-Verbose "Failed to parse pyproject.toml: $_"
        }
    }

    # Check go.mod (Go)
    $goModPath = Join-Path $ProjectRoot "go.mod"
    if (Test-Path $goModPath) {
        try {
            $content = Get-Content -Path $goModPath
            foreach ($line in $content) {
                if ($line -match '^\s*(\S+)\s+v') {
                    $moduleName = $Matches[1].Split('/')[-1]
                    $dependencies += $moduleName
                }
            }
        }
        catch {
            Write-Verbose "Failed to parse go.mod: $_"
        }
    }

    # Check Cargo.toml (Rust)
    $cargoPath = Join-Path $ProjectRoot "Cargo.toml"
    if (Test-Path $cargoPath) {
        try {
            $content = Get-Content -Path $cargoPath -Raw
            $inDependencies = $false
            foreach ($line in ($content -split "`n")) {
                if ($line -match '^\[dependencies\]') {
                    $inDependencies = $true
                    continue
                }
                if ($line -match '^\[' -and $inDependencies) {
                    $inDependencies = $false
                }
                if ($inDependencies -and $line -match '^(\w+)\s*=') {
                    $dependencies += $Matches[1]
                }
            }
        }
        catch {
            Write-Verbose "Failed to parse Cargo.toml: $_"
        }
    }

    # Check pom.xml (Java/Maven) - Secure XML parsing to prevent XXE attacks
    $pomPath = Join-Path $ProjectRoot "pom.xml"
    if (Test-Path $pomPath) {
        try {
            # Create secure XML reader settings (prevents XXE)
            $xmlSettings = New-Object System.Xml.XmlReaderSettings
            $xmlSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
            $xmlSettings.XmlResolver = $null

            $reader = [System.Xml.XmlReader]::Create($pomPath, $xmlSettings)
            $pom = New-Object System.Xml.XmlDocument
            $pom.Load($reader)
            $reader.Close()

            if ($pom.project.dependencies.dependency) {
                foreach ($dep in $pom.project.dependencies.dependency) {
                    $dependencies += $dep.artifactId
                }
            }
        }
        catch {
            Write-Verbose "Failed to parse pom.xml: $_"
        }
    }

    # Check build.gradle (Java/Gradle)
    $gradlePath = Join-Path $ProjectRoot "build.gradle"
    if (Test-Path $gradlePath) {
        try {
            $content = Get-Content -Path $gradlePath -Raw
            $gradlePattern = '(?:implementation|compile|api)\s+[' + "'" + '"]([^:]+):([^:]+)'
            $depMatches = [regex]::Matches($content, $gradlePattern)
            foreach ($match in $depMatches) {
                $dependencies += $match.Groups[2].Value
            }
        }
        catch {
            Write-Verbose "Failed to parse build.gradle: $_"
        }
    }

    if ($dependencies.Count -eq 0) {
        return @()
    }
    return @($dependencies | Select-Object -Unique)
}

<#
.SYNOPSIS
    Formats detection result for display.

.PARAMETER DetectionResult
    The detection result hashtable.

.OUTPUTS
    Formatted markdown string.
#>
function Format-DetectionResult {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$DetectionResult
    )

    $output = @()

    if ($DetectionResult.detectedType -eq "unknown") {
        $output += "**Detected Project Type**: Unknown"
        $output += "**Recommended Preset**: minimal (default)"
        $output += ""
        $output += "No strong project type match found. Using minimal preset."
    }
    else {
        $preset = Get-PresetByName -Name $DetectionResult.recommendedPreset
        $displayName = if ($preset) { if ($preset.displayName) { $preset.displayName } else { $preset.name } } else { $DetectionResult.detectedType }

        $output += "**Detected Project Type**: $displayName"
        $output += "**Confidence**: $([math]::Round($DetectionResult.confidence * 100))%"
        $output += "**Recommended Preset**: $($DetectionResult.recommendedPreset)"

        if ($preset.estimatedTokenSaved) {
            $output += "**Estimated Token Savings**: ~$($preset.estimatedTokenSaved) tokens"
        }

        if ($DetectionResult.details.matches) {
            $matches = $DetectionResult.details.matches

            if ($matches.files -and $matches.files.Count -gt 0) {
                $output += ""
                $output += "**Matched Files**: $($matches.files -join ', ')"
            }

            if ($matches.dependencies -and $matches.dependencies.Count -gt 0) {
                $output += "**Matched Dependencies**: $($matches.dependencies -join ', ')"
            }
        }
    }

    return $output -join "`n"
}

#endregion

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Detect-ProjectType',
        'Get-ProjectDependencies',
        'Format-DetectionResult',
        'Clear-DetectionCache',
        'Get-DetectionCacheStats'
    )
}
