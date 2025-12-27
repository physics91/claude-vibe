#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the embedded AI Code Agent MCP server.

.DESCRIPTION
    Installs dependencies and compiles TypeScript for the embedded MCP server.

.EXAMPLE
    .\build-mcp.ps1
    Builds the MCP server in development mode.

.EXAMPLE
    .\build-mcp.ps1 -Production
    Builds the MCP server in production mode (minified).

.NOTES
    Author: claude-vibe
    Version: 1.0.0
    Requires: Node.js >= 20.0.0, npm
#>

[CmdletBinding()]
param(
    [switch]$Production,
    [switch]$Clean,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $scriptDir
$mcpDir = Join-Path $pluginRoot "lib\mcp\ai-code-agent"

# Colors for output
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Check Node.js version
function Test-NodeVersion {
    try {
        $nodeVersion = (node --version).TrimStart('v')
        $major = [int]($nodeVersion.Split('.')[0])
        if ($major -lt 20) {
            throw "Node.js 20+ required. Found: $nodeVersion"
        }
        Write-Info "Node.js version: $nodeVersion"
        return $true
    }
    catch {
        Write-Error "Node.js not found or version check failed: $_"
        return $false
    }
}

# Main build function
function Build-McpServer {
    Write-Info "Building AI Code Agent MCP Server..."
    Write-Info "MCP Directory: $mcpDir"

    # Check if directory exists
    if (-not (Test-Path $mcpDir)) {
        Write-Error "MCP directory not found: $mcpDir"
        exit 1
    }

    # Check Node.js
    if (-not (Test-NodeVersion)) {
        exit 1
    }

    Push-Location $mcpDir
    try {
        # Clean if requested
        if ($Clean) {
            Write-Info "Cleaning dist directory..."
            if (Test-Path "dist") {
                Remove-Item -Path "dist" -Recurse -Force
            }
            if (Test-Path "node_modules") {
                Write-Info "Cleaning node_modules..."
                Remove-Item -Path "node_modules" -Recurse -Force
            }
        }

        # Install dependencies
        if (-not $SkipInstall) {
            Write-Info "Installing dependencies..."
            npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "npm ci failed with exit code $LASTEXITCODE"
            }
        }

        # Build
        if ($Production) {
            Write-Info "Building in production mode..."
            npm run build:prod
        }
        else {
            Write-Info "Building in development mode..."
            npm run build
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Build failed with exit code $LASTEXITCODE"
        }

        # Verify build output
        $indexJs = Join-Path $mcpDir "dist\index.js"
        if (Test-Path $indexJs) {
            $size = (Get-Item $indexJs).Length / 1KB
            Write-Success "Build successful! Output: $indexJs ($([math]::Round($size, 2)) KB)"
        }
        else {
            Write-Error "Build output not found: $indexJs"
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Run build
Build-McpServer
