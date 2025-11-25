---
description: Generate unit tests for specified code
allowed-tools: Read, Glob, Grep, Write
---

# Test Generation

Generate comprehensive unit tests for the specified code.

## Scope
- `/generate-tests <file>` - Generate tests for specific file
- `/generate-tests <function>` - Generate tests for specific function
- `/generate-tests` - Generate tests for recent changes

## Test Coverage Goals
1. **Happy Path**: Normal execution scenarios
2. **Edge Cases**: Boundary conditions and special values
3. **Error Cases**: Invalid inputs and error handling
4. **Integration Points**: Mock external dependencies

## Framework Detection
Automatically detect and use the project's testing framework:
- JavaScript/TypeScript: Jest, Vitest, Mocha
- Python: pytest, unittest
- Go: testing package
- Rust: built-in tests

$ARGUMENTS
