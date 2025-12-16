#!/usr/bin/env node
/**
 * pre-tool-use-safety.js
 *
 * PreToolUse hook that validates tool operations for safety.
 * Blocks dangerous bash commands and protects sensitive files.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const {
  readStdinJson,
  normalizeHookInput,
  formatPermissionOutput,
  outputAndExit,
  blockAndExit,
  createLogger
} = require('./lib/core');

const {
  validateToolOperation,
  checkDangerousBashCommand,
  checkProtectedFile
} = require('./lib/utils');

const logger = createLogger('pre-tool-use-safety');

/**
 * Get fail mode from environment or config
 * CLAUDE_VIBE_FAIL_MODE=open|secure (default: secure for safety)
 * @returns {'open'|'secure'}
 */
function getFailMode() {
  const envMode = process.env.CLAUDE_VIBE_FAIL_MODE;
  if (envMode === 'open') {
    return 'open';
  }
  return 'secure'; // Default to fail-secure
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    logger.debug('Received input', { toolName: input.toolName, toolInput: input.toolInput });

    // Validate the tool operation
    const result = validateToolOperation(input.toolName, input.toolInput);

    if (!result.safe) {
      logger.warn('Blocking unsafe operation', {
        toolName: input.toolName,
        reason: result.reason,
        severity: result.severity
      });

      // Critical severity: hard block with exit code 2
      if (result.severity === 'critical') {
        blockAndExit(`BLOCKED: ${result.reason}`);
      }

      // High severity: block with JSON response
      const output = formatPermissionOutput('deny', result.reason);
      outputAndExit(output);
    }

    // Additional checks for Bash commands
    if (input.toolName === 'Bash') {
      const command = input.toolInput.command || '';

      // Check for git add patterns (warn but allow)
      if (/git\s+add\s+(-A|--all|\.(?!\w)|\*)/i.test(command)) {
        logger.info('Git add pattern detected - consider using specific files');
        // Allow but could add warning in output
      }

      // Check for commands that modify system files
      if (/sudo\s+/i.test(command)) {
        logger.warn('Sudo command detected', { command });
        const output = formatPermissionOutput('deny', 'Sudo commands are not allowed');
        outputAndExit(output);
      }
    }

    // Additional checks for file operations
    if (['Read', 'Edit', 'Write'].includes(input.toolName)) {
      const filePath = input.toolInput.file_path || '';

      // Additional protection for git hooks
      if (/\.git\/hooks\//i.test(filePath)) {
        logger.warn('Git hook modification attempt', { filePath });
        const output = formatPermissionOutput('deny', 'Git hook modification is restricted');
        outputAndExit(output);
      }

      // Protection for package manager lock files (Write only)
      if (input.toolName === 'Write') {
        if (/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(filePath)) {
          logger.warn('Lock file write attempt', { filePath });
          const output = formatPermissionOutput('deny', 'Lock file modification is restricted - use package manager');
          outputAndExit(output);
        }
      }
    }

    // Operation is safe - allow it
    logger.debug('Operation allowed', { toolName: input.toolName });
    const output = formatPermissionOutput('allow');
    outputAndExit(output);

  } catch (error) {
    // Handle error based on configured fail mode
    const failMode = getFailMode();
    logger.error('Error during validation', { error: error.message, stack: error.stack, failMode });

    if (failMode === 'secure') {
      // Fail-secure: deny operation on error (safer default)
      const output = formatPermissionOutput('deny', 'Validation error - operation blocked for safety');
      outputAndExit(output);
    } else {
      // Fail-open: allow operation (legacy behavior, opt-in)
      const output = formatPermissionOutput('allow');
      outputAndExit(output);
    }
  }
}

// Run main
main();
