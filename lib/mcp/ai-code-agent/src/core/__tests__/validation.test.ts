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
  });
});
