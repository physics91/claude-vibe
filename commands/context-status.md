---
description: Display current project context configuration status
allowed-tools: Read, Glob
---

# Context Status

Check current project context configuration.

## Checks

### 1. Project Profile
Read `.claude/context-profile.json` for current settings.

### 2. MCP Configuration
Read `.claude/.mcp.json` for active MCP servers.

### 3. Compare with Global Settings
Compare with `~/.claude/claude_code_config.json` to show active/inactive status.

## Output Format

**With profile:**
```
## Current Context Status

**Profile**: [profile name]
**Project**: [project path]
**Last updated**: [date]

### MCP Servers (N/M active)
[x] github - GitHub integration
[x] playwright - Browser automation
[x] brave-search - Web search
[ ] filesystem - Filesystem (inactive)
[ ] openrouter - AI routing (inactive)

### Active Agents
react-expert, vue-expert, css-expert, nodejs-expert, frontend-optimizer

### Inactive Agents
ios-expert, android-expert, flutter-expert, ml-engineer, ...

### Token Savings
Expected: ~28,000 tokens (14%)

---
Change settings: /context-setup
```

**Without profile:**
```
## Context Status

No context profile configured for this project.

**Detected project type**: [detected type]
**Recommended preset**: [preset]
**Expected token savings**: ~[N] tokens

Run `/context-setup` to optimize context.
```
