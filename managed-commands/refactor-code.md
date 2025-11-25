---
description: Suggest and apply code refactoring improvements
allowed-tools: Read, Glob, Grep, Write, Edit
---

# Code Refactoring

Analyze code and suggest refactoring improvements.

## Usage
- `/refactor-code <file>` - Refactor specific file
- `/refactor-code <pattern>` - Refactor matching files

## Refactoring Types
1. **Extract Method**: Break down large functions
2. **Rename**: Improve naming clarity
3. **Simplify Conditionals**: Reduce complexity
4. **Remove Duplication**: DRY violations
5. **Improve Types**: Better type definitions (TypeScript/Python)

## Process
1. Analyze current code structure
2. Identify improvement opportunities
3. Present refactoring suggestions with rationale
4. Apply changes upon approval
5. Verify tests still pass

## Safety
- Always show diff before applying
- Preserve existing behavior (no functional changes)
- Run tests after refactoring

$ARGUMENTS
