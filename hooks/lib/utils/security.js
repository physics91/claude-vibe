/**
 * security.js
 *
 * Security utilities for Claude Code hooks.
 * Provides path validation, pattern matching, and secret detection.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { DANGEROUS_BASH_PATTERNS, PROTECTED_FILE_PATTERNS } = require('../core/constants');

/**
 * Normalize and resolve a file path safely
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized absolute path
 */
function normalizePath(filePath) {
  return path.normalize(path.resolve(filePath));
}

/**
 * Check if a path is within a base directory (prevent traversal)
 * @param {string} filePath - Path to check
 * @param {string} baseDir - Base directory
 * @returns {boolean} True if path is within base
 */
function isPathWithinBase(filePath, baseDir) {
  const normalizedPath = normalizePath(filePath);
  const normalizedBase = normalizePath(baseDir);
  return normalizedPath.startsWith(normalizedBase);
}

/**
 * Check if a path is a symlink
 * @param {string} filePath - Path to check
 * @returns {boolean} True if symlink
 */
function isSymlink(filePath) {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a bash command matches dangerous patterns
 * @param {string} command - Bash command to check
 * @returns {{dangerous: boolean, matches: Array<{description: string, severity: string}>}}
 */
function checkDangerousBashCommand(command) {
  const matches = [];
  const normalizedCommand = command.replace(/\s+/g, ' ').trim();

  for (const { pattern, description, severity } of DANGEROUS_BASH_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      matches.push({ description, severity });
    }
  }

  return {
    dangerous: matches.length > 0,
    matches
  };
}

/**
 * Check if a file path matches protected patterns
 * @param {string} filePath - File path to check
 * @returns {{protected: boolean, reason: string|null}}
 */
function checkProtectedFile(filePath) {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  for (const { pattern, exception, reason } of PROTECTED_FILE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      // Check if exception applies
      if (exception && exception.test(normalizedPath)) {
        continue;
      }
      return { protected: true, reason };
    }
  }

  return { protected: false, reason: null };
}

/**
 * Detect secrets in text content
 * @param {string} content - Content to scan
 * @returns {Array<{type: string, line: number}>} Found secrets
 */
function detectSecrets(content) {
  const secrets = [];
  const lines = content.split('\n');

  const secretPatterns = [
    { type: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/i },
    { type: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{32,}/i },
    { type: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-]{32,}/i },
    { type: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/i },
    { type: 'Private Key', pattern: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/i },
    { type: 'Generic Secret', pattern: /(password|secret|token|api_key)\s*[:=]\s*['"][^'"]{8,}['"]/i },
    { type: 'Connection String', pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i },
    { type: 'High Entropy', pattern: /[a-f0-9]{32,}/i }
  ];

  lines.forEach((line, index) => {
    for (const { type, pattern } of secretPatterns) {
      if (pattern.test(line)) {
        secrets.push({ type, line: index + 1 });
        break; // One match per line is enough
      }
    }
  });

  return secrets;
}

/**
 * Sanitize error message (remove potentially sensitive info)
 * @param {string} message - Error message
 * @returns {string} Sanitized message
 */
function sanitizeErrorMessage(message) {
  // Remove file paths that look like home directories
  let sanitized = message.replace(/\/Users\/[^\/\s]+/g, '~');
  sanitized = sanitized.replace(/\/home\/[^\/\s]+/g, '~');
  sanitized = sanitized.replace(/C:\\Users\\[^\\]+/gi, '~');

  // Remove potential tokens/keys
  sanitized = sanitized.replace(/[a-zA-Z0-9_-]{32,}/g, '[REDACTED]');

  return sanitized;
}

/**
 * Validate that a tool operation is safe
 * @param {string} toolName - Name of the tool
 * @param {Object} toolInput - Tool input parameters
 * @returns {{safe: boolean, reason: string|null, severity: string|null}}
 */
function validateToolOperation(toolName, toolInput) {
  // Check Bash commands
  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    const result = checkDangerousBashCommand(command);

    if (result.dangerous) {
      // Find the maximum severity level among all matches
      const severityLevels = { critical: 3, high: 2, medium: 1, low: 0 };
      const maxSeverity = result.matches.reduce((max, m) => {
        const current = severityLevels[m.severity] ?? 1;
        const maxVal = severityLevels[max] ?? 1;
        return current > maxVal ? m.severity : max;
      }, 'medium');

      return {
        safe: false,
        reason: result.matches.map(m => m.description).join(', '),
        severity: maxSeverity
      };
    }
  }

  // Check file operations
  if (['Read', 'Edit', 'Write'].includes(toolName)) {
    const filePath = toolInput.file_path || '';
    const result = checkProtectedFile(filePath);

    if (result.protected) {
      return {
        safe: false,
        reason: `Protected file: ${result.reason}`,
        severity: 'high'
      };
    }
  }

  return { safe: true, reason: null, severity: null };
}

module.exports = {
  normalizePath,
  isPathWithinBase,
  isSymlink,
  checkDangerousBashCommand,
  checkProtectedFile,
  detectSecrets,
  sanitizeErrorMessage,
  validateToolOperation
};
