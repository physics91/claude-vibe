#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    JSON Schema validation module for configuration files.

.DESCRIPTION
    Provides lightweight JSON Schema (draft-07) validation for PowerShell.
    Validates JSON data against schemas defined in the schemas/ folder.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Module Dependencies

$script:ModuleDependencies = @(
    @{ Name = 'conversion-helpers'; Path = "$PSScriptRoot\conversion-helpers.ps1" },
    @{ Name = 'safe-access'; Path = "$PSScriptRoot\safe-access.ps1" }
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

#region Constants

# Schema directory path
$script:PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:SchemaDirectory = Join-Path $script:PluginRoot "schemas"

# Validation limits
$script:MaxStringLength = 100000
$script:MaxArrayItems = 1000
$script:MaxObjectProperties = 500
# MaxValidationDepth: Depth 0 = root level, uses -gt check allowing depth 0..20 (21 levels total)
# This is intentional to support deeply nested schemas while preventing stack overflow
$script:MaxValidationDepth = 20

# Schema cache (avoid repeated file reads)
$script:SchemaCache = @{}

#endregion

#region Schema Loading

<#
.SYNOPSIS
    Loads a JSON schema from file.

.PARAMETER SchemaName
    Name of the schema (without .schema.json extension).

.OUTPUTS
    PSCustomObject containing the schema, or $null if not found.
#>
function Get-JsonSchema {
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$SchemaName
    )

    # Check cache first
    if ($script:SchemaCache.ContainsKey($SchemaName)) {
        return $script:SchemaCache[$SchemaName]
    }

    $schemaFile = Join-Path $script:SchemaDirectory "$SchemaName.schema.json"

    if (-not (Test-Path -LiteralPath $schemaFile -PathType Leaf)) {
        Write-Warning "Schema not found: $schemaFile"
        return $null
    }

    try {
        $content = Get-Content -LiteralPath $schemaFile -Raw -Encoding UTF8 -ErrorAction Stop
        $schema = $content | ConvertFrom-Json -ErrorAction Stop

        # Cache the schema
        $script:SchemaCache[$SchemaName] = $schema

        return $schema
    }
    catch {
        Write-Warning "Failed to load schema '$SchemaName': $($_.Exception.Message)"
        return $null
    }
}

<#
.SYNOPSIS
    Clears the schema cache.
#>
function Clear-SchemaCache {
    [CmdletBinding()]
    param()

    $script:SchemaCache.Clear()
    Write-Verbose "Schema cache cleared"
}

#endregion

#region Validation Functions

<#
.SYNOPSIS
    Validates JSON data against a schema.

.PARAMETER Data
    The data object to validate.

.PARAMETER SchemaName
    Name of the schema to validate against.

.PARAMETER Schema
    Schema object (alternative to SchemaName).

.OUTPUTS
    Hashtable with isValid, errors, and warnings.
#>
function Test-JsonSchema {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Data,

        [Parameter(Mandatory = $true, ParameterSetName = 'ByName')]
        [string]$SchemaName,

        [Parameter(Mandatory = $true, ParameterSetName = 'BySchema')]
        [PSCustomObject]$Schema
    )

    $result = @{
        isValid = $true
        errors = @()
        warnings = @()
    }

    # Load schema if needed
    if ($PSCmdlet.ParameterSetName -eq 'ByName') {
        $Schema = Get-JsonSchema -SchemaName $SchemaName
        if ($null -eq $Schema) {
            $result.isValid = $false
            $result.errors += "Schema '$SchemaName' not found"
            return $result
        }
    }

    # Validate recursively
    $validationErrors = @()
    $validationWarnings = @()

    # Safely get definitions (StrictMode compatible)
    $definitions = if (Test-PropertyExists -Object $Schema -Property 'definitions') { $Schema.definitions } else { $null }
    Test-SchemaNode -Data $Data -Schema $Schema -Path '$' -Errors ([ref]$validationErrors) -Warnings ([ref]$validationWarnings) -Depth 0 -Definitions $definitions

    $result.errors = $validationErrors
    $result.warnings = $validationWarnings
    $result.isValid = $validationErrors.Count -eq 0

    return $result
}

