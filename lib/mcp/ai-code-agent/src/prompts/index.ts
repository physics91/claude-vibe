/**
 * Prompts Module
 * Entry point for MCP Prompts functionality
 */

export { PromptRegistry } from './registry.js';
export type { PromptRegistryConfig } from './registry.js';

export * from './schemas.js';

export { buildSecurityReviewPrompt } from './builders/security-review.js';
export { buildPerformanceReviewPrompt } from './builders/performance-review.js';
export {
  buildGeneralReviewPrompt,
  buildStyleReviewPrompt,
  buildBugDetectionPrompt,
} from './builders/general-review.js';
