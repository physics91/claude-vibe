#!/usr/bin/env node
/**
 * post-tool-use.js
 *
 * PostToolUse hook for pattern learning and optimization suggestions.
 * Tracks tool usage patterns and provides optimization suggestions
 * when inefficiencies are detected.
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
  formatContextOutput,
  outputAndExit,
  errorAndExit,
  createLogger,
  STATE_PATHS
} = require('./lib/core');

const logger = createLogger('post-tool-use');

/**
 * Get state directory path
 * @returns {string} State directory path
 */
function getStateDir() {
  return path.join(os.homedir(), '.claude', STATE_PATHS.PLUGIN_STATE);
}

/**
 * Get pattern history file path
 * @param {string} sessionId - Session identifier
 * @returns {string} Pattern history file path
 */
function getPatternHistoryPath(sessionId) {
  return path.join(getStateDir(), `pattern-${sessionId}.json`);
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
 * Load pattern history
 * @param {string} sessionId - Session identifier
 * @returns {Object} Pattern history object
 */
function loadPatternHistory(sessionId) {
  const historyPath = getPatternHistoryPath(sessionId);

  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.debug('Failed to load pattern history', { error: error.message });
  }

  return {
    toolHistory: [],
    suggestionHistory: [],
    lastAnalysis: null
  };
}

/**
 * Save pattern history
 * @param {string} sessionId - Session identifier
 * @param {Object} history - Pattern history object
 */
function savePatternHistory(sessionId, history) {
  const stateDir = getStateDir();
  ensureStateDir(stateDir);

  const historyPath = getPatternHistoryPath(sessionId);

  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), { mode: 0o600 });
  } catch (error) {
    logger.error('Failed to save pattern history', { error: error.message });
  }
}

/**
 * Extract target from tool input based on tool type
 * @param {string} toolName - Name of the tool
 * @param {Object} toolInput - Tool input object
 * @returns {string} Target string
 */
function getToolTarget(toolName, toolInput) {
  if (!toolInput) return '';

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return toolInput.file_path || '';
    case 'Glob':
    case 'Grep':
      return toolInput.pattern || '';
    case 'Bash':
      return toolInput.command || '';
    case 'Task':
      return toolInput.description || '';
    case 'WebFetch':
      return toolInput.url || '';
    case 'WebSearch':
      return toolInput.query || '';
    default:
      return '';
  }
}

/**
 * Determine if tool execution was successful
 * @param {*} toolResult - Tool result object
 * @returns {boolean} Success status
 */
function isToolSuccess(toolResult) {
  if (toolResult === null || toolResult === undefined) {
    return true; // Assume success if no result
  }

  if (typeof toolResult === 'object') {
    if (toolResult.error) return false;
    if (toolResult.success === false) return false;
  }

  return true;
}

/**
 * Add tool usage to history
 * @param {Object} history - Pattern history
 * @param {string} toolName - Tool name
 * @param {string} target - Tool target
 * @param {boolean} success - Success status
 */
function addToolUsage(history, toolName, target, success) {
  const usage = {
    tool: toolName,
    target: target,
    success: success,
    timestamp: Date.now()
  };

  history.toolHistory.push(usage);

  // Keep only last 100 entries
  if (history.toolHistory.length > 100) {
    history.toolHistory = history.toolHistory.slice(-100);
  }
}

/**
 * Inefficiency patterns to detect
 */
const INEFFICIENCY_PATTERNS = [
  {
    type: 'REPEATED_FILE_READ',
    description: 'Reading the same file multiple times',
    suggestion: 'Consider storing file content in memory if you need to reference it multiple times.',
    weight: 3
  },
  {
    type: 'GLOB_THEN_READ_ALL',
    description: 'Using Glob followed by reading many files',
    suggestion: 'Consider using Grep with specific patterns instead of reading all matched files.',
    weight: 2
  },
  {
    type: 'MULTIPLE_EDITS_SAME_FILE',
    description: 'Multiple small edits to the same file',
    suggestion: 'Consider using MultiEdit to batch multiple changes to the same file.',
    weight: 2
  },
  {
    type: 'BASH_FOR_FILE_OPS',
    description: 'Using Bash for file operations',
    suggestion: 'Use dedicated tools (Read, Write, Edit, Glob) instead of Bash for file operations.',
    weight: 2
  },
  {
    type: 'SEARCH_WITHOUT_FILTER',
    description: 'Broad searches without file type filters',
    suggestion: 'Add glob or type filters to Grep for faster, more focused searches.',
    weight: 1
  }
];

/**
 * Find inefficiency patterns in tool history
 * @param {Array} toolHistory - Array of tool usage records
 * @param {number} windowSize - Number of recent entries to analyze
 * @returns {Array} Detected patterns
 */
