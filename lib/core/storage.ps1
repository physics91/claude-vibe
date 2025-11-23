#Requires -Version 5.1
<#
.SYNOPSIS
    Storage layer module for AGENTS Context Preserver plugin.

.DESCRIPTION
    Provides atomic file operations, backup management, and concurrency control
    for context state persistence. Implements fail-safe storage with automatic
    recovery capabilities.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
    Security: All writes are atomic, all content is filtered for sensitive data
#>

# Import security utilities
. "$PSScriptRoot\..\utils\security.ps1"

#region Custom Exceptions

class StorageException : System.Exception {
    [string]$Operation
    [string]$Path

    StorageException([string]$message) : base($message) {}

    StorageException([string]$message, [string]$operation, [string]$path) : base($message) {
        $this.Operation = $operation
        $this.Path = $path
    }
}

class LockException : System.Exception {
    [string]$ResourcePath
    [int]$TimeoutMs

    LockException([string]$message) : base($message) {}

    LockException([string]$message, [string]$resourcePath, [int]$timeoutMs) : base($message) {
        $this.ResourcePath = $resourcePath
        $this.TimeoutMs = $timeoutMs
    }
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Converts a PSCustomObject (from ConvertFrom-Json) to a Hashtable recursively.

.DESCRIPTION
    PowerShell 5.1 doesn't have ConvertFrom-Json -AsHashtable, so this function
    provides the same functionality for compatibility.
#>
function ConvertTo-HashtableRecursive {
    param(
        [Parameter(ValueFromPipeline)]
        $InputObject
    )

    process {
        if ($null -eq $InputObject) {
            return $null
        }

        # Handle IDictionary (including Hashtable) - must be before IEnumerable check
        if ($InputObject -is [System.Collections.IDictionary]) {
            $hash = @{}
            foreach ($key in $InputObject.Keys) {
                $hash[$key] = ConvertTo-HashtableRecursive $InputObject[$key]
            }
            return $hash
        }

        # Handle arrays and other enumerables (but not strings)
        if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
            $collection = @(
                foreach ($item in $InputObject) {
                    ConvertTo-HashtableRecursive $item
                }
            )
            return $collection
        }

        # Handle PSCustomObject (from ConvertFrom-Json)
        if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
            $hash = @{}
            foreach ($property in $InputObject.PSObject.Properties) {
                $hash[$property.Name] = ConvertTo-HashtableRecursive $property.Value
            }
            return $hash
        }

        # Return primitive values as-is
        return $InputObject
    }
}

#endregion

#region Write-AtomicFile

<#
.SYNOPSIS
    Low-level atomic write operation using temp file and rename.

.DESCRIPTION
    Writes content to a temporary file, verifies the write, then atomically
    renames to the target path. This ensures the target file is never in
    a partially written state.

.PARAMETER Path
    The target file path.

.PARAMETER Content
    The content to write.

.OUTPUTS
    System.Boolean
    Returns $true on success.

.EXAMPLE
    Write-AtomicFile -Path "C:\Data\context.json" -Content $jsonContent

.NOTES
    Uses atomic rename operation to prevent partial writes.
    Cleans up temp files on failure.
