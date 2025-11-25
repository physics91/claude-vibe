# Claude-Vibe Architecture

> Last updated: 2025-01-25

## Overview

Claude-Vibe is a PowerShell-based plugin for Claude Code that provides context management, token optimization, and project detection features.

## Directory Structure

```
claude-vibe/
├── lib/
│   ├── core/           # Core business logic modules
│   │   ├── storage.ps1           # Context state persistence with file locking
│   │   ├── preset-manager.ps1    # Preset configuration management
│   │   ├── project-detector.ps1  # Project type detection with caching
│   │   ├── command-manager.ps1   # Slash command management
│   │   ├── mcp-config-generator.ps1  # MCP server configuration
│   │   ├── parser.ps1            # AGENTS.md parsing
│   │   ├── constants.ps1         # Centralized constants
│   │   └── exceptions.ps1        # Custom exception classes
│   └── utils/          # Utility modules
│       ├── conversion-helpers.ps1    # JSON/hashtable conversion
│       ├── safe-access.ps1           # Safe property access
│       ├── validation.ps1            # Input validation utilities
│       ├── schema-validator.ps1      # JSON schema validation
│       ├── security.ps1              # Security utilities
│       ├── module-loader.ps1         # Dependency management
│       ├── prompt-analyzer.ps1       # Prompt analysis
│       └── clarification-generator.ps1  # Clarification prompts
├── schemas/            # JSON Schema definitions
├── presets/            # Built-in preset configurations
├── hooks/              # Claude Code hook definitions
├── managed-commands/   # Slash command templates
└── tests/              # Test suite
```

## Module Dependency Graph

```
                    ┌─────────────────┐
                    │   exceptions    │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │validation │     │ security  │     │ constants │
    └───────────┘     └─────┬─────┘     └─────┬─────┘
                            │                 │
    ┌───────────────────────┼─────────────────┤
    │                       │                 │
    ▼                       ▼                 ▼
┌────────────────┐   ┌───────────┐   ┌────────────────┐
│conversion-     │   │  storage  │   │ command-       │
│helpers         │   └─────┬─────┘   │ manager        │
└───────┬────────┘         │         └────────────────┘
        │                  │
        ├──────────────────┤
        │                  │
        ▼                  ▼
┌────────────────┐   ┌───────────────┐
│preset-manager  │   │    parser     │
└───────┬────────┘   └───────────────┘
        │
        ├────────────────────────┐
        │                        │
        ▼                        ▼
┌────────────────┐   ┌────────────────────┐
│project-detector│   │mcp-config-generator│
└────────────────┘   └────────────────────┘
```

## Data Flow

### 1. Session Start Hook

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Claude Code  │───▶│ hooks.json   │───▶│ hook-handler │
│ Session      │    │ SessionStart │    │    .ps1      │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                    ┌──────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Project       │
            │ Detection     │
            └───────┬───────┘
                    │
      ┌─────────────┴─────────────┐
      │                           │
      ▼                           ▼
┌───────────┐              ┌───────────┐
│  Preset   │              │  Context  │
│  Loading  │              │  Restore  │
└───────────┘              └───────────┘
```

### 2. Context State Persistence

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Context    │     │   storage    │     │   File       │
│   Update     │────▶│   .ps1       │────▶│   System     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            │ File Locking
                            │ (Exponential Backoff)
                            ▼
                     ┌──────────────┐
                     │ context-     │
                     │ state.json   │
                     └──────────────┘
```

### 3. Project Detection Flow

```
┌──────────────┐
│ Project Root │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Cache Check  │────▶│ Return       │
│ (TTL: 5min)  │ hit │ Cached       │
└──────┬───────┘     └──────────────┘
       │ miss
       ▼
┌──────────────┐
│ File/Dep     │
│ Analysis     │
└──────┬───────┘
       │
       ├────────────────┐
       │                │
       ▼                ▼
┌───────────┐    ┌───────────┐
│ Score     │    │ Match     │
│ Calc      │    │ Presets   │
└───────────┘    └───────────┘
       │                │
       └────────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Cache Result  │
        │ & Return      │
        └───────────────┘
```

## Key Components

### Storage Module (`lib/core/storage.ps1`)

Handles context state persistence with:
- File-based locking with exponential backoff
- Atomic writes with temp file swap
- Backup management
- Lock file cleanup

**Key Functions:**
- `New-FileLock`: Acquires file lock with retry
- `Save-ContextState`: Persists context with locking
- `Load-ContextState`: Loads context state
- `New-Backup`: Creates backup copies

### Preset Manager (`lib/core/preset-manager.ps1`)

Manages context optimization presets:
- Built-in presets (minimal, web-dev, api-dev, data-science)
- Custom preset support
- Token estimation

**Key Functions:**
- `Get-AllPresets`: Lists available presets
- `Get-PresetByName`: Retrieves specific preset
- `Apply-Preset`: Applies preset to project

### Project Detector (`lib/core/project-detector.ps1`)

Analyzes projects to recommend presets:
- File pattern matching
- Dependency analysis (package.json, requirements.txt, etc.)
- Result caching (TTL-based)

**Key Functions:**
- `Detect-ProjectType`: Main detection with caching
- `Get-ProjectDependencies`: Extracts dependencies
- `Clear-DetectionCache`: Cache management

### Schema Validator (`lib/utils/schema-validator.ps1`)

Validates JSON configuration files:
- JSON Schema draft-07 support
- Type, format, and constraint validation
- Schema caching

**Key Functions:**
- `Test-JsonSchema`: Validates data against schema
- `Test-ConfigFile`: Validates file against schema
- `Get-AvailableSchemas`: Lists schemas

### Exception Handling (`lib/core/exceptions.ps1`)

Centralized exception classes:
- `JsonParsingException`: JSON parse errors with line info
- `ConfigurationException`: Configuration errors with key/path
- `ModuleLoadException`: Module loading failures
- `ValidationException`: Validation failures
- `OperationResult`: Success/failure result objects

## Security Considerations

### Path Validation
- `Test-TrustedPath`: Validates paths are in trusted directories
- `-LiteralPath` usage for all file operations
- Path traversal prevention

### Input Validation
- Command name format validation (regex)
- File size limits (DoS prevention)
- Frontmatter length limits

### Secret Detection
- API key pattern matching
- Sensitive file exclusion (.env, *.pem, etc.)

## Performance Optimizations

### Caching
- Detection result caching (5-minute TTL)
- Schema file caching
- LRU eviction for cache size limits

### File Locking
- Exponential backoff (50ms to 1000ms)
- Optional jitter for thundering herd prevention
- Configurable timeouts

## Configuration

### Environment Variables
- `CLAUDE_VIBE_DATA_DIR`: Custom data directory
- `CLAUDE_CONFIG_DIR`: Custom Claude config directory

### Hook Configuration (`hooks/hooks.json`)
```json
{
  "hooks": [
    {
      "matcher": { "type": "event", "event": "SessionStart" },
      "hooks": [{ "type": "command", "command": "pwsh hook-handler.ps1" }]
    }
  ]
}
```

## Testing

Test suite in `tests/test-refactor.ps1`:
- 58 test cases
- ~90% code coverage
- Module loading validation
- Function signature verification
- Integration tests

Run tests:
```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File tests/test-refactor.ps1
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-25 | Initial architecture documentation |
