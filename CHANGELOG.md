# Changelog

All notable changes to the Claude Vibe plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-16

### New Skills (4 new)
- **typescript-reviewer**: TypeScript type safety and best practices
  - `any` abuse detection (explicit, implicit, `as any`)
  - `@ts-ignore`/`@ts-nocheck` suppression detection
  - Type assertion safety checks
  - tsconfig.json analysis (strict mode, compiler options)
  - External data validation requirements
  - Generic constraint patterns
  - AI-reviewed and enhanced with Codex/Gemini feedback

- **java-reviewer**: Java idioms and modern features
  - Exception handling patterns (empty catch, Throwable)
  - Resource management (try-with-resources)
  - Mutable static fields detection
  - Raw types and generics usage
  - Stream anti-patterns
  - Modern Java 17+ feature adoption (records, pattern matching)

- **spring-boot-reviewer**: Spring Boot patterns and security
  - Field injection vs constructor injection
  - N+1 query detection and DataLoader patterns
  - `@Transactional` management and self-invocation issues
  - Security configuration (Actuator exposure, @PreAuthorize)
  - DTO validation and entity exposure
  - WebFlux blocking call detection
  - AI-reviewed with Gemini feedback on proxy pitfalls

- **graphql-reviewer**: GraphQL schema and resolver patterns
  - N+1 detection and DataLoader usage
  - Query complexity and depth limits
  - Input validation requirements
  - Pagination patterns (Relay connections)
  - Error handling best practices
  - Security (rate limiting, introspection)

### Testing Improvements
- **Core Library Unit Tests**: 0% → 80%+ coverage
  - `validation.js`: 38 tests (all pure functions)
  - `output-formatter.js`: 21 tests (output formatting)
  - `logger.js`: 10 tests (structured logging)
  - `http-client.js`: 35 tests (with mock HTTP server)
- **Total Tests**: 32 → 146 (+114 tests)
- **Mock Server Infrastructure**: Local HTTP server for webhook testing

### AI-Assisted Development
- Codex and Gemini MCP tools used for skill review
- Identified and fixed 15+ issues in TypeScript skill
- Added 6 missing patterns based on AI feedback
- Enhanced severity classifications

### Metrics
- Skills: 34 → 38 (+4: typescript, java, spring-boot, graphql)
- Tests: 32 → 146 (+114)
- Core library coverage: 0% → 80%+

---

## [2.0.0] - 2025-12-16

### Major Changes

#### Node.js Migration
- **Complete Hook Rewrite**: All hooks migrated from PowerShell/Bash to Node.js
- **Unified Core Library**: New `hooks/lib/core/` with shared modules
- **Cross-platform Support**: Native Node.js runs on Windows/macOS/Linux without shell dependencies

#### New Core Library (`hooks/lib/`)
- `stdin-reader.js`: Unified stdin JSON parsing
- `output-formatter.js`: Hook output formatting (context, permission, stop, notification)
- `constants.js`: Centralized configuration (limits, patterns, timeouts)
- `logger.js`: Structured logging with file output support
- `security.js`: Security validation (dangerous commands, protected files)
- `http-client.js`: HTTP client for webhooks (ntfy, Slack)
- `validation.js`: Input validation utilities

#### New Hooks
- **PreToolUse Safety Guard** (`pre-tool-use-safety.js`):
  - Blocks dangerous Bash commands (rm -rf, force push, chmod 777)
  - Protects sensitive files (.env, SSH keys, credentials)
  - Pattern-based validation with severity levels

- **Stop Quality Gate** (`stop-quality-gate.js`):
  - Checks for failing tests before session end
  - Warns about uncommitted git changes
  - Reports pending todos

- **StatusLine Custom** (`status-line.js`):
  - Token usage estimation display
  - Tool usage tracking
  - Session duration monitoring

- **Notification Handler** (`notification-handler.js`):
  - ntfy.sh webhook support
  - Slack webhook support
  - Desktop notifications (cross-platform)
  - Sub-agent notification suppression

#### New Skills (3 new)
- **ios-reviewer**: Swift/SwiftUI/UIKit code review
  - SwiftUI patterns (State, StateObject, ObservedObject)
  - Combine/async-await best practices
  - Memory management and retain cycles
  - UIKit lifecycle patterns

