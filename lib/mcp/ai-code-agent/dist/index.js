#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/core/config.ts
import { cosmiconfig } from "cosmiconfig";

// config/default.json
var default_default = {
  $schema: "./schema.json",
  server: {
    name: "ai-code-agent-mcp",
    version: "1.3.0",
    logLevel: "info",
    transport: "stdio"
  },
  codex: {
    enabled: true,
    cliPath: "auto",
    timeout: 0,
    retryAttempts: 3,
    retryDelay: 1e3,
    maxConcurrent: 1,
    queue: {},
    output: {
      mode: "last-message",
      outputSchemaPath: "./config/codex-output.schema.json"
    },
    model: "gpt-5.2",
    search: true,
    reasoningEffort: "xhigh",
    args: []
  },
  gemini: {
    enabled: true,
    cliPath: "auto",
    timeout: 0,
    retryAttempts: 3,
    retryDelay: 1e3,
    maxConcurrent: 1,
    queue: {},
    model: "gemini-3-pro-preview",
    args: []
  },
  analysis: {
    maxCodeLength: 5e4,
    includeContext: true,
    defaultLanguage: null,
    maxFindings: 200,
    maxCodeSnippetLength: 4e3,
    maxOutputChars: 2e5,
    formats: ["markdown", "json"],
    defaultSeverity: "all",
    deduplication: {
      enabled: true,
      similarityThreshold: 0.8
    }
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1e3,
    maxDelay: 1e4,
    backoffFactor: 2,
    retryableErrors: [
      "TIMEOUT_ERROR",
      "NETWORK_ERROR",
      "CLI_EXECUTION_ERROR"
    ]
  },
  logging: {
    level: "info",
    pretty: false,
    file: {
      enabled: true,
      path: "~/.claude/claude-vibe/logs/ai-code-agent-mcp.log",
      maxSize: "10M",
      maxFiles: 3
    }
  },
  cache: {
    enabled: true,
    ttl: 36e5,
    maxSize: 1e3,
    strategy: "lru",
    cleanupIntervalMs: 3e5,
    touchIntervalMs: 3e4
  },
  storage: {
    type: "sqlite",
    sqlite: {
      path: "~/.claude/claude-vibe/data/ai-code-agent.db",
      enableWAL: true,
      busyTimeout: 5e3
    }
  },
  secretScanning: {
    enabled: true,
    maxScanLength: 2e5,
    maxLineLength: 1e4,
    patterns: {
      aws: true,
      gcp: true,
      azure: true,
      github: true,
      generic: true,
      database: true,
      privateKeys: true
    },
    excludePatterns: [
      ".*\\.test\\.(ts|js|tsx|jsx)$",
      ".*\\.spec\\.(ts|js|tsx|jsx)$",
      ".*__tests__.*",
      ".*\\.mock\\.(ts|js)$"
    ]
  },
  context: {
    defaults: {
      scope: "partial"
    },
    presets: {
      "react-web": {
        threatModel: "web-public",
        platform: "cross-platform",
        projectType: "web-app",
        framework: "react",
        language: "typescript",
        focus: ["security", "performance"]
      },
      "nodejs-api": {
        threatModel: "internal-service",
        platform: "unix",
        projectType: "api",
        framework: "express",
        language: "typescript",
        focus: ["security", "performance"]
      },
      "mcp-server": {
        threatModel: "local-user-tool",
        platform: "cross-platform",
        projectType: "mcp-server",
        language: "typescript",
        focus: ["security", "bugs"]
      },
      "cli-tool": {
        threatModel: "local-user-tool",
        platform: "cross-platform",
        projectType: "cli",
        language: "typescript",
        focus: ["bugs", "style"]
      },
      library: {
        threatModel: "library",
        platform: "cross-platform",
        projectType: "library",
        language: "typescript",
        scope: "full",
        focus: ["bugs", "performance", "style"]
      }
    },
    activePreset: null,
    allowEnvOverride: true,
    autoDetect: true
  },
  prompts: {
    defaultTemplate: "default",
    serviceTemplates: {
      codex: "default",
      gemini: "default"
    }
  },
  warnings: {
    enabled: true,
    showTips: true,
    suppressions: []
  }
};

// src/schemas/config.ts
import { z as z3 } from "zod";

// src/schemas/context.ts
import { z } from "zod";
var ThreatModelSchema = z.enum(["local-user-tool", "internal-service", "multi-tenant", "public-api"]).or(z.string()).describe("Threat model for security severity assessment");
var PlatformSchema = z.enum(["windows", "unix", "cross-platform", "web", "mobile"]).or(z.string()).describe("Target platform for platform-specific code analysis");
var ProjectTypeSchema = z.enum(["mcp-server", "web-app", "cli-tool", "library", "api-service"]).or(z.string()).describe("Project type for contextual analysis");
var ScopeSchema = z.enum(["full", "partial", "snippet"]).describe("Code completeness: full=complete file, partial=incomplete, snippet=code fragment");
var FocusAreaSchema = z.enum(["security", "performance", "style", "bugs"]);
var AnalysisContextSchema = z.object({
  // Core context fields
  threatModel: ThreatModelSchema.optional().describe(
    "Threat model: local-user-tool (trusted), internal-service, multi-tenant (shared), public-api (untrusted)"
  ),
  platform: PlatformSchema.optional().describe(
    "Target platform for platform-specific security checks"
  ),
  projectType: ProjectTypeSchema.optional().describe("Project type for contextual analysis"),
  language: z.string().optional().describe("Primary programming language (e.g., typescript, python, go)"),
  framework: z.string().optional().describe("Framework in use (e.g., react, express, fastapi)"),
  // Code completeness
  scope: ScopeSchema.optional().describe(
    'Code completeness indicator to avoid false positives like "unused import"'
  ),
  fileName: z.string().optional().describe("File name for context and auto-detection"),
  // Analysis focus
  focus: z.array(FocusAreaSchema).optional().describe("Focus areas for analysis: security, performance, style, bugs"),
  // Preset reference
  preset: z.string().optional().describe("Context preset name to apply (e.g., react-web, nodejs-api)"),
  // Extension point for custom context
  custom: z.record(z.string(), z.unknown()).optional().describe("Custom context fields for extensibility")
}).passthrough();

// src/schemas/prompts.ts
import { z as z2 } from "zod";
var PromptSectionSchema = z2.object({
  id: z2.string().describe("Unique identifier for the section"),
  condition: z2.string().optional().describe(`Condition for including this section (e.g., "threatModel === 'public-api'")`),
  content: z2.string().describe("Content of the section"),
  priority: z2.number().default(0).describe("Priority for ordering sections (lower = earlier)")
});
var PromptTemplateSchema = z2.object({
  id: z2.string().describe("Unique identifier for the template"),
  name: z2.string().describe("Human-readable name for the template"),
  description: z2.string().optional().describe("Description of the template purpose"),
  template: z2.string().describe(
    "Template string with {{variable}} placeholders: {{contextSection}}, {{formatInstructions}}, {{prompt}}"
  ),
  sections: z2.array(PromptSectionSchema).optional().describe("Conditional sections to include based on context"),
  outputFormat: z2.enum(["json", "markdown"]).default("json").describe("Expected output format from AI"),
  tags: z2.array(z2.string()).optional().describe("Tags for categorization")
});
var PromptTemplateRegistrySchema = z2.object({
  templates: z2.record(z2.string(), PromptTemplateSchema).optional().describe("Map of template ID to template definition"),
  defaultTemplate: z2.string().default("default").describe("Default template ID to use"),
  serviceTemplates: z2.object({
    codex: z2.string().optional().describe("Template ID override for Codex"),
    gemini: z2.string().optional().describe("Template ID override for Gemini")
  }).optional().describe("Service-specific template overrides")
});

// src/schemas/config.ts
var ServerConfigSchema = z3.object({
  server: z3.object({
    name: z3.string().default("ai-code-agent-mcp"),
    version: z3.string().default("1.2.0"),
    logLevel: z3.enum(["debug", "info", "warn", "error"]).default("info"),
    transport: z3.enum(["stdio", "http"]).default("stdio")
  }),
  codex: z3.object({
    enabled: z3.boolean().default(true),
    cliPath: z3.string().default("codex"),
    timeout: z3.number().min(0).default(0),
    // 0 = unlimited
    retryAttempts: z3.number().min(0).max(10).default(3),
    retryDelay: z3.number().min(0).default(1e3),
    maxConcurrent: z3.number().min(1).max(10).default(1),
    queue: z3.object({
      interval: z3.number().min(0).optional(),
      intervalCap: z3.number().min(1).optional()
    }).default({}),
    output: z3.object({
      mode: z3.enum(["jsonl", "last-message"]).default("last-message"),
      lastMessageFileDir: z3.string().optional(),
      outputSchemaPath: z3.string().optional()
    }).default({ mode: "last-message" }),
    model: z3.string().nullable().default("gpt-5.2"),
    search: z3.boolean().default(true),
    reasoningEffort: z3.enum(["minimal", "low", "medium", "high", "xhigh"]).default("high"),
    args: z3.array(z3.string()).default([])
  }),
  gemini: z3.object({
    enabled: z3.boolean().default(true),
    cliPath: z3.string().default("/usr/local/bin/gemini"),
    timeout: z3.number().min(0).default(0),
    // 0 = unlimited
    retryAttempts: z3.number().min(0).max(10).default(3),
    retryDelay: z3.number().min(0).default(1e3),
    maxConcurrent: z3.number().min(1).max(10).default(1),
    queue: z3.object({
      interval: z3.number().min(0).optional(),
      intervalCap: z3.number().min(1).optional()
    }).default({}),
    model: z3.string().nullable().default("gemini-3-pro-preview"),
    args: z3.array(z3.string()).default([])
  }),
  analysis: z3.object({
    maxCodeLength: z3.number().min(100).max(1e6).default(5e4),
    includeContext: z3.boolean().default(true),
    defaultLanguage: z3.string().nullable().default(null),
    maxFindings: z3.number().min(1).max(1e4).default(200),
    maxCodeSnippetLength: z3.number().min(0).max(1e5).default(4e3),
    maxOutputChars: z3.number().min(0).max(1e6).default(2e5),
    formats: z3.array(z3.enum(["markdown", "json", "html"])).default(["markdown", "json"]),
    defaultSeverity: z3.enum(["all", "high", "medium"]).default("all"),
    deduplication: z3.object({
      enabled: z3.boolean().default(true),
      similarityThreshold: z3.number().min(0).max(1).default(0.8)
    })
  }),
  retry: z3.object({
    maxAttempts: z3.number().min(0).max(10).default(3),
    initialDelay: z3.number().min(0).default(1e3),
    maxDelay: z3.number().min(0).default(1e4),
    backoffFactor: z3.number().min(1).default(2),
    retryableErrors: z3.array(z3.string()).default(["TIMEOUT_ERROR", "NETWORK_ERROR", "CLI_EXECUTION_ERROR"])
  }),
  logging: z3.object({
    level: z3.enum(["debug", "info", "warn", "error"]).default("info"),
    pretty: z3.boolean().default(true),
    file: z3.object({
      enabled: z3.boolean().default(false),
      path: z3.string().default("./logs/ai-code-agent-mcp.log"),
      maxSize: z3.string().default("10M"),
      maxFiles: z3.number().default(5)
    })
  }),
  cache: z3.object({
    enabled: z3.boolean().default(true),
    ttl: z3.number().min(0).default(36e5),
    maxSize: z3.number().min(0).default(1e3),
    strategy: z3.enum(["lru", "fifo"]).default("lru"),
    cleanupIntervalMs: z3.number().min(0).default(3e5),
    touchIntervalMs: z3.number().min(0).default(3e4)
  }),
  storage: z3.object({
    type: z3.enum(["memory", "sqlite"]).default("sqlite"),
    sqlite: z3.object({
      path: z3.string().default("./data/ai-code-agent.db"),
      enableWAL: z3.boolean().default(true),
      busyTimeout: z3.number().min(0).default(5e3)
    }).default({})
  }).default({}),
  secretScanning: z3.object({
    enabled: z3.boolean().default(true),
    maxScanLength: z3.number().min(0).default(2e5),
    maxLineLength: z3.number().min(0).default(1e4),
    patterns: z3.object({
      aws: z3.boolean().default(true),
      gcp: z3.boolean().default(true),
      azure: z3.boolean().default(true),
      github: z3.boolean().default(true),
      generic: z3.boolean().default(true),
      database: z3.boolean().default(true),
      privateKeys: z3.boolean().default(true)
    }),
    excludePatterns: z3.array(z3.string()).default([
      ".*\\.test\\.(ts|js|tsx|jsx)$",
      ".*\\.spec\\.(ts|js|tsx|jsx)$",
      ".*__tests__.*",
      ".*\\.mock\\.(ts|js)$"
    ])
  }),
  // Context configuration for analysis
  context: z3.object({
    defaults: AnalysisContextSchema.optional().describe(
      "Default context applied to all analyses"
    ),
    presets: z3.record(z3.string(), AnalysisContextSchema).optional().describe("Named context presets (e.g., react-web, nodejs-api)"),
    activePreset: z3.string().nullable().default(null).describe("Active preset name to apply by default"),
    allowEnvOverride: z3.boolean().default(true).describe("Allow environment variables to override context"),
    autoDetect: z3.boolean().default(true).describe("Enable auto-detection of language, framework, platform")
  }).default({}),
  // Prompt template configuration
  prompts: z3.object({
    templates: z3.record(z3.string(), PromptTemplateSchema).optional().describe("Custom prompt templates"),
    defaultTemplate: z3.string().default("default").describe("Default template ID to use"),
    serviceTemplates: z3.object({
      codex: z3.string().optional().describe("Template override for Codex"),
      gemini: z3.string().optional().describe("Template override for Gemini")
    }).optional().describe("Service-specific template overrides")
  }).default({}),
  // Warning system configuration
  warnings: z3.object({
    enabled: z3.boolean().default(true).describe("Enable context warnings"),
    showTips: z3.boolean().default(true).describe("Show tips with warnings"),
    suppressions: z3.array(z3.string()).default([]).describe("Warning codes to suppress (e.g., MISSING_SCOPE)")
  }).default({})
});

