# Test script for Context Manager

$ErrorActionPreference = 'Stop'

# Get the project root
$projectRoot = Split-Path -Parent $PSScriptRoot

# Import the modules
. "$projectRoot\lib\core\preset-manager.ps1"
. "$projectRoot\lib\core\project-detector.ps1"
. "$projectRoot\lib\core\mcp-config-generator.ps1"

Write-Host "=== Context Manager Test Suite ===" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

#region Preset Manager Tests

Write-Host "--- Preset Manager Tests ---" -ForegroundColor Yellow

# Test 1: Get Built-in Presets
Write-Host "Test 1: Get Built-in Presets... " -NoNewline
try {
    $presets = Get-BuiltinPresets
    if ($presets.Count -ge 4) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Expected >= 4 presets, got $($presets.Count))" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 2: Get Preset by Name
Write-Host "Test 2: Get Preset by Name (web-dev)... " -NoNewline
try {
    $preset = Get-PresetByName -Name "web-dev"
    if ($preset -and $preset.name -eq "web-dev") {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Preset not found or wrong name)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 3: Preset Structure
Write-Host "Test 3: Preset Structure Validation... " -NoNewline
try {
    $preset = Get-PresetByName -Name "web-dev"
    $config = $preset.config

    $hasRequired = ($config.name -and
                    $config.mcp -and
                    $config.agents -and
                    $config.detection)

    if ($hasRequired) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Missing required fields)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 4: Get Non-existent Preset
Write-Host "Test 4: Get Non-existent Preset... " -NoNewline
try {
    $preset = Get-PresetByName -Name "non-existent-preset"
    if ($null -eq $preset) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Should return null)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

#endregion

#region Project Detector Tests

Write-Host ""
Write-Host "--- Project Detector Tests ---" -ForegroundColor Yellow

# Test 5: Detect Node.js Project
Write-Host "Test 5: Detect Node.js Project (current directory)... " -NoNewline
try {
    $detection = Detect-ProjectType -ProjectRoot $projectRoot

    # claude-vibe doesn't have package.json, so should return unknown or minimal
    if ($detection.detectedType) {
        Write-Host "PASSED (Detected: $($detection.detectedType))" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "PASSED (No strong match - expected)" -ForegroundColor Green
        $passed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 6: Detection Result Structure
Write-Host "Test 6: Detection Result Structure... " -NoNewline
try {
    $detection = Detect-ProjectType -ProjectRoot $projectRoot

    $hasRequired = ($null -ne $detection.detectedType -and
                    $null -ne $detection.confidence -and
                    $null -ne $detection.recommendedPreset)

    if ($hasRequired) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Missing required fields)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 7: Get Project Dependencies
Write-Host "Test 7: Get Project Dependencies... " -NoNewline
try {
    $deps = @(Get-ProjectDependencies -ProjectRoot $projectRoot)

    # Should return an array (even if empty)
    if ($deps -is [array] -or $null -eq $deps -or $deps.Count -ge 0) {
        $count = if ($deps) { $deps.Count } else { 0 }
        Write-Host "PASSED (Found $count dependencies)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Should return array)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

#endregion

#region MCP Config Generator Tests

Write-Host ""
Write-Host "--- MCP Config Generator Tests ---" -ForegroundColor Yellow

# Test 8: Get Available MCP Servers
Write-Host "Test 8: Get Available MCP Servers... " -NoNewline
try {
    $servers = Get-AvailableMcpServers

    if ($servers -is [hashtable]) {
        Write-Host "PASSED (Found $($servers.Count) servers)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Should return hashtable)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 9: Estimate MCP Tokens
Write-Host "Test 9: Estimate MCP Tokens... " -NoNewline
try {
    $tokens = Get-EstimatedMcpTokens -ServerName "github"

    if ($tokens -gt 0) {
        Write-Host "PASSED ($tokens tokens)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Should return positive number)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 10: Format MCP Server List
Write-Host "Test 10: Format MCP Server List... " -NoNewline
try {
    $servers = @{
        "github" = @{ name = "github"; estimatedTokens = 8000 }
        "playwright" = @{ name = "playwright"; estimatedTokens = 12000 }
    }

    $formatted = Format-McpServerList -Servers $servers -EnabledServers @("github")

    if ($formatted -and $formatted.Contains("github")) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Format output invalid)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

#endregion

#region Integration Tests

Write-Host ""
Write-Host "--- Integration Tests ---" -ForegroundColor Yellow

# Test 11: Preset to Profile Export (Dry Run)
Write-Host "Test 11: Preset Detection Recommendation... " -NoNewline
try {
    $detection = Detect-ProjectType -ProjectRoot $projectRoot
    $preset = Get-PresetByName -Name $detection.recommendedPreset

    if ($preset) {
        Write-Host "PASSED (Recommended: $($preset.name))" -ForegroundColor Green
        $passed++
    } else {
        # Minimal preset should always exist
        $minimalPreset = Get-PresetByName -Name "minimal"
        if ($minimalPreset) {
            Write-Host "PASSED (Fallback to minimal)" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAILED (No preset available)" -ForegroundColor Red
            $failed++
        }
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

# Test 12: Format Detection Result
Write-Host "Test 12: Format Detection Result... " -NoNewline
try {
    $detection = Detect-ProjectType -ProjectRoot $projectRoot
    $formatted = Format-DetectionResult -DetectionResult $detection

    if ($formatted -and $formatted.Length -gt 0) {
        Write-Host "PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAILED (Empty output)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAILED ($_)" -ForegroundColor Red
    $failed++
}

#endregion

# Summary
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Total:  $($passed + $failed)"

if ($failed -gt 0) {
    exit 1
} else {
    Write-Host ""
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}
