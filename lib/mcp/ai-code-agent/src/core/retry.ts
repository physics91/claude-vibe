/**
 * Retry logic with exponential backoff
 */

import { ErrorHandler } from './error-handler.js';
import type { Logger } from './logger.js';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class RetryManager {
  constructor(
    private config: RetryConfig,
    private logger: Logger
  ) {}

  /**
   * Execute function with retry logic
   * CRITICAL FIX #9: Handle retryAttempts=0 (ensure at least one attempt)
   */
  async execute<T>(fn: () => Promise<T>, operation: string): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 1;
    const maxAttempts = Math.max(1, this.config.maxAttempts); // At least 1 attempt

    while (attempt <= maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt >= maxAttempts || !ErrorHandler.isRetryable(error)) {
          break;
        }

        const delay = this.calculateBackoff(attempt);
        this.logger.warn(
          {
            attempt,
            maxAttempts,
            delay,
            operation,
            error: lastError.message,
          },
          `Retrying ${operation}`
        );

        await this.sleep(delay);
        attempt++;
      }
    }

    // lastError is guaranteed to be defined if we reach here (at least one attempt)
    throw lastError!;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
