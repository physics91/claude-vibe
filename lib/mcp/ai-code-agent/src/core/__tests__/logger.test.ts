/**
 * Logger Tests
 * Tests for Pino-based logging with sanitization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, type LoggerConfig } from '../logger.js';

// Mock pino
const mockPinoLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};

vi.mock('pino', () => ({
  default: vi.fn(() => mockPinoLogger),
  transport: vi.fn(() => ({})),
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinoLogger.child.mockReturnValue({ ...mockPinoLogger });
  });

  describe('constructor', () => {
    it('should create logger with basic config', () => {
      const config: LoggerConfig = { level: 'info' };

      const logger = new Logger(config);

      expect(logger).toBeDefined();
    });

    it('should create logger with pretty printing', async () => {
      const config: LoggerConfig = { level: 'debug', pretty: true };

      const logger = new Logger(config);

      expect(logger).toBeDefined();
      const { transport } = await import('pino');
      expect(transport).toHaveBeenCalledWith({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      });
    });

    it('should create logger without pretty printing', async () => {
      const config: LoggerConfig = { level: 'warn', pretty: false };

      const logger = new Logger(config);

      expect(logger).toBeDefined();
    });
  });

  describe('static create', () => {
    it('should create logger instance via factory method', () => {
      const config: LoggerConfig = { level: 'info' };

      const logger = Logger.create(config);

      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('debug', () => {
    it('should log string message', () => {
      const logger = new Logger({ level: 'debug' });

      logger.debug('test message');

      expect(mockPinoLogger.debug).toHaveBeenCalledWith('test message');
    });

    it('should log object with message', () => {
      const logger = new Logger({ level: 'debug' });

      logger.debug({ key: 'value' }, 'test message');

      expect(mockPinoLogger.debug).toHaveBeenCalledWith({ key: 'value' }, 'test message');
    });

    it('should sanitize object before logging', () => {
      const logger = new Logger({ level: 'debug' });

      logger.debug({ apiKey: 'secret123' }, 'test');

      expect(mockPinoLogger.debug).toHaveBeenCalledWith(
        { apiKey: '***REDACTED***' },
        'test'
      );
    });
  });

  describe('info', () => {
    it('should log string message', () => {
      const logger = new Logger({ level: 'info' });

      logger.info('info message');

      expect(mockPinoLogger.info).toHaveBeenCalledWith('info message');
    });

    it('should log object with message', () => {
      const logger = new Logger({ level: 'info' });

      logger.info({ count: 5 }, 'processing items');

      expect(mockPinoLogger.info).toHaveBeenCalledWith({ count: 5 }, 'processing items');
    });

    it('should sanitize sensitive data', () => {
      const logger = new Logger({ level: 'info' });

      logger.info({ password: 'mypassword', user: 'john' }, 'login attempt');

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { password: '***REDACTED***', user: 'john' },
        'login attempt'
      );
    });
  });

  describe('warn', () => {
    it('should log string message', () => {
      const logger = new Logger({ level: 'warn' });

      logger.warn('warning message');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith('warning message');
    });

    it('should log object with message', () => {
      const logger = new Logger({ level: 'warn' });

      logger.warn({ issue: 'deprecated' }, 'deprecation warning');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { issue: 'deprecated' },
        'deprecation warning'
      );
    });

    it('should sanitize token in object', () => {
      const logger = new Logger({ level: 'warn' });

      logger.warn({ token: 'abc123', status: 'expired' }, 'token warning');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { token: '***REDACTED***', status: 'expired' },
        'token warning'
      );
    });
  });

  describe('error', () => {
    it('should log string message', () => {
      const logger = new Logger({ level: 'error' });

      logger.error('error message');

      expect(mockPinoLogger.error).toHaveBeenCalledWith('error message');
    });

    it('should log object with message', () => {
      const logger = new Logger({ level: 'error' });

      logger.error({ code: 500 }, 'server error');

      expect(mockPinoLogger.error).toHaveBeenCalledWith({ code: 500 }, 'server error');
    });

    it('should sanitize secret in object', () => {
      const logger = new Logger({ level: 'error' });

      logger.error({ secret: 'topsecret', operation: 'decrypt' }, 'crypto error');

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        { secret: '***REDACTED***', operation: 'decrypt' },
        'crypto error'
      );
    });
  });

  describe('sanitization', () => {
    describe('sensitive keys', () => {
      it('should redact apiKey', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ apiKey: 'key123' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { apiKey: '***REDACTED***' },
          'test'
        );
      });

      it('should redact token', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ token: 'jwt.token.here' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { token: '***REDACTED***' },
          'test'
        );
      });

      it('should redact secret', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ secret: 'mysecret' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { secret: '***REDACTED***' },
          'test'
        );
      });

      it('should redact password', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ password: 'pass123' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { password: '***REDACTED***' },
          'test'
        );
      });

      it('should redact keys containing sensitive words (case insensitive)', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ userApiKey: 'key', accessToken: 'tok' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { userApiKey: '***REDACTED***', accessToken: '***REDACTED***' },
          'test'
        );
      });
    });

    describe('code snippet keys', () => {
      it('should redact code with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ code: 'const x = 1;' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { code: '<redacted 12 characters>' },
          'test'
        );
      });

      it('should redact prompt with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ prompt: 'Review this code for security issues' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { prompt: '<redacted 36 characters>' },
          'test'
        );
      });

      it('should redact source with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ source: 'function foo() {}' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { source: '<redacted 17 characters>' },
          'test'
        );
      });

      it('should redact snippet with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ snippet: 'let x = 1;' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { snippet: '<redacted 10 characters>' },
          'test'
        );
      });

      it('should redact content with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ content: 'Some content here' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { content: '<redacted 17 characters>' },
          'test'
        );
      });

      it('should redact response with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ response: 'API response data' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { response: '<redacted 17 characters>' },
          'test'
        );
      });

      it('should redact output with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ output: 'command output' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { output: '<redacted 14 characters>' },
          'test'
        );
      });

      it('should redact stdout with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ stdout: 'standard output' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { stdout: '<redacted 15 characters>' },
          'test'
        );
      });

      it('should redact stderr with length metadata', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ stderr: 'error output' }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { stderr: '<redacted 12 characters>' },
          'test'
        );
      });

      it('should handle non-string code snippet values', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ code: 123 }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({ code: 123 }, 'test');
      });

      it('should recursively sanitize nested objects in code snippet keys', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ codeData: { nested: 'value', apiKey: 'secret' } }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { codeData: { nested: 'value', apiKey: '***REDACTED***' } },
          'test'
        );
      });
    });

    describe('nested objects', () => {
      it('should sanitize deeply nested sensitive keys', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug(
          {
            user: {
              name: 'John',
              credentials: {
                password: 'secret',
                apiKey: 'key123',
              },
            },
          },
          'test'
        );

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          {
            user: {
              name: 'John',
              credentials: {
                password: '***REDACTED***',
                apiKey: '***REDACTED***',
              },
            },
          },
          'test'
        );
      });

      it('should preserve non-sensitive nested values', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug(
          {
            config: {
              host: 'localhost',
              port: 3000,
              settings: {
                debug: true,
              },
            },
          },
          'test'
        );

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          {
            config: {
              host: 'localhost',
              port: 3000,
              settings: {
                debug: true,
              },
            },
          },
          'test'
        );
      });

      it('should handle null values in nested objects', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({ data: { value: null } }, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          { data: { value: null } },
          'test'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty object', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug({}, 'test');

        expect(mockPinoLogger.debug).toHaveBeenCalledWith({}, 'test');
      });

      it('should handle object with multiple types', () => {
        const logger = new Logger({ level: 'debug' });

        logger.debug(
          {
            string: 'text',
            number: 42,
            boolean: true,
            array: [1, 2, 3],
          },
          'test'
        );

        // Note: sanitize treats arrays as objects, converting them to indexed objects
        expect(mockPinoLogger.debug).toHaveBeenCalledWith(
          {
            string: 'text',
            number: 42,
            boolean: true,
            array: { '0': 1, '1': 2, '2': 3 },
          },
          'test'
        );
      });
    });
  });

  describe('logPerformance', () => {
    it('should log performance metric', () => {
      const logger = new Logger({ level: 'info' });

      logger.logPerformance('api_call', 150);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { metric: 'api_call', duration: 150 },
        'Performance metric'
      );
    });

    it('should log performance metric with context', () => {
      const logger = new Logger({ level: 'info' });

      logger.logPerformance('db_query', 50, { table: 'users' });

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { metric: 'db_query', duration: 50, table: 'users' },
        'Performance metric'
      );
    });

    it('should sanitize context in performance logs', () => {
      const logger = new Logger({ level: 'info' });

      logger.logPerformance('auth', 100, { apiKey: 'key123', endpoint: '/login' });

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { metric: 'auth', duration: 100, apiKey: '***REDACTED***', endpoint: '/login' },
        'Performance metric'
      );
    });

    it('should handle undefined context', () => {
      const logger = new Logger({ level: 'info' });

      logger.logPerformance('operation', 200, undefined);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        { metric: 'operation', duration: 200 },
        'Performance metric'
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event', () => {
      const logger = new Logger({ level: 'warn' });

      logger.logSecurityEvent('unauthorized_access');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { event: 'unauthorized_access' },
        'Security event'
      );
    });

    it('should log security event with details', () => {
      const logger = new Logger({ level: 'warn' });

      logger.logSecurityEvent('failed_login', { ip: '192.168.1.1', attempts: 3 });

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { event: 'failed_login', ip: '192.168.1.1', attempts: 3 },
        'Security event'
      );
    });

    it('should sanitize details in security logs', () => {
      const logger = new Logger({ level: 'warn' });

      logger.logSecurityEvent('token_leak', { token: 'leaked_token', source: 'log' });

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { event: 'token_leak', token: '***REDACTED***', source: '<redacted 3 characters>' },
        'Security event'
      );
    });

    it('should handle undefined details', () => {
      const logger = new Logger({ level: 'warn' });

      logger.logSecurityEvent('suspicious_activity', undefined);

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { event: 'suspicious_activity' },
        'Security event'
      );
    });
  });

  describe('logError', () => {
    it('should log error with name and message', () => {
      const logger = new Logger({ level: 'error' });
      const error = new Error('Something went wrong');

      logger.logError(error);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'Error',
            message: 'Something went wrong',
            stack: expect.any(String),
          },
        },
        'Error occurred'
      );
    });

    it('should log error with context', () => {
      const logger = new Logger({ level: 'error' });
      const error = new Error('DB error');

      logger.logError(error, { operation: 'insert', table: 'users' });

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'Error',
            message: 'DB error',
            stack: expect.any(String),
          },
          operation: 'insert',
          table: 'users',
        },
        'Error occurred'
      );
    });

    it('should sanitize context in error logs', () => {
      const logger = new Logger({ level: 'error' });
      const error = new Error('Auth error');

      logger.logError(error, { password: 'secret', user: 'john' });

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'Error',
            message: 'Auth error',
            stack: expect.any(String),
          },
          password: '***REDACTED***',
          user: 'john',
        },
        'Error occurred'
      );
    });

    it('should handle undefined context', () => {
      const logger = new Logger({ level: 'error' });
      const error = new Error('Unknown error');

      logger.logError(error, undefined);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'Error',
            message: 'Unknown error',
            stack: expect.any(String),
          },
        },
        'Error occurred'
      );
    });

    it('should handle custom error types', () => {
      const logger = new Logger({ level: 'error' });

      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message');

      logger.logError(error);

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'CustomError',
            message: 'Custom error message',
            stack: expect.any(String),
          },
        },
        'Error occurred'
      );
    });
  });

  describe('child', () => {
    it('should create child logger with bindings', () => {
      const logger = new Logger({ level: 'info' });

      const childLogger = logger.child({ requestId: 'abc123' });

      expect(mockPinoLogger.child).toHaveBeenCalledWith({ requestId: 'abc123' });
      expect(childLogger).toBeInstanceOf(Logger);
    });

    it('should sanitize bindings when creating child', () => {
      const logger = new Logger({ level: 'info' });

      logger.child({ requestId: 'abc', apiKey: 'secret' });

      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        requestId: 'abc',
        apiKey: '***REDACTED***',
      });
    });

    it('should return functional child logger', () => {
      const logger = new Logger({ level: 'info' });
      const childLogger = logger.child({ component: 'auth' });

      childLogger.info('child log message');

      expect(mockPinoLogger.info).toHaveBeenCalledWith('child log message');
    });

    it('should sanitize code in bindings', () => {
      const logger = new Logger({ level: 'info' });

      logger.child({ module: 'parser', code: 'const x = 1;' });

      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        module: 'parser',
        code: '<redacted 12 characters>',
      });
    });
  });

  describe('log levels', () => {
    it('should respect debug level', () => {
      const logger = new Logger({ level: 'debug' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockPinoLogger.debug).toHaveBeenCalled();
      expect(mockPinoLogger.info).toHaveBeenCalled();
      expect(mockPinoLogger.warn).toHaveBeenCalled();
      expect(mockPinoLogger.error).toHaveBeenCalled();
    });

    it('should create logger with error level', () => {
      const logger = new Logger({ level: 'error' });

      expect(logger).toBeDefined();
    });

    it('should create logger with warn level', () => {
      const logger = new Logger({ level: 'warn' });

      expect(logger).toBeDefined();
    });
  });
});
