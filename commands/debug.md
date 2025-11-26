---
description: Toggle debug mode for verbose skill and context information
allowed-tools: Read, Write
---

# Debug Mode

Enable or disable verbose debugging output for troubleshooting.

## Usage

```
/debug [on|off|status]
```

## Parameters

- `on`: Enable debug mode
- `off`: Disable debug mode
- `status`: Show current debug status (default)

## What Debug Mode Shows

When enabled, debug mode provides additional output:

### 1. Skill Selection Reasoning
```
[DEBUG] Skill Selection:
- Analyzing prompt: "Review my API endpoint"
- Candidate skills: fastapi-reviewer (0.85), go-api-reviewer (0.32), api-documenter (0.28)
- Selected: fastapi-reviewer (highest match)
- Reason: Found "fastapi" in requirements.txt, prompt mentions "API"
```

### 2. Context Token Usage
```
[DEBUG] Context Tokens:
- System prompt: 4,200 tokens
- Skill content: 2,100 tokens
- MCP tools: 8,500 tokens
- Conversation: 12,300 tokens
- Available: 172,900 tokens
- Usage: 13.5%
```

### 3. MCP Server Calls
```
[DEBUG] MCP Call:
- Server: github
- Tool: search_code
- Query: "def create_user"
- Duration: 234ms
- Result: 3 matches
```

### 4. File Operations
```
[DEBUG] File Read:
- Path: src/api/users.py
- Size: 2.4KB
- Lines: 89
- Tokens: ~450
```

## Output Format

**Status Check:**
```
## Debug Mode Status

**Current**: OFF

When enabled, shows:
- Skill selection reasoning
- Context token breakdown
- MCP server call details
- File operation metrics
- Performance timing

To enable: /debug on
```

**When Enabled:**
```
## Debug Mode

**Status**: ON ✓

Debug information will appear in [DEBUG] blocks.

Example output:
[DEBUG] Skill Selection: python-reviewer (confidence: 0.92)
[DEBUG] Tokens: 15,200 / 200,000 (7.6%)

To disable: /debug off
```

## Configuration

Debug settings can be persisted in `.claude/settings.json`:

```json
{
  "debug": {
    "enabled": false,
    "showSkillSelection": true,
    "showTokenUsage": true,
    "showMCPCalls": true,
    "showFileOps": false
  }
}
```

## Notes

- Debug mode adds overhead to responses
- Useful for understanding skill behavior
- Recommended to disable in normal usage
- Does not persist across sessions by default
