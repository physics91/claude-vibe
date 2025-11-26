---
description: "[Express] Skill test - alias for /skill-test"
allowed-tools: Read, Glob, Grep
---

# Express Skill Test (/st)

Quick alias for skill testing. Uses the same functionality as `/skill-test`.

## Usage
- `/st` - Test skill detection for current context
- `/st <skill-name>` - Test specific skill
- `/st <file-path>` - Test which skills match file

$ARGUMENTS

Test workflow:
1. Analyze input/context
2. Run skill detection logic
3. Show matched skills and confidence scores
4. Display generated prompts (dry run)
5. Validate SKILL.md syntax if testing specific skill
