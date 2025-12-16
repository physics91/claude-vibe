/**
 * validation.js
 *
 * Input validation utilities for Claude Code hooks.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

/**
 * Check if a value is a non-empty string
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a valid object (not null, not array)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isValidObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is a valid array
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isValidArray(value) {
  return Array.isArray(value);
}

/**
 * Check if a value is a positive integer
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Check if a value is a valid URL
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isValidUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a value matches one of the allowed values
 * @param {*} value - Value to check
 * @param {Array} allowed - Allowed values
 * @returns {boolean}
 */
function isOneOf(value, allowed) {
  return allowed.includes(value);
}

/**
 * Validate an object against a schema
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Schema definition
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSchema(obj, schema) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];

    // Required check
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    // Skip optional missing fields
    if (value === undefined || value === null) continue;

    // Type check
    if (rules.type) {
      const typeValid = checkType(value, rules.type);
      if (!typeValid) {
        errors.push(`Invalid type for ${key}: expected ${rules.type}`);
        continue;
      }
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Invalid value for ${key}: must be one of ${rules.enum.join(', ')}`);
    }

    // Min/max for numbers
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`${key} must be >= ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      errors.push(`${key} must be <= ${rules.max}`);
    }

    // MinLength/maxLength for strings
    if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`${key} must be at least ${rules.minLength} characters`);
    }
    if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${key} must be at most ${rules.maxLength} characters`);
    }

    // Pattern for strings
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push(`${key} does not match required pattern`);
    }

    // Custom validator
    if (rules.validate && typeof rules.validate === 'function') {
      const customResult = rules.validate(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `Invalid value for ${key}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a value matches a type
 * @param {*} value - Value to check
 * @param {string} type - Expected type
 * @returns {boolean}
 */
function checkType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isValidObject(value);
    case 'url':
      return isValidUrl(value);
    default:
      return true;
  }
}

/**
 * Sanitize a string for safe use (remove control characters)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Remove control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength, suffix = '...') {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  isNonEmptyString,
  isValidObject,
  isValidArray,
  isPositiveInteger,
  isValidUrl,
  isOneOf,
  validateSchema,
  checkType,
  sanitizeString,
  truncateString
};
