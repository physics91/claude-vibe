/**
 * CLI Path Detection Utility
 * Automatically detects CLI paths based on platform and environment
 *
 * Priority Order:
 * 1. Environment variables (CODEX_CLI_PATH / GEMINI_CLI_PATH)
 * 2. config.json cliPath (if not 'auto')
 * 3. Platform-specific default paths (file system check)
 * 4. PATH search using 'which' (Unix) or 'where' (Windows)
 * 5. Fallback to command name (assumes in PATH)
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { resolve, join } from 'path';

import { execa } from 'execa';

import { type Logger } from './logger.js';

export type CLIDetectionSource = 'env' | 'config' | 'detected' | 'which' | 'default';

export interface CLIDetectionResult {
  path: string;
  source: CLIDetectionSource;
  exists?: boolean;
  resolvedPath?: string;
}

/**
 * Get platform-specific default CLI paths
 */
function getDefaultCLIPaths(cliName: 'codex' | 'gemini'): string[] {
  const platform = process.platform;
  const paths: string[] = [];

  if (platform === 'win32') {
    // Windows paths
    const appData = process.env.APPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env['ProgramFiles(x86)'];

    // NPM global directory
    if (appData) {
      paths.push(join(appData, 'npm', `${cliName}.cmd`));
    }

    // Program Files installations
    if (programFiles) {
      paths.push(join(programFiles, cliName, `${cliName}.exe`));

      // Special case for Gemini
      if (cliName === 'gemini') {
        paths.push(join(programFiles, 'Google', 'Gemini', 'gemini.exe'));
      }
    }

    if (programFilesX86) {
      paths.push(join(programFilesX86, cliName, `${cliName}.exe`));
    }

    // Fallback Program Files paths
    paths.push(`C:\\Program Files\\${cliName}\\${cliName}.exe`);

    if (cliName === 'gemini') {
      paths.push('C:\\Program Files\\Google\\Gemini\\gemini.exe');
    }
  } else {
    // macOS / Linux paths
    paths.push(`/usr/local/bin/${cliName}`);
    paths.push(`/usr/bin/${cliName}`);
    paths.push(`/opt/${cliName}/bin/${cliName}`);
    paths.push(resolve(homedir(), `.local/bin/${cliName}`));

    // Homebrew paths (macOS)
    if (platform === 'darwin') {
      paths.push(`/opt/homebrew/bin/${cliName}`); // Apple Silicon
      paths.push(`/usr/local/opt/${cliName}/bin/${cliName}`); // Intel
    }
  }

  return paths;
}

/**
 * Check if a path exists and is executable
 */
function checkPathExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Find CLI in system PATH using 'which' (Unix) or 'where' (Windows)
 */
