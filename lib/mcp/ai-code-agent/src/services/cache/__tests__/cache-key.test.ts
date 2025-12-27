/**
 * Cache Key Generator Tests
 * Tests for cache key generation, normalization, and consistency
 */

import { describe, it, expect } from 'vitest';
import {
  generateCacheKey,
  generateShortCacheKey,
  generatePromptHash,
  type CacheKeyParams,
} from '../cache-key.js';

describe('generateCacheKey', () => {
  describe('basic functionality', () => {
    it('should generate consistent hash for same input', () => {
      const params: CacheKeyParams = {
        prompt: 'Review this code for bugs',
        source: 'codex',
      };

      const key1 = generateCacheKey(params);
      const key2 = generateCacheKey(params);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hash for different prompts', () => {
      const params1: CacheKeyParams = { prompt: 'Review code', source: 'codex' };
      const params2: CacheKeyParams = { prompt: 'Analyze code', source: 'codex' };

      expect(generateCacheKey(params1)).not.toBe(generateCacheKey(params2));
    });

    it('should generate different hash for different sources', () => {
      const params1: CacheKeyParams = { prompt: 'Review', source: 'codex' };
      const params2: CacheKeyParams = { prompt: 'Review', source: 'gemini' };
      const params3: CacheKeyParams = { prompt: 'Review', source: 'combined' };

      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);
      const key3 = generateCacheKey(params3);

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });
  });

  describe('context normalization', () => {
    it('should normalize context to lowercase', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        context: { language: 'TypeScript', framework: 'React' },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        context: { language: 'typescript', framework: 'react' },
      };

      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });

    it('should sort focus array for consistent hashing', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        context: { focus: ['security', 'performance', 'bugs'] },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        context: { focus: ['bugs', 'security', 'performance'] },
      };

      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });

    it('should handle undefined context', () => {
      const params: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
      };

      expect(() => generateCacheKey(params)).not.toThrow();
    });

    it('should handle partial context', () => {
      const params: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        context: { language: 'typescript' },
      };

      expect(() => generateCacheKey(params)).not.toThrow();
    });
  });

  describe('options normalization', () => {
    it('should normalize options to lowercase', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        options: { severity: 'HIGH', preset: 'Security' },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        options: { severity: 'high', preset: 'security' },
      };

      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });

    it('should differentiate by autoDetect boolean', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        options: { autoDetect: true },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        options: { autoDetect: false },
      };

      expect(generateCacheKey(params1)).not.toBe(generateCacheKey(params2));
    });
  });

  describe('service config normalization', () => {
    it('should include model in hash', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        service: { model: 'gpt-4' },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        service: { model: 'gpt-3.5-turbo' },
      };

      expect(generateCacheKey(params1)).not.toBe(generateCacheKey(params2));
    });

    it('should normalize reasoningEffort to lowercase', () => {
      const params1: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        service: { reasoningEffort: 'HIGH' },
      };
      const params2: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        service: { reasoningEffort: 'high' },
      };

      expect(generateCacheKey(params1)).toBe(generateCacheKey(params2));
    });

    it('should handle null model', () => {
      const params: CacheKeyParams = {
        prompt: 'Review',
        source: 'codex',
        service: { model: null },
      };

      expect(() => generateCacheKey(params)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', () => {
      const params: CacheKeyParams = { prompt: '', source: 'codex' };
      expect(() => generateCacheKey(params)).not.toThrow();
    });

    it('should handle very long prompt', () => {
      const longPrompt = 'x'.repeat(100000);
      const params: CacheKeyParams = { prompt: longPrompt, source: 'codex' };

      const key = generateCacheKey(params);
      expect(key).toHaveLength(64);
    });

    it('should handle unicode in prompt', () => {
      const params: CacheKeyParams = {
        prompt: 'Review 日本語コード with émojis 🚀',
        source: 'codex',
      };

      const key = generateCacheKey(params);
      expect(key).toHaveLength(64);
    });

    it('should handle special characters in prompt', () => {
      const params: CacheKeyParams = {
        prompt: 'Review code with `backticks`, "quotes", and <brackets>',
        source: 'codex',
      };

      expect(() => generateCacheKey(params)).not.toThrow();
    });
  });
});

describe('generateShortCacheKey', () => {
  it('should return first 16 characters of full key', () => {
    const params: CacheKeyParams = { prompt: 'Review', source: 'codex' };

    const fullKey = generateCacheKey(params);
    const shortKey = generateShortCacheKey(params);

    expect(shortKey).toHaveLength(16);
    expect(fullKey.startsWith(shortKey)).toBe(true);
  });

  it('should be consistent for same input', () => {
    const params: CacheKeyParams = { prompt: 'Test prompt', source: 'gemini' };

    const key1 = generateShortCacheKey(params);
    const key2 = generateShortCacheKey(params);

    expect(key1).toBe(key2);
  });
});

describe('generatePromptHash', () => {
  it('should generate consistent hash for same prompt', () => {
    const prompt = 'Review this code';

    const hash1 = generatePromptHash(prompt);
    const hash2 = generatePromptHash(prompt);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32); // First 32 chars of SHA-256
  });

  it('should generate different hash for different prompts', () => {
    const hash1 = generatePromptHash('Review code');
    const hash2 = generatePromptHash('Analyze code');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = generatePromptHash('');
    expect(hash).toHaveLength(32);
  });

  it('should be case sensitive', () => {
    const hash1 = generatePromptHash('Review');
    const hash2 = generatePromptHash('review');

    expect(hash1).not.toBe(hash2);
  });
});
