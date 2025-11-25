#Requires -Version 5.1
<#
.SYNOPSIS
    AGENTS.md parser module for AGENTS Context Preserver plugin.

.DESCRIPTION
    Provides functions for discovering, reading, parsing, and merging AGENTS.md files.
    Handles markdown structure extraction, subagent detection, and content compression.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
#>

#region Module Dependencies
# Required modules: security.ps1

$script:ModuleDependencies = @(
    @{ Name = 'security'; Path = "$PSScriptRoot\..\utils\security.ps1" }
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

#region Get-AgentsMdHash

<#
.SYNOPSIS
    Computes SHA256 hash of content.

.DESCRIPTION
    Generates a SHA256 hash string for the provided content.
    Used for change detection and caching purposes.

.PARAMETER Content
    The content string to hash.

.OUTPUTS
    System.String
    Returns the SHA256 hash as a lowercase hexadecimal string.

.EXAMPLE
    $hash = Get-AgentsMdHash -Content $fileContent
#>
function Get-AgentsMdHash {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    try {
        if ([string]::IsNullOrEmpty($Content)) {
            $Content = ""
        }

        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
        $hashBytes = $sha256.ComputeHash($bytes)

        # Convert to lowercase hex string
        $hashString = [System.BitConverter]::ToString($hashBytes) -replace '-', ''
        return $hashString.ToLower()

    } catch {
        Write-Error "Failed to compute hash: $($_.Exception.Message)"
        throw
    } finally {
        if ($sha256) {
            $sha256.Dispose()
        }
    }
}

#endregion

#region Compress-AgentsMdContent

<#
.SYNOPSIS
    Summarizes large content by keeping essential information.

.DESCRIPTION
    Compresses AGENTS.md content by preserving headers and first paragraphs
    of each section while truncating detailed content. Adds truncation markers.

.PARAMETER Content
    The content string to compress.

.PARAMETER MaxSizeKB
    Maximum size in kilobytes for the compressed content. Default is 50KB.

.OUTPUTS
    System.String
    Returns the compressed content with truncation markers where applicable.

.EXAMPLE
    $compressed = Compress-AgentsMdContent -Content $largeContent -MaxSizeKB 30
#>
function Compress-AgentsMdContent {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content,

        [Parameter()]
        [int]$MaxSizeKB = 50
    )

    if ([string]::IsNullOrEmpty($Content)) {
        return $Content
    }

    $maxBytes = $MaxSizeKB * 1024
    $currentBytes = [System.Text.Encoding]::UTF8.GetByteCount($Content)

    # If already under limit, return as-is
    if ($currentBytes -le $maxBytes) {
        return $Content
    }

    Write-Verbose "Content size ($([math]::Round($currentBytes/1024, 2))KB) exceeds limit (${MaxSizeKB}KB), compressing..."

    try {
        $lines = $Content -split "`r?`n"
        $result = [System.Text.StringBuilder]::new()
        $inSection = $false
        $paragraphCount = 0
        $truncatedSections = 0

        foreach ($line in $lines) {
            # Check if this is a header
            if ($line -match '^(#{1,6})\s+(.+)$') {
                # Always include headers
                [void]$result.AppendLine($line)
                $inSection = $true
                $paragraphCount = 0
                continue
            }

            # Check if this is a bullet point (directive)
            if ($line -match '^\s*[-*+]\s+.+$') {
                # Always include directives
                [void]$result.AppendLine($line)
                continue
            }

            # Check if empty line (paragraph separator)
            if ([string]::IsNullOrWhiteSpace($line)) {
                if ($inSection -and $paragraphCount -gt 0) {
                    $paragraphCount++
                }
                [void]$result.AppendLine($line)
                continue
            }

            # Regular content line
            if ($inSection) {
                if ($paragraphCount -eq 0) {
                    # First paragraph - always include
                    [void]$result.AppendLine($line)
                    $paragraphCount = 1
                } elseif ($paragraphCount -eq 1) {
                    # End of first paragraph - add truncation marker
                    [void]$result.AppendLine("... [truncated]")
                    [void]$result.AppendLine("")
                    $paragraphCount = 2
                    $truncatedSections++
                }
                # Skip subsequent paragraphs
            } else {
                # Content before any header - include
                [void]$result.AppendLine($line)
            }

            # Check if we're approaching the size limit
            $currentSize = [System.Text.Encoding]::UTF8.GetByteCount($result.ToString())
            if ($currentSize -gt $maxBytes * 0.9) {
                # Approaching limit - add final truncation marker and stop
                [void]$result.AppendLine("")
                [void]$result.AppendLine("... [content truncated due to size limit]")
                break
            }
        }

        $compressed = $result.ToString().TrimEnd()
        $finalSize = [System.Text.Encoding]::UTF8.GetByteCount($compressed)

        Write-Verbose "Compressed to $([math]::Round($finalSize/1024, 2))KB ($truncatedSections sections truncated)"

        return $compressed

    } catch {
        Write-Error "Failed to compress content: $($_.Exception.Message)"
        throw
    }
}

