#Requires -Version 5.1
<#
.SYNOPSIS
    Session Memory module for cross-session learning.

.DESCRIPTION
    Provides persistent memory across sessions for project-specific intelligence.
    Stores memories in ~/.claude/claude-vibe/memory/

.NOTES
    Author: claude-vibe
    Version: 0.3.0
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Configuration

$script:MemoryBasePath = Join-Path $env:USERPROFILE ".claude\claude-vibe\memory"
$script:MemoryVersion = "1.0"
$script:MaxMemoryEntries = 500
$script:MaxProjectMemories = 50

#endregion

#region Storage Functions

<#
.SYNOPSIS
    Gets the memory file path for a project.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Full path to the project memory file.
#>
function Get-MemoryPath {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Initialize-MemoryStorage

    # Use hash of project path for filename
    $hash = [System.BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes($ProjectRoot)
        )
    ).Replace("-", "").Substring(0, 16).ToLower()

    return Join-Path $script:MemoryBasePath "$hash.json"
}

<#
.SYNOPSIS
    Ensures memory storage directory exists.
#>
function Initialize-MemoryStorage {
    [CmdletBinding()]
    param()

    if (-not (Test-Path $script:MemoryBasePath)) {
        New-Item -ItemType Directory -Path $script:MemoryBasePath -Force | Out-Null
    }
}

<#
.SYNOPSIS
    Loads project memory from storage.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Memory hashtable.
#>
function Get-ProjectMemory {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $memoryPath = Get-MemoryPath -ProjectRoot $ProjectRoot

    if (-not (Test-Path $memoryPath)) {
        return New-ProjectMemory -ProjectRoot $ProjectRoot
    }

    try {
        $content = Get-Content $memoryPath -Raw | ConvertFrom-Json

        $memory = @{
            version = $content.version
            project_root = $content.project_root
            created_at = $content.created_at
            updated_at = $content.updated_at
            entries = @()
            summaries = @{}
            learned_patterns = @{}
            file_insights = @{}
            error_solutions = @{}
        }

        # Convert entries array
        if ($content.entries) {
            $memory.entries = @($content.entries)
        }

        # Convert nested objects
        foreach ($field in @('summaries', 'learned_patterns', 'file_insights', 'error_solutions')) {
            if ($content.$field) {
                foreach ($prop in $content.$field.PSObject.Properties) {
                    $memory.$field[$prop.Name] = $prop.Value
                }
            }
        }

        return $memory
    } catch {
        return New-ProjectMemory -ProjectRoot $ProjectRoot
    }
}

<#
.SYNOPSIS
    Creates a new project memory structure.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Empty memory hashtable.
#>
function New-ProjectMemory {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $now = [datetime]::UtcNow.ToString('o')

    return @{
        version = $script:MemoryVersion
        project_root = $ProjectRoot
        created_at = $now
        updated_at = $now
        entries = @()
        summaries = @{
            project_type = ""
            main_technologies = @()
            common_tasks = @()
            key_files = @()
        }
        learned_patterns = @{
            successful_approaches = @()
            failed_approaches = @()
            preferred_tools = @()
        }
        file_insights = @{}
        error_solutions = @{}
    }
}

<#
.SYNOPSIS
    Saves project memory to storage.

.PARAMETER Memory
    The memory hashtable to save.
#>
function Save-ProjectMemory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Memory
    )

    Initialize-MemoryStorage

    $Memory.updated_at = [datetime]::UtcNow.ToString('o')

    # Trim entries if too large
    if ($Memory.entries.Count -gt $script:MaxMemoryEntries) {
        $Memory.entries = $Memory.entries | Select-Object -Last $script:MaxMemoryEntries
    }

    $memoryPath = Get-MemoryPath -ProjectRoot $Memory.project_root
    $Memory | ConvertTo-Json -Depth 10 | Set-Content $memoryPath -Encoding UTF8
}

#endregion

#region Memory Entry Management

<#
.SYNOPSIS
    Adds a memory entry.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Type
    Type of memory (task, insight, error, decision, etc.)

.PARAMETER Content
    The memory content.

