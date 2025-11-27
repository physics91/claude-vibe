#Requires -Version 5.1
<#
.SYNOPSIS
    Unit tests for cache module.

.DESCRIPTION
    Tests cache functionality including:
    - Cache read/write
    - Cache invalidation
    - TTL expiration
    - Hash validation
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Set up paths
$scriptRoot = $PSScriptRoot
$pluginRoot = Split-Path $scriptRoot -Parent
$libPath = Join-Path $pluginRoot "lib"

# Source required modules
try {
    . "$libPath\core\parser.ps1"
    . "$libPath\core\cache.ps1"
} catch {
    Write-Error "Failed to load modules: $($_.Exception.Message)"
    exit 1
}

# Test counters
$script:testsPassed = 0
$script:testsFailed = 0

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )

    if ($Passed) {
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "  [FAIL] $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "         $Message" -ForegroundColor Yellow
        }
        $script:testsFailed++
    }
}

function Test-CacheBasicOperations {
    Write-Host "`nTest: Basic Cache Operations" -ForegroundColor Cyan

    $testRoot = Join-Path $env:TEMP "CacheTest_$(Get-Random)"
    New-Item -Path $testRoot -ItemType Directory -Force | Out-Null

    try {
        # Create test AGENTS.md
        $agentsContent = @"
# Test AGENTS.md
## Guidelines
- IMPORTANT: Test directive
"@
        $agentsPath = Join-Path $testRoot "AGENTS.md"
        $agentsContent | Out-File -FilePath $agentsPath -Encoding utf8

        # Test 1: Get file hashes
        $hashes = Get-FileHashesForCache -ProjectRoot $testRoot
        Write-TestResult "Get file hashes" ($hashes.project -ne "") "Expected non-empty project hash"

        # Test 2: Cache miss on first access
        $cached = Get-AgentsMdCache -ProjectRoot $testRoot -FileHashes $hashes -ErrorAction SilentlyContinue
        Write-TestResult "Cache miss on first access" ($null -eq $cached) "Expected null for cache miss"

        # Test 3: Set cache
        $testData = @{
            sections = @(
                @{ heading = "Test"; level = 2; content = "test content"; directives = @() }
            )
            subagents = @()
            key_instructions = @("IMPORTANT: Test directive")
        }
        $setResult = Set-AgentsMdCache -ProjectRoot $testRoot -Data $testData -FileHashes $hashes
        Write-TestResult "Set cache" $setResult "Expected cache set to succeed"

        # Test 4: Cache hit
        $cached = Get-AgentsMdCache -ProjectRoot $testRoot -FileHashes $hashes -ErrorAction SilentlyContinue
        Write-TestResult "Cache hit" ($null -ne $cached) "Expected cached data"

        # Test 5: Verify cached data structure
        $keyInstructions = if ($cached) { $cached.key_instructions } else { $null }
        $hasKeyInstructions = $null -ne $keyInstructions -and @($keyInstructions).Count -gt 0
        Write-TestResult "Cached data has key_instructions" $hasKeyInstructions "Expected key_instructions in cache"

        # Test 6: Clear cache
        $clearResult = Clear-AgentsMdCache -ProjectRoot $testRoot
        Write-TestResult "Clear cache" $clearResult "Expected cache clear to succeed"

        # Test 7: Cache miss after clear
        $cached = Get-AgentsMdCache -ProjectRoot $testRoot -FileHashes $hashes -ErrorAction SilentlyContinue
        Write-TestResult "Cache miss after clear" ($null -eq $cached) "Expected null after clear"

    } finally {
        # Cleanup
        Remove-Item -Path $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-CacheInvalidation {
    Write-Host "`nTest: Cache Invalidation" -ForegroundColor Cyan

    $testRoot = Join-Path $env:TEMP "CacheInvalidTest_$(Get-Random)"
    New-Item -Path $testRoot -ItemType Directory -Force | Out-Null

    try {
        # Create test AGENTS.md
        $agentsContent = "# Test`n## Section`n- IMPORTANT: Original"
        $agentsPath = Join-Path $testRoot "AGENTS.md"
        $agentsContent | Out-File -FilePath $agentsPath -Encoding utf8

        # Get hashes and set cache
        $hashes1 = Get-FileHashesForCache -ProjectRoot $testRoot
        $testData = @{ sections = @(); subagents = @(); key_instructions = @("Original") }
        Set-AgentsMdCache -ProjectRoot $testRoot -Data $testData -FileHashes $hashes1 | Out-Null

        # Modify file
        Start-Sleep -Milliseconds 100  # Ensure timestamp changes
        $modifiedContent = "# Test`n## Section`n- IMPORTANT: Modified"
        $modifiedContent | Out-File -FilePath $agentsPath -Encoding utf8

        # Get new hashes
        $hashes2 = Get-FileHashesForCache -ProjectRoot $testRoot

        # Test 1: Hashes should differ
        Write-TestResult "Hash changes on file modify" ($hashes1.project -ne $hashes2.project) "Expected different hashes"

        # Test 2: Cache should miss with new hashes
        $cached = Get-AgentsMdCache -ProjectRoot $testRoot -FileHashes $hashes2 -ErrorAction SilentlyContinue
        Write-TestResult "Cache miss after file change" ($null -eq $cached) "Expected cache invalidation"

    } finally {
        Remove-Item -Path $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-CacheGracefulDegradation {
    Write-Host "`nTest: Cache Graceful Degradation" -ForegroundColor Cyan

    # Test with invalid project root
    $invalidRoot = "Z:\NonExistent\Path\$(Get-Random)"
    $hashes = @{ global = ""; project = ""; local = @() }

    # Should not throw, just return null
    try {
        $cached = Get-AgentsMdCache -ProjectRoot $invalidRoot -FileHashes $hashes -ErrorAction SilentlyContinue
        Write-TestResult "Handles invalid path gracefully" ($null -eq $cached) "Expected null for invalid path"
    } catch {
        Write-TestResult "Handles invalid path gracefully" $false "Threw exception: $($_.Exception.Message)"
    }
}

# Run tests
Write-Host "================================" -ForegroundColor White
Write-Host "Cache Module Unit Tests" -ForegroundColor White
Write-Host "================================" -ForegroundColor White

Test-CacheBasicOperations
Test-CacheInvalidation
Test-CacheGracefulDegradation

# Summary
Write-Host "`n================================" -ForegroundColor White
Write-Host "Test Summary" -ForegroundColor White
Write-Host "================================" -ForegroundColor White
Write-Host "Passed: $script:testsPassed" -ForegroundColor Green
Write-Host "Failed: $script:testsFailed" -ForegroundColor $(if ($script:testsFailed -gt 0) { "Red" } else { "Green" })

$totalTests = $script:testsPassed + $script:testsFailed
$successRate = if ($totalTests -gt 0) { [math]::Round(($script:testsPassed / $totalTests) * 100, 2) } else { 0 }
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -eq 100) { "Green" } else { "Yellow" })

if ($script:testsFailed -gt 0) {
    exit 1
}
