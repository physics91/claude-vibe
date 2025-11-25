#Requires -Version 5.1
# Quick test script to verify refactoring changes

$ErrorActionPreference = 'Stop'
$script:TestsPassed = 0
$script:TestsFailed = 0

function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$Test
    )

    Write-Host "Test: $Name... " -NoNewline
    try {
        & $Test
        Write-Host "[PASS]" -ForegroundColor Green
        $script:TestsPassed++
    } catch {
        Write-Host "[FAIL]" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:TestsFailed++
    }
}

Write-Host "=== Refactoring Verification Tests ===" -ForegroundColor Cyan
Write-Host ""

# Load all modules in the current scope first
Write-Host "Loading modules..." -ForegroundColor Yellow
. "$PSScriptRoot\..\lib\utils\conversion-helpers.ps1"
. "$PSScriptRoot\..\lib\core\constants.ps1"
. "$PSScriptRoot\..\lib\utils\security.ps1"
. "$PSScriptRoot\..\lib\core\storage.ps1"
. "$PSScriptRoot\..\lib\core\preset-manager.ps1"
Write-Host "Modules loaded." -ForegroundColor Yellow
Write-Host ""

# Test 1: conversion-helpers.ps1 loaded
Test-Case "conversion-helpers.ps1 loaded" {
    if (-not (Test-Path "$PSScriptRoot\..\lib\utils\conversion-helpers.ps1")) {
        throw "File not found"
    }
}

# Test 2: constants.ps1 loaded
Test-Case "constants.ps1 loaded" {
    if (-not (Test-Path "$PSScriptRoot\..\lib\core\constants.ps1")) {
        throw "File not found"
    }
}

# Test 3: storage.ps1 loaded
Test-Case "storage.ps1 loaded" {
    if (-not (Test-Path "$PSScriptRoot\..\lib\core\storage.ps1")) {
        throw "File not found"
    }
}

# Test 4: preset-manager.ps1 loaded
Test-Case "preset-manager.ps1 loaded" {
    if (-not (Test-Path "$PSScriptRoot\..\lib\core\preset-manager.ps1")) {
        throw "File not found"
    }
}

