/**
 * output-formatter.js
 *
 * Unified output formatting for Claude Code hooks.
 * Provides consistent JSON output structure for all hook types.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

/**
 * Format standard hook output with additional context
 * @param {string} hookEventName - Hook event name (SessionStart, PreToolUse, etc.)
 * @param {string|null} additionalContext - Optional context to add
 * @returns {Object} Formatted hook output
 */
function formatContextOutput(hookEventName, additionalContext = null) {
  const output = {
    hookSpecificOutput: {
      hookEventName
    }
  };

  if (additionalContext) {
    output.hookSpecificOutput.additionalContext = additionalContext;
  }

  return output;
}

/**
 * Format permission decision output (for PreToolUse)
 * @param {'allow'|'deny'} decision - Permission decision
 * @param {string|null} reason - Reason for the decision
 * @returns {Object} Formatted permission output
 */
function formatPermissionOutput(decision, reason = null) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision
    }
  };

  if (reason) {
    output.hookSpecificOutput.permissionDecisionReason = reason;
  }

  return output;
}

/**
 * Format Stop hook output
 * @param {'approve'|'block'} decision - Stop decision
 * @param {string|null} reason - Reason for the decision
 * @returns {Object} Formatted stop output
 */
function formatStopOutput(decision, reason = null) {
  const output = { decision };

  if (reason) {
    output.reason = reason;
  }

  return output;
}

/**
 * Format notification result output
 * @param {Array<{service: string, status: string}>} results - Notification results
 * @returns {Object} Formatted notification output
 */
function formatNotificationOutput(results) {
  return {
    hookSpecificOutput: {
      hookEventName: 'Notification',
      notificationsSent: results.map(r => ({
        ...r,
        timestamp: new Date().toISOString()
      }))
    }
  };
}

/**
 * Format status line output
 * @param {Object} status - Status information
 * @param {string} status.tokens - Token usage string (e.g., "~45K/200K")
 * @param {string} status.skill - Active skill name
 * @param {string} status.duration - Session duration
 * @param {string} status.mcpStatus - MCP server status
 * @returns {Object} Formatted status line output
 */
function formatStatusLineOutput(status) {
  return {
    hookSpecificOutput: {
      hookEventName: 'StatusLine',
      statusLine: status
    }
  };
}

/**
 * Format empty/success output
 * @returns {Object} Empty JSON object
 */
function formatEmptyOutput() {
  return {};
}

/**
 * Output JSON to stdout and exit
 * @param {Object} output - Output object to serialize
 * @param {number} exitCode - Exit code (default 0)
 */
function outputAndExit(output, exitCode = 0) {
  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

/**
 * Output error to stderr and exit gracefully
 * @param {string} hookName - Name of the hook
 * @param {string} message - Error message (generic, no sensitive info)
 */
function errorAndExit(hookName, message = 'An error occurred') {
  process.stderr.write(`${hookName}: ${message}\n`);
  console.log(JSON.stringify({}));
  process.exit(0);
}

/**
 * Block tool execution with reason
 * @param {string} reason - Reason for blocking
 */
function blockAndExit(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

module.exports = {
  formatContextOutput,
  formatPermissionOutput,
  formatStopOutput,
  formatNotificationOutput,
  formatStatusLineOutput,
  formatEmptyOutput,
  outputAndExit,
  errorAndExit,
  blockAndExit
};
