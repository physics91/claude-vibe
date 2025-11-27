#Requires -Version 5.1
<#
.SYNOPSIS
    AGENTS.md caching module for Claude-Vibe plugin.

.DESCRIPTION
    Provides caching functionality for AGENTS.md parsing results.
    Uses file hash-based cache invalidation and supports TTL (Time-To-Live).
    Cache is stored in temporary files for session persistence.

.NOTES
    Author: Claude-Vibe
    Version: 1.0.0
#>

#region Configuration Constants

$script:CacheConfig = @{
    # Cache directory relative to user's .claude folder
    CacheDir = "$env:USERPROFILE\.claude\claude-vibe\cache"

    # Cache file name
    CacheFileName = "agents-md-cache.json"

    # Default TTL in seconds (5 minutes)
    DefaultTTLSeconds = 300

    # Maximum cache entries before cleanup
    MaxCacheEntries = 10

    # Cache version for invalidation on schema changes
    CacheVersion = "1.0.0"
}

#endregion

#region Initialize-CacheDirectory

<#
.SYNOPSIS
    Ensures cache directory exists.

.DESCRIPTION
    Creates the cache directory structure if it doesn't exist.
    Returns the full path to the cache file.

.OUTPUTS
    System.String
    Returns the full path to the cache file.

.EXAMPLE
    $cachePath = Initialize-CacheDirectory
#>
function Initialize-CacheDirectory {
    [CmdletBinding()]
    [OutputType([string])]
    param()

    try {
        $cacheDir = $script:CacheConfig.CacheDir

        if (-not (Test-Path -LiteralPath $cacheDir -PathType Container)) {
            Write-Verbose "Creating cache directory: $cacheDir"
            $null = New-Item -Path $cacheDir -ItemType Directory -Force -ErrorAction Stop
        }

        $cachePath = Join-Path -Path $cacheDir -ChildPath $script:CacheConfig.CacheFileName
        return $cachePath

    } catch {
        Write-Warning "[CVIBE-201] Cache directory creation failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $null
    }
}

#endregion

#region Read-CacheFile

<#
.SYNOPSIS
    Reads the cache file from disk.

.DESCRIPTION
    Reads and deserializes the cache JSON file.
    Returns an empty hashtable if the file doesn't exist or is invalid.

.OUTPUTS
    System.Collections.Hashtable
    Returns the cache data structure.

.EXAMPLE
    $cache = Read-CacheFile
#>
function Read-CacheFile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    try {
        $cachePath = Initialize-CacheDirectory

        if ($null -eq $cachePath) {
            return @{ version = $script:CacheConfig.CacheVersion; entries = @{} }
        }

        if (-not (Test-Path -LiteralPath $cachePath -PathType Leaf)) {
            Write-Verbose "Cache file not found, returning empty cache"
            return @{ version = $script:CacheConfig.CacheVersion; entries = @{} }
        }

        $content = Get-Content -LiteralPath $cachePath -Raw -Encoding UTF8 -ErrorAction Stop

        if ([string]::IsNullOrWhiteSpace($content)) {
            return @{ version = $script:CacheConfig.CacheVersion; entries = @{} }
        }

        $cache = $content | ConvertFrom-Json -ErrorAction Stop

        # Convert to hashtable for easier manipulation
        $result = @{
            version = $cache.version
            entries = @{}
        }

        if ($null -ne $cache.entries) {
            foreach ($prop in $cache.entries.PSObject.Properties) {
                $result.entries[$prop.Name] = @{
                    data = $prop.Value.data
                    hashes = $prop.Value.hashes
                    timestamp = $prop.Value.timestamp
                    ttl = $prop.Value.ttl
                }
            }
        }

        # Check cache version
        if ($result.version -ne $script:CacheConfig.CacheVersion) {
            Write-Verbose "Cache version mismatch (cached: $($result.version), current: $($script:CacheConfig.CacheVersion)), clearing cache"
            return @{ version = $script:CacheConfig.CacheVersion; entries = @{} }
        }

        Write-Verbose "Cache loaded with $($result.entries.Count) entries"
        return $result

    } catch {
        Write-Warning "[CVIBE-202] Cache read failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return @{ version = $script:CacheConfig.CacheVersion; entries = @{} }
    }
}

#endregion

#region Write-CacheFile