// src/types/common.ts
var BaseError = class extends Error {
  constructor(message, code, details) {
    super(message);
    this.details = details;
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
  code;
};

// src/core/error-handler.ts
var ValidationError = class extends BaseError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR" /* VALIDATION_ERROR */, details);
  }
};
var CLIExecutionError = class extends BaseError {
  constructor(message, details) {
    super(message, "CLI_EXECUTION_ERROR" /* CLI_EXECUTION_ERROR */, details);
  }
};
var MCPToolError = class extends BaseError {
  fatal;
  retryable;
  constructor(message, details) {
    super(message, "MCP_TOOL_ERROR" /* MCP_TOOL_ERROR */, details);
    this.fatal = details?.fatal ?? false;
    this.retryable = details?.retryable ?? false;
  }
};
var TimeoutError = class extends BaseError {
  constructor(message, details) {
    super(message, "TIMEOUT_ERROR" /* TIMEOUT_ERROR */, details);
  }
};
var ConfigurationError = class extends BaseError {
  constructor(message, details) {
    super(message, "CONFIGURATION_ERROR" /* CONFIGURATION_ERROR */, details);
  }
};
var ParseError = class extends BaseError {
  constructor(message, details) {
    super(message, "PARSE_ERROR" /* PARSE_ERROR */, details);
  }
};
var SecurityError = class extends BaseError {
  constructor(message, details) {
    super(message, "SECURITY_ERROR" /* SECURITY_ERROR */, details);
  }
};
var CodexAnalysisError = class extends BaseError {
  constructor(message, analysisId, details) {
    super(message, "CODEX_ANALYSIS_ERROR" /* CODEX_ANALYSIS_ERROR */, { ...details, analysisId });
    this.analysisId = analysisId;
  }
};
var CodexTimeoutError = class extends CodexAnalysisError {
  constructor(message, analysisId, details) {
    super(message, analysisId, details);
    this.code = "CODEX_TIMEOUT_ERROR" /* CODEX_TIMEOUT_ERROR */;
  }
};
var CodexParseError = class extends CodexAnalysisError {
  constructor(message, analysisId, details) {
    super(message, analysisId, details);
    this.code = "CODEX_PARSE_ERROR" /* CODEX_PARSE_ERROR */;
  }
};
var GeminiAnalysisError = class extends BaseError {
  constructor(message, analysisId, details) {
    super(message, "GEMINI_ANALYSIS_ERROR" /* GEMINI_ANALYSIS_ERROR */, { ...details, analysisId });
    this.analysisId = analysisId;
  }
};
var GeminiTimeoutError = class extends GeminiAnalysisError {
  constructor(message, analysisId, details) {
    super(message, analysisId, details);
    this.code = "GEMINI_TIMEOUT_ERROR" /* GEMINI_TIMEOUT_ERROR */;
  }
};
var GeminiParseError = class extends GeminiAnalysisError {
  constructor(message, analysisId, details) {
    super(message, analysisId, details);
    this.code = "GEMINI_PARSE_ERROR" /* GEMINI_PARSE_ERROR */;
  }
};
var ErrorHandler = class {
  /**
   * Check if error is retryable
   * CRITICAL FIX: Don't retry fatal errors, only transient ones
   */
  static isRetryable(error) {
    if (error instanceof MCPToolError) {
      if (error.fatal) return false;
      if (error.retryable) return true;
      return false;
    }
    if (error instanceof TimeoutError) return true;
    if (error instanceof CLIExecutionError) return true;
    return false;
  }
  /**
   * Classify unknown error
   */
  static classifyError(error) {
    if (error instanceof BaseError) {
      return error;
    }
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return new TimeoutError(error.message, { cause: error });
      }
      if (error.message.includes("validation")) {
        return new ValidationError(error.message, { cause: error });
      }
      return new BaseError(error.message, "UNKNOWN_ERROR" /* UNKNOWN_ERROR */, { cause: error });
    }
    return new BaseError("An unknown error occurred", "UNKNOWN_ERROR" /* UNKNOWN_ERROR */, { error });
  }
  /**
   * Format error for user display
   */
  static formatErrorMessage(error) {
    if (error instanceof BaseError) {
      return `[${error.code}] ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unknown error occurred";
  }
  /**
   * Create error response object
   */
  static createErrorResponse(error) {
    const classified = this.classifyError(error);
    return {
      success: false,
      error: {
        code: classified.code,
        message: classified.message,
        details: classified.details
      }
    };
  }
};

// src/core/config.ts
var ConfigManager = class _ConfigManager {
  static instance = null;
  config;
  constructor(config) {
    this.config = config;
  }
  /**
   * Load configuration from multiple sources
   */
  static async load() {
    try {
      const baseConfig = ServerConfigSchema.parse(default_default);
      let config = { ...baseConfig };
      const explorer = cosmiconfig("code-review-mcp");
      const result = await explorer.search();
      const fileConfig = result?.config;
      if (fileConfig && typeof fileConfig === "object" && fileConfig !== null) {
        config = this.mergeConfig(config, fileConfig);
      }
      config = this.applyEnvironmentOverrides(config);
      const validated = ServerConfigSchema.parse(config);
      _ConfigManager.instance = new _ConfigManager(validated);
      return validated;
    } catch (error) {
      if (error instanceof Error) {
        throw new ConfigurationError("Failed to load configuration", { cause: error });
      }
      throw error;
    }
  }
  /**
   * Get current configuration
   */
  static get() {
    if (!_ConfigManager.instance) {
      throw new ConfigurationError(
        "Configuration not initialized. Call ConfigManager.load() first"
      );
    }
    return _ConfigManager.instance.config;
  }
  /**
   * Merge two configuration objects
   */
  static mergeConfig(base, override) {
    const result = {};
    if (base.server ?? override.server) {
      result.server = { ...base.server, ...override.server };
    }
    if (base.codex ?? override.codex) {
      result.codex = { ...base.codex, ...override.codex };
    }
    if (base.gemini ?? override.gemini) {
      result.gemini = { ...base.gemini, ...override.gemini };
    }
    if (base.analysis ?? override.analysis) {
      result.analysis = {
        ...base.analysis,
        ...override.analysis,
        deduplication: {
          ...base.analysis?.deduplication,
          ...override.analysis?.deduplication
        }
      };
    }
    if (base.retry ?? override.retry) {
      result.retry = { ...base.retry, ...override.retry };
    }
    if (base.logging ?? override.logging) {
      result.logging = {
        ...base.logging,
        ...override.logging,
        file: {
          ...base.logging?.file,
          ...override.logging?.file
        }
      };
    }
    if (base.cache ?? override.cache) {
      result.cache = { ...base.cache, ...override.cache };
    }
    if (base.secretScanning ?? override.secretScanning) {
      result.secretScanning = {
        ...base.secretScanning,
        ...override.secretScanning,
        patterns: {
          ...base.secretScanning?.patterns,
          ...override.secretScanning?.patterns
        }
      };
    }
    if (base.context ?? override.context) {
      result.context = {
        ...base.context,
        ...override.context,
        defaults: {
          ...base.context?.defaults,
          ...override.context?.defaults
        },
        presets: {
          ...base.context?.presets,
          ...override.context?.presets
        }
      };
    }
    if (base.prompts ?? override.prompts) {
      result.prompts = {
        ...base.prompts,
        ...override.prompts,
        serviceTemplates: {
          ...base.prompts?.serviceTemplates,
          ...override.prompts?.serviceTemplates
        }
      };
    }
    if (base.warnings ?? override.warnings) {
      result.warnings = {
        ...base.warnings,
        ...override.warnings
      };
    }
    return result;
  }
  /**
   * Apply environment variable overrides
   */
  static applyEnvironmentOverrides(config) {
    const env = process.env;
    const result = { ...config };
    if (env.CODE_REVIEW_MCP_LOG_LEVEL && result.server) {
      result.server.logLevel = env.CODE_REVIEW_MCP_LOG_LEVEL;
      if (result.logging) {
        result.logging.level = env.CODE_REVIEW_MCP_LOG_LEVEL;
      }
    }
    if (result.codex) {
      if (env.CODEX_ENABLED !== void 0) {
        result.codex.enabled = env.CODEX_ENABLED === "true";
      }
      if (env.CODEX_CLI_PATH) {
        result.codex.cliPath = env.CODEX_CLI_PATH;
      }
      if (env.CODEX_TIMEOUT) {
        result.codex.timeout = parseInt(env.CODEX_TIMEOUT, 10);
      }
      if (env.CODEX_RETRY_ATTEMPTS) {
        result.codex.retryAttempts = parseInt(env.CODEX_RETRY_ATTEMPTS, 10);
      }
      if (env.CODEX_MODEL) {
        result.codex.model = env.CODEX_MODEL;
      }
      if (env.CODEX_SEARCH !== void 0) {
        result.codex.search = env.CODEX_SEARCH === "true";
      }
      if (env.CODEX_REASONING_EFFORT) {
        const validEfforts = ["minimal", "low", "medium", "high", "xhigh"];
        if (validEfforts.includes(env.CODEX_REASONING_EFFORT)) {
          result.codex.reasoningEffort = env.CODEX_REASONING_EFFORT;
        }
      }
    }
    if (result.gemini) {
      if (env.GEMINI_ENABLED !== void 0) {
        result.gemini.enabled = env.GEMINI_ENABLED === "true";
      }
      if (env.GEMINI_CLI_PATH) {
        result.gemini.cliPath = env.GEMINI_CLI_PATH;
      }
      if (env.GEMINI_TIMEOUT) {
        result.gemini.timeout = parseInt(env.GEMINI_TIMEOUT, 10);
      }
      if (env.GEMINI_MODEL) {
        result.gemini.model = env.GEMINI_MODEL;
      }
    }
    if (result.analysis) {
      if (env.ANALYSIS_MAX_CODE_LENGTH) {
        result.analysis.maxCodeLength = parseInt(env.ANALYSIS_MAX_CODE_LENGTH, 10);
      }
      if (env.ANALYSIS_INCLUDE_CONTEXT !== void 0) {
        result.analysis.includeContext = env.ANALYSIS_INCLUDE_CONTEXT === "true";
      }
    }
    if (result.context) {
      if (env.CONTEXT_AUTO_DETECT !== void 0) {
        result.context.autoDetect = env.CONTEXT_AUTO_DETECT === "true";
      }
      if (env.CONTEXT_ACTIVE_PRESET) {
        result.context.activePreset = env.CONTEXT_ACTIVE_PRESET;
      }
    }
    if (result.warnings) {
      if (env.WARNINGS_ENABLED !== void 0) {
        result.warnings.enabled = env.WARNINGS_ENABLED === "true";
      }
      if (env.WARNINGS_SHOW_TIPS !== void 0) {
        result.warnings.showTips = env.WARNINGS_SHOW_TIPS === "true";
      }
    }
    if (result.logging) {
      if (env.LOG_LEVEL) {
        result.logging.level = env.LOG_LEVEL;
      }
      if (env.LOG_PRETTY !== void 0) {
        result.logging.pretty = env.LOG_PRETTY === "true";
      }
    }
    if (result.cache && env.ENABLE_CACHE !== void 0) {
      result.cache.enabled = env.ENABLE_CACHE === "true";
    }
    return result;
  }
  /**
   * Update configuration at runtime (for testing)
   */
  static update(updates) {
    if (!_ConfigManager.instance) {
      throw new ConfigurationError("Configuration not initialized");
    }
    const merged = this.mergeConfig(_ConfigManager.instance.config, updates);
    const validated = ServerConfigSchema.parse(merged);
    _ConfigManager.instance.config = validated;
  }
  /**
   * Reset configuration (for testing)
   */
  static reset() {
    _ConfigManager.instance = null;
  }
};

// src/core/logger.ts
import pinoCore, {
  transport
} from "pino";
var SENSITIVE_KEYS = ["apiKey", "token", "secret", "password"];
var CODE_SNIPPET_KEYS = [
  "prompt",
  "code",
  "source",
  "snippet",
  "content",
  "response",
  "output",
  "stdout",
  "stderr"
];
var Logger = class _Logger {
  logger;
  constructor(config) {
    const options = {
      level: config.level,
      redact: {
        paths: SENSITIVE_KEYS,
        censor: "***REDACTED***"
      }
    };
    if (config.pretty) {
      const destination = transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      });
      this.logger = pinoCore(options, destination);
    } else {
      this.logger = pinoCore(options);
    }
  }
  static create(config) {
    return new _Logger(config);
  }
  debug(objOrMsg, msg) {
    if (typeof objOrMsg === "string") {
      this.logger.debug(objOrMsg);
    } else {
      this.logger.debug(this.sanitize(objOrMsg), msg);
    }
  }
  info(objOrMsg, msg) {
    if (typeof objOrMsg === "string") {
      this.logger.info(objOrMsg);
    } else {
      this.logger.info(this.sanitize(objOrMsg), msg);
    }
  }
  warn(objOrMsg, msg) {
    if (typeof objOrMsg === "string") {
      this.logger.warn(objOrMsg);
    } else {
      this.logger.warn(this.sanitize(objOrMsg), msg);
    }
  }
  error(objOrMsg, msg) {
    if (typeof objOrMsg === "string") {
      this.logger.error(objOrMsg);
    } else {
      this.logger.error(this.sanitize(objOrMsg), msg);
    }
  }
  /**
   * Sanitize sensitive data from logs
   */
  sanitize(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = "***REDACTED***";
      } else if (CODE_SNIPPET_KEYS.some((snippet) => key.toLowerCase().includes(snippet.toLowerCase()))) {
        if (typeof value === "string") {
          sanitized[key] = `<redacted ${value.length} characters>`;
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  /**
   * Log performance metrics
   */
  logPerformance(metric, duration, context) {
    this.logger.info(
      {
        metric,
        duration,
        ...this.sanitize(context ?? {})
      },
      "Performance metric"
    );
  }
  /**
   * Log security events
   */
  logSecurityEvent(event, details) {
    this.logger.warn(
      {
        event,
        ...this.sanitize(details ?? {})
      },
      "Security event"
    );
  }
  /**
   * Log errors with full context
   */
  logError(error, context) {
    this.logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ...this.sanitize(context ?? {})
      },
      "Error occurred"
    );
  }
  static wrap(logger) {
    const instance = Object.create(_Logger.prototype);
    instance.logger = logger;
    return instance;
  }
  /**
   * Get child logger with additional context
   */
  child(bindings) {
    const childLogger = this.logger.child(this.sanitize(bindings));
    return _Logger.wrap(childLogger);
  }
};

// src/core/utils.ts
import { v4 as uuidv4 } from "uuid";
function generateUUID() {
  return uuidv4();
}
function sanitizeParams(params) {
  const sanitized = { ...params };
  if ("code" in sanitized && typeof sanitized.code === "string") {
    const codeLength = sanitized.code.length;
    sanitized.code = `[${codeLength} characters]`;
  }
  if ("prompt" in sanitized && typeof sanitized.prompt === "string") {
    const promptLength = sanitized.prompt.length;
    sanitized.prompt = `[${promptLength} characters]`;
  }
  return sanitized;
}
function stripAnsiCodes(value) {
  if (!value.includes("\x1B[")) {
    return value;
  }
  let result = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 27 && value[i + 1] === "[") {
      i += 2;
      for (; i < value.length; i++) {
        const finalCode = value.charCodeAt(i);
        const isAlpha = finalCode >= 65 && finalCode <= 90 || finalCode >= 97 && finalCode <= 122;
        if (isAlpha) {
          break;
        }
      }
      continue;
    }
    result += value[i] ?? "";
  }
  return result;
}

// src/services/aggregator/merger.ts
var AnalysisAggregator = class {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }
  /**
   * Merge reviews from multiple sources
   */
  mergeAnalyses(reviews, options) {
    const startTime = Date.now();
    this.logger.info({ analysisCount: reviews.length }, "Merging reviews");
    const allFindings = reviews.flatMap(
      (review) => review.findings.map((finding) => ({
        ...finding,
        source: review.source
      }))
    );
    const deduplicated = this.config.deduplication?.enabled ? this.deduplicateFindings(allFindings, reviews.length) : allFindings.map((f) => ({
      ...f,
      sources: [f.source],
      confidence: "medium"
    }));
    const sorted = deduplicated.sort((a, b) => this.compareSeverity(a.severity, b.severity));
    const summary = this.calculateAggregatedSummary(sorted, reviews.length);
    const overallAssessment = this.generateOverallAssessment(reviews, sorted);
    const recommendations = this.mergeRecommendations(reviews);
    const duration = Date.now() - startTime;
    this.logger.info(
      { duration, totalFindings: sorted.length, consensus: summary.consensus },
      "Reviews merged"
    );
    const result = {
      success: true,
      analysisId: generateUUID(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "combined",
      summary,
      findings: sorted,
      overallAssessment,
      recommendations,
      metadata: {
        language: reviews[0]?.metadata.language,
        linesOfCode: reviews[0]?.metadata.linesOfCode ?? 0,
        analysisDuration: duration,
        codexDuration: reviews.find((r) => r.source === "codex")?.metadata.analysisDuration,
        geminiDuration: reviews.find((r) => r.source === "gemini")?.metadata.analysisDuration
      }
    };
    if (options?.includeIndividualAnalyses) {
      result.individualAnalyses = {
        codex: reviews.find((r) => r.source === "codex"),
        gemini: reviews.find((r) => r.source === "gemini")
      };
    }
    return result;
  }
  /**
   * Deduplicate findings by similarity matching
   * CRITICAL FIX #4: Pass total reviewers from reviews.length, not from findings
   */
  deduplicateFindings(findings, totalReviewers) {
    const threshold = this.config.deduplication?.similarityThreshold ?? 0.8;
    const deduplicated = [];
    const processed = /* @__PURE__ */ new Set();
    const lineBuckets = /* @__PURE__ */ new Map();
    const titleBuckets = /* @__PURE__ */ new Map();
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      if (!finding) continue;
      if (finding.line !== null) {
        const bucket = lineBuckets.get(finding.line) ?? [];
        bucket.push(i);
        lineBuckets.set(finding.line, bucket);
      }
      const titleKey = this.buildTitleKey(finding.title);
      if (titleKey) {
        const bucket = titleBuckets.get(titleKey) ?? [];
        bucket.push(i);
        titleBuckets.set(titleKey, bucket);
      }
    }
    for (let i = 0; i < findings.length; i++) {
      if (processed.has(i)) continue;
      const current = findings[i];
      if (!current) continue;
      const sources = [current.source];
      const similarIndices = [];
      const candidates = /* @__PURE__ */ new Set();
      if (current.line !== null) {
        for (const idx of lineBuckets.get(current.line) ?? []) {
          candidates.add(idx);
        }
      }
      const currentTitleKey = this.buildTitleKey(current.title);
      if (currentTitleKey) {
        for (const idx of titleBuckets.get(currentTitleKey) ?? []) {
          candidates.add(idx);
        }
      }
      const candidateList = candidates.size > 0 ? Array.from(candidates) : Array.from({ length: findings.length - i - 1 }, (_, idx) => i + 1 + idx);
      for (const j of candidateList) {
        if (j <= i || processed.has(j)) continue;
        const otherFinding = findings[j];
        if (!otherFinding) continue;
        const similarity = this.calculateSimilarity(current, otherFinding);
        if (similarity >= threshold) {
          sources.push(otherFinding.source);
          similarIndices.push(j);
        }
      }
      similarIndices.forEach((idx) => processed.add(idx));
      const confidence = this.determineConfidence(sources.length, totalReviewers);
      const allSimilar = [
        current,
        ...similarIndices.map((idx) => findings[idx]).filter((f) => f !== void 0)
      ];
      const highestSeverity = this.getHighestSeverity(allSimilar.map((f) => f.severity));
      deduplicated.push({
        type: current.type,
        severity: highestSeverity,
        line: current.line,
        lineRange: current.lineRange,
        title: current.title,
        description: current.description,
        suggestion: current.suggestion,
        code: current.code,
        sources: Array.from(new Set(sources)),
        confidence
      });
    }
    return deduplicated;
  }
  /**
   * Build a lightweight title key to bucket similar findings
   */
  buildTitleKey(title) {
    const tokens = title.toLowerCase().split(/\W+/).filter((token) => token.length >= 3);
    if (tokens.length === 0) return null;
    return tokens.slice(0, 4).join("|");
  }
  /**
   * Calculate similarity between two findings
   */
  calculateSimilarity(a, b) {
    const sameLine = a.line !== null && b.line !== null && a.line === b.line;
    if (sameLine) {
      if (a.type === b.type) return 1;
      return 0.7;
    }
    if (a.lineRange && b.lineRange) {
      const overlap = this.calculateLineRangeOverlap(a.lineRange, b.lineRange);
      if (overlap > 0.5 && a.type === b.type) {
        return 0.8;
      }
    }
    const titleSimilarity = this.textSimilarity(a.title, b.title);
    const descSimilarity = this.textSimilarity(a.description, b.description);
    return titleSimilarity * 0.6 + descSimilarity * 0.4;
  }
  /**
   * Calculate line range overlap percentage
   */
  calculateLineRangeOverlap(range1, range2) {
    const overlapStart = Math.max(range1.start, range2.start);
    const overlapEnd = Math.min(range1.end, range2.end);
    const overlapSize = Math.max(0, overlapEnd - overlapStart + 1);
    const range1Size = range1.end - range1.start + 1;
    const range2Size = range2.end - range2.start + 1;
    const minRangeSize = Math.min(range1Size, range2Size);
    return overlapSize / minRangeSize;
  }
  /**
   * Calculate text similarity using Jaccard similarity (token overlap)
   */
  textSimilarity(text1, text2) {
    const tokens1 = new Set(text1.toLowerCase().split(/\W+/).filter(Boolean));
    const tokens2 = new Set(text2.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = /* @__PURE__ */ new Set([...tokens1, ...tokens2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }
  /**
   * Determine confidence level based on reviewer agreement
   */
  determineConfidence(agreeCount, totalReviewers) {
    const agreement = agreeCount / totalReviewers;
    if (agreement >= 0.8) return "high";
    if (agreement >= 0.5) return "medium";
    return "low";
  }
  /**
   * Get highest severity from list
   */
  getHighestSeverity(severities) {
    const order = ["critical", "high", "medium", "low", "info"];
    for (const sev of order) {
      if (severities.includes(sev)) return sev;
    }
    return "info";
  }
  /**
   * Compare severities for sorting (higher severity first)
   */
  compareSeverity(a, b) {
    const order = ["critical", "high", "medium", "low", "info"];
    return order.indexOf(a) - order.indexOf(b);
  }
  /**
   * Calculate aggregated summary with consensus
   */
  calculateAggregatedSummary(findings, _reviewerCount) {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let highConfidence = 0;
    for (const finding of findings) {
      if (finding.severity === "critical") critical++;
      else if (finding.severity === "high") high++;
      else if (finding.severity === "medium") medium++;
      else if (finding.severity === "low") low++;
      if (finding.confidence === "high") highConfidence++;
    }
    const totalFindings = findings.length;
    const consensus = totalFindings > 0 ? Math.round(highConfidence / totalFindings * 100) : 100;
    return {
      totalFindings,
      critical,
      high,
      medium,
      low,
      consensus
    };
  }
  /**
   * Generate overall assessment from multiple reviews
   */
  generateOverallAssessment(reviews, findings) {
    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    let combined = `Combined review from ${reviews.length} reviewer(s): `;
    if (critical > 0) {
      combined += `Found ${critical} critical issue${critical > 1 ? "s" : ""} that require immediate attention. `;
    }
    if (high > 0) {
      combined += `Found ${high} high-severity issue${high > 1 ? "s" : ""} that should be addressed. `;
    }
    if (critical === 0 && high === 0) {
      combined += `Code quality is good with only minor issues identified. `;
    }
    const highConfidence = findings.filter((f) => f.confidence === "high").length;
    if (highConfidence > findings.length * 0.5) {
      combined += `Reviewers show strong agreement on most findings.`;
    }
    return combined;
  }
  /**
   * Merge recommendations from multiple reviews
   */
  mergeRecommendations(reviews) {
    const allRecommendations = reviews.flatMap((r) => r.recommendations ?? []).filter(Boolean);
    if (allRecommendations.length === 0) {
      return [];
    }
    const unique = [];
    const processed = /* @__PURE__ */ new Set();
    for (let i = 0; i < allRecommendations.length; i++) {
      if (processed.has(i)) continue;
      const current = allRecommendations[i];
      if (!current) continue;
      let isDuplicate = false;
      for (let j = 0; j < unique.length; j++) {
        const uniqueItem = unique[j];
        if (uniqueItem && this.textSimilarity(current, uniqueItem) > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        unique.push(current);
      }
      processed.add(i);
    }
    return unique;
  }
};

// src/services/cache/cache-key.ts
import { createHash } from "crypto";
function generateCacheKey(params) {
  const normalized = {
    prompt: params.prompt,
    source: params.source,
    context: normalizeContext(params.context),
    options: normalizeOptions(params.options),
    service: normalizeService(params.service)
  };
  const json = JSON.stringify(normalized);
  return createHash("sha256").update(json).digest("hex");
}
function generateShortCacheKey(params) {
  return generateCacheKey(params).substring(0, 16);
}
function normalizeContext(context) {
  if (!context) return null;
  return {
    language: context.language?.toLowerCase() ?? null,
    framework: context.framework?.toLowerCase() ?? null,
    platform: context.platform?.toLowerCase() ?? null,
    projectType: context.projectType?.toLowerCase() ?? null,
    threatModel: context.threatModel?.toLowerCase() ?? null,
    focus: context.focus?.slice().sort() ?? null,
    scope: context.scope?.toLowerCase() ?? null
  };
}
function normalizeOptions(options) {
  if (!options) return null;
  return {
    severity: options.severity?.toLowerCase() ?? null,
    preset: options.preset?.toLowerCase() ?? null,
    template: options.template?.toLowerCase() ?? null,
    autoDetect: options.autoDetect ?? null,
    warnOnMissingContext: options.warnOnMissingContext ?? null
  };
}
function normalizeService(service) {
  if (!service) return null;
  return {
    model: service.model ?? null,
    reasoningEffort: service.reasoningEffort?.toLowerCase() ?? null,
    search: service.search ?? null,
    args: service.args ?? null,
    template: service.template?.toLowerCase() ?? null,
    version: service.version ?? null
  };
}

// src/services/cache/cache.service.ts
var CacheService = class {
  repository;
  config;
  logger;
  stats;
  constructor(repository, config, logger) {
    this.repository = repository;
    this.config = config;
    this.logger = logger ?? null;
    this.stats = { hits: 0, misses: 0 };
  }
  /**
   * Check if caching is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }
  /**
   * Get cached result or execute function and cache result
   */
  async getOrSet(params, fn, ttl) {
    if (!this.config.enabled) {
      const result2 = await fn();
      return { result: result2, fromCache: false };
    }
    const cacheKey = generateCacheKey(params);
    const cached = this.repository.getResult(cacheKey);
    if (cached !== null) {
      this.stats.hits++;
      this.logger?.debug({ cacheKey: cacheKey.substring(0, 16), source: params.source }, "Cache hit");
      return { result: cached, fromCache: true };
    }
    this.stats.misses++;
    this.logger?.debug({ cacheKey: cacheKey.substring(0, 16), source: params.source }, "Cache miss");
    const result = await fn();
    try {
      this.repository.set(cacheKey, params.source, result, ttl ?? this.config.ttl);
    } catch (error) {
      this.logger?.warn(
        { cacheKey: cacheKey.substring(0, 16), error: error instanceof Error ? error.message : String(error) },
        "Failed to write to cache (best-effort)"
      );
    }
    return { result, fromCache: false };
  }
  /**
   * Get cached result by key
   */
  get(params) {
    if (!this.config.enabled) return null;
    const cacheKey = generateCacheKey(params);
    return this.repository.getResult(cacheKey);
  }
  /**
   * Set cache entry
   */
  set(params, result, ttl) {
    if (!this.config.enabled) return;
    const cacheKey = generateCacheKey(params);
    this.repository.set(cacheKey, params.source, result, ttl ?? this.config.ttl);
  }
  /**
   * Check if entry exists in cache
   */
  has(params) {
    if (!this.config.enabled) return false;
    const cacheKey = generateCacheKey(params);
    return this.repository.has(cacheKey);
  }
  /**
   * Invalidate cache entry
   */
  invalidate(params) {
    if (!this.config.enabled) return false;
    const cacheKey = generateCacheKey(params);
    return this.repository.delete(cacheKey);
  }
  /**
   * Invalidate all entries for a source
   */
  invalidateBySource(source) {
    if (!this.config.enabled) return 0;
    return this.repository.clearBySource(source);
  }
  /**
   * Clear all cache entries
   */
  clear() {
    if (!this.config.enabled) return 0;
    this.stats = { hits: 0, misses: 0 };
    return this.repository.clear();
  }
  /**
   * Clean up expired entries
   */
  cleanup() {
    if (!this.config.enabled) return 0;
    return this.repository.deleteExpired();
  }
  /**
   * Get cache statistics
   */
  getStats() {
    const repoStats = this.repository.getStats();
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      totalEntries: repoStats.totalEntries,
      bySource: repoStats.bySource
    };
  }
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0 };
  }
  /**
   * Get cache size
   */
  size() {
    return this.repository.size();
  }
};

// src/services/codex/client.ts
import { mkdir, readFile as readFile2, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join as join3, resolve as resolve2 } from "path";
import { execa as execa2 } from "execa";
import { z as z6 } from "zod";

// src/core/auto-detect.ts
import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import { extname, join } from "path";
var EXTENSION_LANGUAGE_MAP = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".scala": "scala",
  ".r": "r",
  ".R": "r",
  ".lua": "lua",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".ps1": "powershell",
  ".sql": "sql",
  ".vue": "vue",
  ".svelte": "svelte"
};
var FRAMEWORK_DETECTION_MAP = {
  react: "react",
  "react-dom": "react",
  vue: "vue",
  "@vue/core": "vue",
  angular: "angular",
  "@angular/core": "angular",
  svelte: "svelte",
  next: "nextjs",
  nuxt: "nuxt",
  gatsby: "gatsby",
  express: "express",
  fastify: "fastify",
  koa: "koa",
  hapi: "hapi",
  nestjs: "nestjs",
  "@nestjs/core": "nestjs",
  electron: "electron",
  "react-native": "react-native",
  expo: "expo",
  django: "django",
  flask: "flask",
  fastapi: "fastapi",
  spring: "spring",
  "spring-boot": "spring-boot"
};
var ContextAutoDetector = class {
  constructor(logger) {
    this.logger = logger;
  }
  packageJsonCache = /* @__PURE__ */ new Map();
  /**
   * Detect context from various sources
   */
  async detect(options) {
    const result = {
      context: {},
      confidence: {},
      sources: []
    };
    try {
      result.context.platform = this.detectPlatform();
      result.confidence.platform = 1;
      result.sources.push("runtime");
      if (options.fileName) {
        const langFromExt = this.detectLanguageFromExtension(options.fileName);
        if (langFromExt) {
          result.context.language = langFromExt;
          result.confidence.language = 0.9;
          result.sources.push("file-extension");
        }
      }
      if (options.workingDirectory) {
        const pkgInfo = await this.detectFromPackageJson(options.workingDirectory);
        if (pkgInfo) {
          const pkgLangConfidence = pkgInfo.confidence.language ?? 0;
          if (!result.context.language || pkgLangConfidence > (result.confidence.language ?? 0)) {
            if (pkgInfo.context.language) {
              result.context.language = pkgInfo.context.language;
              result.confidence.language = pkgLangConfidence;
            }
          }
          if (pkgInfo.context.framework) {
            result.context.framework = pkgInfo.context.framework;
            result.confidence.framework = pkgInfo.confidence.framework ?? 0;
          }
          result.sources.push("package.json");
        }
      }
      if (options.code) {
        const scope = this.detectScope(options.code);
        result.context.scope = scope;
        result.confidence.scope = 0.7;
        result.sources.push("code-analysis");
      }
      this.logger.debug({ result }, "Auto-detected context");
    } catch (error) {
      this.logger.warn({ error }, "Error during context auto-detection");
    }
    return result;
  }
  /**
   * Detect platform from Node.js runtime
   */
  detectPlatform() {
    switch (process.platform) {
      case "win32":
        return "windows";
      case "darwin":
      case "linux":
      case "freebsd":
      case "openbsd":
        return "unix";
      default:
        return "cross-platform";
    }
  }
  /**
   * Detect language from file extension
   */
  detectLanguageFromExtension(fileName) {
    const ext = extname(fileName).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] ?? null;
  }
  /**
   * Detect language and framework from package.json
   */
  async detectFromPackageJson(dir) {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) {
      return null;
    }
    try {
      const stats = await stat(pkgPath);
      const cached = this.packageJsonCache.get(pkgPath);
      if (cached && cached.mtimeMs === stats.mtimeMs) {
        return cached.result;
      }
      const content = await readFile(pkgPath, "utf-8");
      const parsed = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null) {
        this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result: null });
        return null;
      }
      const pkg = parsed;
      const context = {};
      const confidence = {};
      context.language = "javascript";
      confidence.language = 0.8;
      const dependencies = typeof pkg.dependencies === "object" && pkg.dependencies !== null ? pkg.dependencies : {};
      const devDependencies = typeof pkg.devDependencies === "object" && pkg.devDependencies !== null ? pkg.devDependencies : {};
      const allDeps = {
        ...dependencies,
        ...devDependencies
      };
      if (typeof allDeps.typescript === "string") {
        context.language = "typescript";
        confidence.language = 0.95;
      }
      for (const [dep, framework] of Object.entries(FRAMEWORK_DETECTION_MAP)) {
        if (typeof allDeps[dep] === "string") {
          context.framework = framework;
          confidence.framework = 0.9;
          break;
        }
      }
      const result = { context, confidence };
      this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result });
      return result;
    } catch (error) {
      this.logger.debug({ error, pkgPath }, "Failed to read package.json");
      try {
        const stats = await stat(pkgPath);
        this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result: null });
      } catch {
      }
      return null;
    }
  }
  /**
   * Detect code scope (completeness) from code structure
   */
  detectScope(code) {
    const trimmedCode = code.trim();
    const lineCount = trimmedCode.split("\n").length;
    const hasImports = /^import\s/m.test(trimmedCode);
    const hasRequire = /^(const|let|var)\s+.*=\s*require\(/m.test(trimmedCode);
    const hasExports = /^export\s/m.test(trimmedCode);
    const hasModuleExports = /module\.exports\s*=/m.test(trimmedCode);
    const hasMainFunction = /^(async\s+)?function\s+main|^const\s+main\s*=|^async\s+function\s*\(/m.test(trimmedCode);
    const hasClassDefinition = /^(export\s+)?(class|interface|type|enum)\s+\w+/m.test(trimmedCode);
    if (hasExports || hasModuleExports || hasMainFunction || hasClassDefinition) {
      return "full";
    }
    if ((hasImports || hasRequire) && lineCount > 10) {
      return "partial";
    }
    if (lineCount < 10) {
      return "snippet";
    }
    return "partial";
  }
  /**
   * Detect language from code content (heuristic)
   */
  detectLanguageFromCode(code) {
    if (/:\s*(string|number|boolean|any|void|never)\b/.test(code)) {
      return "typescript";
    }
    if (/interface\s+\w+\s*\{/.test(code)) {
      return "typescript";
    }
    if (/<\w+>/.test(code) && /:\s*\w+/.test(code)) {
      return "typescript";
    }
    if (/^def\s+\w+\s*\(/.test(code) || /^class\s+\w+.*:/.test(code)) {
      return "python";
    }
    if (/^\s*import\s+\w+$/.test(code) || /^from\s+\w+\s+import/.test(code)) {
      return "python";
    }
    if (/^package\s+\w+/.test(code) || /^func\s+\w+\s*\(/.test(code)) {
      return "go";
    }
    if (/^fn\s+\w+\s*\(/.test(code) || /^use\s+\w+::/.test(code)) {
      return "rust";
    }
    if (/^public\s+(class|interface|enum)\s+\w+/.test(code)) {
      return "java";
    }
    if (/^import\s+/.test(code) || /^export\s+/.test(code)) {
      return "javascript";
    }
    return null;
  }
};

// src/core/cli-detector.ts
import { existsSync as existsSync2 } from "fs";
import { homedir } from "os";
import { resolve, join as join2 } from "path";
import { execa } from "execa";
function getDefaultCLIPaths(cliName) {
  const platform = process.platform;
  const paths = [];
  if (platform === "win32") {
    const appData = process.env.APPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    if (appData) {
      paths.push(join2(appData, "npm", `${cliName}.cmd`));
    }
    if (programFiles) {
      paths.push(join2(programFiles, cliName, `${cliName}.exe`));
      if (cliName === "gemini") {
        paths.push(join2(programFiles, "Google", "Gemini", "gemini.exe"));
      }
    }
    if (programFilesX86) {
      paths.push(join2(programFilesX86, cliName, `${cliName}.exe`));
    }
    paths.push(`C:\\Program Files\\${cliName}\\${cliName}.exe`);
    if (cliName === "gemini") {
      paths.push("C:\\Program Files\\Google\\Gemini\\gemini.exe");
    }
  } else {
    paths.push(`/usr/local/bin/${cliName}`);
    paths.push(`/usr/bin/${cliName}`);
    paths.push(`/opt/${cliName}/bin/${cliName}`);
    paths.push(resolve(homedir(), `.local/bin/${cliName}`));
    if (platform === "darwin") {
      paths.push(`/opt/homebrew/bin/${cliName}`);
      paths.push(`/usr/local/opt/${cliName}/bin/${cliName}`);
    }
  }
  return paths;
}
function checkPathExists(path2) {
  try {
    return existsSync2(path2);
  } catch {
    return false;
  }
}
async function findInPath(command) {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = await execa(cmd, [command], {
      shell: false,
      timeout: 5e3,
      reject: false
      // Don't throw on non-zero exit
    });
    if (result.exitCode === 0 && result.stdout) {
      const lines = result.stdout.split("\n");
      return lines[0]?.trim() ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
function isConfigPathSafe(cliPath, cliName) {
  if (cliPath === cliName || cliPath === `${cliName}.cmd`) {
    return true;
  }
  const safePrefixes = [
    "/usr/local/bin/",
    "/usr/bin/",
    "/opt/",
    "/home/",
    "C:\\Program Files\\",
    "C:\\Program Files (x86)\\"
  ];
  return safePrefixes.some((prefix) => cliPath.startsWith(prefix));
}
async function detectCodexCLIPath(configPath, logger) {
  const cliName = "codex";
  const envPath = process.env.CODEX_CLI_PATH;
  if (envPath) {
    logger?.debug({ path: envPath, source: "env" }, "Codex CLI path from environment");
    return {
      path: envPath,
      source: "env",
      exists: checkPathExists(envPath)
    };
  }
  if (configPath && configPath !== "auto") {
    if (isConfigPathSafe(configPath, cliName)) {
      logger?.debug({ path: configPath, source: "config" }, "Codex CLI path from config");
      return {
        path: configPath,
        source: "config",
        exists: checkPathExists(configPath)
      };
    } else {
      logger?.warn(
        { path: configPath },
        "Config CLI path rejected for security reasons, falling back to auto-detection"
      );
    }
  }
  const defaultPaths = getDefaultCLIPaths(cliName);
  for (const path2 of defaultPaths) {
    if (checkPathExists(path2)) {
      logger?.info(
        { path: path2, source: "detected", platform: process.platform },
        "Codex CLI path detected"
      );
      return {
        path: path2,
        source: "detected",
        exists: true
      };
    }
  }
  const pathResult = await findInPath(cliName);
  if (pathResult) {
    logger?.info({ path: pathResult, source: "which" }, "Codex CLI found in PATH");
    return {
      path: pathResult,
      source: "which",
      exists: true,
      resolvedPath: pathResult
    };
  }
  const fallback = process.platform === "win32" ? "codex.cmd" : "codex";
  logger?.warn(
    { path: fallback, source: "default" },
    "Codex CLI not found, using default command (will fail if not in PATH)"
  );
  return {
    path: fallback,
    source: "default",
    exists: false
  };
}
async function detectGeminiCLIPath(configPath, logger) {
  const cliName = "gemini";
  const envPath = process.env.GEMINI_CLI_PATH;
  if (envPath) {
    logger?.debug({ path: envPath, source: "env" }, "Gemini CLI path from environment");
    return {
      path: envPath,
      source: "env",
      exists: checkPathExists(envPath)
    };
  }
  if (configPath && configPath !== "auto") {
    if (isConfigPathSafe(configPath, cliName)) {
      logger?.debug({ path: configPath, source: "config" }, "Gemini CLI path from config");
      return {
        path: configPath,
        source: "config",
        exists: checkPathExists(configPath)
      };
    } else {
      logger?.warn(
        { path: configPath },
        "Config CLI path rejected for security reasons, falling back to auto-detection"
      );
    }
  }
  const defaultPaths = getDefaultCLIPaths(cliName);
  for (const path2 of defaultPaths) {
    if (checkPathExists(path2)) {
      logger?.info(
        { path: path2, source: "detected", platform: process.platform },
        "Gemini CLI path detected"
      );
      return {
        path: path2,
        source: "detected",
        exists: true
      };
    }
  }
  const pathResult = await findInPath(cliName);
  if (pathResult) {
    logger?.info({ path: pathResult, source: "which" }, "Gemini CLI found in PATH");
    return {
      path: pathResult,
      source: "which",
      exists: true,
      resolvedPath: pathResult
    };
  }
  const fallback = process.platform === "win32" ? "gemini.cmd" : "gemini";
  logger?.warn(
    { path: fallback, source: "default" },
    "Gemini CLI not found, using default command (will fail if not in PATH)"
  );
  return {
    path: fallback,
    source: "default",
    exists: false
  };
}

// src/core/context-manager.ts
var ContextManager = class {
  defaults;
  presets;
  activePreset;
  constructor(config) {
    this.defaults = config.defaults ?? {};
    this.presets = new Map(Object.entries(config.presets ?? {}));
    this.activePreset = config.activePreset ?? null;
  }
  /**
   * Resolve final context by merging all sources
   * Priority: defaults -> activePreset -> detectedContext -> requestContext
   */
  resolve(requestContext, detectedContext) {
    let result = { ...this.defaults };
    if (this.activePreset && this.presets.has(this.activePreset)) {
      result = this.merge(result, this.presets.get(this.activePreset));
    }
    if (detectedContext) {
      result = this.merge(result, detectedContext);
    }
    if (requestContext) {
      if (requestContext.preset && this.presets.has(requestContext.preset)) {
        result = this.merge(result, this.presets.get(requestContext.preset));
      }
      result = this.merge(result, requestContext);
    }
    return result;
  }
  /**
   * Merge two contexts (shallow merge, undefined values ignored)
   */
  merge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (value !== void 0 && value !== null && key !== "preset") {
        result[key] = value;
      }
    }
    if (base.custom ?? override.custom) {
      result.custom = {
        ...base.custom,
        ...override.custom
      };
    }
    return result;
  }
  /**
   * Get list of available preset names
   */
  listPresets() {
    return Array.from(this.presets.keys());
  }
  /**
   * Get a specific preset by name
   */
  getPreset(name) {
    return this.presets.get(name);
  }
  /**
   * Add or update a preset at runtime
   */
  addPreset(name, context) {
    this.presets.set(name, context);
  }
  /**
   * Set the active preset
   */
  setActivePreset(name) {
    if (name && !this.presets.has(name)) {
      throw new Error(`Preset not found: ${name}`);
    }
    this.activePreset = name;
  }
  /**
   * Get current defaults
   */
  getDefaults() {
    return { ...this.defaults };
  }
  /**
   * Update defaults at runtime
   */
  updateDefaults(context) {
    this.defaults = this.merge(this.defaults, context);
  }
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

// src/core/retry.ts
var RetryManager = class {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }
  /**
   * Execute function with retry logic
   * CRITICAL FIX #9: Handle retryAttempts=0 (ensure at least one attempt)
   */
  async execute(fn, operation) {
    let lastError;
    let attempt = 1;
    const maxAttempts = Math.max(1, this.config.maxAttempts);
    while (attempt <= maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !ErrorHandler.isRetryable(error)) {
          break;
        }
        const delay = this.calculateBackoff(attempt);
        this.logger.warn(
          {
            attempt,
            maxAttempts,
            delay,
            operation,
            error: lastError.message
          },
          `Retrying ${operation}`
        );
        await this.sleep(delay);
        attempt++;
      }
    }
    throw lastError;
  }
  /**
   * Calculate exponential backoff delay
   */
  calculateBackoff(attempt) {
    const delay = this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve4) => setTimeout(resolve4, ms));
  }
};

// src/core/warnings.ts
var WARNING_DEFINITIONS = {
  MISSING_SCOPE: {
    code: "WARN_MISSING_SCOPE",
    severity: "info",
    message: "Code scope not specified. Treating as partial code.",
    tip: 'Set context.scope = "full" if analyzing complete files to avoid false positives like "unused import".'
  },
  MISSING_THREAT_MODEL: {
    code: "WARN_MISSING_THREAT_MODEL",
    severity: "warning",
    message: "Threat model not specified. Using conservative severity assessment.",
    tip: 'Set context.threatModel = "local-user-tool" for internal tools to get accurate severity ratings.'
  },
  MISSING_PLATFORM: {
    code: "WARN_MISSING_PLATFORM",
    severity: "info",
    message: "Platform not specified. Analyzing for cross-platform compatibility.",
    tip: 'Set context.platform = "windows" or "unix" for platform-specific code analysis.'
  },
  MISSING_LANGUAGE: {
    code: "WARN_MISSING_LANGUAGE",
    severity: "info",
    message: "Programming language not specified. Auto-detection may be less accurate.",
    tip: 'Set context.language = "typescript" (or appropriate language) for better analysis.'
  },
  PARTIAL_CODE_ANALYSIS: {
    code: "WARN_PARTIAL_CODE",
    severity: "info",
    message: "Analyzing partial code. Some findings may be false positives.",
    tip: "Import/export warnings may be incorrect for partial code snippets."
  }
};
function createWarning(def, field) {
  return {
    code: def.code,
    severity: def.severity,
    message: def.message,
    tip: def.tip,
    field
  };
}
var WarningSystem = class {
  suppressions;
  enabled;
  showTips;
  constructor(config) {
    this.enabled = config.enabled;
    this.showTips = config.showTips;
    this.suppressions = new Set(config.suppressions);
  }
  /**
   * Check context and generate appropriate warnings
   */
  checkContext(context) {
    if (!this.enabled) {
      return [];
    }
    const warnings = [];
    if (!context.scope && !this.isSuppressed("MISSING_SCOPE")) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_SCOPE, "scope"));
    }
    if (!context.threatModel && !this.isSuppressed("MISSING_THREAT_MODEL")) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_THREAT_MODEL, "threatModel"));
    }
    if (!context.platform && !this.isSuppressed("MISSING_PLATFORM")) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_PLATFORM, "platform"));
    }
    if (!context.language && !this.isSuppressed("MISSING_LANGUAGE")) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_LANGUAGE, "language"));
    }
    if (context.scope === "partial" && !this.isSuppressed("PARTIAL_CODE_ANALYSIS")) {
      warnings.push(createWarning(WARNING_DEFINITIONS.PARTIAL_CODE_ANALYSIS, "scope"));
    }
    return warnings;
  }
  /**
   * Check if a warning is suppressed
   */
  isSuppressed(warningKey) {
    const definition = WARNING_DEFINITIONS[warningKey];
    return this.suppressions.has(warningKey) || this.suppressions.has(definition.code);
  }
  /**
   * Format warnings as markdown string
   */
  formatWarnings(warnings) {
    if (warnings.length === 0) {
      return "";
    }
    const lines = ["## Warnings\n"];
    for (const warning of warnings) {
      const icon = warning.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
      lines.push(`> ${icon} **${warning.message}** (\`${warning.code}\`)`);
      if (this.showTips && warning.tip) {
        lines.push(`>`);
        lines.push(`> **Tip:** ${warning.tip}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  /**
   * Format warnings as JSON-friendly array
   */
  formatWarningsAsJson(warnings) {
    return warnings.map((w) => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
      tip: this.showTips ? w.tip : void 0,
      field: w.field
    }));
  }
  /**
   * Suppress a specific warning
   */
  suppress(warningCode) {
    this.suppressions.add(warningCode);
  }
  /**
   * Unsuppress a specific warning
   */
  unsuppress(warningCode) {
    this.suppressions.delete(warningCode);
  }
  /**
   * Check if warnings are enabled
   */
  isEnabled() {
    return this.enabled;
  }
  /**
   * Enable or disable warnings
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
};

// src/schemas/responses.ts
import { z as z5 } from "zod";

// src/schemas/tools.ts
import { z as z4 } from "zod";
var AnalysisFocusSchema = z4.enum(["security", "performance", "style", "bugs", "all"]);
var FindingTypeSchema = z4.enum(["bug", "security", "performance", "style", "suggestion"]);
var SeveritySchema = z4.enum(["critical", "high", "medium", "low", "info"]);
var AnalysisFindingSchema = z4.object({
  type: FindingTypeSchema,
  severity: SeveritySchema,
  line: z4.number().nullable(),
  lineRange: z4.object({
    start: z4.number(),
    end: z4.number()
  }).optional(),
  title: z4.string(),
  description: z4.string(),
  suggestion: z4.string().optional(),
  code: z4.string().optional()
});
var AnalysisSummarySchema = z4.object({
  totalFindings: z4.number(),
  critical: z4.number(),
  high: z4.number(),
  medium: z4.number(),
  low: z4.number()
});
var ContextWarningSchema = z4.object({
  code: z4.string(),
  severity: z4.enum(["info", "warning"]),
  message: z4.string(),
  tip: z4.string().optional(),
  field: z4.string()
});
var ResolvedContextSchema = z4.object({
  threatModel: z4.string().optional(),
  platform: z4.string().optional(),
  projectType: z4.string().optional(),
  language: z4.string().optional(),
  framework: z4.string().optional(),
  scope: z4.string().optional(),
  fileName: z4.string().optional()
});
var AnalysisMetadataSchema = z4.object({
  language: z4.string().optional(),
  linesOfCode: z4.number().optional(),
  analysisDuration: z4.number(),
  fromCache: z4.boolean().optional(),
  cacheKey: z4.string().optional(),
  // Context-related metadata
  resolvedContext: ResolvedContextSchema.optional(),
  warnings: z4.array(ContextWarningSchema).optional(),
  templateUsed: z4.string().optional(),
  autoDetected: z4.boolean().optional()
});
var CodeAnalysisOptionsSchema = z4.object({
  timeout: z4.number({
    invalid_type_error: "Timeout must be a number (milliseconds)"
  }).min(0, {
    message: "Timeout must be 0 (unlimited) or a positive number in milliseconds"
  }).optional().describe("Execution timeout in milliseconds (0 = unlimited)"),
  severity: z4.enum(["all", "high", "medium"], {
    errorMap: () => ({
      message: "Severity must be one of: 'all' (all findings), 'high' (critical + high), or 'medium' (critical + high + medium)"
    })
  }).optional(),
  // defaults to 'all' in service
  cliPath: z4.string({
    invalid_type_error: "CLI path must be a string"
  }).min(1, {
    message: "CLI path cannot be empty if provided"
  }).optional().describe("Custom CLI executable path (must be whitelisted for security)"),
  // New context-related options
  template: z4.string().optional().describe("Prompt template ID to use (e.g., default, security-focused)"),
  preset: z4.string().optional().describe("Context preset name to apply (e.g., react-web, nodejs-api, mcp-server)"),
  autoDetect: z4.boolean().optional().describe("Enable auto-detection of language, framework, platform"),
  warnOnMissingContext: z4.boolean().optional().describe("Show warnings when important context is missing")
}).optional();
var createCodeAnalysisParamsSchema = (maxPromptLength = 1e5) => z4.object({
  prompt: z4.string({
    required_error: "Prompt is required",
    invalid_type_error: "Prompt must be a string"
  }).min(1, {
    message: "Prompt cannot be empty - please provide code or instructions to analyze"
  }).max(maxPromptLength, {
    message: `Prompt exceeds maximum length of ${maxPromptLength} characters. Consider splitting into smaller analyses or use a more concise prompt.`
  }).describe("Prompt for code analysis (can include code, instructions, context, etc.)"),
  // Analysis context for more accurate findings
  context: AnalysisContextSchema.optional().describe(
    "Analysis context (threatModel, platform, projectType, language, framework, scope) for more accurate findings"
  ),
  options: CodeAnalysisOptionsSchema
});
var CodeAnalysisParamsSchema = createCodeAnalysisParamsSchema(1e5);
var createCombinedAnalysisInputSchema = (maxPromptLength = 1e5) => z4.object({
  prompt: z4.string({
    required_error: "Prompt is required",
    invalid_type_error: "Prompt must be a string"
  }).min(1, {
    message: "Prompt cannot be empty - please provide code or instructions to analyze"
  }).max(maxPromptLength, {
    message: `Prompt exceeds maximum length of ${maxPromptLength} characters. Consider splitting into smaller analyses.`
  }).describe("Prompt for code analysis"),
  // Analysis context for more accurate findings
  context: AnalysisContextSchema.optional().describe(
    "Analysis context (threatModel, platform, projectType, language, framework, scope) for more accurate findings"
  ),
  options: z4.object({
    timeout: z4.number({
      invalid_type_error: "Timeout must be a number (milliseconds)"
    }).min(0, {
      message: "Timeout must be 0 (unlimited) or a positive number in milliseconds"
    }).optional().describe("Execution timeout in milliseconds (0 = unlimited)"),
    severity: z4.enum(["all", "high", "medium"], {
      errorMap: () => ({
        message: "Severity must be one of: 'all', 'high', or 'medium'"
      })
    }).optional(),
    // defaults to 'all' in service
    parallelExecution: z4.boolean({
      invalid_type_error: "parallelExecution must be a boolean (true or false)"
    }).optional().describe("Run Codex and Gemini analyses in parallel (true) or sequentially (false)"),
    includeIndividualAnalyses: z4.boolean({
      invalid_type_error: "includeIndividualAnalyses must be a boolean (true or false)"
    }).optional().describe(
      "Include individual analysis results from Codex and Gemini in the combined output"
    ),
    // New context-related options
    template: z4.string().optional().describe("Prompt template ID to use"),
    preset: z4.string().optional().describe("Context preset name to apply"),
    autoDetect: z4.boolean().optional().describe("Enable auto-detection of language, framework, platform"),
    warnOnMissingContext: z4.boolean().optional().describe("Show warnings when important context is missing")
  }).optional()
});
var CombinedAnalysisInputSchema = createCombinedAnalysisInputSchema(1e5);
var AnalysisResultSchema = z4.object({
  success: z4.boolean(),
  analysisId: z4.string(),
  timestamp: z4.string(),
  source: z4.enum(["codex", "gemini", "combined"]),
  summary: AnalysisSummarySchema,
  findings: z4.array(AnalysisFindingSchema),
  overallAssessment: z4.string(),
  recommendations: z4.array(z4.string()).optional(),
  metadata: AnalysisMetadataSchema,
  rawOutput: z4.string().optional()
});
var AggregatedFindingSchema = AnalysisFindingSchema.extend({
  sources: z4.array(z4.enum(["codex", "gemini"])),
  confidence: z4.enum(["high", "medium", "low"])
});
var AggregatedAnalysisSchema = z4.object({
  success: z4.boolean(),
  analysisId: z4.string(),
  timestamp: z4.string(),
  source: z4.literal("combined"),
  summary: AnalysisSummarySchema.extend({
    consensus: z4.number().min(0).max(100)
  }),
  findings: z4.array(AggregatedFindingSchema),
  overallAssessment: z4.string(),
  recommendations: z4.array(z4.string()).optional(),
  individualAnalyses: z4.object({
    codex: AnalysisResultSchema.optional(),
    gemini: AnalysisResultSchema.optional()
  }).optional(),
  metadata: AnalysisMetadataSchema.extend({
    codexDuration: z4.number().optional(),
    geminiDuration: z4.number().optional()
  })
});

// src/schemas/responses.ts
var CodexResponseSchema = z5.object({
  findings: z5.array(
    z5.object({
      type: FindingTypeSchema,
      severity: SeveritySchema,
      line: z5.number().nullable(),
      title: z5.string().min(1),
      description: z5.string().min(1),
      suggestion: z5.string().optional(),
      code: z5.string().optional()
    })
  ),
  overallAssessment: z5.string().min(1),
  recommendations: z5.array(z5.string()).optional()
});
var GeminiResponseSchema = z5.object({
  findings: z5.array(
    z5.object({
      type: FindingTypeSchema,
      severity: SeveritySchema,
      line: z5.number().nullable(),
      title: z5.string().min(1),
      description: z5.string().min(1),
      suggestion: z5.string().optional(),
      code: z5.string().optional()
    })
  ),
  overallAssessment: z5.string().min(1),
  recommendations: z5.array(z5.string()).optional()
});

// src/services/codex/client.ts
var CodexAnalysisService = class _CodexAnalysisService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.retryManager = new RetryManager(
      {
        maxAttempts: config.retryAttempts,
        initialDelay: config.retryDelay,
        maxDelay: 1e4,
        backoffFactor: 2
      },
      logger
    );
    const isConfigPathSafe2 = config.cliPath === "codex" || config.cliPath === "codex.cmd" || config.cliPath === "auto" || config.cliPath?.startsWith("/usr/local/bin/") || config.cliPath?.startsWith("/usr/bin/") || config.cliPath?.startsWith("/opt/codex/") || config.cliPath?.startsWith("/opt/homebrew/") || config.cliPath?.startsWith("C:\\Program Files\\codex\\") || config.cliPath?.startsWith("C:\\Program Files (x86)\\codex\\");
    const basePaths = [
      ...isConfigPathSafe2 ? [config.cliPath] : [],
      process.env.CODEX_CLI_PATH,
      // Environment variable
      "/usr/local/bin/codex",
      // Common install location (Unix)
      "/usr/bin/codex",
      // System bin (Unix)
      "/opt/codex/bin/codex",
      // Alternative install location (Unix)
      "/opt/homebrew/bin/codex",
      // Homebrew (macOS Apple Silicon)
      "C:\\Program Files\\codex\\codex.exe",
      // Windows
      "C:\\Program Files (x86)\\codex\\codex.exe",
      // Windows (x86)
      "codex",
      // System PATH
      "codex.cmd"
      // Windows system PATH
    ].filter(Boolean);
    if (process.platform === "win32" && process.env.APPDATA) {
      basePaths.push(resolve2(process.env.APPDATA, "npm", "codex.cmd"));
    }
    this.allowedCLIPaths = basePaths;
    this.logger.debug({ allowedPaths: this.allowedCLIPaths }, "Codex CLI allowed paths");
    if (config.cliPath === "auto") {
      this.initializeCLIPath().catch((error) => {
        this.logger.warn({ error }, "Failed to auto-detect Codex CLI path, will use default");
      });
    }
    this.contextManager = new ContextManager({
      defaults: config.context?.defaults,
      presets: config.context?.presets,
      activePreset: config.context?.activePreset,
      allowEnvOverride: config.context?.allowEnvOverride ?? true,
      autoDetect: config.context?.autoDetect ?? true
    });
    this.autoDetector = new ContextAutoDetector(logger);
    this.warningSystem = new WarningSystem({
      enabled: config.warnings?.enabled ?? true,
      showTips: config.warnings?.showTips ?? true,
      suppressions: config.warnings?.suppressions ?? []
    });
    this.templateEngine = new PromptTemplateEngine({
      templates: config.prompts?.templates,
      defaultTemplate: config.prompts?.defaultTemplate ?? "default",
      serviceTemplates: {
        codex: config.prompts?.serviceTemplates?.codex ?? "default",
        gemini: config.prompts?.serviceTemplates?.gemini
      }
    });
    this.logger.debug("Context system modules initialized for Codex service");
  }
  retryManager;
  allowedCLIPaths;
  detectedCLIPath = null;
  validatedCLIPaths = /* @__PURE__ */ new Set();
  // Maximum output size to parse (guard against unexpectedly large responses)
  static MAX_PARSE_SIZE = 1024 * 1024;
  // 1MB
  // Context system modules
  contextManager;
  autoDetector;
  warningSystem;
  templateEngine;
  /**
   * Initialize CLI path using auto-detection
   */
  async initializeCLIPath() {
    try {
      const result = await detectCodexCLIPath(this.config.cliPath, this.logger);
      this.detectedCLIPath = result.path;
      this.config.cliPath = result.path;
      if (!this.allowedCLIPaths.includes(result.path)) {
        this.allowedCLIPaths.push(result.path);
      }
      if (result.resolvedPath && !this.allowedCLIPaths.includes(result.resolvedPath)) {
        this.allowedCLIPaths.push(result.resolvedPath);
      }
      this.logger.info(
        {
          path: result.path,
          source: result.source,
          exists: result.exists,
          platform: process.platform
        },
        "Codex CLI path detected"
      );
    } catch (error) {
      this.logger.error({ error }, "Failed to detect Codex CLI path");
      throw error;
    }
  }
  /**
   * Perform code review using Codex CLI
   */
  async analyzeCode(params) {
    const startTime = Date.now();
    const analysisId = generateUUID();
    try {
      this.logger.info({ analysisId, params: sanitizeParams(params) }, "Starting Codex review");
      const validated = CodeAnalysisParamsSchema.parse(params);
      const timeout = this.config.timeout === 0 ? 0 : validated.options?.timeout ?? this.config.timeout;
      if (this.config.cliPath === "auto" && !this.detectedCLIPath) {
        await this.initializeCLIPath();
      }
      const cliPath = validated.options?.cliPath ?? this.config.cliPath;
      await this.validateCLIPath(cliPath);
      const enableAutoDetect = validated.options?.autoDetect ?? true;
      const enableWarnings = validated.options?.warnOnMissingContext ?? true;
      let detectedContext;
      if (enableAutoDetect) {
        const detection = await this.autoDetector.detect({
          code: validated.prompt,
          fileName: validated.context?.fileName,
          workingDirectory: process.cwd()
        });
        detectedContext = detection.context;
        this.logger.debug({ detectedContext, sources: detection.sources }, "Auto-detected context");
      }
      const contextWithPreset = {
        ...validated.context,
        preset: validated.options?.preset ?? validated.context?.preset
      };
      const resolvedContext = this.contextManager.resolve(contextWithPreset, detectedContext);
      this.logger.debug(
        { resolvedContext, preset: contextWithPreset.preset },
        "Resolved analysis context"
      );
      const warnings = enableWarnings ? this.warningSystem.checkContext(resolvedContext) : [];
      if (warnings.length > 0) {
        this.logger.debug({ warnings: warnings.map((w) => w.code) }, "Context warnings generated");
      }
      const templateId = validated.options?.template ?? this.templateEngine.getTemplateForService("codex");
      const prompt = this.templateEngine.render(templateId, {
        prompt: validated.prompt,
        context: resolvedContext,
        formatInstructions: DEFAULT_FORMAT_INSTRUCTIONS
      });
      this.logger.debug(
        { templateId, promptLength: prompt.length },
        "Prompt rendered from template"
      );
      const output = await this.retryManager.execute(
        () => this.executeCodexCLI(prompt, timeout, cliPath, analysisId),
        "Codex review"
      );
      const review = this.parseCodexOutput(output, analysisId);
      if (validated.options?.severity && validated.options.severity !== "all") {
        review.findings = this.filterFindingsBySeverity(
          review.findings,
          validated.options.severity
        );
        review.summary = this.calculateSummary(review.findings);
      }
      review.metadata.analysisDuration = Date.now() - startTime;
      review.metadata.resolvedContext = {
        threatModel: resolvedContext.threatModel,
        platform: resolvedContext.platform,
        projectType: resolvedContext.projectType,
        language: resolvedContext.language,
        framework: resolvedContext.framework,
        scope: resolvedContext.scope,
        fileName: resolvedContext.fileName
      };
      review.metadata.warnings = this.warningSystem.formatWarningsAsJson(warnings);
      review.metadata.templateUsed = templateId;
      review.metadata.autoDetected = enableAutoDetect;
      this.logger.info(
        {
          analysisId,
          duration: review.metadata.analysisDuration,
          findings: review.findings.length,
          warnings: warnings.length,
          context: resolvedContext.language ?? "unknown"
        },
        "Codex review completed"
      );
      return review;
    } catch (error) {
      this.logger.error({ analysisId, error }, "Codex review failed");
      if (error instanceof CodexAnalysisError) {
        throw error;
      }
      if (error instanceof SecurityError) {
        throw error;
      }
      if (error instanceof TimeoutError) {
        throw new CodexTimeoutError(error.message, analysisId, { cause: error });
      }
      if (error instanceof ParseError) {
        throw new CodexParseError(error.message, analysisId, { cause: error });
      }
      throw new CodexAnalysisError(
        error instanceof Error ? error.message : "Unknown error during Codex review",
        analysisId,
        { cause: error }
      );
    }
  }
  /**
   * Execute Codex CLI command securely
   * @param cliPath - Pre-validated CLI path (validation done before retry logic)
   */
  async executeCodexCLI(prompt, timeout, cliPath, analysisId) {
    const outputConfig = this.config.output;
    let outputMode = outputConfig?.mode ?? "jsonl";
    let lastMessagePath;
    if (outputMode === "last-message") {
      try {
        const baseDir = outputConfig?.lastMessageFileDir ?? tmpdir();
        await mkdir(baseDir, { recursive: true });
        lastMessagePath = join3(baseDir, `codex-last-message-${analysisId}.json`);
      } catch (error) {
        this.logger.warn(
          { analysisId, error },
          "Failed to prepare last-message output file, falling back to JSONL output"
        );
        outputMode = "jsonl";
      }
    }
    const cleanupPath = lastMessagePath;
    const runCodex = async (args) => {
      this.logger.debug({ cliPath, argsCount: args.length, timeout }, "Executing Codex CLI");
      return execa2(cliPath, ["e", ...args, "-"], {
        timeout: timeout === 0 ? void 0 : timeout,
        // 0 = unlimited (no timeout)
        reject: true,
        // Throw on ANY non-zero exit code
        input: prompt,
        // Send prompt via stdin
        env: {
          ...process.env,
          // Use model config if specified
          CODEX_MODEL: this.config.model ?? void 0
        },
        // Security: Don't use shell
        shell: false
      });
    };
    const readOutput = async (result, path2) => {
      if (path2) {
        try {
          const fileContents = await readFile2(path2, "utf8");
          if (fileContents.trim() !== "") {
            return fileContents;
          }
        } catch (error) {
          this.logger.debug(
            { analysisId, error },
            "Failed to read last-message output file, falling back to stdout"
          );
        }
      }
      const stdout = result.stdout ?? "";
      if (stdout.trim() !== "") {
        return stdout;
      }
      const stderr = result.stderr ?? "";
      return stderr !== "" ? stderr : "";
    };
    const buildArgs = (mode, path2) => this.buildCLIArgs({
      outputMode: mode,
      lastMessagePath: path2,
      outputSchemaPath: outputConfig?.outputSchemaPath
    });
    try {
      const args = buildArgs(outputMode, lastMessagePath);
      const result = await runCodex(args);
      return await readOutput(result, lastMessagePath);
    } catch (error) {
      const err = error;
      const combinedOutput = `${err.stderr ?? ""}
${err.stdout ?? ""}`.toLowerCase();
      const outputFlagMentioned = combinedOutput.includes("--output-last-message") || combinedOutput.includes("output-last-message");
      const unknownFlag = combinedOutput.includes("unknown") || combinedOutput.includes("unrecognized") || combinedOutput.includes("invalid") || combinedOutput.includes("unexpected");
      if (outputMode === "last-message" && outputFlagMentioned && unknownFlag) {
        this.logger.warn(
          { analysisId },
          "Codex CLI does not support output-last-message; retrying with JSONL output"
        );
        try {
          const fallbackArgs = buildArgs("jsonl");
          const fallbackResult = await runCodex(fallbackArgs);
          return await readOutput(fallbackResult);
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      const finalError = error;
      if (finalError.timedOut) {
        throw new TimeoutError(`Codex CLI timed out after ${timeout}ms`);
      }
      if (finalError.exitCode !== void 0 && finalError.exitCode !== 0) {
        throw new CLIExecutionError(`Codex CLI exited with code ${finalError.exitCode}`, {
          exitCode: finalError.exitCode,
          stderr: finalError.stderr,
          stdout: finalError.stdout
        });
      }
      throw new CLIExecutionError("Codex CLI execution failed", { cause: finalError });
    } finally {
      if (cleanupPath) {
        await unlink(cleanupPath).catch((error) => {
          this.logger.debug(
            { analysisId, error },
            "Failed to remove last-message output file"
          );
        });
      }
    }
  }
  /**
   * Validate CLI path against allowed paths
   * SECURITY: Prevents PATH manipulation attacks by resolving to absolute paths
   */
  async validateCLIPath(cliPath) {
    try {
      if (this.validatedCLIPaths.has(cliPath)) {
        return;
      }
      if (cliPath === "codex" || cliPath === "codex.cmd") {
        if (!this.allowedCLIPaths.includes(cliPath)) {
          this.logger.logSecurityEvent("System PATH executable not in whitelist", {
            cliPath,
            allowed: this.allowedCLIPaths
          });
          throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
        }
        if (process.platform !== "win32") {
          try {
            const { stdout } = await execa2("which", [cliPath], {
              shell: false,
              timeout: 5e3
            });
            const resolvedPath = stdout.trim();
            const resolvedAllowed = this.allowedCLIPaths.some((allowed) => {
              try {
                const resolvedAllowed2 = resolve2(allowed);
                return resolvedAllowed2 === resolvedPath || allowed === cliPath;
              } catch {
                return false;
              }
            });
            if (!resolvedAllowed) {
              this.logger.logSecurityEvent("System PATH resolved to non-whitelisted path", {
                cliPath,
                resolvedPath,
                allowed: this.allowedCLIPaths
              });
              throw new SecurityError(`Resolved CLI path not in allowed list: ${resolvedPath}`);
            }
          } catch (whichError) {
            if (whichError instanceof SecurityError) {
              throw whichError;
            }
            this.logger.debug(
              { cliPath, error: whichError },
              "Could not resolve PATH executable, but in whitelist"
            );
          }
        }
        this.validatedCLIPaths.add(cliPath);
        return;
      }
      const resolved = resolve2(cliPath);
      const isAllowed = this.allowedCLIPaths.some((allowed) => {
        try {
          if (allowed === "codex" || allowed === "codex.cmd") {
            return false;
          }
          return resolve2(allowed) === resolved;
        } catch {
          return false;
        }
      });
      if (!isAllowed) {
        this.logger.logSecurityEvent("Invalid CLI path attempted", {
          cliPath,
          resolved,
          allowed: this.allowedCLIPaths
        });
        throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
      }
      this.validatedCLIPaths.add(cliPath);
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError("Failed to validate CLI path");
    }
  }
  /**
   * Build CLI arguments
   */
  buildCLIArgs(options) {
    const args = [];
    if (this.config.model) {
      args.push("--model", this.config.model);
    }
    const reasoningEffort = this.config.reasoningEffort ?? "high";
    args.push("-c", `model_reasoning_effort=${reasoningEffort}`);
    const outputMode = options?.outputMode ?? this.config.output?.mode ?? "jsonl";
    if (outputMode === "jsonl") {
      args.push("--json");
    } else if (outputMode === "last-message" && options?.lastMessagePath) {
      args.push("--output-last-message", options.lastMessagePath);
      if (options.outputSchemaPath) {
        args.push("--output-schema", options.outputSchemaPath);
      }
    }
    args.push("--skip-git-repo-check");
    args.push("--sandbox", "read-only");
    if (this.config.args && this.config.args.length > 0) {
      const dangerousFlags = [
        "--sandbox",
        "--json",
        "--no-sandbox",
        "--skip-git-repo-check",
        "--output-last-message",
        "--output-schema"
      ];
      const safeArgs = this.config.args.filter((arg) => {
        const lowerArg = arg.toLowerCase();
        const isDangerous = dangerousFlags.some(
          (flag) => lowerArg === flag || lowerArg.startsWith(flag + "=")
        );
        const isSeparator = arg === "--";
        return !isDangerous && !isSeparator;
      });
      if (safeArgs.length !== this.config.args.length) {
        this.logger.warn(
          { filtered: this.config.args.length - safeArgs.length },
          "Some user-provided args were filtered out for security"
        );
      }
      args.push(...safeArgs);
    }
    return args;
  }
  /**
   * Parse Codex CLI output into structured format
   * SIMPLIFIED: Single-pass parsing with raw output preservation
   */
  parseCodexOutput(output, analysisId) {
    const isRecord = (value) => typeof value === "object" && value !== null;
    if (output.length > _CodexAnalysisService.MAX_PARSE_SIZE) {
      this.logger.warn(
        { analysisId, size: output.length },
        "Codex output exceeds maximum parse size"
      );
      return this.createRawOutputResult(
        analysisId,
        output.substring(0, 5e4),
        "codex",
        `Output exceeds maximum parse size of ${_CodexAnalysisService.MAX_PARSE_SIZE} bytes`
      );
    }
    const cleaned = this.cleanOutput(output);
    try {
      if (!cleaned) {
        return this.createRawOutputResult(analysisId, "", "codex", "Empty output");
      }
      let analysisJson = null;
      const trimmed = cleaned.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(cleaned);
          const directValidation = CodexResponseSchema.safeParse(parsed);
          if (directValidation.success) {
            analysisJson = directValidation.data;
          }
        } catch {
          analysisJson = null;
        }
      }
      if (!analysisJson) {
        const lines = cleaned.split("\n");
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const line = lines[i]?.trim();
          if (!line) {
            continue;
          }
          if (!line.includes("item.completed")) {
            continue;
          }
          try {
            const event = JSON.parse(line);
            if (isRecord(event) && event.type === "item.completed") {
              const item = event.item;
              if (isRecord(item) && item.type === "agent_message" && typeof item.text === "string") {
                analysisJson = JSON.parse(item.text);
                break;
              }
            }
          } catch (lineError) {
            this.logger.debug(
              { analysisId, line: line.substring(0, 100), error: lineError },
              "Skipping non-JSON line in Codex output"
            );
          }
        }
      }
      if (!analysisJson) {
        this.logger.warn(
          { analysisId, outputLength: cleaned.length },
          "Could not parse Codex output as JSON, returning raw"
        );
        return this.createRawOutputResult(analysisId, cleaned, "codex");
      }
      const validated = analysisJson && typeof analysisJson === "object" ? CodexResponseSchema.parse(analysisJson) : CodexResponseSchema.parse(analysisJson);
      const summary = this.calculateSummary(validated.findings);
      const result = {
        success: true,
        analysisId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        source: "codex",
        summary,
        findings: validated.findings,
        overallAssessment: validated.overallAssessment,
        recommendations: validated.recommendations,
        metadata: {
          analysisDuration: 0
        }
      };
      AnalysisResultSchema.parse(result);
      return result;
    } catch (error) {
      this.logger.error({ error, analysisId }, "Failed to parse Codex output");
      if (error instanceof z6.ZodError) {
        return this.createRawOutputResult(
          analysisId,
          cleaned,
          "codex",
          `Schema validation failed: ${error.message}`
        );
      }
      throw new ParseError("Failed to parse Codex output", { cause: error });
    }
  }
  /**
   * Create result with raw output when parsing fails
   */
  createRawOutputResult(analysisId, rawOutput, source, error) {
    return {
      success: false,
      analysisId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source,
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      findings: [],
      overallAssessment: error ?? "Failed to parse AI response",
      metadata: {
        analysisDuration: 0
      },
      rawOutput: rawOutput.substring(0, 5e4)
      // Limit size
    };
  }
  /**
   * Clean CLI output (remove ANSI codes, etc.)
   */
  cleanOutput(output) {
    let cleaned = stripAnsiCodes(output);
    cleaned = cleaned.replace(/\0/g, "");
    cleaned = cleaned.trim();
    return cleaned;
  }
  /**
   * Calculate summary statistics from findings
   */
  calculateSummary(findings) {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const finding of findings) {
      if (finding.severity === "critical") critical++;
      else if (finding.severity === "high") high++;
      else if (finding.severity === "medium") medium++;
      else if (finding.severity === "low") low++;
    }
    return {
      totalFindings: findings.length,
      critical,
      high,
      medium,
      low
    };
  }
  /**
   * Filter findings by severity
   */
  filterFindingsBySeverity(findings, severity) {
    if (severity === "high") {
      return findings.filter((f) => f.severity === "critical" || f.severity === "high");
    } else if (severity === "medium") {
      return findings.filter(
        (f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium"
      );
    }
    return findings;
  }
};

// src/services/gemini/client.ts
import { resolve as resolve3 } from "path";
import { execa as execa3 } from "execa";
import { z as z7 } from "zod";
var GeminiAnalysisService = class _GeminiAnalysisService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.retryManager = new RetryManager(
      {
        maxAttempts: config.retryAttempts,
        initialDelay: config.retryDelay,
        maxDelay: 1e4,
        backoffFactor: 2
      },
      logger
    );
    const isConfigPathSafe2 = config.cliPath === "gemini" || config.cliPath === "gemini.cmd" || config.cliPath === "auto" || config.cliPath?.startsWith("/usr/local/bin/") || config.cliPath?.startsWith("/usr/bin/") || config.cliPath?.startsWith("/opt/gemini/") || config.cliPath?.startsWith("/opt/homebrew/") || config.cliPath?.startsWith("C:\\Program Files\\gemini\\") || config.cliPath?.startsWith("C:\\Program Files (x86)\\gemini\\") || config.cliPath?.startsWith("C:\\Program Files\\Google\\");
    const basePaths = [
      ...isConfigPathSafe2 ? [config.cliPath] : [],
      process.env.GEMINI_CLI_PATH,
      // Environment variable
      "/usr/local/bin/gemini",
      // Common install location
      "/usr/bin/gemini",
      // System bin (Unix)
      "/opt/gemini/bin/gemini",
      // Alternative install location
      "/opt/homebrew/bin/gemini",
      // Homebrew (macOS Apple Silicon)
      "C:\\Program Files\\gemini\\gemini.exe",
      // Windows
      "C:\\Program Files (x86)\\gemini\\gemini.exe",
      // Windows (x86)
      "C:\\Program Files\\Google\\Gemini\\gemini.exe",
      // Windows Google dir
      "gemini",
      // System PATH
      "gemini.cmd"
      // Windows system PATH
    ].filter(Boolean);
    if (process.platform === "win32" && process.env.APPDATA) {
      basePaths.push(resolve3(process.env.APPDATA, "npm", "gemini.cmd"));
    }
    this.allowedCLIPaths = basePaths;
    this.logger.debug({ allowedPaths: this.allowedCLIPaths }, "Gemini CLI allowed paths");
    if (config.cliPath === "auto") {
      this.initializeCLIPath().catch((error) => {
        this.logger.warn({ error }, "Failed to auto-detect Gemini CLI path, will use default");
      });
    }
    this.contextManager = new ContextManager({
      defaults: config.context?.defaults,
      presets: config.context?.presets,
      activePreset: config.context?.activePreset,
      allowEnvOverride: config.context?.allowEnvOverride ?? true,
      autoDetect: config.context?.autoDetect ?? true
    });
    this.autoDetector = new ContextAutoDetector(logger);
    this.warningSystem = new WarningSystem({
      enabled: config.warnings?.enabled ?? true,
      showTips: config.warnings?.showTips ?? true,
      suppressions: config.warnings?.suppressions ?? []
    });
    this.templateEngine = new PromptTemplateEngine({
      templates: config.prompts?.templates,
      defaultTemplate: config.prompts?.defaultTemplate ?? "default",
      serviceTemplates: {
        codex: config.prompts?.serviceTemplates?.codex,
        gemini: config.prompts?.serviceTemplates?.gemini ?? "default"
      }
    });
    this.logger.debug("Context system modules initialized for Gemini service");
  }
  retryManager;
  allowedCLIPaths;
  detectedCLIPath = null;
  validatedCLIPaths = /* @__PURE__ */ new Set();
  // Context system modules
  contextManager;
  autoDetector;
  warningSystem;
  templateEngine;
  /**
   * Initialize CLI path using auto-detection
   */
  async initializeCLIPath() {
    try {
      const result = await detectGeminiCLIPath(this.config.cliPath, this.logger);
      this.detectedCLIPath = result.path;
      this.config.cliPath = result.path;
      if (!this.allowedCLIPaths.includes(result.path)) {
        this.allowedCLIPaths.push(result.path);
      }
      if (result.resolvedPath && !this.allowedCLIPaths.includes(result.resolvedPath)) {
        this.allowedCLIPaths.push(result.resolvedPath);
      }
      this.logger.info(
        {
          path: result.path,
          source: result.source,
          exists: result.exists,
          platform: process.platform
        },
        "Gemini CLI path detected"
      );
    } catch (error) {
      this.logger.error({ error }, "Failed to detect Gemini CLI path");
      throw error;
    }
  }
  /**
   * Perform code review using Gemini CLI
   * MAJOR FIX #6: Honor per-request timeout, severity, cliPath options
   */
  async analyzeCode(params) {
    const startTime = Date.now();
    const analysisId = generateUUID();
    try {
      this.logger.info({ analysisId, params: sanitizeParams(params) }, "Starting Gemini review");
      const validated = CodeAnalysisParamsSchema.parse(params);
      const timeout = this.config.timeout === 0 ? 0 : validated.options?.timeout ?? this.config.timeout;
      if (this.config.cliPath === "auto" && !this.detectedCLIPath) {
        await this.initializeCLIPath();
      }
      const cliPath = validated.options?.cliPath ?? this.config.cliPath;
      await this.validateCLIPath(cliPath);
      const enableAutoDetect = validated.options?.autoDetect ?? true;
      const enableWarnings = validated.options?.warnOnMissingContext ?? true;
      let detectedContext;
      if (enableAutoDetect) {
        const detection = await this.autoDetector.detect({
          code: validated.prompt,
          fileName: validated.context?.fileName,
          workingDirectory: process.cwd()
        });
        detectedContext = detection.context;
        this.logger.debug({ detectedContext, sources: detection.sources }, "Auto-detected context");
      }
      const contextWithPreset = {
        ...validated.context,
        preset: validated.options?.preset ?? validated.context?.preset
      };
      const resolvedContext = this.contextManager.resolve(contextWithPreset, detectedContext);
      this.logger.debug(
        { resolvedContext, preset: contextWithPreset.preset },
        "Resolved analysis context"
      );
      const warnings = enableWarnings ? this.warningSystem.checkContext(resolvedContext) : [];
      if (warnings.length > 0) {
        this.logger.debug({ warnings: warnings.map((w) => w.code) }, "Context warnings generated");
      }
      const templateId = validated.options?.template ?? this.templateEngine.getTemplateForService("gemini");
      const prompt = this.templateEngine.render(templateId, {
        prompt: validated.prompt,
        context: resolvedContext,
        formatInstructions: DEFAULT_FORMAT_INSTRUCTIONS
      });
      this.logger.debug(
        { templateId, promptLength: prompt.length },
        "Prompt rendered from template"
      );
      const output = await this.retryManager.execute(
        () => this.executeGeminiCLI(prompt, timeout, cliPath),
        "Gemini review"
      );
      const review = this.parseGeminiOutput(output, analysisId);
      if (validated.options?.severity && validated.options.severity !== "all") {
        review.findings = this.filterFindingsBySeverity(
          review.findings,
          validated.options.severity
        );
        review.summary = this.calculateSummary(review.findings);
      }
      review.metadata.analysisDuration = Date.now() - startTime;
      review.metadata.resolvedContext = {
        threatModel: resolvedContext.threatModel,
        platform: resolvedContext.platform,
        projectType: resolvedContext.projectType,
        language: resolvedContext.language,
        framework: resolvedContext.framework,
        scope: resolvedContext.scope,
        fileName: resolvedContext.fileName
      };
      review.metadata.warnings = this.warningSystem.formatWarningsAsJson(warnings);
      review.metadata.templateUsed = templateId;
      review.metadata.autoDetected = enableAutoDetect;
      this.logger.info(
        {
          analysisId,
          duration: review.metadata.analysisDuration,
          findings: review.findings.length,
          warnings: warnings.length,
          context: resolvedContext.language ?? "unknown"
        },
        "Gemini review completed"
      );
      return review;
    } catch (error) {
      this.logger.error({ analysisId, error }, "Gemini review failed");
      if (error instanceof GeminiAnalysisError) {
        throw error;
      }
      if (error instanceof SecurityError) {
        throw error;
      }
      if (error instanceof TimeoutError) {
        throw new GeminiTimeoutError(error.message, analysisId, { cause: error });
      }
      if (error instanceof ParseError) {
        throw new GeminiParseError(error.message, analysisId, { cause: error });
      }
      throw new GeminiAnalysisError(
        error instanceof Error ? error.message : "Unknown error during Gemini review",
        analysisId,
        { cause: error }
      );
    }
  }
  /**
   * Execute Gemini CLI command securely
   * @param cliPath - Pre-validated CLI path (validation done before retry logic)
   */
  async executeGeminiCLI(prompt, timeout, cliPath) {
    const args = this.buildCLIArgs();
    this.logger.debug({ cliPath, argsCount: args.length, timeout }, "Executing Gemini CLI");
    try {
      const result = await execa3(cliPath, args, {
        timeout: timeout === 0 ? void 0 : timeout,
        // 0 = unlimited (no timeout)
        reject: true,
        // Throw on ANY non-zero exit code
        input: prompt,
        // Send prompt via stdin
        env: {
          ...process.env,
          // MAJOR FIX #14: Use model config if specified
          GEMINI_MODEL: this.config.model ?? void 0
        },
        // Security: Don't use shell
        shell: false
      });
      const stdout = result.stdout ?? "";
      if (stdout.trim() !== "") {
        return stdout;
      }
      const stderr = result.stderr ?? "";
      return stderr !== "" ? stderr : "";
    } catch (error) {
      const err = error;
      if (err.timedOut) {
        throw new TimeoutError(`Gemini CLI timed out after ${timeout}ms`);
      }
      if (err.exitCode !== void 0 && err.exitCode !== 0) {
        throw new CLIExecutionError(`Gemini CLI exited with code ${err.exitCode}`, {
          exitCode: err.exitCode,
          stderr: err.stderr,
          stdout: err.stdout
        });
      }
      throw new CLIExecutionError("Gemini CLI execution failed", { cause: error });
    }
  }
  /**
   * Validate CLI path against allowed paths
   * SECURITY: Prevents PATH manipulation attacks by resolving to absolute paths
   */
  async validateCLIPath(cliPath) {
    try {
      if (this.validatedCLIPaths.has(cliPath)) {
        return;
      }
      if (cliPath === "gemini" || cliPath === "gemini.cmd") {
        if (!this.allowedCLIPaths.includes(cliPath)) {
          this.logger.logSecurityEvent("System PATH executable not in whitelist", {
            cliPath,
            allowed: this.allowedCLIPaths
          });
          throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
        }
        if (process.platform !== "win32") {
          try {
            const { stdout } = await execa3("which", [cliPath], {
              shell: false,
              timeout: 5e3
            });
            const resolvedPath = stdout.trim();
            const resolvedAllowed = this.allowedCLIPaths.some((allowed) => {
              try {
                const resolvedAllowed2 = resolve3(allowed);
                return resolvedAllowed2 === resolvedPath || allowed === cliPath;
              } catch {
                return false;
              }
            });
            if (!resolvedAllowed) {
              this.logger.logSecurityEvent("System PATH resolved to non-whitelisted path", {
                cliPath,
                resolvedPath,
                allowed: this.allowedCLIPaths
              });
              throw new SecurityError(`Resolved CLI path not in allowed list: ${resolvedPath}`);
            }
          } catch (whichError) {
            this.logger.debug(
              { cliPath, error: whichError },
              "Could not resolve PATH executable, but in whitelist"
            );
          }
        }
        this.validatedCLIPaths.add(cliPath);
        return;
      }
      const resolved = resolve3(cliPath);
      const isAllowed = this.allowedCLIPaths.some((allowed) => {
        try {
          if (allowed === "gemini" || allowed === "gemini.cmd") {
            return false;
          }
          return resolve3(allowed) === resolved;
        } catch {
          return false;
        }
      });
      if (!isAllowed) {
        this.logger.logSecurityEvent("Invalid CLI path attempted", {
          cliPath,
          resolved,
          allowed: this.allowedCLIPaths
        });
        throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
      }
      this.validatedCLIPaths.add(cliPath);
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError("Failed to validate CLI path");
    }
  }
  /**
   * Build CLI arguments
   * MAJOR FIX #14: Include model if specified
   */
  buildCLIArgs() {
    const args = [];
    if (this.config.args && this.config.args.length > 0) {
      args.push(...this.config.args);
    }
    if (this.config.model) {
      args.push("--model", this.config.model);
    }
    args.push("--output-format", "json");
    return args;
  }
  // Maximum output size to parse (guard against unexpectedly large responses)
  static MAX_PARSE_SIZE = 1024 * 1024;
  // 1MB
  /**
   * Parse Gemini CLI output into structured format
   * SIMPLIFIED: Direct parsing with raw output preservation
   */
  parseGeminiOutput(output, analysisId) {
    if (output.length > _GeminiAnalysisService.MAX_PARSE_SIZE) {
      this.logger.warn(
        { analysisId, size: output.length },
        "Gemini output exceeds maximum parse size"
      );
      return this.createRawOutputResult(
        analysisId,
        output.substring(0, 5e4),
        "gemini",
        `Output exceeds maximum parse size of ${_GeminiAnalysisService.MAX_PARSE_SIZE} bytes`
      );
    }
    const cleaned = this.cleanOutput(output);
    try {
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        this.logger.warn(
          { analysisId, outputLength: cleaned.length },
          "Could not parse Gemini output as JSON, returning raw"
        );
        return this.createRawOutputResult(analysisId, cleaned, "gemini", "Failed to parse as JSON");
      }
      let analysisData = parsed;
      if (this.isGeminiWrapper(parsed)) {
        const wrapper = parsed;
        if (wrapper.error) {
          this.logger.error({ analysisId, error: wrapper.error }, "Gemini CLI returned an error");
          return this.createRawOutputResult(
            analysisId,
            cleaned,
            "gemini",
            `Gemini error: ${wrapper.error}`
          );
        }
        if (wrapper.response === null || wrapper.response === void 0) {
          return this.createRawOutputResult(
            analysisId,
            cleaned,
            "gemini",
            "Gemini response is null"
          );
        }
        if (typeof wrapper.response === "string") {
          try {
            const responseText = wrapper.response.replace(/^```(?:json|JSON)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
            analysisData = JSON.parse(responseText);
          } catch {
            return this.createRawOutputResult(
              analysisId,
              cleaned,
              "gemini",
              "Failed to parse response string"
            );
          }
        } else {
          analysisData = wrapper.response;
        }
      }
      const validated = GeminiResponseSchema.parse(analysisData);
      const summary = this.calculateSummary(validated.findings);
      const result = {
        success: true,
        analysisId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        source: "gemini",
        summary,
        findings: validated.findings,
        overallAssessment: validated.overallAssessment,
        recommendations: validated.recommendations,
        metadata: {
          analysisDuration: 0
        }
      };
      AnalysisResultSchema.parse(result);
      this.logger.debug(
        { analysisId, findingsCount: result.findings.length },
        "Gemini output parsed successfully"
      );
      return result;
    } catch (error) {
      this.logger.error({ analysisId, error }, "Failed to parse Gemini output");
      if (error instanceof z7.ZodError) {
        return this.createRawOutputResult(
          analysisId,
          cleaned,
          "gemini",
          `Schema validation failed: ${error.message}`
        );
      }
      throw new ParseError("Failed to parse Gemini output", { cause: error });
    }
  }
  /**
   * Check if parsed data is a Gemini CLI wrapper format
   */
  isGeminiWrapper(data) {
    if (typeof data !== "object" || data === null) return false;
    const obj = data;
    return "response" in obj || "stats" in obj || "error" in obj;
  }
  /**
   * Create result with raw output when parsing fails
   */
  createRawOutputResult(analysisId, rawOutput, source, error) {
    return {
      success: false,
      analysisId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source,
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      findings: [],
      overallAssessment: error ?? "Failed to parse AI response",
      metadata: {
        analysisDuration: 0
      },
      rawOutput: rawOutput.substring(0, 5e4)
      // Limit size
    };
  }
  /**
   * Clean CLI output (remove ANSI codes, etc.)
   */
  cleanOutput(output) {
    let cleaned = stripAnsiCodes(output);
    cleaned = cleaned.replace(/\0/g, "");
    cleaned = cleaned.trim();
    return cleaned;
  }
  /**
   * Calculate summary statistics from findings
   */
  calculateSummary(findings) {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const finding of findings) {
      if (finding.severity === "critical") critical++;
      else if (finding.severity === "high") high++;
      else if (finding.severity === "medium") medium++;
      else if (finding.severity === "low") low++;
    }
    return {
      totalFindings: findings.length,
      critical,
      high,
      medium,
      low
    };
  }
  /**
   * Filter findings by severity
   * MAJOR FIX #6: Implement severity filtering
   */
  filterFindingsBySeverity(findings, severity) {
    if (severity === "high") {
      return findings.filter((f) => f.severity === "critical" || f.severity === "high");
    } else if (severity === "medium") {
      return findings.filter(
        (f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium"
      );
    }
    return findings;
  }
};