.PARAMETER Metadata
    Optional metadata hashtable.
#>
function Add-MemoryEntry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [ValidateSet('task', 'insight', 'error', 'decision', 'pattern', 'solution')]
        [string]$Type,

        [Parameter(Mandatory = $true)]
        [string]$Content,

        [Parameter()]
        [hashtable]$Metadata = @{}
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $entry = @{
        id = [guid]::NewGuid().ToString()
        type = $Type
        content = $Content
        metadata = $Metadata
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    $memory.entries += $entry

    Save-ProjectMemory -Memory $memory

    return $entry
}

<#
.SYNOPSIS
    Gets recent memory entries.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Type
    Filter by entry type (optional).

.PARAMETER Limit
    Maximum number of entries to return.

.OUTPUTS
    Array of memory entries.
#>
function Get-RecentMemories {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [string]$Type = "",

        [Parameter()]
        [int]$Limit = 10
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $entries = $memory.entries

    if ($Type) {
        $entries = $entries | Where-Object { $_.type -eq $Type }
    }

    return @($entries | Select-Object -Last $Limit)
}

<#
.SYNOPSIS
    Searches memory entries.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Query
    Search query string.

.PARAMETER Type
    Filter by entry type (optional).

.OUTPUTS
    Array of matching entries.
#>
function Search-Memory {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Query,

        [Parameter()]
        [string]$Type = ""
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $entries = $memory.entries

    if ($Type) {
        $entries = $entries | Where-Object { $_.type -eq $Type }
    }

    # Simple keyword search
    $queryLower = $Query.ToLower()
    $matches = $entries | Where-Object {
        $_.content.ToLower().Contains($queryLower)
    }

    return @($matches)
}

#endregion

#region Insights Management

<#
.SYNOPSIS
    Records a file insight.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER FilePath
    The file path.

.PARAMETER Insight
    The insight about the file.
