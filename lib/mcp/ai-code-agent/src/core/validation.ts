/**
 * Validation utilities and error formatting
 * Provides user-friendly validation error messages for MCP tool inputs
 */

import { ZodError, type ZodIssue, type ZodSchema } from 'zod';

import { ValidationError } from './error-handler.js';

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: ValidationErrorDetails;
}

/**
 * Detailed validation error information
 */
export interface ValidationErrorDetails {
  message: string;
  fields: FieldError[];
  suggestions: string[];
}

/**
 * Field-specific error information
 */
export interface FieldError {
  field: string;
  value: unknown;
  error: string;
  constraint?: string;
  expectedFormat?: string;
}

/**
 * Field constraint documentation for better error messages
 * CRITICAL FIX: Keys now match Zod issue codes (too_small, too_big, etc.)
 */
const FIELD_CONSTRAINTS: Record<
  string,
  { description: string; format?: string; examples?: string[] }
> = {
  prompt: {
    description: 'Code review prompt (can include code, instructions, context, etc.)',
    examples: [
      'Review this code for security vulnerabilities: function auth() {...}',
      'Check performance issues in: const data = arr.map(...)',
    ],
  },
  'prompt.too_small': {
    description: 'Prompt must not be empty',
  },
  'prompt.too_big': {
    description: 'Prompt exceeds maximum allowed length',
  },
  'options.timeout': {
    description: 'Execution timeout in milliseconds (0 = unlimited)',
    format: 'Number 0 or greater (0 = unlimited, positive = timeout in ms)',
    examples: ['0', '60000', '120000'],
  },
  'options.timeout.too_small': {
    description: 'Timeout must be 0 (unlimited) or a positive number',
  },
  'options.severity': {
    description: 'Minimum severity level to report',
    format: 'One of: all, high, medium',
    examples: ['all', 'high', 'medium'],
  },
  'options.cliPath': {
    description: 'Custom CLI executable path (must be in allowed paths for security)',
    format: 'Absolute path or whitelisted executable name',
    examples: ['codex', '/usr/local/bin/codex', 'gemini'],
  },
  'options.parallelExecution': {
    description: 'Whether to run Codex and Gemini reviews in parallel',
    format: 'Boolean',
    examples: ['true', 'false'],
  },
  'options.includeIndividualReviews': {
    description: 'Include individual review results in combined output',
    format: 'Boolean',
    examples: ['true', 'false'],
  },
  reviewId: {
    description: 'Unique review identifier',
    format: 'Non-empty string',
    examples: ['codex-1234567890-abc123', 'gemini-1234567890-xyz789'],
  },
  'reviewId.too_small': {
    description: 'Review ID cannot be empty',
  },
};

/**
 * Validation utility class
 */
export class ValidationUtils {
  private static formatValueForMessage(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'string') {
      const trimmed = value.length > 50 ? `${value.slice(0, 47)}...` : value;
      return trimmed.replace(/\n/g, '\\n');
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    if (value instanceof Error) {
      return value.message;
    }

    if (typeof value === 'object') {
      return '[object]';
    }

    return String(value);
  }

