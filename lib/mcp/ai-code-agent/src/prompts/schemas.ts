/**
 * MCP Prompt Schemas
 * Zod schemas for prompt arguments validation
 */

import { z } from 'zod';

/**
 * Common code input schema
 */
export const CodeInputSchema = z.object({
  code: z.string().min(1).describe('Code to review'),
});

/**
 * Language schema
 * Note: Using z.string() for flexibility - MCP clients may send any language string
 */
export const LanguageSchema = z.string().optional().describe('Programming language');

/**
 * Threat model schema
 */
export const ThreatModelSchema = z.enum([
  'local-user-tool',
  'internal-service',
  'multi-tenant',
  'public-api',
]).optional().describe('Threat model for security assessment');

/**
 * Platform schema
 */
export const PlatformSchema = z.enum([
  'windows',
  'unix',
  'cross-platform',
  'web',
  'mobile',
]).optional().describe('Target platform');

/**
 * Framework schema
 */
export const FrameworkSchema = z.string().optional().describe('Framework in use (e.g., react, express, fastapi)');

/**
 * Focus areas schema
 * Note: MCP protocol only supports string arguments, so focus is comma-separated
 * Example: "security,performance" or "security, performance, bugs"
 */
export const FocusSchema = z.string().optional().describe('Focus areas for analysis (comma-separated: security, performance, style, bugs)');

/**
 * Security Review prompt arguments
 */
export const SecurityReviewArgsSchema = z.object({
  code: z.string().min(1).describe('Code to review for security issues'),
  language: LanguageSchema,
  threatModel: ThreatModelSchema,
  platform: PlatformSchema,
  framework: FrameworkSchema,
});

/**
 * Performance Review prompt arguments
 */
export const PerformanceReviewArgsSchema = z.object({
  code: z.string().min(1).describe('Code to review for performance issues'),
  language: LanguageSchema,
  framework: FrameworkSchema,
});

/**
 * Style Review prompt arguments
 */
export const StyleReviewArgsSchema = z.object({
  code: z.string().min(1).describe('Code to review for style issues'),
  language: LanguageSchema,
  framework: FrameworkSchema,
});

/**
 * General Review prompt arguments
 */
export const GeneralReviewArgsSchema = z.object({
  code: z.string().min(1).describe('Code to review'),
  language: LanguageSchema,
  focus: FocusSchema,
});

/**
 * Bug Detection prompt arguments
 */
export const BugDetectionArgsSchema = z.object({
  code: z.string().min(1).describe('Code to check for bugs'),
  language: LanguageSchema,
  context: z.string().optional().describe('Additional context about the code'),
});

// Export types
export type SecurityReviewArgs = z.infer<typeof SecurityReviewArgsSchema>;
export type PerformanceReviewArgs = z.infer<typeof PerformanceReviewArgsSchema>;
export type StyleReviewArgs = z.infer<typeof StyleReviewArgsSchema>;
export type GeneralReviewArgs = z.infer<typeof GeneralReviewArgsSchema>;
export type BugDetectionArgs = z.infer<typeof BugDetectionArgsSchema>;
