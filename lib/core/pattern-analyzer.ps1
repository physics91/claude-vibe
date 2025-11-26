#Requires -Version 5.1
<#
.SYNOPSIS
    Pattern Analyzer module for claude-vibe PostToolUse hook.

.DESCRIPTION
    Analyzes tool usage patterns to detect inefficiencies and suggest optimizations.
    Stores patterns in ~/.claude/claude-vibe/patterns.json

.NOTES
    Author: claude-vibe
    Version: 0.3.0
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Configuration

$script:PatternStoragePath = Join-Path $env:USERPROFILE ".claude\claude-vibe\patterns.json"
$script:MaxPatternHistory = 1000
$script:PatternVersion = "1.0"

# Inefficiency patterns to detect
$script:InefficiencyPatterns = @{
    # Multiple reads of same file
    "repeated_file_read" = @{
        Description = "Reading the same file multiple times"
        Suggestion = "Consider caching file contents or using Edit instead of Read+Write"
        Weight = 2
    }
    # Grep followed by Read (could use Grep with context)
    "grep_then_read" = @{
        Description = "Grep followed by Read on same file"
        Suggestion = "Use Grep with -A/-B/-C context options instead"
        Weight = 1
    }
    # Multiple small edits (could batch)
    "fragmented_edits" = @{
        Description = "Multiple small edits to same file"
        Suggestion = "Consider using MultiEdit to batch changes"
        Weight = 2
    }
    # Glob followed by many Reads
    "glob_then_many_reads" = @{
        Description = "Glob followed by reading many files"
        Suggestion = "Consider using Task agent for bulk file operations"
        Weight = 1
    }
    # Repeated failed commands
    "repeated_failures" = @{
        Description = "Repeated command failures"
        Suggestion = "Check command syntax or file paths"
        Weight = 3
    }
}

#endregion

#region Storage Functions

<#
.SYNOPSIS
    Ensures the pattern storage directory exists.
#>
function Initialize-PatternStorage {
    [CmdletBinding()]
    param()

    $storageDir = Split-Path $script:PatternStoragePath -Parent
    if (-not (Test-Path $storageDir)) {
        New-Item -ItemType Directory -Path $storageDir -Force | Out-Null
    }
}

<#
.SYNOPSIS
    Loads pattern history from storage.

.OUTPUTS
    Hashtable containing pattern history and metadata.
#>
function Get-PatternHistory {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    Initialize-PatternStorage

    if (Test-Path $script:PatternStoragePath) {
        try {
            $content = Get-Content $script:PatternStoragePath -Raw | ConvertFrom-Json

            # Convert to hashtable
            $history = @{
                version = $content.version
                updated_at = $content.updated_at
                tool_history = @($content.tool_history)
                detected_patterns = @{}
                suggestions_shown = @($content.suggestions_shown)
                session_stats = @{}
            }

            # Convert nested objects
            if ($content.detected_patterns) {
                foreach ($prop in $content.detected_patterns.PSObject.Properties) {
                    $history.detected_patterns[$prop.Name] = $prop.Value
                }
            }

            if ($content.session_stats) {
                foreach ($prop in $content.session_stats.PSObject.Properties) {
                    $history.session_stats[$prop.Name] = $prop.Value
                }
            }

            return $history
        } catch {
            # Corrupted file, start fresh
            return New-PatternHistory
        }
    }

    return New-PatternHistory
}

<#
.SYNOPSIS
    Creates a new pattern history structure.

.OUTPUTS
    Empty pattern history hashtable.
#>
function New-PatternHistory {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    return @{
        version = $script:PatternVersion
        updated_at = [datetime]::UtcNow.ToString('o')
        tool_history = @()
        detected_patterns = @{}
        suggestions_shown = @()
        session_stats = @{}
    }
}

<#
.SYNOPSIS
    Saves pattern history to storage.

.PARAMETER History
    The pattern history hashtable to save.
#>
function Save-PatternHistory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$History
    )

    Initialize-PatternStorage

    $History.updated_at = [datetime]::UtcNow.ToString('o')

    # Trim history if too large
    if ($History.tool_history.Count -gt $script:MaxPatternHistory) {
        $History.tool_history = $History.tool_history | Select-Object -Last $script:MaxPatternHistory
    }

    $History | ConvertTo-Json -Depth 10 | Set-Content $script:PatternStoragePath -Encoding UTF8
}

#endregion

#region Pattern Recording

<#
.SYNOPSIS
    Records a tool usage event.

.PARAMETER ToolName
    Name of the tool used.

.PARAMETER Target
    Target of the tool (file path, search query, etc.).

.PARAMETER Success
    Whether the tool execution was successful.

