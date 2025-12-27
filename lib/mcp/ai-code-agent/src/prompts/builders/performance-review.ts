/**
 * Performance Review Prompt Builder
 */

import type { PerformanceReviewArgs } from '../schemas.js';

/**
 * Build performance-focused code review prompt
 */
export function buildPerformanceReviewPrompt(args: PerformanceReviewArgs): string {
  const { code, language, framework } = args;

  const contextParts: string[] = [];

  if (language) {
    contextParts.push(`Language: ${language}`);
  }
  if (framework) {
    contextParts.push(`Framework: ${framework}`);
  }

  const frameworkTips = getFrameworkPerformanceTips(framework);

  return `# Performance Code Review

${contextParts.length > 0 ? `## Context\n${contextParts.join('\n')}\n` : ''}
${frameworkTips ? `## Framework-Specific Considerations\n${frameworkTips}\n` : ''}
## Task
Perform a comprehensive performance review of the following code. Focus on:

1. **Time Complexity**: Identify inefficient algorithms (O(n²) or worse)
2. **Space Complexity**: Look for unnecessary memory allocations
3. **I/O Operations**: Database queries, file operations, network calls
4. **Caching Opportunities**: Data that could be cached
5. **Async/Concurrency**: Proper use of async patterns, parallelization opportunities
6. **Memory Leaks**: Unreleased resources, event listener accumulation
7. **Hot Paths**: Code that runs frequently and should be optimized

For each finding, provide:
- Impact (High/Medium/Low)
- Description of the issue
- Performance implication
- Recommended optimization with code example

## Code to Review

\`\`\`${language ?? ''}
${code}
\`\`\`
`;
}

/**
 * Get framework-specific performance tips
 */
function getFrameworkPerformanceTips(framework?: string): string {
  if (!framework) return '';

  const tips: Record<string, string> = {
    react: `React-specific considerations:
- Unnecessary re-renders (missing memo, useMemo, useCallback)
- Large component trees without virtualization
- State management inefficiencies
- Bundle size impact of imports`,

    express: `Express-specific considerations:
- Middleware ordering for early returns
- Database connection pooling
- Response compression
- Static file serving optimization`,

    fastapi: `FastAPI-specific considerations:
- Async vs sync endpoint handlers
- Database connection management
- Pydantic model validation overhead
- Background tasks for heavy operations`,

    nextjs: `Next.js-specific considerations:
- Server vs client component decisions
- Data fetching strategy (SSR, SSG, ISR)
- Image optimization
- Bundle analysis and code splitting`,
  };

  return tips[framework.toLowerCase()] ?? '';
}
