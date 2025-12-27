/**
 * Prompt Template Engine
 * Renders prompt templates with context-aware variable substitution
 */

import type { AnalysisContext } from '../schemas/context.js';
import type { PromptTemplate, PromptSection } from '../schemas/prompts.js';

/**
 * Direct codebase analysis instruction for AI
 * Ensures AI analyzes the provided code directly rather than summarizing
 */
export const DIRECT_CODEBASE_ANALYSIS_INSTRUCTION = `CRITICAL: Perform DIRECT CODE ANALYSIS, not a summary.

YOU MUST:
- Analyze the actual code structure, logic flow, and implementation details
- Identify specific issues with line numbers when provided
- Provide concrete, actionable findings based on the ACTUAL code content
- Focus on issues relevant to a production deployment

DO NOT:
- Simply describe what the code does at a high level
- Make assumptions without examining the code
- Skip analysis of functions, classes, or edge cases`;

/**
 * Default JSON format instructions for AI responses
 */
export const DEFAULT_FORMAT_INSTRUCTIONS = `IMPORTANT: You MUST respond with ONLY valid JSON in this exact structure (no additional text, no explanations):
{
  "findings": [{"type": "bug|security|performance|style", "severity": "critical|high|medium|low", "line": number, "title": "string", "description": "string", "suggestion": "string", "code": "string"}],
  "overallAssessment": "string",
  "recommendations": ["string"]
}
If a field is not applicable, use an empty string (e.g., suggestion/code).`;

/**
 * Template variables for rendering
 */
export interface TemplateVariables {
  prompt: string;
  context: AnalysisContext;
  formatInstructions: string;
}

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  templates?: Record<string, PromptTemplate>;
  defaultTemplate: string;
  serviceTemplates?: {
    codex?: string;
    gemini?: string;
  };
}

/**
 * Prompt Template Engine class
 */
export class PromptTemplateEngine {
  private templates: Map<string, PromptTemplate> = new Map();
  private defaultTemplateId: string;
  private serviceTemplates: { codex?: string; gemini?: string };

  constructor(config: TemplateEngineConfig) {
    this.defaultTemplateId = config.defaultTemplate;
    this.serviceTemplates = config.serviceTemplates ?? {};

    // Register built-in templates
    this.registerBuiltInTemplates();

    // Register custom templates from config
    if (config.templates) {
      for (const [id, template] of Object.entries(config.templates)) {
        this.templates.set(id, template);
      }
    }
  }

  /**
   * Register built-in templates
   */
  private registerBuiltInTemplates(): void {
    // Default template
    this.templates.set('default', {
      id: 'default',
      name: 'Default Analysis',
      description: 'Standard code analysis template',
      template: `${DIRECT_CODEBASE_ANALYSIS_INSTRUCTION}

{{contextSection}}

{{formatInstructions}}

Review this code:
{{prompt}}`,
      outputFormat: 'json',
    });

    // Security-focused template
    this.templates.set('security-focused', {
      id: 'security-focused',
      name: 'Security Focused Analysis',
      description: 'Template focused on security vulnerabilities',
      template: `${DIRECT_CODEBASE_ANALYSIS_INSTRUCTION}

{{contextSection}}

Focus specifically on security vulnerabilities including:
- Injection attacks (SQL, Command, XSS, LDAP)
- Authentication and Authorization issues
- Data exposure and information leakage
- Cryptographic weaknesses
- Input validation issues
- Unsafe deserialization
- Security misconfigurations

{{formatInstructions}}

Review this code for security issues:
{{prompt}}`,
      outputFormat: 'json',
    });

    // Performance-focused template
    this.templates.set('performance-focused', {
      id: 'performance-focused',
      name: 'Performance Focused Analysis',
      description: 'Template focused on performance issues',
      template: `${DIRECT_CODEBASE_ANALYSIS_INSTRUCTION}

{{contextSection}}

Focus specifically on performance issues including:
- Inefficient algorithms and data structures
- Memory leaks and excessive allocations
- N+1 queries and database performance
- Unnecessary computations
- Blocking operations in async code
- Cache opportunities
- Resource management

{{formatInstructions}}

Review this code for performance issues:
{{prompt}}`,
      outputFormat: 'json',
    });

    // Code quality template
    this.templates.set('code-quality', {
      id: 'code-quality',
      name: 'Code Quality Analysis',
      description: 'Template focused on code quality and maintainability',
      template: `${DIRECT_CODEBASE_ANALYSIS_INSTRUCTION}

{{contextSection}}

Focus on code quality and maintainability:
- Code organization and structure
- Naming conventions and readability
- Error handling patterns
- Code duplication
- SOLID principles adherence
- Testability concerns
- Documentation completeness

{{formatInstructions}}

Review this code for quality issues:
{{prompt}}`,
      outputFormat: 'json',
    });
  }

