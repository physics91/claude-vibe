#Requires -Version 5.1
<#
.SYNOPSIS
    Project Profile Manager for claude-vibe persistent preferences.

.DESCRIPTION
    Manages project-specific profiles and user preferences that persist across sessions.
    Stores profiles in .claude/project-profile.json within each project.

.NOTES
    Author: claude-vibe
    Version: 0.3.0
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Configuration

$script:ProfileFileName = "project-profile.json"
$script:ProfileVersion = "1.0"
$script:GlobalPrefsPath = Join-Path $env:USERPROFILE ".claude\claude-vibe\global-preferences.json"

#endregion

#region Profile Storage

<#
.SYNOPSIS
    Gets the profile file path for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Full path to the project profile file.
#>
function Get-ProfilePath {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $claudeDir = Join-Path $ProjectRoot ".claude"
    return Join-Path $claudeDir $script:ProfileFileName
}

<#
.SYNOPSIS
    Ensures the .claude directory exists in the project.

.PARAMETER ProjectRoot
    The project root directory.
#>
function Initialize-ProfileDirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $claudeDir = Join-Path $ProjectRoot ".claude"
    if (-not (Test-Path $claudeDir)) {
        New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    }
}

<#
.SYNOPSIS
    Loads the project profile.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Project profile hashtable or null if not found.
#>
function Get-ProjectProfile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $profilePath = Get-ProfilePath -ProjectRoot $ProjectRoot

    if (-not (Test-Path $profilePath)) {
        return $null
    }

    try {
        $content = Get-Content $profilePath -Raw | ConvertFrom-Json

        # Convert to hashtable
        $profile = @{
            version = $content.version
            name = $content.name
            displayName = $content.displayName
            preset = $content.preset
            created_at = $content.created_at
            updated_at = $content.updated_at
            preferences = @{}
            mcp = @{}
            agents = @{}
            skills = @{}
            express_commands = @{}
        }

        # Convert nested objects
        if ($content.preferences) {
            foreach ($prop in $content.preferences.PSObject.Properties) {
                $profile.preferences[$prop.Name] = $prop.Value
            }
        }

        if ($content.mcp) {
            foreach ($prop in $content.mcp.PSObject.Properties) {
                $profile.mcp[$prop.Name] = $prop.Value
            }
        }

        if ($content.agents) {
            foreach ($prop in $content.agents.PSObject.Properties) {
                $profile.agents[$prop.Name] = $prop.Value
            }
        }

        if ($content.skills) {
            foreach ($prop in $content.skills.PSObject.Properties) {
                $profile.skills[$prop.Name] = $prop.Value
            }
        }

        if ($content.express_commands) {
            foreach ($prop in $content.express_commands.PSObject.Properties) {
                $profile.express_commands[$prop.Name] = $prop.Value
            }
        }

        return $profile
    } catch {
        return $null
    }
}

<#
.SYNOPSIS
    Creates a new project profile.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Preset
    The preset to base the profile on.

.PARAMETER DisplayName
    Human-readable name for the profile.

.OUTPUTS
    The newly created profile hashtable.
#>
function New-ProjectProfile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [string]$Preset = "minimal",

        [Parameter()]
        [string]$DisplayName = ""
    )

    $now = [datetime]::UtcNow.ToString('o')

    $profile = @{
        version = $script:ProfileVersion
        name = Split-Path $ProjectRoot -Leaf
        displayName = if ($DisplayName) { $DisplayName } else { Split-Path $ProjectRoot -Leaf }
        preset = $Preset
        created_at = $now
        updated_at = $now
        preferences = @{
            auto_suggestions = $true
            express_commands_enabled = $true
            pattern_learning = $true
            suggestion_cooldown_minutes = 10
        }
        mcp = @{
            enabled = @("*")
            disabled = @()
        }
        agents = @{
            enabled = @("*")
            disabled = @()
            favorites = @()
        }
        skills = @{
            auto_activate = $true
            disabled = @()
            custom = @()
        }
        express_commands = @{
            sticky_options = @{}
            last_used = @{}
        }
    }

    return $profile
}

<#
.SYNOPSIS
    Saves a project profile.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Profile
    The profile hashtable to save.
#>
function Save-ProjectProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Profile
    )

    Initialize-ProfileDirectory -ProjectRoot $ProjectRoot

    $Profile.updated_at = [datetime]::UtcNow.ToString('o')

    $profilePath = Get-ProfilePath -ProjectRoot $ProjectRoot
    $Profile | ConvertTo-Json -Depth 10 | Set-Content $profilePath -Encoding UTF8
}

<#
.SYNOPSIS
    Updates specific profile settings.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Settings
    Hashtable of settings to update.

.OUTPUTS
    Updated profile hashtable.
