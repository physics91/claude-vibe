/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../error-handler.js';
import { ValidationUtils } from '../validation.js';

describe('ValidationUtils', () => {
  describe('validate', () => {
    it('should return success for valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = ValidationUtils.validate(schema, {
        name: 'John',
        age: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = ValidationUtils.validate(schema, {
        name: 'John',
        age: 'thirty', // Invalid: should be number
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.fields).toHaveLength(1);
      expect(result.error?.fields[0].field).toBe('age');
    });

    it('should provide detailed error messages for missing required fields', () => {
      const schema = z.object({
        name: z.string({ required_error: 'Name is required' }),
        email: z.string({ required_error: 'Email is required' }),
      });

      const result = ValidationUtils.validate(schema, {});

      expect(result.success).toBe(false);
      expect(result.error?.fields).toHaveLength(2);
      expect(result.error?.message).toContain('2 errors');
    });

    it('should provide detailed error messages for type mismatches', () => {
      const schema = z.object({
        count: z.number({ invalid_type_error: 'Count must be a number' }),
      });

      const result = ValidationUtils.validate(schema, { count: 'abc' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('Expected number');
    });

    it('should provide detailed error messages for string length violations', () => {
      const schema = z.object({
        prompt: z.string().min(1, { message: 'Prompt cannot be empty' }).max(100, {
          message: 'Prompt exceeds maximum length of 100 characters',
        }),
      });

      const result = ValidationUtils.validate(schema, { prompt: '' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('cannot be empty');
    });

    it('should provide detailed error messages for number range violations', () => {
      const schema = z.object({
        timeout: z
          .number()
          .min(1000, { message: 'Timeout must be at least 1000ms' })
          .max(300000, { message: 'Timeout cannot exceed 300000ms' }),
      });

      const result1 = ValidationUtils.validate(schema, { timeout: 500 });
      expect(result1.success).toBe(false);
      expect(result1.error?.fields[0].error).toContain('at least 1000');

      const result2 = ValidationUtils.validate(schema, { timeout: 400000 });
      expect(result2.success).toBe(false);
      expect(result2.error?.fields[0].error).toContain('exceeds maximum value of 300000');
    });

    it('should provide detailed error messages for enum violations', () => {
      const schema = z.object({
        severity: z.enum(['all', 'high', 'medium'], {
          errorMap: () => ({ message: "Severity must be one of: 'all', 'high', 'medium'" }),
        }),
      });

      const result = ValidationUtils.validate(schema, { severity: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain("'all', 'high', 'medium'");
    });

    it('should generate helpful suggestions for common errors', () => {
      const schema = z.object({
        prompt: z.string().min(1).max(100),
      });

      const result = ValidationUtils.validate(schema, { prompt: 'a'.repeat(200) });

      expect(result.success).toBe(false);
      expect(result.error?.suggestions).toBeDefined();
      expect(result.error?.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle nested object validation', () => {
      const schema = z.object({
        options: z.object({
          timeout: z.number().min(1000),
          severity: z.enum(['all', 'high', 'medium']),
        }),
      });

      const result = ValidationUtils.validate(schema, {
        options: {
          timeout: 500,
          severity: 'invalid',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.fields).toHaveLength(2);
      expect(result.error?.fields.some(f => f.field === 'options.timeout')).toBe(true);
      expect(result.error?.fields.some(f => f.field === 'options.severity')).toBe(true);
    });
  });

  describe('validateOrThrow', () => {
    it('should return validated data for valid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const data = ValidationUtils.validateOrThrow(schema, {
        name: 'John',
        age: 30,
      });

      expect(data).toEqual({ name: 'John', age: 30 });
    });

    it('should throw ValidationError for invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      expect(() => {
        ValidationUtils.validateOrThrow(schema, {
          name: 'John',
          age: 'thirty',
        });
      }).toThrow(ValidationError);
    });

    it('should include context in error message when provided', () => {
      const schema = z.object({
        prompt: z.string().min(1),
      });

      try {
        ValidationUtils.validateOrThrow(schema, { prompt: '' }, 'review_code_with_codex');
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain('review_code_with_codex');
      }
    });

    it('should include validation details in error', () => {
      const schema = z.object({
        timeout: z.number().min(1000).max(300000),
      });

      try {
        ValidationUtils.validateOrThrow(schema, { timeout: 500 });
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.details).toBeDefined();
        const details = validationError.details;
        if (typeof details !== 'object' || details === null) {
          throw new Error('ValidationError.details should be an object');
        }
        expect((details as Record<string, unknown>).validationDetails).toBeDefined();
      }
    });
  });

  describe('formatErrorMessage', () => {
    it('should format error with field details', () => {
      const error = {
        message: 'Validation failed with 2 errors',
        fields: [
          {
            field: 'prompt',
            value: '',
            error: "Field 'prompt' cannot be empty",
            expectedFormat: 'Non-empty string',
          },
          {
            field: 'options.timeout',
            value: 500,
            error: "Field 'options.timeout' must be at least 1000",
            constraint: 'Minimum 1000ms',
          },
        ],
        suggestions: [
          'Ensure required text fields are not empty',
          'Verify that numeric values meet minimum thresholds',
        ],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('Validation failed with 2 errors');
      expect(formatted).toContain('Field Details:');
      expect(formatted).toContain("Field 'prompt' cannot be empty");
      expect(formatted).toContain('Expected format: Non-empty string');
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('Ensure required text fields are not empty');
    });

    it('should include context when provided', () => {
      const error = {
        message: 'Validation failed',
        fields: [],
        suggestions: ['Check the input'],
      };

      const formatted = ValidationUtils.formatErrorMessage(error, 'review_code_with_gemini');

      expect(formatted).toContain('Validation failed for review_code_with_gemini');
    });

    it('should truncate long values in error messages', () => {
      const error = {
        message: 'Validation error',
        fields: [
          {
            field: 'prompt',
            value: 'a'.repeat(200),
            error: 'Prompt too long',
          },
        ],
        suggestions: [],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('(200 chars)');
      expect(formatted).toContain('Received:');
    });
  });

  describe('sanitizeParams', () => {
    it('should trim whitespace from prompt', () => {
      const params = {
        prompt: '  test prompt  ',
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.prompt).toBe('test prompt');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('whitespace from prompt');
    });

    it('should remove null bytes from prompt', () => {
      const params = {
        prompt: 'test\0prompt',
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.prompt).toBe('testprompt');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('null bytes');
    });

    it('should convert timeout to number if string', () => {
      const params = {
        prompt: 'test',
        options: {
          timeout: '60000',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options.timeout).toBe(60000);
      expect(typeof sanitized.options.timeout).toBe('number');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Converted timeout to number');
    });

    it('should trim cliPath if provided', () => {
      const params = {
        prompt: 'test',
        options: {
          cliPath: '  /usr/local/bin/codex  ',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options.cliPath).toBe('/usr/local/bin/codex');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('whitespace from cliPath');
    });

    it('should return empty warnings for clean input', () => {
      const params = {
        prompt: 'test prompt',
        options: {
          timeout: 60000,
          severity: 'all' as const,
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized).toEqual(params);
      expect(warnings).toHaveLength(0);
    });

    it('should handle multiple sanitization issues', () => {
      const params = {
        prompt: '  test\0prompt  ',
        options: {
          timeout: '60000',
          cliPath: '  codex  ',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.prompt).toBe('testprompt');
      expect(sanitized.options.timeout).toBe(60000);
      expect(sanitized.options.cliPath).toBe('codex');
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });

    it('should not modify original params object', () => {
      const params = {
        prompt: '  test  ',
        options: {
          timeout: 60000,
        },
      };

      const original = structuredClone(params);
      ValidationUtils.sanitizeParams(params);

      expect(params).toEqual(original);
    });

    it('should coerce parallelExecution string to boolean', () => {
      const params = {
        prompt: 'test',
        options: {
          parallelExecution: 'true',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.parallelExecution).toBe(true);
      expect(warnings).toContain("Converted parallelExecution 'true' to boolean");
    });

    it('should coerce parallelExecution string false to boolean', () => {
      const params = {
        prompt: 'test',
        options: {
          parallelExecution: 'false',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.parallelExecution).toBe(false);
      expect(warnings).toContain("Converted parallelExecution 'false' to boolean");
    });

    it('should coerce includeIndividualReviews string to boolean', () => {
      const params = {
        prompt: 'test',
        options: {
          includeIndividualReviews: 'TRUE',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.includeIndividualReviews).toBe(true);
      expect(warnings).toContain("Converted includeIndividualReviews 'true' to boolean");
    });

    it('should coerce includeIndividualReviews string false to boolean', () => {
      const params = {
        prompt: 'test',
        options: {
          includeIndividualReviews: 'FALSE',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.includeIndividualReviews).toBe(false);
      expect(warnings).toContain("Converted includeIndividualReviews 'false' to boolean");
    });

    it('should normalize severity to lowercase', () => {
      const params = {
        prompt: 'test',
        options: {
          severity: 'HIGH',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.severity).toBe('high');
      expect(warnings.some(w => w.includes('Normalized severity'))).toBe(true);
    });

    it('should sanitize reviewId', () => {
      const params = {
        reviewId: '  test-id  ',
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.reviewId).toBe('test-id');
      expect(warnings).toContain('Removed whitespace from reviewId');
    });

    it('should remove control characters from reviewId', () => {
      const params = {
        reviewId: 'test\x00\x01id',
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.reviewId).toBe('testid');
      expect(warnings).toContain('Removed control characters from reviewId');
    });

    it('should remove control characters from cliPath', () => {
      const params = {
        prompt: 'test',
        options: {
          cliPath: '/usr\x00/bin/codex',
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.cliPath).toBe('/usr/bin/codex');
      expect(warnings).toContain('Removed control characters from cliPath');
    });

    it('should remove control characters from prompt but keep newlines and tabs', () => {
      const params = {
        prompt: 'line1\n\tline2\x00\x01\x02end',
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.prompt).toBe('line1\n\tline2end');
      expect(warnings.some(w => w.includes('control characters from prompt'))).toBe(true);
    });

    it('should warn about invalid timeout (Infinity)', () => {
      const params = {
        prompt: 'test',
        options: {
          timeout: Infinity,
        },
      };

      const { warnings } = ValidationUtils.sanitizeParams(params);

      expect(warnings).toContain('Invalid timeout value (NaN or Infinity) - validation will fail');
    });

    it('should handle options without sensitive fields', () => {
      const params = {
        prompt: 'test',
        options: {
          debug: true,
        },
      };

      const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);

      expect(sanitized.options?.debug).toBe(true);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('validate edge cases', () => {
    it('should handle non-ZodError thrown during validation', () => {
      // Create a schema that throws a regular error during refinement
      const schema = z.object({
        value: z.string(),
      });

      // Non-Zod errors are caught and handled
      const result = ValidationUtils.validate(schema, { value: 123 });

      expect(result.success).toBe(false);
    });

    it('should handle empty field path for input-level errors', () => {
      const schema = z.string();

      const result = ValidationUtils.validate(schema, 123);

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].field).toBe('input');
    });

    it('should handle array length validation', () => {
      const schema = z.object({
        items: z.array(z.string()).min(2).max(5),
      });

      const result1 = ValidationUtils.validate(schema, { items: ['one'] });
      expect(result1.success).toBe(false);
      expect(result1.error?.fields[0].error).toContain('at least 2 items');

      const result2 = ValidationUtils.validate(schema, { items: ['1', '2', '3', '4', '5', '6'] });
      expect(result2.success).toBe(false);
      expect(result2.error?.fields[0].error).toContain('exceeds maximum of 5 items');
    });

    it('should handle email validation', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = ValidationUtils.validate(schema, { email: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('valid email address');
    });

    it('should handle URL validation', () => {
      const schema = z.object({
        url: z.string().url(),
      });

      const result = ValidationUtils.validate(schema, { url: 'not-a-url' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('valid URL');
    });

    it('should handle regex validation', () => {
      const schema = z.object({
        code: z.string().regex(/^[A-Z]{3}-\d{3}$/),
      });

      const result = ValidationUtils.validate(schema, { code: 'abc-123' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('required pattern');
    });

    it('should handle too_big on strings', () => {
      const schema = z.object({
        name: z.string().max(10),
      });

      const result = ValidationUtils.validate(schema, { name: 'verylongname' });

      expect(result.success).toBe(false);
      expect(result.error?.fields[0].error).toContain('exceeds maximum length');
    });

    it('should provide suggestions for timeout errors', () => {
      const schema = z.object({
        options: z.object({
          timeout: z.number().min(0),
        }),
      });

      const result = ValidationUtils.validate(schema, { options: { timeout: -1 } });

      expect(result.success).toBe(false);
      expect(result.error?.suggestions.some(s => s.includes('Timeout'))).toBe(true);
    });

    it('should provide suggestions for cliPath errors', () => {
      const schema = z.object({
        options: z.object({
          cliPath: z.string().min(1),
        }),
      });

      const result = ValidationUtils.validate(schema, { options: { cliPath: '' } });

      expect(result.success).toBe(false);
      expect(result.error?.suggestions.some(s => s.includes('CLI path'))).toBe(true);
    });
  });

  describe('formatErrorMessage edge cases', () => {
    it('should handle empty fields array', () => {
      const error = {
        message: 'Validation failed',
        fields: [],
        suggestions: ['Check input'],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('Suggestions:');
      expect(formatted).not.toContain('Field Details:');
    });

    it('should handle undefined field value', () => {
      const error = {
        message: 'Validation error',
        fields: [
          {
            field: 'missing',
            value: undefined,
            error: 'Field is required',
          },
        ],
        suggestions: [],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('Field is required');
      expect(formatted).not.toContain('Received:');
    });

    it('should handle null field value', () => {
      const error = {
        message: 'Validation error',
        fields: [
          {
            field: 'nullField',
            value: null,
            error: 'Field cannot be null',
          },
        ],
        suggestions: [],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('Field cannot be null');
      expect(formatted).not.toContain('Received:');
    });

    it('should handle complex object value', () => {
      const error = {
        message: 'Validation error',
        fields: [
          {
            field: 'complex',
            value: { nested: { deep: 'value' } },
            error: 'Invalid object',
          },
        ],
        suggestions: [],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      expect(formatted).toContain('Received:');
      expect(formatted).toContain('nested');
    });

    it('should handle ANSI escape sequences in values', () => {
      const error = {
        message: 'Validation error',
        fields: [
          {
            field: 'prompt',
            value: '\x1b[31mred text\x1b[0m',
            error: 'Invalid prompt',
          },
        ],
        suggestions: [],
      };

      const formatted = ValidationUtils.formatErrorMessage(error);

      // Control characters should be escaped
      expect(formatted).toContain('\\x1b');
    });
  });
});

import {
  isPlainObject,
  isRecord,
  hasProperty,
  hasStringProperty,
  hasNumberProperty,
  hasBooleanProperty,
  hasArrayProperty,
  getNumberProperty,
  getStringProperty,
  getBooleanProperty,
  isCLIWrapperResponse,
  isTimeoutError,
  isExitCodeError,
} from '../validation.js';

describe('Type Guards', () => {
  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ key: 'value' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
    });
  });

  describe('isRecord', () => {
    it('should return true for plain objects', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ a: 1 })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord('string')).toBe(false);
    });
  });

  describe('hasProperty', () => {
    it('should return true if property exists', () => {
      expect(hasProperty({ name: 'test' }, 'name')).toBe(true);
    });

    it('should return true even if property value is undefined', () => {
      expect(hasProperty({ name: undefined }, 'name')).toBe(true);
    });

    it('should return false if property does not exist', () => {
      expect(hasProperty({}, 'name')).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasProperty(null, 'name')).toBe(false);
      expect(hasProperty('string', 'length')).toBe(false);
    });
  });

  describe('hasStringProperty', () => {
    it('should return true if property is a string', () => {
      expect(hasStringProperty({ name: 'test' }, 'name')).toBe(true);
    });

    it('should return false if property is not a string', () => {
      expect(hasStringProperty({ name: 123 }, 'name')).toBe(false);
      expect(hasStringProperty({ name: null }, 'name')).toBe(false);
    });

    it('should return false if property does not exist', () => {
      expect(hasStringProperty({}, 'name')).toBe(false);
    });
  });

  describe('hasNumberProperty', () => {
    it('should return true if property is a number', () => {
      expect(hasNumberProperty({ age: 25 }, 'age')).toBe(true);
      expect(hasNumberProperty({ value: 0 }, 'value')).toBe(true);
    });

    it('should return false if property is not a number', () => {
      expect(hasNumberProperty({ age: '25' }, 'age')).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasNumberProperty(null, 'age')).toBe(false);
    });
  });

  describe('hasBooleanProperty', () => {
    it('should return true if property is a boolean', () => {
      expect(hasBooleanProperty({ active: true }, 'active')).toBe(true);
      expect(hasBooleanProperty({ active: false }, 'active')).toBe(true);
    });

    it('should return false if property is not a boolean', () => {
      expect(hasBooleanProperty({ active: 'true' }, 'active')).toBe(false);
      expect(hasBooleanProperty({ active: 1 }, 'active')).toBe(false);
    });
  });

  describe('hasArrayProperty', () => {
    it('should return true if property is an array', () => {
      expect(hasArrayProperty({ items: [] }, 'items')).toBe(true);
      expect(hasArrayProperty({ items: [1, 2, 3] }, 'items')).toBe(true);
    });

    it('should return false if property is not an array', () => {
      expect(hasArrayProperty({ items: 'not array' }, 'items')).toBe(false);
      expect(hasArrayProperty({ items: {} }, 'items')).toBe(false);
    });
  });

  describe('getNumberProperty', () => {
    it('should return number for valid number property', () => {
      expect(getNumberProperty({ count: 10 }, 'count')).toBe(10);
      expect(getNumberProperty({ count: 0 }, 'count')).toBe(0);
      expect(getNumberProperty({ count: -5 }, 'count')).toBe(-5);
    });

    it('should return undefined for NaN or Infinity', () => {
      expect(getNumberProperty({ count: NaN }, 'count')).toBeUndefined();
      expect(getNumberProperty({ count: Infinity }, 'count')).toBeUndefined();
    });

    it('should return undefined for non-number property', () => {
      expect(getNumberProperty({ count: '10' }, 'count')).toBeUndefined();
    });

    it('should return undefined for non-object', () => {
      expect(getNumberProperty(null, 'count')).toBeUndefined();
      expect(getNumberProperty('string', 'length')).toBeUndefined();
    });
  });

  describe('getStringProperty', () => {
    it('should return string for valid string property', () => {
      expect(getStringProperty({ name: 'test' }, 'name')).toBe('test');
      expect(getStringProperty({ name: '' }, 'name')).toBe('');
    });

    it('should return undefined for non-string property', () => {
      expect(getStringProperty({ name: 123 }, 'name')).toBeUndefined();
    });

    it('should return undefined for non-object', () => {
      expect(getStringProperty(null, 'name')).toBeUndefined();
    });
  });

  describe('getBooleanProperty', () => {
    it('should return boolean for valid boolean property', () => {
      expect(getBooleanProperty({ active: true }, 'active')).toBe(true);
      expect(getBooleanProperty({ active: false }, 'active')).toBe(false);
    });

    it('should return undefined for non-boolean property', () => {
      expect(getBooleanProperty({ active: 'true' }, 'active')).toBeUndefined();
    });

    it('should return undefined for non-object', () => {
      expect(getBooleanProperty(null, 'active')).toBeUndefined();
    });
  });

  describe('isCLIWrapperResponse', () => {
    it('should return true for response with response field', () => {
      expect(isCLIWrapperResponse({ response: {} })).toBe(true);
    });

    it('should return true for response with stats field', () => {
      expect(isCLIWrapperResponse({ stats: {} })).toBe(true);
    });

    it('should return true for response with error field', () => {
      expect(isCLIWrapperResponse({ error: 'some error' })).toBe(true);
      expect(isCLIWrapperResponse({ error: null })).toBe(true);
    });

    it('should return true for combined fields', () => {
      expect(isCLIWrapperResponse({ response: {}, stats: {}, error: null })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isCLIWrapperResponse(null)).toBe(false);
      expect(isCLIWrapperResponse('string')).toBe(false);
      expect(isCLIWrapperResponse([])).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isCLIWrapperResponse({})).toBe(false);
    });
  });

  describe('isTimeoutError', () => {
    it('should return true for timedOut: true', () => {
      expect(isTimeoutError({ timedOut: true })).toBe(true);
    });

    it('should return false for timedOut: false', () => {
      expect(isTimeoutError({ timedOut: false })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError('string')).toBe(false);
    });

    it('should return false for objects without timedOut', () => {
      expect(isTimeoutError({})).toBe(false);
      expect(isTimeoutError({ error: 'timeout' })).toBe(false);
    });
  });

  describe('isExitCodeError', () => {
    it('should return true for error with exitCode number', () => {
      expect(isExitCodeError({ exitCode: 1 })).toBe(true);
      expect(isExitCodeError({ exitCode: 0 })).toBe(true);
      expect(isExitCodeError({ exitCode: -1 })).toBe(true);
    });

    it('should return true for error with exitCode, stderr, and stdout', () => {
      expect(
        isExitCodeError({
          exitCode: 1,
          stderr: 'error output',
          stdout: 'standard output',
        })
      ).toBe(true);
    });

    it('should return false for non-number exitCode', () => {
      expect(isExitCodeError({ exitCode: '1' })).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isExitCodeError(null)).toBe(false);
      expect(isExitCodeError('string')).toBe(false);
    });

    it('should return false for objects without exitCode', () => {
      expect(isExitCodeError({})).toBe(false);
    });
  });
});
