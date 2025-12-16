/**
 * index.js
 *
 * Main exports for Claude Code hooks core library.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const stdinReader = require('./stdin-reader');
const outputFormatter = require('./output-formatter');
const constants = require('./constants');
const logger = require('./logger');

module.exports = {
  // stdin-reader exports
  readStdinRaw: stdinReader.readStdinRaw,
  readStdinJson: stdinReader.readStdinJson,
  readStdinValidated: stdinReader.readStdinValidated,
  normalizeHookInput: stdinReader.normalizeHookInput,

  // output-formatter exports
  formatContextOutput: outputFormatter.formatContextOutput,
  formatPermissionOutput: outputFormatter.formatPermissionOutput,
  formatStopOutput: outputFormatter.formatStopOutput,
  formatNotificationOutput: outputFormatter.formatNotificationOutput,
  formatStatusLineOutput: outputFormatter.formatStatusLineOutput,
  formatEmptyOutput: outputFormatter.formatEmptyOutput,
  outputAndExit: outputFormatter.outputAndExit,
  errorAndExit: outputFormatter.errorAndExit,
  blockAndExit: outputFormatter.blockAndExit,

  // constants exports
  FILE_LIMITS: constants.FILE_LIMITS,
  BLOCKED_DIRS: constants.BLOCKED_DIRS,
  HOOK_TIMEOUTS: constants.HOOK_TIMEOUTS,
  DANGEROUS_BASH_PATTERNS: constants.DANGEROUS_BASH_PATTERNS,
  PROTECTED_FILE_PATTERNS: constants.PROTECTED_FILE_PATTERNS,
  TOKEN_ESTIMATES: constants.TOKEN_ESTIMATES,
  AMBIGUITY_WEIGHTS: constants.AMBIGUITY_WEIGHTS,
  STATE_PATHS: constants.STATE_PATHS,

  // logger exports
  LOG_LEVELS: logger.LOG_LEVELS,
  setLogLevel: logger.setLogLevel,
  enableFileLogging: logger.enableFileLogging,
  createLogger: logger.createLogger,
  getDefaultLogPath: logger.getDefaultLogPath
};
