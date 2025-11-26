---
name: context-manager
description: |
  WHEN: Context setup, token optimization, MCP/agent configuration requests
  WHAT: Project analysis + Preset recommendation + MCP server selection + Agent activation + Config generation
  WHEN NOT: Status check only → /context-status command
---

# Context Manager Skill

## Purpose
Optimizes Claude Code's context window by interactively selecting MCP servers, Custom Agents, and Slash Commands per project and generating configuration files.

## When to Use
Activate when:
1. User requests "context setup", "context management", "token optimization"
2. `/context-setup` command is executed
3. Starting work on a new project (auto-detect and recommend)

## Workflow

### Step 1: Analyze Project
Analyze project root files to detect project type.

Analysis targets:
- `package.json` (Node.js/JavaScript)
- `requirements.txt`, `pyproject.toml` (Python)
- `go.mod` (Go)
- `Cargo.toml` (Rust)
- `pom.xml`, `build.gradle` (Java)

### Step 2: Recommend Preset
Recommend preset based on detected project type.

**AskUserQuestion:**
```
"Select a context preset for your project"
Options:
- Web Development - React/Vue/Next.js (~28k saved)
- Python Web - FastAPI/Django/Flask (~30k saved)
- Go Backend - Gin/Echo/Fiber (~28k saved)
- Rust Systems - Actix/Axum (~32k saved)
- DevOps - Docker/K8s/Terraform (~25k saved)
- Data Science - ML/AI/Data (~30k saved)
- Full Stack - Web + API + DB (~20k saved)
- Minimal - Core tools only (~45k saved)
- Custom - Select manually
```

### Step 3: Custom Configuration
If Custom is selected, choose by category.

**MCP Server Selection:**
```
AskUserQuestion: "Select MCP servers to enable"
Options:
- GitHub (PR/issue management) - ~8k tokens
- Playwright (browser automation) - ~12k tokens
- Brave Search (web search) - ~3k tokens
- Select all
multiSelect: true
```

**Agent Category Selection:**
```
AskUserQuestion: "Which agent categories do you need?"
Options:
- Frontend (React, Vue, Next.js, CSS)
- Python (FastAPI, Django, Flask, Data)
- Go/Rust (Go API, Rust Systems)
- Backend (API, DB, Security)
- DevOps (Docker, K8s, Terraform, CI/CD)
- Database (SQL, ORM, Migrations)
- Mobile (iOS, Android, Flutter)
- AI/ML (ML, DL, NLP)
multiSelect: true
```

### Step 4: Generate Config Files
Create based on selections:

1. **`.claude/context-profile.json`**: Project context settings
2. **`.claude/.mcp.json`**: MCP server settings (selected servers only)

### Step 5: Restart Instructions
MCP settings apply after session restart.

```
Setup complete!

Generated files:
- .claude/context-profile.json
- .claude/.mcp.json

Active MCP servers: github, playwright, brave-search
Active agents: react-expert, css-expert, nodejs-expert
Estimated token savings: ~28,000 tokens (14%)

Restart Claude Code to apply MCP settings.
```

## Response Templates

### Project Analysis Result
```
Project analyzed.

**Detected project type**: Web Development (React + TypeScript)
**Confidence**: 85%
**Recommended preset**: web-dev
**Estimated token savings**: ~28,000 tokens

[Present preset selection with AskUserQuestion]
```

### Setup Complete
```
Context setup complete!

**Profile**: Web Development
**Project**: G:\ai-dev\my-project

### Active MCP Servers (3/6)
- github
- playwright
- brave-search

### Active Agents (5/55)
- react-expert
- css-expert
- nodejs-expert
- frontend-optimizer
- ui-ux-designer

### Generated Files
- .claude/context-profile.json
- .claude/.mcp.json

### Estimated Token Savings
~28,000 tokens (14% saved)

Restart Claude Code to apply MCP settings.
To change settings, run `/context-setup`.
```

### Current Status (/context-status)
```
## Current Context Status

**Profile**: Web Development
**Project**: G:\ai-dev\my-project

### MCP Servers (3/6 active)
[x] github
[x] playwright
[x] brave-search
[ ] filesystem (inactive)
[ ] openrouter (inactive)
[ ] context7 (inactive)

### Agents (5/55 active)
[x] react-expert, css-expert, nodejs-expert, frontend-optimizer, ui-ux-designer

### Estimated Token Savings
~28,000 tokens
```

## Best Practices

1. **Analyze first**: Analyze project files before asking questions
2. **Provide recommendations**: Recommend appropriate preset based on analysis
3. **Keep options concise**: Keep AskUserQuestion options to 4 or fewer
4. **Show token savings**: Clearly communicate impact of each choice
5. **Restart notice**: Always mention restart required for MCP changes

## Integration

This skill integrates with:
- `SessionStart` hook: Check project profile existence and notify
- `/context-setup` command: Activate this skill
- `/context-status` command: Display current status

## Available Presets

| Preset | Description | MCP Servers | Token Savings |
|--------|-------------|-------------|---------------|
| minimal | Core tools only | None | ~45k |
| web-dev | React/Vue/Next.js | github, playwright, brave-search | ~28k |
| python-web | FastAPI/Django/Flask | github, brave-search, context7 | ~30k |
| go-backend | Gin/Echo/Fiber/Chi | github, brave-search, context7 | ~28k |
| rust-systems | Actix-web/Axum | github, brave-search, context7 | ~32k |
| devops | Docker/K8s/Terraform | github, brave-search, context7 | ~25k |
| api-dev | Backend API | github, brave-search, context7 | ~25k |
| data-science | ML/AI/Data | brave-search, context7, github | ~30k |
| full-stack | Web + API + DB | github, playwright, brave-search, context7 | ~20k |

## Notes

- Project `.claude/.mcp.json` takes precedence over global settings
- Agent enable/disable is handled via system prompt instructions
- Config files can be committed to git for team sharing
