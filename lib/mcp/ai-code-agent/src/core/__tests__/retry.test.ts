/**
 * RetryManager Tests
 * Tests for retry logic with exponential backoff
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryManager, type RetryConfig } from '../retry.js';
import { ErrorHandler } from '../error-handler.js';
import type { Logger } from '../logger.js';

// Mock ErrorHandler
vi.mock('../error-handler.js', () => ({
  ErrorHandler: {
    isRetryable: vi.fn(),
  },
}));

// Mock logger
const createMockLogger = (): Logger =>
  ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  }) as unknown as Logger;

describe('RetryManager', () => {
  let mockLogger: Logger;
  let defaultConfig: RetryConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLogger = createMockLogger();
    defaultConfig = {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffFactor: 2,
    };

    // Default: all errors are retryable
    vi.mocked(ErrorHandler.isRetryable).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with config and logger', () => {
      const manager = new RetryManager(defaultConfig, mockLogger);

      expect(manager).toBeDefined();
    });
  });

  describe('execute', () => {
    describe('successful execution', () => {
      it('should return result on first attempt success', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi.fn().mockResolvedValue('success');

        const result = await manager.execute(fn, 'test-operation');

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should not log warning on first attempt success', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi.fn().mockResolvedValue('success');

        await manager.execute(fn, 'test-operation');

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('retry behavior', () => {
      it('should retry on failure and succeed', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(fn, 'test-operation');

        // Advance timer for first retry delay
        await vi.advanceTimersByTimeAsync(100);

        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should retry multiple times before success', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(fn, 'test-operation');

        // Advance timer for retries
        await vi.advanceTimersByTimeAsync(100); // First retry
        await vi.advanceTimersByTimeAsync(200); // Second retry (backoff)

        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should throw after max attempts exhausted', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const error = new Error('Persistent error');
        const fn = vi.fn().mockRejectedValue(error);

        const resultPromise = manager.execute(fn, 'test-operation');

        // Catch the promise to prevent unhandled rejection
        resultPromise.catch(() => {});

        // Advance timer for all retries
        await vi.advanceTimersByTimeAsync(100); // First retry
        await vi.advanceTimersByTimeAsync(200); // Second retry

        await expect(resultPromise).rejects.toThrow('Persistent error');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should log warning on each retry', async () => {
        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockResolvedValue('success');

        const resultPromise = manager.execute(fn, 'test-operation');

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(200);

        await resultPromise;

        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            attempt: 1,
            maxAttempts: 3,
            operation: 'test-operation',
          }),
          'Retrying test-operation'
        );
      });
    });

    describe('non-retryable errors', () => {
      it('should not retry non-retryable errors', async () => {
        vi.mocked(ErrorHandler.isRetryable).mockReturnValue(false);

        const manager = new RetryManager(defaultConfig, mockLogger);
        const error = new Error('Non-retryable error');
        const fn = vi.fn().mockRejectedValue(error);

        await expect(manager.execute(fn, 'test-operation')).rejects.toThrow(
          'Non-retryable error'
        );

        expect(fn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should check isRetryable for each error', async () => {
        vi.mocked(ErrorHandler.isRetryable)
          .mockReturnValueOnce(true) // First error is retryable
          .mockReturnValueOnce(false); // Second error is not

        const manager = new RetryManager(defaultConfig, mockLogger);
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'));

        const resultPromise = manager.execute(fn, 'test-operation');

        // Catch the promise to prevent unhandled rejection
        resultPromise.catch(() => {});

        await vi.advanceTimersByTimeAsync(100);

        await expect(resultPromise).rejects.toThrow('Error 2');
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });

    describe('edge cases', () => {
      it('should handle maxAttempts of 0 (ensures at least 1 attempt)', async () => {
        const config: RetryConfig = {
          ...defaultConfig,
          maxAttempts: 0,
        };
        const manager = new RetryManager(config, mockLogger);
        const error = new Error('Error');
        const fn = vi.fn().mockRejectedValue(error);

        await expect(manager.execute(fn, 'test-operation')).rejects.toThrow();

        // Should still make at least 1 attempt
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should handle maxAttempts of 1', async () => {
        const config: RetryConfig = {
          ...defaultConfig,
          maxAttempts: 1,
        };
        const manager = new RetryManager(config, mockLogger);
        const error = new Error('Error');
        const fn = vi.fn().mockRejectedValue(error);

        await expect(manager.execute(fn, 'test-operation')).rejects.toThrow();

        expect(fn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle negative maxAttempts (ensures at least 1 attempt)', async () => {
        const config: RetryConfig = {
          ...defaultConfig,
          maxAttempts: -5,
        };
        const manager = new RetryManager(config, mockLogger);
        const fn = vi.fn().mockResolvedValue('success');

        const result = await manager.execute(fn, 'test-operation');

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'test-operation');

      // First retry: initialDelay * backoffFactor^0 = 100 * 1 = 100
      await vi.advanceTimersByTimeAsync(100);

      // Second retry: initialDelay * backoffFactor^1 = 100 * 2 = 200
      await vi.advanceTimersByTimeAsync(200);

      await resultPromise;

      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ delay: 100 }),
        expect.any(String)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ delay: 200 }),
        expect.any(String)
      );
    });

    it('should cap delay at maxDelay', async () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 1000,
        backoffFactor: 3,
      };
      const manager = new RetryManager(config, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'test-operation');

      // First retry: 500 * 3^0 = 500
      await vi.advanceTimersByTimeAsync(500);

      // Second retry: 500 * 3^1 = 1500 -> capped at 1000
      await vi.advanceTimersByTimeAsync(1000);

      // Third retry: 500 * 3^2 = 4500 -> capped at 1000
      await vi.advanceTimersByTimeAsync(1000);

      await resultPromise;

      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ delay: 500 }),
        expect.any(String)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ delay: 1000 }),
        expect.any(String)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ delay: 1000 }),
        expect.any(String)
      );
    });

    it('should handle backoffFactor of 1 (constant delay)', async () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 1,
      };
      const manager = new RetryManager(config, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'test-operation');

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      await resultPromise;

      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ delay: 100 }),
        expect.any(String)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ delay: 100 }),
        expect.any(String)
      );
    });
  });

  describe('sleep', () => {
    it('should wait for specified duration', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      const resultPromise = manager.execute(fn, 'test-operation');

      // Verify sleep is called with correct duration
      await vi.advanceTimersByTimeAsync(100);

      await resultPromise;

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error propagation', () => {
    it('should propagate the last error after all retries', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Final Error'));

      const resultPromise = manager.execute(fn, 'test-operation');

      // Catch the promise to prevent unhandled rejection
      resultPromise.catch(() => {});

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(resultPromise).rejects.toThrow('Final Error');
    });

    it('should preserve error type', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const manager = new RetryManager(defaultConfig, mockLogger);
      const customError = new CustomError('Custom error', 500);
      const fn = vi.fn().mockRejectedValue(customError);

      const resultPromise = manager.execute(fn, 'test-operation');

      // Catch the promise to prevent unhandled rejection
      resultPromise.catch(() => {});

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      try {
        await resultPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomError);
        expect((error as CustomError).code).toBe(500);
      }
    });
  });

  describe('operation logging', () => {
    it('should include operation name in log messages', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'my-special-operation');

      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'my-special-operation' }),
        'Retrying my-special-operation'
      );
    });

    it('should include error message in log', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Specific error message'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'test-operation');

      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Specific error message' }),
        expect.any(String)
      );
    });

    it('should include attempt count in log', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const resultPromise = manager.execute(fn, 'test-operation');

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;

      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ attempt: 1 }),
        expect.any(String)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ attempt: 2 }),
        expect.any(String)
      );
    });
  });

  describe('concurrent executions', () => {
    it('should handle multiple concurrent executions independently', async () => {
      const manager = new RetryManager(defaultConfig, mockLogger);

      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');

      const promise1 = manager.execute(fn1, 'operation1');
      const promise2 = manager.execute(fn2, 'operation2');

      await vi.advanceTimersByTimeAsync(100);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });
});
