/**
 * Custom error classes and error handling utilities
 */

import { BaseError } from '../types/index.js';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CLI_EXECUTION_ERROR = 'CLI_EXECUTION_ERROR',
  MCP_TOOL_ERROR = 'MCP_TOOL_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  CODEX_ANALYSIS_ERROR = 'CODEX_ANALYSIS_ERROR',
  CODEX_TIMEOUT_ERROR = 'CODEX_TIMEOUT_ERROR',
  CODEX_PARSE_ERROR = 'CODEX_PARSE_ERROR',
  GEMINI_ANALYSIS_ERROR = 'GEMINI_ANALYSIS_ERROR',
  GEMINI_TIMEOUT_ERROR = 'GEMINI_TIMEOUT_ERROR',
  GEMINI_PARSE_ERROR = 'GEMINI_PARSE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Validation error
 */
export class ValidationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_ERROR, details);
  }
}

/**
 * CLI execution error
 */
export class CLIExecutionError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CLI_EXECUTION_ERROR, details);
  }
}

/**
 * MCP tool error
 * CRITICAL FIX: Support fatal vs retryable classification
 */
export class MCPToolError extends BaseError {
  public readonly fatal: boolean;
  public readonly retryable: boolean;

  constructor(
    message: string,
    details?: {
      fatal?: boolean;
      retryable?: boolean;
      cause?: unknown;
      result?: unknown;
      [key: string]: unknown;
    }
  ) {
    super(message, ErrorCode.MCP_TOOL_ERROR, details);
    this.fatal = details?.fatal ?? false;
    this.retryable = details?.retryable ?? false;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.TIMEOUT_ERROR, details);
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CONFIGURATION_ERROR, details);
  }
}

/**
 * Parse error
 */
export class ParseError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.PARSE_ERROR, details);
  }
}

/**
 * Security error
 */
export class SecurityError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.SECURITY_ERROR, details);
  }
}

/**
 * Codex Analysis Error - Base class for Codex-specific errors
 */
export class CodexAnalysisError extends BaseError {
  constructor(
    message: string,
    public readonly analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, ErrorCode.CODEX_ANALYSIS_ERROR, { ...details, analysisId });
  }
}

/**
 * Codex Timeout Error
 */
export class CodexTimeoutError extends CodexAnalysisError {
  constructor(
    message: string,
    analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, analysisId, details);
    this.code = ErrorCode.CODEX_TIMEOUT_ERROR;
  }
}

/**
 * Codex Parse Error
 */
export class CodexParseError extends CodexAnalysisError {
  constructor(
    message: string,
    analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, analysisId, details);
    this.code = ErrorCode.CODEX_PARSE_ERROR;
  }
}

/**
 * Gemini Analysis Error - Base class for Gemini-specific errors
 */
export class GeminiAnalysisError extends BaseError {
  constructor(
    message: string,
    public readonly analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, ErrorCode.GEMINI_ANALYSIS_ERROR, { ...details, analysisId });
  }
}

/**
 * Gemini Timeout Error
 */
export class GeminiTimeoutError extends GeminiAnalysisError {
  constructor(
    message: string,
    analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, analysisId, details);
    this.code = ErrorCode.GEMINI_TIMEOUT_ERROR;
  }
}

/**
 * Gemini Parse Error
 */
export class GeminiParseError extends GeminiAnalysisError {
  constructor(
    message: string,
    analysisId: string,
    details?: { cause?: unknown; [key: string]: unknown }
  ) {
    super(message, analysisId, details);
    this.code = ErrorCode.GEMINI_PARSE_ERROR;
  }
}

/**
 * Error handler utilities
 */
export class ErrorHandler {
  /**
   * Check if error is retryable
   * CRITICAL FIX: Don't retry fatal errors, only transient ones
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof MCPToolError) {
      // Don't retry if marked as fatal
      if (error.fatal) return false;
      // Retry if marked as retryable
      if (error.retryable) return true;
      // Default: MCP errors are not retryable unless marked
      return false;
    }

    if (error instanceof TimeoutError) return true;
    if (error instanceof CLIExecutionError) return true;

    return false;
  }

  /**
   * Classify unknown error
   */
  static classifyError(error: unknown): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return new TimeoutError(error.message, { cause: error });
      }
      if (error.message.includes('validation')) {
        return new ValidationError(error.message, { cause: error });
      }

      return new BaseError(error.message, ErrorCode.UNKNOWN_ERROR, { cause: error });
    }

    return new BaseError('An unknown error occurred', ErrorCode.UNKNOWN_ERROR, { error });
  }

  /**
   * Format error for user display
   */
  static formatErrorMessage(error: unknown): string {
    if (error instanceof BaseError) {
      return `[${error.code}] ${error.message}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'An unknown error occurred';
  }

  /**
   * Create error response object
   */
  static createErrorResponse(error: unknown): {
    success: false;
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  } {
    const classified = this.classifyError(error);

    return {
      success: false,
      error: {
        code: classified.code,
        message: classified.message,
        details: classified.details,
      },
    };
  }
}
