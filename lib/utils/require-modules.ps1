#Requires -Version 5.1
<#
.SYNOPSIS
    Shared dependency loader for claude-vibe PowerShell scripts.

.DESCRIPTION
    Loads module dependencies in the caller's scope to keep functions available
    without repeating per-module boilerplate. Relies on module-loader.ps1 for
    the dependency registry and trusted-path checks.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ModuleName
)

$loaderPath = Join-Path $PSScriptRoot "module-loader.ps1"
if (-not (Test-Path -LiteralPath $loaderPath -PathType Leaf)) {
    throw "Required module loader not found: $loaderPath"
}

. $loaderPath

if (-not $script:ModuleDependencies -or -not $script:ModuleDependencies.ContainsKey($ModuleName)) {
    $known = if ($script:ModuleDependencies) {
        ($script:ModuleDependencies.Keys | Sort-Object) -join ', '
    } else {
        ''
    }
    throw "Module '$ModuleName' is not registered in module-loader dependencies. Known modules: $known"
}

$dependencies = @(
    $script:ModuleDependencies[$ModuleName] | Where-Object {
        $_ -and -not [string]::IsNullOrWhiteSpace($_)
    } | Select-Object -Unique
)

if (-not $dependencies -or $dependencies.Count -eq 0) {
    return
}

foreach ($dependency in $dependencies) {
    if (Test-ModuleLoaded -ModuleName $dependency) {
        continue
    }

    $modulePath = Resolve-ModulePath -ModuleName $dependency
    if (-not $modulePath) {
        throw "Required module not found: $dependency"
    }
    if (-not (Test-TrustedPath -Path $modulePath)) {
        throw "Module path is not trusted: $modulePath"
    }

    try {
        . $modulePath
        $script:LoadedModules[$dependency] = @{
            path = $modulePath
            loadedAt = Get-Date
        }
    }
    catch {
        throw "Failed to load required module '$dependency': $($_.Exception.Message)"
    }
}
