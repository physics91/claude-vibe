# AGENTS Context Preserver

A Claude Code plugin that automatically preserves and restores AGENTS.md context during session compaction using hooks.

[한국어 문서](./README.ko.md)

## Installation

### Method 1: Plugin Command (Recommended)

```bash
# Add marketplace
/plugin marketplace add physics91/claude-vibe

# Install plugin
/plugin install agents-context-preserver@physics91
```

### Method 2: Manual Installation

```powershell
# 1. Clone repository
git clone https://github.com/physics91/claude-vibe.git
cd claude-vibe

# 2. Register hooks in settings.json
```

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/pre-compact.ps1\""]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/session-start.ps1\""]
      }
    ]
  }
}
```

## Structure

```
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace definition
├── hooks/
│   ├── hooks.json         # Hook configuration
│   ├── pre-compact.ps1    # Captures context before compaction
│   └── session-start.ps1  # Restores context on session start
├── lib/
│   ├── core/
│   │   ├── parser.ps1     # AGENTS.md parser
│   │   └── storage.ps1    # State storage/loading
│   └── utils/
│       └── security.ps1   # Security utilities
├── schemas/               # JSON schemas
└── tests/                 # Tests
```

## Features

- Automatic AGENTS.md parsing (project/global/local)
- Automatic context saving on compaction
- Automatic context restoration on session start
- Task state tracking

## Requirements

- Windows PowerShell 5.1+ or PowerShell Core 7+
- Claude Code v1.0.0+

## License

MIT
