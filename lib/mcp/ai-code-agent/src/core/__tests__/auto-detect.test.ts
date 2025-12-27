/**
 * ContextAutoDetector Tests
 * Tests for automatic context detection from various sources
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import type { Logger } from '../logger.js';
import { ContextAutoDetector, createAutoDetector } from '../auto-detect.js';

// Mock fs and fs/promises
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock logger
const createMockLogger = (): Logger =>
  ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  }) as unknown as Logger;

describe('ContextAutoDetector', () => {
  let mockLogger: Logger;
  let detector: ContextAutoDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    detector = new ContextAutoDetector(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with logger', () => {
      expect(detector).toBeDefined();
    });
  });

  describe('detect', () => {
    describe('platform detection', () => {
      it('should detect platform from runtime', async () => {
        const result = await detector.detect({});

        expect(result.context.platform).toBeDefined();
        expect(result.confidence.platform).toBe(1.0);
        expect(result.sources).toContain('runtime');
      });

      it('should detect windows platform', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const result = await detector.detect({});

        expect(result.context.platform).toBe('windows');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should detect unix platform for darwin', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin' });

        const result = await detector.detect({});

        expect(result.context.platform).toBe('unix');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should detect unix platform for linux', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });

        const result = await detector.detect({});

        expect(result.context.platform).toBe('unix');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should detect unix platform for freebsd', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'freebsd' });

        const result = await detector.detect({});

        expect(result.context.platform).toBe('unix');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should detect cross-platform for unknown', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'unknown' });

        const result = await detector.detect({});

        expect(result.context.platform).toBe('cross-platform');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });
    });

    describe('language detection from extension', () => {
      it('should detect TypeScript from .ts extension', async () => {
        const result = await detector.detect({ fileName: 'test.ts' });

        expect(result.context.language).toBe('typescript');
        expect(result.confidence.language).toBe(0.9);
        expect(result.sources).toContain('file-extension');
      });

      it('should detect TypeScript from .tsx extension', async () => {
        const result = await detector.detect({ fileName: 'component.tsx' });

        expect(result.context.language).toBe('typescript');
      });

      it('should detect JavaScript from .js extension', async () => {
        const result = await detector.detect({ fileName: 'script.js' });

        expect(result.context.language).toBe('javascript');
      });

      it('should detect JavaScript from .jsx extension', async () => {
        const result = await detector.detect({ fileName: 'component.jsx' });

        expect(result.context.language).toBe('javascript');
      });

      it('should detect JavaScript from .mjs extension', async () => {
        const result = await detector.detect({ fileName: 'module.mjs' });

        expect(result.context.language).toBe('javascript');
      });

      it('should detect Python from .py extension', async () => {
        const result = await detector.detect({ fileName: 'script.py' });

        expect(result.context.language).toBe('python');
      });

      it('should detect Go from .go extension', async () => {
        const result = await detector.detect({ fileName: 'main.go' });

        expect(result.context.language).toBe('go');
      });

      it('should detect Rust from .rs extension', async () => {
        const result = await detector.detect({ fileName: 'lib.rs' });

        expect(result.context.language).toBe('rust');
      });

      it('should detect Java from .java extension', async () => {
        const result = await detector.detect({ fileName: 'Main.java' });

        expect(result.context.language).toBe('java');
      });

      it('should detect Kotlin from .kt extension', async () => {
        const result = await detector.detect({ fileName: 'App.kt' });

        expect(result.context.language).toBe('kotlin');
      });

      it('should detect C# from .cs extension', async () => {
        const result = await detector.detect({ fileName: 'Program.cs' });

        expect(result.context.language).toBe('csharp');
      });

      it('should detect Ruby from .rb extension', async () => {
        const result = await detector.detect({ fileName: 'app.rb' });

        expect(result.context.language).toBe('ruby');
      });

      it('should detect PHP from .php extension', async () => {
        const result = await detector.detect({ fileName: 'index.php' });

        expect(result.context.language).toBe('php');
      });

      it('should detect C from .c extension', async () => {
        const result = await detector.detect({ fileName: 'main.c' });

        expect(result.context.language).toBe('c');
      });

      it('should detect C++ from .cpp extension', async () => {
        const result = await detector.detect({ fileName: 'main.cpp' });

        expect(result.context.language).toBe('cpp');
      });

      it('should detect Shell from .sh extension', async () => {
        const result = await detector.detect({ fileName: 'script.sh' });

        expect(result.context.language).toBe('shell');
      });

      it('should detect PowerShell from .ps1 extension', async () => {
        const result = await detector.detect({ fileName: 'script.ps1' });

        expect(result.context.language).toBe('powershell');
      });

      it('should detect SQL from .sql extension', async () => {
        const result = await detector.detect({ fileName: 'query.sql' });

        expect(result.context.language).toBe('sql');
      });

      it('should detect Vue from .vue extension', async () => {
        const result = await detector.detect({ fileName: 'App.vue' });

        expect(result.context.language).toBe('vue');
      });

      it('should detect Svelte from .svelte extension', async () => {
        const result = await detector.detect({ fileName: 'App.svelte' });

        expect(result.context.language).toBe('svelte');
      });

      it('should handle unknown extension', async () => {
        const result = await detector.detect({ fileName: 'file.xyz' });

        expect(result.context.language).toBeUndefined();
        expect(result.sources).not.toContain('file-extension');
      });

      it('should handle uppercase extension', async () => {
        const result = await detector.detect({ fileName: 'test.TS' });

        expect(result.context.language).toBe('typescript');
      });
    });

    describe('package.json detection', () => {
      it('should detect framework from package.json', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue(
          JSON.stringify({
            dependencies: {
              react: '^18.0.0',
            },
          })
        );

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(result.context.framework).toBe('react');
        expect(result.confidence.framework).toBe(0.9);
        expect(result.sources).toContain('package.json');
      });

      it('should detect TypeScript from devDependencies', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue(
          JSON.stringify({
            devDependencies: {
              typescript: '^5.0.0',
            },
          })
        );

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(result.context.language).toBe('typescript');
        expect(result.confidence.language).toBe(0.95);
      });

      it('should use cached result for same mtime', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue(
          JSON.stringify({
            dependencies: {
              vue: '^3.0.0',
            },
          })
        );

        // First call
        await detector.detect({ workingDirectory: '/project' });
        expect(readFile).toHaveBeenCalledTimes(1);

        // Second call with same mtime should use cache
        await detector.detect({ workingDirectory: '/project' });
        expect(readFile).toHaveBeenCalledTimes(1);
      });

      it('should refresh cache when mtime changes', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValueOnce(
          JSON.stringify({ dependencies: { react: '^18.0.0' } })
        );

        await detector.detect({ workingDirectory: '/project' });

        vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 2000 } as any);
        vi.mocked(readFile).mockResolvedValueOnce(
          JSON.stringify({ dependencies: { vue: '^3.0.0' } })
        );

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(readFile).toHaveBeenCalledTimes(2);
        expect(result.context.framework).toBe('vue');
      });

      it('should return null when package.json does not exist', async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(result.sources).not.toContain('package.json');
      });

      it('should handle invalid package.json', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue('invalid json');

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it('should handle package.json with non-object parsed content', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue('"just a string"');

        const result = await detector.detect({ workingDirectory: '/project' });

        // Should not throw, but should not add package.json to sources since parsing failed
        expect(result.sources).not.toContain('package.json');
      });

      it('should detect various frameworks', async () => {
        const frameworks = [
          { dep: 'express', expected: 'express' },
          { dep: 'fastify', expected: 'fastify' },
          { dep: '@nestjs/core', expected: 'nestjs' },
          { dep: 'next', expected: 'nextjs' },
          { dep: '@angular/core', expected: 'angular' },
          { dep: 'electron', expected: 'electron' },
          { dep: 'react-native', expected: 'react-native' },
        ];

        for (const { dep, expected } of frameworks) {
          vi.clearAllMocks();
          const newDetector = new ContextAutoDetector(mockLogger);

          vi.mocked(existsSync).mockReturnValue(true);
          vi.mocked(stat).mockResolvedValue({ mtimeMs: Date.now() } as any);
          vi.mocked(readFile).mockResolvedValue(
            JSON.stringify({ dependencies: { [dep]: '^1.0.0' } })
          );

          const result = await newDetector.detect({
            workingDirectory: `/project-${dep}`,
          });

          expect(result.context.framework).toBe(expected);
        }
      });

      it('should handle read error and cache failure', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it('should handle stat failure when caching read error', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat)
          .mockResolvedValueOnce({ mtimeMs: 1000 } as any)
          .mockRejectedValueOnce(new Error('Stat error'));
        vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

        const result = await detector.detect({ workingDirectory: '/project' });

        // Should not throw
        expect(result.sources).not.toContain('package.json');
      });
    });

    describe('scope detection from code', () => {
      it('should detect full scope with exports', async () => {
        const code = `
          export function main() {
            console.log('hello');
          }
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
        expect(result.confidence.scope).toBe(0.7);
        expect(result.sources).toContain('code-analysis');
      });

      it('should detect full scope with module.exports', async () => {
        const code = `
          function helper() {}
          module.exports = { helper };
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
      });

      it('should detect full scope with main function', async () => {
        const code = `
          function main() {
            console.log('main');
          }
          main();
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
      });

      it('should detect full scope with class definition', async () => {
        const code = `
          class MyClass {
            constructor() {}
            method() {}
          }
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
      });

      it('should detect full scope with interface definition', async () => {
        const code = `
          interface User {
            name: string;
            age: number;
          }
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
      });

      it('should detect full scope with export class', async () => {
        const code = `
          export class Service {
            run() {}
          }
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('full');
      });

      it('should detect partial scope with imports and more than 10 lines', async () => {
        const code = `
          import { something } from 'module';
          line2
          line3
          line4
          line5
          line6
          line7
          line8
          line9
          line10
          line11
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('partial');
      });

      it('should detect partial scope with require and more than 10 lines', async () => {
        const code = `
          const module = require('module');
          line2
          line3
          line4
          line5
          line6
          line7
          line8
          line9
          line10
          line11
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('partial');
      });

      it('should detect snippet scope for short code', async () => {
        const code = `
          const x = 1;
          const y = 2;
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('snippet');
      });

      it('should default to partial for ambiguous long code', async () => {
        const code = `
          // Comment
          line1
          line2
          line3
          line4
          line5
          line6
          line7
          line8
          line9
          line10
          line11
        `;

        const result = await detector.detect({ code });

        expect(result.context.scope).toBe('partial');
      });
    });

    describe('error handling', () => {
      it('should handle detection errors gracefully', async () => {
        // Force an error during detection
        vi.mocked(existsSync).mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const result = await detector.detect({ workingDirectory: '/project' });

        expect(mockLogger.warn).toHaveBeenCalled();
        expect(result.context).toBeDefined();
      });
    });

    describe('combined detection', () => {
      it('should combine multiple detection sources', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue(
          JSON.stringify({
            devDependencies: {
              typescript: '^5.0.0',
              react: '^18.0.0',
            },
          })
        );

        const code = `
          export function App() {
            return <div>Hello</div>;
          }
        `;

        const result = await detector.detect({
          fileName: 'App.tsx',
          workingDirectory: '/project',
          code,
        });

        expect(result.context.language).toBe('typescript');
        expect(result.context.framework).toBe('react');
        expect(result.context.scope).toBe('full');
        expect(result.sources).toContain('file-extension');
        expect(result.sources).toContain('package.json');
        expect(result.sources).toContain('code-analysis');
      });

      it('should prefer higher confidence language from package.json', async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);
        vi.mocked(readFile).mockResolvedValue(
          JSON.stringify({
            devDependencies: {
              typescript: '^5.0.0',
            },
          })
        );

        // File extension gives 0.9 confidence, TypeScript from package.json gives 0.95
        const result = await detector.detect({
          fileName: 'script.js', // Would detect as javascript
          workingDirectory: '/project',
        });

        expect(result.context.language).toBe('typescript');
        expect(result.confidence.language).toBe(0.95);
      });
    });
  });

  describe('detectLanguageFromCode', () => {
    it('should detect TypeScript from type annotations', () => {
      const code = 'function greet(name: string): void {}';

      expect(detector.detectLanguageFromCode(code)).toBe('typescript');
    });

    it('should detect TypeScript from interface', () => {
      const code = 'interface User { name: string }';

      expect(detector.detectLanguageFromCode(code)).toBe('typescript');
    });

    it('should detect TypeScript from generics with type annotations', () => {
      const code = 'const arr: Array<number> = [];';

      expect(detector.detectLanguageFromCode(code)).toBe('typescript');
    });

    it('should detect Python from def keyword', () => {
      const code = 'def hello():';

      expect(detector.detectLanguageFromCode(code)).toBe('python');
    });

    it('should detect Python from class with colon', () => {
      const code = 'class MyClass:';

      expect(detector.detectLanguageFromCode(code)).toBe('python');
    });

    it('should detect Python from import statement', () => {
      const code = 'import os';

      expect(detector.detectLanguageFromCode(code)).toBe('python');
    });

    it('should detect Python from from import statement', () => {
      const code = 'from typing import List';

      expect(detector.detectLanguageFromCode(code)).toBe('python');
    });

    it('should detect Go from package keyword', () => {
      const code = 'package main';

      expect(detector.detectLanguageFromCode(code)).toBe('go');
    });

    it('should detect Go from func keyword', () => {
      const code = 'func main() {}';

      expect(detector.detectLanguageFromCode(code)).toBe('go');
    });

    it('should detect Rust from fn keyword', () => {
      const code = 'fn main() {}';

      expect(detector.detectLanguageFromCode(code)).toBe('rust');
    });

    it('should detect Rust from use statement', () => {
      const code = 'use std::io;';

      expect(detector.detectLanguageFromCode(code)).toBe('rust');
    });

    it('should detect Java from public class', () => {
      const code = 'public class Main {}';

      expect(detector.detectLanguageFromCode(code)).toBe('java');
    });

    it('should detect Java from public enum', () => {
      const code = 'public enum Color { RED, GREEN, BLUE }';

      expect(detector.detectLanguageFromCode(code)).toBe('java');
    });

    it('should detect JavaScript from import', () => {
      const code = 'import { useState } from "react";';

      expect(detector.detectLanguageFromCode(code)).toBe('javascript');
    });

    it('should detect JavaScript from export', () => {
      const code = 'export const value = 1;';

      expect(detector.detectLanguageFromCode(code)).toBe('javascript');
    });

    it('should return null for unrecognized code', () => {
      const code = 'some random text';

      expect(detector.detectLanguageFromCode(code)).toBeNull();
    });
  });
});

describe('createAutoDetector', () => {
  it('should create ContextAutoDetector instance', () => {
    const logger = createMockLogger();
    const detector = createAutoDetector(logger);

    expect(detector).toBeInstanceOf(ContextAutoDetector);
  });
});
