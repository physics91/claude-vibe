---
description: Lint AGENTS.md and AGENTS_PROGRESS.md for structure, size, and safety issues
allowed-tools: Read, Glob, Grep, Write, Bash, LS
---

# Lint AGENTS

Validate `AGENTS.md` / `AGENTS_PROGRESS.md` for issues that can cause instruction loss or confusion.

## Usage

```
/lint-agents
```

## What to Check

### AGENTS.md (project + local)
- Detect files that will be ignored (symlinked files)
- Warn when content will be truncated during reinjection (size/limits)
- Check basic structure for the project `AGENTS.md` (recommended sections)

### AGENTS_PROGRESS.md
- Keep only the 5 most recent items
- Enforce item format: `[status] Task description (YYYY-MM-DD)`
- Allowed statuses: `[ ]` Pending, `[~]` In Progress, `[x]` Completed

## How to Run

Run the repo linter and review output:

```bash
node tools/lint-agents.js --root . --no-global --strict
```

## Output Guidance

- If it fails, list **errors** and propose a minimal patch to fix them.
- Treat warnings as high-signal; recommend fixes if they affect reinjection/truncation.

