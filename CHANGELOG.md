# Changelog

All notable changes to the Claude Vibe plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/physics91/claude-vibe/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/physics91/claude-vibe/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/physics91/claude-vibe/releases/tag/v0.0.1
