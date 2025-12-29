#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    MCP configuration generator for Context Manager feature.

.DESCRIPTION
    Generates project-level .mcp.json files based on context profiles
    to control which MCP servers are active for a project.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Module Dependencies
. (Join-Path $PSScriptRoot "..\utils\require-modules.ps1") -ModuleName 'mcp-config-generator'
#endregion

#region Configuration

# Use configurable path from constants (supports CLAUDE_CONFIG_DIR env override)
$script:GlobalMcpConfigPath = $script:GLOBAL_MCP_CONFIG_PATH
$script:DefaultMcpTokenEstimate = Get-ConstantValue -Name 'DEFAULT_MCP_TOKEN_ESTIMATE' -Default 5000

#endregion

#region MCP Server Discovery

<#
.SYNOPSIS
    Gets all available MCP servers from the global configuration.

.OUTPUTS
    Hashtable of MCP server configurations keyed by server name.
#>
function Get-AvailableMcpServers {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    $servers = @{}

    $config = Read-JsonFile -Path $script:GlobalMcpConfigPath
    if ($null -eq $config) {
        Write-Verbose "Global MCP config not found or invalid: $script:GlobalMcpConfigPath"
        return $servers
    }

    # Safely check for mcpServers property (StrictMode compatible)
    $hasMcpServers = $config.PSObject.Properties.Name -contains 'mcpServers'
    if ($hasMcpServers -and $null -ne $config.mcpServers) {
        foreach ($prop in $config.mcpServers.PSObject.Properties) {
            $serverValue = $prop.Value
            $serverProps = $serverValue.PSObject.Properties.Name

            $servers[$prop.Name] = @{
                name = $prop.Name
                command = if ($serverProps -contains 'command') { $serverValue.command } else { $null }
                args = if ($serverProps -contains 'args') { $serverValue.args } else { $null }
                cwd = if ($serverProps -contains 'cwd') { $serverValue.cwd } else { $null }
                env = if ($serverProps -contains 'env') { $serverValue.env } else { $null }
                estimatedTokens = Get-EstimatedMcpTokens -ServerName $prop.Name
            }
        }
    }

    return $servers
}

<#
.SYNOPSIS
    Estimates token usage for a given MCP server.

.PARAMETER ServerName
    The name of the MCP server.

.OUTPUTS
    Estimated token count.
#>
function Get-EstimatedMcpTokens {
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServerName
    )

    # Known token estimates for common MCP servers
    $knownEstimates = @{
        "github" = 8000
        "playwright" = 12000
        "brave-search" = 3000
        "context7" = 5000
        "sequential-thinking" = 2000
        "ai-code-agent-mcp" = 6000
        "filesystem" = 4000
        "openrouter" = 5000
        "openrouter-mcp" = 5000
        "database" = 4000
        "kubernetes" = 6000
    }

    if ($knownEstimates.ContainsKey($ServerName)) {
        return $knownEstimates[$ServerName]
    }

    # Default estimate for unknown servers
    return $script:DefaultMcpTokenEstimate
}

<#
.SYNOPSIS
    Formats MCP server list for display.

.PARAMETER Servers
    Hashtable of MCP servers.

.PARAMETER EnabledServers
    Array of enabled server names.

.OUTPUTS
    Formatted markdown string.
#>
function Format-McpServerList {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Servers,

        [Parameter()]
        [array]$EnabledServers = @()
    )

    $output = @()

    foreach ($name in ($Servers.Keys | Sort-Object)) {
        $server = $Servers[$name]
        $status = if ($EnabledServers -contains $name -or $EnabledServers -contains "*") { "[x]" } else { "[ ]" }
        $tokens = if ($server.estimatedTokens) { "(~$($server.estimatedTokens) tokens)" } else { "" }
        $output += "$status **$name** $tokens"
    }

    return $output -join "`n"
}

#endregion

#region MCP Config Generation

<#
.SYNOPSIS
    Generates a project-level .mcp.json file.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER EnabledServers
    Array of MCP server names to enable.

.PARAMETER DisabledServers
    Array of MCP server names to disable (* for all not in enabled).

.OUTPUTS
    The path to the generated .mcp.json file.