// src/storage/database.ts
import * as fs from "fs";
import * as path from "path";
import { homedir as homedir2 } from "os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// src/storage/schema.ts
var schema_exports = {};
__export(schema_exports, {
  analyses: () => analyses,
  cache: () => cache,
  prompts: () => prompts,
  settings: () => settings
});
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
var analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  // 'codex' | 'gemini' | 'combined'
  status: text("status").notNull().default("pending"),
  // 'pending' | 'running' | 'completed' | 'failed'
  promptHash: text("prompt_hash").notNull(),
  contextJson: text("context_json"),
  resultJson: text("result_json"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
  expiresAt: text("expires_at")
});
var cache = sqliteTable("cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").unique().notNull(),
  source: text("source").notNull(),
  // 'codex' | 'gemini' | 'combined'
  resultJson: text("result_json").notNull(),
  hitCount: integer("hit_count").default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  lastAccessedAt: text("last_accessed_at").default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at").notNull()
});
var prompts = sqliteTable("prompts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  template: text("template").notNull(),
  argsSchemaJson: text("args_schema_json"),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});
var settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

// src/storage/database.ts
var DEFAULT_CONFIG = {
  path: "./data/ai-code-agent.db",
  enableWAL: true,
  busyTimeout: 5e3
};
var DatabaseManager = class _DatabaseManager {
  static instance = null;
  sqlite;
  db;
  logger;
  config;
  constructor(config, logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? null;
    this.config.path = this.expandPath(this.config.path);
    this.ensureDataDirectory();
    this.sqlite = new Database(this.config.path);
    if (this.config.enableWAL) {
      this.sqlite.pragma("journal_mode = WAL");
    }
    if (this.config.busyTimeout) {
      this.sqlite.pragma(`busy_timeout = ${this.config.busyTimeout}`);
    }
    this.sqlite.pragma("foreign_keys = ON");
    this.db = drizzle(this.sqlite, { schema: schema_exports });
    this.runMigrations();
    this.logger?.info({ path: this.config.path }, "Database initialized");
  }
  /**
   * Expand tilde (~) in path to user home directory
   * Security: Only expands ~ at start of path to prevent path injection
   */
  expandPath(p) {
    if (p.startsWith("~/")) {
      return path.join(homedir2(), p.slice(2));
    }
    if (p === "~") {
      return homedir2();
    }
    return p;
  }
  /**
   * Ensure data directory exists
   */
  ensureDataDirectory() {
    const dir = path.dirname(this.config.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger?.debug({ dir }, "Created data directory");
    }
  }
  /**
   * Get singleton instance
   */
  static getInstance(config, logger) {
    if (!_DatabaseManager.instance) {
      _DatabaseManager.instance = new _DatabaseManager(config ?? DEFAULT_CONFIG, logger);
    }
    return _DatabaseManager.instance;
  }
  /**
   * Initialize database (create instance if not exists)
   */
  static initialize(config, logger) {
    return _DatabaseManager.getInstance(config, logger);
  }
  /**
   * Get Drizzle database instance
   */
  getDb() {
    return this.db;
  }
  /**
   * Get raw SQLite database instance
   */
  getSqlite() {
    return this.sqlite;
  }
  /**
   * Run database migrations
   */
  runMigrations() {
    this.logger?.info("Running database migrations...");
    this.sqlite.exec(`
      -- Analysis history table
      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        prompt_hash TEXT NOT NULL,
        context_json TEXT,
        result_json TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        expires_at TEXT
      );

      -- Cache table
      CREATE TABLE IF NOT EXISTS cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        source TEXT NOT NULL,
        result_json TEXT NOT NULL,
        hit_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      );

      -- MCP Prompts table
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template TEXT NOT NULL,
        args_schema_json TEXT,
        is_builtin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
      CREATE INDEX IF NOT EXISTS idx_analyses_source ON analyses(source);
      CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON cache(last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_prompts_is_builtin ON prompts(is_builtin);
    `);
    this.logger?.info("Database migrations completed");
  }
  /**
   * Close database connection
   */
  close() {
    this.sqlite.close();
    _DatabaseManager.instance = null;
    this.logger?.info("Database connection closed");
  }
  /**
   * Check if database is healthy
   */
  healthCheck() {
    try {
      this.sqlite.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Get database statistics
   */
  getStats() {
    const analysesCount = this.sqlite.prepare("SELECT COUNT(*) as count FROM analyses").get();
    const cacheCount = this.sqlite.prepare("SELECT COUNT(*) as count FROM cache").get();
    const promptsCount = this.sqlite.prepare("SELECT COUNT(*) as count FROM prompts").get();
    let dbSizeBytes = 0;
    try {
      const stats = fs.statSync(this.config.path);
      dbSizeBytes = stats.size;
    } catch {
    }
    return {
      analysesCount: analysesCount.count,
      cacheCount: cacheCount.count,
      promptsCount: promptsCount.count,
      dbSizeBytes
    };
  }
  /**
   * Reset instance (for testing)
   */
  static resetInstance() {
    if (_DatabaseManager.instance) {
      _DatabaseManager.instance.close();
    }
    _DatabaseManager.instance = null;
  }
};

// src/storage/repositories/base.repository.ts
var BaseRepository = class {
  db;
  logger;
  constructor(db, logger) {
    this.db = db;
    this.logger = logger ?? null;
  }
  /**
   * Get current ISO timestamp
   */
  getCurrentTimestamp() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  /**
   * Calculate expiration timestamp
   */
  getExpirationTimestamp(ttlMs) {
    return new Date(Date.now() + ttlMs).toISOString();
  }
  /**
   * Check if timestamp has expired
   */
  isExpired(expiresAt) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < /* @__PURE__ */ new Date();
  }
};

// src/storage/repositories/analysis.repository.ts
import { eq, and, lt, desc, sql as sql2 } from "drizzle-orm";

// src/storage/repositories/cache.repository.ts
import { eq as eq2, lt as lt2, asc, sql as sql3, desc as desc2 } from "drizzle-orm";
var DEFAULT_CONFIG2 = {
  maxSize: 1e3,
  defaultTtlMs: 36e5,
  // 1 hour
  touchIntervalMs: 3e4
  // 30 seconds
};
var CacheRepository = class extends BaseRepository {
  config;
  constructor(db, config, logger) {
    super(db, logger);
    this.config = { ...DEFAULT_CONFIG2, ...config };
  }
  /**
   * Get cached result by key
   * Updates hit count and last accessed time
   */
  get(cacheKey) {
    const entry = this.db.select().from(cache).where(eq2(cache.cacheKey, cacheKey)).get();
    if (!entry) return null;
    if (this.isExpired(entry.expiresAt)) {
      this.delete(cacheKey);
      return null;
    }
    const now = Date.now();
    const lastAccessedMs = entry.lastAccessedAt ? new Date(entry.lastAccessedAt).getTime() : 0;
    const shouldTouch = now - lastAccessedMs >= this.config.touchIntervalMs;
    if (shouldTouch) {
      this.db.update(cache).set({
        hitCount: sql3`${cache.hitCount} + 1`,
        lastAccessedAt: this.getCurrentTimestamp()
      }).where(eq2(cache.cacheKey, cacheKey)).run();
      this.logger?.debug({ cacheKey, hitCount: (entry.hitCount ?? 0) + 1 }, "Cache hit");
    }
    return entry;
  }
  /**
   * Set cache entry
   * Performs LRU eviction if needed
   */
  set(cacheKey, source, result, ttlMs) {
    const now = this.getCurrentTimestamp();
    const expiresAt = this.getExpirationTimestamp(ttlMs ?? this.config.defaultTtlMs);
    const resultJson = JSON.stringify(result);
    const existing = this.db.select().from(cache).where(eq2(cache.cacheKey, cacheKey)).get();
    if (existing) {
      this.db.update(cache).set({
        resultJson,
        expiresAt,
        lastAccessedAt: now
      }).where(eq2(cache.cacheKey, cacheKey)).run();
      this.logger?.debug({ cacheKey }, "Cache updated");
      return this.db.select().from(cache).where(eq2(cache.cacheKey, cacheKey)).get();
    }
    this.evictIfNeeded();
    const newEntry = {
      cacheKey,
      source,
      resultJson,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt
    };
    this.db.insert(cache).values(newEntry).run();
    this.logger?.debug({ cacheKey, source }, "Cache entry created");
    return this.db.select().from(cache).where(eq2(cache.cacheKey, cacheKey)).get();
  }
  /**
   * Delete cache entry by key
   */
  delete(cacheKey) {
    const result = this.db.delete(cache).where(eq2(cache.cacheKey, cacheKey)).run();
    const deleted = result.changes > 0;
    if (deleted) {
      this.logger?.debug({ cacheKey }, "Cache entry deleted");
    }
    return deleted;
  }
  /**
   * Delete expired entries
   */
  deleteExpired() {
    const now = this.getCurrentTimestamp();
    const result = this.db.delete(cache).where(lt2(cache.expiresAt, now)).run();
    if (result.changes > 0) {
      this.logger?.info({ count: result.changes }, "Deleted expired cache entries");
    }
    return result.changes;
  }
  /**
   * Clear all cache entries
   */
  clear() {
    const result = this.db.delete(cache).run();
    this.logger?.info({ count: result.changes }, "Cache cleared");
    return result.changes;
  }
  /**
   * Clear cache by source
   */
  clearBySource(source) {
    const result = this.db.delete(cache).where(eq2(cache.source, source)).run();
    this.logger?.info({ source, count: result.changes }, "Cache cleared by source");
    return result.changes;
  }
  /**
   * Get cache size (entry count)
   */
  size() {
    const result = this.db.select({ count: sql3`COUNT(*)` }).from(cache).get();
    return result?.count ?? 0;
  }
  /**
   * Check if key exists and is not expired
   */
  has(cacheKey) {
    const entry = this.db.select({ expiresAt: cache.expiresAt }).from(cache).where(eq2(cache.cacheKey, cacheKey)).get();
    if (!entry) return false;
    return !this.isExpired(entry.expiresAt);
  }
  /**
   * Get cache statistics
   */
  getStats() {
    const totalEntries = this.size();
    const hitResult = this.db.select({ total: sql3`COALESCE(SUM(${cache.hitCount}), 0)` }).from(cache).get();
    const totalHits = hitResult?.total ?? 0;
    const sourceResults = this.db.select({
      source: cache.source,
      count: sql3`COUNT(*)`
    }).from(cache).groupBy(cache.source).all();
    const bySource = {
      codex: 0,
      gemini: 0,
      combined: 0
    };
    for (const row of sourceResults) {
      bySource[row.source] = row.count;
    }
    const oldest = this.db.select({ createdAt: cache.createdAt }).from(cache).orderBy(asc(cache.createdAt)).limit(1).get();
    const newest = this.db.select({ createdAt: cache.createdAt }).from(cache).orderBy(desc2(cache.createdAt)).limit(1).get();
    return {
      totalEntries,
      totalHits,
      bySource,
      oldestEntry: oldest?.createdAt ?? null,
      newestEntry: newest?.createdAt ?? null
    };
  }
  /**
   * Perform LRU eviction if at capacity
   */
  evictIfNeeded() {
    const currentSize = this.size();
    if (currentSize < this.config.maxSize) return;
    const toEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1));
    const lruEntries = this.db.select({ id: cache.id }).from(cache).orderBy(asc(cache.lastAccessedAt)).limit(toEvict).all();
    if (lruEntries.length === 0) return;
    const ids = lruEntries.map((e) => e.id);
    this.db.delete(cache).where(sql3`${cache.id} IN (${sql3.join(ids.map((id) => sql3`${id}`), sql3`, `)})`).run();
    this.logger?.info({ evicted: lruEntries.length }, "LRU cache eviction performed");
  }
  /**
   * Get parsed result from cache
   */
  getResult(cacheKey) {
    const entry = this.get(cacheKey);
    if (!entry) return null;
    try {
      return JSON.parse(entry.resultJson);
    } catch {
      this.logger?.warn({ cacheKey }, "Failed to parse cached result");
      return null;
    }
  }
};