  /**
   * Render a template with variables
   */
  render(templateId: string, variables: TemplateVariables): string {
    const template = this.templates.get(templateId) ?? this.templates.get(this.defaultTemplateId)!;

    // Build context section
    const contextSection = this.buildContextSection(variables.context);

    // Replace placeholders
    let result = template.template
      .replace(/\{\{contextSection\}\}/g, contextSection)
      .replace(/\{\{formatInstructions\}\}/g, variables.formatInstructions)
      .replace(/\{\{prompt\}\}/g, variables.prompt);

    // Process conditional sections if any
    if (template.sections) {
      const sections = this.evaluateSections(template.sections, variables.context);
      result = result.replace(/\{\{sections\}\}/g, sections.join('\n\n'));
    }

    // Clean up any remaining empty placeholder
    result = result.replace(/\{\{sections\}\}/g, '');

    return result.trim();
  }

  /**
   * Build context section from AnalysisContext
   */
  private buildContextSection(context: AnalysisContext): string {
    const parts: string[] = [];

    if (context.scope) {
      parts.push(`Code Scope: ${context.scope}`);
    }
    if (context.threatModel) {
      parts.push(`Threat Model: ${context.threatModel}`);
    }
    if (context.platform) {
      parts.push(`Platform: ${context.platform}`);
    }
    if (context.projectType) {
      parts.push(`Project Type: ${context.projectType}`);
    }
    if (context.language) {
      parts.push(`Language: ${context.language}`);
    }
    if (context.framework) {
      parts.push(`Framework: ${context.framework}`);
    }
    if (context.focus && context.focus.length > 0) {
      parts.push(`Focus Areas: ${context.focus.join(', ')}`);
    }
    if (context.fileName) {
      parts.push(`File: ${context.fileName}`);
    }

    // Add custom fields
    if (context.custom) {
      for (const [key, value] of Object.entries(context.custom)) {
        if (value !== undefined && value !== null) {
          parts.push(`${key}: ${String(value)}`);
        }
      }
    }

    if (parts.length === 0) {
      return '';
    }

    let result = `Analysis Context:\n${parts.map(p => `- ${p}`).join('\n')}`;

    // Add threat model guidelines when a threat model is specified
    if (context.threatModel) {
      result += '\n\n' + this.getThreatModelGuideline(context.threatModel);
    }

    return result;
  }

  /**
   * Get specific threat model severity guideline
   */
  private getThreatModelGuideline(threatModel: string): string {
    const guidelines: Record<string, string> = {
      'local-user-tool': `IMPORTANT Severity Guidelines for "${threatModel}":
This is a LOCAL tool used by TRUSTED developers. The user controls all input.
- Command injection via CLI args/config files → LOW severity (developer controls input)
- File path operations on local filesystem → LOW severity (developer controls paths)
- exec/execSync/spawn with developer-controlled commands → LOW severity
- Environment variable access → LOW severity
Focus analysis on: error handling, type safety, code quality, maintainability, and bugs.
Do NOT treat these as HIGH/CRITICAL vulnerabilities in this context.`,

      'internal-service': `Severity Guidelines for "${threatModel}":
This is an INTERNAL service behind authentication with limited exposure.
- SQL injection → HIGH (still dangerous even internally)
- SSRF → MEDIUM (limited blast radius)
- Command injection from internal APIs → MEDIUM
- Missing authentication → MEDIUM (already behind auth layer)`,

      'multi-tenant': `Severity Guidelines for "${threatModel}":
This handles UNTRUSTED input from multiple users/tenants.
- All injection attacks → CRITICAL
- Data isolation issues → HIGH
- Authorization bypass → CRITICAL
- Information disclosure between tenants → HIGH`,

      'public-api': `Severity Guidelines for "${threatModel}":
This is INTERNET-FACING with untrusted input.
- All injection attacks → CRITICAL
- Authentication issues → CRITICAL
- Rate limiting → HIGH
- Information disclosure → HIGH`,

      library: `Severity Guidelines for "${threatModel}":
This is a LIBRARY meant to be used by other developers.
- Document security assumptions in recommendations
- Mark "potential" issues rather than definitive vulnerabilities
- Focus on: API design, type safety, error handling, documentation`,
    };

    return (
      guidelines[threatModel] ??
      `Note: Using threat model "${threatModel}" for severity assessment.`
    );
  }

