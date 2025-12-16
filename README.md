# Claude Vibe

Claude Code plugin for intelligent context management and code review automation.

[한국어 문서](./README.ko.md)

## Installation

```bash
# Add marketplace & install
/plugin marketplace add physics91/claude-vibe
/plugin install claude-vibe@physics91
```

## Quickstart

```bash
# 1. Quick setup with express command
/cs auto

# 2. Or use full setup wizard
/context-setup

# 3. Check current configuration
/context-status
```

**Express Commands (v0.3.0):**
```bash
/r          # Quick review
/t          # Generate tests
/f          # Fix issues
/a          # Analyze code
/e          # Explain code
/rf         # Refactor
/cs         # Context setup
/st         # Skill test
/d          # Debug toggle
/init       # Init AGENTS.md
```

**Example workflow:**
```
You: "Review my FastAPI code"
→ Plugin detects Python project, activates fastapi-reviewer skill
→ Analyzes Pydantic models, async patterns, dependency injection
→ Returns structured review with recommendations
```

## Features

### 1. Intelligent Code Review (34 Skills)

Automated code review for multiple languages and frameworks:

| Category | Skills | Focus Areas |
|----------|--------|-------------|
| **Web** | code-reviewer, nextjs-reviewer, test-generator, security-scanner, perf-analyzer, coverage-analyzer, api-documenter, readme-generator | React, Vue, Next.js, TypeScript |
| **Python** | python-reviewer, fastapi-reviewer, django-reviewer, flask-reviewer, python-data-reviewer | PEP8, async, ORM, data processing |
| **Go/Rust** | go-reviewer, go-api-reviewer, rust-reviewer, rust-api-reviewer | Goroutines, ownership, API patterns |
| **Kotlin** | kotlin-android-reviewer, kotlin-spring-reviewer, kotlin-multiplatform-reviewer | Android, Spring Boot, KMP |
| **Mobile** | ios-reviewer, flutter-reviewer | Swift/SwiftUI, Flutter/Dart (v2.0) |
| **ML/AI** | ml-reviewer | PyTorch, TensorFlow, scikit-learn (v2.0) |
| **DevOps** | docker-reviewer, k8s-reviewer, terraform-reviewer, ci-cd-reviewer, infra-security-reviewer | Containers, IaC, CI/CD, security |
| **Database** | sql-optimizer, schema-reviewer, orm-reviewer, migration-checker | Query optimization, schema design |
| **Core** | prompt-clarifier, context-manager | Context optimization |

### 2. Context Manager

Optimizes context window by controlling MCP servers, agents, and commands per project.

```bash
/context-setup   # Interactive setup wizard
/context-status  # Check current configuration
```

**9 Presets Available:**

| Preset | Description | Token Savings |
|--------|-------------|---------------|
| minimal | Core tools only | ~45,000 |
| web-dev | React/Vue/Next.js frontend | ~28,000 |
| python-web | FastAPI/Django/Flask backend | ~30,000 |
| go-backend | Gin/Echo/Fiber/Chi API | ~28,000 |
| rust-systems | Actix-web/Axum systems | ~32,000 |
| devops | Docker/K8s/Terraform | ~25,000 |
| api-dev | Backend microservices | ~25,000 |
| data-science | ML/AI/Data projects | ~30,000 |
| full-stack | Web + API + Database | ~20,000 |

**8 Agent Categories:**

| Category | Agents |
|----------|--------|
| Frontend | react-expert, vue-expert, nextjs-debugger, css-expert |
| Python | python-expert, fastapi, django, flask |
| Go/Rust | go, rust, systems programming |
| Backend | nodejs-expert, api-expert, microservices-architect |
| DevOps | docker-expert, devops-expert, sre-specialist |
| Database | database-expert, data-analyst |
| Mobile | ios-expert, android-expert, flutter-expert |
| AI/ML | ml-engineer, deep-learning-expert, nlp-expert |

### 3. Prompt Clarifier

Detects ambiguous prompts and asks clarifying questions with interactive selections.

- Missing tech stack detection
- Vague instruction identification
- Multi-choice feature selection
- Project scope clarification

### 4. Debug Tools

Developer tools for troubleshooting and validation:

| Command | Description |
|---------|-------------|
| `/skill-test` | Test skill detection against sample input |
| `/skill-log` | View skill activation history |
| `/debug` | Toggle verbose debug mode |
| `/validate-skill` | Validate custom skill definitions |

### 5. Context Preservation

Automatically saves and restores context across sessions.

- AGENTS.md parsing (project/global/local)
- Context saving on compaction
- Context restoration on session start

### 6. Pattern Learning (v0.3.0)

Learns from tool usage patterns to suggest optimizations:

- Detects inefficient tool usage (repeated file reads, fragmented edits)
- Provides real-time optimization suggestions
- Tracks patterns per project via PostToolUse hook
- Rate-limited suggestions (10 min cooldown)

### 7. Session Memory (v0.3.0)

Cross-session intelligence with project-specific memory:

- Remembers successful approaches and error solutions
- Stores file insights and learned patterns
- Persists across sessions in `~/.claude/claude-vibe/memory/`

### 8. Safety Guard (v2.0.0)

PreToolUse hook for dangerous operation prevention:

- Blocks dangerous Bash commands (rm -rf, force push, chmod 777)
- Protects sensitive files (.env, SSH keys, credentials)
- Pattern-based validation with severity levels
- Configurable rules via `config/safety-rules.json`

### 9. Quality Gate (v2.0.0)

Stop hook for session quality verification:

