/**
 * Utility functions
 */

import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate UUID
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Generate hash for content
 */
export function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Sanitize parameters for logging (remove code)
 * CRITICAL FIX #8: Redact ALL code, not just >200 chars
 */
export function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...params };

  if ('code' in sanitized && typeof sanitized.code === 'string') {
    const codeLength = sanitized.code.length;
    // ALWAYS redact code for security - no size threshold
    sanitized.code = `[${codeLength} characters]`;
  }
  if ('prompt' in sanitized && typeof sanitized.prompt === 'string') {
    const promptLength = sanitized.prompt.length;
    // ALWAYS redact prompt for security - no size threshold
    sanitized.prompt = `[${promptLength} characters]`;
  }

  return sanitized;
}

/**
 * Count lines of code
 */
export function countLines(code: string): number {
  return code.split('\n').length;
}

/**
 * Detect programming language from code or filename
 */
export function detectLanguage(code: string, fileName?: string): string | undefined {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      tsx: 'typescript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      sh: 'shell',
      sql: 'sql',
    };

    if (ext && ext in languageMap) {
      return languageMap[ext];
    }
  }

  // Simple detection based on code patterns
  if (code.includes('function') || code.includes('=>')) {
    return 'javascript';
  }
  if (code.includes('def ') || code.includes('import ')) {
    return 'python';
  }

  return undefined;
}

/**
 * Create timeout promise
 */
export function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Race promise with timeout
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, createTimeoutPromise<T>(ms)]);
}

/**
 * Remove ANSI escape codes from CLI output
 */
export function stripAnsiCodes(value: string): string {
  // Fast path: no ANSI escape sequence
  if (!value.includes('\u001b[')) {
    return value;
  }

  let result = '';

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    // ESC [
    if (code === 27 && value[i + 1] === '[') {
      i += 2;

      // Consume CSI parameters until a final letter (A-Z / a-z)
      for (; i < value.length; i++) {
        const finalCode = value.charCodeAt(i);
        const isAlpha =
          (finalCode >= 65 && finalCode <= 90) || (finalCode >= 97 && finalCode <= 122);
        if (isAlpha) {
          break;
        }
      }

      continue;
    }

    result += value[i] ?? '';
  }

  return result;
}

/**
 * Check if a value is a plain object (not null, not array, not Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep merge two objects
 * DRY: Generic utility to replace repetitive manual merging
 *
 * Behavior:
 * - Primitives: override replaces base
 * - Arrays: override replaces base (no element-wise merge)
 * - Objects: recursively merged
 * - undefined/null in override: preserves base value
 *
 * @param base - Base object
 * @param override - Object with values to override
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseValue = result[key];
    const overrideValue = override[key];

    // Skip undefined/null overrides - preserve base value
    if (overrideValue === undefined || overrideValue === null) {
      continue;
    }

    // If both values are plain objects, recursively merge
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      );
    } else {
      // Otherwise, override replaces base (including arrays)
      result[key] = overrideValue;
    }
  }

  return result as T;
}
