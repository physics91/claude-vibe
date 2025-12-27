/**
 * Unit tests for CLI Detector (Security-focused)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({
    exitCode: 1,
    stdout: '',
    stderr: '',
  }),
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

describe('CLI Detector', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.CODEX_CLI_PATH;
    delete process.env.GEMINI_CLI_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isConfigPathSafe (Security Tests)', () => {
    it('should allow simple command names', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Simple command name should be allowed
      const result = await detectCodexCLIPath('codex', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('codex');
    });

    it('should allow .cmd suffix on Windows command names', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('codex.cmd', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('codex.cmd');
    });

    it('should reject relative paths with directory traversal', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Path with parent directory traversal should be rejected
      const result = await detectCodexCLIPath('../malicious/codex', mockLogger as any);
      expect(result.source).not.toBe('config');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should reject paths outside safe directories', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Unsafe path should trigger warning and fall back
      const result = await detectCodexCLIPath('/tmp/malicious/codex', mockLogger as any);
      expect(result.source).not.toBe('config');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/tmp/malicious/codex' }),
        expect.stringContaining('rejected for security')
      );
    });

    it('should allow paths in /usr/local/bin/', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('/usr/local/bin/codex', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('/usr/local/bin/codex');
    });

    it('should allow paths in /usr/bin/', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('/usr/bin/codex', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('/usr/bin/codex');
    });

    it('should allow paths in /opt/', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('/opt/codex/bin/codex', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('/opt/codex/bin/codex');
    });

    it('should allow paths in /home/', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('/home/user/.local/bin/codex', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('/home/user/.local/bin/codex');
    });

    it('should allow Windows Program Files paths', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath(
        'C:\\Program Files\\codex\\codex.exe',
        mockLogger as any
      );
      expect(result.source).toBe('config');
      expect(result.path).toBe('C:\\Program Files\\codex\\codex.exe');
    });

    it('should allow Windows Program Files (x86) paths', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath(
        'C:\\Program Files (x86)\\codex\\codex.exe',
        mockLogger as any
      );
      expect(result.source).toBe('config');
      expect(result.path).toBe('C:\\Program Files (x86)\\codex\\codex.exe');
    });

    it('should reject D: drive paths (not in safe list)', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('D:\\tools\\codex.exe', mockLogger as any);
      expect(result.source).not.toBe('config');
    });

    it('should reject command injection attempts', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Command injection attempt
      const result = await detectCodexCLIPath('codex; rm -rf /', mockLogger as any);
      expect(result.source).not.toBe('config');
    });

    it('should reject pipe characters in path', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('codex | malicious', mockLogger as any);
      expect(result.source).not.toBe('config');
    });

    it('should reject backtick command substitution', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('`malicious`', mockLogger as any);
      expect(result.source).not.toBe('config');
    });
  });

  describe('Environment Variable Priority', () => {
    it('should prioritize CODEX_CLI_PATH environment variable', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      process.env.CODEX_CLI_PATH = '/custom/path/codex';

      const result = await detectCodexCLIPath('/some/config/path', mockLogger as any);
      expect(result.source).toBe('env');
      expect(result.path).toBe('/custom/path/codex');
    });

    it('should prioritize GEMINI_CLI_PATH environment variable', async () => {
      const { detectGeminiCLIPath } = await import('../cli-detector.js');

      process.env.GEMINI_CLI_PATH = '/custom/path/gemini';

      const result = await detectGeminiCLIPath('/some/config/path', mockLogger as any);
      expect(result.source).toBe('env');
      expect(result.path).toBe('/custom/path/gemini');
    });

    it('should use config path when env variable is not set', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Ensure env is not set
      delete process.env.CODEX_CLI_PATH;

      const result = await detectCodexCLIPath('/usr/local/bin/codex', mockLogger as any);
      expect(result.source).toBe('config');
    });
  });

  describe('Auto-detection Mode', () => {
    it('should trigger auto-detection when config is "auto"', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath('auto', mockLogger as any);
      // Should skip config source and try detection
      expect(result.source).not.toBe('config');
    });

    it('should fallback to default when no CLI found', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.source).toBe('default');
      expect(result.exists).toBe(false);
    });
  });

  describe('detectCLIPath wrapper', () => {
    it('should route to detectCodexCLIPath for codex', async () => {
      const { detectCLIPath } = await import('../cli-detector.js');

      process.env.CODEX_CLI_PATH = '/test/codex';

      const result = await detectCLIPath('codex', undefined, mockLogger as any);
      expect(result.path).toBe('/test/codex');
    });

    it('should route to detectGeminiCLIPath for gemini', async () => {
      const { detectCLIPath } = await import('../cli-detector.js');

      process.env.GEMINI_CLI_PATH = '/test/gemini';

      const result = await detectCLIPath('gemini', undefined, mockLogger as any);
      expect(result.path).toBe('/test/gemini');
    });
  });

  describe('Path Existence Checking', () => {
    it('should report exists: true for existing paths', async () => {
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Mock existsSync to return true
      vi.mocked(existsSync).mockReturnValue(true);

      process.env.CODEX_CLI_PATH = '/existing/codex';

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.exists).toBe(true);
    });

    it('should report exists: false for non-existing paths', async () => {
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Mock existsSync to return false
      vi.mocked(existsSync).mockReturnValue(false);

      process.env.CODEX_CLI_PATH = '/non-existing/codex';

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.exists).toBe(false);
    });

    it('should handle existsSync throwing errors', async () => {
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // Mock existsSync to throw
      vi.mocked(existsSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      process.env.CODEX_CLI_PATH = '/protected/codex';

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      // Should return false when check throws
      expect(result.exists).toBe(false);
    });
  });

  describe('PATH Search (which/where)', () => {
    it('should find CLI in system PATH', async () => {
      const { execa } = await import('execa');
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      // No env or config
      delete process.env.CODEX_CLI_PATH;

      // existsSync returns false for default paths
      vi.mocked(existsSync).mockReturnValue(false);

      // which/where finds the CLI
      vi.mocked(execa).mockResolvedValue({
        exitCode: 0,
        stdout: '/usr/local/bin/codex\n',
        stderr: '',
        command: 'which codex',
        escapedCommand: 'which codex',
        failed: false,
        timedOut: false,
        killed: false,
      } as any);

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.source).toBe('which');
      expect(result.path).toBe('/usr/local/bin/codex');
    });

    it('should handle which/where timeout', async () => {
      const { execa } = await import('execa');
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      delete process.env.CODEX_CLI_PATH;
      vi.mocked(existsSync).mockReturnValue(false);

      // which/where times out
      vi.mocked(execa).mockRejectedValue(new Error('Timeout'));

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.source).toBe('default');
    });

    it('should handle which/where not finding command', async () => {
      const { execa } = await import('execa');
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      delete process.env.CODEX_CLI_PATH;
      vi.mocked(existsSync).mockReturnValue(false);

      // which/where returns non-zero exit
      vi.mocked(execa).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'codex not found',
      } as any);

      const result = await detectCodexCLIPath(undefined, mockLogger as any);
      expect(result.source).toBe('default');
    });
  });

  describe('Platform-specific Defaults', () => {
    it('should use .cmd suffix on Windows', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      try {
        const result = await detectCodexCLIPath(undefined, mockLogger as any);
        if (result.source === 'default') {
          expect(result.path).toContain('.cmd');
        }
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });

  describe('Gemini-specific Tests', () => {
    it('should use correct env variable for Gemini', async () => {
      const { detectGeminiCLIPath } = await import('../cli-detector.js');

      process.env.GEMINI_CLI_PATH = '/path/to/gemini';

      const result = await detectGeminiCLIPath(undefined, mockLogger as any);
      expect(result.source).toBe('env');
      expect(result.path).toBe('/path/to/gemini');
    });

    it('should allow gemini.cmd command name', async () => {
      const { detectGeminiCLIPath } = await import('../cli-detector.js');

      const result = await detectGeminiCLIPath('gemini.cmd', mockLogger as any);
      expect(result.source).toBe('config');
      expect(result.path).toBe('gemini.cmd');
    });

    it('should reject unsafe gemini paths', async () => {
      const { detectGeminiCLIPath } = await import('../cli-detector.js');

      const result = await detectGeminiCLIPath('/tmp/unsafe/gemini', mockLogger as any);
      expect(result.source).not.toBe('config');
    });
  });

  describe('Logging', () => {
    it('should log debug message for env source', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      process.env.CODEX_CLI_PATH = '/env/codex';

      await detectCodexCLIPath(undefined, mockLogger as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/env/codex', source: 'env' }),
        expect.any(String)
      );
    });

    it('should log warning for rejected unsafe config paths', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      await detectCodexCLIPath('/unsafe/path/codex', mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/unsafe/path/codex' }),
        expect.stringContaining('rejected for security')
      );
    });

    it('should log info for detected paths', async () => {
      const { existsSync } = await import('fs');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      delete process.env.CODEX_CLI_PATH;

      // Mock first default path to exist
      let callCount = 0;
      vi.mocked(existsSync).mockImplementation(() => {
        callCount++;
        return callCount === 1; // First call returns true
      });

      await detectCodexCLIPath(undefined, mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'detected' }),
        expect.stringContaining('detected')
      );
    });

    it('should log warning for fallback paths', async () => {
      const { existsSync } = await import('fs');
      const { execa } = await import('execa');
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      delete process.env.CODEX_CLI_PATH;
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execa).mockResolvedValue({ exitCode: 1, stdout: '' } as any);

      await detectCodexCLIPath(undefined, mockLogger as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'default' }),
        expect.stringContaining('not found')
      );
    });

    it('should work without logger', async () => {
      const { detectCodexCLIPath } = await import('../cli-detector.js');

      process.env.CODEX_CLI_PATH = '/test/codex';

      // Should not throw when logger is undefined
      const result = await detectCodexCLIPath(undefined, undefined);
      expect(result.path).toBe('/test/codex');
    });
  });
});
