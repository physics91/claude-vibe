#!/usr/bin/env node
/**
 * stop-quality-gate.js
 *
 * Stop hook that validates task completion before allowing Claude to stop.
 * Checks for test failures, uncommitted changes, and pending todos.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  readStdinJson,
  normalizeHookInput,
  formatStopOutput,
  outputAndExit,
  createLogger,
  STATE_PATHS
} = require('./lib/core');

const logger = createLogger('stop-quality-gate');

/**
 * Check if tests are failing
 * @param {string} cwd - Current working directory
 * @returns {{failing: boolean, message: string|null}}
 */
function checkTestStatus(cwd) {
  const statusFile = path.join(cwd, STATE_PATHS.PLUGIN_STATE, STATE_PATHS.TEST_STATUS);

  try {
    if (fs.existsSync(statusFile)) {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
      if (status.failing === true) {
        return {
          failing: true,
          message: status.message || 'Tests are failing'
        };
      }
    }
  } catch (error) {
    logger.debug('Could not read test status', { error: error.message });
  }

  return { failing: false, message: null };
}

/**
 * Check for uncommitted git changes
 * @param {string} cwd - Current working directory
 * @returns {{hasChanges: boolean, files: string[]}}
 */
function checkUncommittedChanges(cwd) {
  try {
    // Check if in a git repository
    const gitDir = path.join(cwd, '.git');
    if (!fs.existsSync(gitDir)) {
      return { hasChanges: false, files: [] };
    }

    // Get list of changed files
    const output = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8',
      timeout: 3000
    });

    const files = output.trim().split('\n').filter(line => line.length > 0);

    return {
      hasChanges: files.length > 0,
      files: files.map(line => line.substring(3)) // Remove status prefix
    };
  } catch (error) {
    logger.debug('Could not check git status', { error: error.message });
    return { hasChanges: false, files: [] };
  }
}

/**
 * Check for pending todo items in session
 * @param {Object} input - Hook input
 * @returns {{hasPending: boolean, count: number}}
 */
function checkPendingTodos(input) {
  // Todo status would typically come from the transcript or state
  // For now, this is a placeholder for future integration
  return { hasPending: false, count: 0 };
}

/**
 * Check code quality (lint/format/typecheck)
 * @param {string} cwd - Current working directory
 * @returns {{hasIssues: boolean, issues: Object}}
 */
function checkCodeQuality(cwd) {
  const issues = {
    eslint: null,
    typescript: null,
    prettier: null
  };
  let hasIssues = false;

  // Check if package.json exists
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { hasIssues: false, issues };
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return { hasIssues: false, issues };
  }

  const scripts = packageJson.scripts || {};
  const devDeps = packageJson.devDependencies || {};
  const deps = packageJson.dependencies || {};

  // ESLint check
  if (devDeps.eslint || deps.eslint || scripts.lint) {
    try {
      const lintCmd = scripts.lint ? 'npm run lint --silent' : 'npx eslint . --quiet --max-warnings=0';
      execSync(lintCmd, { cwd, encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    } catch (error) {
      issues.eslint = 'ESLint found issues';
      hasIssues = true;
      logger.debug('ESLint check failed', { error: error.message });
    }
  }

  // TypeScript check
  if (devDeps.typescript || deps.typescript || fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { cwd, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
    } catch (error) {
      issues.typescript = 'TypeScript found type errors';
      hasIssues = true;
      logger.debug('TypeScript check failed', { error: error.message });
    }
  }

  // Prettier check (optional - don't block, just suggest)
  if (devDeps.prettier || deps.prettier) {
    try {
      const prettierCmd = scripts.format ? 'npm run format --silent -- --check' : 'npx prettier --check .';
      execSync(prettierCmd, { cwd, encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    } catch (error) {
      issues.prettier = 'Some files need formatting';
      // Don't set hasIssues for prettier - just a suggestion
      logger.debug('Prettier check failed', { error: error.message });
    }
  }

  return { hasIssues, issues };
}

/**
 * Generate suggestions based on checks
 * @param {Object} checks - Check results
 * @returns {string[]} List of suggestions
 */
function generateSuggestions(checks) {
  const suggestions = [];

  if (checks.uncommittedChanges.hasChanges) {
    const count = checks.uncommittedChanges.files.length;
    suggestions.push(`You have ${count} uncommitted file(s). Consider: git add -u && git commit -m "Your message"`);
  }

  if (checks.testStatus.failing) {
    suggestions.push('Tests are failing. Consider fixing them before ending the session.');
  }

  if (checks.pendingTodos.hasPending) {
    suggestions.push(`There are ${checks.pendingTodos.count} pending todo item(s).`);
  }

  // Code quality suggestions
  if (checks.codeQuality) {
    const { issues } = checks.codeQuality;
    if (issues.eslint) {
      suggestions.push(`${issues.eslint}. Run: npm run lint -- --fix`);
    }
    if (issues.typescript) {
      suggestions.push(`${issues.typescript}. Run: npx tsc --noEmit`);
    }
    if (issues.prettier) {
      suggestions.push(`${issues.prettier}. Run: npx prettier --write .`);
    }
  }

  return suggestions;
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    logger.debug('Received input', { sessionId: input.sessionId });

    // Check if stop hook is already active (prevent loops)
    if (rawInput.stop_hook_active === true) {
      logger.debug('Stop hook already active, allowing to prevent loop');
      outputAndExit(formatStopOutput('approve'));
    }

    const cwd = input.cwd;

    // Perform checks
    const checks = {
      testStatus: checkTestStatus(cwd),
      uncommittedChanges: checkUncommittedChanges(cwd),
      pendingTodos: checkPendingTodos(input),
      codeQuality: checkCodeQuality(cwd)
    };

    logger.debug('Check results', checks);

    // Determine if we should block
    const shouldBlock = checks.testStatus.failing || checks.codeQuality.hasIssues;

    if (shouldBlock) {
      const reasons = [];
      if (checks.testStatus.failing) {
        reasons.push(checks.testStatus.message || 'Tests are failing');
      }
      if (checks.codeQuality.hasIssues) {
        const { issues } = checks.codeQuality;
        if (issues.eslint) reasons.push(issues.eslint);
        if (issues.typescript) reasons.push(issues.typescript);
      }
      const reason = reasons.join('. ');
      logger.warn('Blocking stop due to quality issues', { reasons });
      outputAndExit(formatStopOutput('block', reason));
    }

    // Generate suggestions (info only, don't block)
    const suggestions = generateSuggestions(checks);

    if (suggestions.length > 0) {
      const reason = 'Suggestions before ending:\n- ' + suggestions.join('\n- ');
      logger.info('Providing suggestions', { suggestions });
      outputAndExit(formatStopOutput('approve', reason));
    }

    // All clear
    logger.debug('All checks passed, allowing stop');
    outputAndExit(formatStopOutput('approve'));

  } catch (error) {
    // On error, allow stop (fail-open)
    logger.error('Error during quality gate check', { error: error.message });
    outputAndExit(formatStopOutput('approve'));
  }
}

// Run main if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  checkTestStatus,
  checkUncommittedChanges,
  checkPendingTodos,
  checkCodeQuality,
  generateSuggestions
};
