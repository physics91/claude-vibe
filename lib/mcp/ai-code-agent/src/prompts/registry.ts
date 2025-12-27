/**
 * MCP Prompts Registry
 * Registers prompts using MCP SDK v1.24.3 API
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../core/logger.js';
import {
  SecurityReviewArgsSchema,
  PerformanceReviewArgsSchema,
  StyleReviewArgsSchema,
  GeneralReviewArgsSchema,
  BugDetectionArgsSchema,
  type SecurityReviewArgs,
  type PerformanceReviewArgs,
  type StyleReviewArgs,
  type GeneralReviewArgs,
  type BugDetectionArgs,
} from './schemas.js';
import { buildSecurityReviewPrompt } from './builders/security-review.js';
import { buildPerformanceReviewPrompt } from './builders/performance-review.js';
import {
  buildGeneralReviewPrompt,
  buildStyleReviewPrompt,
  buildBugDetectionPrompt,
} from './builders/general-review.js';

export interface PromptRegistryConfig {
  enabled: boolean;
  builtInPrompts: string[];
}

const DEFAULT_CONFIG: PromptRegistryConfig = {
  enabled: true,
  builtInPrompts: [
    'security-review',
    'performance-review',
    'style-review',
    'general-review',
    'bug-detection',
  ],
};

/**
 * Prompt Registry
 * Manages MCP prompt registration
 */
export class PromptRegistry {
  private server: McpServer;
  private config: PromptRegistryConfig;
  private logger: Logger | null;

  constructor(server: McpServer, config?: Partial<PromptRegistryConfig>, logger?: Logger) {
    this.server = server;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? null;
  }

  /**
   * Register all enabled prompts
   */
  registerPrompts(): void {
    if (!this.config.enabled) {
      this.logger?.info('MCP Prompts disabled by configuration');
      return;
    }

    const prompts = this.config.builtInPrompts;
    this.logger?.info({ prompts }, 'Registering MCP prompts');

    if (prompts.includes('security-review')) {
      this.registerSecurityReview();
    }

    if (prompts.includes('performance-review')) {
      this.registerPerformanceReview();
    }

    if (prompts.includes('style-review')) {
      this.registerStyleReview();
    }

    if (prompts.includes('general-review')) {
      this.registerGeneralReview();
    }

    if (prompts.includes('bug-detection')) {
      this.registerBugDetection();
    }

    this.logger?.info({ count: prompts.length }, 'MCP prompts registered');
  }

  /**
   * Register security review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  private registerSecurityReview(): void {
    this.server.prompt(
      'security-review',
      'Generate a security-focused code review prompt with threat model context',
      SecurityReviewArgsSchema.shape,
      async (args) => {
        // Args already validated by MCP SDK using the schema above
        const promptText = buildSecurityReviewPrompt(args as SecurityReviewArgs);

        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: promptText },
            },
          ],
        };
      }
    );

    this.logger?.debug('Registered prompt: security-review');
  }

  /**
   * Register performance review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  private registerPerformanceReview(): void {
    this.server.prompt(
      'performance-review',
      'Generate a performance-focused code review prompt',
      PerformanceReviewArgsSchema.shape,
      async (args) => {
        // Args already validated by MCP SDK using the schema above
        const promptText = buildPerformanceReviewPrompt(args as PerformanceReviewArgs);

        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: promptText },
            },
          ],
        };
      }
    );

    this.logger?.debug('Registered prompt: performance-review');
  }

  /**
   * Register style review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  private registerStyleReview(): void {
    this.server.prompt(
      'style-review',
      'Generate a code style and best practices review prompt',
      StyleReviewArgsSchema.shape,
      async (args) => {
        // Args already validated by MCP SDK using the schema above
        const promptText = buildStyleReviewPrompt(args as StyleReviewArgs);

        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: promptText },
            },
          ],
        };
      }
    );

    this.logger?.debug('Registered prompt: style-review');
  }

  /**
   * Register general review prompt
   * Uses schema from schemas.ts as single source of truth
   */
  private registerGeneralReview(): void {
    this.server.prompt(
      'general-review',
      'Generate a general code review prompt with configurable focus areas',
      GeneralReviewArgsSchema.shape,
      async (args) => {
        // Args already validated by MCP SDK using the schema above
        const promptText = buildGeneralReviewPrompt(args as GeneralReviewArgs);

        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: promptText },
            },
          ],
        };
      }
    );

    this.logger?.debug('Registered prompt: general-review');
  }

  /**
   * Register bug detection prompt
   * Uses schema from schemas.ts as single source of truth
   */
  private registerBugDetection(): void {
    this.server.prompt(
      'bug-detection',
      'Generate a bug detection focused prompt',
      BugDetectionArgsSchema.shape,
      async (args) => {
        // Args already validated by MCP SDK using the schema above
        const promptText = buildBugDetectionPrompt(args as BugDetectionArgs);

        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: promptText },
            },
          ],
        };
      }
    );

    this.logger?.debug('Registered prompt: bug-detection');
  }
}