// src/storage/repositories/prompt.repository.ts
import { eq as eq3, sql as sql4 } from "drizzle-orm";

// src/tools/registry.ts
import PQueue from "p-queue";
import { z as z8 } from "zod";

// src/core/validation.ts
import { ZodError } from "zod";
var FIELD_CONSTRAINTS = {
  prompt: {
    description: "Code review prompt (can include code, instructions, context, etc.)",
    examples: [
      "Review this code for security vulnerabilities: function auth() {...}",
      "Check performance issues in: const data = arr.map(...)"
    ]
  },
  "prompt.too_small": {
    description: "Prompt must not be empty"
  },
  "prompt.too_big": {
    description: "Prompt exceeds maximum allowed length"
  },
  "options.timeout": {
    description: "Execution timeout in milliseconds (0 = unlimited)",
    format: "Number 0 or greater (0 = unlimited, positive = timeout in ms)",
    examples: ["0", "60000", "120000"]
  },
  "options.timeout.too_small": {
    description: "Timeout must be 0 (unlimited) or a positive number"
  },
  "options.severity": {
    description: "Minimum severity level to report",
    format: "One of: all, high, medium",
    examples: ["all", "high", "medium"]
  },
  "options.cliPath": {
    description: "Custom CLI executable path (must be in allowed paths for security)",
    format: "Absolute path or whitelisted executable name",
    examples: ["codex", "/usr/local/bin/codex", "gemini"]
  },
  "options.parallelExecution": {
    description: "Whether to run Codex and Gemini reviews in parallel",
    format: "Boolean",
    examples: ["true", "false"]
  },
  "options.includeIndividualReviews": {
    description: "Include individual review results in combined output",
    format: "Boolean",
    examples: ["true", "false"]
  },
  reviewId: {
    description: "Unique review identifier",
    format: "Non-empty string",
    examples: ["codex-1234567890-abc123", "gemini-1234567890-xyz789"]
  },
  "reviewId.too_small": {
    description: "Review ID cannot be empty"
  }
};
var ValidationUtils = class {
  static formatValueForMessage(value) {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    if (typeof value === "string") {
      const trimmed = value.length > 50 ? `${value.slice(0, 47)}...` : value;
      return trimmed.replace(/\n/g, "\\n");
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === "object") {
      return "[object]";
    }
    return String(value);
  }
  /**
   * Validate data against a Zod schema with enhanced error messages
   */
  static validate(schema4, data) {
    try {
      const validated = schema4.parse(data);
      return {
        success: true,
        data: validated
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: this.formatZodError(error, data)
        };
      }
      return {
        success: false,
        error: {
          message: "Validation failed with an unknown error",
          fields: [],
          suggestions: [
            "Check that your input matches the expected format",
            "Consult the MCP tool documentation"
          ]
        }
      };
    }
  }
  /**
   * Validate data and throw detailed error if validation fails
   * SECURITY: Redacts sensitive input data to prevent leaking code/secrets in errors
   */
  static validateOrThrow(schema4, data, context) {
    const result = this.validate(schema4, data);
    if (!result.success) {
      const errorMessage = this.formatErrorMessage(result.error, context);
      const redactedInput = this.redactSensitiveData(data);
      throw new ValidationError(errorMessage, {
        validationDetails: result.error,
        input: redactedInput
        // Only include redacted summary
      });
    }
    return result.data;
  }
  /**
   * Format Zod error into user-friendly validation error
   */
  static formatZodError(error, data) {
    const fieldErrors = error.issues.map((issue) => this.formatZodIssue(issue, data));
    const suggestions = this.generateSuggestions(error.issues, fieldErrors);
    return {
      message: this.createOverallMessage(fieldErrors),
      fields: fieldErrors,
      suggestions
    };
  }
  /**
   * Format a single Zod issue into a field error
   * IMPROVEMENT: Handle empty paths and use sanitized values
   */
  static formatZodIssue(issue, data) {
    const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "input";
    const fieldValue = this.getNestedValue(data, issue.path);
    const constraintKey = `${fieldPath}.${issue.code}`;
    const constraint = FIELD_CONSTRAINTS[constraintKey] ?? FIELD_CONSTRAINTS[fieldPath];
    let errorMessage = issue.message;
    let constraintDescription;
    let expectedFormat;
    switch (issue.code) {
      case "invalid_type":
        errorMessage = `Expected ${issue.expected}, but received ${issue.received}`;
        if (constraint?.format) {
          expectedFormat = constraint.format;
          errorMessage += `. ${constraint.description}`;
        }
        break;
      case "too_small":
        if (issue.type === "string") {
          if (issue.minimum === 1) {
            errorMessage = `Field '${fieldPath}' cannot be empty`;
          } else {
            errorMessage = `Field '${fieldPath}' must be at least ${issue.minimum} characters long (current: ${typeof fieldValue === "string" ? fieldValue.length : "unknown"})`;
          }
        } else if (issue.type === "number") {
          errorMessage = `Field '${fieldPath}' must be at least ${issue.minimum} (current: ${this.formatValueForMessage(fieldValue)})`;
        } else if (issue.type === "array") {
          errorMessage = `Field '${fieldPath}' must contain at least ${issue.minimum} items`;
        }
        if (constraint?.description) {
          constraintDescription = constraint.description;
        }
        break;
      case "too_big":
        if (issue.type === "string") {
          errorMessage = `Field '${fieldPath}' exceeds maximum length of ${issue.maximum} characters (current: ${typeof fieldValue === "string" ? fieldValue.length : "unknown"})`;
        } else if (issue.type === "number") {
          errorMessage = `Field '${fieldPath}' exceeds maximum value of ${issue.maximum} (current: ${this.formatValueForMessage(fieldValue)})`;
        } else if (issue.type === "array") {
          errorMessage = `Field '${fieldPath}' exceeds maximum of ${issue.maximum} items`;
        }
        if (constraint?.description) {
          constraintDescription = constraint.description;
        }
        break;
      case "invalid_enum_value": {
        const options = issue.options.map((o) => `'${o}'`).join(", ");
        const received = this.formatValueForMessage(fieldValue);
        errorMessage = `Field '${fieldPath}' must be one of: ${options} (received: '${received}')`;
        if (constraint?.examples) {
          expectedFormat = `Valid options: ${options}`;
        }
        break;
      }
      case "invalid_string":
        if (issue.validation === "email") {
          errorMessage = `Field '${fieldPath}' must be a valid email address`;
        } else if (issue.validation === "url") {
          errorMessage = `Field '${fieldPath}' must be a valid URL`;
        } else if (issue.validation === "regex") {
          errorMessage = `Field '${fieldPath}' does not match the required pattern`;
        }
        break;
      default:
        errorMessage = `Field '${fieldPath}': ${issue.message}`;
        if (constraint?.description) {
          errorMessage += `. ${constraint.description}`;
        }
    }
    return {
      field: fieldPath,
      value: fieldValue,
      error: errorMessage,
      constraint: constraintDescription,
      expectedFormat: expectedFormat ?? constraint?.format
    };
  }
  /**
   * Get nested value from object using path array
   */
  static getNestedValue(obj, path2) {
    let current = obj;
    for (const key of path2) {
      if (current === null || current === void 0) {
        return void 0;
      }
      if (typeof key === "number") {
        if (Array.isArray(current)) {
          current = current[key];
          continue;
        }
        return void 0;
      }
      if (typeof current !== "object") {
        return void 0;
      }
      const record = current;
      current = record[key];
    }
    return current;
  }
  /**
   * Redact sensitive data from input for secure error reporting
   * SECURITY: Prevents leaking code/secrets in error logs
   */
  static redactSensitiveData(data) {
    if (!data || typeof data !== "object") {
      return { type: typeof data };
    }
    const redacted = {};
    const obj = data;
    const sensitiveFields = ["prompt", "code", "context", "cliPath"];
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.includes(key)) {
        if (typeof value === "string") {
          redacted[key] = `<redacted ${value.length} chars>`;
        } else {
          redacted[key] = "<redacted>";
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }
  /**
   * Escape control characters for safe logging
   * SECURITY: Prevents ANSI injection and control character attacks
   */
  static escapeControlCharacters(str) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (!char) continue;
      const code = char.charCodeAt(0);
      const isControl = code >= 0 && code <= 31 || code >= 127 && code <= 159;
      if (isControl) {
        result += `\\x${code.toString(16).padStart(2, "0")}`;
      } else {
        result += char;
      }
    }
    return result;
  }
  static stripControlCharacters(value, options) {
    let result = "";
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (!char) continue;
      const code = char.charCodeAt(0);
      const isControl = code >= 0 && code <= 31 || code === 127;
      if (!isControl) {
        result += char;
        continue;
      }
      const shouldKeep = options.keepNewlinesAndTabs && (code === 9 || code === 10 || code === 13);
      if (shouldKeep) {
        result += char;
      }
    }
    return result;
  }
  /**
   * Sanitize string value for safe display
   * SECURITY: Removes control characters and limits length
   */
  static sanitizeValueForDisplay(value) {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    if (typeof value === "string") {
      const cleaned = this.escapeControlCharacters(value);
      if (cleaned.length > 100) {
        return `${cleaned.substring(0, 100)}... (${value.length} chars)`;
      }
      return cleaned;
    }
    if (typeof value === "object") {
      try {
        const str = JSON.stringify(value);
        if (str.length > 100) {
          return `${str.substring(0, 100)}... (${str.length} chars)`;
        }
        return str;
      } catch {
        return "<complex object>";
      }
    }
    return String(value);
  }
  /**
   * Create overall error message from field errors
   * IMPROVEMENT: Handle empty field path for top-level errors
   */
  static createOverallMessage(fieldErrors) {
    if (fieldErrors.length === 0) {
      return "Validation failed";
    }
    if (fieldErrors.length === 1) {
      const firstError = fieldErrors[0];
      return `Validation error: ${firstError?.error ?? "Unknown error"}`;
    }
    return `Validation failed with ${fieldErrors.length} errors:
${fieldErrors.map((e, i) => `  ${i + 1}. ${e.error}`).join("\n")}`;
  }
  /**
   * Generate helpful suggestions based on validation errors
   */
  static generateSuggestions(issues, fieldErrors) {
    const suggestions = [];
    const errorTypes = new Set(issues.map((i) => i.code));
    if (errorTypes.has("invalid_type")) {
      suggestions.push(
        "Check that all fields have the correct data type (string, number, boolean, etc.)"
      );
    }
    if (errorTypes.has("too_small")) {
      const stringFields = fieldErrors.filter((e) => e.error.includes("characters"));
      if (stringFields.length > 0) {
        suggestions.push(
          "Ensure required text fields are not empty and meet minimum length requirements"
        );
      }
      const numberFields = fieldErrors.filter(
        (e) => e.error.includes("at least") && !e.error.includes("characters")
      );
      if (numberFields.length > 0) {
        suggestions.push("Verify that numeric values meet minimum thresholds");
      }
    }
    if (errorTypes.has("too_big")) {
      const promptErrors = fieldErrors.filter((e) => e.field === "prompt");
      if (promptErrors.length > 0) {
        suggestions.push(
          "Consider reducing the prompt length or splitting it into smaller review requests"
        );
      } else {
        suggestions.push("Reduce values to be within acceptable limits");
      }
    }
    if (errorTypes.has("invalid_enum_value")) {
      suggestions.push(
        "Use only the allowed values for enum fields as specified in the error messages"
      );
    }
    const fieldNames = fieldErrors.map((e) => e.field);
    if (fieldNames.some((f) => f.startsWith("options.timeout"))) {
      suggestions.push("Timeout must be 0 (unlimited) or a positive number in milliseconds");
    }
    if (fieldNames.some((f) => f.startsWith("options.cliPath"))) {
      suggestions.push(
        "CLI path must be a whitelisted executable or absolute path for security reasons"
      );
      suggestions.push(
        "Commonly allowed paths: codex, gemini, /usr/local/bin/codex, /usr/local/bin/gemini"
      );
    }
    fieldErrors.forEach((error) => {
      const constraint = FIELD_CONSTRAINTS[error.field];
      if (constraint?.examples && constraint.examples.length > 0) {
        suggestions.push(`Valid ${error.field} examples: ${constraint.examples.join(", ")}`);
      }
    });
    if (suggestions.length === 0) {
      suggestions.push("Review the field constraints in the error messages above");
      suggestions.push("Consult the MCP tool documentation for detailed input requirements");
    }
    return Array.from(new Set(suggestions));
  }
  /**
   * Format validation error details into a user-friendly message
   * SECURITY: Use sanitized values and ASCII bullets for compatibility
   */
  static formatErrorMessage(error, context) {
    const lines = [];
    if (context) {
      lines.push(`Validation failed for ${context}:`);
      lines.push("");
    }
    lines.push(error.message);
    lines.push("");
    if (error.fields.length > 0) {
      lines.push("Field Details:");
      error.fields.forEach((field) => {
        lines.push(`  - ${field.error}`);
        if (field.expectedFormat) {
          lines.push(`    Expected format: ${field.expectedFormat}`);
        }
        if (field.value !== void 0 && field.value !== null) {
          const valueStr = this.sanitizeValueForDisplay(field.value);
          lines.push(`    Received: ${valueStr}`);
        }
      });
      lines.push("");
    }
    if (error.suggestions.length > 0) {
      lines.push("Suggestions:");
      error.suggestions.forEach((suggestion) => {
        lines.push(`  - ${suggestion}`);
      });
    }
    return lines.join("\n");
  }
  /**
   * Sanitize input parameters and return warnings if modifications were made
   * ENHANCEMENT: Comprehensive sanitization including control characters, type coercion, and normalization
   */
  static sanitizeParams(params) {
    const warnings = [];
    const sanitized = { ...params };
    if (typeof params.prompt === "string") {
      let cleaned = params.prompt;
      const trimmed = cleaned.trim();
      if (trimmed !== cleaned) {
        cleaned = trimmed;
        warnings.push("Removed leading/trailing whitespace from prompt");
      }
      const withoutNulls = cleaned.replace(/\0/g, "");
      if (withoutNulls !== cleaned) {
        cleaned = withoutNulls;
        warnings.push("Removed null bytes from prompt");
      }
      const withoutControls = this.stripControlCharacters(cleaned, { keepNewlinesAndTabs: true });
      if (withoutControls !== cleaned) {
        cleaned = withoutControls;
        warnings.push("Removed control characters from prompt");
      }
      if (cleaned !== params.prompt) {
        sanitized.prompt = cleaned;
      }
    }
    if (typeof params.reviewId === "string") {
      const trimmed = params.reviewId.trim();
      if (trimmed !== params.reviewId) {
        sanitized.reviewId = trimmed;
        warnings.push("Removed whitespace from reviewId");
      }
      const cleaned = this.stripControlCharacters(trimmed, { keepNewlinesAndTabs: false });
      if (cleaned !== trimmed) {
        sanitized.reviewId = cleaned;
        warnings.push("Removed control characters from reviewId");
      }
    }
    const paramsOptions = params.options;
    if (paramsOptions && typeof paramsOptions === "object") {
      const sanitizedOptions = { ...sanitized.options };
      if (paramsOptions.timeout !== void 0) {
        const timeout = Number(paramsOptions.timeout);
        if (!isNaN(timeout) && isFinite(timeout)) {
          if (timeout !== paramsOptions.timeout) {
            sanitizedOptions.timeout = timeout;
            warnings.push(`Converted timeout to number: ${timeout}`);
          }
        } else if (!isFinite(timeout)) {
          warnings.push("Invalid timeout value (NaN or Infinity) - validation will fail");
        }
      }
      if (typeof paramsOptions.cliPath === "string") {
        let cleaned = paramsOptions.cliPath.trim();
        const withoutControls = this.stripControlCharacters(cleaned, {
          keepNewlinesAndTabs: false
        });
        if (withoutControls !== cleaned) {
          cleaned = withoutControls;
          warnings.push("Removed control characters from cliPath");
        }
        if (cleaned !== paramsOptions.cliPath) {
          sanitizedOptions.cliPath = cleaned;
          warnings.push("Removed whitespace from cliPath");
        }
      }
      if (paramsOptions.parallelExecution !== void 0) {
        const value = paramsOptions.parallelExecution;
        if (typeof value === "string") {
          if (value.toLowerCase() === "true") {
            sanitizedOptions.parallelExecution = true;
            warnings.push("Converted parallelExecution 'true' to boolean");
          } else if (value.toLowerCase() === "false") {
            sanitizedOptions.parallelExecution = false;
            warnings.push("Converted parallelExecution 'false' to boolean");
          }
        }
      }
      if (paramsOptions.includeIndividualReviews !== void 0) {
        const value = paramsOptions.includeIndividualReviews;
        if (typeof value === "string") {
          if (value.toLowerCase() === "true") {
            sanitizedOptions.includeIndividualReviews = true;
            warnings.push("Converted includeIndividualReviews 'true' to boolean");
          } else if (value.toLowerCase() === "false") {
            sanitizedOptions.includeIndividualReviews = false;
            warnings.push("Converted includeIndividualReviews 'false' to boolean");
          }
        }
      }
      if (typeof paramsOptions.severity === "string") {
        const normalized = paramsOptions.severity.toLowerCase();
        if (normalized !== paramsOptions.severity) {
          sanitizedOptions.severity = normalized;
          warnings.push(`Normalized severity to lowercase: '${normalized}'`);
        }
      }
      sanitized.options = sanitizedOptions;
    }
    return { sanitized, warnings };
  }
};

