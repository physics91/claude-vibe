# Changelog

All notable changes to the Claude Vibe plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-11-24

### Added
- **Vibe Coding Assistant**: Intelligent prompt analysis and clarification system
  - UserPromptSubmit hook that automatically analyzes prompts for ambiguity
  - Prompt analyzer module with 8 ambiguity detection patterns
  - Interactive clarification using Claude Code's AskUserQuestion
  - Smart detection of missing tech stack, vague verbs, unclear context
- **Prompt Clarifier Skill**: Automated skill activation for ambiguous prompts
  - Uses multiple-choice selections for quick user input
  - Generates targeted questions based on detected issues
  - Provides helpful tips for better prompt writing
- **Comprehensive Testing**:
  - Unit tests for prompt analyzer (8 test cases)
  - End-to-end tests (7 scenarios + 2 integration tests)
  - Test helpers and utilities
  - 100% test coverage for core workflow
- **Enhanced Documentation**:
  - Updated README with usage examples
  - Added configuration guide
  - Included Korean documentation (README.ko.md)
  - Added e2e testing documentation

### Changed
- **Plugin renamed**: From "agents-context-preserver" to "claude-vibe"
- **Updated descriptions**: Reflects new vibe coding capabilities
- **Enhanced keywords**: Added vibe-coding, prompt-clarification, interactive, skill

### Technical Details
- New modules: `lib/core/prompt-analyzer.ps1`, `lib/core/clarification-generator.ps1`
- New hook: `hooks/user-prompt-submit.ps1`
- New skill: `skills/prompt-clarifier/SKILL.md`
- Test suite: `tests/test-prompt-analyzer.ps1`, `tests/e2e/`
- Total additions: ~1,646 lines of code

## [0.0.1] - 2025-11-23

### Added
- Initial release
- **AGENTS Context Preserver**: Automatic context preservation during compaction
  - PreCompact hook for capturing context
  - SessionStart hook for restoring context
  - AGENTS.md parser (project/global/local)
  - State storage and loading
- Basic plugin structure
- PowerShell-based implementation
- MIT License

### Features
- Automatic AGENTS.md parsing
- Context saving on compaction
- Context restoration on session start
- Task state tracking
- Security utilities

---

[0.1.0]: https://github.com/physics91/claude-vibe/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/physics91/claude-vibe/releases/tag/v0.0.1
