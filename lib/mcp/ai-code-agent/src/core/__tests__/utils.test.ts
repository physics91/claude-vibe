/**
 * Utils Tests
 * Tests for utility functions (excluding deepMerge which has its own test file)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateUUID,
  generateHash,
  sanitizeParams,
  countLines,
  detectLanguage,
  createTimeoutPromise,
  withTimeout,
  stripAnsiCodes,
} from '../utils.js';

describe('generateUUID', () => {
  it('should generate a valid UUID v4 format', () => {
    const uuid = generateUUID();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }

    expect(uuids.size).toBe(100);
  });

  it('should return a string', () => {
    const uuid = generateUUID();

    expect(typeof uuid).toBe('string');
  });

  it('should have correct length', () => {
    const uuid = generateUUID();

    expect(uuid.length).toBe(36);
  });
});

describe('generateHash', () => {
  it('should generate SHA256 hash', () => {
    const hash = generateHash('hello world');

    // SHA256 hash is 64 hex characters
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate consistent hash for same input', () => {
    const hash1 = generateHash('test content');
    const hash2 = generateHash('test content');

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs', () => {
    const hash1 = generateHash('content1');
    const hash2 = generateHash('content2');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = generateHash('');

    expect(hash).toHaveLength(64);
    // SHA256 of empty string is a known value
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle unicode characters', () => {
    const hash = generateHash('こんにちは世界');

    expect(hash).toHaveLength(64);
  });

  it('should handle special characters', () => {
    const hash = generateHash('!@#$%^&*()_+-=[]{}|;:,.<>?');

    expect(hash).toHaveLength(64);
  });

  it('should handle multiline content', () => {
    const hash = generateHash('line1\nline2\nline3');

    expect(hash).toHaveLength(64);
  });
});

describe('sanitizeParams', () => {
  it('should redact code field with length', () => {
    const params = { code: 'const x = 1;', other: 'value' };

    const result = sanitizeParams(params);

    expect(result.code).toBe('[12 characters]');
    expect(result.other).toBe('value');
  });

  it('should redact prompt field with length', () => {
    const params = { prompt: 'Review this code for security issues' };

    const result = sanitizeParams(params);

    expect(result.prompt).toBe('[36 characters]');
  });

  it('should redact both code and prompt', () => {
    const params = { code: 'function foo() {}', prompt: 'Analyze this' };

    const result = sanitizeParams(params);

    expect(result.code).toBe('[17 characters]');
    expect(result.prompt).toBe('[12 characters]');
  });

  it('should preserve other fields', () => {
    const params = {
      code: 'x',
      language: 'typescript',
      fileName: 'test.ts',
      timeout: 5000,
    };

    const result = sanitizeParams(params);

    expect(result.code).toBe('[1 characters]');
    expect(result.language).toBe('typescript');
    expect(result.fileName).toBe('test.ts');
    expect(result.timeout).toBe(5000);
  });

  it('should handle empty code', () => {
    const params = { code: '' };

    const result = sanitizeParams(params);

    expect(result.code).toBe('[0 characters]');
  });

  it('should handle non-string code field', () => {
    const params = { code: 123 as unknown as string };

    const result = sanitizeParams(params);

    // Non-string code should be preserved
    expect(result.code).toBe(123);
  });

  it('should handle non-string prompt field', () => {
    const params = { prompt: null as unknown as string };

    const result = sanitizeParams(params);

    expect(result.prompt).toBe(null);
  });

  it('should not modify original object', () => {
    const params = { code: 'test code' };
    const original = { ...params };

    sanitizeParams(params);

    expect(params).toEqual(original);
  });

  it('should handle object without code or prompt', () => {
    const params = { language: 'python', timeout: 1000 };

    const result = sanitizeParams(params);

    expect(result).toEqual(params);
  });
});

describe('countLines', () => {
  it('should count single line', () => {
    const count = countLines('single line');

    expect(count).toBe(1);
  });

  it('should count multiple lines', () => {
    const count = countLines('line1\nline2\nline3');

    expect(count).toBe(3);
  });

  it('should handle empty string', () => {
    const count = countLines('');

    expect(count).toBe(1);
  });

  it('should handle trailing newline', () => {
    const count = countLines('line1\nline2\n');

    expect(count).toBe(3);
  });

  it('should handle Windows line endings', () => {
    const count = countLines('line1\r\nline2\r\nline3');

    // \r\n splits on \n, so \r remains at end of lines
    expect(count).toBe(3);
  });

  it('should handle multiple consecutive newlines', () => {
    const count = countLines('line1\n\n\nline4');

    expect(count).toBe(4);
  });

  it('should handle only newlines', () => {
    const count = countLines('\n\n\n');

    expect(count).toBe(4);
  });
});

describe('detectLanguage', () => {
  describe('from file extension', () => {
    it('should detect TypeScript from .ts', () => {
      expect(detectLanguage('', 'file.ts')).toBe('typescript');
    });

    it('should detect TypeScript from .tsx', () => {
      expect(detectLanguage('', 'file.tsx')).toBe('typescript');
    });

    it('should detect JavaScript from .js', () => {
      expect(detectLanguage('', 'file.js')).toBe('javascript');
    });

    it('should detect JavaScript from .jsx', () => {
      expect(detectLanguage('', 'file.jsx')).toBe('javascript');
    });

    it('should detect Python from .py', () => {
      expect(detectLanguage('', 'file.py')).toBe('python');
    });

    it('should detect Java from .java', () => {
      expect(detectLanguage('', 'file.java')).toBe('java');
    });

    it('should detect Go from .go', () => {
      expect(detectLanguage('', 'file.go')).toBe('go');
    });

    it('should detect Rust from .rs', () => {
      expect(detectLanguage('', 'file.rs')).toBe('rust');
    });

    it('should detect Ruby from .rb', () => {
      expect(detectLanguage('', 'file.rb')).toBe('ruby');
    });

    it('should detect PHP from .php', () => {
      expect(detectLanguage('', 'file.php')).toBe('php');
    });

    it('should detect C# from .cs', () => {
      expect(detectLanguage('', 'file.cs')).toBe('csharp');
    });

    it('should detect C++ from .cpp', () => {
      expect(detectLanguage('', 'file.cpp')).toBe('cpp');
    });

    it('should detect C from .c', () => {
      expect(detectLanguage('', 'file.c')).toBe('c');
    });

    it('should detect Shell from .sh', () => {
      expect(detectLanguage('', 'file.sh')).toBe('shell');
    });

    it('should detect SQL from .sql', () => {
      expect(detectLanguage('', 'file.sql')).toBe('sql');
    });

    it('should be case insensitive for extensions', () => {
      expect(detectLanguage('', 'file.TS')).toBe('typescript');
      expect(detectLanguage('', 'file.PY')).toBe('python');
    });

    it('should handle path with multiple dots', () => {
      expect(detectLanguage('', 'path/to/file.test.ts')).toBe('typescript');
    });
  });

  describe('from code patterns', () => {
    it('should detect JavaScript from function keyword', () => {
      const code = 'function hello() { return "hi"; }';

      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect JavaScript from arrow function', () => {
      const code = 'const add = (a, b) => a + b;';

      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect Python from def keyword', () => {
      const code = 'def hello():\n    return "hi"';

      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect Python from import statement', () => {
      const code = 'import os\nimport sys';

      expect(detectLanguage(code)).toBe('python');
    });
  });

  describe('edge cases', () => {
    it('should return undefined for unknown extension', () => {
      expect(detectLanguage('', 'file.xyz')).toBeUndefined();
    });

    it('should return undefined for unrecognized code', () => {
      const code = 'some random text without patterns';

      expect(detectLanguage(code)).toBeUndefined();
    });

    it('should prioritize filename over code patterns', () => {
      // Python code but TypeScript filename
      const code = 'def hello():\n    pass';

      expect(detectLanguage(code, 'file.ts')).toBe('typescript');
    });

    it('should handle empty code and no filename', () => {
      expect(detectLanguage('')).toBeUndefined();
    });

    it('should handle file without extension', () => {
      expect(detectLanguage('', 'Makefile')).toBeUndefined();
    });
  });
});

describe('createTimeoutPromise', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject after specified timeout', async () => {
    const promise = createTimeoutPromise(1000);

    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow('Operation timed out after 1000ms');
  });

  it('should not reject before timeout', async () => {
    const promise = createTimeoutPromise(1000);

    vi.advanceTimersByTime(999);

    // Promise should still be pending
    let rejected = false;
    promise.catch(() => {
      rejected = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(rejected).toBe(false);
  });

  it('should include timeout value in error message', async () => {
    const promise = createTimeoutPromise(5000);

    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow('5000ms');
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve when promise completes before timeout', async () => {
    const fastPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('success'), 100);
    });

    const resultPromise = withTimeout(fastPromise, 1000);

    vi.advanceTimersByTime(100);

    await expect(resultPromise).resolves.toBe('success');
  });

  it('should reject when timeout occurs first', async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('success'), 2000);
    });

    const resultPromise = withTimeout(slowPromise, 1000);

    vi.advanceTimersByTime(1000);

    await expect(resultPromise).rejects.toThrow('Operation timed out after 1000ms');
  });

  it('should preserve resolved value type', async () => {
    const promise = new Promise<number>((resolve) => {
      setTimeout(() => resolve(42), 100);
    });

    const resultPromise = withTimeout(promise, 1000);

    vi.advanceTimersByTime(100);

    const result = await resultPromise;
    expect(result).toBe(42);
  });

  it('should preserve rejection from original promise', async () => {
    const failingPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Original error')), 100);
    });

    const resultPromise = withTimeout(failingPromise, 1000);

    vi.advanceTimersByTime(100);

    await expect(resultPromise).rejects.toThrow('Original error');
  });
});

describe('stripAnsiCodes', () => {
  it('should strip basic color codes', () => {
    const input = '\u001b[31mred text\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('red text');
  });

  it('should strip bold codes', () => {
    const input = '\u001b[1mbold text\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('bold text');
  });

  it('should strip multiple codes', () => {
    const input = '\u001b[1m\u001b[31mred bold\u001b[0m normal';

    expect(stripAnsiCodes(input)).toBe('red bold normal');
  });

  it('should handle string without ANSI codes', () => {
    const input = 'plain text without colors';

    expect(stripAnsiCodes(input)).toBe('plain text without colors');
  });

  it('should handle empty string', () => {
    expect(stripAnsiCodes('')).toBe('');
  });

  it('should strip 256 color codes', () => {
    const input = '\u001b[38;5;196mred\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('red');
  });

  it('should strip RGB color codes', () => {
    const input = '\u001b[38;2;255;0;0mred\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('red');
  });

  it('should strip cursor movement codes', () => {
    const input = '\u001b[2Amoved up';

    expect(stripAnsiCodes(input)).toBe('moved up');
  });

  it('should strip clear line codes', () => {
    const input = '\u001b[2Kcleared line';

    expect(stripAnsiCodes(input)).toBe('cleared line');
  });

  it('should handle multiline content', () => {
    const input = '\u001b[32mline1\u001b[0m\n\u001b[33mline2\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('line1\nline2');
  });

  it('should handle ANSI code at end of string', () => {
    const input = 'text\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('text');
  });

  it('should handle ANSI code at start of string', () => {
    const input = '\u001b[31mtext';

    expect(stripAnsiCodes(input)).toBe('text');
  });

  it('should handle consecutive ANSI codes', () => {
    const input = '\u001b[1m\u001b[31m\u001b[4mtext\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('text');
  });

  it('should preserve non-ANSI escape sequences', () => {
    // Tab character should be preserved
    const input = 'column1\tcolumn2';

    expect(stripAnsiCodes(input)).toBe('column1\tcolumn2');
  });

  it('should handle typical CLI output', () => {
    const input = '  \u001b[32m✓\u001b[0m Test passed \u001b[90m(5ms)\u001b[0m';

    expect(stripAnsiCodes(input)).toBe('  ✓ Test passed (5ms)');
  });
});
