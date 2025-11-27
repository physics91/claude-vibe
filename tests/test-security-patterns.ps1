#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
$pluginRoot = Split-Path $scriptRoot -Parent
. "$pluginRoot\lib\utils\security.ps1"

Write-Host "=== Security Pattern Tests ===" -ForegroundColor Cyan

# Test JSON-style patterns (new patterns)
$tests = @(
    @{ Name = "JSON ApiKey"; Input = '{"api_key": "sk_test_1234567890abcdef"}'; Expected = $true },
    @{ Name = "JSON Password"; Input = '{"password": "supersecret123"}'; Expected = $true },
    @{ Name = "JSON Token"; Input = '{"access_token": "eyJtoken.here.signature"}'; Expected = $true },
    @{ Name = "OpenAI Key"; Input = 'sk-FAKE01234567890123456789012345678901234567890123'; Expected = $true },
    @{ Name = "Anthropic Key"; Input = ('sk-ant-' + ('a' * 84)); Expected = $true },
    @{ Name = "Regular text"; Input = 'This is just regular text'; Expected = $false },
    @{ Name = "AWS Key"; Input = 'AKIAIOSFODNN7EXAMPLE'; Expected = $true },
    @{ Name = "GitHub Token"; Input = 'ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; Expected = $true },
    @{ Name = "JWT Token"; Input = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.Rq8IjqbevI'; Expected = $true },
    @{ Name = "Stripe Key"; Input = 'sk_test_FAKE1234567890abcdefgh'; Expected = $true }
)

$passed = 0
$failed = 0

foreach ($test in $tests) {
    $result = Test-SensitiveData -Content $test.Input
    if ($result -eq $test.Expected) {
        Write-Host "[PASS] $($test.Name)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] $($test.Name) - Expected: $($test.Expected), Got: $result" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Redaction Tests ===" -ForegroundColor Cyan

# Test redaction
$redactionTests = @(
    @{ Name = "JSON secret redaction"; Input = '{"secret": "mysupersecret123"}' },
    @{ Name = "API key redaction"; Input = 'api_key = "sk_test_1234567890abcdef12345"' }
)

foreach ($test in $redactionTests) {
    $redacted = Remove-SensitiveData -Content $test.Input
    if ($redacted -match '\[REDACTED') {
        Write-Host "[PASS] $($test.Name) - Redacted correctly" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] $($test.Name) - Not redacted: $redacted" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Green' })

if ($failed -gt 0) { exit 1 }
