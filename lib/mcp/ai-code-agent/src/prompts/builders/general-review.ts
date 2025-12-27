/**
 * General Review Prompt Builder
 */

import type { GeneralReviewArgs } from '../schemas.js';

/**
 * Parse focus string into array of focus areas
 * Supports comma-separated values: "security,performance" or "security, performance"
 */
function parseFocusAreas(focus?: string): string[] {
  if (!focus) {
    return ['security', 'bugs', 'performance', 'style'];
  }
  return focus
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => ['security', 'performance', 'style', 'bugs'].includes(f));
}

/**
 * Build general code review prompt
 */
export function buildGeneralReviewPrompt(args: GeneralReviewArgs): string {
  const { code, language, focus } = args;

  const contextParts: string[] = [];

  if (language) {
    contextParts.push(`Language: ${language}`);
  }

  const focusAreas = parseFocusAreas(focus);
  const focusSections = focusAreas.map(area => getFocusSection(area)).join('\n');

  return `# Code Review

${contextParts.length > 0 ? `## Context\n${contextParts.join('\n')}\n` : ''}
## Focus Areas
${focusAreas.map(f => `- ${f.charAt(0).toUpperCase() + f.slice(1)}`).join('\n')}

## Task
Perform a comprehensive code review of the following code.

${focusSections}

For each finding, provide:
- Category (${focusAreas.join('/')})
- Severity (Critical/High/Medium/Low)
- Description
- Recommended fix with code example

## Code to Review

\`\`\`${language ?? ''}
${code}
\`\`\`
`;
}

/**
 * Get review section for specific focus area
 */
function getFocusSection(focus: string): string {
  switch (focus) {
    case 'security':
      return `### Security
- Input validation and sanitization
- Authentication and authorization
- Data protection and encryption
- Injection vulnerabilities`;

    case 'performance':
      return `### Performance
- Algorithm efficiency
- Memory usage
- I/O operations optimization
- Caching opportunities`;

    case 'style':
      return `### Code Style
- Naming conventions
- Code organization
- Documentation and comments
- Consistency with best practices`;

    case 'bugs':
      return `### Bug Detection
- Logic errors
- Edge cases handling
- Null/undefined handling
- Error handling`;

    default:
      return '';
  }
}

/**
 * Build style review prompt
 */
export function buildStyleReviewPrompt(args: {
  code: string;
  language?: string;
  framework?: string;
}): string {
  const { code, language, framework } = args;

  const contextParts: string[] = [];
  if (language) contextParts.push(`Language: ${language}`);
  if (framework) contextParts.push(`Framework: ${framework}`);

  return `# Code Style Review

${contextParts.length > 0 ? `## Context\n${contextParts.join('\n')}\n` : ''}
## Task
Review the following code for style and best practices.

### Focus Areas
1. **Naming Conventions**: Variable, function, and class names
2. **Code Organization**: File structure, module organization
3. **Documentation**: Comments, JSDoc/docstrings where appropriate
4. **Consistency**: Consistent patterns throughout the code
5. **Readability**: Clear, self-documenting code
6. **Best Practices**: Language/framework idioms and conventions

For each finding, provide:
- Severity (High/Medium/Low)
- Description
- Recommended improvement with example

## Code to Review

\`\`\`${language ?? ''}
${code}
\`\`\`
`;
}

/**
 * Build bug detection prompt
 */
export function buildBugDetectionPrompt(args: {
  code: string;
  language?: string;
  context?: string;
}): string {
  const { code, language, context } = args;

  const contextParts: string[] = [];
  if (language) contextParts.push(`Language: ${language}`);
  if (context) contextParts.push(`Context: ${context}`);

  return `# Bug Detection

${contextParts.length > 0 ? `## Context\n${contextParts.join('\n')}\n` : ''}
## Task
Analyze the following code for potential bugs and defects.

### Focus Areas
1. **Logic Errors**: Incorrect conditions, wrong operators
2. **Null/Undefined**: Missing null checks, undefined access
3. **Edge Cases**: Boundary conditions, empty inputs
4. **Type Errors**: Type mismatches, incorrect casts
5. **Resource Leaks**: Unclosed resources, memory leaks
6. **Race Conditions**: Concurrent access issues
7. **Error Handling**: Unhandled exceptions, silent failures

For each potential bug, provide:
- Severity (Critical/High/Medium/Low)
- Bug type
- Description and potential impact
- Fix recommendation with code example

## Code to Review

\`\`\`${language ?? ''}
${code}
\`\`\`
`;
}
