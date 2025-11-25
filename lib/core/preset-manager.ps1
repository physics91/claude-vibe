#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Import utility modules
. "$PSScriptRoot\..\utils\conversion-helpers.ps1"

<#
.SYNOPSIS
    Preset management module for Context Manager feature.

.DESCRIPTION
    Provides functions to load, save, and manage context presets for
    MCP servers, agents, and commands optimization.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Configuration

$script:BuiltinPresetsPath = Join-Path $PSScriptRoot "..\..\presets"
$script:UserPresetsPath = Join-Path $env:USERPROFILE ".claude\claude-vibe\presets"
$script:SchemaPath = Join-Path $PSScriptRoot "..\..\schemas\context-profile.schema.json"

#endregion

#region Preset Loading Functions

<#
.SYNOPSIS
    Gets all available built-in presets.

.DESCRIPTION
    Loads and returns all preset files from the built-in presets directory.

.OUTPUTS
    Array of preset objects with name, displayName, description, and full config.
#>
function Get-BuiltinPresets {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    $presets = @()

    if (-not (Test-Path $script:BuiltinPresetsPath)) {
        Write-Verbose "Built-in presets path not found: $script:BuiltinPresetsPath"
        return $presets
    }

    $presetFiles = Get-ChildItem -Path $script:BuiltinPresetsPath -Filter "*.json" -ErrorAction SilentlyContinue

    foreach ($file in $presetFiles) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
            $preset = $content | ConvertFrom-Json

            $presets += @{
                name = $preset.name
                displayName = $preset.displayName
                description = $preset.description
                estimatedTokenSaved = $preset.estimatedTokenSaved
                isBuiltin = $true
                filePath = $file.FullName
                config = $preset
            }
        }
        catch {
            Write-Warning "Failed to load preset file: $($file.Name) - $_"
        }
    }

    return $presets
}

<#
.SYNOPSIS
    Gets all user-defined presets.

.DESCRIPTION
    Loads and returns all preset files from the user's presets directory.

.OUTPUTS
    Array of preset objects.
#>
function Get-UserPresets {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    $presets = @()

    if (-not (Test-Path $script:UserPresetsPath)) {
        return $presets
    }

    $presetFiles = Get-ChildItem -Path $script:UserPresetsPath -Filter "*.json" -ErrorAction SilentlyContinue

    foreach ($file in $presetFiles) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
            $preset = $content | ConvertFrom-Json

            $presets += @{
                name = $preset.name
                displayName = $preset.displayName
                description = $preset.description
                estimatedTokenSaved = $preset.estimatedTokenSaved
                isBuiltin = $false
                filePath = $file.FullName
                config = $preset
            }
        }
        catch {
            Write-Warning "Failed to load user preset file: $($file.Name) - $_"
        }
    }

    return $presets
}

<#
.SYNOPSIS
    Gets all available presets (built-in and user-defined).

.OUTPUTS
    Array of all preset objects.
#>
function Get-AllPresets {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    $builtinPresets = Get-BuiltinPresets
    $userPresets = Get-UserPresets

    return $builtinPresets + $userPresets
}

<#
.SYNOPSIS
    Gets a preset by name.

.PARAMETER Name
    The name of the preset to retrieve.

.OUTPUTS
    The preset object if found, $null otherwise.
#>
function Get-PresetByName {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $allPresets = Get-AllPresets

    foreach ($preset in $allPresets) {
        if ($preset.name -eq $Name) {
            return $preset
        }
    }

    return $null
}

#endregion

#region Preset Saving Functions

<#
.SYNOPSIS
    Saves a user-defined preset.

.PARAMETER Preset
    The preset configuration to save.

.PARAMETER Name
    The name for the preset file.

.OUTPUTS
    The path to the saved preset file.
#>
function Save-UserPreset {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Preset,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    # Ensure user presets directory exists
    if (-not (Test-Path $script:UserPresetsPath)) {
        New-Item -Path $script:UserPresetsPath -ItemType Directory -Force | Out-Null
    }

    # Sanitize name for filename
    $safeName = $Name -replace '[^\w\-]', '-'
    $filePath = Join-Path $script:UserPresetsPath "$safeName.json"

    # Add metadata
    $Preset.version = "1.0.0"
    $Preset.name = $Name
    if (-not $Preset.metadata) {
        $Preset.metadata = @{}
    }
    $Preset.metadata.createdAt = (Get-Date).ToUniversalTime().ToString("o")
    $Preset.metadata.updatedAt = $Preset.metadata.createdAt

    # Save to file
    $json = $Preset | ConvertTo-Json -Depth 10
    $json | Set-Content -Path $filePath -Encoding UTF8 -Force

    return $filePath
}