#endregion

#region ConvertFrom-AgentsMd

<#
.SYNOPSIS
    Parses markdown content to structured data.

.DESCRIPTION
    Converts AGENTS.md markdown content into a structured hashtable containing
    sections, subagents, and key instructions. Extracts headers, bullet points,
    and detects subagent definitions.

.PARAMETER Content
    The markdown content string to parse.

.OUTPUTS
    System.Collections.Hashtable
    Returns a hashtable with:
    - sections: Array of section objects (heading, level, content, directives)
    - subagents: Array of subagent objects (name, description, trigger)
    - key_instructions: Array of key instruction strings

.EXAMPLE
    $parsed = ConvertFrom-AgentsMd -Content $markdownContent
    $parsed.sections | ForEach-Object { Write-Host $_.heading }
#>
function ConvertFrom-AgentsMd {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    $result = @{
        sections = @()
        subagents = @()
        key_instructions = @()
    }

    if ([string]::IsNullOrEmpty($Content)) {
        return $result
    }

    try {
        $lines = $Content -split "`r?`n"
        $sections = [System.Collections.ArrayList]::new()
        $subagents = [System.Collections.ArrayList]::new()
        $keyInstructions = [System.Collections.ArrayList]::new()

        $currentSection = $null
        $contentBuffer = [System.Text.StringBuilder]::new()
        $directivesBuffer = [System.Collections.ArrayList]::new()

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]

            # Check for header
            if ($line -match '^(#{1,6})\s+(.+)$') {
                # Save header match results before any nested matching
                $headerLevel = $Matches[1].Length
                $headerHeading = $Matches[2].Trim()

                # Save previous section if exists
                if ($null -ne $currentSection) {
                    $currentSection.content = $contentBuffer.ToString().Trim()
                    $currentSection.directives = $directivesBuffer.ToArray()
                    [void]$sections.Add($currentSection)

                    # Check if previous section was a subagent (level 3 header)
                    if ($currentSection.level -eq 3) {
                        $subagent = @{
                            name = $currentSection.heading
                            description = $currentSection.content
                            trigger = $null
                        }

                        # Extract trigger from directives
                        foreach ($directive in $currentSection.directives) {
                            if ($directive -match '(?i)trigger[:\s]+(.+)$') {
                                $subagent.trigger = $Matches[1].Trim()
                                break
                            }
                        }

                        [void]$subagents.Add($subagent)
                    }
                }

                # Start new section using saved match results
                $currentSection = @{
                    heading = $headerHeading
                    level = $headerLevel
                    content = ""
                    directives = @()
                }

                [void]$contentBuffer.Clear()
                [void]$directivesBuffer.Clear()
                continue
            }

            # Check for bullet point (directive)
            if ($line -match '^\s*[-*+]\s+(.+)$') {
                $directive = $Matches[1].Trim()
                [void]$directivesBuffer.Add($directive)

                # Check for key instructions (marked with IMPORTANT, MUST, ALWAYS, NEVER, etc.)
                if ($directive -match '(?i)(IMPORTANT|MUST|ALWAYS|NEVER|CRITICAL|REQUIRED)') {
                    [void]$keyInstructions.Add($directive)
                }

                # Also add to content buffer
                [void]$contentBuffer.AppendLine($line)
                continue
            }

            # Check for numbered list items (also directives)
            if ($line -match '^\s*\d+[\.\)]\s+(.+)$') {
                $directive = $Matches[1].Trim()
                [void]$directivesBuffer.Add($directive)

                if ($directive -match '(?i)(IMPORTANT|MUST|ALWAYS|NEVER|CRITICAL|REQUIRED)') {
                    [void]$keyInstructions.Add($directive)
                }

                [void]$contentBuffer.AppendLine($line)
                continue
            }

            # Regular content line
            [void]$contentBuffer.AppendLine($line)
        }

        # Save last section
        if ($null -ne $currentSection) {
            $currentSection.content = $contentBuffer.ToString().Trim()
            $currentSection.directives = $directivesBuffer.ToArray()
            [void]$sections.Add($currentSection)

            # Check if last section was a subagent
            if ($currentSection.level -eq 3) {
                $subagent = @{
                    name = $currentSection.heading
                    description = $currentSection.content
                    trigger = $null
                }

                foreach ($directive in $currentSection.directives) {
                    if ($directive -match '(?i)trigger[:\s]+(.+)$') {
                        $subagent.trigger = $Matches[1].Trim()
                        break
                    }
                }

                [void]$subagents.Add($subagent)
            }
        }

        $result.sections = $sections.ToArray()
        $result.subagents = $subagents.ToArray()
        $result.key_instructions = $keyInstructions.ToArray()

        Write-Verbose "Parsed $($sections.Count) sections, $($subagents.Count) subagents, $($keyInstructions.Count) key instructions"

        return $result

    } catch {
        Write-Error "Failed to parse AGENTS.md content: $($_.Exception.Message)"
        throw
    }
}

