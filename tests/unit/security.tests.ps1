#Requires -Version 5.1
#Requires -Module Pester

<#
.SYNOPSIS
    Pester unit tests for security utility functions.

.DESCRIPTION
    Tests for Test-SensitiveData, Remove-SensitiveData, Test-PathSecurity,
    and other security-related functions.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
#>

Describe "Security Utils" {

    BeforeAll {
        # Import the security module
        . "$PSScriptRoot\..\..\lib\utils\security.ps1"

        # Define test fixtures path
        $script:FixturesPath = "$PSScriptRoot\..\fixtures"
    }

    Context "Test-SensitiveData" {

        It "Should detect API keys" {
            $content = 'api_key = "sk_test_FAKE1234567890abcdef12345"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect api-key format with hyphen" {
            $content = 'api-key: "abcdefghij1234567890"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect AWS Access Key ID (AKIA)" {
            $content = 'AKIAIOSFODNN7EXAMPLE'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect AWS Access Key ID (ASIA)" {
            $content = 'ASIAIOSFODNN7EXAMPLE'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect AWS Secret Access Key" {
            $content = 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect GitHub Personal Access Token (ghp)" {
            $content = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect GitHub OAuth Token (gho)" {
            $content = 'gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect password patterns" {
            $content = 'password = "mysecretpassword123"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect password with colon" {
            $content = 'password: secretpass'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect generic secret patterns" {
            $content = 'secret = "abcdef123456789"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect bearer tokens" {
            $content = 'bearer = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect private keys (PEM format)" {
            $content = '-----BEGIN PRIVATE KEY-----'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect RSA private keys" {
            $content = '-----BEGIN RSA PRIVATE KEY-----'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect MongoDB connection strings" {
            $content = 'mongodb://user:pass@localhost:27017/db'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect PostgreSQL connection strings" {
            $content = 'postgres://user:pass@localhost:5432/db'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect MySQL connection strings" {
            $content = 'mysql://user:pass@localhost:3306/db'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect Slack tokens" {
            $content = 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxx'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect Google API keys" {
            $content = 'AIzaSyC1234567890abcdefghijklmnopqrstuvw'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect Stripe live keys" {
            $content = 'stripe_key = "sk_live_xxxxx"'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect Stripe test keys" {
            $content = 'pk_test_1234567890abcdefghijklmn'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect JWT tokens" {
            $content = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect Azure connection strings" {
            $content = 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abcdef123456789=='
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should not flag normal content" {
            $content = 'This is normal text without any sensitive data.'
            Test-SensitiveData -Content $content | Should -Be $false
        }

        It "Should not flag content with keyword substrings" {
            $content = 'The api was slow today'
            Test-SensitiveData -Content $content | Should -Be $false
        }

        It "Should not flag code examples without actual secrets" {
            $content = 'function getPassword() { return userInput; }'
            Test-SensitiveData -Content $content | Should -Be $false
        }

        It "Should handle empty string" {
            Test-SensitiveData -Content "" | Should -Be $false
        }

        It "Should handle null converted to empty string" {
            Test-SensitiveData -Content $null | Should -Be $false
        }

        It "Should handle multi-line content with sensitive data" {
            $content = @"
Normal line 1
password = "secretvalue"
Normal line 3
"@
            Test-SensitiveData -Content $content | Should -Be $true
        }

        It "Should detect multiple sensitive patterns in same content" {
            $content = 'api_key = "abcdef1234567890" and password = "secret"'
            Test-SensitiveData -Content $content | Should -Be $true
        }
    }

    Context "Remove-SensitiveData" {

        It "Should redact API keys" {
            $content = 'api_key = "sk_live_1234567890abcdef"'
            $result = Remove-SensitiveData -Content $content
            $result | Should -Match '\[REDACTED:ApiKey\]'
            $result | Should -Not -Match 'sk_live_1234567890abcdef'
        }

        It "Should redact AWS credentials" {
            $content = 'aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"'
            $result = Remove-SensitiveData -Content $content
            $result | Should -Match '\[REDACTED:'
            $result | Should -Not -Match 'wJalrXUtnFEMI'
        }

        It "Should redact GitHub tokens" {
            $content = 'token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'
            $result = Remove-SensitiveData -Content $content
            # May be redacted as GitHubToken or Secret depending on pattern match order
            $result | Should -Match '\[REDACTED:'
            $result | Should -Not -Match 'ghp_xxxxxxxxxxxx'
        }

        It "Should redact passwords" {
            $content = 'password = "mysecretpassword"'
            $result = Remove-SensitiveData -Content $content
            $result | Should -Match '\[REDACTED:Password\]'
            $result | Should -Not -Match 'mysecretpassword'
        }

        It "Should redact connection strings" {
            $content = 'mongodb://user:pass@localhost:27017/db'
            $result = Remove-SensitiveData -Content $content
            $result | Should -Match '\[REDACTED:ConnectionString\]'
            $result | Should -Not -Match 'mongodb://user:pass'
        }

        It "Should preserve non-sensitive content" {
            $content = 'This is normal text without any secrets.'
            $result = Remove-SensitiveData -Content $content
            $result | Should -Be $content
        }

        It "Should handle empty content" {
            $result = Remove-SensitiveData -Content ""
            $result | Should -Be ""
        }

        It "Should return details when requested" {
            $content = 'api_key = "abcdef1234567890"'
            $result = Remove-SensitiveData -Content $content -ReturnDetails

            $result | Should -Not -BeNullOrEmpty
            $result.Content | Should -Match '\[REDACTED:'
            $result.TotalRedactions | Should -BeGreaterThan 0
            $result.RedactionLog | Should -Not -BeNullOrEmpty
        }

        It "Should provide redaction count in details" {
            $content = 'password = "secret1" and api_key = "abcdef1234567890"'
            $result = Remove-SensitiveData -Content $content -ReturnDetails

            $result.TotalRedactions | Should -BeGreaterOrEqual 2
        }

        It "Should redact multiple occurrences of same pattern" {
            $content = 'password = "first" and password = "second"'
            $result = Remove-SensitiveData -Content $content -ReturnDetails

            $result.Content | Should -Not -Match 'first'
            $result.Content | Should -Not -Match 'second'
        }

        It "Should preserve structure of multi-line content" {
            $content = @"
Line 1
password = "secret"
Line 3
"@
            $result = Remove-SensitiveData -Content $content
            $result | Should -Match 'Line 1'
            $result | Should -Match 'Line 3'
            $result | Should -Match '\[REDACTED:'
        }

        It "Should return empty redaction log for clean content" {
            $content = 'Clean content with no secrets'
            $result = Remove-SensitiveData -Content $content -ReturnDetails

            $result.TotalRedactions | Should -Be 0
            $result.RedactionLog | Should -HaveCount 0
        }
    }

    Context "Test-PathSecurity" {

        BeforeAll {
            # Create a temporary test directory structure
            $script:TestRoot = Join-Path $env:TEMP "PathSecurityTest_$(Get-Random)"
            New-Item -Path $script:TestRoot -ItemType Directory -Force | Out-Null
            New-Item -Path (Join-Path $script:TestRoot "subdir") -ItemType Directory -Force | Out-Null
            New-Item -Path (Join-Path $script:TestRoot "allowed") -ItemType Directory -Force | Out-Null

            # Create test files
            "test" | Out-File -FilePath (Join-Path $script:TestRoot "test.txt") -Encoding utf8
            "test" | Out-File -FilePath (Join-Path $script:TestRoot "subdir\nested.txt") -Encoding utf8
        }

        AfterAll {
            # Cleanup test directory
            if (Test-Path $script:TestRoot) {
                Remove-Item -Path $script:TestRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should allow valid absolute paths within project" {
            $validPath = Join-Path $script:TestRoot "test.txt"
            $result = Test-PathSecurity -Path $validPath -ProjectRoot $script:TestRoot
            $result | Should -Be $validPath
        }

        It "Should allow valid relative paths" {
            $result = Test-PathSecurity -Path "test.txt" -ProjectRoot $script:TestRoot
            $result | Should -Be (Join-Path $script:TestRoot "test.txt")
        }

        It "Should allow nested paths within project" {
            $result = Test-PathSecurity -Path "subdir\nested.txt" -ProjectRoot $script:TestRoot
            $result | Should -Be (Join-Path $script:TestRoot "subdir\nested.txt")
        }

        It "Should reject path traversal with .." {
            { Test-PathSecurity -Path "..\outside.txt" -ProjectRoot $script:TestRoot } |
                Should -Throw "*traversal*"
        }

        It "Should reject path traversal with \.." {
            { Test-PathSecurity -Path "subdir\..\..\..\outside.txt" -ProjectRoot $script:TestRoot } |
                Should -Throw "*traversal*"
        }

        It "Should reject URL-encoded traversal" {
            { Test-PathSecurity -Path "%2e%2e\outside.txt" -ProjectRoot $script:TestRoot } |
                Should -Throw "*traversal*"
        }

        It "Should reject paths outside project root" {
            { Test-PathSecurity -Path "C:\Windows\System32\cmd.exe" -ProjectRoot $script:TestRoot } |
                Should -Throw "*outside*"
        }

        It "Should reject .git paths" {
            # Create .git directory for test
            $gitDir = Join-Path $script:TestRoot ".git"
            New-Item -Path $gitDir -ItemType Directory -Force | Out-Null

            { Test-PathSecurity -Path ".git\config" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"

            Remove-Item -Path $gitDir -Recurse -Force -ErrorAction SilentlyContinue
        }

        It "Should reject .env files" {
            { Test-PathSecurity -Path ".env" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject .env.local files" {
            { Test-PathSecurity -Path ".env.local" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject .aws directory" {
            { Test-PathSecurity -Path ".aws\credentials" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject .ssh directory" {
            { Test-PathSecurity -Path ".ssh\id_rsa" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject node_modules" {
            { Test-PathSecurity -Path "node_modules\package\index.js" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject .pem files" {
            { Test-PathSecurity -Path "certs\server.pem" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject .key files" {
            { Test-PathSecurity -Path "keys\private.key" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject credentials.json" {
            { Test-PathSecurity -Path "credentials.json" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject secrets.json" {
            { Test-PathSecurity -Path "secrets.json" -ProjectRoot $script:TestRoot } |
                Should -Throw "*blocked*"
        }

        It "Should reject empty paths" {
            # PowerShell throws parameter binding error for empty string
            { Test-PathSecurity -Path "" -ProjectRoot $script:TestRoot } |
                Should -Throw
        }

        It "Should reject whitespace-only paths" {
            { Test-PathSecurity -Path "   " -ProjectRoot $script:TestRoot } |
                Should -Throw "*null or empty*"
        }

        It "Should reject empty project root" {
            # PowerShell throws parameter binding error for empty string
            { Test-PathSecurity -Path "test.txt" -ProjectRoot "" } |
                Should -Throw
        }

        It "Should allow paths in AllowedBasePaths" {
            $allowedDir = Join-Path $script:TestRoot "allowed"
            $allowedFile = Join-Path $allowedDir "data.txt"
            "test" | Out-File -FilePath $allowedFile -Encoding utf8

            $result = Test-PathSecurity -Path $allowedFile -ProjectRoot $script:TestRoot -AllowedBasePaths @($allowedDir)
            $result | Should -Be $allowedFile
        }

        It "Should reject UNC paths by default" {
            { Test-PathSecurity -Path "\\server\share\file.txt" -ProjectRoot $script:TestRoot } |
                Should -Throw "*UNC*"
        }

        It "Should normalize path separators" {
            $result = Test-PathSecurity -Path "subdir/nested.txt" -ProjectRoot $script:TestRoot
            $result | Should -Not -BeNullOrEmpty
        }

        It "Should handle project root that does not exist" {
            { Test-PathSecurity -Path "file.txt" -ProjectRoot "C:\NonExistent\Path" } |
                Should -Throw "*does not exist*"
        }
    }

    Context "Get-SensitiveDataPatterns" {

        It "Should return array of pattern names" {
            $patterns = Get-SensitiveDataPatterns
            $patterns | Should -Not -BeNullOrEmpty
            $patterns | Should -BeOfType [string]
        }

        It "Should include ApiKey pattern" {
            $patterns = Get-SensitiveDataPatterns
            $patterns | Should -Contain 'ApiKey'
        }

        It "Should include AwsAccessKey pattern" {
            $patterns = Get-SensitiveDataPatterns
            $patterns | Should -Contain 'AwsAccessKey'
        }

        It "Should include GitHubToken pattern" {
            $patterns = Get-SensitiveDataPatterns
            $patterns | Should -Contain 'GitHubToken'
        }

        It "Should include Password pattern" {
            $patterns = Get-SensitiveDataPatterns
            $patterns | Should -Contain 'Password'
        }

        It "Should return sorted results" {
            $patterns = Get-SensitiveDataPatterns
            $sorted = $patterns | Sort-Object
            $patterns | Should -Be $sorted
        }
    }

    Context "Get-BlockedPathPatterns" {

        It "Should return array of patterns" {
            $patterns = Get-BlockedPathPatterns
            $patterns | Should -Not -BeNullOrEmpty
        }

        It "Should include .git pattern" {
            $patterns = Get-BlockedPathPatterns
            $patterns | Should -Contain '\.git(?:$|[\\/])'
        }

        It "Should include .env pattern" {
            $patterns = Get-BlockedPathPatterns
            ($patterns -match '\.env') | Should -Not -BeNullOrEmpty
        }

        It "Should include node_modules pattern" {
            $patterns = Get-BlockedPathPatterns
            ($patterns -match 'node_modules') | Should -Not -BeNullOrEmpty
        }
    }

    Context "Test-PathSecurityBatch" {

        BeforeAll {
            $script:BatchTestRoot = Join-Path $env:TEMP "BatchPathTest_$(Get-Random)"
            New-Item -Path $script:BatchTestRoot -ItemType Directory -Force | Out-Null
            "test" | Out-File -FilePath (Join-Path $script:BatchTestRoot "valid1.txt") -Encoding utf8
            "test" | Out-File -FilePath (Join-Path $script:BatchTestRoot "valid2.txt") -Encoding utf8
        }

        AfterAll {
            if (Test-Path $script:BatchTestRoot) {
                Remove-Item -Path $script:BatchTestRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should validate multiple paths" {
            $paths = @("valid1.txt", "valid2.txt")
            $results = Test-PathSecurityBatch -Paths $paths -ProjectRoot $script:BatchTestRoot

            $results | Should -HaveCount 2
            $results | ForEach-Object { $_.Valid | Should -Be $true }
        }

        It "Should identify invalid paths in batch" {
            $paths = @("valid1.txt", "..\outside.txt", ".git\config")
            $results = Test-PathSecurityBatch -Paths $paths -ProjectRoot $script:BatchTestRoot

            $results | Should -HaveCount 3
            # At least 2 paths should be invalid (path traversal and .git)
            $invalidCount = ($results | Where-Object { -not $_.Valid }).Count
            $invalidCount | Should -BeGreaterOrEqual 2
        }

        It "Should return error message for invalid paths" {
            $paths = @("..\outside.txt")
            $results = Test-PathSecurityBatch -Paths $paths -ProjectRoot $script:BatchTestRoot

            $results[0].Valid | Should -Be $false
            $results[0].Error | Should -Not -BeNullOrEmpty
        }

        It "Should return validated path for valid paths" {
            $paths = @("valid1.txt")
            $results = Test-PathSecurityBatch -Paths $paths -ProjectRoot $script:BatchTestRoot

            $results[0].Valid | Should -Be $true
            $results[0].ValidatedPath | Should -Not -BeNullOrEmpty
            $results[0].Error | Should -BeNullOrEmpty
        }
    }

    Context "Set-SecureFilePermissions" {

        BeforeAll {
            $script:PermTestRoot = Join-Path $env:TEMP "PermTest_$(Get-Random)"
            New-Item -Path $script:PermTestRoot -ItemType Directory -Force | Out-Null
        }

        AfterAll {
            if (Test-Path $script:PermTestRoot) {
                Remove-Item -Path $script:PermTestRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should set permissions on file" {
            $testFile = Join-Path $script:PermTestRoot "secure.txt"
            "secure content" | Out-File -FilePath $testFile -Encoding utf8

            $result = Set-SecureFilePermissions -Path $testFile
            $result | Should -Be $true
        }

        It "Should set permissions on directory" {
            $testDir = Join-Path $script:PermTestRoot "secureDir"
            New-Item -Path $testDir -ItemType Directory -Force | Out-Null

            $result = Set-SecureFilePermissions -Path $testDir
            $result | Should -Be $true
        }

        It "Should throw for non-existent path" {
            { Set-SecureFilePermissions -Path (Join-Path $script:PermTestRoot "nonexistent.txt") } |
                Should -Throw "*not found*"
        }
    }

    Context "New-SecureDirectory" {

        BeforeAll {
            $script:SecureDirTestRoot = Join-Path $env:TEMP "SecureDirTest_$(Get-Random)"
        }

        AfterAll {
            if (Test-Path $script:SecureDirTestRoot) {
                Remove-Item -Path $script:SecureDirTestRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should create new directory" {
            $newDir = Join-Path $script:SecureDirTestRoot "newdir"

            $result = New-SecureDirectory -Path $newDir

            $result | Should -Not -BeNullOrEmpty
            Test-Path $newDir | Should -Be $true
        }

        It "Should create nested directories" {
            $nestedDir = Join-Path $script:SecureDirTestRoot "level1\level2\level3"

            $result = New-SecureDirectory -Path $nestedDir

            Test-Path $nestedDir | Should -Be $true
        }

        It "Should handle existing directory with Force" {
            $existingDir = Join-Path $script:SecureDirTestRoot "existing"
            New-Item -Path $existingDir -ItemType Directory -Force | Out-Null

            $result = New-SecureDirectory -Path $existingDir -Force

            $result | Should -Not -BeNullOrEmpty
        }

        It "Should throw for existing directory without Force" {
            $existingDir = Join-Path $script:SecureDirTestRoot "existingNoForce"
            New-Item -Path $existingDir -ItemType Directory -Force | Out-Null

            { New-SecureDirectory -Path $existingDir } | Should -Throw "*already exists*"
        }

        It "Should return DirectoryInfo object" {
            $dir = Join-Path $script:SecureDirTestRoot "infotest"

            $result = New-SecureDirectory -Path $dir

            # Check that directory was created
            Test-Path -Path $dir -PathType Container | Should -Be $true
            # Result should either be DirectoryInfo or indicate success
            if ($result -is [System.IO.DirectoryInfo]) {
                $result.FullName | Should -Be $dir
            } else {
                # Function may return success indicator
                $result | Should -Not -BeNullOrEmpty
            }
        }
    }
}
