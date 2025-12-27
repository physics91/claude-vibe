/**
 * PromptRegistry Tests
 * Tests for MCP prompt registration and execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptRegistry, type PromptRegistryConfig } from '../registry.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../../core/logger.js';

// Mock logger
const createMockLogger = (): Logger =>
  ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  }) as unknown as Logger;

// Mock MCP server
const createMockServer = () => {
  const promptHandlers = new Map<string, Function>();

  return {
    prompt: vi.fn((name: string, _description: string, _schema: unknown, handler: Function) => {
      promptHandlers.set(name, handler);
    }),
    getPromptHandler: (name: string) => promptHandlers.get(name),
    getRegisteredPrompts: () => Array.from(promptHandlers.keys()),
  };
};

describe('PromptRegistry', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockServer();
    mockLogger = createMockLogger();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer);

      expect(registry).toBeDefined();
    });

    it('should create instance with custom config', () => {
      const config: Partial<PromptRegistryConfig> = {
        enabled: false,
        builtInPrompts: ['security-review'],
      };

      const registry = new PromptRegistry(mockServer as unknown as McpServer, config);

      expect(registry).toBeDefined();
    });

    it('should create instance with logger', () => {
      const registry = new PromptRegistry(
        mockServer as unknown as McpServer,
        undefined,
        mockLogger
      );

      expect(registry).toBeDefined();
    });

    it('should merge partial config with defaults', () => {
      const config: Partial<PromptRegistryConfig> = {
        builtInPrompts: ['security-review', 'performance-review'],
      };

      const registry = new PromptRegistry(mockServer as unknown as McpServer, config);
      registry.registerPrompts();

      // Should only register the two specified prompts
      expect(mockServer.prompt).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerPrompts', () => {
    it('should register all default prompts', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer);

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledTimes(5);
      expect(mockServer.getRegisteredPrompts()).toContain('security-review');
      expect(mockServer.getRegisteredPrompts()).toContain('performance-review');
      expect(mockServer.getRegisteredPrompts()).toContain('style-review');
      expect(mockServer.getRegisteredPrompts()).toContain('general-review');
      expect(mockServer.getRegisteredPrompts()).toContain('bug-detection');
    });

    it('should not register prompts when disabled', () => {
      const registry = new PromptRegistry(
        mockServer as unknown as McpServer,
        { enabled: false },
        mockLogger
      );

      registry.registerPrompts();

      expect(mockServer.prompt).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP Prompts disabled by configuration');
    });

    it('should register only specified prompts', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review', 'bug-detection'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledTimes(2);
      expect(mockServer.getRegisteredPrompts()).toContain('security-review');
      expect(mockServer.getRegisteredPrompts()).toContain('bug-detection');
      expect(mockServer.getRegisteredPrompts()).not.toContain('performance-review');
    });

    it('should log prompt registration with logger', () => {
      const registry = new PromptRegistry(
        mockServer as unknown as McpServer,
        undefined,
        mockLogger
      );

      registry.registerPrompts();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { prompts: expect.any(Array) },
        'Registering MCP prompts'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 5 },
        'MCP prompts registered'
      );
    });

    it('should log debug for each registered prompt', () => {
      const registry = new PromptRegistry(
        mockServer as unknown as McpServer,
        { builtInPrompts: ['security-review'] },
        mockLogger
      );

      registry.registerPrompts();

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered prompt: security-review');
    });

    it('should handle empty builtInPrompts array', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: [],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).not.toHaveBeenCalled();
    });

    it('should ignore unknown prompt names', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['unknown-prompt', 'security-review'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledTimes(1);
      expect(mockServer.getRegisteredPrompts()).toContain('security-review');
    });
  });

  describe('security-review prompt', () => {
    it('should register with correct name and description', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledWith(
        'security-review',
        'Generate a security-focused code review prompt with threat model context',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return prompt message with code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({ code: 'const x = 1;' });

      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: expect.stringContaining('const x = 1;'),
            },
          },
        ],
      });
    });

    it('should include language in prompt when provided', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({
        code: 'const x = 1;',
        language: 'typescript',
      });

      expect(result.messages[0].content.text).toContain('Language: typescript');
    });

    it('should include threat model guidelines', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({
        code: 'const x = 1;',
        threatModel: 'public-api',
      });

      expect(result.messages[0].content.text).toContain('PUBLIC API');
      expect(result.messages[0].content.text).toContain('Threat Model: public-api');
    });

    it('should include platform and framework', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({
        code: 'const x = 1;',
        platform: 'web',
        framework: 'express',
      });

      expect(result.messages[0].content.text).toContain('Platform: web');
      expect(result.messages[0].content.text).toContain('Framework: express');
    });

    it('should handle all threat models', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();
      const handler = mockServer.getPromptHandler('security-review');

      const threatModels = ['local-user-tool', 'internal-service', 'multi-tenant', 'public-api'];

      for (const threatModel of threatModels) {
        const result = await handler!({ code: 'x', threatModel });
        expect(result.messages[0].content.text).toContain('Security Assessment Guidelines');
      }
    });
  });

  describe('performance-review prompt', () => {
    it('should register with correct name and description', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledWith(
        'performance-review',
        'Generate a performance-focused code review prompt',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return prompt message with code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('performance-review');
      const result = await handler!({ code: 'for (let i = 0; i < n; i++) {}' });

      expect(result.messages[0].content.text).toContain('for (let i = 0; i < n; i++) {}');
      expect(result.messages[0].content.text).toContain('Performance Code Review');
    });

    it('should include framework-specific tips', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('performance-review');
      const result = await handler!({
        code: 'const App = () => <div />;',
        framework: 'react',
      });

      expect(result.messages[0].content.text).toContain('React-specific considerations');
      expect(result.messages[0].content.text).toContain('useMemo');
    });

    it('should handle different frameworks', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });
      registry.registerPrompts();
      const handler = mockServer.getPromptHandler('performance-review');

      const frameworks = ['express', 'fastapi', 'nextjs'];

      for (const framework of frameworks) {
        const result = await handler!({ code: 'x', framework });
        expect(result.messages[0].content.text).toContain('Framework-Specific Considerations');
      }
    });

    it('should handle unknown framework gracefully', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('performance-review');
      const result = await handler!({
        code: 'x',
        framework: 'unknown-framework',
      });

      // Should not include framework tips section for unknown framework
      expect(result.messages[0].content.text).not.toContain('Framework-Specific Considerations');
    });
  });

  describe('style-review prompt', () => {
    it('should register with correct name and description', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['style-review'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledWith(
        'style-review',
        'Generate a code style and best practices review prompt',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return prompt message with code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['style-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('style-review');
      const result = await handler!({ code: 'function foo() {}' });

      expect(result.messages[0].content.text).toContain('function foo() {}');
      expect(result.messages[0].content.text).toContain('Code Style Review');
    });

    it('should include language and framework context', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['style-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('style-review');
      const result = await handler!({
        code: 'x',
        language: 'python',
        framework: 'django',
      });

      expect(result.messages[0].content.text).toContain('Language: python');
      expect(result.messages[0].content.text).toContain('Framework: django');
    });

    it('should include style focus areas', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['style-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('style-review');
      const result = await handler!({ code: 'x' });

      expect(result.messages[0].content.text).toContain('Naming Conventions');
      expect(result.messages[0].content.text).toContain('Code Organization');
      expect(result.messages[0].content.text).toContain('Readability');
    });
  });

  describe('general-review prompt', () => {
    it('should register with correct name and description', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledWith(
        'general-review',
        'Generate a general code review prompt with configurable focus areas',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return prompt message with code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('general-review');
      const result = await handler!({ code: 'class Foo {}' });

      expect(result.messages[0].content.text).toContain('class Foo {}');
      expect(result.messages[0].content.text).toContain('Code Review');
    });

    it('should include all focus areas by default', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('general-review');
      const result = await handler!({ code: 'x' });

      expect(result.messages[0].content.text).toContain('Security');
      expect(result.messages[0].content.text).toContain('Performance');
      expect(result.messages[0].content.text).toContain('Style');
      expect(result.messages[0].content.text).toContain('Bugs');
    });

    it('should filter focus areas based on input', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('general-review');
      const result = await handler!({
        code: 'x',
        focus: 'security,performance',
      });

      expect(result.messages[0].content.text).toContain('Security');
      expect(result.messages[0].content.text).toContain('Performance');
      // Should still show focus areas list but filtered
      expect(result.messages[0].content.text).toContain('Focus Areas');
    });

    it('should handle focus with spaces', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('general-review');
      const result = await handler!({
        code: 'x',
        focus: 'security, bugs, style',
      });

      // Should parse correctly even with spaces
      expect(result.messages[0].content.text).toContain('Security');
      expect(result.messages[0].content.text).toContain('Bugs');
      expect(result.messages[0].content.text).toContain('Style');
    });

    it('should include language context', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('general-review');
      const result = await handler!({
        code: 'x',
        language: 'rust',
      });

      expect(result.messages[0].content.text).toContain('Language: rust');
    });
  });

  describe('bug-detection prompt', () => {
    it('should register with correct name and description', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });

      registry.registerPrompts();

      expect(mockServer.prompt).toHaveBeenCalledWith(
        'bug-detection',
        'Generate a bug detection focused prompt',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return prompt message with code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('bug-detection');
      const result = await handler!({ code: 'if (x = 1) {}' });

      expect(result.messages[0].content.text).toContain('if (x = 1) {}');
      expect(result.messages[0].content.text).toContain('Bug Detection');
    });

    it('should include bug detection focus areas', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('bug-detection');
      const result = await handler!({ code: 'x' });

      expect(result.messages[0].content.text).toContain('Logic Errors');
      expect(result.messages[0].content.text).toContain('Null/Undefined');
      expect(result.messages[0].content.text).toContain('Edge Cases');
      expect(result.messages[0].content.text).toContain('Race Conditions');
    });

    it('should include context when provided', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('bug-detection');
      const result = await handler!({
        code: 'x',
        context: 'This function handles user authentication',
      });

      expect(result.messages[0].content.text).toContain(
        'Context: This function handles user authentication'
      );
    });

    it('should include language in code block', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('bug-detection');
      const result = await handler!({
        code: 'def foo(): pass',
        language: 'python',
      });

      expect(result.messages[0].content.text).toContain('```python');
      expect(result.messages[0].content.text).toContain('Language: python');
    });
  });

  describe('prompt schemas', () => {
    it('should pass schema to server.prompt for security-review', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });

      registry.registerPrompts();

      const schemaArg = (mockServer.prompt as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(schemaArg).toHaveProperty('code');
      expect(schemaArg).toHaveProperty('language');
      expect(schemaArg).toHaveProperty('threatModel');
      expect(schemaArg).toHaveProperty('platform');
      expect(schemaArg).toHaveProperty('framework');
    });

    it('should pass schema to server.prompt for performance-review', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['performance-review'],
      });

      registry.registerPrompts();

      const schemaArg = (mockServer.prompt as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(schemaArg).toHaveProperty('code');
      expect(schemaArg).toHaveProperty('language');
      expect(schemaArg).toHaveProperty('framework');
    });

    it('should pass schema to server.prompt for general-review', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['general-review'],
      });

      registry.registerPrompts();

      const schemaArg = (mockServer.prompt as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(schemaArg).toHaveProperty('code');
      expect(schemaArg).toHaveProperty('language');
      expect(schemaArg).toHaveProperty('focus');
    });

    it('should pass schema to server.prompt for bug-detection', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['bug-detection'],
      });

      registry.registerPrompts();

      const schemaArg = (mockServer.prompt as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(schemaArg).toHaveProperty('code');
      expect(schemaArg).toHaveProperty('language');
      expect(schemaArg).toHaveProperty('context');
    });
  });

  describe('without logger', () => {
    it('should work without logger for registerPrompts', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer);

      expect(() => registry.registerPrompts()).not.toThrow();
      expect(mockServer.prompt).toHaveBeenCalledTimes(5);
    });

    it('should work without logger when disabled', () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        enabled: false,
      });

      expect(() => registry.registerPrompts()).not.toThrow();
      expect(mockServer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle code with special characters', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const codeWithSpecialChars = 'const sql = `SELECT * FROM users WHERE id = ${id}`;';
      const result = await handler!({ code: codeWithSpecialChars });

      expect(result.messages[0].content.text).toContain(codeWithSpecialChars);
    });

    it('should handle multiline code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const multilineCode = `function foo() {
  const x = 1;
  return x;
}`;
      const result = await handler!({ code: multilineCode });

      expect(result.messages[0].content.text).toContain(multilineCode);
    });

    it('should handle empty language string', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({
        code: 'x',
        language: '',
      });

      // Empty language should not add Language context
      expect(result.messages[0].content.text).not.toContain('Language:');
    });

    it('should handle undefined optional args', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const result = await handler!({
        code: 'x',
        language: undefined,
        threatModel: undefined,
        platform: undefined,
        framework: undefined,
      });

      expect(result.messages[0].content.text).toContain('Security Code Review');
      expect(result.messages[0].content.text).toContain('```\nx\n```');
    });

    it('should handle very long code', async () => {
      const registry = new PromptRegistry(mockServer as unknown as McpServer, {
        builtInPrompts: ['security-review'],
      });
      registry.registerPrompts();

      const handler = mockServer.getPromptHandler('security-review');
      const longCode = 'x'.repeat(10000);
      const result = await handler!({ code: longCode });

      expect(result.messages[0].content.text).toContain(longCode);
    });
  });
});