.PARAMETER Duration
    Duration of tool execution in milliseconds.

.PARAMETER SessionId
    Current session ID.
#>
function Add-ToolUsage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ToolName,

        [Parameter()]
        [string]$Target = "",

        [Parameter()]
        [bool]$Success = $true,

        [Parameter()]
        [int]$Duration = 0,

        [Parameter()]
        [string]$SessionId = ""
    )

    $history = Get-PatternHistory

    $entry = @{
        tool = $ToolName
        target = $Target
        success = $Success
        duration = $Duration
        timestamp = [datetime]::UtcNow.ToString('o')
        session_id = $SessionId
    }

    $history.tool_history += $entry

    # Update session stats
    if ($SessionId) {
        if (-not $history.session_stats.ContainsKey($SessionId)) {
            $history.session_stats[$SessionId] = @{
                tool_count = 0
                start_time = [datetime]::UtcNow.ToString('o')
            }
        }
        $history.session_stats[$SessionId].tool_count++
    }

    Save-PatternHistory -History $history

    return $entry
}

#endregion

#region Pattern Analysis

<#
.SYNOPSIS
    Analyzes recent tool usage for inefficiency patterns.

.PARAMETER WindowSize
    Number of recent tool usages to analyze.

.OUTPUTS
    Array of detected inefficiency patterns.
#>
function Find-InefficiencyPatterns {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter()]
        [int]$WindowSize = 20
    )

    $history = Get-PatternHistory
    $recentTools = $history.tool_history | Select-Object -Last $WindowSize

    if ($recentTools.Count -lt 3) {
        return @()
    }

    $detected = @()

    # Check for repeated file reads
    $fileReads = $recentTools | Where-Object { $_.tool -eq "Read" }
    $readTargets = $fileReads | Group-Object -Property target | Where-Object { $_.Count -gt 1 }

    foreach ($group in $readTargets) {
        $detected += @{
            pattern = "repeated_file_read"
            description = $script:InefficiencyPatterns["repeated_file_read"].Description
            suggestion = $script:InefficiencyPatterns["repeated_file_read"].Suggestion
            details = "File '$($group.Name)' was read $($group.Count) times"
            weight = $script:InefficiencyPatterns["repeated_file_read"].Weight
        }
    }

    # Check for Grep followed by Read on same file
    for ($i = 0; $i -lt ($recentTools.Count - 1); $i++) {
        $current = $recentTools[$i]
        $next = $recentTools[$i + 1]

        if ($current.tool -eq "Grep" -and $next.tool -eq "Read") {
            # Check if targets are related
            if ($next.target -and $current.target -and $next.target -like "*$($current.target)*") {
                $detected += @{
                    pattern = "grep_then_read"
                    description = $script:InefficiencyPatterns["grep_then_read"].Description
                    suggestion = $script:InefficiencyPatterns["grep_then_read"].Suggestion
                    details = "Grep then Read on '$($next.target)'"
                    weight = $script:InefficiencyPatterns["grep_then_read"].Weight
                }
            }
        }
    }

    # Check for fragmented edits (multiple edits to same file)
    $fileEdits = $recentTools | Where-Object { $_.tool -eq "Edit" }
    $editTargets = $fileEdits | Group-Object -Property target | Where-Object { $_.Count -gt 2 }

    foreach ($group in $editTargets) {
        $detected += @{
            pattern = "fragmented_edits"
            description = $script:InefficiencyPatterns["fragmented_edits"].Description
            suggestion = $script:InefficiencyPatterns["fragmented_edits"].Suggestion
            details = "File '$($group.Name)' was edited $($group.Count) times"
            weight = $script:InefficiencyPatterns["fragmented_edits"].Weight
        }
    }

    # Check for repeated failures
    $failures = $recentTools | Where-Object { -not $_.success }
    if ($failures.Count -gt 2) {
        $failedTools = $failures | Group-Object -Property tool | Where-Object { $_.Count -gt 1 }
        foreach ($group in $failedTools) {
            $detected += @{
                pattern = "repeated_failures"
                description = $script:InefficiencyPatterns["repeated_failures"].Description
                suggestion = $script:InefficiencyPatterns["repeated_failures"].Suggestion
                details = "Tool '$($group.Name)' failed $($group.Count) times"
                weight = $script:InefficiencyPatterns["repeated_failures"].Weight
            }
        }
    }

    # Check for Glob followed by many Reads
    for ($i = 0; $i -lt ($recentTools.Count - 5); $i++) {
        if ($recentTools[$i].tool -eq "Glob") {
            $nextFive = $recentTools[($i+1)..([Math]::Min($i+5, $recentTools.Count-1))]
            $readCount = ($nextFive | Where-Object { $_.tool -eq "Read" }).Count

            if ($readCount -ge 4) {
                $detected += @{
                    pattern = "glob_then_many_reads"
                    description = $script:InefficiencyPatterns["glob_then_many_reads"].Description
                    suggestion = $script:InefficiencyPatterns["glob_then_many_reads"].Suggestion
                    details = "Glob followed by $readCount file reads"
                    weight = $script:InefficiencyPatterns["glob_then_many_reads"].Weight
                }
                break
            }
        }
    }

    return $detected
}