- **flutter-reviewer**: Flutter/Dart code review
  - Widget build optimization
  - BLoC/Provider/Riverpod patterns
  - Platform channel best practices
  - Performance optimization

- **ml-reviewer**: Machine Learning/Deep Learning code review
  - PyTorch/TensorFlow patterns
  - Training loop optimization
  - Data pipeline checks (leakage detection)
  - MLOps patterns (experiment tracking, reproducibility)

### Migrated Hooks
- `session-start.js`: AGENTS.md re-injection (from inject-agents.js)
- `pre-compact.js`: Session state saving
- `user-prompt-submit.js`: Prompt ambiguity analysis
- `post-tool-use.js`: Pattern learning and optimization suggestions

### Testing
- New unified test suite: `tests/hooks.test.js`
- 32 tests covering all hooks and utilities
- Security validation tests
- Cross-platform compatibility tests

### Metrics
- Skills: 31 → 34 (+3: ios-reviewer, flutter-reviewer, ml-reviewer)
- Hooks: 4 → 8 (+4: PreToolUse, Stop, StatusLine, Notification)
- Core modules: PowerShell → Node.js (complete migration)
- Test coverage: 32 unit tests

### Breaking Changes
- Hooks now require Node.js instead of PowerShell
- Hook JSON output format standardized (see `output-formatter.js`)

### Compatibility
- Requires Node.js 16+ (LTS recommended)
- Claude Code v1.0.0+
- All existing skills and commands remain compatible

---

## [0.4.1] - 2025-11-27

### Security Improvements (AI Code Review)
- **Cross-platform ACL handling**: Unix/Linux support via `chmod 600/700`, graceful degradation
- **JSON-style secret detection**: 6 new patterns for `"api_key": "..."` format
- **OpenAI/Anthropic key patterns**: Detects `sk-...T3BlbkFJ...` and `sk-ant-...` formats
- **High-entropy secret detection**: 32+ hex characters in JSON values
- **Cache data sanitization**: Automatic redaction via `Remove-SensitiveData` before disk write

### Performance Improvements
- **Transcript memory optimization**: File size check with `MaxFileSizeMB` parameter
- **Large file handling**: Tail-based reading for transcripts >10MB (last 5000 lines)
- **Pre-compiled regex patterns**: Reusable patterns for better performance
- **Early termination**: `Match.NextMatch()` iteration with limits

### Reliability Improvements
- **Atomic cache writes**: Temp file + move pattern prevents corruption
- **Null handling**: `Convert-CacheDataToHashtable` gracefully handles null input
- **Cross-platform graceful degradation**: Continues without blocking on permission errors

### Tests
- New `tests/test-security-patterns.ps1` for secret detection validation
- All E2E and unit tests passing (100% success rate)

---

## [0.4.0] - 2025-11-27

### Added
- **AGENTS.md Caching**: File hash-based cache with TTL support
- **Error Handling Framework**: Centralized exceptions and error codes (CVIBE-xxx)
- **API Documentation**: `docs/api/` for parser, cache, error-handler modules

### Changed
- Refactored parser.ps1 with improved error handling
- Added comprehensive inline documentation

---

## [0.3.0] - 2025-11-26

### Added
- **Express Commands** (10 new aliases):
  - `/r` - Quick code/PR review
  - `/t` - Generate tests
  - `/f` - Fix issues
  - `/a` - Analyze code
  - `/e` - Explain code
  - `/rf` - Refactor code
  - `/cs` - Context setup (alias for /context-setup)
  - `/st` - Skill test
  - `/d` - Debug toggle
  - `/init` - Init AGENTS.md

- **Pattern Learning Engine**:
  - PostToolUse hook for tracking tool usage patterns
  - Inefficiency detection (repeated reads, fragmented edits)
  - Real-time optimization suggestions
  - Rate-limited hints (10 min cooldown)
  - Pattern storage in `~/.claude/claude-vibe/patterns.json`

- **Session Memory**:
  - Cross-session learning per project
  - File insights storage
  - Error solution memory
  - Learned pattern persistence
  - Memory storage in `~/.claude/claude-vibe/memory/`