<#
.SYNOPSIS
    Validates a single node against its schema definition.

.PARAMETER Data
    The data to validate.

.PARAMETER Schema
    The schema definition for this node.

.PARAMETER Path
    JSON path for error reporting.

.PARAMETER Errors
    Reference to error collection.

.PARAMETER Warnings
    Reference to warning collection.

.PARAMETER Depth
    Current recursion depth.

.PARAMETER Definitions
    Schema definitions for $ref resolution.
#>
function Test-SchemaNode {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Data,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Schema,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ref]$Errors,

        [Parameter(Mandatory = $true)]
        [ref]$Warnings,

        [Parameter()]
        [int]$Depth = 0,

        [Parameter()]
        [AllowNull()]
        $Definitions = $null
    )

    # Depth limit check
    if ($Depth -gt $script:MaxValidationDepth) {
        $Warnings.Value += "$Path : Maximum validation depth exceeded"
        return
    }

    # Handle $ref
    if (Test-PropertyExists -Object $Schema -Property '$ref') {
        $refPath = $Schema.'$ref'
        if ($refPath -match '^#/definitions/(.+)$') {
            $defName = $Matches[1]
            if ($null -ne $Definitions -and (Test-PropertyExists -Object $Definitions -Property $defName)) {
                $Schema = Get-SafeProperty -Object $Definitions -Property $defName
            }
            else {
                $Errors.Value += "$Path : Unresolved reference '$refPath'"
                return
            }
        }
    }

    # Handle oneOf
    if (Test-PropertyExists -Object $Schema -Property 'oneOf') {
        $matched = $false
        foreach ($subSchema in $Schema.oneOf) {
            $subErrors = @()
            $subWarnings = @()
            Test-SchemaNode -Data $Data -Schema $subSchema -Path $Path -Errors ([ref]$subErrors) -Warnings ([ref]$subWarnings) -Depth ($Depth + 1) -Definitions $Definitions
            if ($subErrors.Count -eq 0) {
                $matched = $true
                break
            }
        }
        if (-not $matched) {
            $Errors.Value += "$Path : Value does not match any of the oneOf schemas"
        }
        return
    }

    # Handle allOf
    if (Test-PropertyExists -Object $Schema -Property 'allOf') {
        foreach ($subSchema in $Schema.allOf) {
            Test-SchemaNode -Data $Data -Schema $subSchema -Path $Path -Errors ([ref]$subErrors) -Warnings ([ref]$subWarnings) -Depth ($Depth + 1) -Definitions $Definitions
        }
        return
    }

    # Get expected type
    $expectedType = Get-SafeProperty -Object $Schema -Property 'type' -Default $null

    # Null handling
    if ($null -eq $Data) {
        if ($expectedType -is [array] -and $expectedType -contains 'null') {
            return
        }
        if ($expectedType -eq 'null') {
            return
        }
        # Required fields will be checked at parent level
        return
    }

    # Type validation
    if ($null -ne $expectedType) {
        $actualType = Get-JsonType -Data $Data

        $validTypes = if ($expectedType -is [array]) { $expectedType } else { @($expectedType) }

        if ($actualType -notin $validTypes) {
            $Errors.Value += "$Path : Expected type '$($validTypes -join '|')' but got '$actualType'"
            return
        }
    }

    # Type-specific validation
    switch (Get-JsonType -Data $Data) {
        'string' {
            Test-StringConstraints -Data $Data -Schema $Schema -Path $Path -Errors $Errors -Warnings $Warnings
        }
        'integer' {
            Test-NumberConstraints -Data $Data -Schema $Schema -Path $Path -Errors $Errors -Warnings $Warnings
        }
        'number' {
            Test-NumberConstraints -Data $Data -Schema $Schema -Path $Path -Errors $Errors -Warnings $Warnings
        }
        'boolean' {
            # No additional constraints for boolean
        }
        'array' {
            Test-ArrayConstraints -Data $Data -Schema $Schema -Path $Path -Errors $Errors -Warnings $Warnings -Depth $Depth -Definitions $Definitions
        }
        'object' {
            Test-ObjectConstraints -Data $Data -Schema $Schema -Path $Path -Errors $Errors -Warnings $Warnings -Depth $Depth -Definitions $Definitions
        }
    }

    # Enum validation
    if (Test-PropertyExists -Object $Schema -Property 'enum') {
        $enumValues = $Schema.enum
        if ($Data -notin $enumValues) {
            $Errors.Value += "$Path : Value '$Data' not in enum [$($enumValues -join ', ')]"
        }
    }
}

