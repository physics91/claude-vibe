/**
 * Zod schemas for analysis context
 * Provides context-aware code analysis with threat model, platform, and project type support
 */

import { z } from 'zod';

// Threat model types for security analysis context
export const ThreatModelSchema = z
  .enum(['local-user-tool', 'internal-service', 'multi-tenant', 'public-api'])
  .or(z.string())
  .describe('Threat model for security severity assessment');

// Target platform for platform-specific analysis
export const PlatformSchema = z
  .enum(['windows', 'unix', 'cross-platform', 'web', 'mobile'])
  .or(z.string())
  .describe('Target platform for platform-specific code analysis');

// Project type for contextual analysis
export const ProjectTypeSchema = z
  .enum(['mcp-server', 'web-app', 'cli-tool', 'library', 'api-service'])
  .or(z.string())
  .describe('Project type for contextual analysis');

// Code scope/completeness indicator
export const ScopeSchema = z
  .enum(['full', 'partial', 'snippet'])
  .describe('Code completeness: full=complete file, partial=incomplete, snippet=code fragment');

// Analysis focus areas
export const FocusAreaSchema = z.enum(['security', 'performance', 'style', 'bugs']);

/**
 * Main Analysis Context Schema
 * All fields are optional for backward compatibility
 */
export const AnalysisContextSchema = z
  .object({
    // Core context fields
    threatModel: ThreatModelSchema.optional().describe(
      'Threat model: local-user-tool (trusted), internal-service, multi-tenant (shared), public-api (untrusted)'
    ),
    platform: PlatformSchema.optional().describe(
      'Target platform for platform-specific security checks'
    ),
    projectType: ProjectTypeSchema.optional().describe('Project type for contextual analysis'),
    language: z
      .string()
      .optional()
      .describe('Primary programming language (e.g., typescript, python, go)'),
    framework: z.string().optional().describe('Framework in use (e.g., react, express, fastapi)'),

    // Code completeness
    scope: ScopeSchema.optional().describe(
      'Code completeness indicator to avoid false positives like "unused import"'
    ),
    fileName: z.string().optional().describe('File name for context and auto-detection'),

    // Analysis focus
    focus: z
      .array(FocusAreaSchema)
      .optional()
      .describe('Focus areas for analysis: security, performance, style, bugs'),

    // Preset reference
    preset: z
      .string()
      .optional()
      .describe('Context preset name to apply (e.g., react-web, nodejs-api)'),

    // Extension point for custom context
    custom: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Custom context fields for extensibility'),
  })
  .passthrough(); // Allow unknown fields for future extensibility

export type AnalysisContext = z.infer<typeof AnalysisContextSchema>;
export type ThreatModel = z.infer<typeof ThreatModelSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type FocusArea = z.infer<typeof FocusAreaSchema>;
