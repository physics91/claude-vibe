---
description: "[Express] Context setup - alias for /context-setup"
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion
---

# Express Context Setup (/cs)

Quick alias for context configuration. Uses the same functionality as `/context-setup`.

## Usage
- `/cs` - Interactive context setup wizard
- `/cs <preset>` - Apply specific preset (minimal, web-dev, python-web, etc.)
- `/cs auto` - Auto-detect and configure

$ARGUMENTS

Available presets:
- `minimal` - Core tools only (~45k tokens saved)
- `web-dev` - React/Vue/Next.js frontend
- `python-web` - FastAPI/Django/Flask
- `go-backend` - Gin/Echo/Fiber
- `rust-systems` - Actix-web/Axum
- `devops` - Docker/K8s/Terraform
- `api-dev` - Backend microservices
- `data-science` - ML/AI projects
- `full-stack` - Combined stack
