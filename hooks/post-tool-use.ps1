#Requires -Version 5.1
<#
.SYNOPSIS
    PostToolUse hook for pattern learning and optimization suggestions.

.DESCRIPTION
    Tracks tool usage patterns and provides optimization suggestions
    when inefficiencies are detected. Part of claude-vibe v0.3.0.

.NOTES
    Author: claude-vibe
    Version: 0.3.0

    Input: JSON via stdin with tool_name, tool_input, tool_result
    Output: Optional optimization suggestion to stdout
    Exit Codes:
      0 - Success
      2 - Blocking error (avoid using)

.EXAMPLE
    $input | .\post-tool-use.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Source Required Modules

$scriptRoot = $PSScriptRoot
$libPath = Join-Path (Split-Path $scriptRoot -Parent) "lib"

try {
    . "$libPath\core\pattern-analyzer.ps1"
} catch {
    # Graceful degradation - pattern analyzer not available
    Write-Output ""
    exit 0
}

#endregion

#region Helper Functions

<#
.SYNOPSIS
    Extracts the target from tool input based on tool type.

.PARAMETER ToolName
    Name of the tool.

.PARAMETER ToolInput
    The tool input hashtable.

.OUTPUTS
    The target string (file path, query, etc.)
#>
function Get-ToolTarget {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ToolName,

        [Parameter()]
        $ToolInput
    )

    if ($null -eq $ToolInput) {
        return ""
    }

    switch ($ToolName) {
        "Read" { return $ToolInput.file_path }
        "Write" { return $ToolInput.file_path }
        "Edit" { return $ToolInput.file_path }
        "MultiEdit" { return $ToolInput.file_path }
        "Glob" { return $ToolInput.pattern }
        "Grep" { return $ToolInput.pattern }
        "Bash" { return $ToolInput.command }
        "Task" { return $ToolInput.description }
        "WebFetch" { return $ToolInput.url }
        "WebSearch" { return $ToolInput.query }
        default { return "" }
    }
}

<#
.SYNOPSIS
    Determines if tool execution was successful.

.PARAMETER ToolResult
    The tool result object.

.OUTPUTS
    Boolean indicating success.
#>
function Test-ToolSuccess {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter()]
        $ToolResult
    )

    if ($null -eq $ToolResult) {
        return $true  # Assume success if no result
    }

    # Check for error indicators
    if ($ToolResult -is [hashtable]) {
        if ($ToolResult.ContainsKey('error') -and $ToolResult.error) {
            return $false
        }
        if ($ToolResult.ContainsKey('success') -and -not $ToolResult.success) {
            return $false
        }
    }

    return $true
}

<#
.SYNOPSIS
    Safely converts PSObject to hashtable.

.PARAMETER Object
    The object to convert.

.OUTPUTS
    Hashtable representation.
#>
function ConvertTo-HashtableRecursive {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        $Object
    )

    if ($null -eq $Object) {
        return $null
    }

    if ($Object -is [hashtable]) {
        return $Object
    }

    if ($Object -is [PSCustomObject]) {
        $hash = @{}
        foreach ($prop in $Object.PSObject.Properties) {
            $hash[$prop.Name] = ConvertTo-HashtableRecursive -Object $prop.Value
        }
        return $hash
    }

    if ($Object -is [array]) {
        return @($Object | ForEach-Object { ConvertTo-HashtableRecursive -Object $_ })
    }

    return $Object
}

#endregion

#region Main Execution

try {
    # Read JSON input from stdin
    $inputJson = [Console]::In.ReadToEnd()

    if ([string]::IsNullOrWhiteSpace($inputJson)) {
        Write-Output ""
        exit 0
    }

    # Parse JSON input
    $parsed = $inputJson | ConvertFrom-Json
    $hookInput = ConvertTo-HashtableRecursive -Object $parsed

    if ($null -eq $hookInput -or $hookInput -isnot [hashtable]) {
        Write-Output ""
        exit 0
    }

    # Extract tool information
    $toolName = if ($hookInput.ContainsKey('tool_name')) { $hookInput.tool_name } else { "" }
    $toolInput = if ($hookInput.ContainsKey('tool_input')) { $hookInput.tool_input } else { $null }
    $toolResult = if ($hookInput.ContainsKey('tool_result')) { $hookInput.tool_result } else { $null }
    $sessionId = if ($hookInput.ContainsKey('session_id')) { $hookInput.session_id } else { "" }

    if (-not $toolName) {
        Write-Output ""
        exit 0
    }

    # Extract target and success status
    $target = Get-ToolTarget -ToolName $toolName -ToolInput $toolInput
    $success = Test-ToolSuccess -ToolResult $toolResult

    # Record tool usage
    Add-ToolUsage -ToolName $toolName -Target $target -Success $success -SessionId $sessionId

    # Analyze patterns (every 5 tool uses to avoid overhead)
    $history = Get-PatternHistory
    if ($history.tool_history.Count % 5 -eq 0) {
        $patterns = Find-InefficiencyPatterns -WindowSize 20

        if ($patterns.Count -gt 0) {
            # Check cooldown to avoid spamming suggestions
            $topPattern = ($patterns | Sort-Object -Property weight -Descending)[0]

            if (-not (Test-SuggestionCooldown -PatternType $topPattern.pattern -CooldownMinutes 10)) {
                $suggestion = Get-OptimizationSuggestion -Patterns $patterns

                if ($suggestion) {
                    Add-SuggestionShown -PatternType $topPattern.pattern
                    Write-Output $suggestion
                    exit 0
                }
            }
        }
    }

    Write-Output ""
    exit 0

} catch {
    # Graceful degradation on any error
    $errorMessage = $_.Exception.Message
    [Console]::Error.WriteLine("PostToolUse hook error: $errorMessage")

    Write-Output ""
    exit 0
}

#endregion
