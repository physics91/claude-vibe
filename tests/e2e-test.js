#!/usr/bin/env node
/**
 * E2E test for inject-agents.js
 *
 * Simulates the Claude Code hook environment and verifies
 * the output format matches Claude Code's expected format.
 *
 * Run with: node tests/e2e-test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const scriptPath = path.join(__dirname, '..', 'hooks', 'inject-agents.js');
const testDir = path.join(os.tmpdir(), `e2e-test-${Date.now()}`);

async function setup() {
  // Create test project directory
  fs.mkdirSync(testDir, { recursive: true });

  // Create a realistic AGENTS.md
  const agentsContent = `# Project AGENTS.md

## Coding Standards

- Use TypeScript strict mode
- Follow TDD approach
- Maximum function length: 50 lines
- IMPORTANT: Always run tests before committing

## Subagent Definitions

### code-reviewer
Use this agent after completing significant code changes.
Focus on security and performance.

### test-runner
Use proactively to run tests after changes.
`;

  fs.writeFileSync(path.join(testDir, 'AGENTS.md'), agentsContent);

  // Create subdirectory with local AGENTS.md
  fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(testDir, 'src', 'AGENTS.md'), `# Local Rules
- This directory contains source code
- Use ESLint configuration
`);
}

async function cleanup() {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }
}

async function runScript(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on('error', reject);

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

async function runE2ETests() {
  console.log('\n🔬 Running E2E Tests\n');
  console.log('='.repeat(60));

  await setup();

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Simulate Claude Code compact event
    console.log('\n📋 Test 1: Simulate compact event input');

    const hookInput = {
      session_id: 'test-session-123',
      transcript_path: '~/.claude/projects/test/transcript.jsonl',
      permission_mode: 'default',
      hook_event_name: 'SessionStart',
      source: 'compact',
      cwd: testDir
    };

    const result = await runScript(hookInput);

    // Verify exit code
    if (result.code === 0) {
      console.log('  ✓ Script exited with code 0');
      passed++;
    } else {
      console.log(`  ✗ Script exited with code ${result.code}`);
      failed++;
    }

    // Parse and verify output
    let output;
    try {
      output = JSON.parse(result.stdout);
      console.log('  ✓ Output is valid JSON');
      passed++;
    } catch (e) {
      console.log('  ✗ Output is not valid JSON');
      console.log('    Output:', result.stdout);
      failed++;
      throw new Error('Cannot continue without valid JSON');
    }

    // Verify Claude Code hook output format
    console.log('\n📋 Test 2: Verify Claude Code hook output format');

    if (output.hookSpecificOutput) {
      console.log('  ✓ Has hookSpecificOutput');
      passed++;
    } else {
      console.log('  ✗ Missing hookSpecificOutput');
      failed++;
    }

    if (output.hookSpecificOutput?.hookEventName === 'SessionStart') {
      console.log('  ✓ hookEventName is SessionStart');
      passed++;
    } else {
      console.log('  ✗ hookEventName is not SessionStart');
      failed++;
    }

    if (typeof output.hookSpecificOutput?.additionalContext === 'string') {
      console.log('  ✓ additionalContext is a string');
      passed++;
    } else {
      console.log('  ✗ additionalContext is not a string');
      failed++;
    }

    // Verify content
    console.log('\n📋 Test 3: Verify injected content');

    const context = output.hookSpecificOutput?.additionalContext || '';

    if (context.includes('Re-injected after compact')) {
      console.log('  ✓ Contains re-injection notice');
      passed++;
    } else {
      console.log('  ✗ Missing re-injection notice');
      failed++;
    }

    if (context.includes('Project AGENTS.md') || context.includes('PROJECT AGENTS.md')) {
      console.log('  ✓ Contains project AGENTS.md content');
      passed++;
    } else {
      console.log('  ✗ Missing project AGENTS.md content');
      failed++;
    }

    if (context.includes('TypeScript strict mode')) {
      console.log('  ✓ Contains coding standards');
      passed++;
    } else {
      console.log('  ✗ Missing coding standards');
      failed++;
    }

    if (context.includes('code-reviewer')) {
      console.log('  ✓ Contains subagent definitions');
      passed++;
    } else {
      console.log('  ✗ Missing subagent definitions');
      failed++;
    }

    if (context.includes('Local Rules') || context.includes('LOCAL AGENTS.md')) {
      console.log('  ✓ Contains local AGENTS.md content');
      passed++;
    } else {
      console.log('  ✗ Missing local AGENTS.md content');
      failed++;
    }

    // Test 4: Verify no extra fields that could confuse Claude Code
    console.log('\n📋 Test 4: Verify clean output');

    const allowedKeys = ['hookSpecificOutput'];
    const outputKeys = Object.keys(output);
    const unexpectedKeys = outputKeys.filter(k => !allowedKeys.includes(k));

    if (unexpectedKeys.length === 0) {
      console.log('  ✓ No unexpected top-level keys');
      passed++;
    } else {
      console.log(`  ✗ Unexpected keys: ${unexpectedKeys.join(', ')}`);
      failed++;
    }

    const allowedHookKeys = ['hookEventName', 'additionalContext'];
    const hookKeys = Object.keys(output.hookSpecificOutput || {});
    const unexpectedHookKeys = hookKeys.filter(k => !allowedHookKeys.includes(k));

    if (unexpectedHookKeys.length === 0) {
      console.log('  ✓ No unexpected hookSpecificOutput keys');
      passed++;
    } else {
      console.log(`  ✗ Unexpected hook keys: ${unexpectedHookKeys.join(', ')}`);
      failed++;
    }

    // Output sample for manual inspection
    console.log('\n📋 Sample output for inspection:');
    console.log('-'.repeat(60));
    const sampleContext = context.substring(0, 500);
    console.log(sampleContext + (context.length > 500 ? '\n...(truncated)' : ''));
    console.log('-'.repeat(60));

  } finally {
    await cleanup();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`E2E Tests Complete: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((error) => {
  console.error('E2E test error:', error);
  cleanup();
  process.exit(1);
});
