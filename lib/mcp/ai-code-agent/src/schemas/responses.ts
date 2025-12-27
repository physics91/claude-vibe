/**
 * Response validation schemas for AI services
 */

import { z } from 'zod';

import { FindingTypeSchema, SeveritySchema } from './tools.js';

/**
 * Codex Response Schema
 * Validates responses from the Codex MCP tool
 */
export const CodexResponseSchema = z.object({
  findings: z.array(
    z.object({
      type: FindingTypeSchema,
      severity: SeveritySchema,
      line: z.number().nullable(),
      title: z.string().min(1),
      description: z.string().min(1),
      suggestion: z.string().optional(),
      code: z.string().optional(),
    })
  ),
  overallAssessment: z.string().min(1),
  recommendations: z.array(z.string()).optional(),
});

export type CodexResponse = z.infer<typeof CodexResponseSchema>;

/**
 * Gemini Response Schema
 * Validates responses from the Gemini CLI
 */
export const GeminiResponseSchema = z.object({
  findings: z.array(
    z.object({
      type: FindingTypeSchema,
      severity: SeveritySchema,
      line: z.number().nullable(),
      title: z.string().min(1),
      description: z.string().min(1),
      suggestion: z.string().optional(),
      code: z.string().optional(),
    })
  ),
  overallAssessment: z.string().min(1),
  recommendations: z.array(z.string()).optional(),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;
