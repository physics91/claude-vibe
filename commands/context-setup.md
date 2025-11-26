---
description: Configure and optimize project context (MCP servers, agent selection)
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
---

# Context Setup

Interactively configure project context settings.

**[Activate Skill: context-manager]**

## Tasks

### 1. Project Analysis
Detect project type by checking:
- `package.json` - Node.js/JavaScript/TypeScript
- `requirements.txt` / `pyproject.toml` - Python
- `go.mod` - Go
- `Cargo.toml` - Rust
- `Dockerfile` / `docker-compose.yml` - DevOps
- `*.tf` / `Chart.yaml` - Infrastructure
- Directory structure (src/, app/, internal/, etc.)

### 2. Preset Recommendations
Recommend presets based on detected project type:
- **web-dev**: React, Vue, Next.js (web frontend)
- **python-web**: FastAPI, Django, Flask (Python web)
- **go-backend**: Gin, Echo, Fiber, Chi (Go backend)
- **rust-systems**: Actix-web, Axum (Rust systems)
- **devops**: Docker, Kubernetes, Terraform (DevOps)
- **api-dev**: Express, NestJS (backend API)
- **data-science**: Pandas, TensorFlow (data/ML)
- **full-stack**: Web + API + Database (full stack)
- **minimal**: Core tools only (maximum token savings)

### 3. Interactive Selection
Using AskUserQuestion:
1. Select preset or Custom
2. If Custom: Select individual MCP servers
3. If Custom: Select agent categories

### 4. Generate Config Files
- `.claude/context-profile.json`: Project settings
- `.claude/.mcp.json`: MCP server settings

### 5. Restart Instructions
Guide user to restart Claude Code for MCP settings to take effect.

## Output Example

```
Analyzing project...

Detected: React + TypeScript (Next.js)
Recommended preset: Web Development
Expected token savings: ~28,000 tokens (14%)

[Preset selection question]

---

Setup complete!

Active MCP servers:
- github, playwright, brave-search

Active agents:
- react-expert, vue-expert, css-expert, nodejs-expert, frontend-optimizer

Generated files:
- .claude/context-profile.json
- .claude/.mcp.json

Restart Claude Code to apply MCP settings.
```