#>
function Write-AtomicFile {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    $tempPath = $null

    try {
        # Normalize path
        $normalizedPath = [System.IO.Path]::GetFullPath($Path)
        $directory = [System.IO.Path]::GetDirectoryName($normalizedPath)
        $fileName = [System.IO.Path]::GetFileName($normalizedPath)

        # Ensure directory exists
        if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
            New-Item -Path $directory -ItemType Directory -Force | Out-Null
            Write-Verbose "Created directory: $directory"
        }

        # Generate temp file path in same directory (for atomic rename)
        $tempFileName = ".tmp_$([guid]::NewGuid().ToString('N'))_$fileName"
        $tempPath = Join-Path -Path $directory -ChildPath $tempFileName

        # Write to temp file
        Write-Verbose "Writing to temp file: $tempPath"
        [System.IO.File]::WriteAllText($tempPath, $Content, [System.Text.Encoding]::UTF8)

        # Verify content was written correctly
        $writtenContent = [System.IO.File]::ReadAllText($tempPath, [System.Text.Encoding]::UTF8)
        if ($writtenContent -ne $Content) {
            throw [StorageException]::new(
                "Content verification failed after write",
                "Write-AtomicFile",
                $tempPath
            )
        }

        # Atomic replace (overwrites existing file atomically)
        Write-Verbose "Atomic replace: $tempPath -> $normalizedPath"

        if (Test-Path -LiteralPath $normalizedPath) {
            # Use File.Replace for truly atomic operation on Windows
            # This creates a backup and replaces in one atomic operation
            $backupForReplace = "$normalizedPath.replace_backup"
            try {
                [System.IO.File]::Replace($tempPath, $normalizedPath, $backupForReplace)
                # Clean up the backup created by Replace
                if (Test-Path -LiteralPath $backupForReplace) {
                    Remove-Item -LiteralPath $backupForReplace -Force -ErrorAction SilentlyContinue
                }
            } catch {
                # Fallback for edge cases where Replace fails
                Move-Item -LiteralPath $tempPath -Destination $normalizedPath -Force
            }
        } else {
            # No existing file, just move
            Move-Item -LiteralPath $tempPath -Destination $normalizedPath -Force
        }
        $tempPath = $null  # Mark as moved

        Write-Verbose "Atomic write completed: $normalizedPath"
        return $true

    } catch [StorageException] {
        throw
    } catch {
        throw [StorageException]::new(
            "Atomic write failed: $($_.Exception.Message)",
            "Write-AtomicFile",
            $Path
        )
    } finally {
        # Clean up temp file if it still exists
        if ($tempPath -and (Test-Path -LiteralPath $tempPath)) {
            Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
            Write-Verbose "Cleaned up temp file: $tempPath"
        }
    }
}

#endregion

#region Clear-OldBackups

<#
.SYNOPSIS
    Remove old backup files, keeping only the newest ones.

.DESCRIPTION
    Finds all backup files matching the pattern {BasePath}.backup.* and
    removes all but the MaxBackups newest files based on creation time.

.PARAMETER BasePath
    The base file path (without backup extension).

.PARAMETER MaxBackups
    Maximum number of backup files to retain.

.OUTPUTS
    System.Int32
    Returns the number of backups removed.

.EXAMPLE
    $removed = Clear-OldBackups -BasePath "C:\Data\context.json" -MaxBackups 3

.NOTES
    Backup files are expected to have the pattern: {filename}.backup.{timestamp}
#>
function Clear-OldBackups {
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [ValidateRange(0, 100)]
        [int]$MaxBackups
    )

    try {
        $normalizedPath = [System.IO.Path]::GetFullPath($BasePath)
        $directory = [System.IO.Path]::GetDirectoryName($normalizedPath)
        $fileName = [System.IO.Path]::GetFileName($normalizedPath)

        if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
            return 0
        }

        # Find all backup files
        $backupPattern = "$fileName.backup.*"
        $backups = Get-ChildItem -Path $directory -Filter $backupPattern -File |
                   Sort-Object -Property CreationTime -Descending

        $removedCount = 0

        if ($backups.Count -gt $MaxBackups) {
            # Remove oldest backups
            $toRemove = $backups | Select-Object -Skip $MaxBackups

            foreach ($backup in $toRemove) {
                try {
                    Remove-Item -LiteralPath $backup.FullName -Force
                    Write-Verbose "Removed old backup: $($backup.FullName)"
                    $removedCount++
                } catch {
                    Write-Warning "Failed to remove backup '$($backup.FullName)': $($_.Exception.Message)"
                }
            }
        }

        Write-Verbose "Cleaned up $removedCount old backup(s), kept $([Math]::Min($backups.Count, $MaxBackups))"
        return $removedCount

    } catch {
        Write-Warning "Failed to clean old backups for '$BasePath': $($_.Exception.Message)"
        return 0
    }
}

