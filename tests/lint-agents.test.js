#!/usr/bin/env node
/**
 * Unit tests for tools/lint-agents.js
 *
 * Run with: node tests/lint-agents.test.js
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { lintProject } = require('../tools/lint-agents');

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function assertTrue(condition, message = 'Expected true') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n    Expected: ${JSON.stringify(expected)}\n    Actual: ${JSON.stringify(actual)}`);
  }
}

function assertContains(haystack, needle, message = '') {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}\n    Expected to contain: ${needle}\n    Actual: ${haystack}`);
  }
}

function mkTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lint-agents-test-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function rmDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function minimalAgentsMd() {
  return [
    '# Project AGENTS',
    '',
    '## Project Overview',
    '- Example project',
    '',
    '## Build & Run Commands',
    '```bash',
    'echo "ok"',
    '```',
    '',
    '## Code Style & Conventions',
    '- Keep it simple',
    '',
    '## Architecture Guidelines',
    '- Separate I/O from core logic',
    '',
    '## Agent Instructions',
    '- MUST keep changes small',
    ''
  ].join('\n');
}

function progressMd(itemCount) {
  const lines = ['# Work Progress', ''];
  for (let i = 0; i < itemCount; i++) {
    lines.push(`[x] Task ${i + 1} (2025-12-18)`);
  }
  lines.push('');
  return lines.join('\n');
}

function getCodes(issues) {
  return issues.map((i) => i.code).join(',');
}

async function run() {
  console.log('\n🧪 Running lint-agents tests\n');

  test('passes on a well-formed project', () => {
    const dir = mkTempDir();
    try {
      writeFile(path.join(dir, 'AGENTS.md'), minimalAgentsMd());
      writeFile(path.join(dir, 'AGENTS_PROGRESS.md'), progressMd(5));
      writeFile(path.join(dir, 'foo', 'AGENTS.md'), '# Local instructions\n- Keep this minimal\n');

      const result = lintProject({ rootDir: dir, includeGlobal: false, strict: true, json: true });
      assertTrue(result.ok, 'Expected lint to pass');
      assertEqual(result.errors.length, 0, 'Expected no errors');
      assertEqual(result.warnings.length, 0, 'Expected no warnings in strict mode');
      assertEqual(result.agentsFiles.length, 2, 'Expected project + local AGENTS.md files');
    } finally {
      rmDir(dir);
    }
  });

  test('fails when AGENTS_PROGRESS.md has too many items', () => {
    const dir = mkTempDir();
    try {
      writeFile(path.join(dir, 'AGENTS.md'), minimalAgentsMd());
      writeFile(path.join(dir, 'AGENTS_PROGRESS.md'), progressMd(6));

      const result = lintProject({ rootDir: dir, includeGlobal: false, strict: false, json: true });
      assertTrue(!result.ok, 'Expected lint to fail');
      assertContains(getCodes(result.errors), 'PROGRESS_TOO_MANY_ITEMS', 'Expected PROGRESS_TOO_MANY_ITEMS');
    } finally {
      rmDir(dir);
    }
  });

  test('warns when AGENTS_PROGRESS.md is missing (non-strict)', () => {
    const dir = mkTempDir();
    try {
      writeFile(path.join(dir, 'AGENTS.md'), minimalAgentsMd());

      const result = lintProject({ rootDir: dir, includeGlobal: false, strict: false, json: true });
      assertTrue(result.ok, 'Expected lint to pass in non-strict mode');
      assertContains(getCodes(result.warnings), 'PROGRESS_MISSING', 'Expected PROGRESS_MISSING warning');
    } finally {
      rmDir(dir);
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Tests: ${testCount} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});

