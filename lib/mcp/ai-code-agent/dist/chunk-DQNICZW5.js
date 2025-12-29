var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/prompt-template.ts
var DIRECT_CODEBASE_ANALYSIS_INSTRUCTION = `CRITICAL: Perform DIRECT CODE ANALYSIS, not a summary.

YOU MUST:
- Analyze the actual code structure, logic flow, and implementation details
- Identify specific issues with line numbers when provided
- Provide concrete, actionable findings based on the ACTUAL code content
- Focus on issues relevant to a production deployment

DO NOT:
- Simply describe what the code does at a high level
- Make assumptions without examining the code
- Skip analysis of functions, classes, or edge cases`;
var DEFAULT_FORMAT_INSTRUCTIONS = `IMPORTANT: You MUST respond with ONLY valid JSON in this exact structure (no additional text, no explanations):
{
  "findings": [{"type": "bug|security|performance|style", "severity": "critical|high|medium|low", "line": number, "title": "string", "description": "string", "suggestion": "string", "code": "string"}],
  "overallAssessment": "string",
  "recommendations": ["string"]
}
If a field is not applicable, use an empty string (e.g., suggestion/code).`;
var PromptTemplateEngine = class {
  templates = /* @__PURE__ */ new Map();
  defaultTemplateId;
  serviceTemplates;
  constructor(config) {
    this.defaultTemplateId = config.defaultTemplate;
    this.serviceTemplates = config.serviceTemplates ?? {};
    this.registerBuiltInTemplates();
    if (config.templates) {
      for (const [id, template] of Object.entries(config.templates)) {
        this.templates.set(id, template);
      }
    }
  }
  /**
   * Register built-in templates
   */
  registerBuiltInTemplates() {
    this.templates.set("default", {
      id: "default",
      name: "Default Analysis",
      description: "Standard code analysis template",
      template: `${DIRECT_CODEBASE_ANALYSIS_INSTRUCTION}

{{contextSection}}

{{formatInstructions}}

Review this code:
{{prompt}}`,
      outputFormat: "json"
    });
    this.templates.set("security-focused", {
      id: "security-focused",
      name: "Security Focused Analysis",
      description: "Template focused on security vulnerabilities",
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
      outputFormat: "json"
    });
    this.templates.set("performance-focused", {
      id: "performance-focused",
      name: "Performance Focused Analysis",
      description: "Template focused on performance issues",
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
      outputFormat: "json"
    });
    this.templates.set("code-quality", {
      id: "code-quality",
      name: "Code Quality Analysis",
      description: "Template focused on code quality and maintainability",
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
      outputFormat: "json"
    });
  }
  /**
   * Render a template with variables
   */
  render(templateId, variables) {
    const template = this.templates.get(templateId) ?? this.templates.get(this.defaultTemplateId);
    const contextSection = this.buildContextSection(variables.context);
    let result = template.template.replace(/\{\{contextSection\}\}/g, contextSection).replace(/\{\{formatInstructions\}\}/g, variables.formatInstructions).replace(/\{\{prompt\}\}/g, variables.prompt);
    if (template.sections) {
      const sections = this.evaluateSections(template.sections, variables.context);
      result = result.replace(/\{\{sections\}\}/g, sections.join("\n\n"));
    }
    result = result.replace(/\{\{sections\}\}/g, "");
    return result.trim();
  }
  /**
   * Build context section from AnalysisContext
   */
  buildContextSection(context) {
    const parts = [];
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
      parts.push(`Focus Areas: ${context.focus.join(", ")}`);
    }
    if (context.fileName) {
      parts.push(`File: ${context.fileName}`);
    }
    if (context.custom) {
      for (const [key, value] of Object.entries(context.custom)) {
        if (value !== void 0 && value !== null) {
          parts.push(`${key}: ${String(value)}`);
        }
      }
    }
    if (parts.length === 0) {
      return "";
    }
    let result = `Analysis Context:
${parts.map((p) => `- ${p}`).join("\n")}`;
    if (context.threatModel) {
      result += "\n\n" + this.getThreatModelGuideline(context.threatModel);
    }
    return result;
  }
  /**
   * Get specific threat model severity guideline
   */
  getThreatModelGuideline(threatModel) {
    const guidelines = {
      "local-user-tool": `IMPORTANT Severity Guidelines for "${threatModel}":
This is a LOCAL tool used by TRUSTED developers. The user controls all input.
- Command injection via CLI args/config files \u2192 LOW severity (developer controls input)
- File path operations on local filesystem \u2192 LOW severity (developer controls paths)
- exec/execSync/spawn with developer-controlled commands \u2192 LOW severity
- Environment variable access \u2192 LOW severity
Focus analysis on: error handling, type safety, code quality, maintainability, and bugs.
Do NOT treat these as HIGH/CRITICAL vulnerabilities in this context.`,
      "internal-service": `Severity Guidelines for "${threatModel}":
This is an INTERNAL service behind authentication with limited exposure.
- SQL injection \u2192 HIGH (still dangerous even internally)
- SSRF \u2192 MEDIUM (limited blast radius)
- Command injection from internal APIs \u2192 MEDIUM
- Missing authentication \u2192 MEDIUM (already behind auth layer)`,
      "multi-tenant": `Severity Guidelines for "${threatModel}":
This handles UNTRUSTED input from multiple users/tenants.
- All injection attacks \u2192 CRITICAL
- Data isolation issues \u2192 HIGH
- Authorization bypass \u2192 CRITICAL
- Information disclosure between tenants \u2192 HIGH`,
      "public-api": `Severity Guidelines for "${threatModel}":
This is INTERNET-FACING with untrusted input.
- All injection attacks \u2192 CRITICAL
- Authentication issues \u2192 CRITICAL
- Rate limiting \u2192 HIGH
- Information disclosure \u2192 HIGH`,
      library: `Severity Guidelines for "${threatModel}":
This is a LIBRARY meant to be used by other developers.
- Document security assumptions in recommendations
- Mark "potential" issues rather than definitive vulnerabilities
- Focus on: API design, type safety, error handling, documentation`
    };
    return guidelines[threatModel] ?? `Note: Using threat model "${threatModel}" for severity assessment.`;
  }
  /**
   * Evaluate conditional sections based on context
   */
  evaluateSections(sections, context) {
    return sections.filter((section) => this.evaluateCondition(section.condition, context)).sort((a, b) => a.priority - b.priority).map((section) => section.content);
  }
  /**
   * Evaluate a condition string against context
   * Supports: "field", "field === 'value'", "field !== 'value'"
   */
  evaluateCondition(condition, context) {
    if (!condition) {
      return true;
    }
    const equalMatch = condition.match(/(\w+)\s*===\s*['"]([^'"]+)['"]/);
    const equalField = equalMatch?.[1];
    const equalValue = equalMatch?.[2];
    if (equalField && equalValue) {
      const field = equalField;
      const value = equalValue;
      return context[field] === value;
    }
    const notEqualMatch = condition.match(/(\w+)\s*!==\s*['"]([^'"]+)['"]/);
    const notEqualField = notEqualMatch?.[1];
    const notEqualValue = notEqualMatch?.[2];
    if (notEqualField && notEqualValue) {
      const field = notEqualField;
      const value = notEqualValue;
      return context[field] !== value;
    }
    const fieldValue = context[condition];
    return fieldValue !== void 0 && fieldValue !== null;
  }
  /**
   * Get template for a specific service
   */
  getTemplateForService(service) {
    return this.serviceTemplates[service] ?? this.defaultTemplateId;
  }
  /**
   * Get a template by ID
   */
  getTemplate(templateId) {
    return this.templates.get(templateId);
  }
  /**
   * List all available template IDs
   */
  listTemplates() {
    return Array.from(this.templates.keys());
  }
  /**
   * Add or update a template at runtime
   */
  addTemplate(template) {
    this.templates.set(template.id, template);
  }
  /**
   * Set the default template
   */
  setDefaultTemplate(templateId) {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    this.defaultTemplateId = templateId;
  }
};
function createTemplateEngine(config) {
  return new PromptTemplateEngine(config);
}
var THREAT_MODEL_GUIDELINES = `
Severity Assessment Guidelines Based on Threat Model:
- "local-user-tool": Local CLI tools run by trusted developers. Command injection from CLI arguments is LOW severity (trusted input). File path traversal to local files is LOW severity. Focus on bugs and code quality.
- "internal-service": Internal APIs behind authentication. SSRF is MEDIUM (limited blast radius). SQL injection is still HIGH.
- "multi-tenant": Shared systems with untrusted user input. All injection attacks are CRITICAL. Data isolation issues are HIGH.
- "public-api": Internet-facing APIs. All injection attacks are CRITICAL. Rate limiting issues are HIGH.
- "library": Code meant to be used by other developers. Document security assumptions rather than marking as vulnerabilities.

When "Threat Model: local-user-tool" is specified, significantly reduce severity for:
- Command injection (from CLI args/config) \u2192 LOW (developer controls input)
- File path operations \u2192 LOW (developer controls paths)
- exec/spawn with developer-controlled input \u2192 LOW
Focus instead on: error handling, type safety, code quality, maintainability.`;

export {
  __export,
  DIRECT_CODEBASE_ANALYSIS_INSTRUCTION,
  DEFAULT_FORMAT_INSTRUCTIONS,
  PromptTemplateEngine,
  createTemplateEngine,
  THREAT_MODEL_GUIDELINES
};
