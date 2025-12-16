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

const {
  readStdinJson,
  normalizeHookInput,
  formatContextOutput,
  outputAndExit,
  errorAndExit,
  createLogger,
  AMBIGUITY_WEIGHTS
} = require('./lib/core');

const logger = createLogger('user-prompt-submit');

/**
 * Vague verb patterns
 */
const VAGUE_VERBS = [
  /^(fix|improve|optimize|update|change|modify|refactor|clean|enhance)\s/i,
  /make\s+it\s+(better|faster|cleaner|nicer)/i,
  /do\s+something\s+(with|about)/i
];

/**
 * Patterns indicating missing tech stack
 */
const MISSING_TECH_PATTERNS = [
  /^(create|build|make|implement|add)\s+(a|an|the)?\s*(new\s+)?(feature|function|component|page|api|endpoint)/i
];

/**
 * Patterns indicating vague optimization requests
 */
const VAGUE_OPTIMIZATION = [
  /^(optimize|improve)\s+(the\s+)?(performance|speed|efficiency)/i,
  /make\s+it\s+(faster|quicker|more\s+efficient)/i
];

/**
 * Excessive pronoun patterns
 */
const PRONOUN_PATTERNS = [
  /\b(it|this|that|these|those)\b/gi
];

/**
 * Check if prompt is too short
 * @param {string} prompt - User prompt
 * @returns {boolean}
 */
function isTooShort(prompt) {
  const words = prompt.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length < 5;
}

/**
 * Check for vague verbs
 * @param {string} prompt - User prompt
 * @returns {boolean}
 */
function hasVagueVerbs(prompt) {
  return VAGUE_VERBS.some(pattern => pattern.test(prompt));
}

/**
 * Check for missing tech stack
 * @param {string} prompt - User prompt
 * @returns {boolean}
 */
function hasMissingTechStack(prompt) {
  // Check if it looks like a feature request without specifying technology
  if (!MISSING_TECH_PATTERNS.some(p => p.test(prompt))) {
    return false;
  }

  // Check if any technology is mentioned
  const techKeywords = [
    'react', 'vue', 'angular', 'next', 'nuxt', 'svelte',
    'python', 'django', 'flask', 'fastapi',
    'node', 'express', 'nest', 'koa',
    'java', 'spring', 'kotlin',
    'go', 'gin', 'fiber',
    'rust', 'actix', 'axum',
    'typescript', 'javascript',
    'sql', 'mongodb', 'postgres', 'mysql',
    'docker', 'kubernetes', 'terraform'
  ];

  const lowerPrompt = prompt.toLowerCase();
  return !techKeywords.some(tech => lowerPrompt.includes(tech));
}

/**
 * Check for vague optimization requests
 * @param {string} prompt - User prompt
 * @returns {boolean}
 */
function hasVagueOptimization(prompt) {
  return VAGUE_OPTIMIZATION.some(pattern => pattern.test(prompt));
}

/**
 * Count excessive pronouns
 * @param {string} prompt - User prompt
 * @returns {number} Pronoun count
 */
function countPronouns(prompt) {
  const matches = prompt.match(PRONOUN_PATTERNS[0]) || [];
  return matches.length;
}

/**
 * Analyze prompt for ambiguity
 * @param {string} prompt - User prompt
 * @returns {{isAmbiguous: boolean, score: number, reasons: string[], questions: string[]}}
 */
function analyzePrompt(prompt) {
  let score = 0;
  const reasons = [];
  const questions = [];

  // Too short
  if (isTooShort(prompt)) {
    score += AMBIGUITY_WEIGHTS.TOO_SHORT;
    reasons.push('PROMPT_TOO_SHORT');
    questions.push('Could you provide more details about what you want to accomplish?');
  }

  // Vague verbs
  if (hasVagueVerbs(prompt)) {
    score += AMBIGUITY_WEIGHTS.VAGUE_VERB;
    reasons.push('VAGUE_VERB_DETECTED');
    questions.push('What specific changes or improvements are you looking for?');
  }

  // Missing tech stack
  if (hasMissingTechStack(prompt)) {
    score += AMBIGUITY_WEIGHTS.NO_TECH_STACK;
    reasons.push('MISSING_TECH_STACK');
    questions.push('What technology stack or framework should this be implemented in?');
  }

  // Vague optimization
  if (hasVagueOptimization(prompt)) {
    score += AMBIGUITY_WEIGHTS.MISSING_DETAILS;
    reasons.push('VAGUE_OPTIMIZATION_REQUEST');
    questions.push('What specific performance metrics are you trying to improve?');
  }

  // Excessive pronouns
  const pronounCount = countPronouns(prompt);
  if (pronounCount > 3) {
    score += AMBIGUITY_WEIGHTS.EXCESSIVE_PRONOUNS;
    reasons.push('EXCESSIVE_PRONOUNS');
    questions.push('Could you be more specific about what "it/this/that" refers to?');
  }

  return {
    isAmbiguous: score >= AMBIGUITY_WEIGHTS.THRESHOLD,
    score,
    reasons,
    questions
  };
}

/**
 * Generate clarification context
 * @param {Object} analysis - Analysis result
 * @returns {string} Clarification context
 */
function generateClarificationContext(analysis) {
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
  context += `Score: ${analysis.score}/${AMBIGUITY_WEIGHTS.THRESHOLD * 2} (threshold: ${AMBIGUITY_WEIGHTS.THRESHOLD})\n`;

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
      isAmbiguous: analysis.isAmbiguous,
      score: analysis.score,
      reasons: analysis.reasons
    });

    // If ambiguous, generate clarification context
    if (analysis.isAmbiguous) {
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