<#
.SYNOPSIS
    Removes a user-defined preset.

.PARAMETER Name
    The name of the preset to remove.

.OUTPUTS
    $true if removed, $false otherwise.
#>
function Remove-UserPreset {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $safeName = $Name -replace '[^\w\-]', '-'
    $filePath = Join-Path $script:UserPresetsPath "$safeName.json"

    if (Test-Path $filePath) {
        Remove-Item -Path $filePath -Force
        return $true
    }

    return $false
}

#endregion

#region Preset Merging Functions

<#
.SYNOPSIS
    Merges a preset with its base preset (if extends is specified).

.PARAMETER Preset
    The preset configuration that may extend another preset.

.OUTPUTS
    The merged preset configuration.
#>
function Merge-PresetWithBase {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        $Preset
    )

    # Convert PSCustomObject to hashtable if needed
    if ($Preset -is [System.Management.Automation.PSCustomObject]) {
        $Preset = ConvertTo-HashtableRecursive $Preset
    }

    # If no extends, return as-is
    if (-not $Preset.extends) {
        return $Preset
    }

    # Find base preset
    $basePreset = Get-PresetByName -Name $Preset.extends
    if (-not $basePreset) {
        Write-Warning "Base preset '$($Preset.extends)' not found"
        return $Preset
    }

    $baseConfig = $basePreset.config
    if ($baseConfig -is [System.Management.Automation.PSCustomObject]) {
        $baseConfig = ConvertTo-HashtableRecursive $baseConfig
    }

    # Merge configurations
    $merged = @{
        version = Get-CoalescedValue $Preset.version $baseConfig.version "1.0.0"
        name = $Preset.name
        displayName = Get-CoalescedValue $Preset.displayName $baseConfig.displayName $null
        description = Get-CoalescedValue $Preset.description $baseConfig.description $null
        extends = $Preset.extends
    }

    # Merge MCP settings
    $merged.mcp = @{
        enabled = @()
        disabled = @()
    }

    if ($baseConfig.mcp) {
        if ($baseConfig.mcp.enabled) { $merged.mcp.enabled = @($baseConfig.mcp.enabled) }
        if ($baseConfig.mcp.disabled) { $merged.mcp.disabled = @($baseConfig.mcp.disabled) }
    }

    if ($Preset.mcp) {
        if ($Preset.mcp.enabled) { $merged.mcp.enabled = @($Preset.mcp.enabled) }
        if ($Preset.mcp.disabled) { $merged.mcp.disabled = @($Preset.mcp.disabled) }
    }

    # Merge agents settings
    $merged.agents = @{
        enabled = @()
        disabled = @()
    }

    if ($baseConfig.agents) {
        if ($baseConfig.agents.enabled) { $merged.agents.enabled = @($baseConfig.agents.enabled) }
        if ($baseConfig.agents.disabled) { $merged.agents.disabled = @($baseConfig.agents.disabled) }
    }

    if ($Preset.agents) {
        if ($Preset.agents.enabled) { $merged.agents.enabled = @($Preset.agents.enabled) }
        if ($Preset.agents.disabled) { $merged.agents.disabled = @($Preset.agents.disabled) }
    }

    # Merge commands settings
    $merged.commands = @{
        enabled = @("*")
        disabled = @()
    }

    if ($baseConfig.commands) {
        if ($baseConfig.commands.enabled) { $merged.commands.enabled = @($baseConfig.commands.enabled) }
        if ($baseConfig.commands.disabled) { $merged.commands.disabled = @($baseConfig.commands.disabled) }
    }

    if ($Preset.commands) {
        if ($Preset.commands.enabled) { $merged.commands.enabled = @($Preset.commands.enabled) }
        if ($Preset.commands.disabled) { $merged.commands.disabled = @($Preset.commands.disabled) }
    }

    # Merge estimated token savings
    $merged.estimatedTokenSaved = Get-CoalescedValue $Preset.estimatedTokenSaved $baseConfig.estimatedTokenSaved 0

    return $merged
}