<#
.SYNOPSIS
    Writes cache data to disk.

.DESCRIPTION
    Serializes and writes the cache data to a JSON file.
    Performs cleanup if cache exceeds max entries.

.PARAMETER Cache
    The cache hashtable to write.

.OUTPUTS
    System.Boolean
    Returns $true if write succeeded, $false otherwise.

.EXAMPLE
    $success = Write-CacheFile -Cache $cacheData
#>
function Write-CacheFile {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$Cache
    )

    try {
        $cachePath = Initialize-CacheDirectory

        if ($null -eq $cachePath) {
            return $false
        }

        # Cleanup old entries if exceeding max
        if ($Cache.entries.Count -gt $script:CacheConfig.MaxCacheEntries) {
            Write-Verbose "Cache exceeds max entries ($($Cache.entries.Count) > $($script:CacheConfig.MaxCacheEntries)), cleaning up"
            $Cache = Clear-ExpiredCacheEntries -Cache $Cache -Force
        }

        $json = $Cache | ConvertTo-Json -Depth 10 -Compress
        $json | Set-Content -LiteralPath $cachePath -Encoding UTF8 -Force -ErrorAction Stop

        Write-Verbose "Cache written with $($Cache.entries.Count) entries"
        return $true

    } catch {
        Write-Warning "[CVIBE-203] Cache write failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $false
    }
}

#endregion

#region Clear-ExpiredCacheEntries

<#
.SYNOPSIS
    Removes expired cache entries.

.DESCRIPTION
    Removes entries that have exceeded their TTL.
    If Force is specified, also removes oldest entries to meet MaxCacheEntries.

.PARAMETER Cache
    The cache hashtable to clean.

.PARAMETER Force
    If specified, forces cleanup even if entries haven't expired.

.OUTPUTS
    System.Collections.Hashtable
    Returns the cleaned cache.

.EXAMPLE
    $cleanCache = Clear-ExpiredCacheEntries -Cache $cache
#>
function Clear-ExpiredCacheEntries {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$Cache,

        [Parameter()]
        [switch]$Force
    )

    try {
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $expiredKeys = [System.Collections.Generic.List[string]]::new()

        foreach ($key in $Cache.entries.Keys) {
            $entry = $Cache.entries[$key]
            $ttl = if ($null -ne $entry.ttl) { $entry.ttl } else { $script:CacheConfig.DefaultTTLSeconds }
            $age = $now - $entry.timestamp

            if ($age -gt $ttl) {
                $expiredKeys.Add($key)
                Write-Verbose "Cache entry expired: $key (age: ${age}s, ttl: ${ttl}s)"
            }
        }

        foreach ($key in $expiredKeys) {
            $Cache.entries.Remove($key)
        }

        # Force cleanup if still exceeding max
        if ($Force -and $Cache.entries.Count -gt $script:CacheConfig.MaxCacheEntries) {
            # Sort by timestamp and remove oldest
            $sorted = $Cache.entries.GetEnumerator() | Sort-Object { $_.Value.timestamp }
            $toRemove = $Cache.entries.Count - $script:CacheConfig.MaxCacheEntries

            $removed = 0
            foreach ($entry in $sorted) {
                if ($removed -ge $toRemove) { break }
                $Cache.entries.Remove($entry.Key)
                $removed++
                Write-Verbose "Removed old cache entry: $($entry.Key)"
            }
        }

        Write-Verbose "Cache cleanup complete: $($expiredKeys.Count) expired entries removed"
        return $Cache

    } catch {
        Write-Warning "[CVIBE-204] Cache cleanup failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $Cache
    }
}

#endregion

#region Get-AgentsMdCache

<#
.SYNOPSIS
    Retrieves cached AGENTS.md data if valid.

.DESCRIPTION
    Checks if cached data exists and is still valid based on file hashes and TTL.
    Returns cached data if valid, $null if cache miss.

.PARAMETER ProjectRoot
    The project root directory used as cache key.

.PARAMETER FileHashes
    Hashtable of current file hashes to compare against cache.
    Keys: 'global', 'project', 'local' (array of hashes)

.OUTPUTS
    System.Collections.Hashtable
    Returns cached merged config if valid, $null if cache miss.

