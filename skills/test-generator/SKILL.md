---
name: test-generator
description: |
  WHEN: Test code generation, unit/integration/E2E test writing, component/hook/utility tests
  WHAT: Framework detection + Jest/Vitest/RTL/Playwright templates + Happy Path/Edge/Error case tests
  WHEN NOT: Coverage analysis → coverage-analyzer, Test quality review → code-reviewer
---

# Test Generator Skill

## Purpose
Automatically generates tests by detecting project test framework and applying appropriate patterns.

## When to Use
- Test generation requests
- New component/function needs tests
- Unit, E2E, integration test mentions
- Coverage improvement needed

## Framework Detection

### Test Runners
| Framework | Detection | package.json |
|-----------|-----------|--------------|
| Jest | `jest.config.*` | `jest` |
| Vitest | `vitest.config.*` | `vitest` |
| Playwright | `playwright.config.*` | `@playwright/test` |
| Cypress | `cypress.config.*` | `cypress` |

### Test Libraries
| Library | Purpose | package.json |
|---------|---------|--------------|
| RTL | React components | `@testing-library/react` |
| Vue Test Utils | Vue components | `@vue/test-utils` |

## Workflow

### Step 1: Detect Environment
```
**Runner**: Jest
**Library**: React Testing Library
**Config**: jest.config.js
**Test Dir**: __tests__/, *.test.tsx
```

### Step 2: Select Target
**AskUserQuestion:**
```
"Which code to test?"
Options:
- Specific file/component
- Auto-detect untested files
- Recently changed files
- Entire directory
```

### Step 3: Select Test Type
**AskUserQuestion:**
```
"What type of tests?"
Options:
- Unit Test
- Integration Test
- Component Test
- E2E Test (Playwright/Cypress)
```

### Step 4: Coverage Goal
**AskUserQuestion:**
```
"Coverage goal?"
Options:
- Happy Path only
- Happy Path + Edge Cases
- Full (including errors)
- Specify scenarios
```

## Test Templates

### React Component (Jest + RTL)
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Component } from './Component'

describe('Component', () => {
  const defaultProps = { /* ... */ }
  const renderComponent = (props = {}) =>
    render(<Component {...defaultProps} {...props} />)

  describe('Rendering', () => {
    it('renders with default state', () => {
      renderComponent()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls callback on click', async () => {
      const onClick = jest.fn()
      renderComponent({ onClick })
      await userEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty data', () => {
      renderComponent({ data: [] })
      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })
})
```

### React Hook
```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCustomHook } from './useCustomHook'

describe('useCustomHook', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useCustomHook())
    expect(result.current.value).toBe(initialValue)
  })

  it('updates state', () => {
    const { result } = renderHook(() => useCustomHook())
    act(() => { result.current.setValue('new') })
    expect(result.current.value).toBe('new')
  })
})
```

### Utility Function
```typescript
import { utilityFunction } from './utils'

describe('utilityFunction', () => {
  it('processes valid input', () => {
    expect(utilityFunction('valid')).toBe('expected')
  })

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      expect(utilityFunction('')).toBe('')
    })

    it('handles null', () => {
      expect(utilityFunction(null)).toBeNull()
    })
  })

  describe('Errors', () => {
    it('throws on invalid input', () => {
      expect(() => utilityFunction(undefined)).toThrow()
    })
  })
})
```

### E2E (Playwright)
```typescript
import { test, expect } from '@playwright/test'

test.describe('User Flow: Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('logs in successfully', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByRole('alert')).toContainText('Login failed')
  })
})
```

## Response Template
```
## Tests Generated

**Target**: src/components/Button.tsx
**Output**: src/components/__tests__/Button.test.tsx
**Runner**: Jest + RTL

### Test Cases
| Category | Test | Description |
|----------|------|-------------|
| Rendering | Default render | Renders correctly |
| Interaction | Click event | onClick callback |
| Edge Case | Long text | Overflow handling |

### Run
\`\`\`bash
npm test -- Button.test.tsx
npm test -- --coverage Button.test.tsx
\`\`\`

### Expected Coverage
- Lines: ~90%
- Branches: ~85%
- Functions: ~100%
```

## Best Practices
1. **AAA Pattern**: Arrange-Act-Assert
2. **Clear Names**: Expected behavior in test name
3. **Independence**: Each test runs independently
4. **Minimal Mocking**: Mock only when necessary
5. **Real User Behavior**: Prefer user-event

## Integration
- `/generate-tests` command
- `coverage-analyzer` skill
- `code-reviewer` skill

## Notes
- Follows existing test patterns if present
- Test file location matches project structure
- Mocking based on actual implementation analysis