#endregion

#region Read-AgentsMdFile

<#
.SYNOPSIS
    Reads and parses a single AGENTS.md file.

.DESCRIPTION
    Reads an AGENTS.md file from disk, computes its hash, optionally truncates
    large content, and parses the markdown structure.

.PARAMETER Path
    The file path to read.

.PARAMETER MaxSizeKB
    Maximum size in kilobytes before truncation. Default is 50KB.

.OUTPUTS
    System.Collections.Hashtable
    Returns a hashtable with:
    - path: Original file path
    - content: File content (possibly truncated)
    - hash: SHA256 hash of original content
    - truncated: Boolean indicating if content was truncated
    - parsed: Parsed markdown structure from ConvertFrom-AgentsMd

.EXAMPLE
    $file = Read-AgentsMdFile -Path "C:\Project\AGENTS.md"
    Write-Host "Hash: $($file.hash)"
    Write-Host "Sections: $($file.parsed.sections.Count)"
#>
function Read-AgentsMdFile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter()]
        [int]$MaxSizeKB = 50
    )

    $result = @{
        path = $Path
        content = ""
        hash = ""
        truncated = $false
        parsed = @{
            sections = @()
            subagents = @()
            key_instructions = @()
        }
    }

    try {
        # Resolve and normalize the path
        # Note: Home directory expansion (~) must be done before calling this function
        $resolvedPath = [System.IO.Path]::GetFullPath($Path)

        # Check if file exists
        if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
            Write-Verbose "AGENTS.md file not found: $resolvedPath"
            return $null
        }

        $result.path = $resolvedPath

        # Read file content
        $content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

        if ([string]::IsNullOrEmpty($content)) {
            Write-Verbose "AGENTS.md file is empty: $resolvedPath"
            return $result
        }

        # Compute hash of original content
        $result.hash = Get-AgentsMdHash -Content $content

        # Check if content needs compression
        $contentBytes = [System.Text.Encoding]::UTF8.GetByteCount($content)
        $maxBytes = $MaxSizeKB * 1024

        if ($contentBytes -gt $maxBytes) {
            Write-Verbose "File size ($([math]::Round($contentBytes/1024, 2))KB) exceeds limit (${MaxSizeKB}KB)"
            $result.content = Compress-AgentsMdContent -Content $content -MaxSizeKB $MaxSizeKB
            $result.truncated = $true
        } else {
            $result.content = $content
            $result.truncated = $false
        }

        # Parse the content
        $result.parsed = ConvertFrom-AgentsMd -Content $result.content

        Write-Verbose "Successfully read AGENTS.md: $resolvedPath (hash: $($result.hash.Substring(0, 8))...)"

        return $result

    } catch {
        Write-Error "Failed to read AGENTS.md file '$Path': $($_.Exception.Message)"
        throw
    }
}

#endregion

#region Get-AgentsMdFiles

<#
.SYNOPSIS
    Discovers all AGENTS.md files.

.DESCRIPTION
    Searches for AGENTS.md files in three locations:
    - Global: User's home directory (~/.claude/AGENTS.md)
    - Project: Project root (AGENTS.md)
    - Local: Subdirectories up to specified depth

.PARAMETER ProjectRoot
    The root directory of the project to search.

