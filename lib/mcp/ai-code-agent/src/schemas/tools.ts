/**
 * Zod schemas for tool inputs and outputs
 */

import { z } from 'zod';

import { AnalysisContextSchema } from './context.js';

// Common schemas
export const AnalysisFocusSchema = z.enum(['security', 'performance', 'style', 'bugs', 'all']);

export const FindingTypeSchema = z.enum(['bug', 'security', 'performance', 'style', 'suggestion']);

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const AnalysisFindingSchema = z.object({
  type: FindingTypeSchema,
  severity: SeveritySchema,
  line: z.number().nullable(),
  lineRange: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
  code: z.string().optional(),
});

export const AnalysisSummarySchema = z.object({
  totalFindings: z.number(),
  critical: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
});

/**
 * Context warning schema for missing/incomplete analysis context
 */
export const ContextWarningSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning']),
  message: z.string(),
  tip: z.string().optional(),
  field: z.string(),
});

/**
 * Resolved context schema for tracking what context was used
 */
export const ResolvedContextSchema = z.object({
  threatModel: z.string().optional(),
  platform: z.string().optional(),
  projectType: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  scope: z.string().optional(),
  fileName: z.string().optional(),
});

export const AnalysisMetadataSchema = z.object({
  language: z.string().optional(),
  linesOfCode: z.number().optional(),
  analysisDuration: z.number(),
  fromCache: z.boolean().optional(),
  cacheKey: z.string().optional(),
  // Context-related metadata
  resolvedContext: ResolvedContextSchema.optional(),
  warnings: z.array(ContextWarningSchema).optional(),
  templateUsed: z.string().optional(),
  autoDetected: z.boolean().optional(),
});

const CodeAnalysisOptionsSchema = z
  .object({
    timeout: z
      .number({
        invalid_type_error: 'Timeout must be a number (milliseconds)',
      })
      .min(0, {
        message: 'Timeout must be 0 (unlimited) or a positive number in milliseconds',
      })
      .optional() // 0 = unlimited, defaults handled in service
      .describe('Execution timeout in milliseconds (0 = unlimited)'),
    severity: z
      .enum(['all', 'high', 'medium'], {
        errorMap: () => ({
          message:
            "Severity must be one of: 'all' (all findings), 'high' (critical + high), or 'medium' (critical + high + medium)",
        }),
      })
      .optional(), // defaults to 'all' in service
    cliPath: z
      .string({
        invalid_type_error: 'CLI path must be a string',
      })
      .min(1, {
        message: 'CLI path cannot be empty if provided',
      })
      .optional()
      .describe('Custom CLI executable path (must be whitelisted for security)'),

    // New context-related options
    template: z
      .string()
      .optional()
      .describe('Prompt template ID to use (e.g., default, security-focused)'),
    preset: z
      .string()
      .optional()
      .describe('Context preset name to apply (e.g., react-web, nodejs-api, mcp-server)'),
    autoDetect: z
      .boolean()
      .optional() // defaults to true in service
      .describe('Enable auto-detection of language, framework, platform'),
    warnOnMissingContext: z
      .boolean()
      .optional() // defaults to true in service
      .describe('Show warnings when important context is missing'),
  })
  .optional();

type CodeAnalysisParamsSchemaType = z.ZodObject<{
  prompt: z.ZodString;
  context: z.ZodOptional<typeof AnalysisContextSchema>;
  options: typeof CodeAnalysisOptionsSchema;
}>;

/**
 * Create Code Analysis Params Schema with configurable max prompt length
 * Simplified to accept a single prompt parameter instead of structured code/context
 * Enhanced with detailed error messages for better UX
 */
export const createCodeAnalysisParamsSchema = (
  maxPromptLength: number = 100000
): CodeAnalysisParamsSchemaType =>
  z.object({
    prompt: z
      .string({
        required_error: 'Prompt is required',
        invalid_type_error: 'Prompt must be a string',
      })
      .min(1, {
        message: 'Prompt cannot be empty - please provide code or instructions to analyze',
      })
      .max(maxPromptLength, {
        message: `Prompt exceeds maximum length of ${maxPromptLength} characters. Consider splitting into smaller analyses or use a more concise prompt.`,
      })
      .describe('Prompt for code analysis (can include code, instructions, context, etc.)'),

    // Analysis context for more accurate findings
    context: AnalysisContextSchema.optional().describe(
      'Analysis context (threatModel, platform, projectType, language, framework, scope) for more accurate findings'
    ),

    options: CodeAnalysisOptionsSchema,
  });

