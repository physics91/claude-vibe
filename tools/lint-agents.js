#!/usr/bin/env node
/**
 * lint-agents.js
 *
 * Lints AGENTS.md / AGENTS_PROGRESS.md for common issues that can break
 * Claude-Vibe behaviors (compaction reinjection, instruction hygiene).
 *
 * - Repository-safe by default: does not inspect global ~/.claude/AGENTS.md unless requested.
 * - CI-friendly: exits non-zero on errors (and on warnings with --strict).
 *
 * Usage:
 *   node tools/lint-agents.js --root . [--include-global] [--strict] [--json]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULTS = Object.freeze({
  includeGlobal: false,
  localMaxDepth: 2,
  maxAgentsFiles: 20,
  maxAgentsFileBytes: 100 * 1024,
  maxTotalBytes: 500 * 1024,
  maxProgressItems: 5,
  strict: false,
  json: false
});

const BLOCKED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv', 'venv',
  '.pytest_cache', 'dist', 'build', '.next', 'coverage',
  'target', 'vendor', '.idea', '.vscode', 'out', 'bin', 'obj'
]);

function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

function safeResolve(p) {
  return path.normalize(path.resolve(p));
}

function getHomeDir() {
  return os.homedir();
}

function isSymlink(filePath) {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

function readTextFileUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function findLocalAgentsMd(baseDir, maxDepth) {
  const results = [];

  function search(dir, depth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (BLOCKED_DIRS.has(entry.name)) continue;

      const subDir = path.join(dir, entry.name);
      const agentsPath = path.join(subDir, 'AGENTS.md');
      if (fs.existsSync(agentsPath)) {
        results.push({
          type: 'local',
          path: safeResolve(agentsPath)
        });
      }

      search(subDir, depth + 1);
    }
  }

  search(baseDir, 1);
  return results;
}

function findAgentsFiles(rootDir, includeGlobal, localMaxDepth) {
  const files = [];

  if (includeGlobal) {
    const globalPath = path.join(getHomeDir(), '.claude', 'AGENTS.md');
    if (fs.existsSync(globalPath)) {
      files.push({ type: 'global', path: safeResolve(globalPath) });
    }
  }

  const projectPath = path.join(rootDir, 'AGENTS.md');
  if (fs.existsSync(projectPath)) {
    files.push({ type: 'project', path: safeResolve(projectPath) });
  }

  files.push(...findLocalAgentsMd(rootDir, localMaxDepth));
  return files;
}

function pushIssue(list, issue) {
  list.push({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    filePath: issue.filePath || null,
    details: issue.details || null
  });
}

function lintAgentsMdFile(fileInfo, options) {
  const issues = [];
  const filePath = fileInfo.path;

  if (isSymlink(filePath)) {
    pushIssue(issues, {
      severity: 'error',
      code: 'AGENTS_SYMLINK_IGNORED',
      message: 'AGENTS.md is a symlink and will be ignored by hooks for safety.',
      filePath
    });
    return issues;
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    pushIssue(issues, {
      severity: 'error',
      code: 'AGENTS_STAT_FAILED',
      message: 'Failed to stat AGENTS.md.',
      filePath
    });
    return issues;
  }

  if (stats.size === 0) {
    pushIssue(issues, {
      severity: 'error',
      code: 'AGENTS_EMPTY',
      message: 'AGENTS.md is empty.',
      filePath
    });
    return issues;
  }

  if (stats.size > options.maxAgentsFileBytes) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'AGENTS_TOO_LARGE_TRUNCATED',
      message: `AGENTS.md exceeds ${options.maxAgentsFileBytes} bytes and will be truncated during reinjection.`,
      filePath,
      details: { sizeBytes: stats.size, maxBytes: options.maxAgentsFileBytes }
    });
  }

  let content;
  try {
    content = readTextFileUtf8(filePath);
  } catch {
    pushIssue(issues, {
      severity: 'error',
      code: 'AGENTS_READ_FAILED',
      message: 'Failed to read AGENTS.md as UTF-8.',
      filePath
    });
    return issues;
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    pushIssue(issues, {
      severity: 'error',
      code: 'AGENTS_WHITESPACE_ONLY',
      message: 'AGENTS.md contains only whitespace.',
      filePath
    });
    return issues;
  }

  // Structural checks (project/global only; locals are often intentionally minimal)
  if (fileInfo.type === 'project' || fileInfo.type === 'global') {
    const hasH1 = /^#\s+\S+/m.test(content);
    if (!hasH1) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'AGENTS_MISSING_H1',
        message: 'AGENTS.md has no level-1 heading (# ...).',
        filePath
      });
    }

    const recommendedHeadings = [
      'Project Overview',
      'Build & Run Commands',
      'Code Style & Conventions',
      'Architecture Guidelines',
      'Agent Instructions'
    ];

    const missing = recommendedHeadings.filter((h) => !new RegExp(`^##\\s+${escapeRegExp(h)}\\b`, 'm').test(content));
    if (missing.length > 0) {
      pushIssue(issues, {
        severity: 'warning',
        code: 'AGENTS_MISSING_RECOMMENDED_SECTIONS',
        message: `AGENTS.md is missing recommended section(s): ${missing.join(', ')}.`,
        filePath,
        details: { missing }
      });
    }
  }

  return issues;
}

function lintAgentsProgress(progressPath, options) {
  const issues = [];

  if (!fs.existsSync(progressPath)) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'PROGRESS_MISSING',
      message: 'AGENTS_PROGRESS.md not found (recommended for tracking work).',
      filePath: progressPath
    });
    return issues;
  }

  if (isSymlink(progressPath)) {
    pushIssue(issues, {
      severity: 'error',
      code: 'PROGRESS_SYMLINK',
      message: 'AGENTS_PROGRESS.md is a symlink (avoid for safety and portability).',
      filePath: progressPath
    });
    return issues;
  }

  let content;
  try {
    content = readTextFileUtf8(progressPath);
  } catch {
    pushIssue(issues, {
      severity: 'error',
      code: 'PROGRESS_READ_FAILED',
      message: 'Failed to read AGENTS_PROGRESS.md as UTF-8.',
      filePath: progressPath
    });
    return issues;
  }

  if (!/^#\s+Work Progress\b/m.test(content)) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'PROGRESS_MISSING_HEADER',
      message: 'AGENTS_PROGRESS.md should include a "# Work Progress" header.',
      filePath: progressPath
    });
  }

  const itemLines = content.split(/\r?\n/).filter((line) => /^\[( |~|x)\]\s+/.test(line.trim()));

  if (itemLines.length > options.maxProgressItems) {
    pushIssue(issues, {
      severity: 'error',
      code: 'PROGRESS_TOO_MANY_ITEMS',
      message: `AGENTS_PROGRESS.md must keep only the ${options.maxProgressItems} most recent items.`,
      filePath: progressPath,
      details: { count: itemLines.length, max: options.maxProgressItems }
    });
  }

  const itemFormat = /^\[( |~|x)\]\s+.+\(\d{4}-\d{2}-\d{2}\)\s*$/;
  const badFormat = itemLines.filter((line) => !itemFormat.test(line.trim()));
  if (badFormat.length > 0) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'PROGRESS_BAD_ITEM_FORMAT',
      message: 'Some progress items do not match the expected format: "[status] Task description (YYYY-MM-DD)".',
      filePath: progressPath,
      details: { examples: badFormat.slice(0, 3) }
    });
  }

  return issues;
}

function simulateReinjectionLimits(agentsFiles, options) {
  const issues = [];

  const nonSymlinkFiles = agentsFiles.filter((f) => !isSymlink(f.path));

  if (nonSymlinkFiles.length > options.maxAgentsFiles) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'AGENTS_TOO_MANY_FILES',
      message: `More than ${options.maxAgentsFiles} AGENTS.md files were found; some will be skipped during reinjection.`,
      details: { count: nonSymlinkFiles.length, max: options.maxAgentsFiles }
    });
  }

  const included = nonSymlinkFiles.slice(0, options.maxAgentsFiles);
  const totalBytes = included.reduce((sum, f) => {
    try {
      const size = fs.statSync(f.path).size;
      return sum + Math.min(size, options.maxAgentsFileBytes);
    } catch {
      return sum;
    }
  }, 0);

  if (totalBytes > options.maxTotalBytes) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'AGENTS_TOTAL_TOO_LARGE',
      message: `Total AGENTS.md bytes exceed ${options.maxTotalBytes}; content may be truncated during reinjection.`,
      details: { totalBytes, maxTotalBytes: options.maxTotalBytes }
    });
  }

  return issues;
}

function lintProject({ rootDir, includeGlobal, strict, json }) {
  const options = {
    ...DEFAULTS,
    ...{
      includeGlobal,
      strict,
      json
    }
  };

  const resolvedRoot = safeResolve(rootDir);
  const agentsFiles = findAgentsFiles(resolvedRoot, options.includeGlobal, options.localMaxDepth);
  const progressPath = path.join(resolvedRoot, 'AGENTS_PROGRESS.md');

  const errors = [];
  const warnings = [];

  if (agentsFiles.length === 0) {
    pushIssue(warnings, {
      severity: 'warning',
      code: 'AGENTS_NOT_FOUND',
      message: 'No AGENTS.md files found.',
      filePath: path.join(resolvedRoot, 'AGENTS.md')
    });
  }

  for (const fileInfo of agentsFiles) {
    const issues = lintAgentsMdFile(fileInfo, options);
    for (const issue of issues) {
      if (issue.severity === 'error') errors.push(issue);
      else warnings.push(issue);
    }
  }

  for (const issue of lintAgentsProgress(progressPath, options)) {
    if (issue.severity === 'error') errors.push(issue);
    else warnings.push(issue);
  }

  for (const issue of simulateReinjectionLimits(agentsFiles, options)) {
    if (issue.severity === 'error') errors.push(issue);
    else warnings.push(issue);
  }

  const ok = errors.length === 0 && (!options.strict || warnings.length === 0);

  return {
    ok,
    rootDir: resolvedRoot,
    agentsFiles: agentsFiles.map((f) => ({ type: f.type, path: f.path })),
    errors,
    warnings
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const args = {
    rootDir: process.cwd(),
    includeGlobal: DEFAULTS.includeGlobal,
    strict: DEFAULTS.strict,
    json: DEFAULTS.json
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' && i + 1 < argv.length) {
      args.rootDir = argv[++i];
      continue;
    }
    if (a === '--include-global') {
      args.includeGlobal = true;
      continue;
    }
    if (a === '--no-global') {
      args.includeGlobal = false;
      continue;
    }
    if (a === '--strict') {
      args.strict = true;
      continue;
    }
    if (a === '--json') {
      args.json = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function formatTextResult(result) {
  const lines = [];
  lines.push(`AGENTS LINT (${toPosixPath(result.rootDir)})`);

  if (result.agentsFiles.length > 0) {
    lines.push(`Found AGENTS.md files: ${result.agentsFiles.length}`);
    for (const f of result.agentsFiles) {
      lines.push(`- ${f.type}: ${toPosixPath(f.path)}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push(`Errors (${result.errors.length})`);
    for (const e of result.errors) {
      const where = e.filePath ? ` (${toPosixPath(e.filePath)})` : '';
      lines.push(`- [${e.code}]${where} ${e.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push(`Warnings (${result.warnings.length})`);
    for (const w of result.warnings) {
      const where = w.filePath ? ` (${toPosixPath(w.filePath)})` : '';
      lines.push(`- [${w.code}]${where} ${w.message}`);
    }
  }

  lines.push('');
  lines.push(result.ok ? 'Result: PASS' : 'Result: FAIL');
  return lines.join('\n');
}

function printHelp() {
  // Keep concise; this is a repo utility.
  console.log('Usage: node tools/lint-agents.js [--root <dir>] [--no-global|--include-global] [--strict] [--json]');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const result = lintProject({
    rootDir: args.rootDir,
    includeGlobal: args.includeGlobal,
    strict: args.strict,
    json: args.json
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(formatTextResult(result) + '\n');
  }

  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  lintProject,
  findAgentsFiles
};

