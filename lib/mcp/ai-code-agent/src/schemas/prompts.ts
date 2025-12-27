/**
 * Zod schemas for prompt templates
 * Supports conditional sections and template variables
 */

import { z } from 'zod';

/**
 * Prompt Section Schema
 * Represents a conditional section that can be included in a prompt
 */
export const PromptSectionSchema = z.object({
  id: z.string().describe('Unique identifier for the section'),
  condition: z
    .string()
    .optional()
    .describe('Condition for including this section (e.g., "threatModel === \'public-api\'")'),
  content: z.string().describe('Content of the section'),
  priority: z.number().default(0).describe('Priority for ordering sections (lower = earlier)'),
});

/**
 * Prompt Template Schema
 * Defines a complete prompt template with variables and conditional sections
 */
export const PromptTemplateSchema = z.object({
  id: z.string().describe('Unique identifier for the template'),
  name: z.string().describe('Human-readable name for the template'),
  description: z.string().optional().describe('Description of the template purpose'),
  template: z
    .string()
    .describe(
      'Template string with {{variable}} placeholders: {{contextSection}}, {{formatInstructions}}, {{prompt}}'
    ),
  sections: z
    .array(PromptSectionSchema)
    .optional()
    .describe('Conditional sections to include based on context'),
  outputFormat: z
    .enum(['json', 'markdown'])
    .default('json')
    .describe('Expected output format from AI'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
});

/**
 * Prompt Template Registry Schema
 * Collection of templates with service-specific overrides
 */
export const PromptTemplateRegistrySchema = z.object({
  templates: z
    .record(z.string(), PromptTemplateSchema)
    .optional()
    .describe('Map of template ID to template definition'),
  defaultTemplate: z.string().default('default').describe('Default template ID to use'),
  serviceTemplates: z
    .object({
      codex: z.string().optional().describe('Template ID override for Codex'),
      gemini: z.string().optional().describe('Template ID override for Gemini'),
    })
    .optional()
    .describe('Service-specific template overrides'),
});

export type PromptSection = z.infer<typeof PromptSectionSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type PromptTemplateRegistry = z.infer<typeof PromptTemplateRegistrySchema>;