  /**
   * Validate data against a Zod schema with enhanced error messages
   */
  static validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
      const validated = schema.parse(data);
      return {
        success: true,
        data: validated,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: this.formatZodError(error, data),
        };
      }

      return {
        success: false,
        error: {
          message: 'Validation failed with an unknown error',
          fields: [],
          suggestions: [
            'Check that your input matches the expected format',
            'Consult the MCP tool documentation',
          ],
        },
      };
    }
  }

  /**
   * Validate data and throw detailed error if validation fails
   * SECURITY: Redacts sensitive input data to prevent leaking code/secrets in errors
   */
  static validateOrThrow<T>(schema: ZodSchema<T>, data: unknown, context?: string): T {
    const result = this.validate(schema, data);

    if (!result.success) {
      const errorMessage = this.formatErrorMessage(result.error!, context);

      // SECURITY FIX: Redact sensitive input to prevent data leakage
      const redactedInput = this.redactSensitiveData(data);

      throw new ValidationError(errorMessage, {
        validationDetails: result.error,
        input: redactedInput, // Only include redacted summary
      });
    }

    return result.data!;
  }

  /**
   * Format Zod error into user-friendly validation error
   */
  private static formatZodError(error: ZodError, data: unknown): ValidationErrorDetails {
    const fieldErrors = error.issues.map(issue => this.formatZodIssue(issue, data));

    // Generate helpful suggestions based on error types
    const suggestions = this.generateSuggestions(error.issues, fieldErrors);

    return {
      message: this.createOverallMessage(fieldErrors),
      fields: fieldErrors,
      suggestions,
    };
  }

  /**
   * Format a single Zod issue into a field error
   * IMPROVEMENT: Handle empty paths and use sanitized values
   */
  private static formatZodIssue(issue: ZodIssue, data: unknown): FieldError {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'input';
    const fieldValue = this.getNestedValue(data, issue.path);

    // Get constraint info for this field
    const constraintKey = `${fieldPath}.${issue.code}`;
    const constraint = FIELD_CONSTRAINTS[constraintKey] ?? FIELD_CONSTRAINTS[fieldPath];

    let errorMessage = issue.message;
    let constraintDescription: string | undefined;
    let expectedFormat: string | undefined;

    // Enhance error message based on issue type
    switch (issue.code) {
      case 'invalid_type':
        errorMessage = `Expected ${issue.expected}, but received ${issue.received}`;
        if (constraint?.format) {
          expectedFormat = constraint.format;
          errorMessage += `. ${constraint.description}`;
        }
        break;

      case 'too_small':
        if (issue.type === 'string') {
          if (issue.minimum === 1) {
            errorMessage = `Field '${fieldPath}' cannot be empty`;
          } else {
            errorMessage = `Field '${fieldPath}' must be at least ${issue.minimum} characters long (current: ${typeof fieldValue === 'string' ? fieldValue.length : 'unknown'})`;
          }
        } else if (issue.type === 'number') {
          errorMessage = `Field '${fieldPath}' must be at least ${issue.minimum} (current: ${this.formatValueForMessage(fieldValue)})`;
        } else if (issue.type === 'array') {
          errorMessage = `Field '${fieldPath}' must contain at least ${issue.minimum} items`;
        }
        if (constraint?.description) {
          constraintDescription = constraint.description;
        }
        break;

      case 'too_big':
        if (issue.type === 'string') {
          errorMessage = `Field '${fieldPath}' exceeds maximum length of ${issue.maximum} characters (current: ${typeof fieldValue === 'string' ? fieldValue.length : 'unknown'})`;
        } else if (issue.type === 'number') {
          errorMessage = `Field '${fieldPath}' exceeds maximum value of ${issue.maximum} (current: ${this.formatValueForMessage(fieldValue)})`;
        } else if (issue.type === 'array') {
          errorMessage = `Field '${fieldPath}' exceeds maximum of ${issue.maximum} items`;
        }
        if (constraint?.description) {
          constraintDescription = constraint.description;
        }
        break;

      case 'invalid_enum_value': {
        const options = issue.options.map(o => `'${o}'`).join(', ');
        const received = this.formatValueForMessage(fieldValue);
        errorMessage = `Field '${fieldPath}' must be one of: ${options} (received: '${received}')`;
        if (constraint?.examples) {
          expectedFormat = `Valid options: ${options}`;
        }
        break;
      }

      case 'invalid_string':
        if (issue.validation === 'email') {
          errorMessage = `Field '${fieldPath}' must be a valid email address`;
        } else if (issue.validation === 'url') {
          errorMessage = `Field '${fieldPath}' must be a valid URL`;
        } else if (issue.validation === 'regex') {
          errorMessage = `Field '${fieldPath}' does not match the required pattern`;
        }
        break;

      default:
        errorMessage = `Field '${fieldPath}': ${issue.message}`;
        if (constraint?.description) {
          errorMessage += `. ${constraint.description}`;
        }
    }

    return {
      field: fieldPath,
      value: fieldValue,
      error: errorMessage,
      constraint: constraintDescription,
      expectedFormat: expectedFormat ?? constraint?.format,
    };
  }

  /**
   * Get nested value from object using path array
   */
  private static getNestedValue(obj: unknown, path: (string | number)[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof key === 'number') {
        if (Array.isArray(current)) {
          current = current[key];
          continue;
        }
        return undefined;
      }

      if (typeof current !== 'object') {
        return undefined;
      }

      const record = current as Record<string, unknown>;
      current = record[key];
    }
    return current;
  }

  /**
   * Redact sensitive data from input for secure error reporting
   * SECURITY: Prevents leaking code/secrets in error logs
   */
  private static redactSensitiveData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return { type: typeof data };
    }

    const redacted: Record<string, unknown> = {};
    const obj = data as Record<string, unknown>;

    // Redact sensitive fields
    const sensitiveFields = ['prompt', 'code', 'context', 'cliPath'];

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.includes(key)) {
        if (typeof value === 'string') {
          redacted[key] = `<redacted ${value.length} chars>`;
        } else {
          redacted[key] = '<redacted>';
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively redact nested objects
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Escape control characters for safe logging
   * SECURITY: Prevents ANSI injection and control character attacks
   */
  private static escapeControlCharacters(str: string): string {
    let result = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (!char) continue;

      const code = char.charCodeAt(0);
      const isControl = (code >= 0 && code <= 31) || (code >= 127 && code <= 159);

      if (isControl) {
        result += `\\x${code.toString(16).padStart(2, '0')}`;
      } else {
        result += char;
      }
    }

    return result;
  }

  private static stripControlCharacters(
    value: string,
    options: { keepNewlinesAndTabs: boolean }
  ): string {
    let result = '';

    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (!char) continue;

      const code = char.charCodeAt(0);
      const isControl = (code >= 0 && code <= 31) || code === 127;
      if (!isControl) {
        result += char;
        continue;
      }

      const shouldKeep = options.keepNewlinesAndTabs && (code === 9 || code === 10 || code === 13);
      if (shouldKeep) {
        result += char;
      }
    }

    return result;
  }

  /**
   * Sanitize string value for safe display
   * SECURITY: Removes control characters and limits length
   */
  private static sanitizeValueForDisplay(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'string') {
      // Remove control characters first
      const cleaned = this.escapeControlCharacters(value);

      // Truncate if too long
      if (cleaned.length > 100) {
        return `${cleaned.substring(0, 100)}... (${value.length} chars)`;
      }
      return cleaned;
    }

    if (typeof value === 'object') {
      try {
        const str = JSON.stringify(value);
        if (str.length > 100) {
          return `${str.substring(0, 100)}... (${str.length} chars)`;
        }
        return str;
      } catch {
        return '<complex object>';
      }
    }

    return String(value);
  }

  /**
   * Create overall error message from field errors
   * IMPROVEMENT: Handle empty field path for top-level errors
   */
  private static createOverallMessage(fieldErrors: FieldError[]): string {
    if (fieldErrors.length === 0) {
      return 'Validation failed';
    }

    if (fieldErrors.length === 1) {
      const firstError = fieldErrors[0];
      return `Validation error: ${firstError?.error ?? 'Unknown error'}`;
    }

    return `Validation failed with ${fieldErrors.length} errors:\n${fieldErrors.map((e, i) => `  ${i + 1}. ${e.error}`).join('\n')}`;
  }

  /**
   * Generate helpful suggestions based on validation errors
   */
  private static generateSuggestions(issues: ZodIssue[], fieldErrors: FieldError[]): string[] {
    const suggestions: string[] = [];
    const errorTypes = new Set(issues.map(i => i.code));

    // Type-specific suggestions
    if (errorTypes.has('invalid_type')) {
      suggestions.push(
        'Check that all fields have the correct data type (string, number, boolean, etc.)'
      );
    }

    if (errorTypes.has('too_small')) {
      const stringFields = fieldErrors.filter(e => e.error.includes('characters'));
      if (stringFields.length > 0) {
        suggestions.push(
          'Ensure required text fields are not empty and meet minimum length requirements'
        );
      }

      const numberFields = fieldErrors.filter(
        e => e.error.includes('at least') && !e.error.includes('characters')
      );
      if (numberFields.length > 0) {
        suggestions.push('Verify that numeric values meet minimum thresholds');
      }
    }

    if (errorTypes.has('too_big')) {
      const promptErrors = fieldErrors.filter(e => e.field === 'prompt');
      if (promptErrors.length > 0) {
        suggestions.push(
          'Consider reducing the prompt length or splitting it into smaller review requests'
        );
      } else {
        suggestions.push('Reduce values to be within acceptable limits');
      }
    }

    if (errorTypes.has('invalid_enum_value')) {
      suggestions.push(
        'Use only the allowed values for enum fields as specified in the error messages'
      );
    }

    // Field-specific suggestions
    const fieldNames = fieldErrors.map(e => e.field);

    if (fieldNames.some(f => f.startsWith('options.timeout'))) {
      suggestions.push('Timeout must be 0 (unlimited) or a positive number in milliseconds');
    }

    if (fieldNames.some(f => f.startsWith('options.cliPath'))) {
      suggestions.push(
        'CLI path must be a whitelisted executable or absolute path for security reasons'
      );
      suggestions.push(
        'Commonly allowed paths: codex, gemini, /usr/local/bin/codex, /usr/local/bin/gemini'
      );
    }

    // Add examples for specific fields
    fieldErrors.forEach(error => {
      const constraint = FIELD_CONSTRAINTS[error.field];
      if (constraint?.examples && constraint.examples.length > 0) {
        suggestions.push(`Valid ${error.field} examples: ${constraint.examples.join(', ')}`);
      }
    });

    // Generic fallback
    if (suggestions.length === 0) {
      suggestions.push('Review the field constraints in the error messages above');
      suggestions.push('Consult the MCP tool documentation for detailed input requirements');
    }

    return Array.from(new Set(suggestions)); // Remove duplicates
  }

  /**
   * Format validation error details into a user-friendly message
   * SECURITY: Use sanitized values and ASCII bullets for compatibility
   */
  static formatErrorMessage(error: ValidationErrorDetails, context?: string): string {
    const lines: string[] = [];

    // Add context if provided
    if (context) {
      lines.push(`Validation failed for ${context}:`);
      lines.push('');
    }

    // Add main message
    lines.push(error.message);
    lines.push('');

    // Add field details if available
    if (error.fields.length > 0) {
      lines.push('Field Details:');
      error.fields.forEach(field => {
        lines.push(`  - ${field.error}`);
        if (field.expectedFormat) {
          lines.push(`    Expected format: ${field.expectedFormat}`);
        }
        if (field.value !== undefined && field.value !== null) {
          // SECURITY: Use sanitized value display
          const valueStr = this.sanitizeValueForDisplay(field.value);
          lines.push(`    Received: ${valueStr}`);
        }
      });
      lines.push('');
    }

    // Add suggestions
    if (error.suggestions.length > 0) {
      lines.push('Suggestions:');
      error.suggestions.forEach(suggestion => {
        lines.push(`  - ${suggestion}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Sanitize input parameters and return warnings if modifications were made
   * ENHANCEMENT: Comprehensive sanitization including control characters, type coercion, and normalization
   */
  static sanitizeParams<T extends Record<string, unknown>>(
    params: T
  ): { sanitized: T; warnings: string[] } {
    const warnings: string[] = [];
    const sanitized = { ...params } as T & {
      prompt?: string;
      reviewId?: string;
      options?: Record<string, unknown>;
    };

    // Sanitize prompt (trim, remove control characters)
    if (typeof params.prompt === 'string') {
      let cleaned = params.prompt;

      // Trim whitespace
      const trimmed = cleaned.trim();
      if (trimmed !== cleaned) {
        cleaned = trimmed;
        warnings.push('Removed leading/trailing whitespace from prompt');
      }

      // Remove null bytes and other control characters (except newlines/tabs which are valid in code)
      const withoutNulls = cleaned.replace(/\0/g, '');
      if (withoutNulls !== cleaned) {
        cleaned = withoutNulls;
        warnings.push('Removed null bytes from prompt');
      }

      // Remove other dangerous control characters (but keep \n, \r, \t for code formatting)
      const withoutControls = this.stripControlCharacters(cleaned, { keepNewlinesAndTabs: true });
      if (withoutControls !== cleaned) {
        cleaned = withoutControls;
        warnings.push('Removed control characters from prompt');
      }

      if (cleaned !== params.prompt) {
        sanitized.prompt = cleaned;
      }
    }

    // Sanitize reviewId if present
    if (typeof params.reviewId === 'string') {
      const trimmed = params.reviewId.trim();
      if (trimmed !== params.reviewId) {
        sanitized.reviewId = trimmed;
        warnings.push('Removed whitespace from reviewId');
      }

      // Remove control characters from reviewId
      const cleaned = this.stripControlCharacters(trimmed, { keepNewlinesAndTabs: false });
      if (cleaned !== trimmed) {
        sanitized.reviewId = cleaned;
        warnings.push('Removed control characters from reviewId');
      }
    }

    // Validate and sanitize options if present
    const paramsOptions = params.options as Record<string, unknown> | undefined;
    if (paramsOptions && typeof paramsOptions === 'object') {
      const sanitizedOptions: Record<string, unknown> = { ...sanitized.options };

      // Ensure timeout is a valid finite number
      if (paramsOptions.timeout !== undefined) {
        const timeout = Number(paramsOptions.timeout);
        if (!isNaN(timeout) && isFinite(timeout)) {
          if (timeout !== paramsOptions.timeout) {
            sanitizedOptions.timeout = timeout;
            warnings.push(`Converted timeout to number: ${timeout}`);
          }
        } else if (!isFinite(timeout)) {
          warnings.push('Invalid timeout value (NaN or Infinity) - validation will fail');
        }
      }

      // Sanitize cliPath (trim and remove control characters)
      if (typeof paramsOptions.cliPath === 'string') {
        let cleaned = paramsOptions.cliPath.trim();

        // Remove control characters from cliPath (security)
        const withoutControls = this.stripControlCharacters(cleaned, {
          keepNewlinesAndTabs: false,
        });
        if (withoutControls !== cleaned) {
          cleaned = withoutControls;
          warnings.push('Removed control characters from cliPath');
        }

        if (cleaned !== paramsOptions.cliPath) {
          sanitizedOptions.cliPath = cleaned;
          warnings.push('Removed whitespace from cliPath');
        }
      }

      // Coerce boolean strings for parallelExecution
      if (paramsOptions.parallelExecution !== undefined) {
        const value = paramsOptions.parallelExecution;
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') {
            sanitizedOptions.parallelExecution = true;
            warnings.push("Converted parallelExecution 'true' to boolean");
          } else if (value.toLowerCase() === 'false') {
            sanitizedOptions.parallelExecution = false;
            warnings.push("Converted parallelExecution 'false' to boolean");
          }
        }
      }

      // Coerce boolean strings for includeIndividualReviews
      if (paramsOptions.includeIndividualReviews !== undefined) {
        const value = paramsOptions.includeIndividualReviews;
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') {
            sanitizedOptions.includeIndividualReviews = true;
            warnings.push("Converted includeIndividualReviews 'true' to boolean");
          } else if (value.toLowerCase() === 'false') {
            sanitizedOptions.includeIndividualReviews = false;
            warnings.push("Converted includeIndividualReviews 'false' to boolean");
          }
        }
      }

      // Normalize severity casing
      if (typeof paramsOptions.severity === 'string') {
        const normalized = paramsOptions.severity.toLowerCase();
        if (normalized !== paramsOptions.severity) {
          sanitizedOptions.severity = normalized;
          warnings.push(`Normalized severity to lowercase: '${normalized}'`);
        }
      }

      sanitized.options = sanitizedOptions;
    }

    return { sanitized, warnings };
  }
}