async function findInPath(command: string): Promise<string | null> {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = await execa(cmd, [command], {
      shell: false,
      timeout: 5000,
      reject: false, // Don't throw on non-zero exit
    });

    if (result.exitCode === 0 && result.stdout) {
      // Return first line (primary match)
      const lines = result.stdout.split('\n');
      return lines[0]?.trim() ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that a config path is safe to use
 * Only allows well-known patterns and absolute paths
 */
function isConfigPathSafe(cliPath: string, cliName: string): boolean {
  // Allow simple command names
  if (cliPath === cliName || cliPath === `${cliName}.cmd`) {
    return true;
  }

  // Allow absolute paths in safe directories
  const safePrefixes = [
    '/usr/local/bin/',
    '/usr/bin/',
    '/opt/',
    '/home/',
    'C:\\Program Files\\',
    'C:\\Program Files (x86)\\',
  ];

  // Check if path starts with any safe prefix
  return safePrefixes.some(prefix => cliPath.startsWith(prefix));
}

/**
 * Detect Codex CLI path
 *
 * @param configPath - Path from configuration (or 'auto' for auto-detection)
 * @param logger - Optional logger for debugging
 * @returns Detection result with path and source
 */
export async function detectCodexCLIPath(
  configPath?: string,
  logger?: Logger
): Promise<CLIDetectionResult> {
  const cliName = 'codex';

  // 1. Check environment variable first
  const envPath = process.env.CODEX_CLI_PATH;
  if (envPath) {
    logger?.debug({ path: envPath, source: 'env' }, 'Codex CLI path from environment');
    return {
      path: envPath,
      source: 'env',
      exists: checkPathExists(envPath),
    };
  }

  // 2. Use config path if provided and not 'auto'
  if (configPath && configPath !== 'auto') {
    // Validate config path for security
    if (isConfigPathSafe(configPath, cliName)) {
      logger?.debug({ path: configPath, source: 'config' }, 'Codex CLI path from config');
      return {
        path: configPath,
        source: 'config',
        exists: checkPathExists(configPath),
      };
    } else {
      logger?.warn(
        { path: configPath },
        'Config CLI path rejected for security reasons, falling back to auto-detection'
      );
    }
  }

  // 3. Try platform-specific default paths
  const defaultPaths = getDefaultCLIPaths(cliName);
  for (const path of defaultPaths) {
    if (checkPathExists(path)) {
      logger?.info(
        { path, source: 'detected', platform: process.platform },
        'Codex CLI path detected'
      );
      return {
        path,
        source: 'detected',
        exists: true,
      };
    }
  }

  // 4. Try to find in system PATH
  const pathResult = await findInPath(cliName);
  if (pathResult) {
    logger?.info({ path: pathResult, source: 'which' }, 'Codex CLI found in PATH');
    return {
      path: pathResult,
      source: 'which',
      exists: true,
      resolvedPath: pathResult,
    };
  }

  // 5. Fallback to command name (assumes in PATH)
  const fallback = process.platform === 'win32' ? 'codex.cmd' : 'codex';
  logger?.warn(
    { path: fallback, source: 'default' },
    'Codex CLI not found, using default command (will fail if not in PATH)'
  );

  return {
    path: fallback,
    source: 'default',
    exists: false,
  };
}

/**
 * Detect Gemini CLI path
 *
 * @param configPath - Path from configuration (or 'auto' for auto-detection)
 * @param logger - Optional logger for debugging
 * @returns Detection result with path and source
 */
export async function detectGeminiCLIPath(
  configPath?: string,
  logger?: Logger
): Promise<CLIDetectionResult> {
  const cliName = 'gemini';

  // 1. Check environment variable first
  const envPath = process.env.GEMINI_CLI_PATH;
  if (envPath) {
    logger?.debug({ path: envPath, source: 'env' }, 'Gemini CLI path from environment');
    return {
      path: envPath,
      source: 'env',
      exists: checkPathExists(envPath),
    };
  }

  // 2. Use config path if provided and not 'auto'
  if (configPath && configPath !== 'auto') {
    // Validate config path for security
    if (isConfigPathSafe(configPath, cliName)) {
      logger?.debug({ path: configPath, source: 'config' }, 'Gemini CLI path from config');
      return {
        path: configPath,
        source: 'config',
        exists: checkPathExists(configPath),
      };
    } else {
      logger?.warn(
        { path: configPath },
        'Config CLI path rejected for security reasons, falling back to auto-detection'
      );
    }
  }

  // 3. Try platform-specific default paths
  const defaultPaths = getDefaultCLIPaths(cliName);
  for (const path of defaultPaths) {
    if (checkPathExists(path)) {
      logger?.info(
        { path, source: 'detected', platform: process.platform },
        'Gemini CLI path detected'
      );
      return {
        path,
        source: 'detected',
        exists: true,
      };
    }
  }

  // 4. Try to find in system PATH
  const pathResult = await findInPath(cliName);
  if (pathResult) {
    logger?.info({ path: pathResult, source: 'which' }, 'Gemini CLI found in PATH');
    return {
      path: pathResult,
      source: 'which',
      exists: true,
      resolvedPath: pathResult,
    };
  }

  // 5. Fallback to command name (assumes in PATH)
  const fallback = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';
  logger?.warn(
    { path: fallback, source: 'default' },
    'Gemini CLI not found, using default command (will fail if not in PATH)'
  );

  return {
    path: fallback,
    source: 'default',
    exists: false,
  };
}

/**
 * Detect CLI path for a given CLI name
 * Generic wrapper for detectCodexCLIPath and detectGeminiCLIPath
 */
export async function detectCLIPath(
  cliName: 'codex' | 'gemini',
  configPath?: string,
  logger?: Logger
): Promise<CLIDetectionResult> {
  if (cliName === 'codex') {
    return detectCodexCLIPath(configPath, logger);
  } else {
    return detectGeminiCLIPath(configPath, logger);
  }
}
