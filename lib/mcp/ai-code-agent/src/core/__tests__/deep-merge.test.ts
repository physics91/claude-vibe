/**
 * Unit tests for deepMerge utility
 */

import { describe, it, expect } from 'vitest';
import { deepMerge } from '../utils.js';

describe('deepMerge', () => {
  describe('primitive values', () => {
    it('should override primitive values', () => {
      const base = { a: 1, b: 'hello' };
      const override = { a: 2 };
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 2, b: 'hello' });
    });

    it('should preserve base values when override is undefined', () => {
      const base = { a: 1, b: 2 };
      const override = { a: undefined };
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should preserve base values when override is null', () => {
      const base = { a: 1, b: 2 };
      const override = { a: null };
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should add new properties from override', () => {
      const base = { a: 1 };
      const override = { b: 2 } as Partial<typeof base & { b: number }>;
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('nested objects', () => {
    it('should recursively merge nested objects', () => {
      const base = {
        server: { port: 3000, host: 'localhost' },
        logging: { level: 'info' }
      };
      const override = {
        server: { port: 8080 }
      };
      const result = deepMerge(base, override);
      expect(result).toEqual({
        server: { port: 8080, host: 'localhost' },
        logging: { level: 'info' }
      });
    });

    it('should handle deeply nested objects', () => {
      const base = {
        a: {
          b: {
            c: { d: 1, e: 2 }
          }
        }
      };
      const override = {
        a: {
          b: {
            c: { d: 100 }
          }
        }
      };
      const result = deepMerge(base, override);
      expect(result).toEqual({
        a: {
          b: {
            c: { d: 100, e: 2 }
          }
        }
      });
    });

    it('should replace base object with override when override is primitive', () => {
      const base = { a: { nested: 'value' } };
      const override = { a: 'string' as unknown as { nested: string } };
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 'string' });
    });
  });

  describe('arrays', () => {
    it('should replace arrays (not merge element-wise)', () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [4, 5] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: [4, 5] });
    });

    it('should handle array of objects', () => {
      const base = { items: [{ id: 1 }, { id: 2 }] };
      const override = { items: [{ id: 3 }] };
      const result = deepMerge(base, override);
      expect(result).toEqual({ items: [{ id: 3 }] });
    });
  });

  describe('config-like structures', () => {
    it('should merge ServerConfig-like structures', () => {
      const base = {
        server: { logLevel: 'info' },
        codex: { enabled: true, timeout: 30000, retryAttempts: 3 },
        logging: { level: 'info', file: { enabled: false, path: './logs' } }
      };
      const override = {
        codex: { timeout: 60000 },
        logging: { file: { enabled: true } }
      };
      const result = deepMerge(base, override);
      expect(result).toEqual({
        server: { logLevel: 'info' },
        codex: { enabled: true, timeout: 60000, retryAttempts: 3 },
        logging: { level: 'info', file: { enabled: true, path: './logs' } }
      });
    });

    it('should handle context with presets', () => {
      const base = {
        context: {
          autoDetect: true,
          defaults: { language: 'typescript' },
          presets: { web: { platform: 'web' } }
        }
      };
      const override = {
        context: {
          defaults: { framework: 'react' },
          presets: { api: { platform: 'node' } }
        }
      };
      const result = deepMerge(base, override);
      expect(result).toEqual({
        context: {
          autoDetect: true,
          defaults: { language: 'typescript', framework: 'react' },
          presets: { web: { platform: 'web' }, api: { platform: 'node' } }
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const base = { a: 1 };
      const override = {};
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 1 });
    });

    it('should handle empty base', () => {
      const base = {} as { a?: number };
      const override = { a: 1 };
      const result = deepMerge(base, override);
      expect(result).toEqual({ a: 1 });
    });

    it('should not mutate original objects', () => {
      const base = { a: { b: 1 } };
      const override = { a: { b: 2 } };
      const baseCopy = JSON.parse(JSON.stringify(base));
      const overrideCopy = JSON.parse(JSON.stringify(override));

      deepMerge(base, override);

      expect(base).toEqual(baseCopy);
      expect(override).toEqual(overrideCopy);
    });

    it('should handle boolean false override', () => {
      const base = { enabled: true };
      const override = { enabled: false };
      const result = deepMerge(base, override);
      expect(result).toEqual({ enabled: false });
    });

    it('should handle zero override', () => {
      const base = { count: 10 };
      const override = { count: 0 };
      const result = deepMerge(base, override);
      expect(result).toEqual({ count: 0 });
    });

    it('should handle empty string override', () => {
      const base = { name: 'default' };
      const override = { name: '' };
      const result = deepMerge(base, override);
      expect(result).toEqual({ name: '' });
    });
  });
});
