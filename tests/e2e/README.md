# End-to-End Tests

## Overview

The e2e tests verify the complete Vibe Coding Assistant workflow:
1. User submits a prompt
2. UserPromptSubmit hook analyzes the prompt
3. If ambiguous, the prompt-clarifier skill is activated
4. Claude asks clarifying questions with interactive selections

## Test Structure

```
tests/e2e/
├── run-e2e-tests.ps1    # Main test runner
├── test-helpers.ps1     # Test utility functions
└── README.md            # This file
```

## Running Tests

```powershell
# Run all e2e tests
.\tests\e2e\run-e2e-tests.ps1

# Run with verbose output
.\tests\e2e\run-e2e-tests.ps1 -Verbose
```

## Test Coverage

### Scenario Tests (7 scenarios)
- ✅ Ambiguous prompts (4 scenarios)
  - Too short prompts
  - Vague project descriptions
  - Vague optimization requests
  - Missing code context

- ✅ Clear prompts (3 scenarios)
  - Specific with tech stack
  - Specific optimization requests
  - File path specified

### Integration Tests
- ✅ Log file creation
- ✅ Log file content validation
- ✅ Module dependency loading

## Test Results

Current status: **10/10 tests passing** (100%)

```
================================
Test Summary
================================
Total Tests: 10
Passed: 10
Failed: 0
Success Rate: 100%

✓ All tests passed!
```

## Known Limitations

1. **Encoding Issues**: PowerShell console may display `??` instead of checkmarks due to Windows console encoding limitations. This is a visual issue only and does not affect test functionality.

2. **Korean String Handling**: Some modules with Korean strings are skipped in tests to avoid encoding issues. The actual plugin supports Korean fully when used in Claude Code.

3. **Simplified Testing**: E2e tests focus on core workflow validation rather than full integration with Claude Code CLI.

## Test Implementation Details

### test-helpers.ps1

Provides utility functions for:
- Creating test environments
- Executing hooks with mock prompts
- Validating skill activation
- Checking log files
- Assertion functions

### run-e2e-tests.ps1

Main test runner that:
- Sets up test environment
- Runs 7 scenario tests
- Runs integration tests
- Reports results with summary

## Future Improvements

- [ ] Add more ambiguity patterns
- [ ] Test different languages
- [ ] Add performance benchmarks
- [ ] Test error handling scenarios
- [ ] Add CI/CD integration

## Troubleshooting

### Tests fail with "logs directory not found"

Make sure the hook script has permission to create the logs directory:

```powershell
New-Item -ItemType Directory -Path "logs" -Force
```

### Module import errors

If you see module parsing errors, ensure:
- PowerShell execution policy allows scripts
- All `.ps1` files are properly encoded (UTF-8)
- No syntax errors in PowerShell files

### Hook execution fails

Check:
- `CLAUDE_PLUGIN_ROOT` environment variable is set
- `CLAUDE_PROMPT` environment variable is set
- Hook script has execute permissions