.PARAMETER GlobalPath
    Path to global AGENTS.md. Default is "~/.claude/AGENTS.md".

.PARAMETER IncludeLocal
    Whether to search for local AGENTS.md files in subdirectories. Default is $true.

.PARAMETER LocalMaxDepth
    Maximum directory depth to search for local files. Default is 3.

.OUTPUTS
    System.Collections.Hashtable
    Returns a hashtable with:
    - global: Global AGENTS.md file info (or $null)
    - project: Project AGENTS.md file info (or $null)
    - local: Array of local AGENTS.md file infos

.EXAMPLE
    $files = Get-AgentsMdFiles -ProjectRoot "C:\MyProject"
    if ($files.project) {
        Write-Host "Found project AGENTS.md"
    }
#>
function Get-AgentsMdFiles {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [string]$GlobalPath = "~/.claude/AGENTS.md",

        [Parameter()]
        [bool]$IncludeLocal = $true,

        [Parameter()]
        [int]$LocalMaxDepth = 3
    )

    $result = @{
        global = $null
        project = $null
        local = @()
    }

    try {
        # Normalize project root
        $normalizedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

        if (-not (Test-Path -LiteralPath $normalizedRoot -PathType Container)) {
            Write-Warning "Project root does not exist: $normalizedRoot"
            return $result
        }

        # 1. Read global AGENTS.md
        $globalResolved = $GlobalPath.Replace('~', $env:USERPROFILE)
        if (Test-Path -LiteralPath $globalResolved -PathType Leaf) {
            Write-Verbose "Reading global AGENTS.md: $globalResolved"
            $result.global = Read-AgentsMdFile -Path $globalResolved
        } else {
            Write-Verbose "Global AGENTS.md not found: $globalResolved"
        }

        # 2. Read project AGENTS.md
        $projectAgentsPath = Join-Path -Path $normalizedRoot -ChildPath "AGENTS.md"
        if (Test-Path -LiteralPath $projectAgentsPath -PathType Leaf) {
            Write-Verbose "Reading project AGENTS.md: $projectAgentsPath"
            $result.project = Read-AgentsMdFile -Path $projectAgentsPath
        } else {
            Write-Verbose "Project AGENTS.md not found: $projectAgentsPath"
        }

        # 3. Discover local AGENTS.md files
        if ($IncludeLocal) {
            $localFiles = [System.Collections.ArrayList]::new()

            # Get all AGENTS.md files in subdirectories
            $searchParams = @{
                Path = $normalizedRoot
                Filter = "AGENTS.md"
                Recurse = $true
                Depth = $LocalMaxDepth
                File = $true
                ErrorAction = 'SilentlyContinue'
            }

            $foundFiles = Get-ChildItem @searchParams

            foreach ($file in $foundFiles) {
                # Skip the project root AGENTS.md (already handled)
                if ($file.FullName -eq $projectAgentsPath) {
                    continue
                }

                # Skip files in blocked directories
                $relativePath = $file.FullName.Substring($normalizedRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)

                # Check for blocked patterns (node_modules, .git, etc.)
                $isBlocked = $false
                foreach ($pattern in @('node_modules', '.git', '__pycache__', '.venv', 'venv', '.pytest_cache')) {
                    if ($relativePath -like "*$pattern*") {
                        Write-Verbose "Skipping AGENTS.md in blocked directory: $relativePath"
                        $isBlocked = $true
                        break
                    }
                }

                if ($isBlocked) {
                    continue
                }

                Write-Verbose "Reading local AGENTS.md: $($file.FullName)"
                $localFile = Read-AgentsMdFile -Path $file.FullName
                if ($null -ne $localFile) {
                    [void]$localFiles.Add($localFile)
                }
            }

            $result.local = $localFiles.ToArray()
            Write-Verbose "Found $($localFiles.Count) local AGENTS.md files"
        }

        return $result

    } catch {
        Write-Error "Failed to discover AGENTS.md files: $($_.Exception.Message)"
        throw
    }
}

#endregion

#region Merge-AgentsMdConfigs

<#
.SYNOPSIS
    Merges multiple AGENTS.md configurations with precedence.

.DESCRIPTION
    Merges configurations from global, project, and local AGENTS.md files.
    Precedence order: Local > Project > Global

    Merging behavior:
    - Sections with same heading are overwritten by higher precedence
    - Subagents with same name are overwritten by higher precedence
    - Key instructions are accumulated (not deduplicated)
    - Directives within sections are merged

