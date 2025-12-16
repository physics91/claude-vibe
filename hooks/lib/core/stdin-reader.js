/**
 * stdin-reader.js
 *
 * Unified stdin JSON parsing for Claude Code hooks.
 * Handles stdin reading with proper error handling and validation.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const { FILE_LIMITS } = require('./constants');

/**
 * Read stdin synchronously with size limit
 * @param {number} [maxSize] - Maximum bytes to read (default: FILE_LIMITS.MAX_STDIN_SIZE)
 * @returns {string} Raw stdin content or empty string on error
 * @throws {Error} If stdin exceeds size limit
 */
function readStdinRaw(maxSize = FILE_LIMITS.MAX_STDIN_SIZE) {
  try {
    const buffer = fs.readFileSync(0);

    // Enforce size limit to prevent DoS
    if (buffer.length > maxSize) {
      throw new Error(`Stdin exceeds size limit: ${buffer.length} > ${maxSize} bytes`);
    }

    return buffer.toString('utf-8');
  } catch (error) {
    // Re-throw size limit errors
    if (error.message && error.message.includes('size limit')) {
      throw error;
    }
    return '';
  }
}

/**
 * Read and parse stdin as JSON
 * @returns {Object} Parsed JSON object or empty object on error
 */
function readStdinJson() {
  const raw = readStdinRaw();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

/**
 * Read stdin with validation against expected fields
 * @param {string[]} requiredFields - List of required field names
 * @returns {{data: Object, valid: boolean, missing: string[]}}
 */
function readStdinValidated(requiredFields = []) {
  const data = readStdinJson();
  const missing = [];

  for (const field of requiredFields) {
    if (!(field in data)) {
      missing.push(field);
    }
  }

  return {
    data,
    valid: missing.length === 0,
    missing
  };
}

/**
 * Extract common hook input fields
 * @param {Object} input - Raw hook input
 * @returns {Object} Normalized hook input with defaults
 */
function normalizeHookInput(input) {
  return {
    sessionId: input.session_id || 'unknown',
    cwd: input.cwd || process.cwd(),
    hookEventName: input.hook_event_name || '',
    transcriptPath: input.transcript_path || '',
    permissionMode: input.permission_mode || 'default',
    toolName: input.tool_name || '',
    toolInput: input.tool_input || {},
    toolResult: input.tool_result || null,
    prompt: input.prompt || '',
    message: input.message || '',
    source: input.source || ''
  };
}

module.exports = {
  readStdinRaw,
  readStdinJson,
  readStdinValidated,
  normalizeHookInput
};
