---
description: Validate custom skill definition for correctness
allowed-tools: Read, Glob
---

# Validate Skill

Validate a custom skill's SKILL.md file for correct structure and format.

## Usage

```
/validate-skill <skill-name|path>
```

## Parameters

- `skill-name`: Name of skill in skills/ directory
- `path`: Direct path to SKILL.md file

## Validation Checks

### 1. YAML Frontmatter
- [ ] Has valid YAML frontmatter (between `---` markers)
- [ ] Contains `name` field
- [ ] Contains `description` field
- [ ] Description uses WHEN/WHAT/WHEN NOT format

### 2. Required Sections
- [ ] Has `# [Skill Name] Skill` heading
- [ ] Has `## Purpose` section
- [ ] Has `## When to Use` section
- [ ] Has `## Workflow` section

### 3. Description Format
- [ ] WHEN: Describes trigger conditions
- [ ] WHAT: Lists capabilities
- [ ] WHEN NOT: Specifies exclusions

### 4. Content Quality
- [ ] Has code examples
- [ ] Has detection rules table
- [ ] Has response template
- [ ] Has integration section

## Output Format

**Valid Skill:**
```
## Skill Validation: my-custom-skill

**Status**: ✓ VALID

### Frontmatter
- [x] Valid YAML syntax
- [x] name: my-custom-skill
- [x] description: WHEN/WHAT/WHEN NOT format ✓

### Required Sections
- [x] Purpose
- [x] When to Use
- [x] Workflow
- [x] Detection Rules

### Content Quality
- [x] Code examples present
- [x] Response template defined
- [x] Integration references

**Result**: Skill is ready for use.
```

**Invalid Skill:**
```
## Skill Validation: my-custom-skill

**Status**: ✗ INVALID

### Errors (3)

1. **Missing WHEN NOT in description**
   Line 3: description field should include "WHEN NOT:" clause
   ```yaml
   description: |
     WHEN: ...
     WHAT: ...
     WHEN NOT: ...  # Missing!
   ```

2. **Missing Workflow section**
   Expected `## Workflow` heading not found

3. **No code examples**
   Skill should include code examples in detection rules

### Warnings (1)

1. **No Response Template**
   Consider adding a response template for consistent output

**Result**: Fix 3 errors before using this skill.
```

## Example Validations

### Validate by Name
```
/validate-skill fastapi-reviewer
```

### Validate by Path
```
/validate-skill ./my-skills/custom-reviewer/SKILL.md
```

### Validate All Skills
```
/validate-skill --all
```

## Creating Valid Skills

### Minimum Valid Structure
```markdown
---
name: my-skill
description: |
  WHEN: Trigger conditions
  WHAT: Capabilities
  WHEN NOT: Exclusions
---

# My Skill

## Purpose
Brief description of what this skill does.

## When to Use
- Condition 1
- Condition 2

## Workflow

### Step 1: Analyze
Description of first step.

## Detection Rules
| Check | Recommendation | Severity |
|-------|----------------|----------|
| Issue | Fix | HIGH |

## Response Template
```
## Results
...
```

## Integration
- Related skill 1
- Related skill 2
```

## Notes

- Run validation before deploying custom skills
- Fix all errors; warnings are optional
- Use `--verbose` for detailed syntax checking
