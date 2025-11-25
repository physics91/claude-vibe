# Context Manager Demo Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path -Parent $PSScriptRoot

# Import modules
. "$projectRoot\lib\core\preset-manager.ps1"
. "$projectRoot\lib\core\project-detector.ps1"
. "$projectRoot\lib\core\mcp-config-generator.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Context Manager Demo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Import command manager
. "$projectRoot\lib\core\command-manager.ps1"

# 1. Project Type Detection
Write-Host "[1] Project Type Detection" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
$detection = Detect-ProjectType -ProjectRoot $projectRoot
$confidence = [math]::Round($detection.confidence * 100)
Write-Host "Detected Type: $($detection.detectedType)"
Write-Host "Recommended Preset: $($detection.recommendedPreset)"
Write-Host "Confidence: $confidence%"
Write-Host ""

# 2. Available Presets
Write-Host "[2] Available Presets" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
$presets = Get-AllPresets
foreach ($p in $presets) {
    $tokens = ""
    if ($p.estimatedTokenSaved) {
        $tokens = "(~$($p.estimatedTokenSaved) tokens saved)"
    }
    Write-Host "  - $($p.displayName): $tokens" -ForegroundColor White
}
Write-Host ""

# 3. Current MCP Servers
Write-Host "[3] Current MCP Servers" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
$servers = Get-AvailableMcpServers
$totalTokens = 0
foreach ($name in $servers.Keys) {
    $s = $servers[$name]
    $totalTokens += $s.estimatedTokens
    Write-Host "  - $name : ~$($s.estimatedTokens) tokens" -ForegroundColor White
}
Write-Host "  --------------------------------"
Write-Host "  Total: ~$totalTokens tokens" -ForegroundColor Cyan
Write-Host ""

# 4. Preset Effects
Write-Host "[4] Preset Details" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray

foreach ($preset in $presets) {
    Write-Host ""
    Write-Host "  [$($preset.displayName)]" -ForegroundColor Magenta

    $config = $preset.config

    # MCP
    $mcpEnabled = "(none)"
    if ($config.mcp.enabled -and $config.mcp.enabled.Count -gt 0) {
        $mcpEnabled = $config.mcp.enabled -join ", "
    }
    Write-Host "    MCP Enabled: $mcpEnabled"

    # Agents
    $agentsEnabled = "(none)"
    if ($config.agents.enabled -and $config.agents.enabled.Count -gt 0) {
        $count = $config.agents.enabled.Count
        if ($count -gt 5) {
            $first5 = $config.agents.enabled[0..4] -join ", "
            $agentsEnabled = "$first5... (+$($count - 5) more)"
        } else {
            $agentsEnabled = $config.agents.enabled -join ", "
        }
    }
    Write-Host "    Agents Enabled: $agentsEnabled"

    # Token savings
    if ($preset.estimatedTokenSaved) {
        Write-Host "    Estimated Savings: ~$($preset.estimatedTokenSaved) tokens" -ForegroundColor Green
    }
}

Write-Host ""

# 5. Managed Commands
Write-Host "[5] Managed Commands" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
$commands = Get-ManagedCommands
$totalCmdTokens = 0
foreach ($cmd in $commands) {
    $totalCmdTokens += $cmd.estimatedTokens
    $desc = if ($cmd.description) { " - $($cmd.description.Substring(0, [Math]::Min(40, $cmd.description.Length)))..." } else { "" }
    Write-Host "  - /$($cmd.name)$desc (~$($cmd.estimatedTokens) tokens)" -ForegroundColor White
}
Write-Host "  --------------------------------"
Write-Host "  Total: ~$totalCmdTokens tokens" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Usage" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  /context-status  - Check current status"
Write-Host "  /context-setup   - Interactive setup"
Write-Host ""
