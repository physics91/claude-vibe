/**
 * Security Review Prompt Builder
 */

import type { SecurityReviewArgs } from '../schemas.js';

/**
 * Build security-focused code review prompt
 */
export function buildSecurityReviewPrompt(args: SecurityReviewArgs): string {
  const { code, language, threatModel, platform, framework } = args;

  const contextParts: string[] = [];

  if (language) {
    contextParts.push(`Language: ${language}`);
  }
  if (threatModel) {
    contextParts.push(`Threat Model: ${threatModel}`);
  }
  if (platform) {
    contextParts.push(`Platform: ${platform}`);
  }
  if (framework) {
    contextParts.push(`Framework: ${framework}`);
  }

  const threatGuidelines = getThreatModelGuidelines(threatModel);

  return `# Security Code Review

${contextParts.length > 0 ? `## Context\n${contextParts.join('\n')}\n` : ''}
${threatGuidelines ? `## Security Assessment Guidelines\n${threatGuidelines}\n` : ''}
## Task
Perform a comprehensive security review of the following code. Focus on:

1. **Input Validation**: Check for missing or inadequate input validation
2. **Authentication & Authorization**: Verify proper access controls
3. **Data Protection**: Look for sensitive data exposure risks
4. **Injection Vulnerabilities**: SQL, command, path traversal, XSS
5. **Cryptography**: Check for weak algorithms or improper implementations
6. **Error Handling**: Ensure errors don't leak sensitive information
7. **Dependencies**: Note any known vulnerable patterns

For each finding, provide:
- Severity (Critical/High/Medium/Low)
- Description of the vulnerability
- Potential impact
- Recommended fix with code example

## Code to Review

\`\`\`${language ?? ''}
${code}
\`\`\`
`;
}

/**
 * Get threat model specific guidelines
 */
function getThreatModelGuidelines(threatModel?: string): string {
  switch (threatModel) {
    case 'local-user-tool':
      return `This is a LOCAL USER TOOL - the user running the code is the same as the operator.
- Command injection: LOW severity (user can already run commands)
- Path traversal: LOW severity (user has filesystem access)
- Focus on: accidental data corruption, unintended side effects`;

    case 'internal-service':
      return `This is an INTERNAL SERVICE - runs within a trusted network.
- Authentication: Should still verify internal callers
- Network security: Less critical but still review
- Focus on: proper logging, audit trails, resource limits`;

    case 'multi-tenant':
      return `This is a MULTI-TENANT application - multiple users share resources.
- Tenant isolation: CRITICAL - ensure no cross-tenant data leakage
- Resource limits: Important to prevent DoS between tenants
- Focus on: authorization at every level, data partitioning`;

    case 'public-api':
      return `This is a PUBLIC API - exposed to untrusted external users.
- All inputs are UNTRUSTED - validate everything
- Authentication: CRITICAL - robust auth mechanisms required
- Rate limiting: Essential to prevent abuse
- Focus on: defense in depth, assume breach mentality`;

    default:
      return '';
  }
}
