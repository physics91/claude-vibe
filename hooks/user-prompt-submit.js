#!/usr/bin/env node
/**
 * user-prompt-submit.js
 *
 * UserPromptSubmit hook that analyzes user prompts for ambiguity
 * and activates the prompt-clarifier skill when needed.
 *
 * @author physics91
 * @license MIT
 */
'use strict';
const path = require('path');
const {
  readStdinJson,
  normalizeHookInput,
  formatContextOutput,
  outputAndExit,
  errorAndExit,
  createLogger
} = require('./lib/core');

const { analyzePrompt, loadPromptAnalyzerConfig } = require(
  path.join(__dirname, '..', 'lib', 'core', 'prompt-analyzer.js')
);

const logger = createLogger('user-prompt-submit');
const promptConfig = loadPromptAnalyzerConfig();

/**
 * Generate clarification context
 * @param {Object} analysis - Analysis result
 * @returns {string} Clarification context
 */
function generateClarificationContext(analysis) {
  const threshold = promptConfig?.threshold ?? 40;
  let context = '<!-- VIBE CODING ASSISTANT: PROMPT CLARIFICATION NEEDED -->\n\n';
  context += '**[Activate Skill: prompt-clarifier]**\n\n';
  context += '> The user\'s prompt appears to be ambiguous. Please help clarify before proceeding.\n\n';

  context += '### Detected Issues\n';
  for (const reason of analysis.reasons) {
    context += `- ${reason.replace(/_/g, ' ')}\n`;
  }

  context += '\n### Suggested Questions\n';
  for (const question of analysis.questions) {
    context += `- ${question}\n`;
  }

  context += '\n### Ambiguity Score\n';
  context += `Score: ${analysis.ambiguity_score} (threshold: ${threshold})\n`;

  return context;
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    const prompt = input.prompt;

    // Skip analysis for empty prompts
    if (!prompt || prompt.trim().length === 0) {
      logger.debug('Empty prompt, skipping analysis');
      outputAndExit({});
    }

    logger.debug('Analyzing prompt', { length: prompt.length });

    // Analyze prompt
    const analysis = analyzePrompt(prompt);

    logger.debug('Analysis result', {
      isAmbiguous: analysis.is_ambiguous,
      score: analysis.ambiguity_score,
      reasons: analysis.reasons
    });

    // If ambiguous, generate clarification context
    if (analysis.is_ambiguous) {
      const context = generateClarificationContext(analysis);
      const output = formatContextOutput('UserPromptSubmit', context);
      outputAndExit(output);
    }

    // Not ambiguous, no additional context needed
    outputAndExit({});

  } catch (error) {
    // On any error, fail gracefully (don't block user)
    errorAndExit('user-prompt-submit', 'An error occurred during analysis');
  }
}

// Run main
main();