<#
.SYNOPSIS
    Gets tool usage statistics.

.OUTPUTS
    Hashtable with usage statistics.
#>
function Get-ToolUsageStats {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    $history = Get-PatternHistory

    $stats = @{
        total_tools = $history.tool_history.Count
        tool_counts = @{}
        success_rate = 0
        avg_duration = 0
        most_used_tools = @()
        recent_patterns = @()
    }

    if ($history.tool_history.Count -eq 0) {
        return $stats
    }

    # Count tools
    $toolGroups = $history.tool_history | Group-Object -Property tool
    foreach ($group in $toolGroups) {
        $stats.tool_counts[$group.Name] = $group.Count
    }

    # Most used
    $stats.most_used_tools = $toolGroups | Sort-Object Count -Descending | Select-Object -First 5 | ForEach-Object {
        @{ tool = $_.Name; count = $_.Count }
    }

    # Success rate
    $successful = ($history.tool_history | Where-Object { $_.success }).Count
    $stats.success_rate = [math]::Round(($successful / $history.tool_history.Count) * 100, 1)

    # Average duration
    $durations = $history.tool_history | Where-Object { $_.duration -gt 0 } | Select-Object -ExpandProperty duration
    if ($durations.Count -gt 0) {
        $stats.avg_duration = [math]::Round(($durations | Measure-Object -Average).Average, 0)
    }

    return $stats
}

<#
.SYNOPSIS
    Generates optimization suggestions based on patterns.

.PARAMETER Patterns
    Array of detected patterns.

.OUTPUTS
    Formatted suggestion string.
#>
function Get-OptimizationSuggestion {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [array]$Patterns
    )

    if ($Patterns.Count -eq 0) {
        return ""
    }

    # Sort by weight (priority)
    $sorted = $Patterns | Sort-Object -Property weight -Descending

    # Take top suggestion
    $top = $sorted[0]

    $result = [System.Text.StringBuilder]::new()

    [void]$result.AppendLine("")
    [void]$result.AppendLine("<!-- VIBE OPTIMIZATION HINT -->")
    [void]$result.AppendLine("")
    [void]$result.AppendLine("**Optimization Suggestion**: $($top.description)")
    [void]$result.AppendLine("- $($top.details)")
    [void]$result.AppendLine("- **Tip**: $($top.suggestion)")
    [void]$result.AppendLine("")

    return $result.ToString()
}

<#
.SYNOPSIS
    Checks if a suggestion was recently shown.

.PARAMETER PatternType
    The pattern type to check.

.PARAMETER CooldownMinutes
    Cooldown period in minutes.

.OUTPUTS
    Boolean indicating if suggestion should be suppressed.
#>
function Test-SuggestionCooldown {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PatternType,

        [Parameter()]
        [int]$CooldownMinutes = 10
    )

    $history = Get-PatternHistory

    $recentShown = $history.suggestions_shown | Where-Object {
        $_.pattern -eq $PatternType -and
        ([datetime]::Parse($_.timestamp) -gt [datetime]::UtcNow.AddMinutes(-$CooldownMinutes))
    }

    return ($null -ne $recentShown -and $recentShown.Count -gt 0)
}

<#
.SYNOPSIS
    Records that a suggestion was shown.

.PARAMETER PatternType
    The pattern type that was shown.
#>
function Add-SuggestionShown {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PatternType
    )

    $history = Get-PatternHistory

    $history.suggestions_shown += @{
        pattern = $PatternType
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    # Keep only recent suggestions (last 100)
    if ($history.suggestions_shown.Count -gt 100) {
        $history.suggestions_shown = $history.suggestions_shown | Select-Object -Last 100
    }

    Save-PatternHistory -History $history
}

#endregion

#region Export

Export-ModuleMember -Function @(
    'Add-ToolUsage',
    'Find-InefficiencyPatterns',
    'Get-ToolUsageStats',
    'Get-OptimizationSuggestion',
    'Test-SuggestionCooldown',
    'Add-SuggestionShown',
    'Get-PatternHistory'
)

#endregion