#endregion

#region Filter-HashtableValues

<#
.SYNOPSIS
    Recursively filters sensitive data from hashtable values.

.DESCRIPTION
    Creates a deep copy of a hashtable with sensitive string values redacted.
    This approach preserves valid data structures unlike string-based filtering.

.PARAMETER Data
    The data to filter (hashtable, array, or scalar).

.OUTPUTS
    The filtered data with sensitive values redacted.
#>
function Filter-HashtableValues {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Data
    )

    if ($null -eq $Data) {
        return $null
    }

    # Handle hashtables
    if ($Data -is [hashtable] -or $Data -is [System.Collections.IDictionary]) {
        $result = @{}
        foreach ($key in $Data.Keys) {
            $result[$key] = Filter-HashtableValues -Data $Data[$key]
        }
        return $result
    }

    # Handle arrays
    if ($Data -is [array]) {
        $result = @()
        foreach ($item in $Data) {
            $result += Filter-HashtableValues -Data $item
        }
        return $result
    }

    # Handle PSCustomObject
    if ($Data -is [PSCustomObject]) {
        $result = @{}
        foreach ($property in $Data.PSObject.Properties) {
            $result[$property.Name] = Filter-HashtableValues -Data $property.Value
        }
        return $result
    }

    # Handle strings - apply sensitive data filtering
    if ($Data -is [string]) {
        if (Test-SensitiveData -Content $Data) {
            return Remove-SensitiveData -Content $Data
        }
        return $Data
    }

    # Return other types as-is (numbers, booleans, etc.)
    return $Data
}

#endregion

#region Write-ContextState

<#
.SYNOPSIS
    Atomic write of context state with backup and security filtering.

.DESCRIPTION
    Writes context hashtable to storage with comprehensive safety measures:
    - Filters sensitive data before writing
    - Creates backup of existing file
    - Uses atomic write (temp file + rename)
    - Sets secure file permissions
    - Cleans old backups

.PARAMETER Context
    The context hashtable to persist.

.PARAMETER StoragePath
    The file path for storage.

.PARAMETER CreateBackup
    Whether to create a backup before overwriting. Default is $true.

.PARAMETER MaxBackups
    Maximum number of backup files to keep. Default is 3.

.OUTPUTS
    System.Boolean
    Returns $true on success.

.EXAMPLE
    $success = Write-ContextState -Context $context -StoragePath "C:\Data\context.json"

.EXAMPLE
    Write-ContextState -Context $context -StoragePath $path -CreateBackup $false

.NOTES
    All content is filtered for sensitive data before writing.
    Throws StorageException on failure.
#>
function Write-ContextState {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Context,

        [Parameter(Mandatory = $true)]
        [string]$StoragePath,

        [Parameter()]
        [bool]$CreateBackup = $true,

        [Parameter()]
        [ValidateRange(0, 100)]
        [int]$MaxBackups = 3
    )

    try {
        # Normalize path
        $normalizedPath = [System.IO.Path]::GetFullPath($StoragePath)
        $directory = [System.IO.Path]::GetDirectoryName($normalizedPath)

        Write-Verbose "Writing context state to: $normalizedPath"

        # Validate directory path is safe (not in blocked locations)
        # Note: We validate the directory exists and is accessible
        if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
            New-SecureDirectory -Path $directory -Force | Out-Null
            Write-Verbose "Created secure storage directory: $directory"
        }

        # Filter sensitive data from hashtable (preserves JSON structure)
        $filteredContext = Filter-HashtableValues -Data $Context

        # Convert filtered context to JSON (depth 5 to avoid hanging with complex objects)
        $filteredContent = $filteredContext | ConvertTo-Json -Depth 5 -Compress:$false

        Write-Verbose "Context filtered and serialized to JSON"

        # Create backup if file exists and backup is enabled
        if ($CreateBackup -and (Test-Path -LiteralPath $normalizedPath)) {
            $timestamp = [datetime]::UtcNow.ToString('yyyyMMddHHmmss')
            $backupPath = "$normalizedPath.backup.$timestamp"

            try {
                Copy-Item -LiteralPath $normalizedPath -Destination $backupPath -Force
                Write-Verbose "Created backup: $backupPath"

                # Set secure permissions on backup
                Set-SecureFilePermissions -Path $backupPath | Out-Null
            } catch {
                Write-Warning "Failed to create backup: $($_.Exception.Message)"
                # Continue with write even if backup fails
            }

            # Clean old backups
            Clear-OldBackups -BasePath $normalizedPath -MaxBackups $MaxBackups | Out-Null
        }

        # Atomic write
        Write-AtomicFile -Path $normalizedPath -Content $filteredContent | Out-Null

        # Set secure permissions
        Set-SecureFilePermissions -Path $normalizedPath | Out-Null

        Write-Verbose "Context state written successfully"
        return $true

    } catch [StorageException] {
        throw
    } catch {
        throw [StorageException]::new(
            "Failed to write context state: $($_.Exception.Message)",
            "Write-ContextState",
            $StoragePath
        )
    }
}

