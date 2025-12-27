# AGENTS.md - Claude Vibe Plugin

## Project Overview

**Claude Vibe** is a Claude Code plugin that enhances AI-assisted development with:
- Intelligent context management during compaction
- Vibe coding support through interactive prompt clarification
- AGENTS.md parsing and preservation

### Technologies
- **Primary**: PowerShell 5.1+, Bash 4.0+
- **Support**: Python (JSON processing)
- **Platform**: Cross-platform (Windows, Linux, macOS)

### Structure
```
├── .claude-plugin/     # Plugin manifest and marketplace config
├── commands/           # Slash commands (/init-agents)
├── hooks/              # Event handlers (PreCompact, SessionStart, UserPromptSubmit)
├── skills/             # AI skills (prompt-clarifier)
├── lib/                # Core libraries (parser, storage, analyzer)
├── schemas/            # JSON validation schemas
└── tests/              # Unit and E2E tests
```

## Repository Defaults (Safe by Default)

- Follow local + CI quality gates (format/lint/typecheck/test and any security/policy checks). If an exception is needed, document the reason, an alternative, and a safety net (tests/verification) in the PR.
- Prefer KISS/YAGNI and single-responsibility design. Keep I/O (files/process/HTTP) at the edges so core logic stays testable.
- DRY/SSOT: avoid duplicating business rules without premature abstraction (consider extracting after ~3 repeats). Keep schemas/contracts/policies as a single source of truth; treat caches/indexes/views as derived data that can be rebuilt.
- Code clarity: intention-revealing names (include units like `timeoutMs`, `sizeBytes`; booleans `is/has/can`), small functions, avoid deep nesting, validate external inputs at boundaries, and prefer immutability/minimal shared state. Comments explain “why”, not “what”.
- Errors/observability: preserve context and classify recoverability, never log secrets/PII, and carry a correlation/request id when available.
- Testing: unit > integration > E2E. Test behavior/contracts (not implementation) and avoid time/random/network flakiness (fixed clock/seed and mocks/stubs).
- Security/performance: separate authentication vs authorization, least privilege, keep secrets out of the repo, follow dependency vulnerability/license policy, measure before optimizing, avoid N+1/unnecessary I/O, and design caches with invalidation/consistency.
- PR hygiene: keep PRs small, explain intent/tradeoffs, separate refactors from behavior changes, and leave touched code cleaner.

### Pre-PR 2-Minute Check
- Do names clearly communicate intent?
- Is failure/edge-case behavior safe?
- Do tests cover risky branches/boundaries?
- Any security issues (inputs/permissions/secrets/deps)?
- Any performance sanity issues (N+1/I-O blowups/unnecessary I/O)?
- Can operators trace failures (logs/ids/error context)?

## Build & Run Commands

```bash
# No build required - plugin runs directly

# Run unit tests
./tests/test-prompt-analyzer.ps1

# Run E2E tests
./tests/e2e/run-e2e-tests.ps1

# Run E2E tests with verbose output
./tests/e2e/run-e2e-tests.ps1 -Verbose
```

## Code Style & Conventions

### Naming
- **Files**: kebab-case (`prompt-analyzer.ps1`, `hooks.json`)
- **Functions**: PascalCase with Verb-Noun (`Test-PromptAmbiguity`, `Get-SafeHashValue`)
- **Variables**: camelCase (`$hookInput`, `$ambiguityScore`)
- **Constants**: SCREAMING_SNAKE_CASE for environment variables

### PowerShell Standards
- Use `[CmdletBinding()]` for all functions
- Include `[OutputType()]` attributes
- Use `param()` blocks with type declarations
- Set `$ErrorActionPreference = 'Stop'` for strict error handling
- Use `Set-StrictMode -Version Latest`

### Error Handling
- Graceful degradation: return empty output on error and don't block Claude
- Exit code 0 for success, 2 for blocking errors
- Log errors to stderr with actionable context (no secrets/PII); write only hook output to stdout

## Architecture Guidelines

### Hook Flow
1. **UserPromptSubmit**: Analyzes prompt → activates skill if ambiguous
2. **PreCompact**: Captures context before compaction
3. **SessionStart**: Restores context after compaction

### Module Organization
- `lib/core/`: Core functionality (parser, storage, analyzer)
- `lib/utils/`: Utility functions (security)
- `hooks/`: Executable hook scripts with platform wrappers
- `skills/`: SKILL.md files for AI capabilities

### Data Flow
- Hooks receive JSON via stdin
- Hooks output JSON/markdown to stdout
- Context stored in `~/.claude/claude-vibe/`

## Agent Instructions

### IMPORTANT Directives

- **MUST** use `${CLAUDE_PLUGIN_ROOT}` for plugin-relative paths in hooks.json
- **MUST** wrap hooks.json content in `"hooks": { }` key
- **MUST** end hooks path with `.json` in plugin.json
- **NEVER** block Claude Code execution on hook errors - graceful degradation
- **ALWAYS** return exit code 0 unless intentionally blocking
- **ALWAYS** test changes with `./tests/e2e/run-e2e-tests.ps1`

### Plugin Structure Rules

- `plugin.json` goes in `.claude-plugin/` directory
- `commands/`, `hooks/`, `skills/` go in plugin root (NOT inside .claude-plugin/)
- Hook scripts need platform wrappers (no extension for Unix, .ps1 for Windows)

### Hook Output Rules

- **UserPromptSubmit**: Output skill activation instruction or empty
- **PreCompact**: Output context JSON to be preserved
- **SessionStart**: Output markdown to inject into new session

### Testing Requirements

- Run E2E tests before committing hook changes
- Verify both ambiguous and clear prompt scenarios
- Check log output in `logs/` directory

### Progress Management

**MUST** use `AGENTS_PROGRESS.md` to track work progress:
- Keep only the 5 most recent items (including completed tasks)
- Format each item as: `[status] Task description (timestamp)`
- Statuses: `[ ]` Pending, `[~]` In Progress, `[x]` Completed
- **ALWAYS** clean up old items when adding new ones
- Never let this file grow beyond 5 items total

**Example AGENTS_PROGRESS.md:**
```markdown
# Work Progress

[~] Implementing user authentication (2025-01-15)
[x] Fixed database connection bug (2025-01-14)
[x] Added unit tests for API (2025-01-13)
```
