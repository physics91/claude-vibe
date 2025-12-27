/**
 * Context Auto-Detector
 * Automatically detects language, framework, platform from various sources
 */

import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { extname, join } from 'path';

import type { AnalysisContext, Scope } from '../schemas/context.js';

import type { Logger } from './logger.js';

export interface DetectionResult {
  context: Partial<AnalysisContext>;
  confidence: Record<string, number>;
  sources: string[];
}

export interface DetectionOptions {
  code?: string;
  fileName?: string;
  workingDirectory?: string;
}

// Language detection from file extension
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.scala': 'scala',
  '.r': 'r',
  '.R': 'r',
  '.lua': 'lua',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

// Framework detection from package.json dependencies
const FRAMEWORK_DETECTION_MAP: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  vue: 'vue',
  '@vue/core': 'vue',
  angular: 'angular',
  '@angular/core': 'angular',
  svelte: 'svelte',
  next: 'nextjs',
  nuxt: 'nuxt',
  gatsby: 'gatsby',
  express: 'express',
  fastify: 'fastify',
  koa: 'koa',
  hapi: 'hapi',
  nestjs: 'nestjs',
  '@nestjs/core': 'nestjs',
  electron: 'electron',
  'react-native': 'react-native',
  expo: 'expo',
  django: 'django',
  flask: 'flask',
  fastapi: 'fastapi',
  spring: 'spring',
  'spring-boot': 'spring-boot',
};

/**
 * Context Auto-Detector class
 */
export class ContextAutoDetector {
  private packageJsonCache = new Map<
    string,
    { mtimeMs: number; result: { context: Partial<AnalysisContext>; confidence: Record<string, number> } | null }
  >();

  constructor(private logger: Logger) {}

  /**
   * Detect context from various sources
   */
  async detect(options: DetectionOptions): Promise<DetectionResult> {
    const result: DetectionResult = {
      context: {},
      confidence: {},
      sources: [],
    };

    try {
      // 1. Detect platform from runtime (highest confidence)
      result.context.platform = this.detectPlatform();
      result.confidence.platform = 1.0;
      result.sources.push('runtime');

      // 2. Detect language from file extension
      if (options.fileName) {
        const langFromExt = this.detectLanguageFromExtension(options.fileName);
        if (langFromExt) {
          result.context.language = langFromExt;
          result.confidence.language = 0.9;
          result.sources.push('file-extension');
        }
      }

      // 3. Detect from package.json (if available)
      if (options.workingDirectory) {
        const pkgInfo = await this.detectFromPackageJson(options.workingDirectory);
        if (pkgInfo) {
          // Only override if not already set or higher confidence
          const pkgLangConfidence = pkgInfo.confidence.language ?? 0;
          if (!result.context.language || pkgLangConfidence > (result.confidence.language ?? 0)) {
            if (pkgInfo.context.language) {
              result.context.language = pkgInfo.context.language;
              result.confidence.language = pkgLangConfidence;
            }
          }
          if (pkgInfo.context.framework) {
            result.context.framework = pkgInfo.context.framework;
            result.confidence.framework = pkgInfo.confidence.framework ?? 0;
          }
          result.sources.push('package.json');
        }
      }

      // 4. Detect code scope from code structure
      if (options.code) {
        const scope = this.detectScope(options.code);
        result.context.scope = scope;
        result.confidence.scope = 0.7;
        result.sources.push('code-analysis');
      }

      this.logger.debug({ result }, 'Auto-detected context');
    } catch (error) {
      this.logger.warn({ error }, 'Error during context auto-detection');
    }

    return result;
  }

  /**
   * Detect platform from Node.js runtime
   */
  private detectPlatform(): string {
    switch (process.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
      case 'linux':
      case 'freebsd':
      case 'openbsd':
        return 'unix';
      default:
        return 'cross-platform';
    }
  }

