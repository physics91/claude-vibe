'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'prompt-analyzer.config.json');
let configCache = null;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWordRegex(words, flags) {
  if (!words.length) return null;
  const escaped = words.map(escapeRegex).join('|');
  return new RegExp(`\\b(?:${escaped})\\b`, flags);
}

function buildFilePathRegex(extensions) {
  if (!extensions.length) {
    return /\b/;
  }
  const escaped = extensions.map(ext => escapeRegex(ext)).join('|');
  return new RegExp(`\\.(?:${escaped})\\b|\\/|\\\\`, 'i');
}

function loadPromptAnalyzerConfig() {
  if (configCache) return configCache;

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);

  const config = {
    threshold: Number(parsed.threshold) || 40,
    maxPronounCount: Number(parsed.maxPronounCount) || 2,
    minWordCounts: {
      short: Number(parsed.minWordCounts?.short) || 5,
      coding: Number(parsed.minWordCounts?.coding) || 10,
      withProject: Number(parsed.minWordCounts?.withProject) || 15
    },
    scores: {
      TOO_SHORT: Number(parsed.scores?.TOO_SHORT) || 30,
      VAGUE_VERB: Number(parsed.scores?.VAGUE_VERB) || 15,
      EXCESSIVE_PRONOUNS: Number(parsed.scores?.EXCESSIVE_PRONOUNS) || 20,
      MISSING_DETAILS: Number(parsed.scores?.MISSING_DETAILS) || 25,
      MISSING_CODE_CONTEXT: Number(parsed.scores?.MISSING_CODE_CONTEXT) || 20,
      VAGUE_OPTIMIZATION: Number(parsed.scores?.VAGUE_OPTIMIZATION) || 15,
      INSUFFICIENT_REQUIREMENTS: Number(parsed.scores?.INSUFFICIENT_REQUIREMENTS) || 20,
      MISSING_TECH_STACK: Number(parsed.scores?.MISSING_TECH_STACK) || 15
    },
    patterns: {
      vagueVerbs: normalizeList(parsed.patterns?.vagueVerbs),
      pronouns: normalizeList(parsed.patterns?.pronouns),
      projectTypes: normalizeList(parsed.patterns?.projectTypes),
      codingKeywords: normalizeList(parsed.patterns?.codingKeywords),
      fileExtensions: normalizeList(parsed.patterns?.fileExtensions),
      optimizationAspects: normalizeList(parsed.patterns?.optimizationAspects),
      techStackKeywords: normalizeList(parsed.patterns?.techStackKeywords),
      creationVerbs: normalizeList(parsed.patterns?.creationVerbs),
      databaseKeywords: normalizeList(parsed.patterns?.databaseKeywords),
      optimizeKeywords: normalizeList(parsed.patterns?.optimizeKeywords)
    }
  };

  config.compiled = {
    vagueVerbRegex: buildWordRegex(config.patterns.vagueVerbs, 'i'),
    pronounRegex: buildWordRegex(config.patterns.pronouns, 'gi'),
    projectTypeRegex: buildWordRegex(config.patterns.projectTypes, 'i'),
    codingKeywordRegex: buildWordRegex(config.patterns.codingKeywords, 'i'),
    optimizeRegex: buildWordRegex(config.patterns.optimizeKeywords, 'i'),
    optimizationAspectRegex: buildWordRegex(config.patterns.optimizationAspects, 'i'),
    creationRegex: buildWordRegex(config.patterns.creationVerbs, 'i'),
    databaseRegex: buildWordRegex(config.patterns.databaseKeywords, 'i'),
    techStackRegex: buildWordRegex(config.patterns.techStackKeywords, 'i'),
    filePathRegex: buildFilePathRegex(config.patterns.fileExtensions)
  };

  configCache = config;
  return configCache;
}

function getWordCount(text) {
  if (!isNonEmptyString(text)) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findFirstWordMatch(text, words) {
  for (const word of words) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    if (regex.test(text)) {
      return word;
    }
  }
  return null;
}