# Test 5: ConvertTo-HashtableRecursive exists
Test-Case "ConvertTo-HashtableRecursive function exists" {
    $cmd = Get-Command ConvertTo-HashtableRecursive -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 6: ConvertTo-HashtableRecursive works
Test-Case "ConvertTo-HashtableRecursive converts JSON correctly" {
    $json = '{"name": "test", "nested": {"value": 123}, "array": [1, 2, 3]}'
    $result = $json | ConvertFrom-Json | ConvertTo-HashtableRecursive

    if ($result -isnot [hashtable]) { throw "Result is not hashtable" }
    if ($result.name -ne 'test') { throw "Name mismatch" }
    if ($result.nested.value -ne 123) { throw "Nested value mismatch" }
    if ($result.array.Count -ne 3) { throw "Array count mismatch" }
}

# Test 7: Constants are defined
Test-Case "Constants are defined" {
    $constants = @(
        'STALE_LOCK_THRESHOLD_SECONDS',
        'DEFAULT_MAX_BACKUPS',
        'AMBIGUITY_THRESHOLD',
        'DEFAULT_JSON_DEPTH'
    )

    foreach ($const in $constants) {
        $val = Get-Variable -Name $const -ValueOnly -Scope Script -ErrorAction SilentlyContinue
        if ($null -eq $val) { throw "Constant $const not found" }
    }
}

# Test 8: Storage functions work
Test-Case "Storage functions are available" {
    $functions = @('Write-ContextState', 'Read-ContextState', 'Write-AtomicFile')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 9: Preset functions work
Test-Case "Preset functions are available" {
    $functions = @('Get-AllPresets', 'Get-PresetByName', 'Merge-PresetWithBase')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 10: ConvertTo-HashtableRecursive MaxDepth parameter
Test-Case "ConvertTo-HashtableRecursive has MaxDepth parameter" {
    $cmd = Get-Command ConvertTo-HashtableRecursive -ErrorAction Stop
    $params = $cmd.Parameters.Keys
    if ('MaxDepth' -notin $params) { throw "MaxDepth parameter not found" }
}

# Test 11: Read-JsonAsHashtable handles non-existent file gracefully
Test-Case "Read-JsonAsHashtable handles non-existent file" {
    $result = Read-JsonAsHashtable -Path "C:\nonexistent\file.json"
    if ($result -isnot [hashtable]) { throw "Should return hashtable" }
    if ($result.Count -ne 0) { throw "Should return empty hashtable" }
}

# Test 12: Get-ConstantValue Required parameter
Test-Case "Get-ConstantValue has Required parameter" {
    $cmd = Get-Command Get-ConstantValue -ErrorAction Stop
    $params = $cmd.Parameters.Keys
    if ('Required' -notin $params) { throw "Required parameter not found" }
}

# Test 13: Get-ConstantValue distinguishes null vs undefined
Test-Case "Get-ConstantValue returns default for undefined" {
    $result = Get-ConstantValue -Name 'UNDEFINED_CONSTANT_12345' -Default 'fallback'
    if ($result -ne 'fallback') { throw "Should return fallback for undefined constant" }
}

# Test 14: Get-ConstantValue retrieves defined constants
Test-Case "Get-ConstantValue retrieves defined constants" {
    $result = Get-ConstantValue -Name 'AMBIGUITY_THRESHOLD' -Default 999
    if ($result -ne 40) { throw "Should return actual constant value (40), got: $result" }
}

# Test 15: Read-JsonFile function exists
Test-Case "Read-JsonFile function exists" {
    $cmd = Get-Command Read-JsonFile -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 16: Read-JsonFile handles non-existent file
Test-Case "Read-JsonFile returns null for non-existent file" {
    $result = Read-JsonFile -Path "C:\nonexistent\file.json"
    if ($null -ne $result) { throw "Should return null for non-existent file" }
}

# Test 17: Path constants are defined
Test-Case "Path constants are defined" {
    $pathConstants = @('CONTEXTS_PATH', 'USER_PRESETS_PATH', 'GLOBAL_MCP_CONFIG_PATH')
    foreach ($const in $pathConstants) {
        $val = Get-Variable -Name $const -ValueOnly -Scope Script -ErrorAction SilentlyContinue
        if ($null -eq $val) { throw "Path constant $const not found" }
    }
}

# Test 18: module-loader.ps1 loaded
Test-Case "module-loader.ps1 loaded" {
    if (-not (Test-Path "$PSScriptRoot\..\lib\utils\module-loader.ps1")) {
        throw "File not found"
    }
}

# Load module-loader for next tests
. "$PSScriptRoot\..\lib\utils\module-loader.ps1"

# Test 19: Test-TrustedPath function exists
Test-Case "Test-TrustedPath function exists" {
    $cmd = Get-Command Test-TrustedPath -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 20: Circular dependency detection variable exists
Test-Case "LoadingInProgress tracking variable exists" {
    $val = Get-Variable -Name 'LoadingInProgress' -Scope Script -ErrorAction SilentlyContinue
    if ($null -eq $val) { throw "LoadingInProgress variable not found" }
}

# Test 21: MaxCommandFileSizeBytes constant defined
Test-Case "MaxCommandFileSizeBytes constant defined" {
    # Re-load command-manager to get the constant
    . "$PSScriptRoot\..\lib\core\command-manager.ps1"
    $val = Get-Variable -Name 'MaxCommandFileSizeBytes' -Scope Script -ErrorAction SilentlyContinue
    if ($null -eq $val) { throw "MaxCommandFileSizeBytes not found" }
    if ($val.Value -le 0) { throw "MaxCommandFileSizeBytes should be positive" }
}

# Load prompt-analyzer for tests
. "$PSScriptRoot\..\lib\core\prompt-analyzer.ps1"

# Test 22: Test-PromptAmbiguity function exists
Test-Case "Test-PromptAmbiguity function exists" {
    $cmd = Get-Command Test-PromptAmbiguity -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 23: Test-PromptAmbiguity detects short prompts
Test-Case "Test-PromptAmbiguity detects short prompts" {
    $result = Test-PromptAmbiguity -Prompt "fix it"
    if (-not $result.IsAmbiguous) { throw "Should be ambiguous" }
    if ($result.Reasons -notcontains "TOO_SHORT") { throw "Should detect TOO_SHORT" }
}

# Test 24: Test-PromptAmbiguity passes good prompts
Test-Case "Test-PromptAmbiguity passes detailed prompts" {
    $result = Test-PromptAmbiguity -Prompt "Please add a new function to src/utils/helpers.ts that validates email addresses using regex pattern"
    if ($result.IsAmbiguous) { throw "Should not be ambiguous for detailed prompt" }
}

# Load clarification-generator for tests
. "$PSScriptRoot\..\lib\core\clarification-generator.ps1"

# Test 25: New-ClarificationPrompt function exists
Test-Case "New-ClarificationPrompt function exists" {
    $cmd = Get-Command New-ClarificationPrompt -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Load safe-access for tests
. "$PSScriptRoot\..\lib\utils\safe-access.ps1"

# Test 26: Test-PropertyExists function exists
Test-Case "Test-PropertyExists function exists" {
    $cmd = Get-Command Test-PropertyExists -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 27: Test-PropertyExists works with PSCustomObject
Test-Case "Test-PropertyExists works with PSCustomObject" {
    $obj = [PSCustomObject]@{ name = "test"; value = 123 }
    if (-not (Test-PropertyExists -Object $obj -PropertyName 'name')) { throw "Should find 'name'" }
    if (Test-PropertyExists -Object $obj -PropertyName 'missing') { throw "Should not find 'missing'" }
}

# Test 28: Get-SafeProperty returns value or default
Test-Case "Get-SafeProperty returns value or default" {
    $obj = @{ name = "test" }
    $result = Get-SafeProperty -Object $obj -PropertyName 'name' -Default 'fallback'
    if ($result -ne 'test') { throw "Should return 'test'" }
    $result = Get-SafeProperty -Object $obj -PropertyName 'missing' -Default 'fallback'
    if ($result -ne 'fallback') { throw "Should return 'fallback'" }
}

# Test 29: Get-NestedProperty navigates paths
Test-Case "Get-NestedProperty navigates paths" {
    $obj = @{ config = @{ server = @{ port = 8080 } } }
    $result = Get-NestedProperty -Object $obj -Path 'config.server.port' -Default 0
    if ($result -ne 8080) { throw "Should return 8080, got: $result" }
}

# Test 30: New-DirectorySafe function exists
Test-Case "New-DirectorySafe function exists" {
    $cmd = Get-Command New-DirectorySafe -ErrorAction Stop
    if (-not $cmd) { throw "Function not found" }
}

# Test 31: New-DirectorySafe creates directory
Test-Case "New-DirectorySafe creates and returns directory" {
    $testDir = Join-Path $env:TEMP "claude-vibe-test-$(Get-Random)"
    try {
        $result = New-DirectorySafe -Path $testDir -PassThru
        if (-not (Test-Path $testDir)) { throw "Directory not created" }
        if ($null -eq $result) { throw "Should return directory info with PassThru" }
    }
    finally {
        if (Test-Path $testDir) { Remove-Item $testDir -Force }
    }
}

# Test 32: Get-NestedProperty handles empty path segments gracefully
Test-Case "Get-NestedProperty handles empty path segments" {
    $obj = @{ a = @{ b = 123 } }
    # Path with double dots should not throw
    $result = Get-NestedProperty -Object $obj -Path 'a..b' -Default 'fallback'
    if ($result -ne 123) { throw "Should handle double dots, got: $result" }
}

# Test 33: Copy-SafeProperties skips empty property names
Test-Case "Copy-SafeProperties skips empty property names" {
    $source = @{ valid = "value"; another = "data" }
    $target = @{}
    # Should not throw on empty properties and should skip them
    $props = @('valid', '', '  ', 'missing')
    $result = Copy-SafeProperties -Source $source -Target $target -Properties $props
    if ($result.valid -ne 'value') { throw "Should copy valid property" }
    if ($result.Count -ne 1) { throw "Should only have 1 property, got: $($result.Count)" }
}

# Test 34: Get-SafeProperty uses O(1) indexer lookup
Test-Case "Get-SafeProperty works with PSCustomObject" {
    $obj = [PSCustomObject]@{ name = "test"; nested = @{ value = 42 } }
    $result = Get-SafeProperty -Object $obj -PropertyName 'name' -Default 'none'
    if ($result -ne 'test') { throw "Should return 'test'" }
    $result = Get-SafeProperty -Object $obj -PropertyName 'missing' -Default 'none'
    if ($result -ne 'none') { throw "Should return default 'none'" }
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $script:TestsPassed" -ForegroundColor Green
Write-Host "Failed: $script:TestsFailed" -ForegroundColor $(if ($script:TestsFailed -gt 0) { 'Red' } else { 'Green' })

if ($script:TestsFailed -gt 0) {
    exit 1
}
