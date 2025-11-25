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
- Graceful degradation: return empty string on error, don't block Claude
- Exit code 0 for success, 2 for blocking errors
- Log errors to stderr, output to stdout

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