// src/services/analysis-status/store.ts
var AnalysisStatusStore = class _AnalysisStatusStore {
  static instance;
  analyses = /* @__PURE__ */ new Map();
  cleanupInterval = null;
  DEFAULT_TTL_MS = 60 * 60 * 1e3;
  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1e3
    );
  }
  static getInstance() {
    if (!_AnalysisStatusStore.instance) {
      _AnalysisStatusStore.instance = new _AnalysisStatusStore();
    }
    return _AnalysisStatusStore.instance;
  }
  cleanup() {
    const now = Date.now();
    const expired = [];
    for (const [analysisId, entry] of this.analyses.entries()) {
      if (entry.expiresAt && now >= new Date(entry.expiresAt).getTime()) {
        expired.push(analysisId);
      }
    }
    expired.forEach((id) => this.analyses.delete(id));
  }
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  create(analysisId, source) {
    this.analyses.set(analysisId, {
      analysisId,
      status: "pending",
      source,
      startTime: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  updateStatus(analysisId, status) {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      entry.status = status;
      if (status === "completed" || status === "failed") {
        const now = /* @__PURE__ */ new Date();
        entry.endTime = now.toISOString();
        entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
      }
    }
  }
  setResult(analysisId, result) {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      const now = /* @__PURE__ */ new Date();
      entry.status = "completed";
      entry.result = result;
      entry.endTime = now.toISOString();
      entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
    }
  }
  setError(analysisId, error) {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      const now = /* @__PURE__ */ new Date();
      entry.status = "failed";
      entry.error = error;
      entry.endTime = now.toISOString();
      entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
    }
  }
  get(analysisId) {
    return this.analyses.get(analysisId);
  }
  has(analysisId) {
    return this.analyses.has(analysisId);
  }
  delete(analysisId) {
    return this.analyses.delete(analysisId);
  }
  clear() {
    this.analyses.clear();
  }
  getAllIds() {
    return Array.from(this.analyses.keys());
  }
};

