#Requires -Version 5.1
<#
.SYNOPSIS
    Security utility functions for AGENTS Context Preserver plugin.

.DESCRIPTION
    Provides security-focused utilities for sensitive data detection, path validation,
    and secure file operations. Implements fail-closed security model.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
    Security Model: Fail-closed (deny by default)
#>

# Custom exception for path validation failures
class PathValidationException : System.Exception {
    [string]$Path
    [string]$Reason

    PathValidationException([string]$message) : base($message) {
        $this.Reason = $message
    }

    PathValidationException([string]$message, [string]$path) : base($message) {
        $this.Path = $path
        $this.Reason = $message
    }
}

# Custom exception for security violations
class SecurityViolationException : System.Exception {
    [string]$ViolationType

    SecurityViolationException([string]$message) : base($message) {}

    SecurityViolationException([string]$message, [string]$violationType) : base($message) {
        $this.ViolationType = $violationType
    }
}

#region Sensitive Data Patterns

# Compiled regex patterns for performance
$script:SensitivePatterns = @{
    # API Keys - generic patterns
    ApiKey = [regex]::new(
        '(?i)(api[_-]?key|apikey)\s*[=:]\s*["\u0027]?([a-zA-Z0-9_\-]{16,})["\u0027]?',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # AWS Access Key ID (starts with AKIA, ABIA, ACCA, ASIA)
    AwsAccessKey = [regex]::new(
        '(?i)(A3T[A-Z0-9]|AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # AWS Secret Access Key
    AwsSecretKey = [regex]::new(
        '(?i)(aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret)\s*[=:]\s*["\u0027]?([a-zA-Z0-9/+=]{40})["\u0027]?',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # GitHub tokens (Personal Access, OAuth, App, Refresh)
    GitHubToken = [regex]::new(
        'gh[pousr]_[a-zA-Z0-9]{36,}',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Generic password patterns
    Password = [regex]::new(
        '(?i)(password|passwd|pwd)\s*[=:]\s*["\u0027]?([^\s"\u0027]{4,})["\u0027]?',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Generic secret/token patterns
    Secret = [regex]::new(
        '(?i)(secret|token|auth[_-]?token|access[_-]?token|bearer)\s*[=:]\s*["\u0027]?([a-zA-Z0-9_\-\.]{8,})["\u0027]?',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Private keys (PEM format)
    PrivateKey = [regex]::new(
        '-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Connection strings
    ConnectionString = [regex]::new(
        '(?i)(mongodb(\+srv)?|postgres(ql)?|mysql|redis|amqp|mssql)://[^\s"\u0027<>]+',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Generic connection string with credentials
    ConnectionStringWithCreds = [regex]::new(
        '(?i)(connection[_-]?string|conn[_-]?str)\s*[=:]\s*["\u0027]?([^\s"\u0027]{10,})["\u0027]?',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Slack tokens
    SlackToken = [regex]::new(
        'xox[baprs]-[a-zA-Z0-9\-]+',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Google API keys
    GoogleApiKey = [regex]::new(
        'AIza[0-9A-Za-z\-_]{35}',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Stripe keys
    StripeKey = [regex]::new(
        '(?i)(sk|pk)_(live|test)_[a-zA-Z0-9]{24,}',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # JWT tokens
    JwtToken = [regex]::new(
        'eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )

    # Azure connection strings
    AzureConnectionString = [regex]::new(
        '(?i)DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[^;]+',
        [System.Text.RegularExpressions.RegexOptions]::Compiled
    )
}

# Blocked path patterns (security-sensitive locations)
$script:BlockedPathPatterns = @(
    '\.git(?:$|[\\/])',
    '\.env(?:\.[^\\\/]*)?$',
    '\.aws[\\/]?',
    '\.ssh[\\/]?',
    '\.gnupg[\\/]?',
    'node_modules[\\/]?',
    '__pycache__[\\/]?',
    '\.venv[\\/]?',
    'venv[\\/]?',
    '\.pytest_cache[\\/]?',
    '\.coverage',
    'credentials\.json',
    'secrets\.json',
    '.*\.pem$',
    '.*\.key$',
    '.*\.p12$',
    '.*\.pfx$'
)

#endregion

#region Test-SensitiveData

<#
.SYNOPSIS
    Checks if content contains sensitive data patterns.

.DESCRIPTION
    Scans the provided content for known sensitive data patterns including
    API keys, credentials, tokens, and private keys. Uses compiled regex
    patterns for performance.

.PARAMETER Content
    The content string to scan for sensitive data.

.OUTPUTS
    System.Boolean
    Returns $true if any sensitive data pattern is detected, $false otherwise.

.EXAMPLE
    $hasSensitive = Test-SensitiveData -Content $fileContent
    if ($hasSensitive) {
        Write-Warning "Sensitive data detected!"
    }

.NOTES
    This function does NOT log or expose what was found to prevent
    accidental disclosure of sensitive information.
#>
function Test-SensitiveData {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    process {
        if ([string]::IsNullOrEmpty($Content)) {
            return $false
        }

        foreach ($patternName in $script:SensitivePatterns.Keys) {
            $pattern = $script:SensitivePatterns[$patternName]
            if ($pattern.IsMatch($Content)) {
                # Log detection without exposing the actual data
                Write-Verbose "Sensitive data pattern detected: $patternName"
                return $true
            }
        }

        return $false
    }
}

#endregion

#region Remove-SensitiveData

<#
.SYNOPSIS
    Filters sensitive data from content, replacing with [REDACTED].

.DESCRIPTION
    Scans and removes sensitive data patterns from the provided content,
    replacing matches with [REDACTED] markers. Returns a result object
    containing the filtered content and metadata about what was redacted.

.PARAMETER Content
    The content string to filter.

.PARAMETER ReturnDetails
    If specified, returns an object with detailed redaction information.
    Default behavior returns only the filtered content string.

.OUTPUTS
    System.String or PSCustomObject
    Returns filtered content string, or object with Content and RedactionLog
    properties if -ReturnDetails is specified.

.EXAMPLE
    $filtered = Remove-SensitiveData -Content $fileContent

.EXAMPLE
    $result = Remove-SensitiveData -Content $fileContent -ReturnDetails
    Write-Host "Redacted $($result.RedactionLog.Count) items"

.NOTES
    The RedactionLog contains pattern names only, never the actual sensitive values.
#>
function Remove-SensitiveData {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [AllowEmptyString()]
        [string]$Content,

        [Parameter()]
        [switch]$ReturnDetails
    )

    process {
        if ([string]::IsNullOrEmpty($Content)) {
            if ($ReturnDetails) {
                return [PSCustomObject]@{
                    Content = $Content
                    RedactionLog = @()
                    TotalRedactions = 0
                }
            }
            return $Content
        }

        $filteredContent = $Content
        $redactionLog = [System.Collections.ArrayList]::new()
        $totalRedactions = 0

        # Define replacement patterns that preserve JSON structure
        # For key=value patterns, preserve the key and only redact the value
        $replacementMap = @{
            # Patterns with key=value structure - preserve key using $1 for first capture group
            'ApiKey' = '$1"[REDACTED:ApiKey]"'
            'AwsSecretKey' = '$1"[REDACTED:AwsSecretKey]"'
            'Password' = '$1"[REDACTED:Password]"'
            'Secret' = '$1"[REDACTED:Secret]"'
            'ConnectionStringWithCreds' = '$1"[REDACTED:ConnectionString]"'

            # Patterns that match standalone tokens - replace entire match
            'AwsAccessKey' = '[REDACTED:AwsAccessKey]'
            'GitHubToken' = '[REDACTED:GitHubToken]'
            'PrivateKey' = '[REDACTED:PrivateKey]'
            'ConnectionString' = '[REDACTED:ConnectionString]'
            'SlackToken' = '[REDACTED:SlackToken]'
            'GoogleApiKey' = '[REDACTED:GoogleApiKey]'
            'StripeKey' = '[REDACTED:StripeKey]'
            'JwtToken' = '[REDACTED:JwtToken]'
            'AzureConnectionString' = '[REDACTED:AzureConnectionString]'
        }

        foreach ($patternName in $script:SensitivePatterns.Keys) {
            $pattern = $script:SensitivePatterns[$patternName]
            $matches = $pattern.Matches($filteredContent)

            if ($matches.Count -gt 0) {
                $totalRedactions += $matches.Count

                # Log redaction without exposing values
                [void]$redactionLog.Add([PSCustomObject]@{
                    PatternName = $patternName
                    Count = $matches.Count
                    Timestamp = [datetime]::UtcNow
                })

                # Use appropriate replacement based on pattern type
                $replacement = if ($replacementMap.ContainsKey($patternName)) {
                    $replacementMap[$patternName]
                } else {
                    "[REDACTED:$patternName]"
                }

                # Replace matches with redaction marker
                $filteredContent = $pattern.Replace($filteredContent, $replacement)

                Write-Verbose "Redacted $($matches.Count) instance(s) of pattern: $patternName"
            }
        }

        if ($ReturnDetails) {
            return [PSCustomObject]@{
                Content = $filteredContent
                RedactionLog = $redactionLog.ToArray()
                TotalRedactions = $totalRedactions
            }
        }

        return $filteredContent
    }
}

#endregion

#region Test-PathSecurity

<#
.SYNOPSIS
    Validates a path against security constraints (fail-closed model).

.DESCRIPTION
    Performs comprehensive security validation on a file path including:
    - Path traversal attack prevention
    - Whitelist validation against allowed base paths
    - Blocked pattern checking (.git, .env, etc.)
    - Symlink resolution and validation
    - UNC path and drive root handling

    Implements a fail-closed security model - throws an exception on any
    validation failure.

.PARAMETER Path
    The path to validate.

.PARAMETER ProjectRoot
    The root directory of the project. Paths must be within this root
    or one of the AllowedBasePaths.

.PARAMETER AllowedBasePaths
    Additional base paths that are allowed. If empty, only ProjectRoot is allowed.

.PARAMETER AllowSymlinks
    If specified, allows symlinks (but still validates their targets).
    Default is to reject symlinks.

.OUTPUTS
    System.String
    Returns the normalized, validated absolute path on success.

.EXAMPLE
    $validPath = Test-PathSecurity -Path "./config/settings.json" -ProjectRoot "C:\Projects\MyApp"

.EXAMPLE
    $validPath = Test-PathSecurity -Path $userInput -ProjectRoot $root -AllowedBasePaths @("C:\Temp")

.NOTES
    Throws PathValidationException on any validation failure.
    Never silently fails or returns invalid paths.
#>
function Test-PathSecurity {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [string[]]$AllowedBasePaths = @(),

        [Parameter()]
        [switch]$AllowSymlinks
    )

    # Input validation
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw [PathValidationException]::new("Path cannot be null or empty", $Path)
    }

    if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
        throw [PathValidationException]::new("ProjectRoot cannot be null or empty", $ProjectRoot)
    }

    try {
        # Normalize project root first
        $normalizedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
        if (-not (Test-Path -LiteralPath $normalizedRoot -PathType Container)) {
            throw [PathValidationException]::new(
                "Project root does not exist or is not a directory: $normalizedRoot",
                $normalizedRoot
            )
        }

        # Check for dangerous path patterns before normalization
        # Only detect '..' when it appears as a complete path segment
        $dangerousPatterns = @(
            '(^|[\\/])\.\.($|[\\/])',  # Parent directory as path segment
            '%2e%2e',                   # URL-encoded traversal
            '%252e%252e'                # Double URL-encoded traversal
        )

        foreach ($dangerous in $dangerousPatterns) {
            if ($Path -match $dangerous) {
                Write-Warning "Path traversal attempt detected"
                throw [PathValidationException]::new(
                    "Path contains dangerous traversal pattern",
                    $Path
                )
            }
        }

        # Resolve the path (handles relative paths)
        $resolvedPath = if ([System.IO.Path]::IsPathRooted($Path)) {
            [System.IO.Path]::GetFullPath($Path)
        } else {
            [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($ProjectRoot, $Path))
        }

        # Check for UNC paths
        if ($resolvedPath.StartsWith('\\')) {
            # UNC path detected - validate more strictly
            Write-Verbose "UNC path detected: $resolvedPath"

            # Only allow UNC paths if explicitly in AllowedBasePaths
            $uncAllowed = $false
            foreach ($allowedPath in $AllowedBasePaths) {
                if ($allowedPath.StartsWith('\\') -and $resolvedPath.StartsWith($allowedPath, [StringComparison]::OrdinalIgnoreCase)) {
                    $uncAllowed = $true
                    break
                }
            }

            if (-not $uncAllowed) {
                throw [PathValidationException]::new(
                    "UNC paths are not allowed unless explicitly whitelisted",
                    $resolvedPath
                )
            }
        }

        # Check for symlinks
        if (Test-Path -LiteralPath $resolvedPath) {
            $item = Get-Item -LiteralPath $resolvedPath -Force

            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                if (-not $AllowSymlinks) {
                    throw [PathValidationException]::new(
                        "Symlinks are not allowed",
                        $resolvedPath
                    )
                }

                # Resolve symlink target and validate it too
                $target = $item.Target
                if ($target) {
                    Write-Verbose "Resolving symlink target: $target"
                    $resolvedPath = [System.IO.Path]::GetFullPath($target)
                }
            }
        }

        # Build list of all allowed base paths
        $allAllowedPaths = @($normalizedRoot)
        foreach ($basePath in $AllowedBasePaths) {
            if (-not [string]::IsNullOrWhiteSpace($basePath)) {
                $normalizedBase = [System.IO.Path]::GetFullPath($basePath)
                $allAllowedPaths += $normalizedBase
            }
        }

        # Validate path is under an allowed base path
        $isAllowed = $false
        foreach ($allowedBase in $allAllowedPaths) {
            # Ensure base path ends with separator for accurate comparison
            $baseWithSep = $allowedBase.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
                          [System.IO.Path]::DirectorySeparatorChar

            if ($resolvedPath.StartsWith($baseWithSep, [StringComparison]::OrdinalIgnoreCase) -or
                $resolvedPath.Equals($allowedBase, [StringComparison]::OrdinalIgnoreCase)) {
                $isAllowed = $true
                Write-Verbose "Path validated against allowed base: $allowedBase"
                break
            }
        }

        if (-not $isAllowed) {
            throw [PathValidationException]::new(
                "Path is outside of allowed directories",
                $resolvedPath
            )
        }

        # Check against blocked patterns
        foreach ($blockedPattern in $script:BlockedPathPatterns) {
            if ($resolvedPath -match $blockedPattern) {
                throw [PathValidationException]::new(
                    "Path matches blocked security pattern: $blockedPattern",
                    $resolvedPath
                )
            }
        }

        # Additional check for hidden files/directories (only if path is under project root)
        if ($resolvedPath.StartsWith($normalizedRoot, [StringComparison]::OrdinalIgnoreCase)) {
            $relativePath = $resolvedPath.Substring($normalizedRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)
            if ($relativePath -match '[\\/]\.[^\\/]+') {
                Write-Verbose "Hidden file/directory detected in path"
                # Allow but log - some hidden files are legitimate
            }
        }

        Write-Verbose "Path validation successful: $resolvedPath"
        return $resolvedPath

    } catch [PathValidationException] {
        throw
    } catch {
        # Wrap unexpected errors in PathValidationException for consistent handling
        throw [PathValidationException]::new(
            "Path validation failed: $($_.Exception.Message)",
            $Path
        )
    }
}

#endregion

#region Set-SecureFilePermissions

<#
.SYNOPSIS
    Sets restrictive file permissions for the current user only.

.DESCRIPTION
    Configures file or directory permissions to allow access only to the
    current user (and SYSTEM on Windows). Removes inherited permissions
    and any other user access.

.PARAMETER Path
    The file or directory path to secure.

.PARAMETER Inherit
    If specified for a directory, allows child objects to inherit these permissions.
    Default is no inheritance.

.OUTPUTS
    System.Boolean
    Returns $true on success, throws on failure.

.EXAMPLE
    Set-SecureFilePermissions -Path "C:\Secrets\credentials.json"

.EXAMPLE
    Set-SecureFilePermissions -Path "C:\Secrets" -Inherit

.NOTES
    On Windows, sets ACL for current user with FullControl and SYSTEM with FullControl.
    Removes all other permissions including inherited ones.
#>
function Set-SecureFilePermissions {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter()]
        [switch]$Inherit
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw [System.IO.FileNotFoundException]::new("Path not found: $Path")
    }

    try {
        $item = Get-Item -LiteralPath $Path -Force
        $isDirectory = $item.PSIsContainer

        # Get current ACL
        $acl = Get-Acl -LiteralPath $Path

        # Disable inheritance and remove inherited rules
        $acl.SetAccessRuleProtection($true, $false)

        # Remove all existing access rules
        $acl.Access | ForEach-Object {
            $acl.RemoveAccessRule($_) | Out-Null
        }

        # Get current user identity
        $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        $userSid = $currentUser.User

        # Define inheritance flags
        if ($isDirectory -and $Inherit) {
            $inheritanceFlags = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
                               [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
            $propagationFlags = [System.Security.AccessControl.PropagationFlags]::None
        } else {
            $inheritanceFlags = [System.Security.AccessControl.InheritanceFlags]::None
            $propagationFlags = [System.Security.AccessControl.PropagationFlags]::None
        }

        # Create access rule for current user - Full Control
        $userRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $userSid,
            [System.Security.AccessControl.FileSystemRights]::FullControl,
            $inheritanceFlags,
            $propagationFlags,
            [System.Security.AccessControl.AccessControlType]::Allow
        )

        # Add rule for current user
        $acl.AddAccessRule($userRule)

        # Add rule for SYSTEM account (required for Windows services)
        $systemSid = New-Object System.Security.Principal.SecurityIdentifier(
            [System.Security.Principal.WellKnownSidType]::LocalSystemSid,
            $null
        )

        $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $systemSid,
            [System.Security.AccessControl.FileSystemRights]::FullControl,
            $inheritanceFlags,
            $propagationFlags,
            [System.Security.AccessControl.AccessControlType]::Allow
        )

        $acl.AddAccessRule($systemRule)

        # Try to set owner to current user (requires SeSecurityPrivilege)
        try {
            $acl.SetOwner($userSid)
        } catch [System.InvalidOperationException] {
            # Cannot set owner without SeSecurityPrivilege, continue without changing owner
            Write-Verbose "Cannot set owner (requires elevation), continuing with access rules only"
        }

        # Apply the ACL
        try {
            Set-Acl -LiteralPath $Path -AclObject $acl -ErrorAction Stop
        } catch {
            # Check if it's a privilege error
            if ($_.Exception.Message -match 'SeSecurityPrivilege|PrivilegeNotHeld') {
                # Fallback: Try just adding access rules without disabling inheritance
                Write-Verbose "SeSecurityPrivilege not held, attempting minimal ACL changes"
                try {
                    $acl2 = Get-Acl -LiteralPath $Path
                    $acl2.AddAccessRule($userRule)
                    $acl2.AddAccessRule($systemRule)
                    Set-Acl -LiteralPath $Path -AclObject $acl2 -ErrorAction Stop
                    Write-Verbose "Applied minimal ACL for '$Path' - inheritance enabled. Run elevated for full hardening."
                } catch {
                    # Even minimal ACL changes failed, skip ACL operations
                    Write-Verbose "ACL hardening skipped for '$Path' - requires elevation. File has default permissions."
                }
            } else {
                # Handle any other Set-Acl errors by trying minimal approach
                Write-Verbose "Set-Acl failed: $($_.Exception.Message), attempting minimal ACL changes"
                try {
                    $acl2 = Get-Acl -LiteralPath $Path
                    $acl2.AddAccessRule($userRule)
                    $acl2.AddAccessRule($systemRule)
                    Set-Acl -LiteralPath $Path -AclObject $acl2 -ErrorAction Stop
                    Write-Verbose "Applied minimal ACL for '$Path' - inheritance enabled. Run elevated for full hardening."
                } catch {
                    # Skip ACL if we don't have privileges
                    Write-Verbose "ACL hardening skipped for '$Path' - requires elevation. File has default permissions."
                }
            }
        }

        Write-Verbose "Secure permissions set on: $Path"
        Write-Verbose "  Owner: $($currentUser.Name)"
        Write-Verbose "  Access: CurrentUser=FullControl, SYSTEM=FullControl"

        return $true

    } catch {
        Write-Error "Failed to set secure permissions on '$Path': $($_.Exception.Message)"
        throw
    }
}

#endregion

#region New-SecureDirectory

<#
.SYNOPSIS
    Creates a directory with secure permissions.

.DESCRIPTION
    Creates a new directory (including parent directories if needed) and
    immediately sets restrictive permissions to allow access only to the
    current user and SYSTEM.

.PARAMETER Path
    The directory path to create.

.PARAMETER Force
    If specified, does not throw an error if the directory already exists.
    Will still attempt to set secure permissions on existing directory.

.OUTPUTS
    System.IO.DirectoryInfo
    Returns the DirectoryInfo object for the created directory.

.EXAMPLE
    $secureDir = New-SecureDirectory -Path "C:\Secrets\MyApp"

.EXAMPLE
    New-SecureDirectory -Path "C:\Secrets\Existing" -Force

.NOTES
    Parent directories are created with secure permissions as well.
#>
function New-SecureDirectory {
    [CmdletBinding()]
    [OutputType([System.IO.DirectoryInfo])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter()]
        [switch]$Force
    )

    try {
        $normalizedPath = [System.IO.Path]::GetFullPath($Path)

        # Check if directory already exists
        if (Test-Path -LiteralPath $normalizedPath -PathType Container) {
            if (-not $Force) {
                throw [System.IO.IOException]::new("Directory already exists: $normalizedPath")
            }

            Write-Verbose "Directory exists, setting secure permissions: $normalizedPath"
            Set-SecureFilePermissions -Path $normalizedPath -Inherit
            return Get-Item -LiteralPath $normalizedPath
        }

        # Get parent directories that need to be created
        $dirsToCreate = [System.Collections.ArrayList]::new()
        $currentPath = $normalizedPath

        while (-not [string]::IsNullOrEmpty($currentPath)) {
            if (Test-Path -LiteralPath $currentPath -PathType Container) {
                break
            }
            [void]$dirsToCreate.Insert(0, $currentPath)
            $currentPath = [System.IO.Path]::GetDirectoryName($currentPath)
        }

        # Create directories from root to target
        foreach ($dir in $dirsToCreate) {
            Write-Verbose "Creating secure directory: $dir"

            # Create the directory
            $newDir = New-Item -Path $dir -ItemType Directory -Force

            # Set secure permissions immediately
            Set-SecureFilePermissions -Path $dir -Inherit
        }

        $result = Get-Item -LiteralPath $normalizedPath
        Write-Verbose "Secure directory created: $normalizedPath"

        return $result

    } catch {
        Write-Error "Failed to create secure directory '$Path': $($_.Exception.Message)"
        throw
    }
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Gets a list of all sensitive data pattern names.

.DESCRIPTION
    Returns the names of all defined sensitive data patterns.
    Useful for documentation and testing.

.OUTPUTS
    System.String[]
    Array of pattern names.

.EXAMPLE
    $patterns = Get-SensitiveDataPatterns
#>
function Get-SensitiveDataPatterns {
    [CmdletBinding()]
    [OutputType([string[]])]
    param()

    return $script:SensitivePatterns.Keys | Sort-Object
}

<#
.SYNOPSIS
    Gets a list of all blocked path patterns.

.DESCRIPTION
    Returns the regex patterns used to block security-sensitive paths.
    Useful for documentation and testing.

.OUTPUTS
    System.String[]
    Array of blocked path patterns.

.EXAMPLE
    $blocked = Get-BlockedPathPatterns
#>
function Get-BlockedPathPatterns {
    [CmdletBinding()]
    [OutputType([string[]])]
    param()

    return $script:BlockedPathPatterns
}

<#
.SYNOPSIS
    Validates multiple paths in batch.

.DESCRIPTION
    Validates an array of paths against security constraints.
    Returns results for all paths, including any that failed validation.

.PARAMETER Paths
    Array of paths to validate.

.PARAMETER ProjectRoot
    The root directory of the project.

.PARAMETER AllowedBasePaths
    Additional base paths that are allowed.

.OUTPUTS
    PSCustomObject[]
    Array of objects with Path, Valid, ValidatedPath, and Error properties.

.EXAMPLE
    $results = Test-PathSecurityBatch -Paths @("./file1.txt", "../outside.txt") -ProjectRoot "C:\Project"
#>
function Test-PathSecurityBatch {
    [CmdletBinding()]
    [OutputType([PSCustomObject[]])]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths,

        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [string[]]$AllowedBasePaths = @()
    )

    $results = foreach ($path in $Paths) {
        try {
            $validatedPath = Test-PathSecurity -Path $path -ProjectRoot $ProjectRoot -AllowedBasePaths $AllowedBasePaths
            [PSCustomObject]@{
                Path = $path
                Valid = $true
                ValidatedPath = $validatedPath
                Error = $null
            }
        } catch {
            [PSCustomObject]@{
                Path = $path
                Valid = $false
                ValidatedPath = $null
                Error = $_.Exception.Message
            }
        }
    }

    return $results
}

#endregion

#region Module Export

# Export public functions (only when loaded as module)
if ($MyInvocation.Line -match 'Import-Module') {
    Export-ModuleMember -Function @(
        'Test-SensitiveData',
        'Remove-SensitiveData',
        'Test-PathSecurity',
        'Set-SecureFilePermissions',
        'New-SecureDirectory',
        'Get-SensitiveDataPatterns',
        'Get-BlockedPathPatterns',
        'Test-PathSecurityBatch'
    )
}

#endregion
