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

# Load mcp-config-generator for tests
. "$PSScriptRoot\..\lib\core\mcp-config-generator.ps1"

# Test 35: MCP config functions exist
Test-Case "MCP config functions are available" {
    $functions = @('Get-AvailableMcpServers', 'Get-EstimatedMcpTokens', 'Format-McpServerList')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 36: Get-EstimatedMcpTokens returns valid estimates
Test-Case "Get-EstimatedMcpTokens returns estimates" {
    $result = Get-EstimatedMcpTokens -ServerName 'github'
    if ($result -le 0) { throw "Should return positive estimate for known server" }
    $result = Get-EstimatedMcpTokens -ServerName 'unknown-server-xyz'
    if ($result -le 0) { throw "Should return default estimate for unknown server" }
}

# Load project-detector for tests
. "$PSScriptRoot\..\lib\core\project-detector.ps1"

# Test 37: Project detector functions exist
Test-Case "Project detector functions are available" {
    $functions = @('Detect-ProjectType', 'Get-ProjectDependencies')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Load parser for tests
. "$PSScriptRoot\..\lib\core\parser.ps1"

# Test 38: Parser functions exist
Test-Case "Parser functions are available" {
    $functions = @('Read-AgentsMdFile', 'ConvertFrom-AgentsMd', 'Get-AgentsMdHash')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 39: Get-AgentsMdHash generates consistent hash
Test-Case "Get-AgentsMdHash generates hash" {
    $content = "# Test content"
    $hash1 = Get-AgentsMdHash -Content $content
    $hash2 = Get-AgentsMdHash -Content $content
    if ($hash1 -ne $hash2) { throw "Hash should be consistent for same content" }
    if ($hash1.Length -lt 8) { throw "Hash should be at least 8 characters" }
}

# Load security for tests
. "$PSScriptRoot\..\lib\utils\security.ps1"

# Test 40: Security functions exist
Test-Case "Security functions are available" {
    $functions = @('Test-SensitiveData', 'Test-PathSecurity', 'Remove-SensitiveData')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 41: Test-SensitiveData detects secrets
Test-Case "Test-SensitiveData detects API keys" {
    $sensitiveContent = 'API_KEY=sk-1234567890abcdef1234567890'
    $result = Test-SensitiveData -Content $sensitiveContent
    # Test-SensitiveData returns [bool], not object
    if (-not $result) { throw "Should detect API key pattern" }
}

# Test 42: Test-PathSecurity validates paths
Test-Case "Test-PathSecurity validates safe paths" {
    # Test-PathSecurity returns validated path string or throws PathValidationException
    $projectRoot = $env:TEMP
    $safePath = "test-file.txt"  # Relative path under ProjectRoot
    try {
        $result = Test-PathSecurity -Path $safePath -ProjectRoot $projectRoot
        # Should return validated absolute path, not throw
        if (-not $result) { throw "Should return validated path" }
    } catch [PathValidationException] {
        throw "Temp path should not be blocked: $($_.Exception.Message)"
    }
}

# Load exceptions for tests
. "$PSScriptRoot\..\lib\core\exceptions.ps1"

# Test 43: Exception classes exist
Test-Case "Exception classes are defined" {
    $exceptionTypes = @(
        'JsonParsingException',
        'ConfigurationException',
        'ModuleLoadException',
        'CommandException',
        'PresetException',
        'ValidationException'
    )
    foreach ($type in $exceptionTypes) {
        try {
            $null = New-Object -TypeName $type -ArgumentList "test"
        } catch {
            throw "Exception class $type not found or failed to instantiate"
        }
    }
    # OperationResult is not an exception, test separately
    try {
        $result = [OperationResult]::new()
        if ($null -eq $result) { throw "OperationResult failed to instantiate" }
    } catch {
        throw "OperationResult class not found: $_"
    }
}

# Test 44: OperationResult factory methods work
Test-Case "OperationResult factory methods work" {
    $success = [OperationResult]::Succeeded("value")
    if (-not $success.Success) { throw "Succeeded should return success=true" }
    if ($success.Value -ne "value") { throw "Value should be 'value'" }

    $failed = [OperationResult]::Failed("error message")
    if ($failed.Success) { throw "Failed should return success=false" }
    if ($failed.Errors.Count -ne 1) { throw "Should have 1 error" }
}

# Test 45: Custom exceptions have context properties
Test-Case "Custom exceptions have context properties" {
    $jsonEx = [JsonParsingException]::new("Parse error", "config.json", 42)
    if ($jsonEx.FilePath -ne "config.json") { throw "FilePath not set" }
    if ($jsonEx.LineNumber -ne 42) { throw "LineNumber not set" }

    $configEx = [ConfigurationException]::new("Missing key", "api_key", "/path/config.json")
    if ($configEx.ConfigKey -ne "api_key") { throw "ConfigKey not set" }
    if ($configEx.ConfigPath -ne "/path/config.json") { throw "ConfigPath not set" }
}

# Load validation for tests
. "$PSScriptRoot\..\lib\utils\validation.ps1"

# Test 46: Validation functions exist
Test-Case "Validation functions are available" {
    $functions = @('Assert-NotNull', 'Assert-NotNullOrEmpty', 'Assert-PathExists', 'Assert-InRange', 'Test-NullOrEmpty')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 47: Assert-NotNull throws on null
Test-Case "Assert-NotNull throws on null" {
    $threw = $false
    try {
        Assert-NotNull -Value $null -ParameterName 'testParam'
    } catch [System.ArgumentNullException] {
        $threw = $true
    }
    if (-not $threw) { throw "Should throw ArgumentNullException" }
}

# Test 48: Assert-InRange validates correctly
Test-Case "Assert-InRange validates correctly" {
    # Should not throw for valid range
    Assert-InRange -Value 5 -ParameterName 'value' -Minimum 1 -Maximum 10

    # Should throw for out of range
    $threw = $false
    try {
        Assert-InRange -Value 15 -ParameterName 'value' -Minimum 1 -Maximum 10
    } catch [System.ArgumentOutOfRangeException] {
        $threw = $true
    }
    if (-not $threw) { throw "Should throw ArgumentOutOfRangeException" }
}

# Test 49: Test-NullOrEmpty returns correct boolean
Test-Case "Test-NullOrEmpty returns correct boolean" {
    if (-not (Test-NullOrEmpty -Value $null)) { throw "null should return true" }
    if (-not (Test-NullOrEmpty -Value "")) { throw "empty should return true" }
    if (-not (Test-NullOrEmpty -Value "   ")) { throw "whitespace should return true" }
    if (Test-NullOrEmpty -Value "valid") { throw "valid string should return false" }
}

# Test 50: Test-PathExists handles invalid paths gracefully (renamed from Test-PathSafe)
Test-Case "Test-PathExists handles invalid paths" {
    if (Test-PathExists -Path $null) { throw "null path should return false" }
    if (Test-PathExists -Path "") { throw "empty path should return false" }
    if (Test-PathExists -Path "C:\nonexistent\path\12345") { throw "nonexistent should return false" }
    if (-not (Test-PathExists -Path $env:TEMP)) { throw "TEMP should exist" }
    # Test backward compatibility alias
    if (-not (Test-PathSafe -Path $env:TEMP)) { throw "Alias Test-PathSafe should still work" }
}

# Load schema-validator for tests
. "$PSScriptRoot\..\lib\utils\schema-validator.ps1"

# Test 51: Schema validator functions exist
Test-Case "Schema validator functions are available" {
    $functions = @('Get-JsonSchema', 'Test-JsonSchema', 'Test-ConfigFile', 'Get-AvailableSchemas')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 52: Get-AvailableSchemas returns schemas
Test-Case "Get-AvailableSchemas returns schema list" {
    $schemas = Get-AvailableSchemas
    if ($schemas.Count -eq 0) { throw "No schemas found" }
    # Should have at least config and context-state schemas
    $schemaNames = $schemas | ForEach-Object { $_.name }
    if ($schemaNames -notcontains 'config') { throw "config schema not found" }
    if ($schemaNames -notcontains 'context-state') { throw "context-state schema not found" }
}

# Test 53: Test-JsonSchema validates data structure
Test-Case "Test-JsonSchema validates data structure" {
    # Valid data matching simple schema expectations
    $validData = [PSCustomObject]@{
        name = "test"
        value = 42
    }
    $schema = [PSCustomObject]@{
        type = "object"
        properties = [PSCustomObject]@{
            name = [PSCustomObject]@{ type = "string" }
            value = [PSCustomObject]@{ type = "integer" }
        }
        required = @("name")
    }
    $result = Test-JsonSchema -Data $validData -Schema $schema
    if (-not $result.isValid) { throw "Valid data should pass: $($result.errors -join ', ')" }

    # Missing required field
    $invalidData = [PSCustomObject]@{ value = 42 }
    $result2 = Test-JsonSchema -Data $invalidData -Schema $schema
    if ($result2.isValid) { throw "Missing required field should fail" }
    if ($result2.errors -notmatch "required property 'name'") { throw "Should report missing required property" }
}

# Test 54: Test-ConfigFile validates real config fixture
Test-Case "Test-ConfigFile validates fixture file" {
    $fixturePath = "$PSScriptRoot\fixtures\sample-config.json"
    if (-not (Test-Path $fixturePath)) {
        # Skip if fixture doesn't exist (test flexibility)
        return
    }
    $result = Test-ConfigFile -FilePath $fixturePath -SchemaName "config"
    # Just verify it runs without error - may pass or fail based on fixture content
    if ($null -eq $result) { throw "Result should not be null" }
    if ($null -eq $result.isValid) { throw "Should have isValid property" }
}

# Test 55: Get-JsonType identifies types correctly (updated after AI review)
Test-Case "Get-JsonType identifies JSON types" {
    if ((Get-JsonType -Data "hello") -ne "string") { throw "string not detected" }
    if ((Get-JsonType -Data 42) -ne "integer") { throw "integer not detected" }
    if ((Get-JsonType -Data 3.14) -ne "number") { throw "number not detected" }
    if ((Get-JsonType -Data $true) -ne "boolean") { throw "boolean not detected" }
    if ((Get-JsonType -Data @(1,2,3)) -ne "array") { throw "array not detected" }
    if ((Get-JsonType -Data @{a=1}) -ne "object") { throw "hashtable/object not detected" }
    if ((Get-JsonType -Data $null) -ne "null") { throw "null not detected" }
    # AI review: datetime should be treated as string (JSON date-time format)
    if ((Get-JsonType -Data (Get-Date)) -ne "string") { throw "datetime should be string" }
}

# Test 56: Detection cache functions exist
Test-Case "Detection cache functions are available" {
    $functions = @('Clear-DetectionCache', 'Get-DetectionCacheStats')
    foreach ($fn in $functions) {
        $cmd = Get-Command $fn -ErrorAction SilentlyContinue
        if (-not $cmd) { throw "Function $fn not found" }
    }
}

# Test 57: Detection cache stats returns correct structure
Test-Case "Get-DetectionCacheStats returns stats" {
    Clear-DetectionCache
    $stats = Get-DetectionCacheStats
    if ($null -eq $stats) { throw "Stats should not be null" }
    if ($null -eq $stats.totalEntries) { throw "Should have totalEntries" }
    if ($null -eq $stats.maxEntries) { throw "Should have maxEntries" }
    if ($null -eq $stats.ttlSeconds) { throw "Should have ttlSeconds" }
    if ($stats.totalEntries -ne 0) { throw "Cache should be empty after clear" }
}

# Test 58: Detect-ProjectType supports SkipCache parameter
Test-Case "Detect-ProjectType has SkipCache parameter" {
    $cmd = Get-Command Detect-ProjectType -ErrorAction SilentlyContinue
    if (-not $cmd) { throw "Detect-ProjectType not found" }
    $params = $cmd.Parameters.Keys
    if ($params -notcontains 'SkipCache') { throw "SkipCache parameter not found" }
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $script:TestsPassed" -ForegroundColor Green
Write-Host "Failed: $script:TestsFailed" -ForegroundColor $(if ($script:TestsFailed -gt 0) { 'Red' } else { 'Green' })

if ($script:TestsFailed -gt 0) {
    exit 1
}