function countWordMatches(text, regex) {
  if (!regex) return 0;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function hasMatch(text, regex) {
  return Boolean(regex && regex.test(text));
}

function analyzePrompt(prompt) {
  const config = loadPromptAnalyzerConfig();
  const text = String(prompt ?? '');
  const wordCount = getWordCount(text);

  let score = 0;
  const reasons = [];
  const questions = [];

  if (wordCount < config.minWordCounts.short) {
    score += config.scores.TOO_SHORT;
    reasons.push('TOO_SHORT');
    questions.push('What specific task would you like to accomplish?');
  }

  const matchedVerb = findFirstWordMatch(text, config.patterns.vagueVerbs);
  if (matchedVerb) {
    score += config.scores.VAGUE_VERB;
    reasons.push('VAGUE_VERB');
    questions.push(`Which specific aspect do you want to ${matchedVerb}? (e.g., performance, readability, structure)`);
  }

  const pronounCount = countWordMatches(text, config.compiled.pronounRegex);
  if (pronounCount >= config.maxPronounCount) {
    score += config.scores.EXCESSIVE_PRONOUNS;
    reasons.push('EXCESSIVE_PRONOUNS');
    questions.push('Which specific file or code are you referring to?');
  }

  if (hasMatch(text, config.compiled.projectTypeRegex) && wordCount < config.minWordCounts.withProject) {
    score += config.scores.MISSING_DETAILS;
    reasons.push('MISSING_DETAILS');
    questions.push('What are the main features needed?');
    questions.push('What technology stack would you like to use? (e.g., React, Vue, Node.js)');
  }

  if (hasMatch(text, config.compiled.codingKeywordRegex)) {
    if (!hasMatch(text, config.compiled.filePathRegex)) {
      score += config.scores.MISSING_CODE_CONTEXT;
      reasons.push('MISSING_CODE_CONTEXT');
      questions.push("Which file's code are you referring to?");
    }
  }

  if (hasMatch(text, config.compiled.optimizeRegex)) {
    if (!hasMatch(text, config.compiled.optimizationAspectRegex)) {
      score += config.scores.VAGUE_OPTIMIZATION;
      reasons.push('VAGUE_OPTIMIZATION');
      questions.push('Which aspect of optimization? (performance, memory, code size, readability)');
    }
  }

  if (hasMatch(text, config.compiled.creationRegex)) {
    if (wordCount < config.minWordCounts.coding) {
      score += config.scores.INSUFFICIENT_REQUIREMENTS;
      reasons.push('INSUFFICIENT_REQUIREMENTS');
      questions.push('What are the requirements or constraints?');
    }
  }

  if (hasMatch(text, config.compiled.databaseRegex)) {
    if (!hasMatch(text, config.compiled.techStackRegex)) {
      score += config.scores.MISSING_TECH_STACK;
      reasons.push('MISSING_TECH_STACK');
      questions.push('Which database/API technology would you like to use?');
    }
  }

  const uniqueQuestions = Array.from(new Set(questions));

  return {
    is_ambiguous: score >= config.threshold,
    ambiguity_score: score,
    reasons,
    questions: uniqueQuestions,
    original_prompt: text
  };
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function resolvePrompt(rawInput, args) {
  if (isNonEmptyString(rawInput)) {
    const normalized = rawInput.replace(/\r?\n$/, '');
    const trimmed = normalized.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.prompt === 'string') {
        return parsed.prompt;
      }
    } catch {
      return normalized;
    }
    return normalized;
  }

  if (args.length > 0) {
    return args.join(' ');
  }

  return '';
}

if (require.main === module) {
  try {
    const rawInput = readStdin();
    const prompt = resolvePrompt(rawInput, process.argv.slice(2));
    const result = analyzePrompt(prompt);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Prompt analysis failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  loadPromptAnalyzerConfig,
  analyzePrompt
};