#endregion

#region Read-ContextState

<#
.SYNOPSIS
    Load context state with automatic recovery from backups.

.DESCRIPTION
    Attempts to read context state from storage. On failure, can automatically
    recover from backup files. Validates the loaded data structure.

.PARAMETER StoragePath
    The file path to read from.

.PARAMETER RecoverFromBackup
    Whether to attempt recovery from backups on read failure. Default is $true.

.OUTPUTS
    System.Collections.Hashtable or $null
    Returns the context hashtable on success, $null if file doesn't exist.

.EXAMPLE
    $context = Read-ContextState -StoragePath "C:\Data\context.json"

.EXAMPLE
    $context = Read-ContextState -StoragePath $path -RecoverFromBackup $false

.NOTES
    Returns $null if file doesn't exist (not an error).
    Throws StorageException if file exists but cannot be read.
#>
function Read-ContextState {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StoragePath,

        [Parameter()]
        [bool]$RecoverFromBackup = $true
    )

    try {
        # Normalize path
        $normalizedPath = [System.IO.Path]::GetFullPath($StoragePath)

        Write-Verbose "Reading context state from: $normalizedPath"

        # Check if main file exists
        if (-not (Test-Path -LiteralPath $normalizedPath -PathType Leaf)) {
            Write-Verbose "Context file does not exist: $normalizedPath"
            return $null
        }

        # Try reading main file
        $loadError = $null
        try {
            $content = [System.IO.File]::ReadAllText($normalizedPath, [System.Text.Encoding]::UTF8)
            $context = $content | ConvertFrom-Json | ConvertTo-HashtableRecursive

            if ($null -eq $context) {
                throw [StorageException]::new("JSON parsed to null", "Read-ContextState", $normalizedPath)
            }

            Write-Verbose "Context state loaded successfully"
            return $context

        } catch {
            $loadError = $_
            Write-Warning "Failed to load main context file: $($_.Exception.Message)"
        }

        # Attempt recovery from backups if enabled
        if ($RecoverFromBackup) {
            Write-Verbose "Attempting recovery from backups..."

            $directory = [System.IO.Path]::GetDirectoryName($normalizedPath)
            $fileName = [System.IO.Path]::GetFileName($normalizedPath)
            $backupPattern = "$fileName.backup.*"

            # Get backups sorted by creation time (newest first)
            $backups = Get-ChildItem -Path $directory -Filter $backupPattern -File -ErrorAction SilentlyContinue |
                       Sort-Object -Property CreationTime -Descending

            foreach ($backup in $backups) {
                try {
                    Write-Verbose "Trying backup: $($backup.FullName)"
                    $content = [System.IO.File]::ReadAllText($backup.FullName, [System.Text.Encoding]::UTF8)
                    $context = $content | ConvertFrom-Json | ConvertTo-HashtableRecursive

                    if ($null -ne $context) {
                        Write-Warning "Recovered context from backup: $($backup.Name)"

                        # Restore main file from backup
                        Copy-Item -LiteralPath $backup.FullName -Destination $normalizedPath -Force
                        Set-SecureFilePermissions -Path $normalizedPath | Out-Null

                        return $context
                    }
                } catch {
                    Write-Verbose "Backup recovery failed for '$($backup.Name)': $($_.Exception.Message)"
                    continue
                }
            }

            Write-Warning "All backup recovery attempts failed"
        }

        # If we get here, main file failed and no backups could recover
        if ($loadError) {
            throw [StorageException]::new(
                "Failed to load context state and recovery failed: $($loadError.Exception.Message)",
                "Read-ContextState",
                $normalizedPath
            )
        }

        return $null

    } catch [StorageException] {
        throw
    } catch {
        throw [StorageException]::new(
            "Failed to read context state: $($_.Exception.Message)",
            "Read-ContextState",
            $StoragePath
        )
    }
}