// src/services/scanner/secrets.ts
var DEFAULT_PATTERNS = [
  // AWS
  {
    name: "AWS Access Key ID",
    pattern: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    severity: "critical",
    description: "AWS Access Key ID detected in code",
    recommendation: "Use environment variables or AWS Secrets Manager. Never commit AWS credentials to version control.",
    category: "api_key"
  },
  {
    name: "AWS Secret Access Key",
    pattern: /\b[A-Za-z0-9/+=]{40}\b(?=.*(?:aws|secret|key))/gi,
    severity: "critical",
    description: "Potential AWS Secret Access Key detected",
    recommendation: "Use environment variables or AWS Secrets Manager. Rotate this key immediately if exposed.",
    category: "api_key"
  },
  {
    name: "AWS MWS Key",
    pattern: /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    severity: "critical",
    description: "AWS Marketplace Web Service key detected",
    recommendation: "Store MWS keys in secure configuration management.",
    category: "api_key"
  },
  // GitHub
  {
    name: "GitHub Personal Access Token",
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: "critical",
    description: "GitHub Personal Access Token detected",
    recommendation: "Use GitHub Actions secrets or environment variables. Revoke and regenerate this token.",
    category: "token"
  },
  {
    name: "GitHub OAuth Access Token",
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    severity: "critical",
    description: "GitHub OAuth Access Token detected",
    recommendation: "Store OAuth tokens in secure secret management systems.",
    category: "token"
  },
  {
    name: "GitHub App Token",
    pattern: /(?:ghu|ghs)_[a-zA-Z0-9]{36}/g,
    severity: "critical",
    description: "GitHub App Token detected",
    recommendation: "Use environment variables for GitHub App tokens.",
    category: "token"
  },
  {
    name: "GitHub Refresh Token",
    pattern: /ghr_[a-zA-Z0-9]{36}/g,
    severity: "critical",
    description: "GitHub Refresh Token detected",
    recommendation: "Never hardcode refresh tokens. Use secure storage.",
    category: "token"
  },
  // Google/GCP
  {
    name: "Google API Key",
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: "high",
    description: "Google API Key detected",
    recommendation: "Restrict API key usage in Google Cloud Console. Use environment variables.",
    category: "api_key"
  },
  {
    name: "Google OAuth Client ID",
    pattern: /[0-9]+-[a-z0-9_]{32}\.apps\.googleusercontent\.com/gi,
    severity: "medium",
    description: "Google OAuth Client ID detected",
    recommendation: "Client IDs are less sensitive but should still be configured externally.",
    category: "credential"
  },
  {
    name: "Firebase Cloud Messaging",
    pattern: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g,
    severity: "high",
    description: "Firebase Cloud Messaging server key detected",
    recommendation: "Store FCM keys in secure configuration. Rotate immediately if exposed.",
    category: "api_key"
  },
  // Azure
  {
    name: "Azure Storage Account Key",
    pattern: /[a-zA-Z0-9+/]{86}==/g,
    severity: "critical",
    description: "Potential Azure Storage Account Key detected",
    recommendation: "Use Azure Key Vault for storage account keys.",
    category: "api_key"
  },
  {
    name: "Azure Service Bus Connection String",
    pattern: /Endpoint=sb:\/\/[^;]+;SharedAccessKeyName=[^;]+;SharedAccessKey=[^;]+/gi,
    severity: "critical",
    description: "Azure Service Bus connection string detected",
    recommendation: "Store connection strings in Azure Key Vault or environment variables.",
    category: "connection_string"
  },
  // Stripe
  {
    name: "Stripe API Key",
    pattern: /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: "critical",
    description: "Stripe API Key detected",
    recommendation: "Use environment variables for Stripe keys. Rotate live keys immediately if exposed.",
    category: "api_key"
  },
  {
    name: "Stripe Restricted Key",
    pattern: /rk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: "critical",
    description: "Stripe Restricted API Key detected",
    recommendation: "Store Stripe keys in secure configuration management.",
    category: "api_key"
  },
  // Slack
  {
    name: "Slack Bot Token",
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: "high",
    description: "Slack Bot Token detected",
    recommendation: "Use environment variables for Slack tokens.",
    category: "token"
  },
  {
    name: "Slack User Token",
    pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: "high",
    description: "Slack User Token detected",
    recommendation: "Never hardcode user tokens. Use OAuth flow with secure storage.",
    category: "token"
  },
  {
    name: "Slack Webhook URL",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
    severity: "medium",
    description: "Slack Webhook URL detected",
    recommendation: "Store webhook URLs in environment variables.",
    category: "token"
  },
  // Database Connection Strings
  {
    name: "MySQL Connection String",
    pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+\/[^\s'"]+/gi,
    severity: "critical",
    description: "MySQL connection string with credentials detected",
    recommendation: "Use environment variables or secret management for database credentials.",
    category: "connection_string"
  },
  {
    name: "PostgreSQL Connection String",
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^\s'"]+/gi,
    severity: "critical",
    description: "PostgreSQL connection string with credentials detected",
    recommendation: "Use environment variables or secret management for database credentials.",
    category: "connection_string"
  },
  {
    name: "MongoDB Connection String",
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+(?:\/[^\s'"]*)?/gi,
    severity: "critical",
    description: "MongoDB connection string with credentials detected",
    recommendation: "Use environment variables or secret management for database credentials.",
    category: "connection_string"
  },
  {
    name: "Redis Connection String",
    pattern: /redis:\/\/[^:]*:[^@]+@[^/]+(?::[0-9]+)?(?:\/[0-9]+)?/gi,
    severity: "critical",
    description: "Redis connection string with credentials detected",
    recommendation: "Use environment variables for Redis credentials.",
    category: "connection_string"
  },
  // Private Keys
  {
    name: "RSA Private Key",
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: "critical",
    description: "RSA Private Key header detected",
    recommendation: "Never commit private keys. Use secure key management systems.",
    category: "private_key"
  },
  {
    name: "OpenSSH Private Key",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: "critical",
    description: "OpenSSH Private Key detected",
    recommendation: "Never commit SSH keys. Use SSH agent or secure key storage.",
    category: "private_key"
  },
  {
    name: "EC Private Key",
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    severity: "critical",
    description: "EC Private Key detected",
    recommendation: "Never commit private keys. Use secure key management.",
    category: "private_key"
  },
  {
    name: "PGP Private Key",
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: "critical",
    description: "PGP Private Key Block detected",
    recommendation: "Never commit PGP private keys. Use secure key storage.",
    category: "private_key"
  },
  // JWT and Auth Tokens
  {
    name: "JSON Web Token",
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: "high",
    description: "JSON Web Token (JWT) detected",
    recommendation: "JWTs should be generated dynamically, not hardcoded. Check if this is a test token.",
    category: "token"
  },
  {
    name: "Bearer Token",
    pattern: /(?:bearer|authorization)\s*[:=]\s*['"][a-zA-Z0-9_.-]+['"]/gi,
    severity: "high",
    description: "Bearer/Authorization token detected",
    recommendation: "Use environment variables for authentication tokens.",
    category: "token"
  },
  // Generic Patterns
  {
    name: "Generic API Key",
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    severity: "high",
    description: "Generic API key pattern detected",
    recommendation: "Store API keys in environment variables or secret management systems.",
    category: "api_key"
  },
  {
    name: "Generic Secret",
    pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "high",
    description: "Hardcoded secret or password detected",
    recommendation: "Never hardcode passwords. Use environment variables or secret management.",
    category: "credential"
  },
  {
    name: "Generic Token",
    pattern: /(?:access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    severity: "high",
    description: "Hardcoded access/auth token detected",
    recommendation: "Store tokens in secure configuration or use OAuth flows.",
    category: "token"
  },
  {
    name: "Private Key Variable",
    pattern: /(?:private[_-]?key)\s*[:=]\s*['"][^'"]{20,}['"]/gi,
    severity: "critical",
    description: "Private key value in variable detected",
    recommendation: "Load private keys from secure storage, not hardcoded values.",
    category: "private_key"
  },
  // Twilio
  {
    name: "Twilio API Key",
    pattern: /SK[0-9a-fA-F]{32}/g,
    severity: "high",
    description: "Twilio API Key detected",
    recommendation: "Store Twilio credentials in environment variables.",
    category: "api_key"
  },
  {
    name: "Twilio Account SID",
    pattern: /AC[a-zA-Z0-9_-]{32}/g,
    severity: "medium",
    description: "Twilio Account SID detected",
    recommendation: "While less sensitive, consider using environment variables.",
    category: "credential"
  },
  // SendGrid
  {
    name: "SendGrid API Key",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: "high",
    description: "SendGrid API Key detected",
    recommendation: "Store SendGrid keys in environment variables.",
    category: "api_key"
  },
  // NPM
  {
    name: "NPM Token",
    pattern: /npm_[a-zA-Z0-9]{36}/g,
    severity: "high",
    description: "NPM access token detected",
    recommendation: "Use npm config or environment variables for NPM tokens.",
    category: "token"
  },
  // Heroku
  {
    name: "Heroku API Key",
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    severity: "medium",
    description: "Potential Heroku API Key (UUID format) detected",
    recommendation: "Use Heroku CLI authentication or environment variables.",
    category: "api_key"
  },
  // Mailchimp
  {
    name: "Mailchimp API Key",
    pattern: /[a-f0-9]{32}-us[0-9]{1,2}/g,
    severity: "high",
    description: "Mailchimp API Key detected",
    recommendation: "Store Mailchimp keys in environment variables.",
    category: "api_key"
  },
  // Square
  {
    name: "Square Access Token",
    pattern: /sq0atp-[0-9A-Za-z\-_]{22}/g,
    severity: "critical",
    description: "Square Access Token detected",
    recommendation: "Use environment variables for Square credentials.",
    category: "token"
  },
  {
    name: "Square OAuth Secret",
    pattern: /sq0csp-[0-9A-Za-z\-_]{43}/g,
    severity: "critical",
    description: "Square OAuth Secret detected",
    recommendation: "Store OAuth secrets in secure configuration.",
    category: "credential"
  },
  // PayPal
  {
    name: "PayPal Braintree Token",
    pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g,
    severity: "critical",
    description: "PayPal/Braintree Access Token detected",
    recommendation: "Use environment variables for payment credentials.",
    category: "token"
  },
  // Discord
  {
    name: "Discord Bot Token",
    pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
    severity: "high",
    description: "Discord Bot Token detected",
    recommendation: "Store Discord tokens in environment variables.",
    category: "token"
  },
  {
    name: "Discord Webhook URL",
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/g,
    severity: "medium",
    description: "Discord Webhook URL detected",
    recommendation: "Store webhook URLs in environment variables.",
    category: "token"
  },
  // Telegram
  {
    name: "Telegram Bot Token",
    pattern: /[0-9]+:AA[0-9A-Za-z\-_]{33}/g,
    severity: "high",
    description: "Telegram Bot Token detected",
    recommendation: "Use environment variables for bot tokens.",
    category: "token"
  }
];
var SecretScanner = class {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.patterns = this.initializePatterns();
    this.excludeRegexes = this.initializeExcludePatterns(config.excludePatterns ?? []);
  }
  patterns;
  excludeRegexes;
  /**
   * Initialize exclude patterns with validation
   */
  initializeExcludePatterns(patterns) {
    const regexes = [];
    for (const pattern of patterns) {
      try {
        regexes.push(new RegExp(pattern, "gi"));
      } catch (error) {
        this.logger.warn(
          { pattern, error: error.message },
          "Invalid exclude pattern, skipping"
        );
      }
    }
    return regexes;
  }
  /**
   * Initialize patterns based on configuration
   */
  initializePatterns() {
    const patterns = [];
    const patternConfig = this.config.patterns ?? {
      aws: true,
      gcp: true,
      azure: true,
      github: true,
      generic: true,
      database: true,
      privateKeys: true
    };
    for (const pattern of DEFAULT_PATTERNS) {
      const shouldInclude = this.shouldIncludePattern(pattern, patternConfig);
      if (shouldInclude) {
        patterns.push(pattern);
      }
    }
    if (this.config.customPatterns) {
      for (const customPattern of this.config.customPatterns) {
        const flags = customPattern.pattern.flags;
        if (!flags.includes("g")) {
          const normalizedPattern = {
            ...customPattern,
            pattern: new RegExp(customPattern.pattern.source, flags + "g")
          };
          patterns.push(normalizedPattern);
          this.logger.debug(
            { patternName: customPattern.name },
            "Added global flag to custom pattern"
          );
        } else {
          patterns.push(customPattern);
        }
      }
    }
    this.logger.debug({ patternCount: patterns.length }, "Secret scanner patterns initialized");
    return patterns;
  }
  /**
   * Check if pattern should be included based on config
   */
  shouldIncludePattern(pattern, config) {
    const name = pattern.name.toLowerCase();
    if (name.includes("aws") && !config.aws) return false;
    if ((name.includes("google") || name.includes("gcp") || name.includes("firebase")) && !config.gcp)
      return false;
    if (name.includes("azure") && !config.azure) return false;
    if (name.includes("github") && !config.github) return false;
    if (pattern.category === "connection_string" && !config.database) return false;
    if (pattern.category === "private_key" && !config.privateKeys) return false;
    if ((name.includes("generic") || name.includes("jwt") || name.includes("bearer") || name.includes("slack") || name.includes("stripe") || name.includes("twilio") || name.includes("sendgrid") || name.includes("npm") || name.includes("discord") || name.includes("telegram")) && !config.generic) {
      return false;
    }
    return true;
  }
  /**
   * Scan code for secrets
   */
  scan(code, fileName) {
    if (!this.config.enabled) {
      return [];
    }
    if (fileName && this.shouldExcludeFile(fileName)) {
      this.logger.debug({ fileName }, "File excluded from secret scanning");
      return [];
    }
    const findings = [];
    const maxScanLength = this.config.maxScanLength ?? 2e5;
    let scanCode = code;
    if (scanCode.length > maxScanLength) {
      scanCode = scanCode.substring(0, maxScanLength);
      this.logger.debug(
        { fileName, originalLength: code.length, maxScanLength },
        "Secret scanning input truncated for performance"
      );
    }
    const lines = scanCode.split("\n");
    const maxLineLength = this.config.maxLineLength ?? 1e4;
    for (const pattern of this.patterns) {
      try {
        if (!(pattern.pattern instanceof RegExp)) {
          this.logger.warn({ patternName: pattern.name }, "Invalid pattern object, skipping");
          continue;
        }
        pattern.pattern.lastIndex = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          let line = lines[lineIndex];
          if (!line) continue;
          if (line.length > maxLineLength) {
            line = line.substring(0, maxLineLength);
            this.logger.debug(
              { lineIndex: lineIndex + 1, originalLength: lines[lineIndex]?.length },
              "Line truncated for ReDoS protection"
            );
          }
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("//") || trimmedLine.startsWith("#") || trimmedLine.startsWith("*") || trimmedLine.startsWith("/*")) {
          }
          pattern.pattern.lastIndex = 0;
          let match;
          while ((match = pattern.pattern.exec(line)) !== null) {
            if (this.isFalsePositive(match[0], line, pattern)) {
              continue;
            }
            findings.push({
              type: "security",
              secretType: pattern.name,
              category: pattern.category,
              severity: pattern.severity,
              line: lineIndex + 1,
              column: match.index + 1,
              // 1-based column index
              match: this.maskSecret(match[0]),
              description: pattern.description,
              recommendation: pattern.recommendation
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          { patternName: pattern.name, error: error.message },
          "Error scanning with pattern, skipping"
        );
      }
    }
    this.logger.info({ findingCount: findings.length, fileName }, "Secret scanning completed");
    return findings;
  }
  /**
   * Check if file should be excluded from scanning
   */
  shouldExcludeFile(fileName) {
    for (const regex of this.excludeRegexes) {
      regex.lastIndex = 0;
      if (regex.test(fileName)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Check for common false positives
   */
  isFalsePositive(match, line, pattern) {
    const lowerLine = line.toLowerCase();
    const lowerMatch = match.toLowerCase();
    const placeholders = [
      "your_",
      "example",
      "placeholder",
      "xxx",
      "yyy",
      "zzz",
      "test",
      "dummy",
      "sample",
      "changeme",
      "replace",
      "<your",
      "{your",
      "${",
      "process.env",
      "env.",
      "config.",
      "settings."
    ];
    for (const placeholder of placeholders) {
      if (lowerLine.includes(placeholder) || lowerMatch.includes(placeholder)) {
        return true;
      }
    }
    if (lowerLine.includes("process.env") || lowerLine.includes("env[")) {
      return true;
    }
    if (pattern.name.startsWith("Generic")) {
      if (match.length < 16) {
        return true;
      }
    }
    if (pattern.name === "Heroku API Key") {
      const sensitiveContext = ["heroku", "api", "key", "token", "secret", "auth"];
      const hasContext = sensitiveContext.some((ctx) => lowerLine.includes(ctx));
      if (!hasContext) {
        return true;
      }
    }
    return false;
  }
  /**
   * Mask secret value for safe display
   * Reveals minimal information to prevent secret reconstruction
   */
  maskSecret(secret) {
    const length = secret.length;
    if (length <= 4) {
      return "***";
    }
    if (length <= 12) {
      return secret.slice(0, 1) + "***[" + length + " chars]";
    }
    return secret.slice(0, 2) + "***[" + length + " chars]";
  }
  /**
   * Convert secret findings to analysis findings format
   * Includes input validation for safety
   */
  toAnalysisFindings(secretFindings) {
    if (!Array.isArray(secretFindings)) {
      this.logger.warn("Invalid input to toAnalysisFindings: expected array");
      return [];
    }
    return secretFindings.filter((finding) => {
      if (!finding || typeof finding !== "object") {
        this.logger.warn("Invalid finding object (not an object), skipping");
        return false;
      }
      if (!finding.secretType || !finding.severity || typeof finding.line !== "number") {
        this.logger.warn(
          {
            secretType: finding.secretType || "unknown",
            severity: finding.severity || "unknown",
            line: finding.line
          },
          "Finding missing required fields, skipping"
        );
        return false;
      }
      return true;
    }).map((finding) => ({
      type: "security",
      severity: finding.severity,
      line: finding.line,
      title: `Hardcoded ${finding.secretType}`,
      description: `${finding.description || "Secret detected"}

Detected value: \`${finding.match || "***"}\` at column ${finding.column || 1}`,
      suggestion: finding.recommendation || "Remove hardcoded secret and use environment variables"
    }));
  }
  /**
   * Get scanner statistics
   */
  getStats() {
    const categories = [...new Set(this.patterns.map((p) => p.category))];
    return {
      patternCount: this.patterns.length,
      categories
    };
  }
};

// src/tools/registry.ts
var ScanSecretsInputSchema = z8.object({
  code: z8.string({
    required_error: "Code is required",
    invalid_type_error: "Code must be a string"
  }).min(1, { message: "Code cannot be empty" }).max(1e5, { message: "Code exceeds maximum length of 100,000 characters" }).describe("Code to scan for secrets"),
  fileName: z8.string().optional().describe("Optional file name for context and exclusion matching")
});
var AnalysisStatusInputSchema = z8.object({
  analysisId: z8.string({
    required_error: "Analysis ID is required",
    invalid_type_error: "Analysis ID must be a string"
  }).min(1, {
    message: "Analysis ID cannot be empty. Expected format: codex-<timestamp>-<hash> or gemini-<timestamp>-<hash>"
  }).describe("Analysis ID to check status for")
});
function formatAnalysisAsMarkdown(result, options) {
  const lines = [];
  const maxFindings = typeof options?.maxFindings === "number" && options.maxFindings > 0 ? options.maxFindings : Number.POSITIVE_INFINITY;
  const maxCodeSnippetLength = typeof options?.maxCodeSnippetLength === "number" && options.maxCodeSnippetLength > 0 ? options.maxCodeSnippetLength : Number.POSITIVE_INFINITY;
  lines.push("## Overall Assessment\n");
  lines.push(result.overallAssessment);
  lines.push("");
  if (result.summary.totalFindings > 0) {
    lines.push("## Summary\n");
    lines.push(`- **Total Issues:** ${result.summary.totalFindings}`);
    if (result.summary.critical > 0) lines.push(`- **Critical:** ${result.summary.critical}`);
    if (result.summary.high > 0) lines.push(`- **High:** ${result.summary.high}`);
    if (result.summary.medium > 0) lines.push(`- **Medium:** ${result.summary.medium}`);
    if (result.summary.low > 0) lines.push(`- **Low:** ${result.summary.low}`);
    lines.push("");
  }
  if (result.findings.length > 0) {
    lines.push("## Findings\n");
    const findingsToRender = result.findings.slice(0, maxFindings);
    findingsToRender.forEach((finding, index) => {
      const severityEmoji = {
        critical: "\u{1F534}",
        high: "\u{1F7E0}",
        medium: "\u{1F7E1}",
        low: "\u{1F535}",
        info: "\u26AA"
      }[finding.severity] ?? "\u26AA";
      lines.push(`### ${index + 1}. ${severityEmoji} ${finding.title}`);
      lines.push(`**Severity:** ${finding.severity.toUpperCase()} | **Type:** ${finding.type}`);
      if (finding.line) lines.push(`**Line:** ${finding.line}`);
      lines.push("");
      lines.push(`**Description:**`);
      lines.push(finding.description);
      lines.push("");
      if (finding.suggestion) {
        lines.push(`**Suggestion:**`);
        lines.push(finding.suggestion);
        lines.push("");
      }
      if (finding.code) {
        const code = finding.code.length > maxCodeSnippetLength ? `${finding.code.slice(0, maxCodeSnippetLength)}
... (truncated)` : finding.code;
        lines.push("**Code:**");
        lines.push("```");
        lines.push(code);
        lines.push("```");
        lines.push("");
      }
    });
    if (result.findings.length > findingsToRender.length) {
      lines.push(
        `*Showing ${findingsToRender.length} of ${result.findings.length} findings. Increase maxFindings to view more.*`
      );
      lines.push("");
    }
  }
  if (result.recommendations && result.recommendations.length > 0) {
    lines.push("## Recommendations\n");
    result.recommendations.forEach((rec) => {
      lines.push(`- ${rec}`);
    });
    lines.push("");
  }
  lines.push("---");
  lines.push(`*Analysis ID: ${result.analysisId} | Source: ${result.source}*`);
  lines.push("");
  lines.push(
    "**Do you agree with this analysis?** If you have any objections or additional context, please share your feedback."
  );
  const output = lines.join("\n");
  if (typeof options?.maxOutputChars === "number" && options.maxOutputChars > 0 && output.length > options.maxOutputChars) {
    return `${output.slice(0, options.maxOutputChars)}

...[truncated]`;
  }
  return output;
}
var ToolRegistry = class {
  constructor(server, dependencies) {
    this.server = server;
    this.dependencies = dependencies;
    this.analysisStatusStore = AnalysisStatusStore.getInstance();
    this.cacheService = dependencies.cacheService ?? null;
    const buildQueueOptions = (queueConfig, maxConcurrent) => {
      const options = {
        concurrency: maxConcurrent
      };
      if (queueConfig?.interval !== void 0 && queueConfig.interval > 0) {
        options.interval = queueConfig.interval;
        options.intervalCap = queueConfig.intervalCap ?? maxConcurrent;
      }
      return options;
    };
    this.codexQueue = new PQueue(
      buildQueueOptions(dependencies.config.codex.queue, dependencies.config.codex.maxConcurrent)
    );
    this.geminiQueue = new PQueue(
      buildQueueOptions(dependencies.config.gemini.queue, dependencies.config.gemini.maxConcurrent)
    );
    this.secretScanner = dependencies.secretScanner ?? new SecretScanner(
      {
        enabled: dependencies.config.secretScanning.enabled,
        maxScanLength: dependencies.config.secretScanning.maxScanLength,
        maxLineLength: dependencies.config.secretScanning.maxLineLength,
        patterns: dependencies.config.secretScanning.patterns,
        excludePatterns: dependencies.config.secretScanning.excludePatterns
      },
      dependencies.logger
    );
  }
  analysisStatusStore;
  codexQueue;
  geminiQueue;
  secretScanner;
  cacheService;
  getMaxCodeLengthOverride(args, fallback) {
    if (typeof args !== "object" || args === null) {
      return fallback;
    }
    const value = args.maxCodeLength;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    if (value < 100 || value > 1e6) {
      return fallback;
    }
    return value;
  }
  buildCacheKeyParams(source, params) {
    const { config } = this.dependencies;
    const prompts2 = config.prompts ?? {};
    const serviceTemplates = prompts2.serviceTemplates ?? {};
    const options = params.options ?? {};
    const templateOverride = typeof options.template === "string" ? options.template : void 0;
    const defaultTemplate = source === "codex" ? serviceTemplates.codex : source === "gemini" ? serviceTemplates.gemini : void 0;
    const resolvedTemplate = templateOverride ?? defaultTemplate ?? prompts2.defaultTemplate ?? "default";
    const service = source === "codex" ? {
      model: config.codex.model ?? null,
      reasoningEffort: config.codex.reasoningEffort,
      search: config.codex.search,
      args: config.codex.args,
      template: resolvedTemplate,
      version: config.server.version
    } : source === "gemini" ? {
      model: config.gemini.model ?? null,
      args: config.gemini.args,
      template: resolvedTemplate,
      version: config.server.version
    } : {
      model: `${config.codex.model ?? ""}|${config.gemini.model ?? ""}`,
      reasoningEffort: config.codex.reasoningEffort,
      search: config.codex.search,
      args: [...config.codex.args ?? [], "|", ...config.gemini.args ?? []],
      template: resolvedTemplate,
      version: config.server.version
    };
    return {
      prompt: params.prompt,
      source,
      context: params.context,
      options: {
        severity: typeof options.severity === "string" ? options.severity : void 0,
        preset: typeof options.preset === "string" ? options.preset : void 0,
        template: typeof options.template === "string" ? options.template : void 0,
        autoDetect: typeof options.autoDetect === "boolean" ? options.autoDetect : void 0,
        warnOnMissingContext: typeof options.warnOnMissingContext === "boolean" ? options.warnOnMissingContext : void 0
      },
      service
    };
  }
  /**
   * Register all tools with MCP server using high-level API
   */
  registerTools() {
    const { logger, codexService, geminiService } = this.dependencies;
    const maxCodeLength = this.dependencies.config.analysis.maxCodeLength;
    if (codexService) {
      const analysisParamsSchema = createCodeAnalysisParamsSchema(maxCodeLength);
      this.server.registerTool(
        "analyze_code_with_codex",
        {
          title: "Analyze Code with Codex",
          description: "Perform comprehensive code analysis using Codex AI",
          inputSchema: analysisParamsSchema.shape
        },
        async (args) => {
          logger.info({ tool: "analyze_code_with_codex" }, "Tool called");
          return await this.handleCodexAnalysis(args);
        }
      );
    }
    if (geminiService) {
      const analysisParamsSchema = createCodeAnalysisParamsSchema(maxCodeLength);
      this.server.registerTool(
        "analyze_code_with_gemini",
        {
          title: "Analyze Code with Gemini",
          description: "Perform comprehensive code analysis using Gemini CLI",
          inputSchema: analysisParamsSchema.shape
        },
        async (args) => {
          logger.info({ tool: "analyze_code_with_gemini" }, "Tool called");
          return await this.handleGeminiAnalysis(args);
        }
      );
    }
    if (codexService && geminiService) {
      const combinedSchema = createCombinedAnalysisInputSchema(maxCodeLength);
      this.server.registerTool(
        "analyze_code_combined",
        {
          title: "Analyze Code Combined",
          description: "Perform code analysis using both Codex and Gemini, then aggregate results",
          inputSchema: combinedSchema.shape
        },
        async (args) => {
          logger.info({ tool: "analyze_code_combined" }, "Tool called");
          return await this.handleCombinedAnalysis(args);
        }
      );
    }
    this.server.registerTool(
      "get_analysis_status",
      {
        title: "Get Analysis Status",
        description: "Get the status of an async code analysis by analysis ID",
        inputSchema: AnalysisStatusInputSchema.shape
      },
      (args) => {
        logger.info({ tool: "get_analysis_status" }, "Tool called");
        return this.handleGetAnalysisStatus(args);
      }
    );
    this.server.registerTool(
      "scan_secrets",
      {
        title: "Scan for Secrets",
        description: "Scan code for hardcoded secrets, API keys, passwords, and sensitive data",
        inputSchema: ScanSecretsInputSchema.shape
      },
      (args) => {
        logger.info({ tool: "scan_secrets" }, "Tool called");
        return this.handleScanSecrets(args);
      }
    );
    logger.info("All tools registered successfully");
  }
  /**
   * Handle Codex analysis tool
   * CRITICAL FIX #3: Wire analysis status store operations
   * CRITICAL FIX #4: Allow per-request maxCodeLength override
   * MAJOR FIX #6: Honor per-request timeout option
   * MAJOR FIX #7: Use queue for concurrency control
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  async handleCodexAnalysis(args) {
    const { codexService, config, logger } = this.dependencies;
    if (!codexService) {
      throw new Error("Codex service is not enabled");
    }
    const maxCodeLength = this.getMaxCodeLengthOverride(args, config.analysis.maxCodeLength);
    const schema4 = createCodeAnalysisParamsSchema(maxCodeLength);
    const params = ValidationUtils.validateOrThrow(schema4, args, "analyze_code_with_codex");
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: "pre-validation" }, "Input sanitization performed");
    }
    const finalParams = sanitized;
    const result = await this.codexQueue.add(async () => {
      const analysisId = `codex-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.analysisStatusStore.create(analysisId, "codex");
      this.analysisStatusStore.updateStatus(analysisId, "in_progress");
      try {
        const cacheKeyParams = this.buildCacheKeyParams("codex", finalParams);
        const cacheKeyShort = this.cacheService ? generateShortCacheKey(cacheKeyParams) : null;
        const executeAnalysis = async () => {
          const result3 = await codexService.analyzeCode(finalParams);
          if (config.secretScanning?.enabled) {
            const secretFindings = this.secretScanner.scan(finalParams.prompt);
            const secretAnalysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);
            if (secretAnalysisFindings.length > 0) {
              result3.findings = [...secretAnalysisFindings, ...result3.findings];
              for (const finding of secretAnalysisFindings) {
                result3.summary.totalFindings++;
                if (finding.severity === "critical") result3.summary.critical++;
                else if (finding.severity === "high") result3.summary.high++;
                else if (finding.severity === "medium") result3.summary.medium++;
                else if (finding.severity === "low") result3.summary.low++;
              }
              logger.debug(
                { secretCount: secretAnalysisFindings.length, analysisId },
                "Secret findings added to analysis"
              );
            }
          }
          return result3;
        };
        const { result: result2, fromCache } = this.cacheService && this.cacheService.isEnabled() ? await this.cacheService.getOrSet(cacheKeyParams, executeAnalysis) : { result: await executeAnalysis(), fromCache: false };
        result2.analysisId = analysisId;
        result2.timestamp = (/* @__PURE__ */ new Date()).toISOString();
        result2.metadata.fromCache = fromCache;
        if (cacheKeyShort) {
          result2.metadata.cacheKey = cacheKeyShort;
        }
        if (fromCache) {
          logger.info({ analysisId, cacheKey: cacheKeyShort }, "Codex analysis served from cache");
        }
        this.analysisStatusStore.setResult(analysisId, result2);
        logger.info({ analysisId }, "Codex analysis completed successfully");
        return {
          content: [
            {
              type: "text",
              text: formatAnalysisAsMarkdown(result2, {
                maxFindings: config.analysis.maxFindings,
                maxCodeSnippetLength: config.analysis.maxCodeSnippetLength,
                maxOutputChars: config.analysis.maxOutputChars
              })
            }
          ]
        };
      } catch (error) {
        const errorInfo = ErrorHandler.classifyError(error);
        this.analysisStatusStore.setError(analysisId, {
          code: errorInfo.code,
          message: errorInfo.message
        });
        throw error;
      }
    });
    if (!result) {
      throw new Error("Codex analysis queue returned void");
    }
    return result;
  }
  /**
   * Handle Gemini analysis tool
   * CRITICAL FIX #3: Wire analysis status store operations
   * CRITICAL FIX #4: Allow per-request maxCodeLength override
   * MAJOR FIX #6: Honor per-request timeout and cliPath options
   * MAJOR FIX #7: Use queue for concurrency control
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  async handleGeminiAnalysis(args) {
    const { geminiService, config, logger } = this.dependencies;
    if (!geminiService) {
      throw new Error("Gemini service is not enabled");
    }
    const maxCodeLength = this.getMaxCodeLengthOverride(args, config.analysis.maxCodeLength);
    const schema4 = createCodeAnalysisParamsSchema(maxCodeLength);
    const params = ValidationUtils.validateOrThrow(schema4, args, "analyze_code_with_gemini");
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: "pre-validation" }, "Input sanitization performed");
    }
    const finalParams = sanitized;
    const result = await this.geminiQueue.add(async () => {
      const analysisId = `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.analysisStatusStore.create(analysisId, "gemini");
      this.analysisStatusStore.updateStatus(analysisId, "in_progress");
      try {
        const cacheKeyParams = this.buildCacheKeyParams("gemini", finalParams);
        const cacheKeyShort = this.cacheService ? generateShortCacheKey(cacheKeyParams) : null;
        const executeAnalysis = async () => {
          const result3 = await geminiService.analyzeCode(finalParams);
          if (config.secretScanning?.enabled) {
            const secretFindings = this.secretScanner.scan(finalParams.prompt);
            const secretAnalysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);
            if (secretAnalysisFindings.length > 0) {
              result3.findings = [...secretAnalysisFindings, ...result3.findings];
              for (const finding of secretAnalysisFindings) {
                result3.summary.totalFindings++;
                if (finding.severity === "critical") result3.summary.critical++;
                else if (finding.severity === "high") result3.summary.high++;
                else if (finding.severity === "medium") result3.summary.medium++;
                else if (finding.severity === "low") result3.summary.low++;
              }
              logger.debug(
                { secretCount: secretAnalysisFindings.length, analysisId },
                "Secret findings added to analysis"
              );
            }
          }
          return result3;
        };
        const { result: result2, fromCache } = this.cacheService && this.cacheService.isEnabled() ? await this.cacheService.getOrSet(cacheKeyParams, executeAnalysis) : { result: await executeAnalysis(), fromCache: false };
        result2.analysisId = analysisId;
        result2.timestamp = (/* @__PURE__ */ new Date()).toISOString();
        result2.metadata.fromCache = fromCache;
        if (cacheKeyShort) {
          result2.metadata.cacheKey = cacheKeyShort;
        }
        if (fromCache) {
          logger.info({ analysisId, cacheKey: cacheKeyShort }, "Gemini analysis served from cache");
        }
        this.analysisStatusStore.setResult(analysisId, result2);
        logger.info({ analysisId }, "Gemini analysis completed successfully");
        return {
          content: [
            {
              type: "text",
              text: formatAnalysisAsMarkdown(result2, {
                maxFindings: config.analysis.maxFindings,
                maxCodeSnippetLength: config.analysis.maxCodeSnippetLength,
                maxOutputChars: config.analysis.maxOutputChars
              })
            }
          ]
        };
      } catch (error) {
        const errorInfo = ErrorHandler.classifyError(error);
        this.analysisStatusStore.setError(analysisId, {
          code: errorInfo.code,
          message: errorInfo.message
        });
        throw error;
      }
    });
    if (!result) {
      throw new Error("Gemini analysis queue returned void");
    }
    return result;
  }
  /**
   * Handle combined analysis tool
   * CRITICAL FIX #3: Wire analysis status store operations
   * MAJOR FIX #6: Honor all per-request options
   * MAJOR FIX #7: Respect parallelExecution flag for concurrency
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  async handleCombinedAnalysis(args) {
    const { codexService, geminiService, aggregator, logger, config } = this.dependencies;
    if (!codexService || !geminiService) {
      throw new Error("Both Codex and Gemini services must be enabled for combined analysis");
    }
    const maxCodeLength = config.analysis.maxCodeLength;
    const combinedSchema = createCombinedAnalysisInputSchema(maxCodeLength);
    const params = ValidationUtils.validateOrThrow(
      combinedSchema,
      args,
      "analyze_code_combined"
    );
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: "pre-validation" }, "Input sanitization performed");
    }
    const finalParams = sanitized;
    const parallelExecution = finalParams.options?.parallelExecution ?? true;
    const includeIndividualAnalyses = finalParams.options?.includeIndividualAnalyses ?? false;
    const analysisId = `combined-${Date.now()}`;
    this.analysisStatusStore.create(analysisId, "combined");
    this.analysisStatusStore.updateStatus(analysisId, "in_progress");
    logger.info(
      { parallelExecution, includeIndividualAnalyses, analysisId },
      "Starting combined analysis"
    );
    try {
      const cacheKeyParams = this.buildCacheKeyParams("combined", finalParams);
      const cacheKeyShort = this.cacheService ? generateShortCacheKey(cacheKeyParams) : null;
      const executeCombined = async () => {
        const serviceParams = {
          prompt: finalParams.prompt,
          context: finalParams.context,
          options: finalParams.options ? {
            timeout: finalParams.options.timeout,
            severity: finalParams.options.severity,
            template: finalParams.options.template,
            preset: finalParams.options.preset,
            autoDetect: finalParams.options.autoDetect,
            warnOnMissingContext: finalParams.options.warnOnMissingContext
          } : void 0
        };
        const analyses2 = parallelExecution ? await Promise.all([
          this.codexQueue.add(() => codexService.analyzeCode(serviceParams)),
          this.geminiQueue.add(() => geminiService.analyzeCode(serviceParams))
        ]) : [
          await this.codexQueue.add(() => codexService.analyzeCode(serviceParams)),
          await this.geminiQueue.add(() => geminiService.analyzeCode(serviceParams))
        ];
        const validAnalyses = analyses2.filter((r) => r !== void 0);
        if (validAnalyses.length === 0) {
          throw new Error("No analyses completed successfully");
        }
        const aggregated2 = aggregator.mergeAnalyses(validAnalyses, { includeIndividualAnalyses });
        if (config.secretScanning?.enabled) {
          const secretFindings = this.secretScanner.scan(finalParams.prompt);
          const secretAnalysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);
          if (secretAnalysisFindings.length > 0) {
            const secretAggregated = secretAnalysisFindings.map((finding) => ({
              ...finding,
              sources: ["codex", "gemini"],
              confidence: "high"
            }));
            aggregated2.findings = [...secretAggregated, ...aggregated2.findings];
            for (const finding of secretAggregated) {
              aggregated2.summary.totalFindings++;
              if (finding.severity === "critical") aggregated2.summary.critical++;
              else if (finding.severity === "high") aggregated2.summary.high++;
              else if (finding.severity === "medium") aggregated2.summary.medium++;
              else if (finding.severity === "low") aggregated2.summary.low++;
            }
            const highConfidence = aggregated2.findings.filter((f) => f.confidence === "high").length;
            aggregated2.summary.consensus = aggregated2.findings.length > 0 ? Math.round(highConfidence / aggregated2.findings.length * 100) : 100;
          }
        }
        return aggregated2;
      };
      const { result: aggregated, fromCache } = this.cacheService && this.cacheService.isEnabled() ? await this.cacheService.getOrSet(cacheKeyParams, executeCombined) : { result: await executeCombined(), fromCache: false };
      aggregated.analysisId = analysisId;
      aggregated.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      aggregated.metadata.fromCache = fromCache;
      if (cacheKeyShort) {
        aggregated.metadata.cacheKey = cacheKeyShort;
      }
      if (fromCache) {
        logger.info({ analysisId, cacheKey: cacheKeyShort }, "Combined analysis served from cache");
      }
      this.analysisStatusStore.setResult(analysisId, aggregated);
      logger.info({ analysisId }, "Combined analysis completed successfully");
      return {
        content: [
          {
            type: "text",
            text: formatAnalysisAsMarkdown(aggregated, {
              maxFindings: config.analysis.maxFindings,
              maxCodeSnippetLength: config.analysis.maxCodeSnippetLength,
              maxOutputChars: config.analysis.maxOutputChars
            })
          }
        ]
      };
    } catch (error) {
      const errorInfo = ErrorHandler.classifyError(error);
      this.analysisStatusStore.setError(analysisId, {
        code: errorInfo.code,
        message: errorInfo.message
      });
      throw error;
    }
  }
  /**
   * Handle get analysis status tool
   * CRITICAL FIX #3: Properly retrieve and return status
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  handleGetAnalysisStatus(args) {
    const params = ValidationUtils.validateOrThrow(
      AnalysisStatusInputSchema,
      args,
      "get_analysis_status"
    );
    const status = this.analysisStatusStore.get(params.analysisId);
    if (!status) {
      throw new Error(`Analysis not found: ${params.analysisId}`);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }
  /**
   * Handle secret scanning tool
   */
  handleScanSecrets(args) {
    const { logger } = this.dependencies;
    const params = ValidationUtils.validateOrThrow(ScanSecretsInputSchema, args, "scan_secrets");
    const startTime = Date.now();
    const secretFindings = this.secretScanner.scan(params.code, params.fileName);
    const analysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);
    const duration = Date.now() - startTime;
    const result = {
      success: true,
      scanId: `secrets-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      summary: {
        totalFindings: secretFindings.length,
        critical: secretFindings.filter((f) => f.severity === "critical").length,
        high: secretFindings.filter((f) => f.severity === "high").length,
        medium: secretFindings.filter((f) => f.severity === "medium").length,
        low: secretFindings.filter((f) => f.severity === "low").length,
        byCategory: this.groupByCategory(secretFindings)
      },
      findings: analysisFindings,
      metadata: {
        duration,
        patternsUsed: this.secretScanner.getStats().patternCount,
        fileName: params.fileName
      }
    };
    logger.info(
      { scanId: result.scanId, findingCount: result.summary.totalFindings, duration },
      "Secret scanning completed"
    );
    const markdown = this.formatSecretScanAsMarkdown(result);
    return {
      content: [
        {
          type: "text",
          text: markdown
        }
      ]
    };
  }
  /**
   * Group secret findings by category
   */
  groupByCategory(findings) {
    const groups = {};
    for (const finding of findings) {
      groups[finding.category] = (groups[finding.category] ?? 0) + 1;
    }
    return groups;
  }
  /**
   * Format secret scan result as markdown
   */
  formatSecretScanAsMarkdown(result) {
    const lines = [];
    lines.push("# Secret Scan Results\n");
    if (result.summary.totalFindings === 0) {
      lines.push("No secrets detected in the code.\n");
    } else {
      lines.push("## Summary\n");
      lines.push(`- **Total Secrets Found:** ${result.summary.totalFindings}`);
      if (result.summary.critical > 0) lines.push(`- **Critical:** ${result.summary.critical}`);
      if (result.summary.high > 0) lines.push(`- **High:** ${result.summary.high}`);
      if (result.summary.medium > 0) lines.push(`- **Medium:** ${result.summary.medium}`);
      if (result.summary.low > 0) lines.push(`- **Low:** ${result.summary.low}`);
      lines.push("");
      const categories = Object.entries(result.summary.byCategory);
      if (categories.length > 0) {
        lines.push("### By Category\n");
        for (const [category, count] of categories) {
          lines.push(`- **${category.replace(/_/g, " ")}:** ${count}`);
        }
        lines.push("");
      }
      lines.push("## Findings\n");
      result.findings.forEach((finding, index) => {
        const severityEmoji = {
          critical: "\u{1F534}",
          high: "\u{1F7E0}",
          medium: "\u{1F7E1}",
          low: "\u{1F535}"
        }[finding.severity] ?? "\u26AA";
        lines.push(`### ${index + 1}. ${severityEmoji} ${finding.title}`);
        lines.push(`**Severity:** ${finding.severity.toUpperCase()}`);
        if (finding.line) lines.push(`**Line:** ${finding.line}`);
        lines.push("");
        lines.push(finding.description);
        lines.push("");
        if (finding.suggestion) {
          lines.push(`**Recommendation:** ${finding.suggestion}`);
          lines.push("");
        }
      });
    }
    lines.push("---");
    lines.push(
      `*Scan ID: ${result.scanId} | Patterns: ${result.metadata.patternsUsed} | Duration: ${result.metadata.duration}ms*`
    );
    return lines.join("\n");
  }
};

