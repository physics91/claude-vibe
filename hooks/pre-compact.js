#!/usr/bin/env node
/**
 * pre-compact.js
 *
 * PreCompact hook that saves session state before context compaction.
 * Enables session recovery and continuity.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readStdinJson,
  normalizeHookInput,
  outputAndExit,
  errorAndExit,
  createLogger,
  STATE_PATHS
} = require('./lib/core');

const logger = createLogger('pre-compact');

/**
 * Get state directory path
 * @returns {string} State directory path
 */
function getStateDir() {
  return path.join(os.homedir(), '.claude', STATE_PATHS.PLUGIN_STATE);
}

/**
 * Ensure state directory exists
 * @param {string} stateDir - State directory path
 */
function ensureStateDir(stateDir) {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Save session state
 * @param {Object} state - Session state to save
 * @param {string} sessionId - Session identifier
 */
function saveSessionState(state, sessionId) {
  const stateDir = getStateDir();
  ensureStateDir(stateDir);

  const stateFile = path.join(stateDir, `precompact-${sessionId}.json`);

  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    logger.debug('Saved session state', { file: stateFile });
  } catch (error) {
    logger.error('Failed to save session state', { error: error.message });
  }
}

/**
 * Extract key information from transcript (placeholder)
 * @param {string} transcriptPath - Path to transcript file
 * @returns {Object} Extracted information
 */
function extractTranscriptInfo(transcriptPath) {
  // Placeholder for future transcript analysis
  // This would extract key decisions, file changes, etc.
  return {
    analyzed: false,
    keyDecisions: [],
    modifiedFiles: []
  };
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    logger.debug('Received input', {
      sessionId: input.sessionId,
      trigger: rawInput.trigger
    });

    // Build session state
    const state = {
      sessionId: input.sessionId,
      cwd: input.cwd,
      timestamp: new Date().toISOString(),
      trigger: rawInput.trigger || 'auto',
      transcriptPath: input.transcriptPath,
      permissionMode: input.permissionMode,
      customInstructions: rawInput.custom_instructions || ''
    };

    // Try to extract info from transcript
    if (input.transcriptPath) {
      state.transcriptInfo = extractTranscriptInfo(input.transcriptPath);
    }

    // Save state
    saveSessionState(state, input.sessionId);

    // Output success (no additional context needed for PreCompact)
    outputAndExit({});

  } catch (error) {
    // On any error, fail gracefully
    errorAndExit('pre-compact', 'An error occurred during execution');
  }
}

// Run main
main();
