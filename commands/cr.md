---
name: cr
description: AI-powered code review using external models (Codex, Gemini)
aliases:
  - ai-review
  - air
allowed-tools: Read, Glob, Grep, WebFetch, AskUserQuestion
---

# AI Code Review Command

Performs AI-powered code review using the embedded `ai-code-agent-mcp` server with Codex and/or Gemini CLI tools.

## Usage

```
/ai-review [scope] [options]
/cr [scope] [options]
```

## Arguments

### Scope (what to review)
- `file <path>` - Review a specific file
- `diff` - Review uncommitted git changes
- `staged` - Review staged changes only
- `pr [number]` - Review pull request changes
- (none) - Review current context/conversation code

## Options

### Model Selection
- `--model=codex` - Use only OpenAI Codex
- `--model=gemini` - Use only Google Gemini
- `--model=combined` - Use both with result aggregation (default)

### Analysis Focus
- `--focus=security` - Security-focused review
- `--focus=performance` - Performance-focused review
- `--focus=bugs` - Bug detection focus
- `--focus=style` - Code style and best practices
- `--focus=all` - Comprehensive review (default)

### Severity Filter
- `--severity=critical` - Show only critical issues
- `--severity=high` - Show high and critical issues
- `--severity=all` - Show all issues (default)

### Context Preset
- `--preset=react-web` - React web application
- `--preset=nodejs-api` - Node.js API server
- `--preset=mcp-server` - MCP server project
- `--preset=cli-tool` - CLI tool
- `--preset=library` - Reusable library
- `--preset=auto` - Auto-detect from code (default)

### Output Options
- `--format=markdown` - Markdown output (default)
- `--format=json` - JSON structured output
- `--verbose` - Include detailed findings

## Examples

```bash
# Review current context with both models
/cr

# Review specific file with Codex only
/cr file src/api/auth.ts --model=codex

# Security-focused review of git diff
/cr diff --focus=security

# Review staged changes with high severity filter
/cr staged --severity=high

# Combined review with auto-detection
/cr file lib/parser.js --model=combined --preset=auto

# Verbose security review
/cr file .env.example --focus=security --verbose
```

## Prerequisites

This command requires the `ai-code-agent-mcp` MCP server and at least one CLI tool:

### Codex CLI
```bash
# Install
npm install -g @openai/codex

# Authenticate
codex auth
```

### Gemini CLI
```bash
# Install
npm install -g @google/gemini-cli

# Authenticate
gemini auth login
```

## Output Example

```markdown
## AI Code Review Results

**Analysis ID**: combined-1735300000000
**Models Used**: codex, gemini
**Duration**: 3240ms

### Overall Assessment

The code demonstrates good structure but has potential security issues in input validation and a performance concern with database queries.

### Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Medium | 4 |
| Low | 3 |
| **Total** | **10** |

### Findings

#### Critical Issues

1. **SQL Injection Vulnerability** (Line 42)
   - **Description**: User input directly concatenated into SQL query
   - **Suggestion**: Use parameterized queries
   - **Confidence**: High (both models agree)

...
```

## Related Commands

- `/r` - Quick Claude-only code review
- `/security-scan` - Security-focused scan with security-scanner skill
- `/context-setup` - Configure MCP servers including ai-code-agent-mcp

## Troubleshooting

### "CLI not found" Error
Ensure Codex or Gemini CLI is installed and in PATH:
```bash
which codex  # or: where codex (Windows)
which gemini
```

### "Authentication failed" Error
Re-authenticate with the respective CLI:
```bash
codex auth
gemini auth login
```

### Slow Analysis
- Check network connection
- Consider using `--model=codex` or `--model=gemini` for faster single-model review
- Large files are automatically truncated; consider splitting

### Cache Issues
Analysis results are cached for 1 hour. To force fresh analysis:
```bash
# Clear cache (if needed)
rm -rf ~/.claude/claude-vibe/data/ai-code-agent.db
```
