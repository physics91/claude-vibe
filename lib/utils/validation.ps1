#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Validation utility functions for claude-vibe plugin.

.DESCRIPTION
    Provides standardized input validation functions that throw appropriate
    exceptions with rich context information. Use these for parameter
    validation and pre-condition checks.

.NOTES
    Author: claude-vibe
    Version: 1.0.0

    Usage:
    - Use Assert-* functions for validation that should throw on failure
    - Use Test-* functions for validation that returns boolean
#>

# Load exceptions (cross-platform path handling)
$libRoot = Split-Path $PSScriptRoot -Parent
$coreDir = Join-Path $libRoot 'core'
$exceptionsPath = Join-Path $coreDir 'exceptions.ps1'
if (Test-Path -LiteralPath $exceptionsPath) {
    . $exceptionsPath
} else {
    Write-Warning "Exceptions module not found at: $exceptionsPath"
}

#region Assert Functions (Throw on Failure)

<#
.SYNOPSIS
    Asserts that a value is not null.

.PARAMETER Value
    The value to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER CustomMessage
    Optional custom error message.

.EXAMPLE
    Assert-NotNull -Value $config -ParameterName 'config'
#>
function Assert-NotNull {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Value,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter()]
        [string]$CustomMessage
    )

    if ($null -eq $Value) {
        $message = if ($CustomMessage) { $CustomMessage } else { "Value cannot be null" }
        throw [System.ArgumentNullException]::new($ParameterName, $message)
    }
}

<#
.SYNOPSIS
    Asserts that a string is not null or empty.

.PARAMETER Value
    The string to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER AllowWhitespace
    If specified, allows whitespace-only strings.

.EXAMPLE
    Assert-NotNullOrEmpty -Value $path -ParameterName 'path'
#>
function Assert-NotNullOrEmpty {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter()]
        [switch]$AllowWhitespace
    )

    if ($null -eq $Value) {
        throw [System.ArgumentNullException]::new($ParameterName, "Value cannot be null")
    }

    if ($AllowWhitespace) {
        if ($Value.Length -eq 0) {
            throw [System.ArgumentException]::new("Value cannot be empty", $ParameterName)
        }
    } else {
        if ([string]::IsNullOrWhiteSpace($Value)) {
            throw [System.ArgumentException]::new("Value cannot be null, empty, or whitespace", $ParameterName)
        }
    }
}

<#
.SYNOPSIS
    Asserts that a path exists.

.PARAMETER Path
    The path to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER PathType
    The type of path to check for (Any, Leaf, Container).

.EXAMPLE
    Assert-PathExists -Path $configFile -ParameterName 'configFile' -PathType Leaf
#>
function Assert-PathExists {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter()]
        [ValidateSet('Any', 'Leaf', 'Container')]
        [string]$PathType = 'Any'
    )

    Assert-NotNullOrEmpty -Value $Path -ParameterName $ParameterName

    $exists = switch ($PathType) {
        'Leaf' { Test-Path -LiteralPath $Path -PathType Leaf }
        'Container' { Test-Path -LiteralPath $Path -PathType Container }
        default { Test-Path -LiteralPath $Path }
    }

    if (-not $exists) {
        $typeDesc = switch ($PathType) {
            'Leaf' { "file" }
            'Container' { "directory" }
            default { "path" }
        }
        throw [System.IO.FileNotFoundException]::new(
            "The specified $typeDesc does not exist: $Path",
            $Path
        )
    }
}

<#
.SYNOPSIS
    Asserts that a value is within a specified range.

.PARAMETER Value
    The numeric value to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER Minimum
    The minimum allowed value (inclusive).

.PARAMETER Maximum
    The maximum allowed value (inclusive).

.EXAMPLE
    Assert-InRange -Value $timeout -ParameterName 'timeout' -Minimum 1 -Maximum 3600
#>
function Assert-InRange {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Value,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter()]
        $Minimum,

        [Parameter()]
        $Maximum
    )

    Assert-NotNull -Value $Value -ParameterName $ParameterName

    if ($null -ne $Minimum -and $Value -lt $Minimum) {
        throw [System.ArgumentOutOfRangeException]::new(
            $ParameterName,
            $Value,
            "Value must be greater than or equal to $Minimum"
        )
    }

    if ($null -ne $Maximum -and $Value -gt $Maximum) {
        throw [System.ArgumentOutOfRangeException]::new(
            $ParameterName,
            $Value,
            "Value must be less than or equal to $Maximum"
        )
    }
}

<#
.SYNOPSIS
    Asserts that a value matches one of the allowed values.

.PARAMETER Value
    The value to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER AllowedValues
    Array of allowed values.

.PARAMETER CaseSensitive
    If specified, comparison is case-sensitive for strings.

.EXAMPLE
    Assert-OneOf -Value $mode -ParameterName 'mode' -AllowedValues @('read', 'write', 'append')
#>
function Assert-OneOf {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Value,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter(Mandatory = $true)]
        [array]$AllowedValues,

        [Parameter()]
        [switch]$CaseSensitive
    )

    Assert-NotNull -Value $Value -ParameterName $ParameterName

    $isValid = $false
    foreach ($allowed in $AllowedValues) {
        if ($CaseSensitive) {
            if ($Value -ceq $allowed) {
                $isValid = $true
                break
            }
        } else {
            if ($Value -eq $allowed) {
                $isValid = $true
                break
            }
        }
    }

    if (-not $isValid) {
        $allowedStr = $AllowedValues -join "', '"
        throw [System.ArgumentException]::new(
            "Value '$Value' is not valid. Allowed values: '$allowedStr'",
            $ParameterName
        )
    }
}

