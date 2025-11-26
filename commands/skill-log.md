---
description: View skill activation history and logs
allowed-tools: Read, Glob
---

# Skill Log

View the history of skill activations in the current session.

## Usage

```
/skill-log [options]
```

## Options

- `--tail <n>`: Show last N entries (default: 10)
- `--filter <skill>`: Filter by skill name
- `--verbose`: Show detailed activation context

## Workflow

### Step 1: Check Log Location
Look for skill activation logs in:
- Session memory (current conversation)
- `.claude/logs/skill-activations.json` (if persistent logging enabled)

### Step 2: Parse Log Entries
Each entry contains:
- Timestamp
- Activated skill name
- Trigger reason
- User prompt (truncated)
- Token usage estimate

### Step 3: Display Results

**Output Format:**
```
## Skill Activation Log

### Recent Activations (Last 10)

| Time | Skill | Trigger | Tokens |
|------|-------|---------|--------|
| 14:32:15 | fastapi-reviewer | "Review my FastAPI code" | ~2.1k |
| 14:28:03 | python-reviewer | "Check this Python file" | ~1.8k |
| 14:15:22 | security-scanner | "Is this code secure?" | ~2.5k |

### Session Summary
- **Total Activations**: 12
- **Most Used**: python-reviewer (4x)
- **Est. Tokens Used**: ~24,000

### Activation Details (--verbose)

**14:32:15 - fastapi-reviewer**
```
Trigger: User prompt contained "FastAPI"
Detection: Found fastapi in requirements.txt
Context: Reviewing routers/users.py
Token estimate: 2,100 tokens
```
```

## Examples

### View Last 5 Activations
```
/skill-log --tail 5
```

### Filter by Skill
```
/skill-log --filter security-scanner
```

### Verbose Output
```
/skill-log --verbose
```

## Notes

- Log is session-scoped by default
- Enable persistent logging in settings for cross-session history
- Useful for understanding token usage patterns
