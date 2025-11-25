---
description: Review pull request changes for code quality and potential issues
allowed-tools: Read, Glob, Grep, Bash
---

# Pull Request Review

Review the current branch changes or specified PR for:

1. **Code Changes**: Review all modified files
2. **Logic Errors**: Identify potential bugs or logic issues
3. **Style Consistency**: Check coding style and conventions
4. **Test Coverage**: Verify tests exist for new functionality
5. **Documentation**: Check if documentation needs updates

## Usage
- `/review-pr` - Review current branch changes vs main
- `/review-pr <pr-number>` - Review specific PR (requires gh CLI)

## Review Checklist
- [ ] No breaking changes without documentation
- [ ] Error handling is appropriate
- [ ] No hardcoded secrets or sensitive data
- [ ] Performance implications considered
- [ ] Tests added/updated as needed

$ARGUMENTS
