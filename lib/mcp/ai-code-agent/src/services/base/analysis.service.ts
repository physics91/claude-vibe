/**
 * Base Analysis Service
 * Abstract base class for CLI-based analysis services (Codex, Gemini)
 * Extracts common functionality to reduce code duplication
 */

import type { Logger } from '../../core/logger.js';
import { RetryManager } from '../../core/retry.js';
import { generateUUID, stripAnsiCodes } from '../../core/utils.js';
import type { CodeAnalysisParams, AnalysisResult } from '../../schemas/tools.js';

/**
 * Base service configuration shared by all analysis services
 */
export interface BaseServiceConfig {
  cliPath: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  model?: string | null;
  args?: string[];
}

/**
 * Result of CLI execution
 */
export interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Abstract base class for analysis services
 * Provides common functionality for CLI-based code analysis
 */
export abstract class BaseAnalysisService {
  // Service name for logging and identification
  protected abstract readonly serviceName: string;

  // CLI-related properties
  protected allowedCLIPaths: string[] = [];
  protected detectedCLIPath: string | null = null;

  // Maximum output size to parse
  protected static readonly MAX_PARSE_SIZE = 1024 * 1024; // 1MB

  // Retry manager
  protected retryManager: RetryManager;

  constructor(
    protected config: BaseServiceConfig,
    protected logger: Logger
  ) {
    // Initialize retry manager
    this.retryManager = new RetryManager(
      {
        maxAttempts: config.retryAttempts,
        initialDelay: config.retryDelay,
        maxDelay: 10000,
        backoffFactor: 2,
      },
      logger
    );
  }

  /**
   * Initialize CLI path detection
   * Should be implemented by subclasses to detect their specific CLI
   */
  protected abstract initializeCLIPath(): Promise<void>;

  /**
   * Get the resolved CLI path to use
   */
  protected abstract getResolvedCLIPath(): string;

  /**
   * Build CLI arguments for the analysis
   */
  protected abstract buildCLIArgs(prompt: string): string[];

  /**
   * Execute CLI command and return result
   */
  protected abstract executeCLI(args: string[]): Promise<CLIExecutionResult>;

  /**
   * Parse CLI response into structured result
   */
  protected abstract parseResponse(output: string): unknown;

  /**
   * Analyze code (main entry point)
   */
  abstract analyze(params: CodeAnalysisParams): Promise<AnalysisResult>;

  /**
   * Generate analysis ID
   */
  protected generateAnalysisId(): string {
    return generateUUID();
  }

  /**
   * Strip ANSI codes from output
   */
  protected cleanOutput(output: string): string {
    return stripAnsiCodes(output);
  }

  /**
   * Check if output is within size limits
   */
  protected isOutputWithinLimits(output: string): boolean {
    return output.length <= BaseAnalysisService.MAX_PARSE_SIZE;
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initializeCLIPath();
      return {
        healthy: this.detectedCLIPath !== null,
        message: this.detectedCLIPath
          ? `CLI available at: ${this.detectedCLIPath}`
          : 'CLI not detected',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