.EXAMPLE
    $hashes = @{
        global = "abc123..."
        project = "def456..."
        local = @("ghi789...")
    }
    $cached = Get-AgentsMdCache -ProjectRoot "C:\MyProject" -FileHashes $hashes
#>
function Get-AgentsMdCache {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$FileHashes
    )

    try {
        $cache = Read-CacheFile
        $cacheKey = Get-CacheKey -ProjectRoot $ProjectRoot

        if (-not $cache.entries.ContainsKey($cacheKey)) {
            Write-Verbose "Cache miss: no entry for $cacheKey"
            return $null
        }

        $entry = $cache.entries[$cacheKey]

        # Check TTL
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $ttl = if ($null -ne $entry.ttl) { $entry.ttl } else { $script:CacheConfig.DefaultTTLSeconds }
        $age = $now - $entry.timestamp

        if ($age -gt $ttl) {
            Write-Verbose "Cache miss: entry expired (age: ${age}s, ttl: ${ttl}s)"
            return $null
        }

        # Check file hashes
        $cachedHashes = $entry.hashes

        # Compare global hash
        $currentGlobal = if ($FileHashes.global) { $FileHashes.global } else { "" }
        $cachedGlobal = if ($cachedHashes.global) { $cachedHashes.global } else { "" }
        if ($currentGlobal -ne $cachedGlobal) {
            Write-Verbose "Cache miss: global hash mismatch"
            return $null
        }

        # Compare project hash
        $currentProject = if ($FileHashes.project) { $FileHashes.project } else { "" }
        $cachedProject = if ($cachedHashes.project) { $cachedHashes.project } else { "" }
        if ($currentProject -ne $cachedProject) {
            Write-Verbose "Cache miss: project hash mismatch"
            return $null
        }

        # Compare local hashes - ensure arrays
        $currentLocal = @(if ($FileHashes.local -and $FileHashes.local.Count -gt 0) {
            $FileHashes.local | Sort-Object
        })
        $cachedLocal = @(if ($cachedHashes.local -and @($cachedHashes.local).Count -gt 0) {
            $cachedHashes.local | Sort-Object
        })

        $currentCount = @($currentLocal).Count
        $cachedCount = @($cachedLocal).Count

        if ($currentCount -ne $cachedCount) {
            Write-Verbose "Cache miss: local file count mismatch ($currentCount vs $cachedCount)"
            return $null
        }

        for ($i = 0; $i -lt $currentCount; $i++) {
            if ($currentLocal[$i] -ne $cachedLocal[$i]) {
                Write-Verbose "Cache miss: local hash mismatch at index $i"
                return $null
            }
        }

        Write-Verbose "Cache hit for $cacheKey (age: ${age}s)"

        # Convert cached data back to hashtable structure
        $result = Convert-CacheDataToHashtable -CacheData $entry.data
        return $result

    } catch {
        Write-Warning "[CVIBE-205] Cache retrieval failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $null
    }
}

#endregion

#region Set-AgentsMdCache

<#
.SYNOPSIS
    Stores AGENTS.md data in cache.

.DESCRIPTION
    Caches the merged AGENTS.md configuration with file hashes for validation.

.PARAMETER ProjectRoot
    The project root directory used as cache key.

.PARAMETER Data
    The merged AGENTS.md configuration to cache.

.PARAMETER FileHashes
    Hashtable of current file hashes for cache validation.

.PARAMETER TTLSeconds
    Custom TTL in seconds. Uses default if not specified.

.OUTPUTS
    System.Boolean
    Returns $true if caching succeeded, $false otherwise.

.EXAMPLE
    $success = Set-AgentsMdCache -ProjectRoot "C:\MyProject" -Data $mergedConfig -FileHashes $hashes
#>
function Set-AgentsMdCache {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$Data,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$FileHashes,

        [Parameter()]
        [int]$TTLSeconds = 0
    )

    try {
        $cache = Read-CacheFile
        $cacheKey = Get-CacheKey -ProjectRoot $ProjectRoot

        $ttl = if ($TTLSeconds -gt 0) { $TTLSeconds } else { $script:CacheConfig.DefaultTTLSeconds }

        # Properly handle local array - ensure it's a proper array, not wrapped
        $localHashes = @()
        if ($FileHashes.local -and @($FileHashes.local).Count -gt 0) {
            $localHashes = @($FileHashes.local | Where-Object { $_ })
        }

        $cache.entries[$cacheKey] = @{
            data = $Data
            hashes = @{
                global = if ($FileHashes.global) { $FileHashes.global } else { "" }
                project = if ($FileHashes.project) { $FileHashes.project } else { "" }
                local = $localHashes
            }
            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            ttl = $ttl
        }

        $success = Write-CacheFile -Cache $cache

        if ($success) {
            Write-Verbose "Cached data for $cacheKey (ttl: ${ttl}s)"
        }

        return $success

    } catch {
        Write-Warning "[CVIBE-206] Cache storage failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $false
    }
}