// src/prompts/schemas.ts
import { z as z9 } from "zod";
var CodeInputSchema = z9.object({
  code: z9.string().min(1).describe("Code to review")
});
var LanguageSchema = z9.string().optional().describe("Programming language");
var ThreatModelSchema2 = z9.enum([
  "local-user-tool",
  "internal-service",
  "multi-tenant",
  "public-api"
]).optional().describe("Threat model for security assessment");
var PlatformSchema2 = z9.enum([
  "windows",
  "unix",
  "cross-platform",
  "web",
  "mobile"
]).optional().describe("Target platform");
var FrameworkSchema = z9.string().optional().describe("Framework in use (e.g., react, express, fastapi)");
var FocusSchema = z9.string().optional().describe("Focus areas for analysis (comma-separated: security, performance, style, bugs)");
var SecurityReviewArgsSchema = z9.object({
  code: z9.string().min(1).describe("Code to review for security issues"),
  language: LanguageSchema,
  threatModel: ThreatModelSchema2,
  platform: PlatformSchema2,
  framework: FrameworkSchema
});
var PerformanceReviewArgsSchema = z9.object({
  code: z9.string().min(1).describe("Code to review for performance issues"),
  language: LanguageSchema,
  framework: FrameworkSchema
});
var StyleReviewArgsSchema = z9.object({
  code: z9.string().min(1).describe("Code to review for style issues"),
  language: LanguageSchema,
  framework: FrameworkSchema
});
var GeneralReviewArgsSchema = z9.object({
  code: z9.string().min(1).describe("Code to review"),
  language: LanguageSchema,
  focus: FocusSchema
});
var BugDetectionArgsSchema = z9.object({
  code: z9.string().min(1).describe("Code to check for bugs"),
  language: LanguageSchema,
  context: z9.string().optional().describe("Additional context about the code")
});