- Checks for failing tests before session end
- Warns about uncommitted git changes
- Reports pending todos

### 10. Notifications (v2.0.0)

Multi-channel notification support:

- ntfy.sh webhook integration
- Slack webhook integration
- Desktop notifications (cross-platform)
- Sub-agent notification suppression

## Commands

### Standard Commands

| Command | Description |
|---------|-------------|
| `/context-setup` | Interactive context configuration |
| `/context-status` | Display current context status |
| `/init-agents` | Initialize AGENTS.md for project |
| `/skill-test` | Test skill detection logic |
| `/skill-log` | View activation history |
| `/debug` | Toggle debug mode |
| `/validate-skill` | Validate skill definitions |

### Express Commands (v0.3.0)

| Alias | Full Command | Description |
|-------|--------------|-------------|
| `/r` | review | Quick code/PR review |
| `/t` | test | Generate tests |
| `/f` | fix | Fix issues |
| `/a` | analyze | Code analysis |
| `/e` | explain | Explain code |
| `/rf` | refactor | Refactor code |
| `/cs` | context-setup | Context setup |
| `/st` | skill-test | Test skills |
| `/d` | debug | Debug toggle |
| `/init` | init-agents | Init AGENTS.md |

## Project Structure

```
claude-vibe/
├── hooks/                  # Hook scripts (8 hooks, Node.js)
│   ├── lib/                # Core library (v2.0)
│   │   ├── core/           # Core modules
│   │   │   ├── stdin-reader.js
│   │   │   ├── output-formatter.js
│   │   │   ├── constants.js
│   │   │   └── logger.js
│   │   └── utils/          # Utility modules
│   │       ├── security.js
│   │       ├── http-client.js
│   │       └── validation.js
│   ├── session-start.js    # AGENTS.md re-injection
│   ├── pre-compact.js      # Session state saving
│   ├── user-prompt-submit.js  # Prompt analysis
│   ├── post-tool-use.js    # Pattern learning
│   ├── pre-tool-use-safety.js  # Safety guard (v2.0)
│   ├── stop-quality-gate.js    # Quality gate (v2.0)
│   ├── status-line.js      # Status line (v2.0)
│   └── notification-handler.js  # Notifications (v2.0)
├── skills/                 # 34 review skills
│   ├── code-reviewer/      # General code review
│   ├── python-reviewer/    # Python review
│   ├── ios-reviewer/       # iOS/Swift review (v2.0)
│   ├── flutter-reviewer/   # Flutter/Dart review (v2.0)
│   ├── ml-reviewer/        # ML/DL review (v2.0)
│   └── ...                 # Additional skills
├── commands/               # 17 slash commands (7 + 10 express)
├── presets/                # 9 context presets
└── tests/                  # Test scripts
    ├── hooks.test.js       # Hook unit tests (v2.0)
    └── e2e-test.js         # E2E tests
```

## Skill Categories

### Web Development
- **code-reviewer**: General TypeScript/JavaScript review
- **nextjs-reviewer**: Next.js App Router, RSC patterns
- **test-generator**: Jest/Vitest test generation
- **security-scanner**: OWASP Top 10 vulnerability detection
- **perf-analyzer**: Performance optimization
- **coverage-analyzer**: Test coverage analysis
- **api-documenter**: OpenAPI/Swagger documentation
- **readme-generator**: README generation

### Python Stack
- **python-reviewer**: PEP8, type hints, Pythonic patterns
- **fastapi-reviewer**: Pydantic, dependency injection, async
- **django-reviewer**: ORM, views, templates, migrations
- **flask-reviewer**: Blueprints, extensions, configuration
- **python-data-reviewer**: Pandas/NumPy vectorization

### Go/Rust
- **go-reviewer**: Error handling, goroutines, interfaces
- **go-api-reviewer**: Gin/Echo/Fiber router patterns
- **rust-reviewer**: Ownership, lifetimes, error handling
- **rust-api-reviewer**: Actix/Axum extractors, state

### Kotlin
- **kotlin-android-reviewer**: Jetpack Compose, lifecycle
- **kotlin-spring-reviewer**: Spring Boot, coroutines
- **kotlin-multiplatform-reviewer**: KMP shared code

### Mobile (v2.0)
- **ios-reviewer**: Swift/SwiftUI/UIKit patterns, Combine, async/await
- **flutter-reviewer**: Widget optimization, BLoC/Provider/Riverpod

### ML/AI (v2.0)
- **ml-reviewer**: PyTorch/TensorFlow patterns, training optimization, MLOps

### DevOps
- **docker-reviewer**: Multi-stage builds, layer optimization
- **k8s-reviewer**: Resource limits, probes, RBAC
- **terraform-reviewer**: Module structure, state management
- **ci-cd-reviewer**: GitHub Actions, GitLab CI optimization
- **infra-security-reviewer**: Secrets, network policies, IAM

### Database
- **sql-optimizer**: Query plans, index usage, N+1 detection
- **schema-reviewer**: Normalization, constraints, indexes
- **orm-reviewer**: Prisma/TypeORM/SQLAlchemy patterns
- **migration-checker**: Backwards compatibility, rollback safety

## Requirements

- Claude Code v1.0.0+
- Node.js 16+ (LTS recommended)
- (Optional) PowerShell 5.1+ for legacy scripts

## Testing

```bash
# Run all hook tests (v2.0)
node tests/hooks.test.js

# Run E2E tests
node tests/e2e-test.js

# Legacy PowerShell tests
.\tests\test-prompt-analyzer.ps1
```

## Updating

```bash
/plugin install claude-vibe@physics91
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT
