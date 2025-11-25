#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Centralized constants and configuration defaults for claude-vibe plugin.

.DESCRIPTION
    Defines all magic numbers and default values used across the plugin modules.
    This provides a single source of truth for configuration values and makes
    it easier to maintain and modify settings.

.NOTES
    Author: claude-vibe
    Version: 1.0.0

    Usage: Source this file at the beginning of scripts that need these constants.
    Example: . "$PSScriptRoot\constants.ps1"
#>

#region Storage Constants

# File lock settings
Set-Variable -Name 'STALE_LOCK_THRESHOLD_SECONDS' -Value 60 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'DEFAULT_LOCK_TIMEOUT_MS' -Value 5000 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'DEFAULT_LOCK_RETRY_INTERVAL_MS' -Value 100 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# Backup settings
Set-Variable -Name 'DEFAULT_MAX_BACKUPS' -Value 3 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MAX_BACKUPS_LIMIT' -Value 100 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# JSON serialization
Set-Variable -Name 'DEFAULT_JSON_DEPTH' -Value 5 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'DEEP_JSON_DEPTH' -Value 10 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Prompt Analyzer Constants

# Ambiguity scoring thresholds
Set-Variable -Name 'AMBIGUITY_THRESHOLD' -Value 40 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'AMBIGUITY_INCREMENT_STANDARD' -Value 20 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# Word count thresholds
Set-Variable -Name 'MIN_WORD_COUNT_SHORT' -Value 5 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MIN_WORD_COUNT_CODING' -Value 10 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Parser Constants

# AGENTS.md file size limits
Set-Variable -Name 'DEFAULT_MAX_AGENTS_MD_SIZE_KB' -Value 50 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# Directory search depth
Set-Variable -Name 'DEFAULT_LOCAL_MAX_DEPTH' -Value 3 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MAX_LOCAL_DEPTH_LIMIT' -Value 10 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Project Detector Constants

# Scoring weights for project detection
Set-Variable -Name 'DETECTION_FILE_SCORE' -Value 10 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'DETECTION_PATTERN_SCORE' -Value 5 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# Minimum confidence threshold for project detection
Set-Variable -Name 'MIN_DETECTION_CONFIDENCE' -Value 0.3 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region MCP Server Constants

# Default estimated token usage per MCP server (when not specified)
Set-Variable -Name 'DEFAULT_MCP_TOKEN_ESTIMATE' -Value 5000 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Context Size Limits

# Context pruning limits (KB)
Set-Variable -Name 'DEFAULT_MAX_CONTEXT_SIZE_KB' -Value 100 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MIN_CONTEXT_SIZE_KB' -Value 50 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MAX_CONTEXT_SIZE_KB' -Value 150 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

# History item limits
Set-Variable -Name 'DEFAULT_MAX_HISTORY_ITEMS' -Value 20 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'DEFAULT_MAX_TOOL_HISTORY' -Value 10 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Hook Timeout Constants

# Default hook execution timeout (ms)
Set-Variable -Name 'DEFAULT_HOOK_TIMEOUT_MS' -Value 5000 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'MAX_HOOK_TIMEOUT_MS' -Value 60000 -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Path Constants

# Base directories (can be overridden by environment variables)
# CLAUDE_VIBE_DATA_DIR overrides the default data directory
$script:DefaultDataDir = Join-Path $env:USERPROFILE ".claude\claude-vibe"
$script:DataDir = if ($env:CLAUDE_VIBE_DATA_DIR) { $env:CLAUDE_VIBE_DATA_DIR } else { $script:DefaultDataDir }

# Claude configuration paths
# CLAUDE_CONFIG_DIR overrides the default Claude config directory
$script:DefaultClaudeConfigDir = Join-Path $env:USERPROFILE ".claude"
$script:ClaudeConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { $script:DefaultClaudeConfigDir }