#endregion

#region Clear-AgentsMdCache

<#
.SYNOPSIS
    Clears AGENTS.md cache.

.DESCRIPTION
    Removes cache entries. Can clear a specific project or all entries.

.PARAMETER ProjectRoot
    If specified, clears only the cache for this project.
    If not specified, clears all cache entries.

.OUTPUTS
    System.Boolean
    Returns $true if clear succeeded, $false otherwise.

.EXAMPLE
    # Clear specific project cache
    Clear-AgentsMdCache -ProjectRoot "C:\MyProject"

    # Clear all cache
    Clear-AgentsMdCache
#>
function Clear-AgentsMdCache {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter()]
        [string]$ProjectRoot
    )

    try {
        $cache = Read-CacheFile

        if ([string]::IsNullOrEmpty($ProjectRoot)) {
            # Clear all entries
            $cache.entries = @{}
            Write-Verbose "Cleared all cache entries"
        } else {
            # Clear specific project
            $cacheKey = Get-CacheKey -ProjectRoot $ProjectRoot
            if ($cache.entries.ContainsKey($cacheKey)) {
                $cache.entries.Remove($cacheKey)
                Write-Verbose "Cleared cache for $cacheKey"
            }
        }

        return (Write-CacheFile -Cache $cache)

    } catch {
        Write-Warning "[CVIBE-207] Cache clear failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $false
    }
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Generates a cache key from project root.

.DESCRIPTION
    Creates a normalized, unique cache key from the project path.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    System.String
    Returns the cache key.
#>
function Get-CacheKey {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ProjectRoot
    )

    $sha256 = $null

    try {
        # Normalize path and create a safe key (culture-invariant)
        $normalized = [System.IO.Path]::GetFullPath($ProjectRoot).ToLowerInvariant()
        $normalized = $normalized -replace '[\\/:*?"<>|]', '_'
        $normalized = $normalized.TrimEnd('_')

        # Truncate if too long
        if ($normalized.Length -gt 100) {
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalized))
            $hash = ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
            $normalized = $normalized.Substring(0, 50) + "_" + $hash.Substring(0, 16)
        }

        return $normalized

    } catch {
        # Graceful fallback: use a simple hash of the input
        Write-Verbose "Get-CacheKey failed for '$ProjectRoot': $($_.Exception.Message)"
        return "fallback_" + $ProjectRoot.GetHashCode().ToString()
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
    }
}

<#
.SYNOPSIS
    Converts cache data back to proper hashtable structure.

.DESCRIPTION
    When reading from JSON, objects are converted to PSCustomObject.
    This function converts them back to hashtables.

.PARAMETER CacheData
    The cached data to convert.

.OUTPUTS
    System.Collections.Hashtable
    Returns the converted hashtable.
#>
function Convert-CacheDataToHashtable {
    [CmdletBinding()]
    [OutputType([object])]  # Can return hashtable, array, or scalar
    param(
        [Parameter(Mandatory = $true)]
        $CacheData,

        [Parameter()]
        [int]$Depth = 0
    )

    # Prevent excessive recursion (defensive limit)
    $MaxDepth = 50
    if ($Depth -ge $MaxDepth) {
        Write-Verbose "Convert-CacheDataToHashtable: Max depth ($MaxDepth) exceeded, returning as-is"
        return $CacheData
    }

    if ($CacheData -is [hashtable]) {
        $result = @{}
        foreach ($key in $CacheData.Keys) {
            $result[$key] = Convert-CacheDataToHashtable -CacheData $CacheData[$key] -Depth ($Depth + 1)
        }
        return $result
    }
    elseif ($CacheData -is [PSCustomObject]) {
        $result = @{}
        foreach ($prop in $CacheData.PSObject.Properties) {
            $result[$prop.Name] = Convert-CacheDataToHashtable -CacheData $prop.Value -Depth ($Depth + 1)
        }
        return $result
    }
    elseif ($CacheData -is [array]) {
        # Use List[object] for O(n) instead of array += O(n²)
        $list = [System.Collections.Generic.List[object]]::new()
        foreach ($item in $CacheData) {
            $list.Add((Convert-CacheDataToHashtable -CacheData $item -Depth ($Depth + 1)))
        }
        return $list.ToArray()
    }
    else {
        return $CacheData
    }
}

