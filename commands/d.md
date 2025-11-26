---
description: "[Express] Debug mode - alias for /debug"
allowed-tools: Read, Write, Glob
---

# Express Debug (/d)

Quick alias for debug mode toggle. Uses the same functionality as `/debug`.

## Usage
- `/d` - Toggle debug mode
- `/d on` - Enable debug mode
- `/d off` - Disable debug mode
- `/d status` - Show current debug status

$ARGUMENTS

When debug mode is enabled:
- Show skill selection reasoning
- Display context token counts
- Log MCP server calls
- Show performance metrics
- Verbose hook execution logs

Debug logs are stored in `~/.claude/claude-vibe/debug.log`
