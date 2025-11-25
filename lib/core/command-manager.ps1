#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Slash command management module for Context Manager feature.

.DESCRIPTION
    Manages plugin-level slash commands by copying/removing files
    between managed-commands folder and project .claude/commands folder.

    Note: This module only manages plugin-level commands.
    Global commands (~/.claude/commands) are NOT managed.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Configuration

# Plugin root directory (parent of lib folder)
$script:PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:ManagedCommandsPath = Join-Path $script:PluginRoot "managed-commands"

# Estimated tokens per command (based on typical prompt length)
$script:DefaultCommandTokens = 150

#endregion

#region Command Discovery

<#
.SYNOPSIS
    Gets all available managed commands from the plugin.

.OUTPUTS
    Array of command info objects.
#>
function Get-ManagedCommands {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    $commands = @()

    if (-not (Test-Path $script:ManagedCommandsPath)) {
        Write-Verbose "Managed commands folder not found: $script:ManagedCommandsPath"
        return $commands
    }

    $commandFiles = Get-ChildItem -Path $script:ManagedCommandsPath -Filter "*.md" -File -ErrorAction SilentlyContinue

    foreach ($file in $commandFiles) {
        $commandInfo = Get-CommandInfo -FilePath $file.FullName
        if ($commandInfo) {
            $commands += $commandInfo
        }
    }

    return $commands
}

<#
.SYNOPSIS
    Gets command info from a markdown file.

.PARAMETER FilePath
    Path to the command markdown file.

.OUTPUTS
    Hashtable with command info or $null if invalid.
#>
function Get-CommandInfo {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        return $null
    }

    try {
        $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
        $fileName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)

        # Parse frontmatter
        $description = ""
        $allowedTools = @()

        if ($content -match '^---\r?\n([\s\S]*?)\r?\n---') {
            $frontmatter = $Matches[1]

            if ($frontmatter -match 'description:\s*(.+)') {
                $description = $Matches[1].Trim()
            }

            if ($frontmatter -match 'allowed-tools:\s*(.+)') {
                $allowedTools = $Matches[1].Split(',') | ForEach-Object { $_.Trim() }
            }
        }

        # Estimate tokens based on content length
        $estimatedTokens = [math]::Max(50, [math]::Round($content.Length / 4))

        return @{
            name = $fileName
            path = $FilePath
            description = $description
            allowedTools = $allowedTools
            estimatedTokens = $estimatedTokens
            contentLength = $content.Length
        }
    }
    catch {
        Write-Verbose "Failed to parse command file: $FilePath - $_"
        return $null
    }
}

<#
.SYNOPSIS
    Gets currently enabled commands for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Array of enabled command names.
#>
function Get-EnabledProjectCommands {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $commands = @()
    $commandsPath = Join-Path $ProjectRoot ".claude\commands"

    if (-not (Test-Path $commandsPath)) {
        return $commands
    }

    $managedCommands = Get-ManagedCommands
    $managedNames = $managedCommands | ForEach-Object { $_.name }

    $commandFiles = Get-ChildItem -Path $commandsPath -Filter "*.md" -File -ErrorAction SilentlyContinue

    foreach ($file in $commandFiles) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        # Only include commands that are managed by this plugin
        if ($managedNames -contains $name) {
            $commands += $name
        }
    }

    return $commands
}

#endregion

#region Command Management

<#
.SYNOPSIS
    Enables a managed command for a project.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER CommandName
    The name of the command to enable.

.OUTPUTS
    $true if successful, $false otherwise.
#>
function Enable-ProjectCommand {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    $sourcePath = Join-Path $script:ManagedCommandsPath "$CommandName.md"

    if (-not (Test-Path $sourcePath)) {
        Write-Warning "Managed command not found: $CommandName"
        return $false
    }

    # Ensure .claude/commands directory exists
    $targetDir = Join-Path $ProjectRoot ".claude\commands"
    if (-not (Test-Path $targetDir)) {
        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
    }

    $targetPath = Join-Path $targetDir "$CommandName.md"

    try {
        Copy-Item -Path $sourcePath -Destination $targetPath -Force
        Write-Verbose "Enabled command: $CommandName"
        return $true
    }
    catch {
        Write-Warning "Failed to enable command $CommandName : $_"
        return $false
    }
}

<#
.SYNOPSIS
    Disables a managed command for a project.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER CommandName
    The name of the command to disable.

.OUTPUTS
    $true if successful, $false otherwise.