#>
function Add-FileInsight {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$Insight
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    # Normalize file path
    $normalizedPath = $FilePath.Replace('\', '/').ToLower()

    if (-not $memory.file_insights.ContainsKey($normalizedPath)) {
        $memory.file_insights[$normalizedPath] = @()
    }

    $memory.file_insights[$normalizedPath] += @{
        insight = $Insight
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    # Keep only recent insights per file
    if ($memory.file_insights[$normalizedPath].Count -gt 10) {
        $memory.file_insights[$normalizedPath] = $memory.file_insights[$normalizedPath] | Select-Object -Last 10
    }

    Save-ProjectMemory -Memory $memory
}

<#
.SYNOPSIS
    Gets insights for a file.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER FilePath
    The file path.

.OUTPUTS
    Array of insights.
#>
function Get-FileInsights {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $normalizedPath = $FilePath.Replace('\', '/').ToLower()

    if ($memory.file_insights.ContainsKey($normalizedPath)) {
        return @($memory.file_insights[$normalizedPath])
    }

    return @()
}

#endregion

#region Error Solutions

<#
.SYNOPSIS
    Records a solution for an error.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER ErrorType
    Type or category of error.

.PARAMETER ErrorMessage
    The error message pattern.

.PARAMETER Solution
    The solution that worked.
#>
function Add-ErrorSolution {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$ErrorType,

        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage,

        [Parameter(Mandatory = $true)]
        [string]$Solution
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    if (-not $memory.error_solutions.ContainsKey($ErrorType)) {
        $memory.error_solutions[$ErrorType] = @()
    }

    $memory.error_solutions[$ErrorType] += @{
        pattern = $ErrorMessage
        solution = $Solution
        timestamp = [datetime]::UtcNow.ToString('o')
        success_count = 1
    }

    Save-ProjectMemory -Memory $memory
}

<#
.SYNOPSIS
    Searches for solutions to an error.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER ErrorMessage
    The error message to search for.

.OUTPUTS
    Array of potential solutions.
#>
function Find-ErrorSolution {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $solutions = @()
    $errorLower = $ErrorMessage.ToLower()

    foreach ($type in $memory.error_solutions.Keys) {
        foreach ($entry in $memory.error_solutions[$type]) {
            if ($errorLower.Contains($entry.pattern.ToLower()) -or
                $entry.pattern.ToLower().Contains($errorLower)) {
                $solutions += @{
                    type = $type
                    pattern = $entry.pattern
                    solution = $entry.solution
                    success_count = $entry.success_count
                }
            }
        }
    }

    return @($solutions | Sort-Object -Property success_count -Descending)
}

#endregion

#region Pattern Learning

<#
.SYNOPSIS
    Records a successful approach pattern.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Pattern
    Description of the approach.

.PARAMETER Context
    Context where this approach worked.
#>
function Add-SuccessfulPattern {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Pattern,

        [Parameter()]
        [string]$Context = ""
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $memory.learned_patterns.successful_approaches += @{
        pattern = $Pattern
        context = $Context
        timestamp = [datetime]::UtcNow.ToString('o')
    }

    # Keep only recent patterns
    if ($memory.learned_patterns.successful_approaches.Count -gt 50) {
        $memory.learned_patterns.successful_approaches =
            $memory.learned_patterns.successful_approaches | Select-Object -Last 50
    }

    Save-ProjectMemory -Memory $memory
}

<#
.SYNOPSIS
    Gets learned patterns for context.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Hashtable with successful and failed patterns.
#>
function Get-LearnedPatterns {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    return $memory.learned_patterns
}

#endregion

#region Summary Management

<#
.SYNOPSIS
    Updates project summary.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER Summary
    Summary hashtable with project_type, main_technologies, etc.
#>
function Update-ProjectSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$Summary
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    foreach ($key in $Summary.Keys) {
        $memory.summaries[$key] = $Summary[$key]
    }

    Save-ProjectMemory -Memory $memory
}

<#
.SYNOPSIS
    Gets project summary.

.PARAMETER ProjectRoot
    The project root directory.

.OUTPUTS
    Summary hashtable.
#>
function Get-ProjectSummary {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    return $memory.summaries
}

#endregion

#region Memory Cleanup

<#
.SYNOPSIS
    Clears old memory entries.

.PARAMETER ProjectRoot
    The project root directory.

.PARAMETER DaysOld
    Remove entries older than this many days.
#>
function Clear-OldMemories {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter()]
        [int]$DaysOld = 30
    )

    $memory = Get-ProjectMemory -ProjectRoot $ProjectRoot

    $cutoff = [datetime]::UtcNow.AddDays(-$DaysOld)

    $memory.entries = @($memory.entries | Where-Object {
        [datetime]::Parse($_.timestamp) -gt $cutoff
    })

    Save-ProjectMemory -Memory $memory
}

<#
.SYNOPSIS
    Lists all projects with memory.

.OUTPUTS
    Array of project memory info.
#>
function Get-AllProjectMemories {
    [CmdletBinding()]
    [OutputType([array])]
    param()

    Initialize-MemoryStorage

    $memories = @()

    Get-ChildItem -Path $script:MemoryBasePath -Filter "*.json" | ForEach-Object {
        try {
            $content = Get-Content $_.FullName -Raw | ConvertFrom-Json
            $memories += @{
                path = $_.FullName
                project_root = $content.project_root
                updated_at = $content.updated_at
                entry_count = $content.entries.Count
            }
        } catch {
            # Skip corrupted files
        }
    }

    return @($memories | Sort-Object -Property updated_at -Descending)
}

#endregion

#region Export

Export-ModuleMember -Function @(
    'Get-MemoryPath',
    'Get-ProjectMemory',
    'Save-ProjectMemory',
    'Add-MemoryEntry',
    'Get-RecentMemories',
    'Search-Memory',
    'Add-FileInsight',
    'Get-FileInsights',
    'Add-ErrorSolution',
    'Find-ErrorSolution',
    'Add-SuccessfulPattern',
    'Get-LearnedPatterns',
    'Update-ProjectSummary',
    'Get-ProjectSummary',
    'Clear-OldMemories',
    'Get-AllProjectMemories'
)

#endregion
