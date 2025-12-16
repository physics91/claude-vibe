#!/usr/bin/env node
/**
 * status-line.js
 *
 * StatusLine hook that displays session metrics.
 * Shows token usage, active skill, session duration, and MCP status.
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
  formatStatusLineOutput,
  outputAndExit,
  createLogger,
  STATE_PATHS,
  TOKEN_ESTIMATES
} = require('./lib/core');

const logger = createLogger('status-line');

/**
 * Get or create session state
 * @param {string} sessionId - Session identifier
 * @param {string} cwd - Current working directory
 * @returns {Object} Session state
 */
function getSessionState(sessionId, cwd) {
  const stateDir = path.join(os.homedir(), '.claude', STATE_PATHS.PLUGIN_STATE);
  const stateFile = path.join(stateDir, `statusline-${sessionId}.json`);

  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch (error) {
    logger.debug('Could not read session state', { error: error.message });
  }

  // Initialize new state
  return {
    sessionId,
    startTime: new Date().toISOString(),
    tokenEstimate: TOKEN_ESTIMATES.SYSTEM_PROMPT + TOKEN_ESTIMATES.SESSION_CONTEXT,
    toolUsage: {},
    activeSkill: null
  };
}

/**
 * Save session state
 * @param {string} sessionId - Session identifier
 * @param {Object} state - State to save
 */
function saveSessionState(sessionId, state) {
  const stateDir = path.join(os.homedir(), '.claude', STATE_PATHS.PLUGIN_STATE);
  const stateFile = path.join(stateDir, `statusline-${sessionId}.json`);

  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    logger.debug('Could not save session state', { error: error.message });
  }
}

/**
 * Estimate tokens for a tool operation
 * @param {string} toolName - Tool name
 * @param {Object} toolInput - Tool input
 * @param {*} toolResult - Tool result (if available)
 * @returns {number} Estimated token count
 */
function estimateToolTokens(toolName, toolInput, toolResult) {
  const costs = TOKEN_ESTIMATES.TOOL_COSTS[toolName] || { base: 50 };
  let tokens = costs.base;

  // Add content-based estimates
  if (toolResult && typeof toolResult === 'string') {
    tokens += Math.ceil(toolResult.length / TOKEN_ESTIMATES.CHARS_PER_TOKEN);
  }

  // Tool-specific adjustments
  if (toolName === 'Read' && toolInput.file_path) {
    // Estimate based on typical file read
    tokens += 500;
  }

  if (toolName === 'Bash' && toolInput.command) {
    tokens += Math.ceil(toolInput.command.length / TOKEN_ESTIMATES.CHARS_PER_TOKEN);
  }

  return tokens;
}

/**
 * Format token count for display
 * @param {number} tokens - Token count
 * @returns {string} Formatted string (e.g., "~45K")
 */
function formatTokenCount(tokens) {
  if (tokens >= 1000000) {
    return `~${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `~${Math.round(tokens / 1000)}K`;
  }
  return `~${tokens}`;
}

/**
 * Format duration
 * @param {string} startTime - ISO timestamp
 * @returns {string} Formatted duration
 */
function formatDuration(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  return `${minutes}m ${seconds}s`;
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
      hookEventName: input.hookEventName,
      toolName: input.toolName
    });

    // Get session state
    const state = getSessionState(input.sessionId, input.cwd);

    // Update state based on hook event
    if (input.hookEventName === 'PostToolUse' && input.toolName) {
      // Track tool usage
      state.toolUsage[input.toolName] = (state.toolUsage[input.toolName] || 0) + 1;

      // Estimate token usage
      const toolTokens = estimateToolTokens(input.toolName, input.toolInput, rawInput.tool_result);
      state.tokenEstimate += toolTokens;

      // Save updated state
      saveSessionState(input.sessionId, state);
    }

    // Calculate tool count
    const toolCount = Object.values(state.toolUsage).reduce((a, b) => a + b, 0);

    // Build status line
    const statusLine = {
      tokens: formatTokenCount(state.tokenEstimate),
      skill: state.activeSkill || 'none',
      duration: formatDuration(state.startTime),
      tools: `${toolCount} tools`
    };

    logger.debug('Generated status line', statusLine);

    // Output status line
    const output = formatStatusLineOutput(statusLine);
    outputAndExit(output);

  } catch (error) {
    // On error, output empty status
    logger.error('Error generating status line', { error: error.message });
    outputAndExit({});
  }
}

// Run main
main();
