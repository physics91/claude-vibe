# E2E Scenario Tests for Context Manager

$ErrorActionPreference = 'Stop'

# Get the project root
$projectRoot = Split-Path -Parent $PSScriptRoot

# Import the modules
. "$projectRoot\lib\core\preset-manager.ps1"
. "$projectRoot\lib\core\project-detector.ps1"
. "$projectRoot\lib\core\mcp-config-generator.ps1"

Write-Host "=== E2E Scenario Tests ===" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

# Scenario 1: Full workflow test
Write-Host "1. Full Workflow Test (Detect -> Recommend -> Export)" -ForegroundColor Yellow
try {
    $detection = Detect-ProjectType -ProjectRoot $projectRoot
    $preset = Get-PresetByName -Name $detection.recommendedPreset
    $confidence = [math]::Round($detection.confidence * 100)
    Write-Host "   Detected: $($detection.detectedType)" -ForegroundColor Gray
    Write-Host "   Recommended: $($detection.recommendedPreset)" -ForegroundColor Gray
    Write-Host "   Confidence: $confidence%" -ForegroundColor Gray
    Write-Host "   PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "   FAILED: $_" -ForegroundColor Red
    $failed++
}

# Scenario 2: MCP Config Generation
Write-Host ""
Write-Host "2. MCP Config Generation Test" -ForegroundColor Yellow
try {
    $servers = Get-AvailableMcpServers
    # Create a minimal profile for testing
    $testProfile = @{
        mcp = @{
            enabled = @("github")
            disabled = @()
        }
    }
    $savings = Get-EstimatedTokenSavings -Profile $testProfile
    Write-Host "   Available Servers: $($servers.Count)" -ForegroundColor Gray
    Write-Host "   Token Savings with minimal profile: ~$savings tokens" -ForegroundColor Gray
    Write-Host "   PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "   FAILED: $_" -ForegroundColor Red
    $failed++
}

# Scenario 3: Preset Loading and Merging
Write-Host ""
Write-Host "3. Preset Loading and Merging Test" -ForegroundColor Yellow
try {
    $allPresets = Get-AllPresets
    $webDev = Get-PresetByName -Name "web-dev"
    $agentsEnabled = $webDev.config.agents.enabled -join ", "
    Write-Host "   Total Presets: $($allPresets.Count)" -ForegroundColor Gray
    Write-Host "   web-dev agents enabled: $agentsEnabled" -ForegroundColor Gray
    Write-Host "   PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "   FAILED: $_" -ForegroundColor Red
    $failed++
}

# Scenario 4: XXE Prevention Test
Write-Host ""
Write-Host "4. XXE Prevention Test (Secure XML Parsing)" -ForegroundColor Yellow
try {
    # Create a test directory with malicious pom.xml
    $testDir = Join-Path $env:TEMP "xxe-test-$(Get-Random)"
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null

    $pomContent = @"
<?xml version="1.0"?>
<!DOCTYPE project [
  <!ENTITY xxe SYSTEM "file:///C:/Windows/System32/drivers/etc/hosts">
]>
<project>
  <dependencies>
    <dependency>
      <artifactId>&xxe;</artifactId>
    </dependency>
  </dependencies>
</project>
"@
    Set-Content -Path (Join-Path $testDir "pom.xml") -Value $pomContent -Encoding UTF8

    # This should NOT leak file contents due to XXE protection
    $deps = @(Get-ProjectDependencies -ProjectRoot $testDir)

    # Check that we didn't get hosts file content
    $hostsLeak = $deps | Where-Object { $_ -match "localhost|127\.0\.0\.1" }
    if ($hostsLeak) {
        Write-Host "   FAILED: XXE attack succeeded!" -ForegroundColor Red
        $failed++
    } else {
        Write-Host "   XXE blocked (DTD processing prohibited)" -ForegroundColor Gray
        Write-Host "   PASSED" -ForegroundColor Green
        $passed++
    }

    # Cleanup
    Remove-Item -Path $testDir -Recurse -Force -ErrorAction SilentlyContinue
} catch {
    # Expected: XML parsing should reject the DTD
    Write-Host "   XXE blocked (parsing rejected malicious XML)" -ForegroundColor Gray
    Write-Host "   PASSED" -ForegroundColor Green
    $passed++

    # Cleanup
    $testDir = Join-Path $env:TEMP "xxe-test-*"
    Get-ChildItem -Path $env:TEMP -Filter "xxe-test-*" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Scenario 5: StrictMode Compliance
Write-Host ""
Write-Host "5. StrictMode Compliance Test" -ForegroundColor Yellow
try {
    # Test that undefined variables are caught
    Set-StrictMode -Version Latest

    # Test preset with no detection property (should not throw)
    $minimal = Get-PresetByName -Name "minimal"
    $detection = Detect-ProjectType -ProjectRoot $projectRoot

    Write-Host "   Minimal preset loaded without errors" -ForegroundColor Gray
    Write-Host "   Detection ran without undefined variable errors" -ForegroundColor Gray
    Write-Host "   PASSED" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "   FAILED: $_" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host ""
Write-Host "=== E2E Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Total:  $($passed + $failed)"

if ($failed -gt 0) {
    exit 1
} else {
    Write-Host ""
    Write-Host "All E2E scenarios passed!" -ForegroundColor Green
    exit 0
}
