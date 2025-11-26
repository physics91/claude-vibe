---
name: code-reviewer
description: |
  WHEN: Code review, quality check, code smell detection, refactoring suggestions
  WHAT: Complexity analysis + code smell list + severity-based issues + improvement suggestions
  WHEN NOT: Next.js specific → nextjs-reviewer, Security → security-scanner, Performance → perf-analyzer
---

# Code Reviewer Skill

## Purpose
Analyzes code quality, detects code smells, and suggests improvements.

## When to Use
- Code review requests
- Code quality, code smell mentions
- Post-implementation review
- Pre-merge PR review

## Workflow

### Step 1: Review Scope
**AskUserQuestion:**
```
"What code should I review?"
Options:
- Current changes (git diff)
- Specific file/folder
- Full project scan
- Recent commits
```

### Step 2: Review Focus
**AskUserQuestion:**
```
"What should I focus on?"
Options:
- Full quality check (recommended)
- Bugs/Logic errors
- Code style/Readability
- Performance issues
- Security vulnerabilities
multiSelect: true
```

### Step 3: Analysis
- **Complexity**: Cyclomatic, Cognitive
- **Duplication**: DRY violations
- **Naming**: Variable/function naming quality
- **Structure**: Function length, nesting depth, parameter count

## Detection Rules

### Code Smells
| Smell | Threshold | Severity |
|-------|-----------|----------|
| Long Function | > 50 lines | MEDIUM |
| Deep Nesting | > 3 levels | HIGH |
| Magic Numbers | Hardcoded numbers | LOW |
| Long Parameter List | > 4 params | MEDIUM |
| God Object | > 20 methods | HIGH |
| Duplicate Code | > 10 lines | HIGH |

### Naming Conventions
| Type | Pattern |
|------|---------|
| Function | camelCase, verb prefix |
| Variable | camelCase, noun |
| Constant | UPPER_SNAKE_CASE |
| Class | PascalCase |
| File | kebab-case or PascalCase |

## Response Template
```
## Code Review Results

**Target**: [path]

### CRITICAL (Fix immediately)
- **[Issue]** `file:line`
  - Problem: [description]
  - Solution: [suggestion]

### HIGH | MEDIUM | LOW
- ...

### Positive Patterns
- [Well-written code mentions]

### Summary
- Total issues: X
- Critical: X | High: X | Medium: X | Low: X
```

## Best Practices
1. Provide specific, actionable feedback with solutions
2. Group by severity: Critical > High > Medium > Low
3. Include positive feedback
4. Provide copy-paste ready code fixes
5. Respect project conventions

## Integration
- `/analyze-code` command
- `security-scanner` skill
- `perf-analyzer` skill

## Notes
- Reviews are suggestions, final decisions are developer's
- Maintain consistency with existing project conventions
- Use with automated linters (ESLint, Prettier)
