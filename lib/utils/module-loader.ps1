#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS
    Module dependency management for claude-vibe plugin.

.DESCRIPTION
    Provides dependency tracking and safe module loading with error handling.
    Ensures modules are loaded in the correct order and validates dependencies.

.NOTES
    Author: claude-vibe
    Version: 1.0.0
#>

#region Trusted Paths Configuration

# Define trusted directories for module loading (dot-sourcing security)
$script:TrustedModulePaths = @(
    (Join-Path $PSScriptRoot ".." | Resolve-Path -ErrorAction SilentlyContinue).Path,  # lib folder
    $PSScriptRoot  # utils folder
)

<#
.SYNOPSIS
    Validates that a path is within trusted directories.

.PARAMETER Path
    The path to validate.

.OUTPUTS
    $true if path is trusted, $false otherwise.
#>
function Test-TrustedPath {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        $resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
        $normalizedPath = $resolvedPath.TrimEnd('\', '/')

        foreach ($trustedPath in $script:TrustedModulePaths) {
            if ($null -eq $trustedPath) { continue }
            $normalizedTrusted = $trustedPath.TrimEnd('\', '/')
            if ($normalizedPath.StartsWith($normalizedTrusted, [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }

        Write-Warning "Path is not in trusted directories: $Path"
        return $false
    }
    catch {
        Write-Warning "Cannot resolve path for trust validation: $Path"
        return $false
    }
}

#endregion

#region Module Dependency Registry

# Define module dependency tree
# Key: module name, Value: array of required modules (must be loaded first)
$script:ModuleDependencies = @{
    # Base utilities (no dependencies)
    'conversion-helpers' = @()
    'constants'          = @()
    'security'           = @()
    'safe-access'        = @()
    'exceptions'         = @()
    'validation'         = @('exceptions')

    # Core modules with dependencies
    'storage'            = @('security', 'conversion-helpers', 'exceptions')
    'preset-manager'     = @('conversion-helpers', 'exceptions')
    'parser'             = @('security', 'exceptions')
    'command-manager'    = @('conversion-helpers', 'constants', 'exceptions')
    'mcp-config-generator' = @('preset-manager', 'exceptions')
    'project-detector'   = @('preset-manager')
    'prompt-analyzer'    = @()
    'clarification-generator' = @()
    'schema-validator'        = @('conversion-helpers', 'safe-access')
}

# Track loaded modules
$script:LoadedModules = @{}

# Track loading in progress (for circular dependency detection)
$script:LoadingInProgress = @{}

#endregion

#region Module Loading Functions

<#
.SYNOPSIS
    Imports a module with dependency checking.

.PARAMETER ModuleName
    The name of the module to import (without .ps1 extension).

.PARAMETER ModulePath
    Optional full path to the module file. If not provided, uses standard paths.

.OUTPUTS
    $true if successful, $false otherwise.
#>
function Import-PluginModule {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ModuleName,

        [Parameter()]
        [string]$ModulePath
    )

    # Check if already loaded
    if ($script:LoadedModules.ContainsKey($ModuleName)) {
        Write-Verbose "Module '$ModuleName' already loaded"
        return $true
    }

    # Check for circular dependency
    if ($script:LoadingInProgress.ContainsKey($ModuleName)) {
        Write-Warning "Circular dependency detected: '$ModuleName' is already being loaded"
        return $false
    }

    # Resolve module path if not provided
    if (-not $ModulePath) {
        $ModulePath = Resolve-ModulePath -ModuleName $ModuleName
        if (-not $ModulePath) {
            Write-Warning "Module '$ModuleName' not found in standard paths"
            return $false
        }
    }

    # Validate file exists
    if (-not (Test-Path -LiteralPath $ModulePath -PathType Leaf)) {
        Write-Warning "Module file not found: $ModulePath"
        return $false
    }

    # Validate path is in trusted directories (security)
    if (-not (Test-TrustedPath -Path $ModulePath)) {
        Write-Warning "Module path is not trusted, refusing to load: $ModulePath"
        return $false
    }

    # Mark as loading in progress (for circular dependency detection)
    $script:LoadingInProgress[$ModuleName] = $true

    try {
        # Load dependencies first
        if ($script:ModuleDependencies.ContainsKey($ModuleName)) {
            foreach ($dependency in $script:ModuleDependencies[$ModuleName]) {
                if (-not (Import-PluginModule -ModuleName $dependency)) {
                    Write-Warning "Failed to load dependency '$dependency' for module '$ModuleName'"
                    return $false
                }
            }
        }

        # Load the module
        . $ModulePath
        $script:LoadedModules[$ModuleName] = @{
            path = $ModulePath
            loadedAt = Get-Date
        }
        Write-Verbose "Successfully loaded module: $ModuleName"
        return $true
    }
    catch {
        Write-Warning "Failed to load module '$ModuleName': $($_.Exception.Message)"
        return $false
    }
    finally {
        # Remove from loading in progress
        $script:LoadingInProgress.Remove($ModuleName)
    }
}

<#
.SYNOPSIS
    Resolves the path for a module by name.

.PARAMETER ModuleName
    The name of the module.

.OUTPUTS
    Full path to the module file or $null if not found.
#>
function Resolve-ModulePath {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    $libRoot = Split-Path -Parent $PSScriptRoot

    # Check utils folder
    $utilsPath = Join-Path $libRoot "utils\$ModuleName.ps1"
    if (Test-Path -LiteralPath $utilsPath) {
        return $utilsPath
    }

    # Check core folder
    $corePath = Join-Path $libRoot "core\$ModuleName.ps1"
    if (Test-Path -LiteralPath $corePath) {
        return $corePath
    }

    return $null
}

<#
.SYNOPSIS
    Checks if a module is loaded.

.PARAMETER ModuleName
    The name of the module to check.

.OUTPUTS
    $true if loaded, $false otherwise.
#>
function Test-ModuleLoaded {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    return $script:LoadedModules.ContainsKey($ModuleName)
}

<#
.SYNOPSIS
    Gets all loaded modules.

.OUTPUTS
    Hashtable of loaded modules with their info.
#>
function Get-LoadedModules {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()

    return $script:LoadedModules.Clone()
}

<#
.SYNOPSIS
    Validates that required dependencies are available.

.PARAMETER ModuleName
    The name of the module to check dependencies for.

.OUTPUTS
    $true if all dependencies are satisfied, $false otherwise.
#>
function Test-ModuleDependencies {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    if (-not $script:ModuleDependencies.ContainsKey($ModuleName)) {
        Write-Verbose "No dependencies defined for module '$ModuleName'"
        return $true
    }

    $missingDeps = @()
    foreach ($dependency in $script:ModuleDependencies[$ModuleName]) {
        if (-not (Test-ModuleLoaded -ModuleName $dependency)) {
            $missingDeps += $dependency
        }
    }

    if ($missingDeps.Count -gt 0) {
        Write-Warning "Module '$ModuleName' has unloaded dependencies: $($missingDeps -join ', ')"
        return $false
    }

    return $true
}

<#
.SYNOPSIS
    Gets the dependency tree for a module.

.PARAMETER ModuleName
    The name of the module.

.OUTPUTS
    Array of all dependencies (direct and transitive).
#>
function Get-ModuleDependencyTree {
    [CmdletBinding()]
    [OutputType([array])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    $allDeps = @()
    $visited = @{}

    function Get-DepsRecursive {
        param([string]$Name)

        if ($visited.ContainsKey($Name)) {
            return
        }
        $visited[$Name] = $true

        if ($script:ModuleDependencies.ContainsKey($Name)) {
            foreach ($dep in $script:ModuleDependencies[$Name]) {
                Get-DepsRecursive -Name $dep
                if ($allDeps -notcontains $dep) {
                    $allDeps += $dep
                }
            }
        }
    }

    Get-DepsRecursive -Name $ModuleName
    return $allDeps
}

#endregion

#region Module Export

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    Export-ModuleMember -Function @(
        'Import-PluginModule',
        'Resolve-ModulePath',
        'Test-ModuleLoaded',
        'Get-LoadedModules',
        'Test-ModuleDependencies',
        'Get-ModuleDependencyTree',
        'Test-TrustedPath'
    )
}

#endregion
