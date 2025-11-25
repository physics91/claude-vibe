#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Safe Access Utility Module for PowerShell objects.

.DESCRIPTION
    Provides StrictMode-compatible functions for safely accessing properties
    on PSCustomObject and hashtable types without triggering errors.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Property Access Functions

<#
.SYNOPSIS
    Tests if a property exists on an object.

.DESCRIPTION
    Safely checks if a property exists on a PSCustomObject or hashtable
    without triggering StrictMode errors.

.PARAMETER Object
    The object to check.

.PARAMETER PropertyName
    The name of the property to check for.

.OUTPUTS
    $true if the property exists, $false otherwise.
#>
function Test-PropertyExists {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Object,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PropertyName
    )

    if ($null -eq $Object) {
        return $false
    }

    if ($Object -is [hashtable]) {
        return $Object.ContainsKey($PropertyName)
    }

    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        # Use indexer for O(1) lookup instead of O(N) array scan
        return $null -ne $Object.PSObject.Properties[$PropertyName]
    }

    # For other types, try to get the property
    try {
        $null = $Object.$PropertyName
        return $true
    }
    catch {
        return $false
    }
}

<#
.SYNOPSIS
    Safely gets a property value from an object.

.DESCRIPTION
    Returns the property value if it exists, or a default value if it doesn't.
    Works with PSCustomObject, hashtable, and other object types.

.PARAMETER Object
    The object to get the property from.

.PARAMETER PropertyName
    The name of the property to retrieve.

.PARAMETER Default
    The default value to return if the property doesn't exist.

.OUTPUTS
    The property value or the default value.
#>
function Get-SafeProperty {
    [CmdletBinding()]
    [OutputType([object])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Object,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PropertyName,

        [Parameter()]
        $Default = $null
    )

    if ($null -eq $Object) {
        return $Default
    }

    if ($Object -is [hashtable]) {
        if ($Object.ContainsKey($PropertyName)) {
            return $Object[$PropertyName]
        }
        return $Default
    }

    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        # Use indexer for O(1) lookup instead of O(N) array scan
        $prop = $Object.PSObject.Properties[$PropertyName]
        if ($null -ne $prop) {
            $value = $prop.Value
            if ($null -ne $value) {
                return $value
            }
        }
        return $Default
    }

    # For other types, try to get the property
    try {
        $value = $Object.$PropertyName
        if ($null -ne $value) {
            return $value
        }
        return $Default
    }
    catch {
        return $Default
    }
}

<#
.SYNOPSIS
    Gets all property names from an object.

.DESCRIPTION
    Returns an array of property names for PSCustomObject or hashtable.

.PARAMETER Object
    The object to get property names from.

.OUTPUTS
    Array of property names, or empty array if object is null or has no properties.
#>
function Get-PropertyNames {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Object
    )

    if ($null -eq $Object) {
        return @()
    }

    if ($Object -is [hashtable]) {
        return @($Object.Keys)
    }

    if ($Object -is [System.Management.Automation.PSCustomObject]) {
        return @($Object.PSObject.Properties.Name)
    }

    # For other types, try to get properties
    try {
        return @($Object | Get-Member -MemberType Properties | Select-Object -ExpandProperty Name)
    }
    catch {
        return @()
    }
}

<#
.SYNOPSIS
    Safely gets a nested property value using dot notation path.

.DESCRIPTION
    Navigates through nested objects using a dot-separated path string.

.PARAMETER Object
    The root object to start from.

.PARAMETER Path
    Dot-separated path to the property (e.g., "config.server.port").

.PARAMETER Default
    The default value to return if any part of the path doesn't exist.

.OUTPUTS
    The property value at the path or the default value.
#>
function Get-NestedProperty {
    [CmdletBinding()]
    [OutputType([object])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Object,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,

        [Parameter()]
        $Default = $null
    )

    if ($null -eq $Object) {
        return $Default
    }

    # Split path and filter out empty segments (handles 'a..b' or trailing dots)
    $parts = $Path -split '\.' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    if ($parts.Count -eq 0) {
        Write-Verbose "Path '$Path' contains no valid segments"
        return $Default
    }

    $current = $Object

    foreach ($part in $parts) {
        if ($null -eq $current) {
            return $Default
        }

        # Single lookup: try to get value directly, avoiding redundant existence check
        $current = Get-SafeProperty -Object $current -PropertyName $part -Default $null

        if ($null -eq $current) {
            return $Default
        }
    }

    return $current
}

<#
.SYNOPSIS
    Copies specified properties from source to target object.

.DESCRIPTION
    Safely copies only existing properties from source to target.

.PARAMETER Source
    The source object to copy from.

.PARAMETER Target
    The target hashtable to copy to.

.PARAMETER Properties
    Array of property names to copy.

.OUTPUTS
    The modified target hashtable.
#>
function Copy-SafeProperties {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Source,

        [Parameter(Mandatory = $true)]
        [ValidateNotNull()]
        [hashtable]$Target,

        [Parameter(Mandatory = $true)]
        [array]$Properties
    )

    if ($null -eq $Source) {
        return $Target
    }

    foreach ($prop in $Properties) {
        # Skip null or empty property names
        if ([string]::IsNullOrWhiteSpace($prop)) {
            Write-Verbose "Skipping null or empty property name"
            continue
        }

        # Single lookup: get value directly
        $value = Get-SafeProperty -Object $Source -PropertyName $prop -Default $null
        if ($null -ne $value) {
            $Target[$prop] = $value
        }
    }

    return $Target
}

#endregion

#region Module Export

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Test-PropertyExists',
        'Get-SafeProperty',
        'Get-PropertyNames',
        'Get-NestedProperty',
        'Copy-SafeProperties'
    )
}

#endregion