#>
function New-McpConfigFile {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [array]$EnabledServers = @(),

        [Parameter()]
        [array]$DisabledServers = @()
    )

    $availableServers = Get-AvailableMcpServers

    # Build MCP config with only enabled servers
    $mcpConfig = @{
        mcpServers = @{}
    }

    # Determine which servers to include
    $serversToInclude = @()

    if ($EnabledServers -contains "*") {
        # Include all except explicitly disabled
        $serversToInclude = $availableServers.Keys | Where-Object { $DisabledServers -notcontains $_ }
    }
    elseif ($EnabledServers.Count -gt 0) {
        # Include only explicitly enabled
        $serversToInclude = $EnabledServers | Where-Object { $availableServers.ContainsKey($_) }
    }
    else {
        # No servers enabled
        $serversToInclude = @()
    }

    # Build the config
    foreach ($serverName in $serversToInclude) {
        if ($availableServers.ContainsKey($serverName)) {
            $serverConfig = $availableServers[$serverName]
            $mcpConfig.mcpServers[$serverName] = @{}

            if ($serverConfig.command) {
                $mcpConfig.mcpServers[$serverName].command = $serverConfig.command
            }
            if ($serverConfig.args) {
                $mcpConfig.mcpServers[$serverName].args = $serverConfig.args
            }
            if ($serverConfig.cwd) {
                $mcpConfig.mcpServers[$serverName].cwd = $serverConfig.cwd
            }
            if ($serverConfig.env) {
                $mcpConfig.mcpServers[$serverName].env = $serverConfig.env
            }
        }
    }

    # Ensure .claude directory exists
    $claudeDir = Join-Path $ProjectRoot ".claude"
    if (-not (Test-Path $claudeDir)) {
        New-Item -Path $claudeDir -ItemType Directory -Force | Out-Null
    }

    # Write the config file
    $outputPath = Join-Path $claudeDir ".mcp.json"
    $json = $mcpConfig | ConvertTo-Json -Depth 10
    $json | Set-Content -Path $outputPath -Encoding UTF8 -Force

    return $outputPath
}

<#
.SYNOPSIS
    Generates MCP config from a context profile.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Profile
    The context profile configuration.

.OUTPUTS
    The path to the generated .mcp.json file.
#>
function New-McpConfigFromProfile {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Profile
    )

    $enabledServers = @()
    $disabledServers = @()

    if ($Profile.mcp) {
        if ($Profile.mcp.enabled) {
            $enabledServers = @($Profile.mcp.enabled)
        }
        if ($Profile.mcp.disabled) {
            $disabledServers = @($Profile.mcp.disabled)
        }
    }

    return New-McpConfigFile -ProjectRoot $ProjectRoot -EnabledServers $enabledServers -DisabledServers $disabledServers
}

<#
.SYNOPSIS
    Removes the project-level .mcp.json file.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    $true if removed, $false otherwise.
#>
function Remove-McpConfigFile {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $mcpConfigPath = Join-Path $ProjectRoot ".claude\.mcp.json"

    if (Test-Path $mcpConfigPath) {
        Remove-Item -Path $mcpConfigPath -Force
        return $true
    }

    return $false
}

<#
.SYNOPSIS
    Gets the current MCP config for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    The MCP config if found, $null otherwise.
#>
function Get-ProjectMcpConfig {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $mcpConfigPath = Join-Path $ProjectRoot ".claude\.mcp.json"

    $config = Read-JsonAsHashtable -Path $mcpConfigPath
    if ($config.Count -eq 0) {
        return $null
    }
    return $config
}

<#
.SYNOPSIS
    Calculates estimated token savings from a profile.

.PARAMETER Profile
    The context profile configuration.

.OUTPUTS
    Estimated tokens saved.
#>
function Get-EstimatedTokenSavings {
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Profile
    )

    $availableServers = Get-AvailableMcpServers
    $totalAvailable = 0
    $totalEnabled = 0

    foreach ($serverName in $availableServers.Keys) {
        $totalAvailable += $availableServers[$serverName].estimatedTokens
    }

    $enabledServers = @()
    if ($Profile.mcp -and $Profile.mcp.enabled) {
        $enabledServers = @($Profile.mcp.enabled)
    }

    if ($enabledServers -contains "*") {
        $disabledServers = @()
        if ($Profile.mcp -and $Profile.mcp.disabled) {
            $disabledServers = @($Profile.mcp.disabled)
        }

        foreach ($serverName in $availableServers.Keys) {
            if ($disabledServers -notcontains $serverName) {
                $totalEnabled += $availableServers[$serverName].estimatedTokens
            }
        }
    }
    else {
        foreach ($serverName in $enabledServers) {
            if ($availableServers.ContainsKey($serverName)) {
                $totalEnabled += $availableServers[$serverName].estimatedTokens
            }
        }
    }

    return [math]::Max(0, $totalAvailable - $totalEnabled)
}

#endregion

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-AvailableMcpServers',
        'Get-EstimatedMcpTokens',
        'Format-McpServerList',
        'New-McpConfigFile',
        'New-McpConfigFromProfile',
        'Remove-McpConfigFile',
        'Get-ProjectMcpConfig',
        'Get-EstimatedTokenSavings'
    )
}


