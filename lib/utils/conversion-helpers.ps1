#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Common conversion helper functions for claude-vibe plugin.

.DESCRIPTION
    Provides shared utility functions for data conversion that are used
    across multiple modules. This eliminates code duplication and ensures
    consistent behavior.

.NOTES
    Author: claude-vibe
    Version: 1.1.0
#>

#region ConvertTo-HashtableRecursive

<#
.SYNOPSIS
    Converts a PSCustomObject (from ConvertFrom-Json) to a Hashtable recursively.

.DESCRIPTION
    PowerShell 5.1 doesn't have ConvertFrom-Json -AsHashtable, so this function
    provides the same functionality for compatibility. Handles nested objects,
    arrays, dictionaries, and primitive types.

.PARAMETER InputObject
    The object to convert. Can be PSCustomObject, IDictionary, IEnumerable, or primitive.

.PARAMETER MaxDepth
    Maximum recursion depth to prevent stack overflow. Default is 100.

.PARAMETER CurrentDepth
    Internal parameter to track current recursion depth. Do not use directly.

.OUTPUTS
    System.Collections.Hashtable, array, or the original type for primitives.

.EXAMPLE
    $hashtable = $jsonObject | ConvertTo-HashtableRecursive

.EXAMPLE
    $hashtable = ConvertTo-HashtableRecursive -InputObject $psobject -MaxDepth 50

.NOTES
    This function is used by storage.ps1, preset-manager.ps1, and other modules.
#>
function ConvertTo-HashtableRecursive {
    [CmdletBinding()]
    [OutputType([hashtable], [array], [object])]
    param(
        [Parameter(ValueFromPipeline)]
        [object]$InputObject,

        [Parameter()]
        [ValidateRange(1, 1000)]
        [int]$MaxDepth = 100,

        [Parameter(DontShow)]
        [int]$CurrentDepth = 0
    )

    process {
        if ($null -eq $InputObject) {
            return $null
        }

        # Check recursion depth
        if ($CurrentDepth -gt $MaxDepth) {
            Write-Warning "Maximum recursion depth ($MaxDepth) exceeded. Returning object as-is."
            return $InputObject
        }

        $nextDepth = $CurrentDepth + 1

        # Handle IDictionary (including Hashtable) - must be before IEnumerable check
        if ($InputObject -is [System.Collections.IDictionary]) {
            $hash = @{}
            foreach ($key in $InputObject.Keys) {
                $hash[$key] = ConvertTo-HashtableRecursive -InputObject $InputObject[$key] -MaxDepth $MaxDepth -CurrentDepth $nextDepth
            }
            return $hash
        }

        # Handle arrays and other enumerables (but not strings)
        if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
            $collection = @(
                foreach ($item in $InputObject) {
                    ConvertTo-HashtableRecursive -InputObject $item -MaxDepth $MaxDepth -CurrentDepth $nextDepth
                }
            )
            return $collection
        }

        # Handle PSCustomObject (from ConvertFrom-Json)
        if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
            $hash = @{}
            foreach ($property in $InputObject.PSObject.Properties) {
                $hash[$property.Name] = ConvertTo-HashtableRecursive -InputObject $property.Value -MaxDepth $MaxDepth -CurrentDepth $nextDepth
            }
            return $hash
        }

        # Return primitive values as-is (strings, numbers, booleans, etc.)
        return $InputObject
    }
}

#endregion

#region Read-JsonAsHashtable

<#
.SYNOPSIS
    Reads a JSON file and returns it as a hashtable.

.DESCRIPTION
    Convenience function that combines file reading and JSON parsing with
    hashtable conversion in one operation. Includes proper error handling
    and file existence check.

.PARAMETER Path
    The path to the JSON file to read.

.PARAMETER DefaultValue
    The default value to return if the file doesn't exist or fails to parse.
    Default is an empty hashtable.

.OUTPUTS
    System.Collections.Hashtable

.EXAMPLE
    $config = Read-JsonAsHashtable -Path "config.json"

.EXAMPLE
    $config = Read-JsonAsHashtable -Path "config.json" -DefaultValue @{ enabled = $true }
#>
function Read-JsonAsHashtable {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,

        [Parameter()]
        [hashtable]$DefaultValue = @{}
    )

    # Check file existence first
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Write-Verbose "File not found: $Path"
        return $DefaultValue
    }

    try {
        $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($content)) {
            Write-Verbose "File is empty: $Path"
            return $DefaultValue
        }
        return $content | ConvertFrom-Json -ErrorAction Stop | ConvertTo-HashtableRecursive
    }
    catch {
        Write-Warning "Failed to read JSON file '$Path': $($_.Exception.Message)"
        return $DefaultValue
    }
}

#endregion

#region Module Export

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'ConvertTo-HashtableRecursive',
        'Read-JsonAsHashtable'
    )
}

#endregion
