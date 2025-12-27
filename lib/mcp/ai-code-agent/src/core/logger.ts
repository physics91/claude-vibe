/**
 * Logger implementation using Pino
 */

import pinoCore, {
  transport,
  type DestinationStream,
  type Logger as PinoLogger,
  type LoggerOptions,
} from 'pino';

import type { LogLevel } from '../types/index.js';

export interface LoggerConfig {
  level: LogLevel;
  pretty?: boolean;
  file?: {
    enabled: boolean;
    path: string;
  };
}

const SENSITIVE_KEYS = ['apiKey', 'token', 'secret', 'password'];
const CODE_SNIPPET_KEYS = [
  'prompt',
  'code',
  'source',
  'snippet',
  'content',
  'response',
  'output',
  'stdout',
  'stderr',
];

export class Logger {
  private logger: PinoLogger;

  constructor(config: LoggerConfig) {
    const options: LoggerOptions = {
      level: config.level,
      redact: {
        paths: SENSITIVE_KEYS,
        censor: '***REDACTED***',
      },
    };

    if (config.pretty) {
      const destination = transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }) as unknown as DestinationStream;

      this.logger = pinoCore(options, destination);
    } else {
      this.logger = pinoCore(options);
    }
  }

  static create(config: LoggerConfig): Logger {
    return new Logger(config);
  }

  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  debug(objOrMsg: object | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.debug(objOrMsg);
    } else {
      this.logger.debug(this.sanitize(objOrMsg), msg);
    }
  }

  info(obj: object, msg?: string): void;
  info(msg: string): void;
  info(objOrMsg: object | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.info(objOrMsg);
    } else {
      this.logger.info(this.sanitize(objOrMsg), msg);
    }
  }

  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  warn(objOrMsg: object | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.warn(objOrMsg);
    } else {
      this.logger.warn(this.sanitize(objOrMsg), msg);
    }
  }

  error(obj: object, msg?: string): void;
  error(msg: string): void;
  error(objOrMsg: object | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.logger.error(objOrMsg);
    } else {
      this.logger.error(this.sanitize(objOrMsg), msg);
    }
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(obj: object): object {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if key contains sensitive data (completely redact)
      if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      }
      // Check if key contains code snippets (redact but keep metadata)
      // CRITICAL FIX #8: Redact ALL code, not just >200 chars
      else if (
        CODE_SNIPPET_KEYS.some(snippet => key.toLowerCase().includes(snippet.toLowerCase()))
      ) {
        if (typeof value === 'string') {
          // For code snippets, log only length metadata - ALWAYS redact, no size threshold
          sanitized[key] = `<redacted ${value.length} characters>`;
        } else if (typeof value === 'object' && value !== null) {
          // Recursively sanitize objects
          sanitized[key] = this.sanitize(value as object);
        } else {
          sanitized[key] = value;
        }
      }
      // Recursively sanitize nested objects
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value as object);
      }
      // Keep other values as-is
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric: string, duration: number, context?: object): void {
    this.logger.info(
      {
        metric,
        duration,
        ...this.sanitize(context ?? {}),
      },
      'Performance metric'
    );
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: string, details?: object): void {
    this.logger.warn(
      {
        event,
        ...this.sanitize(details ?? {}),
      },
      'Security event'
    );
  }

  /**
   * Log errors with full context
   */
  logError(error: Error, context?: object): void {
    this.logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...this.sanitize(context ?? {}),
      },
      'Error occurred'
    );
  }

  private static wrap(logger: PinoLogger): Logger {
    const instance = Object.create(Logger.prototype) as Logger;
    instance.logger = logger;
    return instance;
  }

  /**
   * Get child logger with additional context
   */
  child(bindings: object): Logger {
    const childLogger = this.logger.child(this.sanitize(bindings));
    return Logger.wrap(childLogger);
  }
}
