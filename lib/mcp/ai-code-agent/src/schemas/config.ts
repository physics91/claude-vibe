/**
 * Zod schemas for configuration
 */

import { z } from 'zod';

import { AnalysisContextSchema } from './context.js';
import { PromptTemplateSchema } from './prompts.js';

export const ServerConfigSchema = z.object({
  server: z.object({
    name: z.string().default('ai-code-agent-mcp'),
    version: z.string().default('1.2.0'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    transport: z.enum(['stdio', 'http']).default('stdio'),
  }),

  codex: z.object({
    enabled: z.boolean().default(true),
    cliPath: z.string().default('codex'),
    timeout: z.number().min(0).default(0), // 0 = unlimited
    retryAttempts: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(0).default(1000),
    maxConcurrent: z.number().min(1).max(10).default(1),
    queue: z
      .object({
        interval: z.number().min(0).optional(),
        intervalCap: z.number().min(1).optional(),
      })
      .default({}),
    output: z
      .object({
        mode: z.enum(['jsonl', 'last-message']).default('last-message'),
        lastMessageFileDir: z.string().optional(),
        outputSchemaPath: z.string().optional(),
      })
      .default({ mode: 'last-message' }),
    model: z.string().nullable().default('gpt-5.2'),
    search: z.boolean().default(true),
    reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).default('high'),
    args: z.array(z.string()).default([]),
  }),

  gemini: z.object({
    enabled: z.boolean().default(true),
    cliPath: z.string().default('/usr/local/bin/gemini'),
    timeout: z.number().min(0).default(0), // 0 = unlimited
    retryAttempts: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(0).default(1000),
    maxConcurrent: z.number().min(1).max(10).default(1),
    queue: z
      .object({
        interval: z.number().min(0).optional(),
        intervalCap: z.number().min(1).optional(),
      })
      .default({}),
    model: z.string().nullable().default('gemini-3-pro-preview'),
    args: z.array(z.string()).default([]),
  }),

  analysis: z.object({
    maxCodeLength: z.number().min(100).max(1000000).default(50000),
    includeContext: z.boolean().default(true),
    defaultLanguage: z.string().nullable().default(null),
    maxFindings: z.number().min(1).max(10000).default(200),
    maxCodeSnippetLength: z.number().min(0).max(100000).default(4000),
    maxOutputChars: z.number().min(0).max(1000000).default(200000),
    formats: z.array(z.enum(['markdown', 'json', 'html'])).default(['markdown', 'json']),
    defaultSeverity: z.enum(['all', 'high', 'medium']).default('all'),
    deduplication: z.object({
      enabled: z.boolean().default(true),
      similarityThreshold: z.number().min(0).max(1).default(0.8),
    }),
  }),

  retry: z.object({
    maxAttempts: z.number().min(0).max(10).default(3),
    initialDelay: z.number().min(0).default(1000),
    maxDelay: z.number().min(0).default(10000),
    backoffFactor: z.number().min(1).default(2),
    retryableErrors: z
      .array(z.string())
      .default(['TIMEOUT_ERROR', 'NETWORK_ERROR', 'CLI_EXECUTION_ERROR']),
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    pretty: z.boolean().default(true),
    file: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('./logs/ai-code-agent-mcp.log'),
      maxSize: z.string().default('10M'),
      maxFiles: z.number().default(5),
    }),
  }),

  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().min(0).default(3600000),
    maxSize: z.number().min(0).default(1000),
    strategy: z.enum(['lru', 'fifo']).default('lru'),
    cleanupIntervalMs: z.number().min(0).default(300000),
    touchIntervalMs: z.number().min(0).default(30000),
  }),

  storage: z.object({
    type: z.enum(['memory', 'sqlite']).default('sqlite'),
    sqlite: z.object({
      path: z.string().default('./data/ai-code-agent.db'),
      enableWAL: z.boolean().default(true),
      busyTimeout: z.number().min(0).default(5000),
    }).default({}),
  }).default({}),

  secretScanning: z.object({
    enabled: z.boolean().default(true),
    maxScanLength: z.number().min(0).default(200000),
    maxLineLength: z.number().min(0).default(10000),
    patterns: z.object({
      aws: z.boolean().default(true),
      gcp: z.boolean().default(true),
      azure: z.boolean().default(true),
      github: z.boolean().default(true),
      generic: z.boolean().default(true),
      database: z.boolean().default(true),
      privateKeys: z.boolean().default(true),
    }),
    excludePatterns: z
      .array(z.string())
      .default([
        '.*\\.test\\.(ts|js|tsx|jsx)$',
        '.*\\.spec\\.(ts|js|tsx|jsx)$',
        '.*__tests__.*',
        '.*\\.mock\\.(ts|js)$',
      ]),
  }),

  // Context configuration for analysis
  context: z
    .object({
      defaults: AnalysisContextSchema.optional().describe(
        'Default context applied to all analyses'
      ),
      presets: z
        .record(z.string(), AnalysisContextSchema)
        .optional()
        .describe('Named context presets (e.g., react-web, nodejs-api)'),
      activePreset: z
        .string()
        .nullable()
        .default(null)
        .describe('Active preset name to apply by default'),
      allowEnvOverride: z
        .boolean()
        .default(true)
        .describe('Allow environment variables to override context'),
      autoDetect: z
        .boolean()
        .default(true)
        .describe('Enable auto-detection of language, framework, platform'),
    })
    .default({}),

  // Prompt template configuration
  prompts: z
    .object({
      templates: z
        .record(z.string(), PromptTemplateSchema)
        .optional()
        .describe('Custom prompt templates'),
      defaultTemplate: z.string().default('default').describe('Default template ID to use'),
      serviceTemplates: z
        .object({
          codex: z.string().optional().describe('Template override for Codex'),
          gemini: z.string().optional().describe('Template override for Gemini'),
        })
        .optional()
        .describe('Service-specific template overrides'),
    })
    .default({}),

  // Warning system configuration
  warnings: z
    .object({
      enabled: z.boolean().default(true).describe('Enable context warnings'),
      showTips: z.boolean().default(true).describe('Show tips with warnings'),
      suppressions: z
        .array(z.string())
        .default([])
        .describe('Warning codes to suppress (e.g., MISSING_SCOPE)'),
    })
    .default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
