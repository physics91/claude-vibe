/**
 * logger.js
 *
 * Structured logging for Claude Code hooks.
 * Logs to stderr to avoid interfering with hook JSON output.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

// Current log level (default: INFO in production, DEBUG if DEBUG env var)
let currentLevel = process.env.CLAUDE_VIBE_DEBUG ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

// Log file path (optional file logging)
let logFilePath = null;

/**
 * Set the current log level
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'SILENT'} level
 */
function setLogLevel(level) {
  if (level in LOG_LEVELS) {
    currentLevel = LOG_LEVELS[level];
  }
}

/**
 * Enable file logging
 * @param {string} filePath - Path to log file
 */
function enableFileLogging(filePath) {
  logFilePath = filePath;
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Format log entry
 * @param {string} level - Log level name
 * @param {string} hookName - Hook identifier
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 * @returns {string} Formatted log entry
 */
function formatEntry(level, hookName, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    hook: hookName,
    message
  };

  if (data) {
    // Extract error stack traces for better debugging
    const processedData = { ...data };
    if (data.error && data.error instanceof Error) {
      processedData.error = data.error.message;
      processedData.stack = data.error.stack;
    } else if (data.stack === undefined && level === 'ERROR') {
      // Capture current stack for error logs without explicit stack
      processedData.stack = new Error().stack;
    }
    entry.data = processedData;
  }

  return JSON.stringify(entry);
}

/**
 * Write log entry
 * @param {number} level - Log level number
 * @param {string} levelName - Log level name
 * @param {string} hookName - Hook identifier
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function log(level, levelName, hookName, message, data = null) {
  if (level < currentLevel) return;

  const entry = formatEntry(levelName, hookName, message, data);

  // Write to stderr (doesn't interfere with JSON stdout)
  if (level >= LOG_LEVELS.WARN || currentLevel === LOG_LEVELS.DEBUG) {
    process.stderr.write(entry + '\n');
  }

  // Write to file if enabled
  if (logFilePath) {
    try {
      fs.appendFileSync(logFilePath, entry + '\n');
    } catch (error) {
      // Silently fail file logging
    }
  }
}

/**
 * Create a logger instance for a specific hook
 * @param {string} hookName - Name of the hook
 * @returns {Object} Logger instance with debug, info, warn, error methods
 */
function createLogger(hookName) {
  return {
    debug: (message, data) => log(LOG_LEVELS.DEBUG, 'DEBUG', hookName, message, data),
    info: (message, data) => log(LOG_LEVELS.INFO, 'INFO', hookName, message, data),
    warn: (message, data) => log(LOG_LEVELS.WARN, 'WARN', hookName, message, data),
    error: (message, data) => log(LOG_LEVELS.ERROR, 'ERROR', hookName, message, data)
  };
}

/**
 * Get default log file path
 * @returns {string} Default log file path
 */
function getDefaultLogPath() {
  return path.join(os.homedir(), '.claude', 'claude-vibe', 'hooks.log');
}

module.exports = {
  LOG_LEVELS,
  setLogLevel,
  enableFileLogging,
  createLogger,
  getDefaultLogPath
};