// Default schema with 100000 max length
export const CodeAnalysisParamsSchema = createCodeAnalysisParamsSchema(100000);

export const createCombinedAnalysisInputSchema = (
  maxPromptLength: number = 100000
) =>
  z.object({
    prompt: z
      .string({
        required_error: 'Prompt is required',
        invalid_type_error: 'Prompt must be a string',
      })
      .min(1, {
        message: 'Prompt cannot be empty - please provide code or instructions to analyze',
      })
      .max(maxPromptLength, {
        message: `Prompt exceeds maximum length of ${maxPromptLength} characters. Consider splitting into smaller analyses.`,
      })
      .describe('Prompt for code analysis'),

    // Analysis context for more accurate findings
    context: AnalysisContextSchema.optional().describe(
      'Analysis context (threatModel, platform, projectType, language, framework, scope) for more accurate findings'
    ),

    options: z
      .object({
        timeout: z
          .number({
            invalid_type_error: 'Timeout must be a number (milliseconds)',
          })
          .min(0, {
            message: 'Timeout must be 0 (unlimited) or a positive number in milliseconds',
          })
          .optional() // 0 = unlimited, defaults handled in service
          .describe('Execution timeout in milliseconds (0 = unlimited)'),
        severity: z
          .enum(['all', 'high', 'medium'], {
            errorMap: () => ({
              message: "Severity must be one of: 'all', 'high', or 'medium'",
            }),
          })
          .optional(), // defaults to 'all' in service
        parallelExecution: z
          .boolean({
            invalid_type_error: 'parallelExecution must be a boolean (true or false)',
          })
          .optional() // defaults to true in service
          .describe('Run Codex and Gemini analyses in parallel (true) or sequentially (false)'),
        includeIndividualAnalyses: z
          .boolean({
            invalid_type_error: 'includeIndividualAnalyses must be a boolean (true or false)',
          })
          .optional() // defaults to false in service
          .describe(
            'Include individual analysis results from Codex and Gemini in the combined output'
          ),

        // New context-related options
        template: z.string().optional().describe('Prompt template ID to use'),
        preset: z.string().optional().describe('Context preset name to apply'),
        autoDetect: z
          .boolean()
          .optional() // defaults to true in service
          .describe('Enable auto-detection of language, framework, platform'),
        warnOnMissingContext: z
          .boolean()
          .optional() // defaults to true in service
          .describe('Show warnings when important context is missing'),
      })
      .optional(),
  });

export const CombinedAnalysisInputSchema = createCombinedAnalysisInputSchema(100000);

// Output schemas
export const AnalysisResultSchema = z.object({
  success: z.boolean(),
  analysisId: z.string(),
  timestamp: z.string(),
  source: z.enum(['codex', 'gemini', 'combined']),
  summary: AnalysisSummarySchema,
  findings: z.array(AnalysisFindingSchema),
  overallAssessment: z.string(),
  recommendations: z.array(z.string()).optional(),
  metadata: AnalysisMetadataSchema,
  rawOutput: z.string().optional(),
});

export const AggregatedFindingSchema = AnalysisFindingSchema.extend({
  sources: z.array(z.enum(['codex', 'gemini'])),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const AggregatedAnalysisSchema = z.object({
  success: z.boolean(),
  analysisId: z.string(),
  timestamp: z.string(),
  source: z.literal('combined'),
  summary: AnalysisSummarySchema.extend({
    consensus: z.number().min(0).max(100),
  }),
  findings: z.array(AggregatedFindingSchema),
  overallAssessment: z.string(),
  recommendations: z.array(z.string()).optional(),
  individualAnalyses: z
    .object({
      codex: AnalysisResultSchema.optional(),
      gemini: AnalysisResultSchema.optional(),
    })
    .optional(),
  metadata: AnalysisMetadataSchema.extend({
    codexDuration: z.number().optional(),
    geminiDuration: z.number().optional(),
  }),
});

// Type exports
export type CodeAnalysisParams = z.infer<typeof CodeAnalysisParamsSchema>;
export type CombinedAnalysisInput = z.infer<typeof CombinedAnalysisInputSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AggregatedAnalysis = z.infer<typeof AggregatedAnalysisSchema>;
export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;
export type AggregatedFinding = z.infer<typeof AggregatedFindingSchema>;