function findInefficiencyPatterns(toolHistory, windowSize = 20) {
  const recentHistory = toolHistory.slice(-windowSize);
  const detectedPatterns = [];

  // Check for repeated file reads
  const fileReads = recentHistory.filter(h => h.tool === 'Read');
  const readTargets = fileReads.map(h => h.target);
  const readCounts = {};
  readTargets.forEach(t => {
    if (t) readCounts[t] = (readCounts[t] || 0) + 1;
  });

  const repeatedReads = Object.entries(readCounts).filter(([_, count]) => count > 2);
  if (repeatedReads.length > 0) {
    detectedPatterns.push({
      ...INEFFICIENCY_PATTERNS.find(p => p.type === 'REPEATED_FILE_READ'),
      details: repeatedReads.map(([file, count]) => `${file} (${count}x)`)
    });
  }

  // Check for multiple edits to same file
  const fileEdits = recentHistory.filter(h => h.tool === 'Edit');
  const editTargets = fileEdits.map(h => h.target);
  const editCounts = {};
  editTargets.forEach(t => {
    if (t) editCounts[t] = (editCounts[t] || 0) + 1;
  });

  const repeatedEdits = Object.entries(editCounts).filter(([_, count]) => count > 2);
  if (repeatedEdits.length > 0) {
    detectedPatterns.push({
      ...INEFFICIENCY_PATTERNS.find(p => p.type === 'MULTIPLE_EDITS_SAME_FILE'),
      details: repeatedEdits.map(([file, count]) => `${file} (${count}x)`)
    });
  }

  // Check for Glob followed by many Reads
  for (let i = 0; i < recentHistory.length - 3; i++) {
    if (recentHistory[i].tool === 'Glob') {
      const nextFew = recentHistory.slice(i + 1, i + 5);
      const readCount = nextFew.filter(h => h.tool === 'Read').length;
      if (readCount >= 3) {
        detectedPatterns.push({
          ...INEFFICIENCY_PATTERNS.find(p => p.type === 'GLOB_THEN_READ_ALL'),
          details: [`Glob followed by ${readCount} Read operations`]
        });
        break; // Only report once
      }
    }
  }

  // Check for Bash used for file operations
  const bashOps = recentHistory.filter(h => h.tool === 'Bash');
  const fileOpBash = bashOps.filter(h => {
    const cmd = (h.target || '').toLowerCase();
    return /\b(cat|head|tail|sed|awk|grep|find|ls)\b/.test(cmd);
  });

  if (fileOpBash.length > 2) {
    detectedPatterns.push({
      ...INEFFICIENCY_PATTERNS.find(p => p.type === 'BASH_FOR_FILE_OPS'),
      details: fileOpBash.map(h => h.target.substring(0, 50))
    });
  }

  // Check for broad Grep without filters
  const grepOps = recentHistory.filter(h => h.tool === 'Grep');
  // This would need more context from tool input, simplified here

  return detectedPatterns;
}

/**
 * Check if suggestion is on cooldown
 * @param {Array} suggestionHistory - Previous suggestion timestamps
 * @param {string} patternType - Pattern type
 * @param {number} cooldownMs - Cooldown in milliseconds
 * @returns {boolean} True if on cooldown
 */
function isSuggestionOnCooldown(suggestionHistory, patternType, cooldownMs = 600000) {
  const lastShown = suggestionHistory.find(s => s.type === patternType);
  if (!lastShown) return false;

  return (Date.now() - lastShown.timestamp) < cooldownMs;
}

/**
 * Generate optimization suggestion message
 * @param {Array} patterns - Detected patterns
 * @returns {string} Suggestion message
 */
function generateSuggestion(patterns) {
  if (patterns.length === 0) return '';

  // Sort by weight and get top pattern
  const sortedPatterns = [...patterns].sort((a, b) => b.weight - a.weight);
  const topPattern = sortedPatterns[0];

  let suggestion = '<!-- VIBE CODING ASSISTANT: OPTIMIZATION SUGGESTION -->\n\n';
  suggestion += '> **Pattern Detected**: ' + topPattern.description + '\n\n';
  suggestion += '💡 **Suggestion**: ' + topPattern.suggestion + '\n\n';

  if (topPattern.details && topPattern.details.length > 0) {
    suggestion += '**Details**:\n';
    topPattern.details.slice(0, 3).forEach(d => {
      suggestion += `- ${d}\n`;
    });
  }

  return suggestion;
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    const toolName = input.toolName;
    const toolInput = input.toolInput;
    const toolResult = rawInput.tool_result;
    const sessionId = input.sessionId;

    // Skip if no tool name
    if (!toolName) {
      logger.debug('No tool name provided');
      outputAndExit({});
    }

    logger.debug('Processing tool usage', { tool: toolName, session: sessionId });

    // Load pattern history
    const history = loadPatternHistory(sessionId);

    // Extract target and success status
    const target = getToolTarget(toolName, toolInput);
    const success = isToolSuccess(toolResult);

    // Record tool usage
    addToolUsage(history, toolName, target, success);

    // Analyze patterns every 5 tool uses
    if (history.toolHistory.length % 5 === 0) {
      const patterns = findInefficiencyPatterns(history.toolHistory);

      if (patterns.length > 0) {
        const topPattern = patterns.sort((a, b) => b.weight - a.weight)[0];

        // Check cooldown
        if (!isSuggestionOnCooldown(history.suggestionHistory || [], topPattern.type)) {
          const suggestion = generateSuggestion(patterns);

          if (suggestion) {
            // Record that we showed this suggestion
            if (!history.suggestionHistory) {
              history.suggestionHistory = [];
            }
            history.suggestionHistory.push({
              type: topPattern.type,
              timestamp: Date.now()
            });

            // Keep only last 20 suggestion records
            if (history.suggestionHistory.length > 20) {
              history.suggestionHistory = history.suggestionHistory.slice(-20);
            }

            // Save history
            savePatternHistory(sessionId, history);

            // Output suggestion
            const output = formatContextOutput('PostToolUse', suggestion);
            outputAndExit(output);
          }
        }
      }
    }

    // Save history
    savePatternHistory(sessionId, history);

    // No suggestion needed
    outputAndExit({});

  } catch (error) {
    // On any error, fail gracefully
    errorAndExit('post-tool-use', 'An error occurred during analysis');
  }
}

// Run main
main();