.PARAMETER Global
    Global AGENTS.md parsed hashtable (lowest precedence).

.PARAMETER Project
    Project AGENTS.md parsed hashtable (medium precedence).

.PARAMETER Local
    Array of local AGENTS.md parsed hashtables (highest precedence).

.OUTPUTS
    System.Collections.Hashtable
    Returns merged configuration with same structure as ConvertFrom-AgentsMd output.

.EXAMPLE
    $merged = Merge-AgentsMdConfigs -Global $global.parsed -Project $project.parsed -Local $local
#>
function Merge-AgentsMdConfigs {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter()]
        [hashtable]$Global,

        [Parameter()]
        [hashtable]$Project,

        [Parameter()]
        [array]$Local = @()
    )

    $result = @{
        sections = @()
        subagents = @()
        key_instructions = @()
    }

    try {
        # Use ordered hashtables for maintaining precedence
        $sectionMap = [ordered]@{}
        $subagentMap = [ordered]@{}
        $keyInstructions = [System.Collections.ArrayList]::new()

        # Helper function to merge a config
        $mergeConfig = {
            param([hashtable]$Config, [string]$Source)

            if ($null -eq $Config) {
                return
            }

            # Merge sections
            if ($Config.sections) {
                foreach ($section in $Config.sections) {
                    $key = "$($section.level):$($section.heading)"

                    if ($sectionMap.Contains($key)) {
                        # Merge directives
                        $existing = $sectionMap[$key]
                        $mergedDirectives = [System.Collections.ArrayList]::new()

                        # Add existing directives
                        foreach ($d in $existing.directives) {
                            [void]$mergedDirectives.Add($d)
                        }

                        # Add new directives (avoid duplicates)
                        foreach ($d in $section.directives) {
                            if ($d -notin $mergedDirectives) {
                                [void]$mergedDirectives.Add($d)
                            }
                        }

                        # Update section with merged content
                        $sectionMap[$key] = @{
                            heading = $section.heading
                            level = $section.level
                            content = $section.content  # Use higher precedence content
                            directives = $mergedDirectives.ToArray()
                            source = $Source
                        }
                    } else {
                        # Add new section
                        $sectionMap[$key] = @{
                            heading = $section.heading
                            level = $section.level
                            content = $section.content
                            directives = $section.directives
                            source = $Source
                        }
                    }

                    Write-Verbose "Merged section '$($section.heading)' from $Source"
                }
            }

            # Merge subagents
            if ($Config.subagents) {
                foreach ($subagent in $Config.subagents) {
                    $subagentMap[$subagent.name] = @{
                        name = $subagent.name
                        description = $subagent.description
                        trigger = $subagent.trigger
                        source = $Source
                    }
                    Write-Verbose "Merged subagent '$($subagent.name)' from $Source"
                }
            }

            # Accumulate key instructions
            if ($Config.key_instructions) {
                foreach ($instruction in $Config.key_instructions) {
                    [void]$keyInstructions.Add($instruction)
                }
            }
        }

        # Apply configs in precedence order (lowest to highest)

        # 1. Global (lowest precedence)
        if ($null -ne $Global) {
            & $mergeConfig $Global "global"
        }

        # 2. Project (medium precedence)
        if ($null -ne $Project) {
            & $mergeConfig $Project "project"
        }

        # 3. Local (highest precedence)
        if ($null -ne $Local -and $Local.Count -gt 0) {
            foreach ($localConfig in $Local) {
                if ($null -ne $localConfig -and $null -ne $localConfig.parsed) {
                    & $mergeConfig $localConfig.parsed "local:$($localConfig.path)"
                }
            }
        }

        # Build result arrays
        $result.sections = @($sectionMap.Values)
        $result.subagents = @($subagentMap.Values)
        $result.key_instructions = $keyInstructions.ToArray()

        Write-Verbose "Merged config: $($result.sections.Count) sections, $($result.subagents.Count) subagents, $($result.key_instructions.Count) key instructions"

        return $result

    } catch {
        Write-Error "Failed to merge AGENTS.md configs: $($_.Exception.Message)"
        throw
    }
}

#endregion

#region Export Functions

# Export public functions (only when loaded as a module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-AgentsMdHash',
        'Compress-AgentsMdContent',
        'ConvertFrom-AgentsMd',
        'Read-AgentsMdFile',
        'Get-AgentsMdFiles',
        'Merge-AgentsMdConfigs'
    )
}

#endregion