<#
.SYNOPSIS
    Gets the JSON type of a PowerShell value.
#>
function Get-JsonType {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Data
    )

    if ($null -eq $Data) {
        return 'null'
    }

    # Use -is checks for robustness with derived/wrapped types (AI review consensus)
    if ($Data -is [bool]) {
        return 'boolean'
    }
    # Check integer types (order matters: check specific before general)
    if ($Data -is [int] -or $Data -is [long] -or $Data -is [int16] -or $Data -is [byte] -or $Data -is [sbyte]) {
        return 'integer'
    }
    if ($Data -is [double] -or $Data -is [float] -or $Data -is [decimal]) {
        return 'number'
    }
    if ($Data -is [string]) {
        return 'string'
    }
    # DateTime treated as string (JSON date-time format) - AI review addition
    if ($Data -is [datetime]) {
        return 'string'
    }
    if ($Data -is [array] -or $Data -is [System.Collections.IList]) {
        return 'array'
    }
    if ($Data -is [PSCustomObject] -or $Data -is [hashtable] -or $Data -is [System.Collections.IDictionary]) {
        return 'object'
    }

    return 'unknown'
}

<#
.SYNOPSIS
    Validates string constraints.
#>
function Test-StringConstraints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Data,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Schema,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ref]$Errors,

        [Parameter(Mandatory = $true)]
        [ref]$Warnings
    )

    $length = $Data.Length

    # minLength
    if (Test-PropertyExists -Object $Schema -Property 'minLength') {
        $minLen = $Schema.minLength
        if ($length -lt $minLen) {
            $Errors.Value += "$Path : String length $length is less than minimum $minLen"
        }
    }

    # maxLength
    if (Test-PropertyExists -Object $Schema -Property 'maxLength') {
        $maxLen = $Schema.maxLength
        if ($length -gt $maxLen) {
            $Errors.Value += "$Path : String length $length exceeds maximum $maxLen"
        }
    }

    # pattern
    if (Test-PropertyExists -Object $Schema -Property 'pattern') {
        $pattern = $Schema.pattern
        try {
            if ($Data -notmatch $pattern) {
                $Errors.Value += "$Path : String does not match pattern '$pattern'"
            }
        }
        catch {
            $Warnings.Value += "$Path : Invalid regex pattern '$pattern'"
        }
    }

    # format (basic support)
    if (Test-PropertyExists -Object $Schema -Property 'format') {
        $format = $Schema.format
        switch ($format) {
            'date-time' {
                try {
                    [datetime]::Parse($Data) | Out-Null
                }
                catch {
                    $Errors.Value += "$Path : Invalid date-time format"
                }
            }
            'uri' {
                if ($Data -notmatch '^https?://') {
                    $Warnings.Value += "$Path : Value may not be a valid URI"
                }
            }
        }
    }
}

<#
.SYNOPSIS
    Validates number constraints.
