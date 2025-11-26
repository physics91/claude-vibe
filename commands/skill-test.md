---
description: Test skill detection and activation logic
allowed-tools: Read, Glob, Grep
---

# Skill Test

Test a skill's detection logic against the current project or sample input.

## Usage

```
/skill-test [skill-name]
```

## Parameters

- `skill-name` (optional): Specific skill to test. If omitted, tests all skills.

## Workflow

### Step 1: Load Skill Definition
Read the specified skill's SKILL.md file from `skills/<skill-name>/SKILL.md`.

### Step 2: Parse Detection Rules
Extract detection criteria from the skill:
- Project detection patterns (files, dependencies)
- WHEN conditions
- WHEN NOT conditions

### Step 3: Test Against Current Project
Check the current project for:
- File patterns (Glob)
- Dependencies (package.json, requirements.txt, etc.)
- Code patterns (Grep)

### Step 4: Report Results

**Output Format:**
```
## Skill Test Results

### [skill-name]

**Detection Status**: ✓ Would Activate / ✗ Would Not Activate

**Matched Criteria:**
- [x] File detected: package.json
- [x] Dependency found: react
- [x] Pattern matched: src/components/**

**Unmatched Criteria:**
- [ ] File not found: next.config.js
- [ ] Dependency missing: next

**WHEN Conditions:**
- "React project review" → Matches current context

**WHEN NOT Conditions:**
- "Next.js specific" → Not triggered (no Next.js detected)

**Confidence Score**: 85%

**Recommendation**: This skill would activate for general React review.
```

## Examples

### Test Specific Skill
```
/skill-test fastapi-reviewer
```

### Test All Skills
```
/skill-test
```
Output shows which skills would activate for current project.

## Notes

- This is a dry-run test; no actual skill activation occurs
- Useful for debugging custom skills
- Helps understand skill selection logic
