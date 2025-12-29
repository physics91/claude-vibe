/**
 * constants.js
 *
 * Configuration constants for Claude Code hooks.
 * Single source of truth for all magic numbers and defaults.
 *
 * @author physics91
 * @license MIT
 */

'use strict';
const fs = require('fs');
const path = require('path');

const PROMPT_ANALYZER_CONFIG_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'lib',
  'core',
  'prompt-analyzer.config.json'
);

function readPromptAnalyzerConfig() {
  try {
    const raw = fs.readFileSync(PROMPT_ANALYZER_CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const promptAnalyzerConfig = readPromptAnalyzerConfig();

/**
 * File size limits
 */
const FILE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024,      // 100KB per file
  MAX_TOTAL_BYTES: 500 * 1024,    // 500KB total context
  MAX_FILES: 20,                   // Maximum files to process
  MAX_STDIN_SIZE: 1024 * 1024     // 1MB stdin limit
};

/**
 * Directories to skip during file scanning
 */
const BLOCKED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv', 'venv',
  '.pytest_cache', 'dist', 'build', '.next', 'coverage',
  'target', 'vendor', '.idea', '.vscode', 'out', 'bin', 'obj',
  '.gradle', '.maven', 'Pods', 'DerivedData', '.dart_tool'
]);

/**
 * Hook timeout defaults (in ms)
 */
const HOOK_TIMEOUTS = {
  DEFAULT: 5000,
  FAST: 2000,
  SLOW: 10000,
  NOTIFICATION: 10000
};

/**
 * Dangerous bash command patterns
 */
const DANGEROUS_BASH_PATTERNS = [
  { pattern: /rm\s+.*-[a-z]*r[a-z]*f/i, description: 'rm -rf variants', severity: 'critical' },
  { pattern: /rm\s+--recursive\s+--force/i, description: 'rm --recursive --force', severity: 'critical' },
  { pattern: /rm\s+-rf?\s+[\/~*]/i, description: 'rm from root/home', severity: 'critical' },
  { pattern: /git\s+push\s+.*(-f|--force)/i, description: 'Force push', severity: 'high' },
  { pattern: /git\s+push\s+--force-with-lease\s+origin\s+(main|master)/i, description: 'Force push to main', severity: 'high' },
  { pattern: /git\s+add\s+(-A|--all|\.(?!\w)|\*)/i, description: 'Broad git add', severity: 'medium' },
  { pattern: /chmod\s+(-R\s+)?777/i, description: 'Overly permissive chmod', severity: 'medium' },
  { pattern: />\s*\/etc\//i, description: 'Write to system directories', severity: 'critical' },
  { pattern: /dd\s+if=.*of=\/dev\//i, description: 'Direct disk write', severity: 'critical' },
  { pattern: /mkfs\./i, description: 'Format filesystem', severity: 'critical' },
  { pattern: /:(){ :|:& };:/i, description: 'Fork bomb', severity: 'critical' }
];

/**
 * Protected file patterns
 */
const PROTECTED_FILE_PATTERNS = [
  { pattern: /\.env$/i, exception: /\.env\.(sample|example|template)$/i, reason: 'Environment secrets' },
  { pattern: /\.env\.[a-z]+$/i, exception: /\.env\.(sample|example|template)$/i, reason: 'Environment secrets' },
  { pattern: /credentials?\.json$/i, reason: 'Credential files' },
  { pattern: /secrets?\.ya?ml$/i, reason: 'Secret configuration' },
  { pattern: /\.pem$/i, reason: 'Private key files' },
  { pattern: /\.key$/i, reason: 'Private key files' },
  { pattern: /\.p12$/i, reason: 'Certificate bundle' },
  { pattern: /id_rsa/i, reason: 'SSH private key' },
  { pattern: /id_ed25519/i, reason: 'SSH private key' },
  { pattern: /\.aws\/credentials/i, reason: 'AWS credentials' },
  { pattern: /\.ssh\//i, reason: 'SSH directory' },
  { pattern: /service[_-]?account.*\.json$/i, reason: 'Service account key' }
];

/**
 * Token estimation heuristics
 */
const TOKEN_ESTIMATES = {
  CHARS_PER_TOKEN: 4,
  SYSTEM_PROMPT: 2000,
  AGENTS_MD: 1500,
  SESSION_CONTEXT: 500,
  TOOL_COSTS: {
    Read: { base: 100, perLine: 2 },
    Edit: { base: 150, perLine: 3 },
    Write: { base: 150, perLine: 3 },
    Bash: { base: 50, perChar: 0.25 },
    Grep: { base: 80, perMatch: 10 },
    Glob: { base: 50, perFile: 5 },
    Task: { base: 200 },
    WebFetch: { base: 300 },
    WebSearch: { base: 200 }
  }
};

/**
 * Prompt ambiguity detection weights
 */
const AMBIGUITY_WEIGHTS = promptAnalyzerConfig ? {
  TOO_SHORT: Number(promptAnalyzerConfig.scores?.TOO_SHORT) || 30,
  VAGUE_VERB: Number(promptAnalyzerConfig.scores?.VAGUE_VERB) || 15,
  EXCESSIVE_PRONOUNS: Number(promptAnalyzerConfig.scores?.EXCESSIVE_PRONOUNS) || 20,
  MISSING_DETAILS: Number(promptAnalyzerConfig.scores?.MISSING_DETAILS) || 25,
  MISSING_CODE_CONTEXT: Number(promptAnalyzerConfig.scores?.MISSING_CODE_CONTEXT) || 20,
  VAGUE_OPTIMIZATION: Number(promptAnalyzerConfig.scores?.VAGUE_OPTIMIZATION) || 15,
  INSUFFICIENT_REQUIREMENTS: Number(promptAnalyzerConfig.scores?.INSUFFICIENT_REQUIREMENTS) || 20,
  MISSING_TECH_STACK: Number(promptAnalyzerConfig.scores?.MISSING_TECH_STACK) || 15,
  NO_TECH_STACK: Number(promptAnalyzerConfig.scores?.MISSING_TECH_STACK) || 15,
  THRESHOLD: Number(promptAnalyzerConfig.threshold) || 40
} : {
  TOO_SHORT: 30,
  VAGUE_VERB: 15,
  EXCESSIVE_PRONOUNS: 20,
  MISSING_DETAILS: 25,
  MISSING_CODE_CONTEXT: 20,
  VAGUE_OPTIMIZATION: 15,
  INSUFFICIENT_REQUIREMENTS: 20,
  MISSING_TECH_STACK: 15,
  NO_TECH_STACK: 15,
  THRESHOLD: 40
};

/**
 * Plugin state directory
 */
const STATE_PATHS = {
  PLUGIN_STATE: '.claude-vibe',
  SESSION_STATE: 'session-state.json',
  PATTERNS: 'patterns.json',
  TEST_STATUS: 'test-status.json',
  NOTIFICATION_CONFIG: 'notification-config.json'
};

module.exports = {
  FILE_LIMITS,
  BLOCKED_DIRS,
  HOOK_TIMEOUTS,
  DANGEROUS_BASH_PATTERNS,
  PROTECTED_FILE_PATTERNS,
  TOKEN_ESTIMATES,
  AMBIGUITY_WEIGHTS,
  STATE_PATHS
};