  /**
   * Detect language from file extension
   */
  private detectLanguageFromExtension(fileName: string): string | null {
    const ext = extname(fileName).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] ?? null;
  }

  /**
   * Detect language and framework from package.json
   */
  private async detectFromPackageJson(
    dir: string
  ): Promise<{ context: Partial<AnalysisContext>; confidence: Record<string, number> } | null> {
    const pkgPath = join(dir, 'package.json');

    if (!existsSync(pkgPath)) {
      return null;
    }

    try {
      const stats = await stat(pkgPath);
      const cached = this.packageJsonCache.get(pkgPath);
      if (cached && cached.mtimeMs === stats.mtimeMs) {
        return cached.result;
      }

      const content = await readFile(pkgPath, 'utf-8');
      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result: null });
        return null;
      }

      const pkg = parsed as Record<string, unknown>;
      const context: Partial<AnalysisContext> = {};
      const confidence: Record<string, number> = {};

      // Default to JavaScript for Node.js projects
      context.language = 'javascript';
      confidence.language = 0.8;

      // Check for TypeScript
      const dependencies =
        typeof pkg.dependencies === 'object' && pkg.dependencies !== null
          ? (pkg.dependencies as Record<string, unknown>)
          : {};
      const devDependencies =
        typeof pkg.devDependencies === 'object' && pkg.devDependencies !== null
          ? (pkg.devDependencies as Record<string, unknown>)
          : {};

      const allDeps: Record<string, unknown> = {
        ...dependencies,
        ...devDependencies,
      };

      if (typeof allDeps.typescript === 'string') {
        context.language = 'typescript';
        confidence.language = 0.95;
      }

      // Detect framework
      for (const [dep, framework] of Object.entries(FRAMEWORK_DETECTION_MAP)) {
        if (typeof allDeps[dep] === 'string') {
          context.framework = framework;
          confidence.framework = 0.9;
          break; // Use first match
        }
      }

      const result = { context, confidence };
      this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result });
      return result;
    } catch (error) {
      this.logger.debug({ error, pkgPath }, 'Failed to read package.json');
      // Cache failure to avoid repeated reads until file changes
      try {
        const stats = await stat(pkgPath);
        this.packageJsonCache.set(pkgPath, { mtimeMs: stats.mtimeMs, result: null });
      } catch {
        // ignore
      }
      return null;
    }
  }

  /**
   * Detect code scope (completeness) from code structure
   */
  private detectScope(code: string): Scope {
    const trimmedCode = code.trim();
    const lineCount = trimmedCode.split('\n').length;

    // Check for indicators of complete file
    const hasImports = /^import\s/m.test(trimmedCode);
    const hasRequire = /^(const|let|var)\s+.*=\s*require\(/m.test(trimmedCode);
    const hasExports = /^export\s/m.test(trimmedCode);
    const hasModuleExports = /module\.exports\s*=/m.test(trimmedCode);
    const hasMainFunction =
      /^(async\s+)?function\s+main|^const\s+main\s*=|^async\s+function\s*\(/m.test(trimmedCode);
    const hasClassDefinition = /^(export\s+)?(class|interface|type|enum)\s+\w+/m.test(trimmedCode);

    // Full file indicators
    if (hasExports || hasModuleExports || hasMainFunction || hasClassDefinition) {
      return 'full';
    }

    // Partial code indicators (has imports but incomplete)
    if ((hasImports || hasRequire) && lineCount > 10) {
      return 'partial';
    }

    // Short code snippets
    if (lineCount < 10) {
      return 'snippet';
    }

    // Default to partial for ambiguous cases
    return 'partial';
  }

  /**
   * Detect language from code content (heuristic)
   */
  detectLanguageFromCode(code: string): string | null {
    // TypeScript indicators
    if (/:\s*(string|number|boolean|any|void|never)\b/.test(code)) {
      return 'typescript';
    }
    if (/interface\s+\w+\s*\{/.test(code)) {
      return 'typescript';
    }
    if (/<\w+>/.test(code) && /:\s*\w+/.test(code)) {
      return 'typescript';
    }

    // Python indicators
    if (/^def\s+\w+\s*\(/.test(code) || /^class\s+\w+.*:/.test(code)) {
      return 'python';
    }
    if (/^\s*import\s+\w+$/.test(code) || /^from\s+\w+\s+import/.test(code)) {
      return 'python';
    }

    // Go indicators
    if (/^package\s+\w+/.test(code) || /^func\s+\w+\s*\(/.test(code)) {
      return 'go';
    }

    // Rust indicators
    if (/^fn\s+\w+\s*\(/.test(code) || /^use\s+\w+::/.test(code)) {
      return 'rust';
    }

    // Java indicators
    if (/^public\s+(class|interface|enum)\s+\w+/.test(code)) {
      return 'java';
    }

    // JavaScript (default for import/export without types)
    if (/^import\s+/.test(code) || /^export\s+/.test(code)) {
      return 'javascript';
    }

    return null;
  }
}

/**
 * Create a ContextAutoDetector with a logger
 */
export function createAutoDetector(logger: Logger): ContextAutoDetector {
  return new ContextAutoDetector(logger);
}
