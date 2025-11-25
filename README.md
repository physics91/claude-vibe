# Claude Vibe

Claude Code plugin for intelligent context management and prompt optimization.

[한국어 문서](./README.ko.md)

## Installation

```bash
# Add marketplace & install
/plugin marketplace add physics91/claude-vibe
/plugin install claude-vibe@physics91
```

## Features

### 1. Context Preservation
Automatically saves and restores context across sessions.
- AGENTS.md parsing (project/global/local)
- Context saving on compaction
- Context restoration on session start

### 2. Prompt Clarifier
Detects ambiguous prompts and asks clarifying questions.
- Missing tech stack detection
- Vague instruction identification
- Interactive multi-choice selections

### 3. Context Manager (NEW)
Optimizes context window by controlling MCP servers, agents, and commands per project.

```
/context-setup   # Interactive setup
/context-status  # Check current status
```

**Presets:**
| Preset | Description | Token Savings |
|--------|-------------|---------------|
| Minimal | Core tools only | ~45,000 |
| Web Dev | React/Vue/Next.js | ~28,000 |
| API Dev | Backend/microservices | ~25,000 |
| Data Science | ML/AI projects | ~30,000 |

**Features:**
- Auto-detect project type (package.json, requirements.txt, etc.)
- Per-project MCP server control via `.claude/.mcp.json`
- Managed slash commands (file-based enable/disable)
- Token savings estimation

## Structure

```
├── hooks/                  # Hook scripts
├── skills/                 # Skills (prompt-clarifier)
├── commands/               # Active slash commands
├── managed-commands/       # Controllable commands
├── presets/                # Context presets
├── lib/core/               # Core modules
│   ├── parser.ps1
│   ├── storage.ps1
│   ├── prompt-analyzer.ps1
│   ├── preset-manager.ps1
│   ├── project-detector.ps1
│   ├── mcp-config-generator.ps1
│   └── command-manager.ps1
└── tests/                  # Test scripts
```

## Requirements

- Claude Code v1.0.0+
- PowerShell 5.1+ (Windows) / Bash 4.0+ (Linux/macOS)
- Python 2.7+ or 3.x

## Testing

```powershell
# Unit tests
.\tests\test-prompt-analyzer.ps1
.\tests\test-command-manager.ps1

# E2E tests
.\tests\test-e2e-scenarios.ps1
.\tests\e2e\run-e2e-tests.ps1
```

## Updating

```bash
/plugin install claude-vibe@physics91
```

## License

MIT
