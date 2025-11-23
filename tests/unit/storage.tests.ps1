#Requires -Version 5.1
#Requires -Module Pester

<#
.SYNOPSIS
    Pester unit tests for storage layer functions.

.DESCRIPTION
    Tests for Write-AtomicFile, Write-ContextState, Read-ContextState,
    file locking, and backup management functions.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
#>

Describe "Storage Layer" {

    BeforeAll {
        # Import the storage module
        . "$PSScriptRoot\..\..\lib\core\storage.ps1"

        # Define test fixtures path
        $script:FixturesPath = "$PSScriptRoot\..\fixtures"

        # Sample context for testing
        $script:SampleContext = @{
            version = "1.0.0"
            timestamp = [datetime]::UtcNow.ToString('o')
            session_id = "test-session-123"
            task_context = @{
                current_objective = "Test objective"
                progress_summary = "Test progress"
                key_decisions = @("Decision 1", "Decision 2")
                blockers = @()
                next_steps = @("Step 1")
            }
            active_todos = @(
                @{
                    content = "Test todo"
                    status = "pending"
                    activeForm = "Testing todo"
                }
            )
            working_files = @()
            tool_history = @()
            conversation_summary = "Test summary"
            important_context = @("Context 1")
            subagent_triggers = @()
            metadata = @{
                total_messages = 1
                total_tool_calls = 0
            }
        }
    }

    Context "Write-AtomicFile" {

        BeforeAll {
            $script:AtomicTestDir = Join-Path $env:TEMP "AtomicWriteTest_$(Get-Random)"
            New-Item -Path $script:AtomicTestDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:AtomicTestDir) {
                Remove-Item -Path $script:AtomicTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should write file atomically" {
            $testPath = Join-Path $script:AtomicTestDir "atomic-test.txt"
            $content = "Test content for atomic write"

            $result = Write-AtomicFile -Path $testPath -Content $content

            $result | Should -Be $true
            Test-Path $testPath | Should -Be $true
        }

        It "Should verify content after write" {
            $testPath = Join-Path $script:AtomicTestDir "verify-test.txt"
            $content = "Content to verify"

            Write-AtomicFile -Path $testPath -Content $content

            $readContent = Get-Content -Path $testPath -Raw
            $readContent.Trim() | Should -Be $content
        }

        It "Should overwrite existing file" {
            $testPath = Join-Path $script:AtomicTestDir "overwrite-test.txt"
            "Original content" | Out-File -FilePath $testPath -Encoding utf8

            Write-AtomicFile -Path $testPath -Content "New content"

            $readContent = Get-Content -Path $testPath -Raw
            $readContent.Trim() | Should -Be "New content"
        }

        It "Should create parent directories" {
            $testPath = Join-Path $script:AtomicTestDir "subdir\nested\file.txt"

            Write-AtomicFile -Path $testPath -Content "Nested content"

            Test-Path $testPath | Should -Be $true
        }

        It "Should handle empty content" {
            $testPath = Join-Path $script:AtomicTestDir "empty-test.txt"

            $result = Write-AtomicFile -Path $testPath -Content ""

            $result | Should -Be $true
            Test-Path $testPath | Should -Be $true
        }

        It "Should handle UTF-8 content" {
            $testPath = Join-Path $script:AtomicTestDir "utf8-test.txt"
            $content = "Unicode: $([char]0x00E9) $([char]0x00F1) $([char]0x4E2D)"

            Write-AtomicFile -Path $testPath -Content $content

            $readContent = Get-Content -Path $testPath -Raw -Encoding UTF8
            $readContent.Trim() | Should -Be $content
        }

        It "Should handle large content" {
            $testPath = Join-Path $script:AtomicTestDir "large-test.txt"
            $content = "x" * 100000

            $result = Write-AtomicFile -Path $testPath -Content $content

            $result | Should -Be $true
        }

        It "Should cleanup temp files on success" {
            $testPath = Join-Path $script:AtomicTestDir "cleanup-test.txt"

            Write-AtomicFile -Path $testPath -Content "test"

            $tempFiles = Get-ChildItem -Path $script:AtomicTestDir -Filter ".tmp_*" -File
            $tempFiles | Should -BeNullOrEmpty
        }

        It "Should handle multi-line content" {
            $testPath = Join-Path $script:AtomicTestDir "multiline-test.txt"
            $content = "Line 1`nLine 2`nLine 3"

            Write-AtomicFile -Path $testPath -Content $content

            Test-Path $testPath | Should -Be $true
        }

        It "Should return boolean true on success" {
            $testPath = Join-Path $script:AtomicTestDir "return-test.txt"

            $result = Write-AtomicFile -Path $testPath -Content "test"

            $result | Should -BeOfType [bool]
            $result | Should -Be $true
        }
    }

    Context "File Locking" {

        BeforeAll {
            $script:LockTestDir = Join-Path $env:TEMP "FileLockTest_$(Get-Random)"
            New-Item -Path $script:LockTestDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:LockTestDir) {
                Remove-Item -Path $script:LockTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should acquire lock" {
            $resourcePath = Join-Path $script:LockTestDir "resource.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $lockPath = New-FileLock -ResourcePath $resourcePath -TimeoutMs 1000

            $lockPath | Should -Not -BeNullOrEmpty
            Test-Path $lockPath | Should -Be $true

            Remove-FileLock -LockPath $lockPath | Out-Null
        }

        It "Should release lock" {
            $resourcePath = Join-Path $script:LockTestDir "release-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $lockPath = New-FileLock -ResourcePath $resourcePath

            $result = Remove-FileLock -LockPath $lockPath

            $result | Should -Be $true
            Test-Path $lockPath | Should -Be $false
        }

        It "Should create lock with correct structure" {
            $resourcePath = Join-Path $script:LockTestDir "structure-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $lockPath = New-FileLock -ResourcePath $resourcePath

            try {
                $lockContent = Get-Content -Path $lockPath -Raw | ConvertFrom-Json
                $lockContent.pid | Should -Be $PID
                $lockContent.hostname | Should -Be $env:COMPUTERNAME
                $lockContent.timestamp | Should -Not -BeNullOrEmpty
            } finally {
                Remove-FileLock -LockPath $lockPath | Out-Null
            }
        }

        It "Should clean stale locks" {
            $resourcePath = Join-Path $script:LockTestDir "stale-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            # Create a stale lock manually
            $staleLockPath = "$resourcePath.lock"
            $staleLockContent = @{
                pid = 99999
                hostname = "stale-host"
                timestamp = ([datetime]::UtcNow.AddSeconds(-120)).ToString('o')  # 2 minutes ago
                resource = $resourcePath
            } | ConvertTo-Json -Compress
            $staleLockContent | Out-File -FilePath $staleLockPath -Encoding utf8

            # Should acquire lock (after cleaning stale)
            $lockPath = New-FileLock -ResourcePath $resourcePath -TimeoutMs 2000

            $lockPath | Should -Not -BeNullOrEmpty

            Remove-FileLock -LockPath $lockPath | Out-Null
        }

        It "Should timeout when lock cannot be acquired" {
            $resourcePath = Join-Path $script:LockTestDir "timeout-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            # Create a fresh lock
            $existingLockPath = "$resourcePath.lock"
            $freshLockContent = @{
                pid = 99998
                hostname = "other-host"
                timestamp = [datetime]::UtcNow.ToString('o')
                resource = $resourcePath
            } | ConvertTo-Json -Compress
            $freshLockContent | Out-File -FilePath $existingLockPath -Encoding utf8

            try {
                { New-FileLock -ResourcePath $resourcePath -TimeoutMs 100 } |
                    Should -Throw "*acquire lock*"
            } finally {
                Remove-Item -Path $existingLockPath -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should return lock path string" {
            $resourcePath = Join-Path $script:LockTestDir "path-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $lockPath = New-FileLock -ResourcePath $resourcePath

            try {
                $lockPath | Should -BeOfType [string]
                $lockPath | Should -Match "\.lock$"
            } finally {
                Remove-FileLock -LockPath $lockPath | Out-Null
            }
        }

        It "Should handle Remove-FileLock on non-existent lock" {
            $result = Remove-FileLock -LockPath (Join-Path $script:LockTestDir "nonexistent.lock")

            $result | Should -Be $false
        }
    }

    Context "Invoke-WithLock" {

        BeforeAll {
            $script:InvokeTestDir = Join-Path $env:TEMP "InvokeWithLockTest_$(Get-Random)"
            New-Item -Path $script:InvokeTestDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:InvokeTestDir) {
                Remove-Item -Path $script:InvokeTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should execute operation with lock" {
            $resourcePath = Join-Path $script:InvokeTestDir "invoke-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $result = Invoke-WithLock -ResourcePath $resourcePath -Operation {
                return "executed"
            }

            $result | Should -Be "executed"
        }

        It "Should release lock after operation" {
            $resourcePath = Join-Path $script:InvokeTestDir "release-after.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            Invoke-WithLock -ResourcePath $resourcePath -Operation {
                return $true
            }

            $lockPath = "$resourcePath.lock"
            Test-Path $lockPath | Should -Be $false
        }

        It "Should release lock on error" {
            $resourcePath = Join-Path $script:InvokeTestDir "release-error.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            try {
                Invoke-WithLock -ResourcePath $resourcePath -Operation {
                    throw "Test error"
                }
            } catch {
                # Expected error
            }

            $lockPath = "$resourcePath.lock"
            Test-Path $lockPath | Should -Be $false
        }

        It "Should return operation result" {
            $resourcePath = Join-Path $script:InvokeTestDir "return-test.txt"
            "test" | Out-File -FilePath $resourcePath -Encoding utf8

            $result = Invoke-WithLock -ResourcePath $resourcePath -Operation {
                return @{ value = 42 }
            }

            $result.value | Should -Be 42
        }
    }

    Context "Write-ContextState" {

        BeforeAll {
            $script:WriteTestDir = Join-Path $env:TEMP "WriteContextTest_$(Get-Random)"
            New-Item -Path $script:WriteTestDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:WriteTestDir) {
                Remove-Item -Path $script:WriteTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should write context to file" {
            $testPath = Join-Path $script:WriteTestDir "context.json"

            $result = Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false

            $result | Should -Be $true
            Test-Path $testPath | Should -Be $true
        }

        It "Should write valid JSON" {
            $testPath = Join-Path $script:WriteTestDir "json-test.json"

            Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false

            $content = Get-Content -Path $testPath -Raw
            { $content | ConvertFrom-Json } | Should -Not -Throw
        }

        It "Should create backup before overwrite" {
            $testPath = Join-Path $script:WriteTestDir "backup-test.json"

            # Write initial
            Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false

            # Write with backup
            $modifiedContext = $script:SampleContext.Clone()
            $modifiedContext.version = "2.0.0"
            Write-ContextState -Context $modifiedContext -StoragePath $testPath -CreateBackup $true

            # Check backup exists
            $backups = Get-ChildItem -Path $script:WriteTestDir -Filter "backup-test.json.backup.*"
            $backups.Count | Should -BeGreaterOrEqual 1
        }

        It "Should filter sensitive data" {
            $testPath = Join-Path $script:WriteTestDir "sensitive-test.json"

            $contextWithSecret = $script:SampleContext.Clone()
            $contextWithSecret.task_context.current_objective = "api_key = sk_live_1234567890abcdef"

            Write-ContextState -Context $contextWithSecret -StoragePath $testPath -CreateBackup $false

            $content = Get-Content -Path $testPath -Raw
            $content | Should -Match '\[REDACTED:'
            $content | Should -Not -Match 'sk_live_1234567890abcdef'
        }

        It "Should create directory if not exists" {
            $testPath = Join-Path $script:WriteTestDir "newdir\context.json"

            Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false

            Test-Path $testPath | Should -Be $true
        }

        It "Should respect MaxBackups setting" {
            $testPath = Join-Path $script:WriteTestDir "maxbackup-test.json"

            # Create multiple versions
            for ($i = 0; $i -lt 5; $i++) {
                $context = $script:SampleContext.Clone()
                $context.version = "1.0.$i"
                Write-ContextState -Context $context -StoragePath $testPath -CreateBackup $true -MaxBackups 2
                Start-Sleep -Milliseconds 100  # Ensure different timestamps
            }

            $backups = Get-ChildItem -Path $script:WriteTestDir -Filter "maxbackup-test.json.backup.*"
            $backups.Count | Should -BeLessOrEqual 2
        }

        It "Should skip backup when CreateBackup is false" {
            $testPath = Join-Path $script:WriteTestDir "nobackup-test.json"

            Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false
            Write-ContextState -Context $script:SampleContext -StoragePath $testPath -CreateBackup $false

            $backups = Get-ChildItem -Path $script:WriteTestDir -Filter "nobackup-test.json.backup.*"
            $backups | Should -BeNullOrEmpty
        }

        It "Should handle complex nested context" {
            $testPath = Join-Path $script:WriteTestDir "nested-test.json"
            $context = $script:SampleContext.Clone()
            $context.metadata.nested = @{
                level1 = @{
                    level2 = @{
                        value = "deep"
                    }
                }
            }

            $result = Write-ContextState -Context $context -StoragePath $testPath -CreateBackup $false

            $result | Should -Be $true
        }
    }

    Context "Read-ContextState" {

        BeforeAll {
            $script:ReadTestDir = Join-Path $env:TEMP "ReadContextTest_$(Get-Random)"
            New-Item -Path $script:ReadTestDir -ItemType Directory -Force | Out-Null

            # Create valid context file
            $script:ValidContextPath = Join-Path $script:ReadTestDir "valid-context.json"
            $script:SampleContext | ConvertTo-Json -Depth 20 | Out-File -FilePath $script:ValidContextPath -Encoding utf8

            # Create corrupted file
            $script:CorruptedPath = Join-Path $script:ReadTestDir "corrupted.json"
            "{ invalid json" | Out-File -FilePath $script:CorruptedPath -Encoding utf8

            # Create corrupted file with backup
            $script:CorruptedWithBackupPath = Join-Path $script:ReadTestDir "corrupted-backup.json"
            "{ invalid" | Out-File -FilePath $script:CorruptedWithBackupPath -Encoding utf8
            $backupPath = "$script:CorruptedWithBackupPath.backup.20240101120000"
            $script:SampleContext | ConvertTo-Json -Depth 20 | Out-File -FilePath $backupPath -Encoding utf8
        }

        AfterAll {
            if (Test-Path $script:ReadTestDir) {
                Remove-Item -Path $script:ReadTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should load valid context" {
            $result = Read-ContextState -StoragePath $script:ValidContextPath

            $result | Should -Not -BeNullOrEmpty
            $result.version | Should -Be "1.0.0"
        }

        It "Should return hashtable" {
            $result = Read-ContextState -StoragePath $script:ValidContextPath

            $result | Should -BeOfType [hashtable]
        }

        It "Should return null for non-existent file" {
            $result = Read-ContextState -StoragePath (Join-Path $script:ReadTestDir "nonexistent.json")

            $result | Should -BeNullOrEmpty
        }

        It "Should recover from backup on corruption" {
            $result = Read-ContextState -StoragePath $script:CorruptedWithBackupPath -RecoverFromBackup $true

            $result | Should -Not -BeNullOrEmpty
            $result.version | Should -Be "1.0.0"
        }

        It "Should throw on corruption without backup" {
            { Read-ContextState -StoragePath $script:CorruptedPath -RecoverFromBackup $false } |
                Should -Throw
        }

        It "Should load all context fields" {
            $result = Read-ContextState -StoragePath $script:ValidContextPath

            $result.ContainsKey('version') | Should -Be $true
            $result.ContainsKey('timestamp') | Should -Be $true
            $result.ContainsKey('session_id') | Should -Be $true
            $result.ContainsKey('task_context') | Should -Be $true
            $result.ContainsKey('active_todos') | Should -Be $true
        }

        It "Should load nested structures" {
            $result = Read-ContextState -StoragePath $script:ValidContextPath

            $result.task_context | Should -Not -BeNullOrEmpty
            $result.task_context.current_objective | Should -Not -BeNullOrEmpty
        }

        It "Should use fixture sample-context-state.json" {
            $fixturePath = Join-Path $script:FixturesPath "sample-context-state.json"

            if (Test-Path $fixturePath) {
                $result = Read-ContextState -StoragePath $fixturePath

                $result | Should -Not -BeNullOrEmpty
                $result.version | Should -Be "1.0.0"
            } else {
                Set-ItResult -Skipped -Because "Fixture file not found"
            }
        }

        It "Should handle empty arrays in context" {
            $result = Read-ContextState -StoragePath $script:ValidContextPath

            $result.task_context.blockers | Should -BeNullOrEmpty
        }
    }

    Context "Clear-OldBackups" {

        BeforeAll {
            $script:BackupTestDir = Join-Path $env:TEMP "ClearBackupTest_$(Get-Random)"
            New-Item -Path $script:BackupTestDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:BackupTestDir) {
                Remove-Item -Path $script:BackupTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should remove old backups" {
            $basePath = Join-Path $script:BackupTestDir "test.json"
            "main" | Out-File -FilePath $basePath -Encoding utf8

            # Create multiple backups
            for ($i = 1; $i -le 5; $i++) {
                $backupPath = "$basePath.backup.2024010112000$i"
                "backup $i" | Out-File -FilePath $backupPath -Encoding utf8
            }

            $removed = Clear-OldBackups -BasePath $basePath -MaxBackups 2

            $removed | Should -Be 3
            $remaining = Get-ChildItem -Path $script:BackupTestDir -Filter "test.json.backup.*"
            $remaining.Count | Should -Be 2
        }

        It "Should keep newest backups" {
            $basePath = Join-Path $script:BackupTestDir "keep-newest.json"
            "main" | Out-File -FilePath $basePath -Encoding utf8

            # Create backups with different creation times
            for ($i = 1; $i -le 3; $i++) {
                $backupPath = "$basePath.backup.$i"
                "backup $i" | Out-File -FilePath $backupPath -Encoding utf8
                Start-Sleep -Milliseconds 100
            }

            Clear-OldBackups -BasePath $basePath -MaxBackups 1

            $remaining = Get-ChildItem -Path $script:BackupTestDir -Filter "keep-newest.json.backup.*" |
                        Sort-Object -Property CreationTime -Descending

            $remaining.Count | Should -Be 1
        }

        It "Should return 0 when no backups exist" {
            $basePath = Join-Path $script:BackupTestDir "no-backups.json"

            $removed = Clear-OldBackups -BasePath $basePath -MaxBackups 3

            $removed | Should -Be 0
        }

        It "Should handle MaxBackups of 0" {
            $basePath = Join-Path $script:BackupTestDir "zero-max.json"
            "main" | Out-File -FilePath $basePath -Encoding utf8

            $backupPath = "$basePath.backup.1"
            "backup" | Out-File -FilePath $backupPath -Encoding utf8

            $removed = Clear-OldBackups -BasePath $basePath -MaxBackups 0

            $removed | Should -Be 1
        }
    }

    Context "Get-StorageMetrics" {

        BeforeAll {
            $script:MetricsTestDir = Join-Path $env:TEMP "StorageMetricsTest_$(Get-Random)"
            New-Item -Path $script:MetricsTestDir -ItemType Directory -Force | Out-Null

            # Create test files
            "context" | Out-File -FilePath (Join-Path $script:MetricsTestDir "context.json") -Encoding utf8
            "backup1" | Out-File -FilePath (Join-Path $script:MetricsTestDir "context.json.backup.1") -Encoding utf8
            "backup2" | Out-File -FilePath (Join-Path $script:MetricsTestDir "context.json.backup.2") -Encoding utf8
        }

        AfterAll {
            if (Test-Path $script:MetricsTestDir) {
                Remove-Item -Path $script:MetricsTestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should return metrics object" {
            $metrics = Get-StorageMetrics -StorageDir $script:MetricsTestDir

            $metrics | Should -BeOfType [hashtable]
            $metrics.ContainsKey('total_bytes') | Should -Be $true
            $metrics.ContainsKey('file_count') | Should -Be $true
            $metrics.ContainsKey('backup_count') | Should -Be $true
        }

        It "Should count files correctly" {
            $metrics = Get-StorageMetrics -StorageDir $script:MetricsTestDir

            $metrics.file_count | Should -Be 3
        }

        It "Should count backups correctly" {
            $metrics = Get-StorageMetrics -StorageDir $script:MetricsTestDir

            $metrics.backup_count | Should -Be 2
        }

        It "Should calculate total bytes" {
            $metrics = Get-StorageMetrics -StorageDir $script:MetricsTestDir

            $metrics.total_bytes | Should -BeGreaterThan 0
        }

        It "Should handle non-existent directory" {
            $metrics = Get-StorageMetrics -StorageDir (Join-Path $env:TEMP "NonExistent_$(Get-Random)")

            $metrics.total_bytes | Should -Be 0
            $metrics.file_count | Should -Be 0
            $metrics.details.exists | Should -Be $false
        }

        It "Should include formatted size" {
            $metrics = Get-StorageMetrics -StorageDir $script:MetricsTestDir

            $metrics.details.formatted_size | Should -Not -BeNullOrEmpty
        }
    }

    Context "Test-ContextFile" {

        BeforeAll {
            $script:TestContextDir = Join-Path $env:TEMP "TestContextFile_$(Get-Random)"
            New-Item -Path $script:TestContextDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:TestContextDir) {
                Remove-Item -Path $script:TestContextDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should return true for valid file" {
            $validPath = Join-Path $script:TestContextDir "valid.json"
            '{"key": "value"}' | Out-File -FilePath $validPath -Encoding utf8

            $result = Test-ContextFile -Path $validPath

            $result | Should -Be $true
        }

        It "Should return false for invalid JSON" {
            $invalidPath = Join-Path $script:TestContextDir "invalid.json"
            '{ invalid json' | Out-File -FilePath $invalidPath -Encoding utf8

            $result = Test-ContextFile -Path $invalidPath

            $result | Should -Be $false
        }

        It "Should return false for non-existent file" {
            $result = Test-ContextFile -Path (Join-Path $script:TestContextDir "nonexistent.json")

            $result | Should -Be $false
        }

        It "Should return true for complex valid JSON" {
            $complexPath = Join-Path $script:TestContextDir "complex.json"
            $script:SampleContext | ConvertTo-Json -Depth 20 | Out-File -FilePath $complexPath -Encoding utf8

            $result = Test-ContextFile -Path $complexPath

            $result | Should -Be $true
        }
    }

    Context "Get-ContextBackups" {

        BeforeAll {
            $script:ContextBackupsDir = Join-Path $env:TEMP "GetContextBackups_$(Get-Random)"
            New-Item -Path $script:ContextBackupsDir -ItemType Directory -Force | Out-Null

            $script:ContextFilePath = Join-Path $script:ContextBackupsDir "context.json"
            "main" | Out-File -FilePath $script:ContextFilePath -Encoding utf8

            # Create backups
            for ($i = 1; $i -le 3; $i++) {
                $backupPath = "$script:ContextFilePath.backup.2024010112000$i"
                "backup $i" | Out-File -FilePath $backupPath -Encoding utf8
            }
        }

        AfterAll {
            if (Test-Path $script:ContextBackupsDir) {
                Remove-Item -Path $script:ContextBackupsDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should return array of backups" {
            $backups = Get-ContextBackups -ContextPath $script:ContextFilePath

            $backups | Should -Not -BeNullOrEmpty
            $backups.Count | Should -Be 3
        }

        It "Should return FileInfo objects" {
            $backups = Get-ContextBackups -ContextPath $script:ContextFilePath

            $backups[0] | Should -BeOfType [System.IO.FileInfo]
        }

        It "Should sort by creation time descending" {
            $backups = Get-ContextBackups -ContextPath $script:ContextFilePath

            # Newest should be first
            for ($i = 0; $i -lt ($backups.Count - 1); $i++) {
                $backups[$i].CreationTime | Should -BeGreaterOrEqual $backups[$i + 1].CreationTime
            }
        }

        It "Should return empty array for no backups" {
            $noBackupPath = Join-Path $script:ContextBackupsDir "no-backups.json"
            "main" | Out-File -FilePath $noBackupPath -Encoding utf8

            $backups = Get-ContextBackups -ContextPath $noBackupPath

            $backups | Should -BeNullOrEmpty
        }

        It "Should handle non-existent directory" {
            $backups = Get-ContextBackups -ContextPath "C:\NonExistent\context.json"

            $backups | Should -BeNullOrEmpty
        }
    }

    Context "Format-ByteSize" {

        It "Should format bytes" {
            $result = Format-ByteSize -Bytes 500

            $result | Should -Be "500 B"
        }

        It "Should format kilobytes" {
            $result = Format-ByteSize -Bytes 1500

            $result | Should -Match "KB"
        }

        It "Should format megabytes" {
            $result = Format-ByteSize -Bytes 1500000

            $result | Should -Match "MB"
        }

        It "Should format gigabytes" {
            $result = Format-ByteSize -Bytes 1500000000

            $result | Should -Match "GB"
        }

        It "Should handle 0 bytes" {
            $result = Format-ByteSize -Bytes 0

            $result | Should -Be "0 B"
        }

        It "Should format with two decimal places" {
            $result = Format-ByteSize -Bytes 1536

            $result | Should -Match "\d+\.\d{2} KB"
        }
    }

    Context "Restore-ContextFromBackup" {

        BeforeAll {
            $script:RestoreDir = Join-Path $env:TEMP "RestoreContext_$(Get-Random)"
            New-Item -Path $script:RestoreDir -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:RestoreDir) {
                Remove-Item -Path $script:RestoreDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should restore from backup" {
            $targetPath = Join-Path $script:RestoreDir "target.json"
            $backupPath = Join-Path $script:RestoreDir "backup.json"

            $script:SampleContext | ConvertTo-Json -Depth 20 | Out-File -FilePath $backupPath -Encoding utf8

            $result = Restore-ContextFromBackup -BackupPath $backupPath -TargetPath $targetPath

            $result | Should -Be $true
            Test-Path $targetPath | Should -Be $true
        }

        It "Should throw for non-existent backup" {
            $targetPath = Join-Path $script:RestoreDir "target2.json"
            $backupPath = Join-Path $script:RestoreDir "nonexistent.json"

            { Restore-ContextFromBackup -BackupPath $backupPath -TargetPath $targetPath } |
                Should -Throw "*not found*"
        }

        It "Should throw for corrupted backup" {
            $targetPath = Join-Path $script:RestoreDir "target3.json"
            $corruptedPath = Join-Path $script:RestoreDir "corrupted.json"
            "{ invalid" | Out-File -FilePath $corruptedPath -Encoding utf8

            { Restore-ContextFromBackup -BackupPath $corruptedPath -TargetPath $targetPath } |
                Should -Throw "*corrupted*"
        }

        It "Should overwrite existing target" {
            $targetPath = Join-Path $script:RestoreDir "existing.json"
            $backupPath = Join-Path $script:RestoreDir "backup-for-existing.json"

            '{"old": "content"}' | Out-File -FilePath $targetPath -Encoding utf8
            $script:SampleContext | ConvertTo-Json -Depth 20 | Out-File -FilePath $backupPath -Encoding utf8

            Restore-ContextFromBackup -BackupPath $backupPath -TargetPath $targetPath

            $content = Get-Content -Path $targetPath -Raw | ConvertFrom-Json
            $content.version | Should -Be "1.0.0"
        }
    }
}