#endregion

#region New-FileLock

<#
.SYNOPSIS
    Create a file lock for concurrency control.

.DESCRIPTION
    Creates a lock file containing the current process ID and timestamp.
    Waits and retries if the resource is already locked. Automatically
    cleans stale locks older than 60 seconds.

.PARAMETER ResourcePath
    The path of the resource to lock.

.PARAMETER TimeoutMs
    Maximum time to wait for lock acquisition in milliseconds. Default is 5000.

.PARAMETER RetryIntervalMs
    Time between retry attempts in milliseconds. Default is 100.

.OUTPUTS
    System.String
    Returns the lock file path on success.

.EXAMPLE
    $lockPath = New-FileLock -ResourcePath "C:\Data\context.json"
    try {
        # Do work
    } finally {
        Remove-FileLock -LockPath $lockPath
    }

.NOTES
    Throws LockException if lock cannot be acquired within timeout.
    Stale locks (>60s) are automatically cleaned.
#>
function New-FileLock {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResourcePath,

        [Parameter()]
        [ValidateRange(0, 600000)]
        [int]$TimeoutMs = 5000,

        [Parameter()]
        [ValidateRange(10, 10000)]
        [int]$RetryIntervalMs = 100
    )

    $normalizedPath = [System.IO.Path]::GetFullPath($ResourcePath)
    $lockPath = "$normalizedPath.lock"
    $staleLockThresholdSeconds = 60

    $startTime = [datetime]::UtcNow
    $processId = $PID
    $hostname = $env:COMPUTERNAME

    Write-Verbose "Acquiring lock for: $normalizedPath"

    while ($true) {
        # Check timeout
        $elapsed = ([datetime]::UtcNow - $startTime).TotalMilliseconds
        if ($elapsed -ge $TimeoutMs) {
            throw [LockException]::new(
                "Failed to acquire lock within $TimeoutMs ms",
                $ResourcePath,
                $TimeoutMs
            )
        }

        # Check for existing lock
        if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
            try {
                # Read lock info
                $lockInfo = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json

                # Check if lock is stale
                $lockTime = [datetime]::Parse($lockInfo.timestamp).ToUniversalTime()
                $lockAge = ([datetime]::UtcNow - $lockTime).TotalSeconds

                if ($lockAge -gt $staleLockThresholdSeconds) {
                    Write-Verbose "Removing stale lock (age: $([int]$lockAge)s, PID: $($lockInfo.pid))"
                    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
                } else {
                    # Lock is still valid
                    Write-Verbose "Resource locked by PID $($lockInfo.pid), waiting..."
                    Start-Sleep -Milliseconds $RetryIntervalMs
                    continue
                }
            } catch {
                # Corrupted lock file - remove it
                Write-Verbose "Removing corrupted lock file: $lockPath"
                Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
            }
        }

        # Try to create lock
        try {
            $lockContent = @{
                pid = $processId
                hostname = $hostname
                timestamp = [datetime]::UtcNow.ToString('o')
                resource = $normalizedPath
            } | ConvertTo-Json -Compress

            # Use exclusive file access to create lock atomically
            $fileStream = [System.IO.File]::Open(
                $lockPath,
                [System.IO.FileMode]::CreateNew,
                [System.IO.FileAccess]::Write,
                [System.IO.FileShare]::None
            )

            try {
                $writer = [System.IO.StreamWriter]::new($fileStream, [System.Text.Encoding]::UTF8)
                $writer.Write($lockContent)
                $writer.Flush()
            } finally {
                $fileStream.Close()
            }

            Write-Verbose "Lock acquired: $lockPath"
            return $lockPath

        } catch [System.IO.IOException] {
            # File already exists (race condition) - retry
            Write-Verbose "Lock creation race, retrying..."
            Start-Sleep -Milliseconds $RetryIntervalMs
            continue
        } catch {
            throw [LockException]::new(
                "Failed to create lock: $($_.Exception.Message)",
                $ResourcePath,
                $TimeoutMs
            )
        }
    }
}