#>
function Test-NumberConstraints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Data,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Schema,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ref]$Errors,

        [Parameter(Mandatory = $true)]
        [ref]$Warnings
    )

    # minimum
    if (Test-PropertyExists -Object $Schema -Property 'minimum') {
        $min = $Schema.minimum
        if ($Data -lt $min) {
            $Errors.Value += "$Path : Value $Data is less than minimum $min"
        }
    }

    # maximum
    if (Test-PropertyExists -Object $Schema -Property 'maximum') {
        $max = $Schema.maximum
        if ($Data -gt $max) {
            $Errors.Value += "$Path : Value $Data exceeds maximum $max"
        }
    }

    # exclusiveMinimum
    if (Test-PropertyExists -Object $Schema -Property 'exclusiveMinimum') {
        $exMin = $Schema.exclusiveMinimum
        if ($Data -le $exMin) {
            $Errors.Value += "$Path : Value $Data must be greater than $exMin"
        }
    }

    # exclusiveMaximum
    if (Test-PropertyExists -Object $Schema -Property 'exclusiveMaximum') {
        $exMax = $Schema.exclusiveMaximum
        if ($Data -ge $exMax) {
            $Errors.Value += "$Path : Value $Data must be less than $exMax"
        }
    }
}

<#
.SYNOPSIS
    Validates array constraints.
#>
function Test-ArrayConstraints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Data,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Schema,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ref]$Errors,

        [Parameter(Mandatory = $true)]
        [ref]$Warnings,

        [Parameter()]
        [int]$Depth = 0,

        [Parameter()]
        [AllowNull()]
        $Definitions = $null
    )

    $count = @($Data).Count

    # minItems
    if (Test-PropertyExists -Object $Schema -Property 'minItems') {
        $minItems = $Schema.minItems
        if ($count -lt $minItems) {
            $Errors.Value += "$Path : Array has $count items, minimum is $minItems"
        }
    }

    # maxItems
    if (Test-PropertyExists -Object $Schema -Property 'maxItems') {
        $maxItems = $Schema.maxItems
        if ($count -gt $maxItems) {
            $Errors.Value += "$Path : Array has $count items, maximum is $maxItems"
        }
    }

    # Validate items
    if (Test-PropertyExists -Object $Schema -Property 'items') {
        $itemSchema = $Schema.items
        $index = 0
        foreach ($item in $Data) {
            if ($index -ge $script:MaxArrayItems) {
                $Warnings.Value += "$Path : Stopped validating after $script:MaxArrayItems items"
                break
            }
            Test-SchemaNode -Data $item -Schema $itemSchema -Path "$Path[$index]" -Errors $Errors -Warnings $Warnings -Depth ($Depth + 1) -Definitions $Definitions
            $index++
        }
    }
}

<#
.SYNOPSIS
    Validates object constraints.
#>
function Test-ObjectConstraints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Data,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$Schema,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ref]$Errors,

        [Parameter(Mandatory = $true)]
        [ref]$Warnings,

        [Parameter()]
        [int]$Depth = 0,

        [Parameter()]
        [AllowNull()]
        $Definitions = $null
    )

    # Get property names
    $dataProps = if ($Data -is [hashtable]) {
        $Data.Keys
    }
    else {
        $Data.PSObject.Properties.Name
    }

    # Required properties
    if (Test-PropertyExists -Object $Schema -Property 'required') {
        foreach ($reqProp in $Schema.required) {
            if ($reqProp -notin $dataProps) {
                $Errors.Value += "$Path : Missing required property '$reqProp'"
            }
        }
    }

    # Validate properties
    if (Test-PropertyExists -Object $Schema -Property 'properties') {
        $propCount = 0
        foreach ($propName in $dataProps) {
            if ($propCount -ge $script:MaxObjectProperties) {
                $Warnings.Value += "$Path : Stopped validating after $script:MaxObjectProperties properties"
                break
            }

            $propValue = if ($Data -is [hashtable]) { $Data[$propName] } else { $Data.$propName }

            if (Test-PropertyExists -Object $Schema.properties -Property $propName) {
                $propSchema = Get-SafeProperty -Object $Schema.properties -Property $propName
                Test-SchemaNode -Data $propValue -Schema $propSchema -Path "$Path.$propName" -Errors $Errors -Warnings $Warnings -Depth ($Depth + 1) -Definitions $Definitions
            }
            elseif (Test-PropertyExists -Object $Schema -Property 'additionalProperties') {
                if ($Schema.additionalProperties -eq $false) {
                    $Errors.Value += "$Path : Additional property '$propName' not allowed"
                }
                elseif ($Schema.additionalProperties -is [PSCustomObject]) {
                    Test-SchemaNode -Data $propValue -Schema $Schema.additionalProperties -Path "$Path.$propName" -Errors $Errors -Warnings $Warnings -Depth ($Depth + 1) -Definitions $Definitions
                }
            }

            $propCount++
        }
    }
}