- **Project Profile Manager**:
  - Project-specific preferences
  - Sticky options for express commands
  - Profile persistence in `.claude/project-profile.json`

- **Skill Suggester**:
  - Auto skill detection by file extension
  - Directory-based skill suggestions
  - Framework detection from imports
  - Context shift detection

### New Modules
- `lib/core/pattern-analyzer.ps1` - Tool usage pattern analysis
- `lib/core/session-memory.ps1` - Cross-session memory
- `lib/core/skill-suggester.ps1` - Smart skill suggestions
- `lib/core/project-profile-manager.ps1` - Project preferences

### Changed
- Commands: 7 → 17 (+10 express aliases)
- Hooks: 3 → 4 (+PostToolUse)
- Core modules: 7 → 11 (+4)

### Compatibility
- **Backward compatible** with v0.2.0
- All existing skills, presets, and hooks work unchanged
- New features are opt-in and non-blocking

---

## [0.2.0] - 2025-11-26

### Added
- **Python Stack Skills** (5 new):
  - `python-reviewer`: PEP8, type hints, Pythonic patterns, error handling
  - `fastapi-reviewer`: Pydantic models, dependency injection, async patterns
  - `django-reviewer`: ORM patterns, views/templates, security, migrations
  - `flask-reviewer`: Blueprint structure, extensions, request handling
  - `python-data-reviewer`: Pandas/NumPy vectorization, memory efficiency

- **Go/Rust Skills** (4 new):
  - `go-reviewer`: Error handling, goroutines, interfaces, testing
  - `go-api-reviewer`: Gin/Echo/Fiber router patterns, middleware
  - `rust-reviewer`: Ownership, lifetimes, error handling, unsafe usage
  - `rust-api-reviewer`: Actix/Axum async patterns, extractors, state

- **DevOps Skills** (5 new):
  - `docker-reviewer`: Multi-stage builds, layer optimization, security
  - `k8s-reviewer`: Resource limits, probes, RBAC, Helm charts
  - `terraform-reviewer`: Module structure, state management, security
  - `ci-cd-reviewer`: GitHub Actions, GitLab CI, pipeline optimization
  - `infra-security-reviewer`: Secrets management, network policies, IAM

- **Database Skills** (4 new):
  - `sql-optimizer`: Query plans, index usage, N+1 detection
  - `schema-reviewer`: Normalization, constraints, indexes, migrations
  - `orm-reviewer`: Prisma/TypeORM/SQLAlchemy patterns
  - `migration-checker`: Backwards compatibility, rollback safety

- **Debug Tools** (4 new commands):
  - `/skill-test`: Test skill detection against sample input
  - `/skill-log`: View skill activation history
  - `/debug`: Toggle verbose debug mode
  - `/validate-skill`: Validate custom skill definitions

- **New Presets** (5 new):
  - `python-web`: FastAPI/Django/Flask development
  - `go-backend`: Gin/Echo/Fiber/Chi backend
  - `rust-systems`: Actix-web/Axum systems
  - `devops`: Docker/K8s/Terraform/CI-CD
  - `full-stack`: Web + API + Database combined

### Changed
- **context-manager**: Updated to support 9 presets and 8 agent categories
- **context-setup**: Enhanced detection for Python, Go, Rust, and DevOps projects
- **All skills**: Standardized description format (WHEN/WHAT/WHEN NOT)
- **Documentation**: Comprehensive README update with skill catalog

### Compatibility
- **Backward compatible** with v0.1.0
- No breaking changes to existing hooks or configurations
- Existing `.claude/` settings remain valid

### Metrics
- Skills: 13 → 31 (+18)
- Commands: 3 → 7 (+4)
- Presets: 4 → 9 (+5)
- Languages: TypeScript/JavaScript, Kotlin → +Python, Go, Rust, SQL

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

[2.1.0]: https://github.com/physics91/claude-vibe/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/physics91/claude-vibe/compare/v0.4.1...v2.0.0
[0.4.1]: https://github.com/physics91/claude-vibe/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/physics91/claude-vibe/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/physics91/claude-vibe/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/physics91/claude-vibe/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/physics91/claude-vibe/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/physics91/claude-vibe/releases/tag/v0.0.1
