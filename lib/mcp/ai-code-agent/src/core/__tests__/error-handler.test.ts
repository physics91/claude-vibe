/**
 * Unit tests for Error Handler
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ValidationError,
  CLIExecutionError,
  MCPToolError,
  TimeoutError,
  ConfigurationError,
  ParseError,
  SecurityError,
  CodexAnalysisError,
  CodexTimeoutError,
  CodexParseError,
  GeminiAnalysisError,
  GeminiTimeoutError,
  GeminiParseError,
  ErrorHandler,
} from '../error-handler.js';
import { BaseError } from '../../types/index.js';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should create validation error with details', () => {
      const error = new ValidationError('Invalid input', { field: 'name', value: null });
      expect(error.details).toEqual({ field: 'name', value: null });
    });
  });

  describe('CLIExecutionError', () => {
    it('should create CLI execution error', () => {
      const error = new CLIExecutionError('CLI failed to execute');
      expect(error.message).toBe('CLI failed to execute');
      expect(error.code).toBe(ErrorCode.CLI_EXECUTION_ERROR);
    });

    it('should include exit code in details', () => {
      const error = new CLIExecutionError('CLI failed', { exitCode: 1, stderr: 'Error output' });
      expect(error.details).toEqual({ exitCode: 1, stderr: 'Error output' });
    });
  });

  describe('MCPToolError', () => {
    it('should create MCP tool error', () => {
      const error = new MCPToolError('Tool call failed');
      expect(error.message).toBe('Tool call failed');
      expect(error.code).toBe(ErrorCode.MCP_TOOL_ERROR);
      expect(error.fatal).toBe(false);
      expect(error.retryable).toBe(false);
    });

    it('should support fatal flag', () => {
      const error = new MCPToolError('Fatal error', { fatal: true });
      expect(error.fatal).toBe(true);
      expect(error.retryable).toBe(false);
    });

    it('should support retryable flag', () => {
      const error = new MCPToolError('Temporary error', { retryable: true });
      expect(error.fatal).toBe(false);
      expect(error.retryable).toBe(true);
    });

    it('should support both flags', () => {
      const error = new MCPToolError('Complex error', { fatal: true, retryable: true });
      expect(error.fatal).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it('should include cause in details', () => {
      const cause = new Error('Original error');
      const error = new MCPToolError('Wrapped error', { cause });
      expect(error.details).toEqual({ cause });
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Operation timed out');
      expect(error.message).toBe('Operation timed out');
      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    it('should include timeout value in details', () => {
      const error = new TimeoutError('Operation timed out', { timeout: 30000 });
      expect(error.details).toEqual({ timeout: 30000 });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Invalid configuration');
      expect(error.message).toBe('Invalid configuration');
      expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
    });
  });

  describe('ParseError', () => {
    it('should create parse error', () => {
      const error = new ParseError('Failed to parse JSON');
      expect(error.message).toBe('Failed to parse JSON');
      expect(error.code).toBe(ErrorCode.PARSE_ERROR);
    });

    it('should include raw content in details', () => {
      const error = new ParseError('Invalid JSON', { content: '{invalid}', position: 5 });
      expect(error.details).toEqual({ content: '{invalid}', position: 5 });
    });
  });

  describe('SecurityError', () => {
    it('should create security error', () => {
      const error = new SecurityError('Access denied');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(ErrorCode.SECURITY_ERROR);
    });

    it('should include security context in details', () => {
      const error = new SecurityError('Unauthorized access', {
        path: '/protected/resource',
        user: 'anonymous',
      });
      expect(error.details).toEqual({ path: '/protected/resource', user: 'anonymous' });
    });
  });

  describe('CodexAnalysisError', () => {
    it('should create Codex analysis error with analysisId', () => {
      const error = new CodexAnalysisError('Analysis failed', 'codex-123');
      expect(error.message).toBe('Analysis failed');
      expect(error.code).toBe(ErrorCode.CODEX_ANALYSIS_ERROR);
      expect(error.analysisId).toBe('codex-123');
    });

    it('should include analysisId in details', () => {
      const error = new CodexAnalysisError('Analysis failed', 'codex-456', { phase: 'parsing' });
      expect(error.details).toEqual({ phase: 'parsing', analysisId: 'codex-456' });
    });
  });

  describe('CodexTimeoutError', () => {
    it('should create Codex timeout error', () => {
      const error = new CodexTimeoutError('Codex timed out', 'codex-789');
      expect(error.message).toBe('Codex timed out');
      expect(error.code).toBe(ErrorCode.CODEX_TIMEOUT_ERROR);
      expect(error.analysisId).toBe('codex-789');
    });

    it('should extend CodexAnalysisError', () => {
      const error = new CodexTimeoutError('Timeout', 'codex-abc');
      expect(error).toBeInstanceOf(CodexAnalysisError);
    });
  });

  describe('CodexParseError', () => {
    it('should create Codex parse error', () => {
      const error = new CodexParseError('Failed to parse Codex output', 'codex-xyz');
      expect(error.message).toBe('Failed to parse Codex output');
      expect(error.code).toBe(ErrorCode.CODEX_PARSE_ERROR);
      expect(error.analysisId).toBe('codex-xyz');
    });

    it('should extend CodexAnalysisError', () => {
      const error = new CodexParseError('Parse error', 'codex-def');
      expect(error).toBeInstanceOf(CodexAnalysisError);
    });
  });

  describe('GeminiAnalysisError', () => {
    it('should create Gemini analysis error with analysisId', () => {
      const error = new GeminiAnalysisError('Gemini analysis failed', 'gemini-123');
      expect(error.message).toBe('Gemini analysis failed');
      expect(error.code).toBe(ErrorCode.GEMINI_ANALYSIS_ERROR);
      expect(error.analysisId).toBe('gemini-123');
    });
  });

  describe('GeminiTimeoutError', () => {
    it('should create Gemini timeout error', () => {
      const error = new GeminiTimeoutError('Gemini timed out', 'gemini-789');
      expect(error.message).toBe('Gemini timed out');
      expect(error.code).toBe(ErrorCode.GEMINI_TIMEOUT_ERROR);
      expect(error.analysisId).toBe('gemini-789');
    });

    it('should extend GeminiAnalysisError', () => {
      const error = new GeminiTimeoutError('Timeout', 'gemini-abc');
      expect(error).toBeInstanceOf(GeminiAnalysisError);
    });
  });

  describe('GeminiParseError', () => {
    it('should create Gemini parse error', () => {
      const error = new GeminiParseError('Failed to parse Gemini output', 'gemini-xyz');
      expect(error.message).toBe('Failed to parse Gemini output');
      expect(error.code).toBe(ErrorCode.GEMINI_PARSE_ERROR);
      expect(error.analysisId).toBe('gemini-xyz');
    });

    it('should extend GeminiAnalysisError', () => {
      const error = new GeminiParseError('Parse error', 'gemini-def');
      expect(error).toBeInstanceOf(GeminiAnalysisError);
    });
  });
});

describe('ErrorHandler', () => {
  describe('isRetryable', () => {
    it('should return true for TimeoutError', () => {
      const error = new TimeoutError('Timeout');
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should return true for CLIExecutionError', () => {
      const error = new CLIExecutionError('CLI failed');
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should return false for fatal MCPToolError', () => {
      const error = new MCPToolError('Fatal error', { fatal: true });
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return true for retryable MCPToolError', () => {
      const error = new MCPToolError('Retryable error', { retryable: true });
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable MCPToolError', () => {
      const error = new MCPToolError('Normal error');
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false when both fatal and retryable are true', () => {
      const error = new MCPToolError('Complex', { fatal: true, retryable: true });
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for ValidationError', () => {
      const error = new ValidationError('Invalid');
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for ConfigurationError', () => {
      const error = new ConfigurationError('Bad config');
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for ParseError', () => {
      const error = new ParseError('Parse failed');
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for SecurityError', () => {
      const error = new SecurityError('Access denied');
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return false for unknown errors', () => {
      expect(ErrorHandler.isRetryable(new Error('Unknown'))).toBe(false);
      expect(ErrorHandler.isRetryable('string error')).toBe(false);
      expect(ErrorHandler.isRetryable(null)).toBe(false);
      expect(ErrorHandler.isRetryable(undefined)).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('should return BaseError as-is', () => {
      const error = new ValidationError('Test');
      const classified = ErrorHandler.classifyError(error);
      expect(classified).toBe(error);
    });

    it('should classify timeout errors from message', () => {
      const error = new Error('Request timeout after 30s');
      const classified = ErrorHandler.classifyError(error);
      expect(classified.code).toBe(ErrorCode.TIMEOUT_ERROR);
      expect(classified.message).toBe('Request timeout after 30s');
    });

    it('should classify validation errors from message', () => {
      const error = new Error('Input validation failed');
      const classified = ErrorHandler.classifyError(error);
      expect(classified.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should classify unknown Error objects', () => {
      const error = new Error('Something went wrong');
      const classified = ErrorHandler.classifyError(error);
      expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(classified.message).toBe('Something went wrong');
    });

    it('should handle non-Error objects', () => {
      const classified = ErrorHandler.classifyError('string error');
      expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(classified.message).toBe('An unknown error occurred');
    });

    it('should handle null', () => {
      const classified = ErrorHandler.classifyError(null);
      expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should handle undefined', () => {
      const classified = ErrorHandler.classifyError(undefined);
      expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should preserve cause in details', () => {
      const cause = new Error('Original');
      const classified = ErrorHandler.classifyError(cause);
      expect(classified.details).toHaveProperty('cause', cause);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format BaseError with code', () => {
      const error = new ValidationError('Invalid input');
      const message = ErrorHandler.formatErrorMessage(error);
      expect(message).toBe('[VALIDATION_ERROR] Invalid input');
    });

    it('should format regular Error without code', () => {
      const error = new Error('Something failed');
      const message = ErrorHandler.formatErrorMessage(error);
      expect(message).toBe('Something failed');
    });

    it('should handle non-Error objects', () => {
      const message = ErrorHandler.formatErrorMessage('string error');
      expect(message).toBe('An unknown error occurred');
    });

    it('should handle null', () => {
      const message = ErrorHandler.formatErrorMessage(null);
      expect(message).toBe('An unknown error occurred');
    });

    it('should format various error types', () => {
      expect(ErrorHandler.formatErrorMessage(new TimeoutError('Timeout'))).toContain('TIMEOUT_ERROR');
      expect(ErrorHandler.formatErrorMessage(new ParseError('Parse'))).toContain('PARSE_ERROR');
      expect(ErrorHandler.formatErrorMessage(new SecurityError('Security'))).toContain(
        'SECURITY_ERROR'
      );
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response from BaseError', () => {
      const error = new ValidationError('Invalid field', { field: 'name' });
      const response = ErrorHandler.createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(response.error.message).toBe('Invalid field');
      expect(response.error.details).toEqual({ field: 'name' });
    });

    it('should create error response from regular Error', () => {
      const error = new Error('Something went wrong');
      const response = ErrorHandler.createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(response.error.message).toBe('Something went wrong');
    });

    it('should create error response from non-Error', () => {
      const response = ErrorHandler.createErrorResponse('string error');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(response.error.message).toBe('An unknown error occurred');
    });

    it('should classify timeout errors in response', () => {
      const error = new Error('Request timeout');
      const response = ErrorHandler.createErrorResponse(error);

      expect(response.error.code).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    it('should include Codex analysisId in response', () => {
      const error = new CodexAnalysisError('Failed', 'codex-test-id');
      const response = ErrorHandler.createErrorResponse(error);

      expect(response.error.details).toEqual(
        expect.objectContaining({ analysisId: 'codex-test-id' })
      );
    });

    it('should include Gemini analysisId in response', () => {
      const error = new GeminiAnalysisError('Failed', 'gemini-test-id');
      const response = ErrorHandler.createErrorResponse(error);

      expect(response.error.details).toEqual(
        expect.objectContaining({ analysisId: 'gemini-test-id' })
      );
    });
  });
});

describe('ErrorCode Enum', () => {
  it('should have all expected error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.CLI_EXECUTION_ERROR).toBe('CLI_EXECUTION_ERROR');
    expect(ErrorCode.MCP_TOOL_ERROR).toBe('MCP_TOOL_ERROR');
    expect(ErrorCode.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    expect(ErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    expect(ErrorCode.SECURITY_ERROR).toBe('SECURITY_ERROR');
    expect(ErrorCode.CODEX_ANALYSIS_ERROR).toBe('CODEX_ANALYSIS_ERROR');
    expect(ErrorCode.CODEX_TIMEOUT_ERROR).toBe('CODEX_TIMEOUT_ERROR');
    expect(ErrorCode.CODEX_PARSE_ERROR).toBe('CODEX_PARSE_ERROR');
    expect(ErrorCode.GEMINI_ANALYSIS_ERROR).toBe('GEMINI_ANALYSIS_ERROR');
    expect(ErrorCode.GEMINI_TIMEOUT_ERROR).toBe('GEMINI_TIMEOUT_ERROR');
    expect(ErrorCode.GEMINI_PARSE_ERROR).toBe('GEMINI_PARSE_ERROR');
    expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
  });
});

describe('Error Inheritance', () => {
  it('all errors should extend Error', () => {
    expect(new ValidationError('test')).toBeInstanceOf(Error);
    expect(new CLIExecutionError('test')).toBeInstanceOf(Error);
    expect(new MCPToolError('test')).toBeInstanceOf(Error);
    expect(new TimeoutError('test')).toBeInstanceOf(Error);
    expect(new ConfigurationError('test')).toBeInstanceOf(Error);
    expect(new ParseError('test')).toBeInstanceOf(Error);
    expect(new SecurityError('test')).toBeInstanceOf(Error);
    expect(new CodexAnalysisError('test', 'id')).toBeInstanceOf(Error);
    expect(new GeminiAnalysisError('test', 'id')).toBeInstanceOf(Error);
  });

  it('all errors should extend BaseError', () => {
    expect(new ValidationError('test')).toBeInstanceOf(BaseError);
    expect(new CLIExecutionError('test')).toBeInstanceOf(BaseError);
    expect(new MCPToolError('test')).toBeInstanceOf(BaseError);
    expect(new TimeoutError('test')).toBeInstanceOf(BaseError);
    expect(new ConfigurationError('test')).toBeInstanceOf(BaseError);
    expect(new ParseError('test')).toBeInstanceOf(BaseError);
    expect(new SecurityError('test')).toBeInstanceOf(BaseError);
    expect(new CodexAnalysisError('test', 'id')).toBeInstanceOf(BaseError);
    expect(new GeminiAnalysisError('test', 'id')).toBeInstanceOf(BaseError);
  });

  it('Codex errors should inherit properly', () => {
    expect(new CodexTimeoutError('test', 'id')).toBeInstanceOf(CodexAnalysisError);
    expect(new CodexParseError('test', 'id')).toBeInstanceOf(CodexAnalysisError);
    expect(new CodexTimeoutError('test', 'id')).toBeInstanceOf(BaseError);
    expect(new CodexParseError('test', 'id')).toBeInstanceOf(BaseError);
  });

  it('Gemini errors should inherit properly', () => {
    expect(new GeminiTimeoutError('test', 'id')).toBeInstanceOf(GeminiAnalysisError);
    expect(new GeminiParseError('test', 'id')).toBeInstanceOf(GeminiAnalysisError);
    expect(new GeminiTimeoutError('test', 'id')).toBeInstanceOf(BaseError);
    expect(new GeminiParseError('test', 'id')).toBeInstanceOf(BaseError);
  });
});
