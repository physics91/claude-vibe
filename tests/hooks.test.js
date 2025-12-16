#!/usr/bin/env node
/**
 * Unit tests for all Node.js hooks
 *
 * Run with: node tests/hooks.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Test utilities
let testCount = 0;
let passCount = 0;
let failCount = 0;
let skipCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    if (error.message === 'SKIP') {
      skipCount++;
      console.log(`  ⊘ ${name} (skipped)`);
    } else {
      failCount++;
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
    }
  }
}

async function testAsync(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    if (error.message === 'SKIP') {
      skipCount++;
      console.log(`  ⊘ ${name} (skipped)`);
    } else {
      failCount++;
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
    }
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

function skip() {
  throw new Error('SKIP');
}

// Helper to run a hook script
function runHook(hookPath, input = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [hookPath], {
      cwd: process.cwd(),
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

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

const hooksDir = path.join(__dirname, '..', 'hooks');

// Test Groups
async function testCoreLibrary() {
  console.log('\n📦 Core Library Tests\n');

  test('core module loads without error', () => {
    const core = require(path.join(hooksDir, 'lib', 'core'));
    assertTrue(typeof core === 'object', 'Should export object');
  });

  test('core exports required functions', () => {
    const core = require(path.join(hooksDir, 'lib', 'core'));
    assertTrue(typeof core.readStdinJson === 'function', 'readStdinJson');
    assertTrue(typeof core.normalizeHookInput === 'function', 'normalizeHookInput');
    assertTrue(typeof core.formatContextOutput === 'function', 'formatContextOutput');
    assertTrue(typeof core.outputAndExit === 'function', 'outputAndExit');
    assertTrue(typeof core.createLogger === 'function', 'createLogger');
  });

  test('utils module loads without error', () => {
    const utils = require(path.join(hooksDir, 'lib', 'utils'));
    assertTrue(typeof utils === 'object', 'Should export object');
  });

  test('utils exports security functions', () => {
    const utils = require(path.join(hooksDir, 'lib', 'utils'));
    assertTrue(typeof utils.normalizePath === 'function', 'normalizePath');
    assertTrue(typeof utils.checkDangerousBashCommand === 'function', 'checkDangerousBashCommand');
    assertTrue(typeof utils.validateToolOperation === 'function', 'validateToolOperation');
  });

  test('normalizeHookInput handles empty input', () => {
    const core = require(path.join(hooksDir, 'lib', 'core'));
    const result = core.normalizeHookInput({});
    assertEqual(result.sessionId, 'unknown', 'Default sessionId');
    assertTrue(typeof result.cwd === 'string', 'cwd should be string');
  });

  test('normalizeHookInput extracts fields', () => {
    const core = require(path.join(hooksDir, 'lib', 'core'));
    const result = core.normalizeHookInput({
      session_id: 'test-123',
      cwd: '/test/path',
      tool_name: 'Bash',
      prompt: 'Hello'
    });
    assertEqual(result.sessionId, 'test-123');
    assertEqual(result.cwd, '/test/path');
    assertEqual(result.toolName, 'Bash');
    assertEqual(result.prompt, 'Hello');
  });
}

async function testSecurityUtils() {
  console.log('\n🔒 Security Utils Tests\n');

  const { checkDangerousBashCommand, checkProtectedFile, validateToolOperation } =
    require(path.join(hooksDir, 'lib', 'utils'));

  test('detects rm -rf command', () => {
    const result = checkDangerousBashCommand('rm -rf /');
    assertTrue(result.dangerous, 'Should detect rm -rf');
    assertTrue(result.matches.length > 0, 'Should have matches');
  });

  test('detects force push', () => {
    const result = checkDangerousBashCommand('git push --force origin main');
    assertTrue(result.dangerous, 'Should detect force push');
  });

  test('allows safe commands', () => {
    const result = checkDangerousBashCommand('ls -la');
    assertTrue(!result.dangerous, 'Should allow ls');
  });

  test('detects .env file', () => {
    const result = checkProtectedFile('.env');
    assertTrue(result.protected, 'Should detect .env');
  });

  test('allows .env.example', () => {
    const result = checkProtectedFile('.env.example');
    assertTrue(!result.protected, 'Should allow .env.example');
  });

  test('detects SSH private key', () => {
    const result = checkProtectedFile('/home/user/.ssh/id_rsa');
    assertTrue(result.protected, 'Should detect id_rsa');
  });

  test('validateToolOperation blocks dangerous Bash', () => {
    const result = validateToolOperation('Bash', { command: 'rm -rf /' });
    assertTrue(!result.safe, 'Should not be safe');
    assertEqual(result.severity, 'critical');
  });

  test('validateToolOperation allows safe Bash', () => {
    const result = validateToolOperation('Bash', { command: 'npm install' });
    assertTrue(result.safe, 'Should be safe');
  });

  test('validateToolOperation protects .env', () => {
    const result = validateToolOperation('Read', { file_path: '/project/.env' });
    assertTrue(!result.safe, 'Should not be safe');
  });
}

async function testPreToolUseSafety() {
  console.log('\n🛡️ PreToolUse Safety Hook Tests\n');

  const hookPath = path.join(hooksDir, 'pre-tool-use-safety.js');

  await testAsync('allows safe Read operation', async () => {
    const result = await runHook(hookPath, {
      tool_name: 'Read',
      tool_input: { file_path: '/project/README.md' }
    });
    assertEqual(result.code, 0, 'Should exit 0');
    const output = JSON.parse(result.stdout);
    assertEqual(output.hookSpecificOutput?.permissionDecision, 'allow');
  });

  await testAsync('blocks dangerous Bash command', async () => {
    const result = await runHook(hookPath, {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' }
    });
    // Should exit 2 for critical block or output deny
    assertTrue(result.code === 2 || result.stdout.includes('deny'), 'Should block');
  });

  await testAsync('blocks .env file access', async () => {
    const result = await runHook(hookPath, {
      tool_name: 'Read',
      tool_input: { file_path: '/project/.env' }
    });
    assertEqual(result.code, 0);
    const output = JSON.parse(result.stdout);
    assertEqual(output.hookSpecificOutput?.permissionDecision, 'deny');
  });

  await testAsync('allows .env.example', async () => {
    const result = await runHook(hookPath, {
      tool_name: 'Read',
      tool_input: { file_path: '/project/.env.example' }
    });
    assertEqual(result.code, 0);
    const output = JSON.parse(result.stdout);
    assertEqual(output.hookSpecificOutput?.permissionDecision, 'allow');
  });

  await testAsync('handles empty input gracefully', async () => {
    const result = await runHook(hookPath, {});
    assertEqual(result.code, 0, 'Should exit 0');
  });
}

async function testSessionStart() {
  console.log('\n🚀 SessionStart Hook Tests\n');

  const hookPath = path.join(hooksDir, 'session-start.js');
  const testDir = path.join(os.tmpdir(), `session-start-test-${Date.now()}`);

  // Setup
  fs.mkdirSync(testDir, { recursive: true });

  try {
    await testAsync('returns empty when no AGENTS.md', async () => {
      const result = await runHook(hookPath, { cwd: testDir });
      assertEqual(result.code, 0);
      const output = JSON.parse(result.stdout);
      assertTrue(!output.hookSpecificOutput || !output.hookSpecificOutput.additionalContext);
    });

    await testAsync('finds project AGENTS.md', async () => {
      fs.writeFileSync(path.join(testDir, 'AGENTS.md'), '# Test Rules');
      const result = await runHook(hookPath, { cwd: testDir });
      assertEqual(result.code, 0);
      const output = JSON.parse(result.stdout);
      assertTrue(output.hookSpecificOutput?.additionalContext?.includes('Test Rules'));
      fs.unlinkSync(path.join(testDir, 'AGENTS.md'));
    });

  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testUserPromptSubmit() {
  console.log('\n💬 UserPromptSubmit Hook Tests\n');

  const hookPath = path.join(hooksDir, 'user-prompt-submit.js');

  await testAsync('accepts clear prompts', async () => {
    const result = await runHook(hookPath, {
      prompt: 'Please add a login button to the header component using React and TypeScript'
    });
    assertEqual(result.code, 0);
    const output = JSON.parse(result.stdout);
    // Clear prompts should return empty or no clarification needed
    assertTrue(!output.hookSpecificOutput?.additionalContext?.includes('CLARIFICATION NEEDED'));
  });

  await testAsync('detects vague prompts', async () => {
    const result = await runHook(hookPath, {
      prompt: 'fix it'
    });
    assertEqual(result.code, 0);
    const output = JSON.parse(result.stdout);
    // Vague prompts should trigger clarification
    assertTrue(output.hookSpecificOutput?.additionalContext?.includes('CLARIFICATION') ||
               Object.keys(output).length === 0);
  });

  await testAsync('handles empty prompt', async () => {
    const result = await runHook(hookPath, { prompt: '' });
    assertEqual(result.code, 0);
  });
}

async function testPostToolUse() {
  console.log('\n📊 PostToolUse Hook Tests\n');

  const hookPath = path.join(hooksDir, 'post-tool-use.js');

  await testAsync('processes tool usage', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-session',
      tool_name: 'Read',
      tool_input: { file_path: '/test/file.js' },
      tool_result: { success: true }
    });
    assertEqual(result.code, 0);
  });

  await testAsync('handles missing tool name', async () => {
    const result = await runHook(hookPath, {});
    assertEqual(result.code, 0);
  });
}

async function testStopQualityGate() {
  console.log('\n🚦 Stop Quality Gate Hook Tests\n');

  const hookPath = path.join(hooksDir, 'stop-quality-gate.js');

  await testAsync('runs without error', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-session',
      cwd: process.cwd()
    });
    assertEqual(result.code, 0);
  });
}

async function testStatusLine() {
  console.log('\n📈 StatusLine Hook Tests\n');

  const hookPath = path.join(hooksDir, 'status-line.js');

  await testAsync('generates status line', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-session',
      hook_event_name: 'SessionStart'
    });
    assertEqual(result.code, 0);
    // Status line should output something
    assertTrue(result.stdout.length > 0, 'Should have output');
  });
}

async function testNotificationHandler() {
  console.log('\n🔔 Notification Handler Hook Tests\n');

  const hookPath = path.join(hooksDir, 'notification-handler.js');

  await testAsync('handles notification event', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-session',
      message: 'Test notification'
    });
    assertEqual(result.code, 0);
  });

  await testAsync('suppresses in sub-agent', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-session',
      message: 'Test notification',
      is_sub_agent: true
    });
    assertEqual(result.code, 0);
  });
}

async function testPreCompact() {
  console.log('\n💾 PreCompact Hook Tests\n');

  const hookPath = path.join(hooksDir, 'pre-compact.js');

  await testAsync('saves session state', async () => {
    const result = await runHook(hookPath, {
      session_id: 'test-compact-session',
      cwd: process.cwd()
    });
    assertEqual(result.code, 0);
  });
}

// ============================================
// Validation Utils Tests
// ============================================
async function testValidation() {
  console.log('\n✅ Validation Utils Tests\n');

  const {
    isNonEmptyString,
    isValidObject,
    isValidArray,
    isPositiveInteger,
    isValidUrl,
    isOneOf,
    validateSchema,
    checkType,
    sanitizeString,
    truncateString
  } = require(path.join(hooksDir, 'lib', 'utils', 'validation'));

  // isNonEmptyString tests
  test('isNonEmptyString returns true for valid string', () => {
    assertTrue(isNonEmptyString('hello'));
    assertTrue(isNonEmptyString('  hello  '));
  });

  test('isNonEmptyString returns false for empty string', () => {
    assertTrue(!isNonEmptyString(''));
  });

  test('isNonEmptyString returns false for whitespace-only', () => {
    assertTrue(!isNonEmptyString('   '));
    assertTrue(!isNonEmptyString('\t\n'));
  });

  test('isNonEmptyString returns false for null/undefined', () => {
    assertTrue(!isNonEmptyString(null));
    assertTrue(!isNonEmptyString(undefined));
  });

  test('isNonEmptyString returns false for non-string types', () => {
    assertTrue(!isNonEmptyString(123));
    assertTrue(!isNonEmptyString({}));
    assertTrue(!isNonEmptyString([]));
  });

  // isValidObject tests
  test('isValidObject returns true for plain objects', () => {
    assertTrue(isValidObject({ key: 'value' }));
    assertTrue(isValidObject({}));
  });

  test('isValidObject returns false for null', () => {
    assertTrue(!isValidObject(null));
  });

  test('isValidObject returns false for arrays', () => {
    assertTrue(!isValidObject([1, 2, 3]));
    assertTrue(!isValidObject([]));
  });

  test('isValidObject returns false for primitives', () => {
    assertTrue(!isValidObject('string'));
    assertTrue(!isValidObject(123));
    assertTrue(!isValidObject(true));
  });

  test('isValidObject returns false for undefined', () => {
    assertTrue(!isValidObject(undefined));
  });

  // isValidArray tests
  test('isValidArray returns true for arrays', () => {
    assertTrue(isValidArray([1, 2, 3]));
    assertTrue(isValidArray([]));
  });

  test('isValidArray returns false for objects', () => {
    assertTrue(!isValidArray({}));
    assertTrue(!isValidArray({ length: 3 }));
  });

  test('isValidArray returns false for null/undefined', () => {
    assertTrue(!isValidArray(null));
    assertTrue(!isValidArray(undefined));
  });

  test('isValidArray returns false for strings', () => {
    assertTrue(!isValidArray('array'));
  });

  // isPositiveInteger tests
  test('isPositiveInteger returns true for positive integers', () => {
    assertTrue(isPositiveInteger(1));
    assertTrue(isPositiveInteger(100));
  });

  test('isPositiveInteger returns false for zero', () => {
    assertTrue(!isPositiveInteger(0));
  });

  test('isPositiveInteger returns false for negative', () => {
    assertTrue(!isPositiveInteger(-1));
    assertTrue(!isPositiveInteger(-100));
  });

  test('isPositiveInteger returns false for floats', () => {
    assertTrue(!isPositiveInteger(1.5));
    assertTrue(!isPositiveInteger(3.14));
  });

  test('isPositiveInteger returns false for non-numbers', () => {
    assertTrue(!isPositiveInteger('1'));
    assertTrue(!isPositiveInteger(null));
    assertTrue(!isPositiveInteger(NaN));
  });

  // isValidUrl tests
  test('isValidUrl returns true for https URLs', () => {
    assertTrue(isValidUrl('https://example.com'));
    assertTrue(isValidUrl('https://example.com/path?query=1'));
  });

  test('isValidUrl returns true for http URLs', () => {
    assertTrue(isValidUrl('http://localhost:3000'));
  });

  test('isValidUrl returns false for invalid URLs', () => {
    assertTrue(!isValidUrl('not-a-url'));
    assertTrue(!isValidUrl('example.com'));
  });

  test('isValidUrl returns false for non-http protocols', () => {
    assertTrue(!isValidUrl('ftp://example.com'));
    assertTrue(!isValidUrl('file:///path'));
  });

  test('isValidUrl returns false for empty/null/undefined', () => {
    assertTrue(!isValidUrl(''));
    assertTrue(!isValidUrl(null));
    assertTrue(!isValidUrl(undefined));
  });

  // isOneOf tests
  test('isOneOf returns true when value in list', () => {
    assertTrue(isOneOf('a', ['a', 'b', 'c']));
    assertTrue(isOneOf(1, [1, 2, 3]));
  });

  test('isOneOf returns false when value not in list', () => {
    assertTrue(!isOneOf('d', ['a', 'b', 'c']));
  });

  test('isOneOf uses strict equality', () => {
    assertTrue(!isOneOf('1', [1, 2, 3]));
    assertTrue(!isOneOf(null, [undefined]));
  });

  // validateSchema tests
  test('validateSchema validates required fields', () => {
    const schema = { name: { required: true } };
    const result = validateSchema({}, schema);
    assertTrue(!result.valid);
    assertContains(result.errors[0], 'Missing required field: name');
  });

  test('validateSchema passes when required field present', () => {
    const schema = { name: { required: true } };
    const result = validateSchema({ name: 'test' }, schema);
    assertTrue(result.valid);
  });

  test('validateSchema validates type: string', () => {
    const schema = { name: { type: 'string' } };
    assertTrue(validateSchema({ name: 'test' }, schema).valid);
    assertTrue(!validateSchema({ name: 123 }, schema).valid);
  });

  test('validateSchema validates type: number', () => {
    const schema = { count: { type: 'number' } };
    assertTrue(validateSchema({ count: 42 }, schema).valid);
    assertTrue(!validateSchema({ count: NaN }, schema).valid);
  });

  test('validateSchema validates enum values', () => {
    const schema = { status: { enum: ['active', 'inactive'] } };
    assertTrue(validateSchema({ status: 'active' }, schema).valid);
    assertTrue(!validateSchema({ status: 'pending' }, schema).valid);
  });

  test('validateSchema validates min/max', () => {
    const schema = { age: { type: 'number', min: 0, max: 120 } };
    assertTrue(validateSchema({ age: 25 }, schema).valid);
    assertTrue(!validateSchema({ age: -1 }, schema).valid);
    assertTrue(!validateSchema({ age: 150 }, schema).valid);
  });

  test('validateSchema validates minLength/maxLength', () => {
    const schema = { code: { type: 'string', minLength: 3, maxLength: 10 } };
    assertTrue(validateSchema({ code: 'abc' }, schema).valid);
    assertTrue(!validateSchema({ code: 'ab' }, schema).valid);
    assertTrue(!validateSchema({ code: 'abcdefghijk' }, schema).valid);
  });

  test('validateSchema validates pattern', () => {
    const schema = { email: { pattern: /^[^@]+@[^@]+$/ } };
    assertTrue(validateSchema({ email: 'test@example.com' }, schema).valid);
    assertTrue(!validateSchema({ email: 'invalid' }, schema).valid);
  });

  // checkType tests
  test('checkType validates string type', () => {
    assertTrue(checkType('hello', 'string'));
    assertTrue(!checkType(123, 'string'));
  });

  test('checkType validates integer type', () => {
    assertTrue(checkType(42, 'integer'));
    assertTrue(!checkType(3.14, 'integer'));
  });

  test('checkType validates boolean type', () => {
    assertTrue(checkType(true, 'boolean'));
    assertTrue(!checkType('true', 'boolean'));
  });

  test('checkType validates array type', () => {
    assertTrue(checkType([1, 2], 'array'));
    assertTrue(!checkType({}, 'array'));
  });

  test('checkType returns true for unknown types', () => {
    assertTrue(checkType('anything', 'unknown_type'));
  });

  // sanitizeString tests
  test('sanitizeString removes control characters', () => {
    const result = sanitizeString('hello\x00world');
    assertEqual(result, 'helloworld');
  });

  test('sanitizeString preserves newlines and tabs', () => {
    const result = sanitizeString('hello\n\tworld');
    assertEqual(result, 'hello\n\tworld');
  });

  test('sanitizeString handles non-string input', () => {
    assertEqual(sanitizeString(null), '');
    assertEqual(sanitizeString(123), '');
    assertEqual(sanitizeString(undefined), '');
  });

  test('sanitizeString handles empty string', () => {
    assertEqual(sanitizeString(''), '');
  });

  // truncateString tests
  test('truncateString truncates long strings', () => {
    const result = truncateString('hello world', 8);
    assertEqual(result, 'hello...');
  });

  test('truncateString preserves short strings', () => {
    const result = truncateString('hi', 10);
    assertEqual(result, 'hi');
  });

  test('truncateString uses custom suffix', () => {
    const result = truncateString('hello world', 8, '>>');
    assertEqual(result, 'hello >>');
  });

  test('truncateString handles non-string input', () => {
    assertEqual(truncateString(null, 10), '');
    assertEqual(truncateString(123, 10), '');
  });
}

// ============================================
// Output Formatter Tests
// ============================================
async function testOutputFormatter() {
  console.log('\n📤 Output Formatter Tests\n');

  const {
    formatContextOutput,
    formatPermissionOutput,
    formatStopOutput,
    formatNotificationOutput,
    formatStatusLineOutput,
    formatEmptyOutput
  } = require(path.join(hooksDir, 'lib', 'core', 'output-formatter'));

  // formatContextOutput tests
  test('formatContextOutput returns basic structure', () => {
    const result = formatContextOutput('SessionStart');
    assertEqual(result.hookSpecificOutput.hookEventName, 'SessionStart');
    assertTrue(!result.hookSpecificOutput.additionalContext);
  });

  test('formatContextOutput includes additionalContext', () => {
    const result = formatContextOutput('PreToolUse', 'context data');
    assertEqual(result.hookSpecificOutput.additionalContext, 'context data');
  });

  test('formatContextOutput handles empty hookEventName', () => {
    const result = formatContextOutput('');
    assertEqual(result.hookSpecificOutput.hookEventName, '');
  });

  test('formatContextOutput handles null additionalContext', () => {
    const result = formatContextOutput('Test', null);
    assertTrue(!result.hookSpecificOutput.additionalContext);
  });

  // formatPermissionOutput tests
  test('formatPermissionOutput returns allow decision', () => {
    const result = formatPermissionOutput('allow');
    assertEqual(result.hookSpecificOutput.permissionDecision, 'allow');
    assertEqual(result.hookSpecificOutput.hookEventName, 'PreToolUse');
  });

  test('formatPermissionOutput returns deny with reason', () => {
    const result = formatPermissionOutput('deny', 'Security violation');
    assertEqual(result.hookSpecificOutput.permissionDecision, 'deny');
    assertEqual(result.hookSpecificOutput.permissionDecisionReason, 'Security violation');
  });

  test('formatPermissionOutput excludes empty reason', () => {
    const result = formatPermissionOutput('allow', null);
    assertTrue(!result.hookSpecificOutput.permissionDecisionReason);
  });

  test('formatPermissionOutput handles empty string reason', () => {
    const result = formatPermissionOutput('deny', '');
    assertTrue(!result.hookSpecificOutput.permissionDecisionReason);
  });

  // formatStopOutput tests
  test('formatStopOutput returns approve decision', () => {
    const result = formatStopOutput('approve');
    assertEqual(result.decision, 'approve');
  });

  test('formatStopOutput returns block with reason', () => {
    const result = formatStopOutput('block', 'Tests failed');
    assertEqual(result.decision, 'block');
    assertEqual(result.reason, 'Tests failed');
  });

  test('formatStopOutput excludes null reason', () => {
    const result = formatStopOutput('approve', null);
    assertTrue(!('reason' in result));
  });

  test('formatStopOutput excludes empty reason', () => {
    const result = formatStopOutput('block', '');
    assertTrue(!result.reason);
  });

  // formatNotificationOutput tests
  test('formatNotificationOutput returns proper structure', () => {
    const result = formatNotificationOutput([{ service: 'slack', status: 'sent' }]);
    assertEqual(result.hookSpecificOutput.hookEventName, 'Notification');
    assertTrue(Array.isArray(result.hookSpecificOutput.notificationsSent));
  });

  test('formatNotificationOutput adds timestamp', () => {
    const result = formatNotificationOutput([{ service: 'ntfy', status: 'sent' }]);
    assertTrue(typeof result.hookSpecificOutput.notificationsSent[0].timestamp === 'string');
  });

  test('formatNotificationOutput handles empty array', () => {
    const result = formatNotificationOutput([]);
    assertEqual(result.hookSpecificOutput.notificationsSent.length, 0);
  });

  test('formatNotificationOutput handles multiple services', () => {
    const results = [
      { service: 'slack', status: 'sent' },
      { service: 'ntfy', status: 'failed' }
    ];
    const result = formatNotificationOutput(results);
    assertEqual(result.hookSpecificOutput.notificationsSent.length, 2);
  });

  // formatStatusLineOutput tests
  test('formatStatusLineOutput returns proper structure', () => {
    const status = { tokens: '~45K/200K', skill: 'none', duration: '5m' };
    const result = formatStatusLineOutput(status);
    assertEqual(result.hookSpecificOutput.hookEventName, 'StatusLine');
    assertEqual(result.hookSpecificOutput.statusLine, status);
  });

  test('formatStatusLineOutput handles empty object', () => {
    const result = formatStatusLineOutput({});
    assertTrue(typeof result.hookSpecificOutput.statusLine === 'object');
  });

  test('formatStatusLineOutput preserves all fields', () => {
    const status = { tokens: '~10K', skill: 'test', duration: '1m', mcpStatus: 'connected' };
    const result = formatStatusLineOutput(status);
    assertEqual(result.hookSpecificOutput.statusLine.mcpStatus, 'connected');
  });

  // formatEmptyOutput tests
  test('formatEmptyOutput returns empty object', () => {
    const result = formatEmptyOutput();
    assertEqual(Object.keys(result).length, 0);
  });

  test('formatEmptyOutput returns fresh object', () => {
    const result1 = formatEmptyOutput();
    const result2 = formatEmptyOutput();
    assertTrue(result1 !== result2);
  });
}

// ============================================
// Logger Tests
// ============================================
async function testLoggerModule() {
  console.log('\n📝 Logger Module Tests\n');

  // Re-require to get fresh state
  const loggerPath = path.join(hooksDir, 'lib', 'core', 'logger.js');
  delete require.cache[require.resolve(loggerPath)];
  const {
    LOG_LEVELS,
    setLogLevel,
    enableFileLogging,
    createLogger,
    getDefaultLogPath
  } = require(loggerPath);

  // LOG_LEVELS tests
  test('LOG_LEVELS has expected values', () => {
    assertTrue(typeof LOG_LEVELS.DEBUG === 'number');
    assertTrue(typeof LOG_LEVELS.INFO === 'number');
    assertTrue(typeof LOG_LEVELS.WARN === 'number');
    assertTrue(typeof LOG_LEVELS.ERROR === 'number');
    assertTrue(LOG_LEVELS.DEBUG < LOG_LEVELS.INFO);
    assertTrue(LOG_LEVELS.INFO < LOG_LEVELS.WARN);
    assertTrue(LOG_LEVELS.WARN < LOG_LEVELS.ERROR);
  });

  // createLogger tests
  test('createLogger returns object with methods', () => {
    const logger = createLogger('TestHook');
    assertTrue(typeof logger.debug === 'function');
    assertTrue(typeof logger.info === 'function');
    assertTrue(typeof logger.warn === 'function');
    assertTrue(typeof logger.error === 'function');
  });

  test('createLogger methods accept message and data', () => {
    const logger = createLogger('TestHook');
    // Should not throw
    logger.debug('test message', { key: 'value' });
    logger.info('test message', { key: 'value' });
    logger.warn('test message', { key: 'value' });
    logger.error('test message', { key: 'value' });
    assertTrue(true);
  });

  test('createLogger handles null data', () => {
    const logger = createLogger('TestHook');
    // Should not throw
    logger.info('message', null);
    assertTrue(true);
  });

  // getDefaultLogPath tests
  test('getDefaultLogPath returns path in home', () => {
    const logPath = getDefaultLogPath();
    assertTrue(logPath.startsWith(os.homedir()));
  });

  test('getDefaultLogPath includes claude-vibe', () => {
    const logPath = getDefaultLogPath();
    assertContains(logPath, 'claude-vibe');
    assertContains(logPath, 'hooks.log');
  });

  // setLogLevel tests (verify no errors)
  test('setLogLevel accepts valid levels', () => {
    setLogLevel('DEBUG');
    setLogLevel('INFO');
    setLogLevel('WARN');
    setLogLevel('ERROR');
    setLogLevel('SILENT');
    assertTrue(true);
  });

  test('setLogLevel handles invalid levels', () => {
    // Should not throw, just ignore
    setLogLevel('INVALID');
    setLogLevel(123);
    setLogLevel(null);
    assertTrue(true);
  });

  // enableFileLogging tests
  test('enableFileLogging creates directory', () => {
    const testDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
    const testPath = path.join(testDir, 'test.log');
    enableFileLogging(testPath);
    assertTrue(fs.existsSync(testDir));
    // Cleanup
    try { fs.rmSync(testDir, { recursive: true }); } catch (e) { }
  });

  test('enableFileLogging handles existing directory', () => {
    const testPath = path.join(os.tmpdir(), `logger-exist-${Date.now()}.log`);
    // Should not throw
    enableFileLogging(testPath);
    assertTrue(true);
    // Cleanup
    try { fs.unlinkSync(testPath); } catch (e) { }
  });
}

// ============================================
// HTTP Client Tests
// ============================================
async function testHttpClient() {
  console.log('\n🌐 HTTP Client Module Tests\n');

  const http = require('http');
  const {
    request,
    postJson,
    sendNtfyNotification,
    sendSlackNotification,
    sendWebhook,
    DEFAULT_TIMEOUT
  } = require(path.join(hooksDir, 'lib', 'utils', 'http-client'));

  // Create a simple mock HTTP server for testing
  let mockServer;
  let serverPort;
  let lastRequest = null;
  let responseStatus = 200;
  let responseBody = 'OK';
  let responseDelay = 0;

  // Setup mock server with error handling and body size limit
  const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit for test requests

  await new Promise((resolve, reject) => {
    mockServer = http.createServer((req, res) => {
      let body = '';
      let bodySize = 0;
      let tooLarge = false;

      req.on('data', chunk => {
        if (tooLarge) return;
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
          tooLarge = true;
          res.statusCode = 413;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Payload Too Large');
          req.destroy();
          return;
        }
        body += chunk;
      });

      req.on('end', () => {
        if (tooLarge) return;
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: body
        };

        setTimeout(() => {
          res.statusCode = responseStatus;
          res.setHeader('Content-Type', 'text/plain');
          res.end(responseBody);
        }, responseDelay);
      });
    });

    // Handle server startup errors
    mockServer.once('error', (err) => {
      reject(new Error(`Mock server failed to start: ${err.message}`));
    });

    mockServer.listen(0, '127.0.0.1', () => {
      serverPort = mockServer.address().port;
      resolve();
    });
  });

  const baseUrl = `http://127.0.0.1:${serverPort}`;

  // Reset state helper
  function resetMock() {
    lastRequest = null;
    responseStatus = 200;
    responseBody = 'OK';
    responseDelay = 0;
  }

  try {
    // DEFAULT_TIMEOUT tests
    test('DEFAULT_TIMEOUT is defined', () => {
      assertTrue(typeof DEFAULT_TIMEOUT === 'number');
      assertTrue(DEFAULT_TIMEOUT > 0);
    });

    test('DEFAULT_TIMEOUT is 5000ms', () => {
      assertEqual(DEFAULT_TIMEOUT, 5000);
    });

    // request() - GET tests
    await testAsync('request() GET returns status and body', async () => {
      resetMock();
      responseBody = 'Hello World';
      const result = await request(baseUrl + '/test');
      assertEqual(result.status, 200);
      assertEqual(result.body, 'Hello World');
    });

    await testAsync('request() GET sends correct method', async () => {
      resetMock();
      await request(baseUrl + '/path');
      assertEqual(lastRequest.method, 'GET');
      assertEqual(lastRequest.url, '/path');
    });

    await testAsync('request() handles query params', async () => {
      resetMock();
      await request(baseUrl + '/search?q=test&limit=10');
      assertEqual(lastRequest.url, '/search?q=test&limit=10');
    });

    await testAsync('request() handles 404 status', async () => {
      resetMock();
      responseStatus = 404;
      const result = await request(baseUrl + '/notfound');
      assertEqual(result.status, 404);
    });

    await testAsync('request() handles 500 status', async () => {
      resetMock();
      responseStatus = 500;
      responseBody = 'Internal Error';
      const result = await request(baseUrl + '/error');
      assertEqual(result.status, 500);
      assertEqual(result.body, 'Internal Error');
    });

    // request() - POST tests
    await testAsync('request() POST sends body', async () => {
      resetMock();
      await request(baseUrl + '/post', {
        method: 'POST',
        body: 'test body'
      });
      assertEqual(lastRequest.method, 'POST');
      assertEqual(lastRequest.body, 'test body');
    });

    await testAsync('request() POST stringifies object body', async () => {
      resetMock();
      await request(baseUrl + '/json', {
        method: 'POST',
        body: { key: 'value' }
      });
      assertEqual(lastRequest.body, JSON.stringify({ key: 'value' }));
    });

    await testAsync('request() sends custom headers', async () => {
      resetMock();
      await request(baseUrl + '/headers', {
        headers: { 'X-Custom': 'header-value' }
      });
      assertEqual(lastRequest.headers['x-custom'], 'header-value');
    });

    // request() - timeout tests
    await testAsync('request() times out on slow response', async () => {
      resetMock();
      responseDelay = 200;
      try {
        await request(baseUrl + '/slow', { timeout: 50 });
        throw new Error('Should have timed out');
      } catch (e) {
        assertContains(e.message, 'timeout');
      }
    });

    // request() - error tests
    await testAsync('request() handles connection refused', async () => {
      try {
        await request('http://127.0.0.1:1', { timeout: 100 });
        throw new Error('Should have failed');
      } catch (e) {
        assertContains(e.message, 'Request failed');
      }
    });

    await testAsync('request() handles invalid URL', async () => {
      try {
        await request('not-a-valid-url');
        throw new Error('Should have failed');
      } catch (e) {
        assertTrue(e instanceof Error);
      }
    });

    // postJson() tests
    await testAsync('postJson() sends JSON content type', async () => {
      resetMock();
      await postJson(baseUrl + '/api', { data: 'test' });
      assertEqual(lastRequest.headers['content-type'], 'application/json');
    });

    await testAsync('postJson() sends JSON body', async () => {
      resetMock();
      const data = { name: 'test', value: 123 };
      await postJson(baseUrl + '/api', data);
      assertEqual(lastRequest.body, JSON.stringify(data));
    });

    await testAsync('postJson() uses POST method', async () => {
      resetMock();
      await postJson(baseUrl + '/api', {});
      assertEqual(lastRequest.method, 'POST');
    });

    await testAsync('postJson() includes custom headers', async () => {
      resetMock();
      await postJson(baseUrl + '/api', {}, { 'Authorization': 'Bearer token' });
      assertEqual(lastRequest.headers['authorization'], 'Bearer token');
    });

    await testAsync('postJson() uses custom timeout', async () => {
      resetMock();
      responseDelay = 200;
      try {
        await postJson(baseUrl + '/slow', {}, {}, 50);
        throw new Error('Should have timed out');
      } catch (e) {
        assertContains(e.message, 'timeout');
      }
    });

    // sendNtfyNotification() tests
    await testAsync('sendNtfyNotification() sends to topic', async () => {
      resetMock();
      const result = await sendNtfyNotification('test-topic', 'Hello', {
        server: baseUrl
      });
      assertEqual(result, true);
      assertEqual(lastRequest.url, '/test-topic');
      assertEqual(lastRequest.body, 'Hello');
    });

    await testAsync('sendNtfyNotification() includes title header', async () => {
      resetMock();
      await sendNtfyNotification('topic', 'msg', {
        server: baseUrl,
        title: 'My Title'
      });
      assertEqual(lastRequest.headers['title'], 'My Title');
    });

    await testAsync('sendNtfyNotification() includes priority header', async () => {
      resetMock();
      await sendNtfyNotification('topic', 'msg', {
        server: baseUrl,
        priority: 'high'
      });
      assertEqual(lastRequest.headers['priority'], 'high');
    });

    await testAsync('sendNtfyNotification() includes tags header', async () => {
      resetMock();
      await sendNtfyNotification('topic', 'msg', {
        server: baseUrl,
        tags: ['warning', 'test']
      });
      assertEqual(lastRequest.headers['tags'], 'warning,test');
    });

    await testAsync('sendNtfyNotification() returns false on error', async () => {
      resetMock();
      responseStatus = 500;
      const result = await sendNtfyNotification('topic', 'msg', {
        server: baseUrl
      });
      assertEqual(result, false);
    });

    await testAsync('sendNtfyNotification() returns false on connection error', async () => {
      const result = await sendNtfyNotification('topic', 'msg', {
        server: 'http://127.0.0.1:1',
        timeout: 100
      });
      assertEqual(result, false);
    });

    // sendSlackNotification() tests
    await testAsync('sendSlackNotification() sends message', async () => {
      resetMock();
      const result = await sendSlackNotification(baseUrl + '/slack', 'Hello Slack');
      assertEqual(result, true);
      const body = JSON.parse(lastRequest.body);
      assertEqual(body.text, 'Hello Slack');
    });

    await testAsync('sendSlackNotification() includes channel', async () => {
      resetMock();
      await sendSlackNotification(baseUrl + '/slack', 'msg', {
        channel: '#general'
      });
      const body = JSON.parse(lastRequest.body);
      assertEqual(body.channel, '#general');
    });

    await testAsync('sendSlackNotification() includes username', async () => {
      resetMock();
      await sendSlackNotification(baseUrl + '/slack', 'msg', {
        username: 'Claude Bot'
      });
      const body = JSON.parse(lastRequest.body);
      assertEqual(body.username, 'Claude Bot');
    });

    await testAsync('sendSlackNotification() includes icon_emoji', async () => {
      resetMock();
      await sendSlackNotification(baseUrl + '/slack', 'msg', {
        icon_emoji: ':robot_face:'
      });
      const body = JSON.parse(lastRequest.body);
      assertEqual(body.icon_emoji, ':robot_face:');
    });

    await testAsync('sendSlackNotification() returns false on error', async () => {
      resetMock();
      responseStatus = 403;
      const result = await sendSlackNotification(baseUrl + '/slack', 'msg');
      assertEqual(result, false);
    });

    // sendWebhook() tests
    await testAsync('sendWebhook() sends JSON payload', async () => {
      resetMock();
      const payload = { event: 'test', data: [1, 2, 3] };
      const result = await sendWebhook(baseUrl + '/webhook', payload);
      assertEqual(result, true);
      const body = JSON.parse(lastRequest.body);
      assertEqual(body.event, 'test');
    });

    await testAsync('sendWebhook() sends custom headers', async () => {
      resetMock();
      await sendWebhook(baseUrl + '/webhook', {}, { 'X-Webhook-Secret': 'secret123' });
      assertEqual(lastRequest.headers['x-webhook-secret'], 'secret123');
    });

    await testAsync('sendWebhook() returns true for 2xx status', async () => {
      resetMock();
      responseStatus = 201;
      const result = await sendWebhook(baseUrl + '/webhook', {});
      assertEqual(result, true);
    });

    await testAsync('sendWebhook() returns true for 204 status', async () => {
      resetMock();
      responseStatus = 204;
      const result = await sendWebhook(baseUrl + '/webhook', {});
      assertEqual(result, true);
    });

    await testAsync('sendWebhook() returns false for 300+ status', async () => {
      resetMock();
      responseStatus = 301;
      const result = await sendWebhook(baseUrl + '/webhook', {});
      assertEqual(result, false);
    });

    await testAsync('sendWebhook() returns false on connection error', async () => {
      const result = await sendWebhook('http://127.0.0.1:1/webhook', {});
      assertEqual(result, false);
    });

  } finally {
    // Cleanup mock server with error handling
    await new Promise((resolve, reject) => {
      mockServer.close((err) => {
        if (err) {
          // Log but don't fail test - server may already be closed
          console.warn(`Mock server close warning: ${err.message}`);
        }
        resolve();
      });
    });
  }
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Running Claude-Vibe Hook Tests\n');
  console.log('='.repeat(50));

  // Core module tests
  await testCoreLibrary();
  await testSecurityUtils();

  // Hook tests
  await testPreToolUseSafety();
  await testSessionStart();
  await testUserPromptSubmit();
  await testPostToolUse();
  await testStopQualityGate();
  await testStatusLine();
  await testNotificationHandler();
  await testPreCompact();

  // New core library tests (v2.1)
  await testValidation();
  await testOutputFormatter();
  await testLoggerModule();
  await testHttpClient();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests: ${testCount} | Passed: ${passCount} | Failed: ${failCount} | Skipped: ${skipCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
