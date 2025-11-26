# Claude-Vibe Next Generation Roadmap

## Overview

Expanding claude-vibe from Web/Kotlin focus to full-stack coverage with developer debugging tools.

## Current State (v1.0)

### Skills (13)
| Category | Skills |
|----------|--------|
| Web | code-reviewer, nextjs-reviewer, test-generator, security-scanner, perf-analyzer, coverage-analyzer, api-documenter, readme-generator |
| Kotlin | kotlin-android-reviewer, kotlin-spring-reviewer, kotlin-multiplatform-reviewer |
| Core | prompt-clarifier, context-manager |

### Commands (3)
- init-agents, context-setup, context-status

### Presets (4)
- minimal, web-dev, api-dev, data-science

---

## Next Generation (v2.0)

### Phase 1: Python Stack Skills

| Skill | WHEN | WHAT |
|-------|------|------|
| `python-reviewer` | General Python code review | PEP8 + Type hints + Pythonic patterns + Error handling |
| `fastapi-reviewer` | FastAPI project review | Pydantic models + Dependency injection + Async patterns + OpenAPI |
| `django-reviewer` | Django project review | ORM patterns + View/Template + Security + Admin customization |
| `flask-reviewer` | Flask project review | Blueprint structure + Extensions + Request handling |
| `python-data-reviewer` | Pandas/NumPy code review | Vectorization + Memory efficiency + Data validation |

**Detection:**
- `requirements.txt`, `pyproject.toml`, `setup.py`
- Dependencies: fastapi, django, flask, pandas, numpy

---

### Phase 2: Go/Rust Skills

| Skill | WHEN | WHAT |
|-------|------|------|
| `go-reviewer` | Go project review | Error handling + Goroutines + Interfaces + Testing |
| `go-api-reviewer` | Go API (Gin/Echo/Fiber) | Router patterns + Middleware + Request validation |
| `rust-reviewer` | Rust code review | Ownership + Lifetimes + Error handling + Unsafe usage |
| `rust-api-reviewer` | Rust API (Actix/Axum) | Async patterns + Extractors + State management |

**Detection:**
- `go.mod`, `Cargo.toml`
- Imports: gin, echo, actix-web, axum

---

### Phase 3: DevOps Skills

| Skill | WHEN | WHAT |
|-------|------|------|
| `docker-reviewer` | Dockerfile review | Multi-stage builds + Layer optimization + Security scanning |
| `k8s-reviewer` | Kubernetes manifests | Resource limits + Probes + RBAC + Helm charts |
| `terraform-reviewer` | Terraform code review | Module structure + State management + Security policies |
| `ci-cd-reviewer` | CI/CD pipeline review | GitHub Actions + GitLab CI + Jenkins + Optimization |
| `infra-security-reviewer` | Infrastructure security | Secrets management + Network policies + Compliance |

**Detection:**
- `Dockerfile`, `docker-compose.yml`
- `*.yaml` in k8s/, manifests/
- `*.tf` files, `main.tf`
- `.github/workflows/`, `.gitlab-ci.yml`

---

### Phase 4: Database Skills

| Skill | WHEN | WHAT |
|-------|------|------|
| `sql-optimizer` | SQL query review | Query plans + Index usage + N+1 detection + Optimization |
| `schema-reviewer` | Database schema review | Normalization + Constraints + Indexes + Migration safety |
| `orm-reviewer` | ORM code review | Lazy loading + Transaction handling + Query efficiency |
| `migration-checker` | Migration file review | Backwards compatibility + Rollback safety + Data integrity |

**Detection:**
- `*.sql` files, migrations/
- Prisma, TypeORM, SQLAlchemy, GORM imports
- `schema.prisma`, `alembic/`

---

### Phase 5: Debug Tools

#### 5.1 Skill Tester (`/skill-test`)
```
Test a skill against sample input

Usage: /skill-test <skill-name> [--input <file>]

Features:
- Dry run skill detection logic
- Show matched patterns
- Display generated prompts
- Validate SKILL.md syntax
```