#endregion

#region Remove-FileLock

<#
.SYNOPSIS
    Release a file lock.

.DESCRIPTION
    Removes the lock file to release the lock on a resource.

.PARAMETER LockPath
    The path to the lock file.

.OUTPUTS
    System.Boolean
    Returns $true if lock was removed, $false if it didn't exist.

.EXAMPLE
    Remove-FileLock -LockPath "C:\Data\context.json.lock"

.NOTES
    Does not throw if lock file doesn't exist.
#>
function Remove-FileLock {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LockPath
    )

    try {
        if (Test-Path -LiteralPath $LockPath -PathType Leaf) {
            Remove-Item -LiteralPath $LockPath -Force
            Write-Verbose "Lock released: $LockPath"
            return $true
        } else {
            Write-Verbose "Lock file not found: $LockPath"
            return $false
        }
    } catch {
        Write-Warning "Failed to remove lock '$LockPath': $($_.Exception.Message)"
        return $false
    }
}

#endregion

#region Invoke-WithLock

<#
.SYNOPSIS
    Execute an operation with exclusive lock on a resource.

.DESCRIPTION
    Acquires a lock, executes the provided script block, then releases
    the lock. Ensures lock is released even if the operation throws.

.PARAMETER ResourcePath
    The path of the resource to lock.

.PARAMETER Operation
    The script block to execute while holding the lock.

.PARAMETER TimeoutMs
    Maximum time to wait for lock acquisition in milliseconds. Default is 5000.

.OUTPUTS
    The output of the Operation script block.

.EXAMPLE
    $result = Invoke-WithLock -ResourcePath $contextPath -Operation {
        $context = Read-ContextState -StoragePath $contextPath
        $context.data.count++
        Write-ContextState -Context $context -StoragePath $contextPath
        return $context.data.count
    }

.NOTES
    Always releases lock, even on error. Re-throws operation errors.
#>
function Invoke-WithLock {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResourcePath,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Operation,

        [Parameter()]
        [ValidateRange(0, 600000)]
        [int]$TimeoutMs = 5000
    )

    $lockPath = $null
    $operationError = $null

    try {
        # Acquire lock
        $lockPath = New-FileLock -ResourcePath $ResourcePath -TimeoutMs $TimeoutMs

        # Execute operation
        try {
            $result = & $Operation
            return $result
        } catch {
            $operationError = $_
            throw
        }

    } finally {
        # Always release lock
        if ($lockPath) {
            Remove-FileLock -LockPath $lockPath | Out-Null
        }
    }
}

#endregion

#region Get-StorageMetrics

<#
.SYNOPSIS
    Get storage usage metrics for a directory.

.DESCRIPTION
    Calculates storage metrics including total bytes, file count, and
    backup count for a storage directory.

.PARAMETER StorageDir
    The storage directory to analyze.

.OUTPUTS
    System.Collections.Hashtable
    Returns hashtable with total_bytes, file_count, backup_count, and details.

.EXAMPLE
    $metrics = Get-StorageMetrics -StorageDir "C:\Data\ContextPreserver"
    Write-Host "Total size: $($metrics.total_bytes) bytes"
    Write-Host "Files: $($metrics.file_count)"
    Write-Host "Backups: $($metrics.backup_count)"

.NOTES
    Returns zeros if directory doesn't exist.
#>
function Get-StorageMetrics {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StorageDir
    )

    try {
        $normalizedPath = [System.IO.Path]::GetFullPath($StorageDir)

        if (-not (Test-Path -LiteralPath $normalizedPath -PathType Container)) {
            Write-Verbose "Storage directory does not exist: $normalizedPath"
            return @{
                total_bytes = 0
                file_count = 0
                backup_count = 0
                lock_count = 0
                details = @{
                    directory = $normalizedPath
                    exists = $false
                }
            }
        }

        # Get all files recursively
        $allFiles = Get-ChildItem -Path $normalizedPath -File -Recurse -ErrorAction SilentlyContinue

        $totalBytes = 0
        $backupCount = 0
        $lockCount = 0
        $contextFiles = @()

        foreach ($file in $allFiles) {
            $totalBytes += $file.Length

            if ($file.Name -match '\.backup\.\d+$') {
                $backupCount++
            } elseif ($file.Name -match '\.lock$') {
                $lockCount++
            } elseif ($file.Extension -eq '.json') {
                $contextFiles += @{
                    name = $file.Name
                    size = $file.Length
                    modified = $file.LastWriteTimeUtc
                }
            }
        }

        $metrics = @{
            total_bytes = $totalBytes
            file_count = $allFiles.Count
            backup_count = $backupCount
            lock_count = $lockCount
            details = @{
                directory = $normalizedPath
                exists = $true
                context_files = $contextFiles
                formatted_size = Format-ByteSize -Bytes $totalBytes
            }
        }

        Write-Verbose "Storage metrics: $($metrics.file_count) files, $($metrics.details.formatted_size)"
        return $metrics

    } catch {
        Write-Warning "Failed to get storage metrics for '$StorageDir': $($_.Exception.Message)"
        return @{
            total_bytes = 0
            file_count = 0
            backup_count = 0
            lock_count = 0
            details = @{
                directory = $StorageDir
                exists = $false
                error = $_.Exception.Message
            }
        }
    }
}

#endregion

#region Context Path Helper

<#
.SYNOPSIS
    Get the standardized storage path for a context file.

.DESCRIPTION
    Computes the storage path for context files based on configuration.
    This function provides a single source of truth for context file paths
    across all hooks and storage operations.

.PARAMETER StorageDir
    The base storage directory (from config).

.PARAMETER SessionId
    The session ID to use in the filename.

.OUTPUTS
    System.String
    Returns the full path to the context file.

.EXAMPLE
    $path = Get-ContextFilePath -StorageDir $config.storage_dir -SessionId $sessionId

.NOTES
    Both PreCompact and SessionStart hooks should use this function
    to ensure consistent path computation.
#>
function Get-ContextFilePath {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$StorageDir,

        [Parameter(Mandatory = $true)]
        [string]$SessionId
    )

    # Normalize storage directory
    $normalizedDir = [System.IO.Path]::GetFullPath($StorageDir)

    # Generate consistent filename
    $contextFileName = "context_$($SessionId).json"

    return Join-Path -Path $normalizedDir -ChildPath $contextFileName
}

<#
.SYNOPSIS
    Get the default storage directory for context files.

.DESCRIPTION
    Returns the default storage directory path for context persistence.
    This can be overridden by configuration.

.OUTPUTS
    System.String
    Returns the default storage directory path.

.EXAMPLE
    $defaultDir = Get-DefaultStorageDir
#>
function Get-DefaultStorageDir {
    [CmdletBinding()]
    [OutputType([string])]
    param()

    return Join-Path $env:USERPROFILE ".claude\context-plugin\contexts"
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Format byte count to human-readable string.

.DESCRIPTION
    Converts bytes to appropriate unit (B, KB, MB, GB).

.PARAMETER Bytes
    The byte count to format.

.OUTPUTS
    System.String
    Formatted size string.
#>
function Format-ByteSize {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [long]$Bytes
    )

    if ($Bytes -lt 1KB) {
        return "$Bytes B"
    } elseif ($Bytes -lt 1MB) {
        return "{0:N2} KB" -f ($Bytes / 1KB)
    } elseif ($Bytes -lt 1GB) {
        return "{0:N2} MB" -f ($Bytes / 1MB)
    } else {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    }
}

<#
.SYNOPSIS
    Test if a context file is valid and readable.

.DESCRIPTION
    Attempts to read and parse a context file without modifying it.

.PARAMETER Path
    The path to the context file.

.OUTPUTS
    System.Boolean
    Returns $true if file is valid.
#>
function Test-ContextFile {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            return $false
        }

        $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        $parsed = $content | ConvertFrom-Json | ConvertTo-HashtableRecursive

        return ($null -ne $parsed)
    } catch {
        return $false
    }
}

<#
.SYNOPSIS
    Get list of all backup files for a context file.

.DESCRIPTION
    Returns all backup files for a given context file path, sorted by
    creation time (newest first).

.PARAMETER ContextPath
    The path to the main context file.

.OUTPUTS
    System.IO.FileInfo[]
    Array of backup file info objects.
#>
function Get-ContextBackups {
    [CmdletBinding()]
    [OutputType([System.IO.FileInfo[]])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContextPath
    )

    try {
        $normalizedPath = [System.IO.Path]::GetFullPath($ContextPath)
        $directory = [System.IO.Path]::GetDirectoryName($normalizedPath)
        $fileName = [System.IO.Path]::GetFileName($normalizedPath)

        if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
            return @()
        }

        $backupPattern = "$fileName.backup.*"
        $backups = Get-ChildItem -Path $directory -Filter $backupPattern -File |
                   Sort-Object -Property CreationTime -Descending

        return $backups
    } catch {
        Write-Warning "Failed to get backups for '$ContextPath': $($_.Exception.Message)"
        return @()
    }
}

<#
.SYNOPSIS
    Restore context from a specific backup file.

.DESCRIPTION
    Copies a backup file to replace the main context file.

.PARAMETER BackupPath
    The path to the backup file.

.PARAMETER TargetPath
    The path to the target context file.

.OUTPUTS
    System.Boolean
    Returns $true on success.
#>
function Restore-ContextFromBackup {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupPath,

        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    try {
        if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
            throw [StorageException]::new("Backup file not found", "Restore", $BackupPath)
        }

        # Validate backup is readable
        if (-not (Test-ContextFile -Path $BackupPath)) {
            throw [StorageException]::new("Backup file is corrupted", "Restore", $BackupPath)
        }

        # Copy backup to target
        Copy-Item -LiteralPath $BackupPath -Destination $TargetPath -Force
        Set-SecureFilePermissions -Path $TargetPath | Out-Null

        Write-Verbose "Restored context from: $BackupPath"
        return $true

    } catch [StorageException] {
        throw
    } catch {
        throw [StorageException]::new(
            "Failed to restore from backup: $($_.Exception.Message)",
            "Restore-ContextFromBackup",
            $BackupPath
        )
    }
}

#endregion

#region Module Export

# Export public functions (only when loaded as a module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Write-ContextState',
        'Read-ContextState',
        'New-FileLock',
        'Remove-FileLock',
        'Invoke-WithLock',
        'Write-AtomicFile',
        'Get-StorageMetrics',
        'Clear-OldBackups',
        'Test-ContextFile',
        'Get-ContextBackups',
        'Restore-ContextFromBackup',
        'Format-ByteSize',
        'Get-ContextFilePath',
        'Get-DefaultStorageDir',
        'Filter-HashtableValues'
    )
}

#endregion
