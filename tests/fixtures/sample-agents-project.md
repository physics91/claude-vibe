# Project AGENTS.md

## Project Overview
This is the AGENTS Context Preserver - a Claude Code hook plugin for maintaining context across sessions.

## Coding Standards
- Use ESLint with recommended config
- Maximum function length: 50 lines
- Prefer functional programming patterns
- Use TypeScript strict mode with noImplicitAny

## Architecture Guidelines
- Follow plugin architecture patterns
- Keep modules loosely coupled
- Use dependency injection where appropriate
- Separate concerns into distinct modules

## File Organization
- Source code in src/
- Tests in tests/
- Configuration in config/
- Documentation in docs/

## Subagent Definitions

### code-reviewer
Use this agent after completing significant code changes.
Focus on security and performance.
Check for:
- Potential security vulnerabilities
- Performance bottlenecks
- Code duplication
- Proper error handling

### test-runner
Use proactively to run tests after changes.
Ensure all tests pass before committing.
Generate coverage reports.

### documentation-updater
Use when adding new features or changing APIs.
Keep documentation in sync with code.
Update README and API docs.

### dependency-checker
Use periodically to check for outdated dependencies.
Review security advisories.
Plan upgrade paths.

## Commit Guidelines
- Use conventional commits format
- Include ticket reference in commit message
- Keep commits focused and atomic
