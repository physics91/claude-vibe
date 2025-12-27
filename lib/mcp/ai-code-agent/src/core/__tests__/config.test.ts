/**
 * ConfigManager Tests
 * Tests for configuration loading, merging, and environment overrides
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../config.js';
import { ConfigurationError } from '../error-handler.js';

// Mock cosmiconfig
vi.mock('cosmiconfig', () => ({
  cosmiconfig: vi.fn(() => ({
    search: vi.fn(),
  })),
}));

// Store original env
const originalEnv = { ...process.env };

// Helper to reset environment
const resetEnv = () => {
  // Clear test env vars
  const testVars = [
    'CODE_REVIEW_MCP_LOG_LEVEL',
    'CODEX_ENABLED',
    'CODEX_CLI_PATH',
    'CODEX_TIMEOUT',
    'CODEX_RETRY_ATTEMPTS',
    'CODEX_MODEL',
    'CODEX_SEARCH',
    'CODEX_REASONING_EFFORT',
    'GEMINI_ENABLED',
    'GEMINI_CLI_PATH',
    'GEMINI_TIMEOUT',
    'GEMINI_MODEL',
    'ANALYSIS_MAX_CODE_LENGTH',
    'ANALYSIS_INCLUDE_CONTEXT',
    'CONTEXT_AUTO_DETECT',
    'CONTEXT_ACTIVE_PRESET',
    'WARNINGS_ENABLED',
    'WARNINGS_SHOW_TIPS',
    'LOG_LEVEL',
    'LOG_PRETTY',
    'ENABLE_CACHE',
  ];
  testVars.forEach(v => delete process.env[v]);
};

describe('ConfigManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    ConfigManager.reset();
    resetEnv();

    // Setup default cosmiconfig mock
    const { cosmiconfig } = await import('cosmiconfig');
    (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    });
  });

  afterEach(() => {
    ConfigManager.reset();
    resetEnv();
    Object.assign(process.env, originalEnv);
  });

  describe('load', () => {
    it('should load default configuration', async () => {
      const config = await ConfigManager.load();

      expect(config).toBeDefined();
      expect(config.server.name).toBe('ai-code-agent-mcp');
      expect(config.codex.enabled).toBe(true);
      expect(config.gemini.enabled).toBe(true);
    });

    it('should merge file config with defaults', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: {
            server: { logLevel: 'debug' },
            codex: { timeout: 60000 },
          },
        }),
      });

      const config = await ConfigManager.load();

      expect(config.server.logLevel).toBe('debug');
      expect(config.codex.timeout).toBe(60000);
      // Defaults should still be present
      expect(config.server.name).toBe('ai-code-agent-mcp');
    });

    it('should handle null file config', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({ config: null }),
      });

      const config = await ConfigManager.load();

      expect(config).toBeDefined();
      expect(config.server.name).toBe('ai-code-agent-mcp');
    });

    it('should handle empty search result', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue(null),
      });

      const config = await ConfigManager.load();

      expect(config).toBeDefined();
    });

    it('should create singleton instance', async () => {
      await ConfigManager.load();

      const config1 = ConfigManager.get();
      const config2 = ConfigManager.get();

      expect(config1).toBe(config2);
    });

    it('should throw ConfigurationError on validation failure', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: {
            server: { name: 123 }, // Invalid type
          },
        }),
      });

      await expect(ConfigManager.load()).rejects.toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError on cosmiconfig error', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockRejectedValue(new Error('File read error')),
      });

      await expect(ConfigManager.load()).rejects.toThrow(ConfigurationError);
    });

    it('should rethrow non-Error exceptions', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockRejectedValue('string error'),
      });

      await expect(ConfigManager.load()).rejects.toBe('string error');
    });
  });

  describe('get', () => {
    it('should return config after load', async () => {
      await ConfigManager.load();

      const config = ConfigManager.get();

      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
    });

    it('should throw if not initialized', () => {
      expect(() => ConfigManager.get()).toThrow(ConfigurationError);
      expect(() => ConfigManager.get()).toThrow('Configuration not initialized');
    });
  });

  describe('reset', () => {
    it('should reset singleton instance', async () => {
      await ConfigManager.load();
      expect(() => ConfigManager.get()).not.toThrow();

      ConfigManager.reset();

      expect(() => ConfigManager.get()).toThrow(ConfigurationError);
    });

    it('should allow re-initialization after reset', async () => {
      await ConfigManager.load();
      ConfigManager.reset();

      const config = await ConfigManager.load();

      expect(config).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update configuration at runtime', async () => {
      await ConfigManager.load();

      ConfigManager.update({ server: { logLevel: 'debug' } } as any);

      const config = ConfigManager.get();
      expect(config.server.logLevel).toBe('debug');
    });

    it('should merge updates with existing config', async () => {
      await ConfigManager.load();
      const originalName = ConfigManager.get().server.name;

      ConfigManager.update({ codex: { timeout: 99999 } } as any);

      const config = ConfigManager.get();
      expect(config.codex.timeout).toBe(99999);
      expect(config.server.name).toBe(originalName);
    });

    it('should throw if not initialized', () => {
      expect(() => ConfigManager.update({ server: {} } as any)).toThrow(
        ConfigurationError
      );
      expect(() => ConfigManager.update({ server: {} } as any)).toThrow(
        'Configuration not initialized'
      );
    });

    it('should validate updated config', async () => {
      await ConfigManager.load();

      expect(() =>
        ConfigManager.update({ server: { name: 123 } } as any)
      ).toThrow();
    });
  });

  describe('environment overrides', () => {
    describe('server overrides', () => {
      it('should override log level from CODE_REVIEW_MCP_LOG_LEVEL', async () => {
        process.env.CODE_REVIEW_MCP_LOG_LEVEL = 'debug';

        const config = await ConfigManager.load();

        expect(config.server.logLevel).toBe('debug');
        expect(config.logging.level).toBe('debug');
      });
    });

    describe('codex overrides', () => {
      it('should override CODEX_ENABLED', async () => {
        process.env.CODEX_ENABLED = 'false';

        const config = await ConfigManager.load();

        expect(config.codex.enabled).toBe(false);
      });

      it('should override CODEX_CLI_PATH', async () => {
        process.env.CODEX_CLI_PATH = '/custom/codex';

        const config = await ConfigManager.load();

        expect(config.codex.cliPath).toBe('/custom/codex');
      });

      it('should override CODEX_TIMEOUT', async () => {
        process.env.CODEX_TIMEOUT = '120000';

        const config = await ConfigManager.load();

        expect(config.codex.timeout).toBe(120000);
      });

      it('should override CODEX_RETRY_ATTEMPTS', async () => {
        process.env.CODEX_RETRY_ATTEMPTS = '5';

        const config = await ConfigManager.load();

        expect(config.codex.retryAttempts).toBe(5);
      });

      it('should override CODEX_MODEL', async () => {
        process.env.CODEX_MODEL = 'gpt-4-turbo';

        const config = await ConfigManager.load();

        expect(config.codex.model).toBe('gpt-4-turbo');
      });

      it('should override CODEX_SEARCH', async () => {
        process.env.CODEX_SEARCH = 'false';

        const config = await ConfigManager.load();

        expect(config.codex.search).toBe(false);
      });

      it('should override CODEX_REASONING_EFFORT with valid value', async () => {
        process.env.CODEX_REASONING_EFFORT = 'high';

        const config = await ConfigManager.load();

        expect(config.codex.reasoningEffort).toBe('high');
      });

      it('should ignore invalid CODEX_REASONING_EFFORT', async () => {
        process.env.CODEX_REASONING_EFFORT = 'invalid';

        const config = await ConfigManager.load();

        // Should use default value
        expect(config.codex.reasoningEffort).toBe('xhigh');
      });

      it('should handle all valid reasoning effort values', async () => {
        const validEfforts = ['minimal', 'low', 'medium', 'high', 'xhigh'];

        for (const effort of validEfforts) {
          ConfigManager.reset();
          process.env.CODEX_REASONING_EFFORT = effort;

          const config = await ConfigManager.load();

          expect(config.codex.reasoningEffort).toBe(effort);
        }
      });
    });

    describe('gemini overrides', () => {
      it('should override GEMINI_ENABLED', async () => {
        process.env.GEMINI_ENABLED = 'false';

        const config = await ConfigManager.load();

        expect(config.gemini.enabled).toBe(false);
      });

      it('should override GEMINI_CLI_PATH', async () => {
        process.env.GEMINI_CLI_PATH = '/custom/gemini';

        const config = await ConfigManager.load();

        expect(config.gemini.cliPath).toBe('/custom/gemini');
      });

      it('should override GEMINI_TIMEOUT', async () => {
        process.env.GEMINI_TIMEOUT = '90000';

        const config = await ConfigManager.load();

        expect(config.gemini.timeout).toBe(90000);
      });

      it('should override GEMINI_MODEL', async () => {
        process.env.GEMINI_MODEL = 'gemini-ultra';

        const config = await ConfigManager.load();

        expect(config.gemini.model).toBe('gemini-ultra');
      });
    });

    describe('analysis overrides', () => {
      it('should override ANALYSIS_MAX_CODE_LENGTH', async () => {
        process.env.ANALYSIS_MAX_CODE_LENGTH = '100000';

        const config = await ConfigManager.load();

        expect(config.analysis.maxCodeLength).toBe(100000);
      });

      it('should override ANALYSIS_INCLUDE_CONTEXT', async () => {
        process.env.ANALYSIS_INCLUDE_CONTEXT = 'false';

        const config = await ConfigManager.load();

        expect(config.analysis.includeContext).toBe(false);
      });
    });

    describe('context overrides', () => {
      it('should override CONTEXT_AUTO_DETECT', async () => {
        process.env.CONTEXT_AUTO_DETECT = 'false';

        const config = await ConfigManager.load();

        expect(config.context.autoDetect).toBe(false);
      });

      it('should override CONTEXT_ACTIVE_PRESET', async () => {
        process.env.CONTEXT_ACTIVE_PRESET = 'react-web';

        const config = await ConfigManager.load();

        expect(config.context.activePreset).toBe('react-web');
      });
    });

    describe('warnings overrides', () => {
      it('should override WARNINGS_ENABLED', async () => {
        process.env.WARNINGS_ENABLED = 'false';

        const config = await ConfigManager.load();

        expect(config.warnings.enabled).toBe(false);
      });

      it('should override WARNINGS_SHOW_TIPS', async () => {
        process.env.WARNINGS_SHOW_TIPS = 'false';

        const config = await ConfigManager.load();

        expect(config.warnings.showTips).toBe(false);
      });
    });

    describe('logging overrides', () => {
      it('should override LOG_LEVEL', async () => {
        process.env.LOG_LEVEL = 'warn';

        const config = await ConfigManager.load();

        expect(config.logging.level).toBe('warn');
      });

      it('should override LOG_PRETTY', async () => {
        process.env.LOG_PRETTY = 'true';

        const config = await ConfigManager.load();

        expect(config.logging.pretty).toBe(true);
      });
    });

    describe('cache overrides', () => {
      it('should override ENABLE_CACHE', async () => {
        process.env.ENABLE_CACHE = 'false';

        const config = await ConfigManager.load();

        expect(config.cache.enabled).toBe(false);
      });
    });

    describe('multiple overrides', () => {
      it('should apply multiple environment overrides', async () => {
        process.env.CODEX_ENABLED = 'false';
        process.env.GEMINI_TIMEOUT = '60000';
        process.env.LOG_LEVEL = 'error';
        process.env.ENABLE_CACHE = 'false';

        const config = await ConfigManager.load();

        expect(config.codex.enabled).toBe(false);
        expect(config.gemini.timeout).toBe(60000);
        expect(config.logging.level).toBe('error');
        expect(config.cache.enabled).toBe(false);
      });
    });
  });

  describe('mergeConfig', () => {
    it('should deep merge nested objects', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: {
            server: { logLevel: 'debug' },
            analysis: { maxFindings: 100 },
          },
        }),
      });

      const config = await ConfigManager.load();

      // Deep merged: new values from file config
      expect(config.server.logLevel).toBe('debug');
      expect(config.analysis.maxFindings).toBe(100);
      // Deep merged: preserved from default
      expect(config.server.name).toBe('ai-code-agent-mcp');
      expect(config.analysis.maxCodeLength).toBe(50000);
    });

    it('should override arrays completely', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: {
            codex: {
              args: ['--custom', '--args'],
            },
          },
        }),
      });

      const config = await ConfigManager.load();

      expect(config.codex.args).toEqual(['--custom', '--args']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object file config', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: {},
        }),
      });

      const config = await ConfigManager.load();

      expect(config).toBeDefined();
      expect(config.server.name).toBe('ai-code-agent-mcp');
    });

    it('should handle non-object file config gracefully', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: 'not an object',
        }),
      });

      const config = await ConfigManager.load();

      // Should use defaults since config is not an object
      expect(config).toBeDefined();
      expect(config.server.name).toBe('ai-code-agent-mcp');
    });

    it('should handle undefined result.config', async () => {
      const { cosmiconfig } = await import('cosmiconfig');
      (cosmiconfig as ReturnType<typeof vi.fn>).mockReturnValue({
        search: vi.fn().mockResolvedValue({
          config: undefined,
        }),
      });

      const config = await ConfigManager.load();

      expect(config).toBeDefined();
    });

    it('should handle boolean env vars correctly', async () => {
      process.env.CODEX_ENABLED = 'true';
      process.env.GEMINI_ENABLED = 'false';

      const config = await ConfigManager.load();

      expect(config.codex.enabled).toBe(true);
      expect(config.gemini.enabled).toBe(false);
    });

    it('should parse integer env vars correctly', async () => {
      process.env.CODEX_TIMEOUT = '5000';
      process.env.ANALYSIS_MAX_CODE_LENGTH = '10000';

      const config = await ConfigManager.load();

      expect(config.codex.timeout).toBe(5000);
      expect(config.analysis.maxCodeLength).toBe(10000);
    });
  });
});