// src/prompts/builders/security-review.ts
function buildSecurityReviewPrompt(args) {
  const { code, language, threatModel, platform, framework } = args;
  const contextParts = [];
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

${contextParts.length > 0 ? `## Context
${contextParts.join("\n")}
` : ""}
${threatGuidelines ? `## Security Assessment Guidelines
${threatGuidelines}
` : ""}
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

\`\`\`${language ?? ""}
${code}
\`\`\`
`;
}
function getThreatModelGuidelines(threatModel) {
  switch (threatModel) {
    case "local-user-tool":
      return `This is a LOCAL USER TOOL - the user running the code is the same as the operator.
- Command injection: LOW severity (user can already run commands)
- Path traversal: LOW severity (user has filesystem access)
- Focus on: accidental data corruption, unintended side effects`;
    case "internal-service":
      return `This is an INTERNAL SERVICE - runs within a trusted network.
- Authentication: Should still verify internal callers
- Network security: Less critical but still review
- Focus on: proper logging, audit trails, resource limits`;
    case "multi-tenant":
      return `This is a MULTI-TENANT application - multiple users share resources.
- Tenant isolation: CRITICAL - ensure no cross-tenant data leakage
- Resource limits: Important to prevent DoS between tenants
- Focus on: authorization at every level, data partitioning`;
    case "public-api":
      return `This is a PUBLIC API - exposed to untrusted external users.
- All inputs are UNTRUSTED - validate everything
- Authentication: CRITICAL - robust auth mechanisms required
- Rate limiting: Essential to prevent abuse
- Focus on: defense in depth, assume breach mentality`;
    default:
      return "";
  }
}

// src/prompts/builders/performance-review.ts
function buildPerformanceReviewPrompt(args) {
  const { code, language, framework } = args;
  const contextParts = [];
  if (language) {
    contextParts.push(`Language: ${language}`);
  }
  if (framework) {
    contextParts.push(`Framework: ${framework}`);
  }
  const frameworkTips = getFrameworkPerformanceTips(framework);
  return `# Performance Code Review

${contextParts.length > 0 ? `## Context
${contextParts.join("\n")}
` : ""}
${frameworkTips ? `## Framework-Specific Considerations
${frameworkTips}
` : ""}
## Task
Perform a comprehensive performance review of the following code. Focus on:

1. **Time Complexity**: Identify inefficient algorithms (O(n\xB2) or worse)
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

\`\`\`${language ?? ""}
${code}
\`\`\`
`;
}
function getFrameworkPerformanceTips(framework) {
  if (!framework) return "";
  const tips = {
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
- Bundle analysis and code splitting`
  };
  return tips[framework.toLowerCase()] ?? "";
}

// src/prompts/builders/general-review.ts
function parseFocusAreas(focus) {
  if (!focus) {
    return ["security", "bugs", "performance", "style"];
  }
  return focus.split(",").map((f) => f.trim().toLowerCase()).filter((f) => ["security", "performance", "style", "bugs"].includes(f));
}
function buildGeneralReviewPrompt(args) {
  const { code, language, focus } = args;
  const contextParts = [];
  if (language) {
    contextParts.push(`Language: ${language}`);
  }
  const focusAreas = parseFocusAreas(focus);
  const focusSections = focusAreas.map((area) => getFocusSection(area)).join("\n");
  return `# Code Review

${contextParts.length > 0 ? `## Context
${contextParts.join("\n")}
` : ""}
## Focus Areas
${focusAreas.map((f) => `- ${f.charAt(0).toUpperCase() + f.slice(1)}`).join("\n")}

## Task
Perform a comprehensive code review of the following code.

${focusSections}

For each finding, provide:
- Category (${focusAreas.join("/")})
- Severity (Critical/High/Medium/Low)
- Description
- Recommended fix with code example

## Code to Review

\`\`\`${language ?? ""}
${code}
\`\`\`
`;
}
function getFocusSection(focus) {
  switch (focus) {
    case "security":
      return `### Security
- Input validation and sanitization
- Authentication and authorization
- Data protection and encryption
- Injection vulnerabilities`;
    case "performance":
      return `### Performance
- Algorithm efficiency
- Memory usage
- I/O operations optimization
- Caching opportunities`;
    case "style":
      return `### Code Style
- Naming conventions
- Code organization
- Documentation and comments
- Consistency with best practices`;
    case "bugs":
      return `### Bug Detection
- Logic errors
- Edge cases handling
- Null/undefined handling
- Error handling`;
    default:
      return "";
  }
}
function buildStyleReviewPrompt(args) {
  const { code, language, framework } = args;
  const contextParts = [];
  if (language) contextParts.push(`Language: ${language}`);
  if (framework) contextParts.push(`Framework: ${framework}`);
  return `# Code Style Review

${contextParts.length > 0 ? `## Context
${contextParts.join("\n")}
` : ""}
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

\`\`\`${language ?? ""}
${code}
\`\`\`
`;
}
function buildBugDetectionPrompt(args) {
  const { code, language, context } = args;
  const contextParts = [];
  if (language) contextParts.push(`Language: ${language}`);
  if (context) contextParts.push(`Context: ${context}`);
  return `# Bug Detection

${contextParts.length > 0 ? `## Context
${contextParts.join("\n")}
` : ""}
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

\`\`\`${language ?? ""}
${code}
\`\`\`
`;
}

// src/prompts/registry.ts
var DEFAULT_CONFIG3 = {
  enabled: true,
  builtInPrompts: [
    "security-review",
    "performance-review",
    "style-review",
    "general-review",
    "bug-detection"
  ]
};
var PromptRegistry = class {
  server;
  config;
  logger;
  constructor(server, config, logger) {
    this.server = server;
    this.config = { ...DEFAULT_CONFIG3, ...config };
    this.logger = logger ?? null;
  }
  /**
   * Register all enabled prompts
   */
  registerPrompts() {
    if (!this.config.enabled) {
      this.logger?.info("MCP Prompts disabled by configuration");
      return;
    }
    const prompts2 = this.config.builtInPrompts;
    this.logger?.info({ prompts: prompts2 }, "Registering MCP prompts");
    if (prompts2.includes("security-review")) {
      this.registerSecurityReview();
    }
    if (prompts2.includes("performance-review")) {
      this.registerPerformanceReview();
    }
    if (prompts2.includes("style-review")) {
      this.registerStyleReview();
    }
    if (prompts2.includes("general-review")) {
      this.registerGeneralReview();
    }
    if (prompts2.includes("bug-detection")) {
      this.registerBugDetection();
    }
    this.logger?.info({ count: prompts2.length }, "MCP prompts registered");
  }
  /**
   * Register security review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  registerSecurityReview() {
    this.server.prompt(
      "security-review",
      "Generate a security-focused code review prompt with threat model context",
      SecurityReviewArgsSchema.shape,
      async (args) => {
        const promptText = buildSecurityReviewPrompt(args);
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: promptText }
            }
          ]
        };
      }
    );
    this.logger?.debug("Registered prompt: security-review");
  }
  /**
   * Register performance review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  registerPerformanceReview() {
    this.server.prompt(
      "performance-review",
      "Generate a performance-focused code review prompt",
      PerformanceReviewArgsSchema.shape,
      async (args) => {
        const promptText = buildPerformanceReviewPrompt(args);
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: promptText }
            }
          ]
        };
      }
    );
    this.logger?.debug("Registered prompt: performance-review");
  }
  /**
   * Register style review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  registerStyleReview() {
    this.server.prompt(
      "style-review",
      "Generate a code style and best practices review prompt",
      StyleReviewArgsSchema.shape,
      async (args) => {
        const promptText = buildStyleReviewPrompt(args);
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: promptText }
            }
          ]
        };
      }
    );
    this.logger?.debug("Registered prompt: style-review");
  }
  /**
   * Register general review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  registerGeneralReview() {
    this.server.prompt(
      "general-review",
      "Generate a general code review prompt with configurable focus areas",
      GeneralReviewArgsSchema.shape,
      async (args) => {
        const promptText = buildGeneralReviewPrompt(args);
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: promptText }
            }
          ]
        };
      }
    );
    this.logger?.debug("Registered prompt: general-review");
  }
  /**
   * Register bug detection prompt
   * Uses schema from schemas.ts as single source of truth
   */
  registerBugDetection() {
    this.server.prompt(
      "bug-detection",
      "Generate a bug detection focused prompt",
      BugDetectionArgsSchema.shape,
      async (args) => {
        const promptText = buildBugDetectionPrompt(args);
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: promptText }
            }
          ]
        };
      }
    );
    this.logger?.debug("Registered prompt: bug-detection");
  }
};

// src/index.ts
async function main() {
  let logger;
  let cacheService = null;
  let cacheCleanupInterval = null;
  let dbManager = null;
  try {
    const config = await ConfigManager.load();
    logger = Logger.create({
      level: config.server.logLevel ?? config.logging.level,
      pretty: config.logging.pretty,
      file: config.logging.file
    });
    logger.info({ version: config.server.version }, "Starting AI Code Agent MCP Server");
    const server = new McpServer({
      name: config.server.name,
      version: config.server.version
    });
    if (config.cache.enabled) {
      if (config.storage.type === "sqlite") {
        dbManager = DatabaseManager.initialize(config.storage.sqlite, logger);
        const cacheRepo = new CacheRepository(
          dbManager.getDb(),
          {
            maxSize: config.cache.maxSize,
            defaultTtlMs: config.cache.ttl,
            touchIntervalMs: config.cache.touchIntervalMs
          },
          logger
        );
        cacheService = new CacheService(
          cacheRepo,
          {
            enabled: config.cache.enabled,
            ttl: config.cache.ttl,
            maxSize: config.cache.maxSize
          },
          logger
        );
        const cleanupIntervalMs = config.cache.cleanupIntervalMs ?? 5 * 60 * 1e3;
        if (cleanupIntervalMs > 0) {
          cacheCleanupInterval = setInterval(() => {
            cacheService?.cleanup();
          }, cleanupIntervalMs);
        }
      } else {
        logger.warn(
          { storageType: config.storage.type },
          "Cache enabled but storage type is not sqlite; cache disabled"
        );
      }
    }
    const codexService = config.codex.enabled ? new CodexAnalysisService(
      {
        ...config.codex,
        context: config.context,
        prompts: config.prompts,
        warnings: config.warnings
      },
      logger
    ) : null;
    const geminiService = config.gemini.enabled ? new GeminiAnalysisService(
      {
        ...config.gemini,
        context: config.context,
        prompts: config.prompts,
        warnings: config.warnings
      },
      logger
    ) : null;
    const aggregator = new AnalysisAggregator(config.analysis, logger);
    const registry = new ToolRegistry(server, {
      codexService,
      geminiService,
      aggregator,
      logger,
      config,
      cacheService: cacheService ?? void 0
    });
    registry.registerTools();
    const promptRegistry = new PromptRegistry(server, {
      enabled: true,
      builtInPrompts: [
        "security-review",
        "performance-review",
        "style-review",
        "general-review",
        "bug-detection"
      ]
    }, logger);
    promptRegistry.registerPrompts();
    const transport2 = new StdioServerTransport();
    await server.connect(transport2);
    logger.info("Code Review MCP Server started successfully");
    const shutdown = () => {
      logger?.info("Shutting down Code Review MCP Server");
      if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
      }
      if (dbManager) {
        dbManager.close();
        dbManager = null;
      }
      void server.close().then(() => process.exit(0)).catch((error) => {
        logger?.error({ error }, "Error during server shutdown");
        process.exit(1);
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    if (logger) {
      logger.error({ error }, "Failed to start Code Review MCP Server");
    } else {
      console.error("Fatal error:", error);
    }
    process.exit(1);
  }
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