#endregion

#region Convenience Functions

<#
.SYNOPSIS
    Validates a configuration file against its schema.

.PARAMETER FilePath
    Path to the JSON file.

.PARAMETER SchemaName
    Name of the schema to validate against.

.OUTPUTS
    Hashtable with isValid, errors, and warnings.
#>
function Test-ConfigFile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$SchemaName
    )

    $result = @{
        isValid = $false
        errors = @()
        warnings = @()
        filePath = $FilePath
    }

    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        $result.errors += "File not found: $FilePath"
        return $result
    }

    try {
        $content = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8 -ErrorAction Stop
        $data = $content | ConvertFrom-Json -ErrorAction Stop

        $validationResult = Test-JsonSchema -Data $data -SchemaName $SchemaName

        $result.isValid = $validationResult.isValid
        $result.errors = $validationResult.errors
        $result.warnings = $validationResult.warnings
    }
    catch {
        $result.errors += "Failed to parse JSON: $($_.Exception.Message)"
    }

    return $result
}

<#
.SYNOPSIS
    Lists all available schemas.

.OUTPUTS
    Array of schema names.
#>
function Get-AvailableSchemas {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    $schemas = @()

    if (-not (Test-Path -LiteralPath $script:SchemaDirectory)) {
        return $schemas
    }

    $schemaFiles = Get-ChildItem -Path $script:SchemaDirectory -Filter "*.schema.json" -File -ErrorAction SilentlyContinue

    foreach ($file in $schemaFiles) {
        $name = $file.BaseName -replace '\.schema$', ''
        $schemas += @{
            name = $name
            path = $file.FullName
            title = $null
        }

        # Try to get title from schema
        $schema = Get-JsonSchema -SchemaName $name
        if ($null -ne $schema -and (Test-PropertyExists -Object $schema -Property 'title')) {
            $schemas[-1].title = $schema.title
        }
    }

    return $schemas
}

<#
.SYNOPSIS
    Formats validation result for display.

.PARAMETER ValidationResult
    The validation result hashtable.

.OUTPUTS
    Formatted string.
#>
function Format-ValidationResult {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$ValidationResult
    )

    $output = @()

    if ($ValidationResult.isValid) {
        $output += "Validation: PASSED"
    }
    else {
        $output += "Validation: FAILED"
    }

    if ($ValidationResult.errors.Count -gt 0) {
        $output += ""
        $output += "Errors ($($ValidationResult.errors.Count)):"
        foreach ($err in $ValidationResult.errors) {
            $output += "  - $err"
        }
    }

    if ($ValidationResult.warnings.Count -gt 0) {
        $output += ""
        $output += "Warnings ($($ValidationResult.warnings.Count)):"
        foreach ($warn in $ValidationResult.warnings) {
            $output += "  - $warn"
        }
    }

    return $output -join "`n"
}

#endregion

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-JsonSchema',
        'Clear-SchemaCache',
        'Test-JsonSchema',
        'Test-ConfigFile',
        'Get-AvailableSchemas',
        'Format-ValidationResult'
    )
}