#endregion

#region Get-FileHashesForCache

<#
.SYNOPSIS
    Collects file hashes for cache validation.

.DESCRIPTION
    Reads AGENTS.md files and collects their hashes without parsing.
    This is a lightweight operation for cache validation.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER GlobalPath
    Path to global AGENTS.md. Default is "~/.claude/AGENTS.md".

.PARAMETER IncludeLocal
    Whether to include local AGENTS.md files. Default is $true.

.PARAMETER LocalMaxDepth
    Maximum depth for local file search. Default is 3.

.OUTPUTS
    System.Collections.Hashtable
    Returns hashtable with file hashes.

.EXAMPLE
    $hashes = Get-FileHashesForCache -ProjectRoot "C:\MyProject"
#>
function Get-FileHashesForCache {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ProjectRoot,

        [Parameter()]
        [string]$GlobalPath = "~/.claude/AGENTS.md",

        [Parameter()]
        [bool]$IncludeLocal = $true,

        [Parameter()]
        [int]$LocalMaxDepth = 3
    )

    $result = @{
        global = ""
        project = ""
        local = @()
    }

    try {
        $normalizedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

        # Get global hash
        $globalResolved = $GlobalPath.Replace('~', $env:USERPROFILE)
        if (Test-Path -LiteralPath $globalResolved -PathType Leaf) {
            $content = Get-Content -LiteralPath $globalResolved -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if (-not [string]::IsNullOrEmpty($content)) {
                $result.global = Get-QuickHash -Content $content
            }
        }

        # Get project hash
        $projectPath = Join-Path -Path $normalizedRoot -ChildPath "AGENTS.md"
        if (Test-Path -LiteralPath $projectPath -PathType Leaf) {
            $content = Get-Content -LiteralPath $projectPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if (-not [string]::IsNullOrEmpty($content)) {
                $result.project = Get-QuickHash -Content $content
            }
        }

        # Get local hashes
        if ($IncludeLocal) {
            $localHashes = [System.Collections.Generic.List[string]]::new()

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
                if ($file.FullName -eq $projectPath) { continue }

                $relativePath = $file.FullName.Substring($normalizedRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)

                # Check blocked patterns
                $isBlocked = $false
                foreach ($pattern in @('node_modules', '.git', '__pycache__', '.venv', 'venv', '.pytest_cache')) {
                    if ($relativePath -like "*$pattern*") {
                        $isBlocked = $true
                        break
                    }
                }

                if ($isBlocked) { continue }

                $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                if (-not [string]::IsNullOrEmpty($content)) {
                    $localHashes.Add((Get-QuickHash -Content $content))
                }
            }

            $result.local = $localHashes.ToArray()
        }

        return $result

    } catch {
        Write-Warning "[CVIBE-208] Hash collection failed: $($_.Exception.Message -replace '\r?\n', ' ')"
        return $result
    }
}

<#
.SYNOPSIS
    Computes a quick hash for cache comparison.

.DESCRIPTION
    Uses SHA256 to hash content for cache validation.

.PARAMETER Content
    The content to hash.

.OUTPUTS
    System.String
    Returns the hash string.
#>
function Get-QuickHash {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    # Initialize before try block for StrictMode safety
    $sha256 = $null

    try {
        if ([string]::IsNullOrEmpty($Content)) {
            return ""
        }

        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
        $hashBytes = $sha256.ComputeHash($bytes)

        return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()

    } catch {
        Write-Verbose "Get-QuickHash failed: $($_.Exception.Message)"
        return ""
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
    }
}

#endregion

#region Export Functions

# Export public functions
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-AgentsMdCache',
        'Set-AgentsMdCache',
        'Clear-AgentsMdCache',
        'Get-FileHashesForCache'
    )
}

#endregion
