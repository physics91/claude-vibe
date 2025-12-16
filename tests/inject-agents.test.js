#!/usr/bin/env node
/**
 * Unit tests for inject-agents.js
 *
 * Run with: node tests/inject-agents.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

// Test utilities
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

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n    Expected: ${JSON.stringify(expected)}\n    Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message = 'Expected true') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertContains(str, substring, message = '') {
  if (!str.includes(substring)) {
    throw new Error(`${message}\n    Expected to contain: ${substring}\n    Actual: ${str.substring(0, 200)}...`);
  }
}

// Create temporary test directory
const testDir = path.join(os.tmpdir(), `inject-agents-test-${Date.now()}`);
const scriptPath = path.join(__dirname, '..', 'hooks', 'inject-agents.js');

function setup() {
  // Create test directory structure
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(path.join(testDir, 'subdir'), { recursive: true });
}

function cleanup() {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

function runScript(input = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', reject);

    // Send input
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

// Tests
async function runTests() {
  console.log('\n🧪 Running inject-agents.js tests\n');

  setup();

  try {
    // Test 1: Empty response when no AGENTS.md exists
    console.log('Test Group: No AGENTS.md files');
    {
      const result = await runScript({ cwd: testDir });
      test('returns empty object when no AGENTS.md exists', () => {
        const output = JSON.parse(result.stdout);
        assertEqual(Object.keys(output).length, 0, 'Should return empty object');
      });

      test('exits with code 0', () => {
        assertEqual(result.code, 0, 'Should exit with code 0');
      });
    }

    // Test 2: Project AGENTS.md
    console.log('\nTest Group: Project AGENTS.md');
    {
      const agentsContent = '# Project Rules\n\n- Follow TDD\n- Write tests first';
      fs.writeFileSync(path.join(testDir, 'AGENTS.md'), agentsContent);

      const result = await runScript({ cwd: testDir });
      test('reads project AGENTS.md', () => {
        const output = JSON.parse(result.stdout);
        assertTrue(output.hookSpecificOutput, 'Should have hookSpecificOutput');
        assertContains(output.hookSpecificOutput.additionalContext, 'Project Rules');
      });

      test('includes correct hook event name', () => {
        const output = JSON.parse(result.stdout);
        assertEqual(output.hookSpecificOutput.hookEventName, 'SessionStart');
      });

      test('includes source path', () => {
        const output = JSON.parse(result.stdout);
        assertContains(output.hookSpecificOutput.additionalContext, 'AGENTS.md');
      });

      fs.unlinkSync(path.join(testDir, 'AGENTS.md'));
    }

    // Test 3: Local AGENTS.md in subdirectory
    console.log('\nTest Group: Local AGENTS.md');
    {
      const localContent = '# Subdir Rules\n\n- Local specific rules';
      fs.writeFileSync(path.join(testDir, 'subdir', 'AGENTS.md'), localContent);

      const result = await runScript({ cwd: testDir });
      test('finds local AGENTS.md in subdirectory', () => {
        const output = JSON.parse(result.stdout);
        assertTrue(output.hookSpecificOutput, 'Should have hookSpecificOutput');
        assertContains(output.hookSpecificOutput.additionalContext, 'Subdir Rules');
      });

      test('marks as local type', () => {
        const output = JSON.parse(result.stdout);
        assertContains(output.hookSpecificOutput.additionalContext, 'Local AGENTS.md');
      });

      fs.unlinkSync(path.join(testDir, 'subdir', 'AGENTS.md'));
    }

    // Test 4: Multiple AGENTS.md files
    console.log('\nTest Group: Multiple AGENTS.md files');
    {
      fs.writeFileSync(path.join(testDir, 'AGENTS.md'), '# Project Rules');
      fs.writeFileSync(path.join(testDir, 'subdir', 'AGENTS.md'), '# Local Rules');

      const result = await runScript({ cwd: testDir });
      test('includes both project and local AGENTS.md', () => {
        const output = JSON.parse(result.stdout);
        assertContains(output.hookSpecificOutput.additionalContext, 'Project Rules');
        assertContains(output.hookSpecificOutput.additionalContext, 'Local Rules');
      });

      fs.unlinkSync(path.join(testDir, 'AGENTS.md'));
      fs.unlinkSync(path.join(testDir, 'subdir', 'AGENTS.md'));
    }

    // Test 5: Invalid JSON input
    console.log('\nTest Group: Error handling');
    {
      const child = spawn('node', [scriptPath], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });

      await new Promise((resolve) => {
        child.on('close', (code) => {
          test('handles invalid JSON gracefully', () => {
            assertEqual(code, 0, 'Should exit with code 0');
            const output = JSON.parse(stdout);
            assertTrue(typeof output === 'object', 'Should return valid JSON');
          });
          resolve();
        });

        child.stdin.write('not valid json');
        child.stdin.end();
      });
    }

    // Test 6: Blocked directories
    console.log('\nTest Group: Blocked directories');
    {
      fs.mkdirSync(path.join(testDir, 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'node_modules', 'pkg', 'AGENTS.md'), '# Should not be found');

      const result = await runScript({ cwd: testDir });
      test('ignores node_modules directory', () => {
        const output = JSON.parse(result.stdout);
        if (output.hookSpecificOutput) {
          assertTrue(
            !output.hookSpecificOutput.additionalContext.includes('Should not be found'),
            'Should not include content from node_modules'
          );
        }
      });

      fs.rmSync(path.join(testDir, 'node_modules'), { recursive: true, force: true });
    }

    // Test 7: Re-injection header
    console.log('\nTest Group: Output format');
    {
      fs.writeFileSync(path.join(testDir, 'AGENTS.md'), '# Test');

      const result = await runScript({ cwd: testDir });
      test('includes re-injection header', () => {
        const output = JSON.parse(result.stdout);
        assertContains(
          output.hookSpecificOutput.additionalContext,
          'Re-injected after compact'
        );
      });

      fs.unlinkSync(path.join(testDir, 'AGENTS.md'));
    }

    // Test 8: Symlink handling (skip on Windows without admin)
    console.log('\nTest Group: Symlink security');
    {
      const targetPath = path.join(testDir, 'secret.txt');
      const symlinkPath = path.join(testDir, 'AGENTS.md');

      fs.writeFileSync(targetPath, 'SECRET_CONTENT_SHOULD_NOT_APPEAR');

      let symlinkCreated = false;
      try {
        fs.symlinkSync(targetPath, symlinkPath);
        symlinkCreated = true;
      } catch (e) {
        console.log('  ⊘ Skipping symlink test (requires elevated permissions on Windows)');
      }

      if (symlinkCreated) {
        const result = await runScript({ cwd: testDir });
        test('ignores symlinked AGENTS.md files', () => {
          const output = JSON.parse(result.stdout);
          // Should return empty object or context without secret content
          if (output.hookSpecificOutput) {
            assertTrue(
              !output.hookSpecificOutput.additionalContext.includes('SECRET_CONTENT'),
              'Should not include content from symlinked file'
            );
          }
        });

        fs.unlinkSync(symlinkPath);
      }

      fs.unlinkSync(targetPath);
    }

  } finally {
    cleanup();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests: ${testCount} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  cleanup();
  process.exit(1);
});
