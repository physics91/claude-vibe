---
name: security-scanner
description: |
  WHEN: Security scan, vulnerability detection, XSS/CSRF analysis, secret exposure, OWASP Top 10
  WHAT: XSS/injection detection + hardcoded secrets + auth/authz issues + severity-based vulnerability list
  WHEN NOT: Performance → perf-analyzer, Cloud security → cloud-security-expert
---

# Security Scanner Skill

## Purpose
Detects web application security vulnerabilities based on OWASP Top 10: XSS, hardcoded secrets, authentication issues.

## When to Use
- Security scan requests
- XSS, CSRF, injection mentions
- Pre-production security review
- Auth/authz code review

## Workflow

### Step 1: Scan Scope
**AskUserQuestion:**
```
"Select scan scope"
Options:
- Frontend only
- Include API/backend
- Full project
- Specific file/folder
```

### Step 2: Vulnerability Categories
**AskUserQuestion:**
```
"Select vulnerability types"
Options:
- Full security scan (recommended)
- XSS (Cross-Site Scripting)
- Secrets/API key exposure
- Auth/authz issues
- Dependency vulnerabilities
multiSelect: true
```

## Security Rules

### OWASP Top 10
| Rank | Vulnerability | Check | Severity |
|------|---------------|-------|----------|
| A01 | Broken Access Control | Auth bypass | CRITICAL |
| A02 | Cryptographic Failures | Plaintext, weak crypto | CRITICAL |
| A03 | Injection | SQL, NoSQL, XSS | CRITICAL |
| A05 | Security Misconfiguration | CORS, headers | HIGH |
| A07 | Auth Failures | Weak passwords, sessions | CRITICAL |

### XSS Detection
```typescript
// CRITICAL: React dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// Fix: Use DOMPurify.sanitize(userInput)

// HIGH: innerHTML direct use
element.innerHTML = userInput
// Fix: Use textContent or sanitize

// CRITICAL: eval or Function constructor
eval(userCode)
new Function(userCode)()
// Fix: Never use
```

### Secret Exposure
```typescript
// CRITICAL: Hardcoded API key
const API_KEY = 'sk-1234567890abcdef'

// Patterns detected:
// - API keys: /[a-zA-Z0-9_-]{20,}/
// - AWS keys: /AKIA[0-9A-Z]{16}/
// - JWT: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/

// Fix: Use environment variables
headers: { 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY }
```

### Auth/Authz Issues
```typescript
// HIGH: Token in localStorage
localStorage.setItem('authToken', token)
// Fix: Use httpOnly cookies

// HIGH: Missing authorization check
async function deleteUser(userId) {
  await db.users.delete(userId) // No auth check
}
// Fix: Add authorization
if (!currentUser.isAdmin) throw new ForbiddenError()
```

### Unsafe Data Handling
```typescript
// HIGH: SQL Injection
const query = `SELECT * FROM users WHERE id = ${userId}`
// Fix: Parameterized query
const query = 'SELECT * FROM users WHERE id = $1'

// HIGH: Path traversal
const filePath = path.join(baseDir, userInput)
// Fix: Validate path
if (!safePath.startsWith(baseDir)) throw new Error()
```

### Next.js/React Security
```typescript
// HIGH: Server Action without validation
'use server'
async function updateProfile(formData) {
  const name = formData.get('name')
  await db.users.update({ name }) // No validation
}
// Fix: Use zod validation
const schema = z.object({ name: z.string().min(1).max(100) })
```

## Response Template
```
## Security Scan Results

**Project**: [name]
**Files Scanned**: X

### CRITICAL (Immediate action)

#### 1. [A03] XSS Vulnerability
**File**: `src/components/Comment.tsx:45`
**Code**:
\`\`\`tsx
<div dangerouslySetInnerHTML={{ __html: comment.body }} />
\`\`\`
**Risk**: User input rendered without sanitization
**Fix**:
\`\`\`tsx
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body) }} />
\`\`\`

### HIGH | MEDIUM | LOW
...

### Summary
| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 3 |
| MEDIUM | 5 |

### Actions
1. [ ] Install DOMPurify: `npm install dompurify`
2. [ ] Move API keys to .env
3. [ ] Use httpOnly cookies instead of localStorage
```

## Best Practices
1. **Least Privilege**: Grant only necessary permissions
2. **Defense in Depth**: Validate at multiple layers
3. **Input Validation**: Validate all user input
4. **Output Encoding**: Context-appropriate encoding
5. **Secret Management**: Use env vars or secret managers

## Integration
- `code-reviewer` skill
- `nextjs-reviewer` skill
- `/analyze-code` command

## Notes
- Static analysis may have false positives
- Runtime security testing needs separate tools
- Sensitive files (.env, credentials) excluded from scan