#>
function Update-ProjectProfile {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Settings
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        $profile = New-ProjectProfile -ProjectRoot $ProjectRoot
    }

    # Merge settings
    foreach ($key in $Settings.Keys) {
        if ($profile.ContainsKey($key)) {
            if ($profile[$key] -is [hashtable] -and $Settings[$key] -is [hashtable]) {
                # Merge nested hashtable
                foreach ($subKey in $Settings[$key].Keys) {
                    $profile[$key][$subKey] = $Settings[$key][$subKey]
                }
            } else {
                $profile[$key] = $Settings[$key]
            }
        } else {
            $profile[$key] = $Settings[$key]
        }
    }

    Save-ProjectProfile -ProjectRoot $ProjectRoot -Profile $profile

    return $profile
}

#endregion

#region Preference Management

<#
.SYNOPSIS
    Gets a specific preference value.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Key
    The preference key.

.PARAMETER Default
    Default value if not found.

.OUTPUTS
    The preference value.
#>
function Get-Preference {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter()]
        $Default = $null
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        return $Default
    }

    if ($profile.preferences.ContainsKey($Key)) {
        return $profile.preferences[$Key]
    }

    return $Default
}

<#
.SYNOPSIS
    Sets a specific preference value.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Key
    The preference key.

.PARAMETER Value
    The value to set.
#>
function Set-Preference {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        $Value
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        $profile = New-ProjectProfile -ProjectRoot $ProjectRoot
    }

    $profile.preferences[$Key] = $Value
    Save-ProjectProfile -ProjectRoot $ProjectRoot -Profile $profile
}

#endregion

#region Express Command State

<#
.SYNOPSIS
    Gets sticky options for an express command.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Command
    The command name (e.g., "r", "t", "f").

.OUTPUTS
    Hashtable of sticky options or empty hashtable.
#>
function Get-StickyOptions {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        return @{}
    }

    if ($profile.express_commands.sticky_options.ContainsKey($Command)) {
        $options = $profile.express_commands.sticky_options[$Command]

        if ($options -is [hashtable]) {
            return $options
        }

        # Convert from PSCustomObject
        $result = @{}
        foreach ($prop in $options.PSObject.Properties) {
            $result[$prop.Name] = $prop.Value
        }
        return $result
    }

    return @{}
}

<#
.SYNOPSIS
    Saves sticky options for an express command.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Command
    The command name.

.PARAMETER Options
    The options to save.
#>
function Set-StickyOptions {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(Mandatory = $true)]
        [hashtable]$Options
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        $profile = New-ProjectProfile -ProjectRoot $ProjectRoot
    }

    $profile.express_commands.sticky_options[$Command] = $Options
    $profile.express_commands.last_used[$Command] = [datetime]::UtcNow.ToString('o')

    Save-ProjectProfile -ProjectRoot $ProjectRoot -Profile $profile
}

<#
.SYNOPSIS
    Records command usage for analytics.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Command
    The command name.
#>
function Add-CommandUsage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $profile = Get-ProjectProfile -ProjectRoot $ProjectRoot

    if (-not $profile) {
        return
    }

    $profile.express_commands.last_used[$Command] = [datetime]::UtcNow.ToString('o')
    Save-ProjectProfile -ProjectRoot $ProjectRoot -Profile $profile
}

#endregion

#region Global Preferences

<#
.SYNOPSIS
    Loads global preferences.

.OUTPUTS
    Global preferences hashtable.
#>
function Get-GlobalPreferences {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    if (-not (Test-Path $script:GlobalPrefsPath)) {
        return @{
            version = $script:ProfileVersion
            default_preset = "minimal"
            auto_setup = $true
            telemetry_enabled = $false
        }
    }

    try {
        $content = Get-Content $script:GlobalPrefsPath -Raw | ConvertFrom-Json

        $prefs = @{}
        foreach ($prop in $content.PSObject.Properties) {
            $prefs[$prop.Name] = $prop.Value
        }
        return $prefs
    } catch {
        return @{
            version = $script:ProfileVersion
            default_preset = "minimal"
            auto_setup = $true
            telemetry_enabled = $false
        }
    }
}

<#
.SYNOPSIS
    Saves global preferences.

.PARAMETER Preferences
    The preferences hashtable to save.
#>
function Save-GlobalPreferences {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Preferences
    )

    $dir = Split-Path $script:GlobalPrefsPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $Preferences | ConvertTo-Json -Depth 10 | Set-Content $script:GlobalPrefsPath -Encoding UTF8
}

#endregion

#region Export

Export-ModuleMember -Function @(
    'Get-ProfilePath',
    'Get-ProjectProfile',
    'New-ProjectProfile',
    'Save-ProjectProfile',
    'Update-ProjectProfile',
    'Get-Preference',
    'Set-Preference',
    'Get-StickyOptions',
    'Set-StickyOptions',
    'Add-CommandUsage',
    'Get-GlobalPreferences',
    'Save-GlobalPreferences'
)

#endregion
