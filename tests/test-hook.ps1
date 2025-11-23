#Requires -Version 5.1

Set-Location $PSScriptRoot

# Create test directories
$testRoot = Join-Path $env:TEMP "HookTest_$(Get-Random)"
$projectDir = Join-Path $testRoot "project"
New-Item -Path $projectDir -ItemType Directory -Force | Out-Null

# Create AGENTS.md
$agentsMdContent = @"
# Project AGENTS.md
## Guidelines
IMPORTANT: Follow these coding standards.
"@
$agentsMdContent | Out-File -FilePath (Join-Path $projectDir "AGENTS.md") -Encoding utf8

# Create transcript
$transcriptPath = Join-Path $projectDir "transcript.txt"
$transcriptContent = @"
user: Help me implement a feature
assistant: I'll help you.
Read("src/file.ts")
"@
$transcriptContent | Out-File -FilePath $transcriptPath -Encoding utf8

$json = @{
    session_id = "test-debug-full"
    cwd = $projectDir
    transcript_path = $transcriptPath
    permission_mode = "default"
    hook_event_name = "PreCompact"
} | ConvertTo-Json -Compress

Write-Host "Test directories created at: $testRoot"

Write-Host "Testing with input: $json"
Write-Host ""

# Test using Process (same as E2E test)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-ExecutionPolicy Bypass -File `"$PSScriptRoot\hooks\pre-compact.ps1`""
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)

# Write input and close stdin
$process.StandardInput.Write($json)
$process.StandardInput.Close()

# Read output asynchronously
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()

# Wait with timeout
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$completed = $process.WaitForExit(60000)
$sw.Stop()

if (-not $completed) {
    $process.Kill()
    Write-Host "TIMEOUT after $($sw.ElapsedMilliseconds)ms"
} else {
    Write-Host "Completed in $($sw.ElapsedMilliseconds)ms"
}

$stdout = $stdoutTask.GetAwaiter().GetResult()
$stderr = $stderrTask.GetAwaiter().GetResult()

Write-Host ""
Write-Host "=== STDOUT ==="
Write-Host $stdout
Write-Host ""
Write-Host "=== STDERR ==="
Write-Host $stderr

$process.Dispose()
