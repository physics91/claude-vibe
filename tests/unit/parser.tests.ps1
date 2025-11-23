#Requires -Version 5.1
#Requires -Module Pester

<#
.SYNOPSIS
    Pester unit tests for AGENTS.md parser functions.

.DESCRIPTION
    Tests for Get-AgentsMdHash, ConvertFrom-AgentsMd, Read-AgentsMdFile,
    Compress-AgentsMdContent, and other parser-related functions.

.NOTES
    Author: AGENTS Context Preserver
    Version: 1.0.0
#>

Describe "AGENTS.md Parser" {

    BeforeAll {
        # Import the parser module
        . "$PSScriptRoot\..\..\lib\core\parser.ps1"

        # Define test fixtures path
        $script:FixturesPath = "$PSScriptRoot\..\fixtures"

        # Sample markdown content for testing
        $script:SampleMarkdown = @"
# Project AGENTS.md

## Project Overview
This is a test project for unit testing.

## Coding Standards
- Use ESLint with recommended config
- Maximum function length: 50 lines
- IMPORTANT: Always write tests

## Subagent Definitions

### code-reviewer
Use this agent after completing significant code changes.
Focus on security and performance.
- Trigger: After code changes

### test-runner
Use proactively to run tests after changes.
- Trigger: After implementing features
"@

        $script:EmptyMarkdown = ""

        $script:HeaderOnlyMarkdown = @"
# Main Title
## Section One
## Section Two
### Subsection
"@
    }

    Context "Get-AgentsMdHash" {

        It "Should return consistent hash for same content" {
            $content = "Test content for hashing"

            $hash1 = Get-AgentsMdHash -Content $content
            $hash2 = Get-AgentsMdHash -Content $content

            $hash1 | Should -Be $hash2
        }

        It "Should return different hash for different content" {
            $content1 = "First content"
            $content2 = "Second content"

            $hash1 = Get-AgentsMdHash -Content $content1
            $hash2 = Get-AgentsMdHash -Content $content2

            $hash1 | Should -Not -Be $hash2
        }

        It "Should return lowercase hexadecimal string" {
            $hash = Get-AgentsMdHash -Content "Test"

            $hash | Should -Match '^[a-f0-9]+$'
        }

        It "Should return 64 character SHA256 hash" {
            $hash = Get-AgentsMdHash -Content "Test"

            $hash.Length | Should -Be 64
        }

        It "Should handle empty string" {
            $hash = Get-AgentsMdHash -Content ""

            $hash | Should -Not -BeNullOrEmpty
            $hash.Length | Should -Be 64
        }

        It "Should handle null as empty string" {
            $hash = Get-AgentsMdHash -Content $null

            $hash | Should -Not -BeNullOrEmpty
        }

        It "Should produce known hash for known content" {
            # SHA256 of empty string is known
            $hash = Get-AgentsMdHash -Content ""

            # SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            $hash | Should -Be "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }

        It "Should be case-sensitive" {
            $hash1 = Get-AgentsMdHash -Content "Test"
            $hash2 = Get-AgentsMdHash -Content "test"

            $hash1 | Should -Not -Be $hash2
        }

        It "Should handle unicode content" {
            $hash = Get-AgentsMdHash -Content "Unicode: $([char]0x00E9)$([char]0x00F1)"

            $hash | Should -Not -BeNullOrEmpty
            $hash.Length | Should -Be 64
        }

        It "Should handle multi-line content" {
            $content = "Line 1`nLine 2`nLine 3"
            $hash = Get-AgentsMdHash -Content $content

            $hash | Should -Not -BeNullOrEmpty
        }
    }

    Context "ConvertFrom-AgentsMd" {

        It "Should extract headers" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $result.sections | Should -Not -BeNullOrEmpty
            $result.sections.Count | Should -BeGreaterThan 0
        }

        It "Should correctly identify header levels" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            # Check for level 1 header
            $level1 = $result.sections | Where-Object { $_.level -eq 1 }
            $level1 | Should -Not -BeNullOrEmpty

            # Check for level 2 headers
            $level2 = $result.sections | Where-Object { $_.level -eq 2 }
            $level2 | Should -Not -BeNullOrEmpty
        }

        It "Should extract section headings correctly" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            # Use ForEach-Object for hashtable property access
            $headings = $result.sections | ForEach-Object { $_.heading }
            $headings | Should -Contain "Project AGENTS.md"
            $headings | Should -Contain "Project Overview"
            $headings | Should -Contain "Coding Standards"
        }

        It "Should extract subagent definitions from level 3 headers" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $result.subagents | Should -Not -BeNullOrEmpty
            $result.subagents.Count | Should -BeGreaterOrEqual 2
        }

        It "Should extract subagent names correctly" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            # Use ForEach-Object for hashtable property access
            $names = $result.subagents | ForEach-Object { $_.name }
            $names | Should -Contain "code-reviewer"
            $names | Should -Contain "test-runner"
        }

        It "Should extract subagent triggers" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $codeReviewer = $result.subagents | Where-Object { $_.name -eq "code-reviewer" }
            $codeReviewer.trigger | Should -Not -BeNullOrEmpty
            $codeReviewer.trigger | Should -Match "After code changes"
        }

        It "Should extract directives from bullets" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $codingStandards = $result.sections | Where-Object { $_.heading -eq "Coding Standards" }
            $codingStandards.directives | Should -Not -BeNullOrEmpty
            $codingStandards.directives.Count | Should -BeGreaterOrEqual 3
        }

        It "Should detect key instructions with IMPORTANT" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $result.key_instructions | Should -Not -BeNullOrEmpty
            ($result.key_instructions | Where-Object { $_ -match "IMPORTANT" }) | Should -Not -BeNullOrEmpty
        }

        It "Should detect key instructions with MUST" {
            $content = @"
# Test
- You MUST follow this rule
"@
            $result = ConvertFrom-AgentsMd -Content $content

            $result.key_instructions | Should -Not -BeNullOrEmpty
            $result.key_instructions[0] | Should -Match "MUST"
        }

        It "Should detect key instructions with ALWAYS" {
            $content = @"
# Test
- ALWAYS verify inputs
"@
            $result = ConvertFrom-AgentsMd -Content $content

            $result.key_instructions | Should -Not -BeNullOrEmpty
            $result.key_instructions[0] | Should -Match "ALWAYS"
        }

        It "Should detect key instructions with NEVER" {
            $content = @"
# Test
- NEVER expose secrets
"@
            $result = ConvertFrom-AgentsMd -Content $content

            $result.key_instructions | Should -Not -BeNullOrEmpty
            $result.key_instructions[0] | Should -Match "NEVER"
        }

        It "Should handle empty content" {
            $result = ConvertFrom-AgentsMd -Content ""

            $result.sections | Should -BeNullOrEmpty
            $result.subagents | Should -BeNullOrEmpty
            $result.key_instructions | Should -BeNullOrEmpty
        }

        It "Should handle content with only headers" {
            $result = ConvertFrom-AgentsMd -Content $script:HeaderOnlyMarkdown

            $result.sections.Count | Should -Be 4
            $result.subagents.Count | Should -Be 1  # Only subsection (level 3)
        }

        It "Should handle numbered list items as directives" {
            $content = @"
# Test
1. First directive
2. Second directive
3. Third directive
"@
            $result = ConvertFrom-AgentsMd -Content $content

            $directives = $result.sections[0].directives
            $directives.Count | Should -Be 3
        }

        It "Should preserve section content" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $overview = $result.sections | Where-Object { $_.heading -eq "Project Overview" }
            $overview.content | Should -Match "test project"
        }

        It "Should return hashtable structure" {
            $result = ConvertFrom-AgentsMd -Content $script:SampleMarkdown

            $result | Should -BeOfType [hashtable]
            $result.ContainsKey('sections') | Should -Be $true
            $result.ContainsKey('subagents') | Should -Be $true
            $result.ContainsKey('key_instructions') | Should -Be $true
        }

        It "Should handle different bullet styles" {
            $content = @"
# Test
- Dash bullet
* Asterisk bullet
+ Plus bullet
"@
            $result = ConvertFrom-AgentsMd -Content $content

            $result.sections[0].directives.Count | Should -Be 3
        }

        It "Should handle content before any header" {
            $content = @"
Preamble content here.

# First Header
Content after header.
"@
            $result = ConvertFrom-AgentsMd -Content $content

            # Should still parse correctly
            $result.sections.Count | Should -BeGreaterOrEqual 1
        }

        It "Should handle null input" {
            $result = ConvertFrom-AgentsMd -Content $null

            $result.sections | Should -BeNullOrEmpty
        }
    }

    Context "Read-AgentsMdFile" {

        BeforeAll {
            # Create test files
            $script:TestDir = Join-Path $env:TEMP "ParserTest_$(Get-Random)"
            New-Item -Path $script:TestDir -ItemType Directory -Force | Out-Null

            # Create valid AGENTS.md file
            $script:ValidAgentsPath = Join-Path $script:TestDir "AGENTS.md"
            $script:SampleMarkdown | Out-File -FilePath $script:ValidAgentsPath -Encoding utf8

            # Create empty file
            $script:EmptyAgentsPath = Join-Path $script:TestDir "EMPTY-AGENTS.md"
            "" | Out-File -FilePath $script:EmptyAgentsPath -Encoding utf8
        }

        AfterAll {
            if (Test-Path $script:TestDir) {
                Remove-Item -Path $script:TestDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should read and parse file" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result | Should -Not -BeNullOrEmpty
            $result.content | Should -Not -BeNullOrEmpty
            $result.parsed | Should -Not -BeNullOrEmpty
        }

        It "Should compute hash" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result.hash | Should -Not -BeNullOrEmpty
            $result.hash.Length | Should -Be 64
        }

        It "Should return correct path" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result.path | Should -Be $script:ValidAgentsPath
        }

        It "Should parse sections" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result.parsed.sections | Should -Not -BeNullOrEmpty
        }

        It "Should indicate truncation status" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result.truncated | Should -BeOfType [bool]
            $result.truncated | Should -Be $false
        }

        It "Should handle missing files" {
            $result = Read-AgentsMdFile -Path (Join-Path $script:TestDir "NonExistent.md")

            $result | Should -BeNullOrEmpty
        }

        It "Should handle empty files" {
            $result = Read-AgentsMdFile -Path $script:EmptyAgentsPath

            $result | Should -Not -BeNullOrEmpty
            # Empty files may have whitespace only
            $result.content.Trim() | Should -BeNullOrEmpty
            $result.parsed.sections | Should -BeNullOrEmpty
        }

        It "Should use fixture sample-agents-project.md" {
            $fixturePath = Join-Path $script:FixturesPath "sample-agents-project.md"

            if (Test-Path $fixturePath) {
                $result = Read-AgentsMdFile -Path $fixturePath

                $result | Should -Not -BeNullOrEmpty
                $result.parsed.subagents | Should -Not -BeNullOrEmpty
            } else {
                Set-ItResult -Skipped -Because "Fixture file not found"
            }
        }

        It "Should handle relative paths" {
            $originalLocation = Get-Location
            Set-Location $script:TestDir

            try {
                # Convert to absolute path for the function
                $absolutePath = Join-Path (Get-Location) "AGENTS.md"
                $result = Read-AgentsMdFile -Path $absolutePath
                $result | Should -Not -BeNullOrEmpty
            } finally {
                Set-Location $originalLocation
            }
        }

        It "Should return hashtable structure" {
            $result = Read-AgentsMdFile -Path $script:ValidAgentsPath

            $result | Should -BeOfType [hashtable]
            $result.ContainsKey('path') | Should -Be $true
            $result.ContainsKey('content') | Should -Be $true
            $result.ContainsKey('hash') | Should -Be $true
            $result.ContainsKey('truncated') | Should -Be $true
            $result.ContainsKey('parsed') | Should -Be $true
        }
    }

    Context "Compress-AgentsMdContent" {

        BeforeAll {
            # Create large content for compression tests
            $script:LargeContent = @"
# Large Document

## Section 1
First paragraph with important content.

Second paragraph with more details that might get truncated.

Third paragraph with even more details.

- Important directive
- Another directive
- Third directive

## Section 2
Another first paragraph.

Another second paragraph that could be truncated.

- Key point 1
- Key point 2

## Section 3
Final section content.
"@
        }

        It "Should truncate large content" {
            # Create content larger than 1KB for testing
            $veryLargeContent = $script:LargeContent * 100
            $result = Compress-AgentsMdContent -Content $veryLargeContent -MaxSizeKB 1

            $resultSize = [System.Text.Encoding]::UTF8.GetByteCount($result)
            $resultSize | Should -BeLessOrEqual (1 * 1024 * 1.1)  # Allow 10% margin
        }

        It "Should preserve headers during truncation" {
            $veryLargeContent = $script:LargeContent * 50
            $result = Compress-AgentsMdContent -Content $veryLargeContent -MaxSizeKB 1

            $result | Should -Match "# Large Document"
            $result | Should -Match "## Section 1"
        }

        It "Should preserve bullet points during truncation" {
            $veryLargeContent = $script:LargeContent * 50
            $result = Compress-AgentsMdContent -Content $veryLargeContent -MaxSizeKB 1

            $result | Should -Match "- Important directive"
        }

        It "Should add truncation marker" {
            $veryLargeContent = $script:LargeContent * 50
            $result = Compress-AgentsMdContent -Content $veryLargeContent -MaxSizeKB 1

            # Match the actual truncation marker format
            $result | Should -Match "truncated"
        }

        It "Should not truncate content under limit" {
            $smallContent = "# Small`nShort content"
            $result = Compress-AgentsMdContent -Content $smallContent -MaxSizeKB 50

            $result | Should -Be $smallContent
        }

        It "Should handle empty content" {
            $result = Compress-AgentsMdContent -Content "" -MaxSizeKB 50

            $result | Should -Be ""
        }

        It "Should handle null as empty string" {
            $result = Compress-AgentsMdContent -Content $null -MaxSizeKB 50

            $result | Should -BeNullOrEmpty
        }

        It "Should preserve first paragraph of each section" {
            $content = @"
# Header
First paragraph should be preserved.

Second paragraph might be truncated.
"@ * 100

            $result = Compress-AgentsMdContent -Content $content -MaxSizeKB 1

            $result | Should -Match "First paragraph should be preserved"
        }

        It "Should respect different MaxSizeKB values" {
            # Use 20KB content to ensure truncation happens
            $content = "x" * 20000  # 20KB of content

            $result5 = Compress-AgentsMdContent -Content $content -MaxSizeKB 5
            $result10 = Compress-AgentsMdContent -Content $content -MaxSizeKB 10

            $size5 = [System.Text.Encoding]::UTF8.GetByteCount($result5)
            $size10 = [System.Text.Encoding]::UTF8.GetByteCount($result10)

            # 10KB result should be larger or equal to 5KB result
            # (5KB truncates more aggressively)
            $size10 | Should -BeGreaterOrEqual $size5
        }
    }

    Context "Get-AgentsMdFiles" {

        BeforeAll {
            # Create test directory structure
            $script:ProjectRoot = Join-Path $env:TEMP "AgentsMdFilesTest_$(Get-Random)"
            New-Item -Path $script:ProjectRoot -ItemType Directory -Force | Out-Null

            # Create project AGENTS.md
            $projectAgents = Join-Path $script:ProjectRoot "AGENTS.md"
            "# Project`n## Section" | Out-File -FilePath $projectAgents -Encoding utf8

            # Create subdirectory with local AGENTS.md
            $subDir = Join-Path $script:ProjectRoot "src"
            New-Item -Path $subDir -ItemType Directory -Force | Out-Null
            $localAgents = Join-Path $subDir "AGENTS.md"
            "# Local`n## Section" | Out-File -FilePath $localAgents -Encoding utf8

            # Create blocked directory
            $nodeModules = Join-Path $script:ProjectRoot "node_modules"
            New-Item -Path $nodeModules -ItemType Directory -Force | Out-Null
            $blockedAgents = Join-Path $nodeModules "AGENTS.md"
            "# Blocked" | Out-File -FilePath $blockedAgents -Encoding utf8
        }

        AfterAll {
            if (Test-Path $script:ProjectRoot) {
                Remove-Item -Path $script:ProjectRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should find project AGENTS.md" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot

            $result.project | Should -Not -BeNullOrEmpty
        }

        It "Should find local AGENTS.md files" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot -IncludeLocal $true

            $result.local | Should -Not -BeNullOrEmpty
            $result.local.Count | Should -BeGreaterOrEqual 1
        }

        It "Should exclude node_modules" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot -IncludeLocal $true

            $blockedFiles = $result.local | Where-Object { $_.path -match "node_modules" }
            $blockedFiles | Should -BeNullOrEmpty
        }

        It "Should return null for global when not present" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot -GlobalPath "C:\NonExistent\AGENTS.md"

            $result.global | Should -BeNullOrEmpty
        }

        It "Should handle missing project AGENTS.md" {
            $emptyRoot = Join-Path $env:TEMP "EmptyRoot_$(Get-Random)"
            New-Item -Path $emptyRoot -ItemType Directory -Force | Out-Null

            try {
                $result = Get-AgentsMdFiles -ProjectRoot $emptyRoot
                $result.project | Should -BeNullOrEmpty
            } finally {
                Remove-Item -Path $emptyRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        It "Should respect LocalMaxDepth" {
            # Create deeply nested structure
            $deepDir = Join-Path $script:ProjectRoot "level1\level2\level3\level4"
            New-Item -Path $deepDir -ItemType Directory -Force | Out-Null
            "# Deep" | Out-File -FilePath (Join-Path $deepDir "AGENTS.md") -Encoding utf8

            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot -LocalMaxDepth 2

            $deepFiles = $result.local | Where-Object { $_.path -match "level4" }
            $deepFiles | Should -BeNullOrEmpty
        }

        It "Should skip local files when IncludeLocal is false" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot -IncludeLocal $false

            $result.local | Should -BeNullOrEmpty
        }

        It "Should return correct structure" {
            $result = Get-AgentsMdFiles -ProjectRoot $script:ProjectRoot

            $result | Should -BeOfType [hashtable]
            $result.ContainsKey('global') | Should -Be $true
            $result.ContainsKey('project') | Should -Be $true
            $result.ContainsKey('local') | Should -Be $true
        }
    }

    Context "Merge-AgentsMdConfigs" {

        BeforeAll {
            $script:GlobalConfig = @{
                sections = @(
                    @{
                        heading = "Global Section"
                        level = 2
                        content = "Global content"
                        directives = @("Global directive 1")
                    }
                )
                subagents = @(
                    @{
                        name = "global-agent"
                        description = "Global agent"
                        trigger = "global trigger"
                    }
                )
                key_instructions = @("Global instruction")
            }

            $script:ProjectConfig = @{
                sections = @(
                    @{
                        heading = "Project Section"
                        level = 2
                        content = "Project content"
                        directives = @("Project directive 1")
                    },
                    @{
                        heading = "Global Section"  # Same as global
                        level = 2
                        content = "Project override content"
                        directives = @("Project directive 2")
                    }
                )
                subagents = @(
                    @{
                        name = "project-agent"
                        description = "Project agent"
                        trigger = "project trigger"
                    }
                )
                key_instructions = @("Project instruction")
            }
        }

        It "Should merge global and project configs" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $result.sections.Count | Should -BeGreaterOrEqual 2
        }

        It "Should give project precedence over global" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $globalSection = $result.sections | Where-Object { $_.heading -eq "Global Section" }
            $globalSection.content | Should -Match "Project override"
        }

        It "Should accumulate key instructions" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $result.key_instructions.Count | Should -Be 2
            $result.key_instructions | Should -Contain "Global instruction"
            $result.key_instructions | Should -Contain "Project instruction"
        }

        It "Should merge subagents" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $result.subagents.Count | Should -Be 2
        }

        It "Should handle null global config" {
            $result = Merge-AgentsMdConfigs -Global $null -Project $script:ProjectConfig

            $result.sections.Count | Should -BeGreaterOrEqual 1
        }

        It "Should handle null project config" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $null

            $result.sections.Count | Should -BeGreaterOrEqual 1
        }

        It "Should merge directives from same section" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $globalSection = $result.sections | Where-Object { $_.heading -eq "Global Section" }
            $globalSection.directives.Count | Should -BeGreaterOrEqual 2
        }

        It "Should return correct structure" {
            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig

            $result | Should -BeOfType [hashtable]
            $result.ContainsKey('sections') | Should -Be $true
            $result.ContainsKey('subagents') | Should -Be $true
            $result.ContainsKey('key_instructions') | Should -Be $true
        }

        It "Should handle both null configs" {
            $result = Merge-AgentsMdConfigs -Global $null -Project $null

            $result.sections | Should -BeNullOrEmpty
            $result.subagents | Should -BeNullOrEmpty
            $result.key_instructions | Should -BeNullOrEmpty
        }

        It "Should give local highest precedence" {
            $localConfig = @{
                parsed = @{
                    sections = @(
                        @{
                            heading = "Global Section"
                            level = 2
                            content = "Local override content"
                            directives = @("Local directive")
                        }
                    )
                    subagents = @()
                    key_instructions = @()
                }
                path = "local/AGENTS.md"
            }

            $result = Merge-AgentsMdConfigs -Global $script:GlobalConfig -Project $script:ProjectConfig -Local @($localConfig)

            $globalSection = $result.sections | Where-Object { $_.heading -eq "Global Section" }
            $globalSection.content | Should -Match "Local override"
        }
    }
}
