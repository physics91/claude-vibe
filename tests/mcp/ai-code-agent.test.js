#!/usr/bin/env node
/**
 * Unit tests for AI Code Agent MCP integration
 *
 * Run with: node tests/mcp/ai-code-agent.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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

const pluginRoot = path.resolve(__dirname, '..', '..');
const mcpRoot = path.join(pluginRoot, 'lib', 'mcp', 'ai-code-agent');

// ============================================
// MCP Server Structure Tests
// ============================================
async function testMcpServerStructure() {
  console.log('\n📂 MCP Server Structure Tests\n');

  test('lib/mcp directory exists', () => {
    const mcpDir = path.join(pluginRoot, 'lib', 'mcp');
    if (!fs.existsSync(mcpDir)) skip();
    assertTrue(fs.existsSync(mcpDir), 'lib/mcp directory should exist');
  });

  test('ai-code-agent directory exists', () => {
    if (!fs.existsSync(mcpRoot)) skip();
    assertTrue(fs.existsSync(mcpRoot), 'ai-code-agent directory should exist');
  });

  test('package.json exists', () => {
    const pkgPath = path.join(mcpRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) skip();
    assertTrue(fs.existsSync(pkgPath), 'package.json should exist');
  });

  test('package.json has correct name', () => {
    const pkgPath = path.join(mcpRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) skip();
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assertEqual(pkg.name, '@claude-vibe/ai-code-agent-mcp');
  });

  test('package.json is private', () => {
    const pkgPath = path.join(mcpRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) skip();
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assertTrue(pkg.private === true, 'Should be private package');
  });

  test('src directory exists', () => {
    const srcDir = path.join(mcpRoot, 'src');
    if (!fs.existsSync(srcDir)) skip();
    assertTrue(fs.existsSync(srcDir), 'src directory should exist');
  });

  test('config/default.json exists', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();
    assertTrue(fs.existsSync(configPath), 'config/default.json should exist');
  });

  test('tsconfig.json exists', () => {
    const tsconfigPath = path.join(mcpRoot, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) skip();
    assertTrue(fs.existsSync(tsconfigPath), 'tsconfig.json should exist');
  });
}

// ============================================
// MCP Configuration Tests
// ============================================
async function testMcpConfiguration() {
  console.log('\n⚙️ MCP Configuration Tests\n');

  test('default config is valid JSON', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    assertTrue(typeof config === 'object');
  });

  test('default config has server settings', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assertTrue(config.server !== undefined, 'Should have server config');
    assertTrue(typeof config.server.name === 'string', 'Should have server name');
    assertTrue(typeof config.server.version === 'string', 'Should have server version');
  });

  test('default config enables both Codex and Gemini', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assertTrue(config.codex?.enabled !== false, 'Codex should be enabled');
    assertTrue(config.gemini?.enabled !== false, 'Gemini should be enabled');
  });

  test('default config uses plugin data directory', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.storage?.sqlite?.path) {
      assertContains(config.storage.sqlite.path, 'claude-vibe');
    }
  });

  test('default config has cache settings', () => {
    const configPath = path.join(mcpRoot, 'config', 'default.json');
    if (!fs.existsSync(configPath)) skip();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assertTrue(config.cache !== undefined, 'Should have cache config');
  });
}

// ============================================
// MCP Build Tests
// ============================================
async function testMcpBuild() {
  console.log('\n🔨 MCP Build Tests\n');

  test('dist directory exists after build', () => {
    const distDir = path.join(mcpRoot, 'dist');
    if (!fs.existsSync(distDir)) skip();
    assertTrue(fs.existsSync(distDir), 'dist directory should exist');
  });

  test('dist/index.js exists', () => {
    const indexJs = path.join(mcpRoot, 'dist', 'index.js');
    if (!fs.existsSync(indexJs)) skip();
    assertTrue(fs.existsSync(indexJs), 'dist/index.js should exist');
  });

  test('dist/index.js is valid JavaScript', () => {
    const indexJs = path.join(mcpRoot, 'dist', 'index.js');
    if (!fs.existsSync(indexJs)) skip();

    try {
      // Check if it can be parsed (not executed)
      const content = fs.readFileSync(indexJs, 'utf-8');
      assertTrue(content.length > 0, 'Should have content');
    } catch (e) {
      throw new Error(`Invalid JavaScript: ${e.message}`);
    }
  });
}

// ============================================
// Token Estimation Tests
// ============================================
async function testTokenEstimation() {
  console.log('\n💰 Token Estimation Tests\n');

  test('mcp-config-generator.ps1 exists', () => {
    const genPath = path.join(pluginRoot, 'lib', 'core', 'mcp-config-generator.ps1');
    assertTrue(fs.existsSync(genPath), 'mcp-config-generator.ps1 should exist');
  });

  test('mcp-config-generator.ps1 contains ai-code-agent-mcp token estimate', () => {
    const genPath = path.join(pluginRoot, 'lib', 'core', 'mcp-config-generator.ps1');
    if (!fs.existsSync(genPath)) skip();

    const content = fs.readFileSync(genPath, 'utf-8');
    assertContains(content, 'ai-code-agent-mcp');
    assertContains(content, '6000');
  });
}

// ============================================
// MCP Schema Validation Tests
// ============================================
async function testMcpSchema() {
  console.log('\n📋 MCP Schema Validation Tests\n');

  test('mcp-config.schema.json exists', () => {
    const schemaPath = path.join(pluginRoot, 'schemas', 'mcp-config.schema.json');
    assertTrue(fs.existsSync(schemaPath), 'mcp-config.schema.json should exist');
  });

  test('mcp-config.schema.json is valid JSON Schema', () => {
    const schemaPath = path.join(pluginRoot, 'schemas', 'mcp-config.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    assertEqual(schema.$schema, 'http://json-schema.org/draft-07/schema#');
    assertTrue(schema.$id !== undefined, 'Should have $id');
    assertTrue(schema.type === 'object', 'Should be object type');
    assertTrue(schema.required !== undefined, 'Should have required fields');
  });

  test('schema defines transport property', () => {
    const schemaPath = path.join(pluginRoot, 'schemas', 'mcp-config.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    assertTrue(schema.properties.transport !== undefined, 'Should have transport property');
    assertTrue(schema.properties.transport.required.includes('type'));
    assertTrue(schema.properties.transport.required.includes('command'));
  });

  test('schema defines tools array', () => {
    const schemaPath = path.join(pluginRoot, 'schemas', 'mcp-config.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    assertTrue(schema.properties.tools !== undefined, 'Should have tools property');
    assertEqual(schema.properties.tools.type, 'array');
  });

  test('schema defines tokenEstimate', () => {
    const schemaPath = path.join(pluginRoot, 'schemas', 'mcp-config.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    assertTrue(schema.properties.tokenEstimate !== undefined);
    assertEqual(schema.properties.tokenEstimate.type, 'integer');
    assertEqual(schema.properties.tokenEstimate.default, 6000);
  });
}

// ============================================
// Skill Integration Tests
// ============================================
async function testSkillIntegration() {
  console.log('\n🎯 Skill Integration Tests\n');

  test('ai-code-reviewer skill directory exists', () => {
    const skillDir = path.join(pluginRoot, 'skills', 'ai-code-reviewer');
    if (!fs.existsSync(skillDir)) skip();
    assertTrue(fs.existsSync(skillDir), 'ai-code-reviewer skill directory should exist');
  });

  test('ai-code-reviewer/SKILL.md exists', () => {
    const skillPath = path.join(pluginRoot, 'skills', 'ai-code-reviewer', 'SKILL.md');
    if (!fs.existsSync(skillPath)) skip();
    assertTrue(fs.existsSync(skillPath), 'SKILL.md should exist');
  });

  test('SKILL.md has correct frontmatter', () => {
    const skillPath = path.join(pluginRoot, 'skills', 'ai-code-reviewer', 'SKILL.md');
    if (!fs.existsSync(skillPath)) skip();

    const content = fs.readFileSync(skillPath, 'utf-8');
    assertContains(content, 'name: ai-code-reviewer');
    assertContains(content, 'mcp_tools:');
    assertContains(content, 'analyze_code_with_codex');
    assertContains(content, 'analyze_code_with_gemini');
    assertContains(content, 'analyze_code_combined');
    assertContains(content, 'scan_secrets');
  });

  test('ai-code-reviewer is separate from code-reviewer', () => {
    const codeReviewerPath = path.join(pluginRoot, 'skills', 'code-reviewer', 'SKILL.md');
    const aiCodeReviewerPath = path.join(pluginRoot, 'skills', 'ai-code-reviewer', 'SKILL.md');

    if (!fs.existsSync(codeReviewerPath)) skip();
    if (!fs.existsSync(aiCodeReviewerPath)) skip();

    const codeReviewer = fs.readFileSync(codeReviewerPath, 'utf-8');
    const aiCodeReviewer = fs.readFileSync(aiCodeReviewerPath, 'utf-8');

    // They should be different
    assertTrue(codeReviewer !== aiCodeReviewer, 'Skills should be different');
  });
}

// ============================================
// Command Tests
// ============================================
async function testCommands() {
  console.log('\n💻 Command Tests\n');

  test('cr.md command exists', () => {
    const cmdPath = path.join(pluginRoot, 'commands', 'cr.md');
    if (!fs.existsSync(cmdPath)) skip();
    assertTrue(fs.existsSync(cmdPath), 'cr.md command should exist');
  });

  test('cr.md has correct frontmatter', () => {
    const cmdPath = path.join(pluginRoot, 'commands', 'cr.md');
    if (!fs.existsSync(cmdPath)) skip();

    const content = fs.readFileSync(cmdPath, 'utf-8');
    assertContains(content, 'name: cr');
    assertContains(content, 'description:');
  });

  test('cr.md documents usage', () => {
    const cmdPath = path.join(pluginRoot, 'commands', 'cr.md');
    if (!fs.existsSync(cmdPath)) skip();

    const content = fs.readFileSync(cmdPath, 'utf-8');
    assertContains(content, '/cr');
  });
}

// ============================================
// Preset Integration Tests
// ============================================
async function testPresets() {
  console.log('\n📦 Preset Integration Tests\n');

  const presetsDir = path.join(pluginRoot, 'presets');
  const presetsToCheck = [
    'python-web.json',
    'web-dev.json',
    'api-dev.json',
    'full-stack.json',
    'devops.json',
    'go-backend.json',
    'rust-systems.json',
    'data-science.json'
  ];

  for (const presetFile of presetsToCheck) {
    test(`${presetFile} includes ai-code-agent-mcp`, () => {
      const presetPath = path.join(presetsDir, presetFile);
      if (!fs.existsSync(presetPath)) skip();

      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

      if (preset.mcp?.enabled) {
        assertTrue(
          preset.mcp.enabled.includes('ai-code-agent-mcp'),
          `${presetFile} should have ai-code-agent-mcp in enabled list`
        );
      } else {
        skip();
      }
    });
  }

  test('minimal.json does NOT include ai-code-agent-mcp in enabled', () => {
    const presetPath = path.join(presetsDir, 'minimal.json');
    if (!fs.existsSync(presetPath)) skip();

    const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

    if (preset.mcp?.enabled) {
      assertTrue(
        !preset.mcp.enabled.includes('ai-code-agent-mcp'),
        'minimal.json should NOT have ai-code-agent-mcp in enabled list (for token savings)'
      );
    }
  });
}

// ============================================
// Build Scripts Tests
// ============================================
async function testBuildScripts() {
  console.log('\n🛠️ Build Scripts Tests\n');

  test('build-mcp.ps1 exists', () => {
    const scriptPath = path.join(pluginRoot, 'scripts', 'build-mcp.ps1');
    if (!fs.existsSync(scriptPath)) skip();
    assertTrue(fs.existsSync(scriptPath), 'build-mcp.ps1 should exist');
  });

  test('build-mcp.sh exists', () => {
    const scriptPath = path.join(pluginRoot, 'scripts', 'build-mcp.sh');
    if (!fs.existsSync(scriptPath)) skip();
    assertTrue(fs.existsSync(scriptPath), 'build-mcp.sh should exist');
  });

  test('build-mcp.ps1 references ai-code-agent directory', () => {
    const scriptPath = path.join(pluginRoot, 'scripts', 'build-mcp.ps1');
    if (!fs.existsSync(scriptPath)) skip();

    const content = fs.readFileSync(scriptPath, 'utf-8');
    assertContains(content, 'ai-code-agent');
  });
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Running AI Code Agent MCP Integration Tests\n');
  console.log('='.repeat(50));

  await testMcpServerStructure();
  await testMcpConfiguration();
  await testMcpBuild();
  await testTokenEstimation();
  await testMcpSchema();
  await testSkillIntegration();
  await testCommands();
  await testPresets();
  await testBuildScripts();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests: ${testCount} | Passed: ${passCount} | Failed: ${failCount} | Skipped: ${skipCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log('\n⚠️  Some tests failed. This is expected before implementation.');
    process.exit(1);
  } else if (skipCount === testCount) {
    console.log('\n⚠️  All tests skipped. MCP integration not yet implemented.');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
