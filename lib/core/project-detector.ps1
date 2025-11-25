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

# Import preset manager
. "$PSScriptRoot\preset-manager.ps1"

#region Project Detection Functions

<#
.SYNOPSIS
    Detects the project type based on files and dependencies.

.PARAMETER ProjectRoot
    The root directory of the project to analyze.

.OUTPUTS
    Hashtable with detected type, confidence, and recommended preset.
#>
function Detect-ProjectType {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
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
            $maxScore += $config.detection.files.Count * 10
            foreach ($file in $config.detection.files) {
                $filePath = Join-Path $ProjectRoot $file
                # Support glob patterns
                if ($file -match '\*') {
                    $foundFiles = Get-ChildItem -Path $ProjectRoot -Filter $file -ErrorAction SilentlyContinue
                    if ($foundFiles) {
                        $score += 10
                        $matches.files += $file
                    }
                }
                elseif (Test-Path $filePath) {
                    $score += 10
                    $matches.files += $file
                }
            }
        }

        # Check dependencies
        if ($config.detection.dependencies) {
            $maxScore += $config.detection.dependencies.Count * 15
            $projectDeps = Get-ProjectDependencies -ProjectRoot $ProjectRoot

            foreach ($dep in $config.detection.dependencies) {
                if ($projectDeps -contains $dep) {
                    $score += 15
                    $matches.dependencies += $dep
                }
            }
        }

        # Check directory patterns
        if ($config.detection.patterns) {
            $maxScore += $config.detection.patterns.Count * 5
            foreach ($pattern in $config.detection.patterns) {
                $patternPath = Join-Path $ProjectRoot $pattern
                $basePath = $patternPath -replace '\*\*.*$', ''
                if (Test-Path $basePath) {
                    $score += 5
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

    # Return result
    if ($bestPreset -and $bestConfidence -ge 0.3) {
        return @{
            detectedType = $bestPreset
            confidence = $bestConfidence
            recommendedPreset = $bestPreset
            details = @{
                scores = $scores
                matches = $scores[$bestPreset].matches
            }
        }
    }

    return @{
        detectedType = "unknown"
        confidence = 0
        recommendedPreset = "minimal"
        details = @{
            scores = $scores
            message = "No strong match found"
        }
    }
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
    if (Test-Path $packageJsonPath) {
        try {
            $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json

            if ($packageJson.dependencies) {
                $dependencies += $packageJson.dependencies.PSObject.Properties.Name
            }
            if ($packageJson.devDependencies) {
                $dependencies += $packageJson.devDependencies.PSObject.Properties.Name
            }
            if ($packageJson.peerDependencies) {
                $dependencies += $packageJson.peerDependencies.PSObject.Properties.Name
            }
        }
        catch {
            Write-Verbose "Failed to parse package.json: $_"
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
        'Format-DetectionResult'
    )
}