# Derived paths
Set-Variable -Name 'CONTEXTS_PATH' -Value (Join-Path $script:DataDir "contexts") -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'USER_PRESETS_PATH' -Value (Join-Path $script:DataDir "presets") -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'GLOBAL_MCP_CONFIG_PATH' -Value (Join-Path $script:ClaudeConfigDir "claude_code_config.json") -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Version Constants

Set-Variable -Name 'PLUGIN_VERSION' -Value '0.3.0' -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue
Set-Variable -Name 'SCHEMA_VERSION' -Value '1.0.0' -Option ReadOnly -Scope Script -ErrorAction SilentlyContinue

#endregion

#region Export Helper Function

<#
.SYNOPSIS
    Gets the value of a constant with a fallback default.

.DESCRIPTION
    Safely retrieves a constant value, returning a default if not defined.
    Useful for backwards compatibility when constants may not be loaded.
    Distinguishes between "constant not defined" and "constant defined as null".

.PARAMETER Name
    The name of the constant to retrieve.

.PARAMETER Default
    The default value to return if the constant is not defined.
    This is only used when the constant variable does not exist.

.PARAMETER Required
    If specified, throws an error when the constant is not defined.

.OUTPUTS
    The constant value or the default.

.EXAMPLE
    $threshold = Get-ConstantValue -Name 'AMBIGUITY_THRESHOLD' -Default 40

.EXAMPLE
    $version = Get-ConstantValue -Name 'PLUGIN_VERSION' -Required
#>
function Get-ConstantValue {
    [CmdletBinding()]
    [OutputType([object])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Name,

        [Parameter()]
        [object]$Default = $null,

        [Parameter()]
        [switch]$Required
    )

    # Get the variable object itself (not just the value)
    $variable = Get-Variable -Name $Name -Scope Script -ErrorAction SilentlyContinue

    # Check if the variable exists (not just if it has a value)
    if ($null -eq $variable) {
        if ($Required) {
            throw "Required constant '$Name' is not defined."
        }
        return $Default
    }

    # Return the actual value (which could be $null intentionally)
    return $variable.Value
}

#endregion

#region Module Export

# Export functions (only when loaded as module)
if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Get-ConstantValue'
    ) -Variable @(
        'STALE_LOCK_THRESHOLD_SECONDS',
        'DEFAULT_LOCK_TIMEOUT_MS',
        'DEFAULT_LOCK_RETRY_INTERVAL_MS',
        'DEFAULT_MAX_BACKUPS',
        'MAX_BACKUPS_LIMIT',
        'DEFAULT_JSON_DEPTH',
        'DEEP_JSON_DEPTH',
        'AMBIGUITY_THRESHOLD',
        'AMBIGUITY_INCREMENT_STANDARD',
        'MIN_WORD_COUNT_SHORT',
        'MIN_WORD_COUNT_CODING',
        'DEFAULT_MAX_AGENTS_MD_SIZE_KB',
        'DEFAULT_LOCAL_MAX_DEPTH',
        'MAX_LOCAL_DEPTH_LIMIT',
        'DETECTION_FILE_SCORE',
        'DETECTION_PATTERN_SCORE',
        'MIN_DETECTION_CONFIDENCE',
        'DEFAULT_MCP_TOKEN_ESTIMATE',
        'DEFAULT_MAX_CONTEXT_SIZE_KB',
        'MIN_CONTEXT_SIZE_KB',
        'MAX_CONTEXT_SIZE_KB',
        'DEFAULT_MAX_HISTORY_ITEMS',
        'DEFAULT_MAX_TOOL_HISTORY',
        'DEFAULT_HOOK_TIMEOUT_MS',
        'MAX_HOOK_TIMEOUT_MS',
        'CONTEXTS_PATH',
        'USER_PRESETS_PATH',
        'GLOBAL_MCP_CONFIG_PATH',
        'PLUGIN_VERSION',
        'SCHEMA_VERSION'
    )
}

#endregion