#endregion

#region Profile Export Functions

<#
.SYNOPSIS
    Exports a preset as a project context profile.

.PARAMETER PresetName
    The name of the preset to export.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    The path to the exported profile file.
#>
function Export-PresetAsProfile {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PresetName,

        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $preset = Get-PresetByName -Name $PresetName
    if (-not $preset) {
        throw "Preset '$PresetName' not found"
    }

    # Merge with base if needed
    $mergedConfig = Merge-PresetWithBase -Preset $preset.config

    # Create profile
    $profile = @{
        version = "1.0.0"
        name = $PresetName
        displayName = $preset.displayName
        description = $preset.description
        extends = $PresetName
        mcp = $mergedConfig.mcp
        agents = $mergedConfig.agents
        commands = $mergedConfig.commands
        estimatedTokenSaved = $mergedConfig.estimatedTokenSaved
        metadata = @{
            createdAt = (Get-Date).ToUniversalTime().ToString("o")
            updatedAt = (Get-Date).ToUniversalTime().ToString("o")
            autoDetected = $false
        }
    }

    # Ensure .claude directory exists
    $claudeDir = Join-Path $ProjectRoot ".claude"
    if (-not (Test-Path $claudeDir)) {
        New-Item -Path $claudeDir -ItemType Directory -Force | Out-Null
    }

    # Save profile
    $profilePath = Join-Path $claudeDir "context-profile.json"
    $json = $profile | ConvertTo-Json -Depth 10
    $json | Set-Content -Path $profilePath -Encoding UTF8 -Force

    return $profilePath
}

<#
.SYNOPSIS
    Loads a project's context profile.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    The profile configuration if found, $null otherwise.
#>
function Get-ProjectProfile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $profilePath = Join-Path $ProjectRoot ".claude\context-profile.json"

    if (-not (Test-Path $profilePath)) {
        return $null
    }

    try {
        $content = Get-Content -Path $profilePath -Raw -Encoding UTF8
        $profile = $content | ConvertFrom-Json
        return ConvertTo-HashtableRecursive $profile
    }
    catch {
        Write-Warning "Failed to load project profile: $_"
        return $null
    }
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Returns the first non-null value from the arguments.

.DESCRIPTION
    PowerShell 5.1 compatible null-coalescing function.
#>
function Get-CoalescedValue {
    param(
        [Parameter(Position = 0)]
        $Value1,
        [Parameter(Position = 1)]
        $Value2,
        [Parameter(Position = 2)]
        $Default
    )

    if ($null -ne $Value1) { return $Value1 }
    if ($null -ne $Value2) { return $Value2 }
    return $Default
}

<#
.SYNOPSIS
    Formats a preset list for display.

.PARAMETER Presets
    Array of preset objects to format.

.OUTPUTS
    Formatted string for display.
#>
function Format-PresetList {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [array]$Presets
    )

    $output = @()

    $builtinPresets = $Presets | Where-Object { $_.isBuiltin }
    $userPresets = $Presets | Where-Object { -not $_.isBuiltin }

    if ($builtinPresets) {
        $output += "**Built-in Presets:**"
        foreach ($preset in $builtinPresets) {
            $savings = if ($preset.estimatedTokenSaved) { " (~$($preset.estimatedTokenSaved) tokens saved)" } else { "" }
            $displayName = Get-CoalescedValue $preset.displayName $preset.name $null
            $output += "- **$displayName**: $($preset.description)$savings"
        }
    }

    if ($userPresets) {
        $output += ""
        $output += "**User Presets:**"
        foreach ($preset in $userPresets) {
            $savings = if ($preset.estimatedTokenSaved) { " (~$($preset.estimatedTokenSaved) tokens saved)" } else { "" }
            $displayName = Get-CoalescedValue $preset.displayName $preset.name $null
            $output += "- **$displayName**: $($preset.description)$savings"
        }
    }

    return $output -join "`n"
}

#endregion

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-BuiltinPresets',
        'Get-UserPresets',
        'Get-AllPresets',
        'Get-PresetByName',
        'Save-UserPreset',
        'Remove-UserPreset',
        'Merge-PresetWithBase',
        'Export-PresetAsProfile',
        'Get-ProjectProfile',
        'Format-PresetList',
        'Get-CoalescedValue'
    )
}
