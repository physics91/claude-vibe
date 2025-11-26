---
name: nextjs-reviewer
description: |
  WHEN: Next.js project review, App Router patterns, Server/Client Component separation, data fetching
  WHAT: Router pattern analysis + SC/CC separation + next/image·font optimization + Server Actions review
  WHEN NOT: General code quality → code-reviewer, Bundle performance → perf-analyzer
---

# Next.js Reviewer Skill

## Purpose
Reviews Next.js specific patterns: App Router, Server Components, data fetching, and optimizations.

## When to Use
- Next.js project code review
- App Router, Server Component mentions
- Next.js optimization requests
- Projects with `next.config.js` or `next.config.mjs`

## Project Detection
- `next.config.js` or `next.config.mjs`
- `next` dependency in `package.json`
- `app/` directory (App Router)
- `pages/` directory (Pages Router)

## Workflow

### Step 1: Analyze Configuration
```
**Next.js**: 14.x
**Router**: App Router
**TypeScript**: Enabled
```

### Step 2: Select Review Areas
**AskUserQuestion:**
```
"Which areas to review?"
Options:
- Full Next.js pattern check (recommended)
- Server/Client Component separation
- Data fetching patterns
- Image/Font optimization
- Routing and layouts
multiSelect: true
```

## Detection Rules

### Server vs Client Components
| Check | Recommendation | Severity |
|-------|----------------|----------|
| Unnecessary 'use client' | Remove if SC possible | MEDIUM |
| async in Client Component | Move to SC | HIGH |
| useState/useEffect | Check 'use client' need | INFO |

```typescript
// BAD: Unnecessary 'use client'
'use client'
export default function StaticPage() {
  return <div>Static content</div>
}

// GOOD: Keep as Server Component
export default function StaticPage() {
  return <div>Static content</div>
}
```

### App Router Files
| File | Purpose | Check |
|------|---------|-------|
| `page.tsx` | Route page | Default export |
| `layout.tsx` | Layout | children prop |
| `loading.tsx` | Loading UI | Suspense alternative |
| `error.tsx` | Error handling | 'use client' required |

### Data Fetching
| Pattern | Recommendation |
|---------|----------------|
| SC fetch | Recommended (auto caching) |
| Route Handler | API endpoints |
| Client SWR/React Query | Real-time data |

```typescript
// GOOD: Direct fetch in Server Component
async function ProductPage({ params }) {
  const product = await fetch(`/api/products/${params.id}`)
  return <Product data={product} />
}

// WARNING: useEffect fetch in Client
'use client'
function ProductPage({ params }) {
  useEffect(() => { fetch(...) }, [])
  // Recommend: Move to Server Component
}
```

### Image Optimization
| Check | Issue | Severity |
|-------|-------|----------|
| `<img>` tag | Use `next/image` | HIGH |
| Missing width/height | Layout shift | MEDIUM |
| Missing priority | LCP image needs it | MEDIUM |

### Server Actions
| Check | Description | Severity |
|-------|-------------|----------|
| 'use server' location | Top of function/file | HIGH |
| Input validation | Use zod | HIGH |
| Error handling | try-catch | MEDIUM |

## Response Template
```
## Next.js Review Results

**Project**: [name]
**Next.js**: 14.x (App Router)

### Server/Client Components
| Status | File | Issue |
|--------|------|-------|
| WARNING | app/products/page.tsx | Unnecessary 'use client' |

### Data Fetching
| Status | Location | Recommendation |
|--------|----------|----------------|
| WARNING | app/dashboard/page.tsx | Move useEffect fetch to SC |

### Optimization
| Area | Status | Details |
|------|--------|---------|
| Images | WARNING | 3 files using <img> |
| Fonts | OK | Using next/font |

### Actions
1. [ ] Remove 'use client' from `app/products/page.tsx`
2. [ ] Move fetch to Server Component
3. [ ] Use next/image in `components/Banner.tsx`
```

## Best Practices
1. **Server First**: Keep SC when possible
2. **Colocation**: Fetch data where needed
3. **Streaming**: Use loading.tsx and Suspense
4. **Caching**: Explicit fetch caching strategy
5. **Metadata**: Use generateMetadata

## Integration
- `code-reviewer` skill
- `perf-analyzer` skill
- `security-scanner` skill

## Notes
- Based on Next.js 13+ App Router
- Pages Router has different rules
- Review next.config.js settings too
