/**
 * index.js
 *
 * Utility exports for Claude Code hooks.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const security = require('./security');
const httpClient = require('./http-client');
const validation = require('./validation');

module.exports = {
  // security exports
  normalizePath: security.normalizePath,
  isPathWithinBase: security.isPathWithinBase,
  isSymlink: security.isSymlink,
  checkDangerousBashCommand: security.checkDangerousBashCommand,
  checkProtectedFile: security.checkProtectedFile,
  detectSecrets: security.detectSecrets,
  sanitizeErrorMessage: security.sanitizeErrorMessage,
  validateToolOperation: security.validateToolOperation,

  // http-client exports
  request: httpClient.request,
  postJson: httpClient.postJson,
  sendNtfyNotification: httpClient.sendNtfyNotification,
  sendSlackNotification: httpClient.sendSlackNotification,
  sendWebhook: httpClient.sendWebhook,

  // validation exports
  isNonEmptyString: validation.isNonEmptyString,
  isValidObject: validation.isValidObject,
  isValidArray: validation.isValidArray,
  isPositiveInteger: validation.isPositiveInteger,
  isValidUrl: validation.isValidUrl,
  isOneOf: validation.isOneOf,
  validateSchema: validation.validateSchema,
  sanitizeString: validation.sanitizeString,
  truncateString: validation.truncateString
};
