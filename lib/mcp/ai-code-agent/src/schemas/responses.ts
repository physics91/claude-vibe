/**
 * Response validation schemas for AI services
 * DRY: Unified schema for all AI analysis responses
 */

import { z } from 'zod';

import { FindingTypeSchema, SeveritySchema } from './tools.js';

/**
 * Finding schema - shared by all analysis services
 */
export const AnalysisFindingSchema = z.object({
  type: FindingTypeSchema,
  severity: SeveritySchema,
  line: z.number().nullable(),
  title: z.string().min(1),
  description: z.string().min(1),
  suggestion: z.string().optional(),
  code: z.string().optional(),
});

export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;

/**
 * Unified Analysis Response Schema
 * Used by both Codex and Gemini services
 */
export const AnalysisResponseSchema = z.object({
  findings: z.array(AnalysisFindingSchema),
  overallAssessment: z.string().min(1),
  recommendations: z.array(z.string()).optional(),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

/**
 * @deprecated Use AnalysisResponseSchema instead
 * Kept for backward compatibility
 */
export const CodexResponseSchema = AnalysisResponseSchema;
export type CodexResponse = AnalysisResponse;

/**
 * @deprecated Use AnalysisResponseSchema instead
 * Kept for backward compatibility
 */
export const GeminiResponseSchema = AnalysisResponseSchema;
export type GeminiResponse = AnalysisResponse;
