---
description: Analyze code for quality, performance, and security issues
allowed-tools: Read, Glob, Grep
---

# Code Analysis

Analyze the specified code or current project for:

1. **Code Quality**: Identify code smells, complexity issues, and maintainability concerns
2. **Performance**: Find potential performance bottlenecks
3. **Security**: Detect common security vulnerabilities (OWASP Top 10)
4. **Best Practices**: Check adherence to language/framework best practices

## Usage
- `/analyze-code` - Analyze entire project
- `/analyze-code <file-path>` - Analyze specific file
- `/analyze-code <directory>` - Analyze specific directory

## Output Format
Provide findings grouped by category with severity levels:
- **CRITICAL**: Must fix immediately
- **HIGH**: Should fix soon
- **MEDIUM**: Consider fixing
- **LOW**: Nice to have

$ARGUMENTS