#### 5.2 Skill Logger (`/skill-log`)
```
View skill activation logs

Usage: /skill-log [--tail <n>] [--filter <skill>]

Output:
- Timestamp
- Activated skill
- Detection reason
- Token usage
```

#### 5.3 Debug Mode (`/debug`)
```
Enable verbose mode for troubleshooting

Usage: /debug [on|off|status]

Features:
- Show skill selection reasoning
- Display context token counts
- Log MCP server calls
- Performance metrics
```

#### 5.4 Skill Validator (`/validate-skill`)
```
Validate custom skill definition

Usage: /validate-skill <path>

Checks:
- YAML frontmatter syntax
- Required fields (name, description)
- WHEN/WHAT/WHEN NOT format
- Workflow section completeness
```

---

## New Presets (v2.0)

| Preset | Skills | Token Savings |
|--------|--------|---------------|
| `python-web` | python-*, fastapi/django/flask-reviewer | ~30k |
| `go-backend` | go-*, docker-reviewer, sql-optimizer | ~28k |
| `rust-systems` | rust-*, infra-security-reviewer | ~32k |
| `devops` | docker-*, k8s-*, terraform-*, ci-cd-* | ~25k |
| `full-stack` | web-dev + api-dev + database | ~20k |

---

## Implementation Priority

### High Priority (Phase 1-2)
1. Python Stack - Most requested, large user base
2. Debug Tools - Essential for DX improvement

### Medium Priority (Phase 3)
3. DevOps Skills - Growing demand
4. Go/Rust Skills - Niche but valuable

### Lower Priority (Phase 4)
5. Database Skills - Can be covered by existing reviewers partially

---

## File Structure (v2.0)

```
claude-vibe/
├── skills/
│   ├── # Existing (13)
│   ├── # Python (5)
│   │   ├── python-reviewer/
│   │   ├── fastapi-reviewer/
│   │   ├── django-reviewer/
│   │   ├── flask-reviewer/
│   │   └── python-data-reviewer/
│   ├── # Go/Rust (4)
│   │   ├── go-reviewer/
│   │   ├── go-api-reviewer/
│   │   ├── rust-reviewer/
│   │   └── rust-api-reviewer/
│   ├── # DevOps (5)
│   │   ├── docker-reviewer/
│   │   ├── k8s-reviewer/
│   │   ├── terraform-reviewer/
│   │   ├── ci-cd-reviewer/
│   │   └── infra-security-reviewer/
│   └── # Database (4)
│       ├── sql-optimizer/
│       ├── schema-reviewer/
│       ├── orm-reviewer/
│       └── migration-checker/
├── commands/
│   ├── # Existing (3)
│   ├── skill-test.md
│   ├── skill-log.md
│   ├── debug.md
│   └── validate-skill.md
├── presets/
│   ├── # Existing (4)
│   ├── python-web.json
│   ├── go-backend.json
│   ├── rust-systems.json
│   ├── devops.json
│   └── full-stack.json
└── hooks/
    └── # Enhanced logging support
```

---

## Metrics (v2.0 Target)

| Metric | v1.0 | v2.0 Target |
|--------|------|-------------|
| Skills | 13 | 31 (+18) |
| Commands | 3 | 7 (+4) |
| Presets | 4 | 9 (+5) |
| Languages | 3 | 7 (+4) |
| Debug Tools | 0 | 4 (+4) |

---

## Implementation Status

- [x] Phase 1: Python Stack (5 skills + 1 preset) ✓
- [x] Phase 2: Go/Rust (4 skills + 2 presets) ✓
- [x] Phase 3: DevOps (5 skills + 1 preset) ✓
- [x] Phase 4: Database (4 skills + 1 preset) ✓
- [x] Phase 5: Debug Tools (4 commands) ✓

## Next Steps

1. [x] Update context-manager for new categories ✓
2. [x] Test and validate all skills ✓
3. [x] Create user documentation ✓