<#
.SYNOPSIS
    Asserts that a collection is not null or empty.

.PARAMETER Collection
    The collection to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.EXAMPLE
    Assert-NotEmpty -Collection $items -ParameterName 'items'
#>
function Assert-NotEmpty {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Collection,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName
    )

    Assert-NotNull -Value $Collection -ParameterName $ParameterName

    $count = 0
    if ($Collection -is [array]) {
        $count = $Collection.Count
    } elseif ($Collection -is [System.Collections.ICollection]) {
        $count = $Collection.Count
    } elseif ($Collection -is [string]) {
        $count = $Collection.Length
    } else {
        # Try to enumerate
        $count = @($Collection).Count
    }

    if ($count -eq 0) {
        throw [System.ArgumentException]::new("Collection cannot be empty", $ParameterName)
    }
}

<#
.SYNOPSIS
    Asserts that a string matches a regex pattern.

.PARAMETER Value
    The string to check.

.PARAMETER ParameterName
    The name of the parameter for error messages.

.PARAMETER Pattern
    The regex pattern to match.

.PARAMETER PatternDescription
    Human-readable description of what the pattern validates.

.EXAMPLE
    Assert-Matches -Value $email -ParameterName 'email' -Pattern '^[\w.-]+@[\w.-]+\.\w+$' -PatternDescription 'email address'
#>
function Assert-Matches {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [string]$ParameterName,

        [Parameter(Mandatory = $true)]
        [string]$Pattern,

        [Parameter()]
        [string]$PatternDescription = "expected pattern"
    )

    Assert-NotNullOrEmpty -Value $Value -ParameterName $ParameterName

    if ($Value -notmatch $Pattern) {
        throw [System.ArgumentException]::new(
            "Value does not match $PatternDescription",
            $ParameterName
        )
    }
}

#endregion

#region Test Functions (Return Boolean)

<#
.SYNOPSIS
    Tests if a value is null.

.PARAMETER Value
    The value to test.

.OUTPUTS
    $true if null, $false otherwise.
#>
function Test-Null {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Value
    )

    return $null -eq $Value
}

<#
.SYNOPSIS
    Tests if a string is null, empty, or whitespace.

.PARAMETER Value
    The string to test.

.OUTPUTS
    $true if null/empty/whitespace, $false otherwise.
#>
function Test-NullOrEmpty {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string]$Value
    )

    return [string]::IsNullOrWhiteSpace($Value)
}

<#
.SYNOPSIS
    Tests if a path exists without throwing exceptions.

.DESCRIPTION
    Safely checks path existence, returning false instead of throwing
    for null/empty paths or access errors. Does NOT perform security
    validation - use Test-PathSecurity for security checks.

.PARAMETER Path
    The path to test.

.PARAMETER PathType
    The type of path to check (Any, Leaf, Container).

.OUTPUTS
    $true if exists, $false otherwise (never throws).
#>
function Test-PathExists {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string]$Path,

        [Parameter()]
        [ValidateSet('Any', 'Leaf', 'Container')]
        [string]$PathType = 'Any'
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    try {
        switch ($PathType) {
            'Leaf' { return Test-Path -LiteralPath $Path -PathType Leaf }
            'Container' { return Test-Path -LiteralPath $Path -PathType Container }
            default { return Test-Path -LiteralPath $Path }
        }
    } catch {
        return $false
    }
}

<#
.SYNOPSIS
    Tests if a value is within a specified range.

.PARAMETER Value
    The numeric value to test.

.PARAMETER Minimum
    The minimum allowed value (inclusive).

.PARAMETER Maximum
    The maximum allowed value (inclusive).

.OUTPUTS
    $true if in range, $false otherwise.
#>
function Test-InRange {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        $Value,

        [Parameter()]
        $Minimum,

        [Parameter()]
        $Maximum
    )

    if ($null -eq $Value) {
        return $false
    }

    # Wrap comparisons in try-catch to handle incompatible types
    # Test-* functions should never throw, only return boolean
    try {
        if ($null -ne $Minimum -and $Value -lt $Minimum) {
            return $false
        }

        if ($null -ne $Maximum -and $Value -gt $Maximum) {
            return $false
        }

        return $true
    } catch {
        # Comparison failed (incompatible types) - return false
        Write-Verbose "Test-InRange comparison failed: $($_.Exception.Message)"
        return $false
    }
}

#endregion

#region Module Export

# Backward compatibility alias (Test-PathSafe was renamed to Test-PathExists)
Set-Alias -Name 'Test-PathSafe' -Value 'Test-PathExists' -Scope Script

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        # Assert functions
        'Assert-NotNull',
        'Assert-NotNullOrEmpty',
        'Assert-PathExists',
        'Assert-InRange',
        'Assert-OneOf',
        'Assert-NotEmpty',
        'Assert-Matches',
        # Test functions
        'Test-Null',
        'Test-NullOrEmpty',
        'Test-PathExists',
        'Test-InRange'
    ) -Alias @('Test-PathSafe')
}

#endregion