  /**
   * Evaluate conditional sections based on context
   */
  private evaluateSections(sections: PromptSection[], context: AnalysisContext): string[] {
    return sections
      .filter(section => this.evaluateCondition(section.condition, context))
      .sort((a, b) => a.priority - b.priority)
      .map(section => section.content);
  }

  /**
   * Evaluate a condition string against context
   * Supports: "field", "field === 'value'", "field !== 'value'"
   */
  private evaluateCondition(condition: string | undefined, context: AnalysisContext): boolean {
    if (!condition) {
      return true;
    }

    // Match equality: field === 'value'
    const equalMatch = condition.match(/(\w+)\s*===\s*['"]([^'"]+)['"]/);
    const equalField = equalMatch?.[1];
    const equalValue = equalMatch?.[2];
    if (equalField && equalValue) {
      const field = equalField;
      const value = equalValue;
      return (context as Record<string, unknown>)[field] === value;
    }

    // Match inequality: field !== 'value'
    const notEqualMatch = condition.match(/(\w+)\s*!==\s*['"]([^'"]+)['"]/);
    const notEqualField = notEqualMatch?.[1];
    const notEqualValue = notEqualMatch?.[2];
    if (notEqualField && notEqualValue) {
      const field = notEqualField;
      const value = notEqualValue;
      return (context as Record<string, unknown>)[field] !== value;
    }

    // Simple field existence check
    const fieldValue = (context as Record<string, unknown>)[condition];
    return fieldValue !== undefined && fieldValue !== null;
  }

  /**
   * Get template for a specific service
   */
  getTemplateForService(service: 'codex' | 'gemini'): string {
    return this.serviceTemplates[service] ?? this.defaultTemplateId;
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all available template IDs
   */
  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Add or update a template at runtime
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Set the default template
   */
  setDefaultTemplate(templateId: string): void {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    this.defaultTemplateId = templateId;
  }
}

/**
 * Create a PromptTemplateEngine from config
 */
export function createTemplateEngine(config: TemplateEngineConfig): PromptTemplateEngine {
  return new PromptTemplateEngine(config);
}

/**
 * Threat model interpretation guidelines for AI
 */
export const THREAT_MODEL_GUIDELINES = `
Severity Assessment Guidelines Based on Threat Model:
- "local-user-tool": Local CLI tools run by trusted developers. Command injection from CLI arguments is LOW severity (trusted input). File path traversal to local files is LOW severity. Focus on bugs and code quality.
- "internal-service": Internal APIs behind authentication. SSRF is MEDIUM (limited blast radius). SQL injection is still HIGH.
- "multi-tenant": Shared systems with untrusted user input. All injection attacks are CRITICAL. Data isolation issues are HIGH.
- "public-api": Internet-facing APIs. All injection attacks are CRITICAL. Rate limiting issues are HIGH.
- "library": Code meant to be used by other developers. Document security assumptions rather than marking as vulnerabilities.

When "Threat Model: local-user-tool" is specified, significantly reduce severity for:
- Command injection (from CLI args/config) → LOW (developer controls input)
- File path operations → LOW (developer controls paths)
- exec/spawn with developer-controlled input → LOW
Focus instead on: error handling, type safety, code quality, maintainability.`;