#>
function Disable-ProjectCommand {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    $targetPath = Join-Path $ProjectRoot ".claude\commands\$CommandName.md"

    if (-not (Test-Path $targetPath)) {
        Write-Verbose "Command already disabled: $CommandName"
        return $true
    }

    # Verify it's a managed command (safety check)
    $managedCommands = Get-ManagedCommands
    $managedNames = $managedCommands | ForEach-Object { $_.name }

    if ($managedNames -notcontains $CommandName) {
        Write-Warning "Cannot disable non-managed command: $CommandName"
        return $false
    }

    try {
        Remove-Item -Path $targetPath -Force
        Write-Verbose "Disabled command: $CommandName"
        return $true
    }
    catch {
        Write-Warning "Failed to disable command $CommandName : $_"
        return $false
    }
}

<#
.SYNOPSIS
    Enables multiple commands based on a list.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER CommandNames
    Array of command names to enable. Use "*" for all.

.PARAMETER DisableOthers
    If true, disable commands not in the list.

.OUTPUTS
    Hashtable with enabled and failed counts.
#>
function Set-ProjectCommands {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [array]$EnabledCommands = @(),

        [Parameter()]
        [array]$DisabledCommands = @()
    )

    $result = @{
        enabled = @()
        disabled = @()
        failed = @()
    }

    $managedCommands = Get-ManagedCommands
    $allManagedNames = $managedCommands | ForEach-Object { $_.name }

    # Determine which commands to enable
    $toEnable = @()
    if ($EnabledCommands -contains "*") {
        $toEnable = $allManagedNames | Where-Object { $DisabledCommands -notcontains $_ }
    }
    else {
        $toEnable = $EnabledCommands | Where-Object { $allManagedNames -contains $_ }
    }

    # Determine which commands to disable
    $toDisable = @()
    if ($DisabledCommands -contains "*") {
        $toDisable = $allManagedNames | Where-Object { $EnabledCommands -notcontains $_ }
    }
    else {
        $toDisable = $DisabledCommands | Where-Object { $allManagedNames -contains $_ }
    }

    # Enable commands
    foreach ($name in $toEnable) {
        if (Enable-ProjectCommand -ProjectRoot $ProjectRoot -CommandName $name) {
            $result.enabled += $name
        }
        else {
            $result.failed += $name
        }
    }

    # Disable commands
    foreach ($name in $toDisable) {
        if (Disable-ProjectCommand -ProjectRoot $ProjectRoot -CommandName $name) {
            $result.disabled += $name
        }
        else {
            $result.failed += $name
        }
    }

    return $result
}

#endregion

#region Token Estimation

<#
.SYNOPSIS
    Estimates token savings from command configuration.

.PARAMETER EnabledCommands
    Array of enabled command names.

.OUTPUTS
    Estimated tokens saved.
#>
function Get-CommandTokenSavings {
    [CmdletBinding()]
    [OutputType([int])]
    param(
        [Parameter()]
        [array]$EnabledCommands = @()
    )

    $managedCommands = Get-ManagedCommands
    $totalAvailable = 0
    $totalEnabled = 0

    foreach ($cmd in $managedCommands) {
        $totalAvailable += $cmd.estimatedTokens

        if ($EnabledCommands -contains "*" -or $EnabledCommands -contains $cmd.name) {
            $totalEnabled += $cmd.estimatedTokens
        }
    }

    return [math]::Max(0, $totalAvailable - $totalEnabled)
}

<#
.SYNOPSIS
    Formats command list for display.

.PARAMETER EnabledCommands
    Array of enabled command names.

.OUTPUTS
    Formatted markdown string.
#>
function Format-CommandList {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter()]
        [array]$EnabledCommands = @()
    )

    $managedCommands = Get-ManagedCommands
    $output = @()

    foreach ($cmd in ($managedCommands | Sort-Object { $_.name })) {
        $isEnabled = $EnabledCommands -contains "*" -or $EnabledCommands -contains $cmd.name
        $status = if ($isEnabled) { "[x]" } else { "[ ]" }
        $tokens = "(~$($cmd.estimatedTokens) tokens)"
        $desc = if ($cmd.description) { " - $($cmd.description)" } else { "" }
        $output += "$status **/$($cmd.name)**$desc $tokens"
    }

    return $output -join "`n"
}

#endregion

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-ManagedCommands',
        'Get-CommandInfo',
        'Get-EnabledProjectCommands',
        'Enable-ProjectCommand',
        'Disable-ProjectCommand',
        'Set-ProjectCommands',
        'Get-CommandTokenSavings',
        'Format-CommandList'
    )
}
