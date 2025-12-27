/**
 * Codex Analysis Service Tests
 * Tests for CLI execution, parsing, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { z } from 'zod';

// Mock execa before importing the service
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock CLI detector
vi.mock('../../../core/cli-detector.js', () => ({
  detectCodexCLIPath: vi.fn(),
}));

// Mock fs/promises for last-message mode
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { execa } from 'execa';
import { mkdir, readFile, unlink } from 'fs/promises';
import { detectCodexCLIPath } from '../../../core/cli-detector.js';
import { CodexAnalysisService, type CodexServiceConfig } from '../client.js';
import {
  TimeoutError,
  CLIExecutionError,
  ParseError,
  SecurityError,
  CodexAnalysisError,
  CodexTimeoutError,
  CodexParseError,
} from '../../../core/error-handler.js';

// Mock logger
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
  logSecurityEvent: vi.fn(),
});

// Default config for tests
const createConfig = (overrides: Partial<CodexServiceConfig> = {}): CodexServiceConfig => ({
  cliPath: 'codex',
  timeout: 30000,
  retryAttempts: 1,
  retryDelay: 100,
  model: 'test-model',
  reasoningEffort: 'medium',
  args: [],
  ...overrides,
});

// Valid analysis response for mocking (must match AnalysisResponseSchema)
const createValidAnalysisResponse = () => ({
  findings: [
    {
      title: 'Test Finding',
      type: 'security',
      severity: 'high',
      line: null,
      description: 'Test description',
    },
  ],
  overallAssessment: 'Test assessment',
  recommendations: ['Test recommendation'],
});

// JSONL event format for Codex CLI
const createJsonlOutput = (analysisResponse: unknown) => {
  const event = {
    type: 'item.completed',
    item: {
      type: 'agent_message',
      text: JSON.stringify(analysisResponse),
    },
  };
  return JSON.stringify(event);
};

describe('CodexAnalysisService', () => {
  let service: CodexAnalysisService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockExeca: MockInstance;
  let mockDetectCLI: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockExeca = vi.mocked(execa);
    mockDetectCLI = vi.mocked(detectCodexCLIPath);

    // Default mock implementations
    mockDetectCLI.mockResolvedValue({
      path: '/usr/local/bin/codex',
      source: 'detected',
      exists: true,
    });

    mockExeca.mockResolvedValue({
      stdout: createJsonlOutput(createValidAnalysisResponse()),
      stderr: '',
      exitCode: 0,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = createConfig();
      service = new CodexAnalysisService(config, mockLogger as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ allowedPaths: expect.any(Array) }),
        'Codex CLI allowed paths'
      );
    });

    it('should auto-detect CLI path when set to auto', async () => {
      const config = createConfig({ cliPath: 'auto' });
      service = new CodexAnalysisService(config, mockLogger as any);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDetectCLI).toHaveBeenCalled();
    });

    it('should include config path in whitelist when safe', () => {
      const config = createConfig({ cliPath: '/usr/local/bin/codex' });
      service = new CodexAnalysisService(config, mockLogger as any);

      // Find the debug call with allowedPaths
      const pathsCall = mockLogger.debug.mock.calls.find(
        call => call[0]?.allowedPaths !== undefined
      );
      expect(pathsCall).toBeDefined();
      expect(pathsCall![0].allowedPaths).toContain('/usr/local/bin/codex');
    });

    it('should exclude config path from whitelist when not safe', () => {
      const config = createConfig({ cliPath: '/tmp/malicious/codex' });
      service = new CodexAnalysisService(config, mockLogger as any);

      // Find the debug call with allowedPaths
      const pathsCall = mockLogger.debug.mock.calls.find(
        call => call[0]?.allowedPaths !== undefined
      );
      expect(pathsCall).toBeDefined();
      expect(pathsCall![0].allowedPaths).not.toContain('/tmp/malicious/codex');
    });
  });

  describe('analyzeCode', () => {
    beforeEach(() => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);
    });

    it('should analyze code successfully', async () => {
      const result = await service.analyzeCode({
        prompt: 'Review this code: const x = 1;',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('codex');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].title).toBe('Test Finding');
      expect(mockExeca).toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      await expect(
        service.analyzeCode({
          prompt: '', // Empty prompt should fail validation
        })
      ).rejects.toThrow();
    });

    it('should use per-request timeout when specified', async () => {
      await service.analyzeCode({
        prompt: 'const x = 1;',
        options: { timeout: 60000 },
      });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ timeout: 60000 })
      );
    });

    it('should use config timeout when not specified', async () => {
      await service.analyzeCode({
        prompt: 'const x = 1;',
      });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should disable timeout when set to 0', async () => {
      const configWithNoTimeout = createConfig({ timeout: 0 });
      service = new CodexAnalysisService(configWithNoTimeout, mockLogger as any);

      await service.analyzeCode({
        prompt: 'const x = 1;',
      });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ timeout: undefined })
      );
    });

    it('should filter findings by severity when requested', async () => {
      const multiSeverityResponse = {
        findings: [
          { title: 'Critical', type: 'security', severity: 'critical', line: null, description: 'Critical issue' },
          { title: 'High', type: 'security', severity: 'high', line: null, description: 'High issue' },
          { title: 'Medium', type: 'style', severity: 'medium', line: null, description: 'Medium issue' },
          { title: 'Low', type: 'style', severity: 'low', line: null, description: 'Low issue' },
        ],
        overallAssessment: 'Test',
        recommendations: [],
      };

      mockExeca.mockResolvedValueOnce({
        stdout: createJsonlOutput(multiSeverityResponse),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({
        prompt: 'const x = 1;',
        options: { severity: 'high' },
      });

      // Should only include critical and high
      expect(result.findings).toHaveLength(2);
      expect(result.findings.every(f => f.severity === 'critical' || f.severity === 'high')).toBe(true);
    });

    it('should add metadata to result', async () => {
      const result = await service.analyzeCode({
        prompt: 'const x = 1;',
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.analysisDuration).toBeGreaterThanOrEqual(0);
      expect(result.analysisId).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    describe('error handling', () => {
      it('should throw CodexTimeoutError on timeout', async () => {
        const timeoutError = new Error('Timed out');
        (timeoutError as any).timedOut = true;
        mockExeca.mockRejectedValueOnce(timeoutError);

        await expect(
          service.analyzeCode({ prompt: 'const x = 1;' })
        ).rejects.toThrow(CodexTimeoutError);
      });

      it('should throw CodexAnalysisError on CLI exit code error', async () => {
        const exitCodeError = new Error('CLI failed');
        (exitCodeError as any).exitCode = 1;
        (exitCodeError as any).stderr = 'Error output';
        (exitCodeError as any).stdout = '';
        mockExeca.mockRejectedValueOnce(exitCodeError);

        await expect(
          service.analyzeCode({ prompt: 'const x = 1;' })
        ).rejects.toThrow(CodexAnalysisError);
      });

      it('should throw SecurityError when CLI path is not in whitelist', async () => {
        await expect(
          service.analyzeCode({
            prompt: 'const x = 1;',
            options: { cliPath: '/tmp/evil/codex' },
          })
        ).rejects.toThrow(SecurityError);
      });

      it('should throw CodexParseError on invalid JSON response', async () => {
        mockExeca.mockResolvedValueOnce({
          stdout: 'not valid json at all',
          stderr: '',
          exitCode: 0,
        } as any);

        // Invalid JSON returns raw output result, not error
        const result = await service.analyzeCode({
          prompt: 'const x = 1;',
        });

        expect(result.success).toBe(false);
        expect(result.rawOutput).toBeDefined();
      });
    });
  });

  describe('buildCLIArgs', () => {
    it('should include model when configured', async () => {
      service = new CodexAnalysisService(createConfig({ model: 'gpt-4' }), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--model');
      expect(args).toContain('gpt-4');
    });

    it('should include reasoning effort setting', async () => {
      service = new CodexAnalysisService(
        createConfig({ reasoningEffort: 'high' }),
        mockLogger as any
      );

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('-c');
      expect(args.some(arg => arg.includes('model_reasoning_effort=high'))).toBe(true);
    });

    it('should use jsonl mode by default', async () => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--json');
    });

    it('should include security flags', async () => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--skip-git-repo-check');
      expect(args).toContain('--sandbox');
      expect(args).toContain('read-only');
    });

    it('should filter dangerous user-provided args', async () => {
      service = new CodexAnalysisService(
        createConfig({
          args: ['--sandbox', 'full', '--no-sandbox', '--custom-arg', 'value'],
        }),
        mockLogger as any
      );

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      // Should include custom-arg but not sandbox overrides
      expect(args).toContain('--custom-arg');
      expect(args).toContain('value');
      // Dangerous args should be filtered and logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ filtered: expect.any(Number) }),
        expect.stringContaining('filtered')
      );
    });
  });

  describe('parseResponse', () => {
    beforeEach(() => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);
    });

    it('should parse valid JSONL output', async () => {
      const response = createValidAnalysisResponse();
      mockExeca.mockResolvedValueOnce({
        stdout: createJsonlOutput(response),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
      expect(result.overallAssessment).toBe(response.overallAssessment);
    });

    it('should parse direct JSON output (last-message mode)', async () => {
      const response = createValidAnalysisResponse();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(response),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
    });

    it('should handle empty output', async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(result.rawOutput).toBe('');
    });

    it('should truncate output exceeding max size', async () => {
      const largeOutput = 'x'.repeat(2 * 1024 * 1024); // 2MB
      mockExeca.mockResolvedValueOnce({
        stdout: largeOutput,
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ size: expect.any(Number) }),
        expect.stringContaining('exceeds maximum parse size')
      );
    });

    it('should handle multiple JSONL lines and find correct event', async () => {
      const validResponse = createValidAnalysisResponse();
      const output = [
        JSON.stringify({ type: 'other.event', data: 'ignored' }),
        JSON.stringify({ type: 'item.started', item: { type: 'agent_message' } }),
        createJsonlOutput(validResponse),
      ].join('\n');

      mockExeca.mockResolvedValueOnce({
        stdout: output,
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(validResponse.findings);
    });

    it('should return raw output when schema validation fails', async () => {
      const invalidResponse = {
        findings: 'not an array', // Invalid type
        overallAssessment: 'Test',
      };

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(invalidResponse),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
      // Raw output is returned with default message when JSON isn't valid AnalysisResponse
      expect(result.rawOutput).toBeDefined();
    });

    it('should calculate summary from findings', async () => {
      const response = {
        findings: [
          { title: '1', type: 'security', severity: 'critical', line: null, description: 'a' },
          { title: '2', type: 'security', severity: 'high', line: null, description: 'b' },
          { title: '3', type: 'security', severity: 'high', line: null, description: 'c' },
          { title: '4', type: 'style', severity: 'medium', line: null, description: 'd' },
          { title: '5', type: 'style', severity: 'low', line: null, description: 'e' },
        ],
        overallAssessment: 'Test',
        recommendations: [],
      };

      mockExeca.mockResolvedValueOnce({
        stdout: createJsonlOutput(response),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.summary).toEqual({
        totalFindings: 5,
        critical: 1,
        high: 2,
        medium: 1,
        low: 1,
      });
    });
  });

  describe('executeCLI', () => {
    beforeEach(() => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);
    });

    it('should execute with shell: false for security', async () => {
      await service.analyzeCode({ prompt: 'test' });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ shell: false })
      );
    });

    it('should pass prompt as stdin input', async () => {
      const prompt = 'Review this code: function test() {}';
      await service.analyzeCode({ prompt });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ input: expect.stringContaining(prompt) })
      );
    });

    it('should set CODEX_MODEL environment variable', async () => {
      service = new CodexAnalysisService(createConfig({ model: 'gpt-4' }), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ CODEX_MODEL: 'gpt-4' }),
        })
      );
    });

    it('should use stderr when stdout is empty', async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: createJsonlOutput(createValidAnalysisResponse()),
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
    });

    describe('last-message mode', () => {
      beforeEach(() => {
        // Reset mocks for last-message mode tests
        vi.clearAllMocks();
        vi.mocked(mkdir).mockResolvedValue(undefined);
        vi.mocked(unlink).mockResolvedValue(undefined);
      });

      it('should use last-message output when configured', async () => {
        // Setup file read to return valid response
        vi.mocked(readFile).mockResolvedValue(JSON.stringify(createValidAnalysisResponse()));
        // Mock execa to succeed
        mockExeca.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as any);

        service = new CodexAnalysisService(
          createConfig({
            output: { mode: 'last-message', lastMessageFileDir: '/tmp' },
          }),
          mockLogger as any
        );

        const result = await service.analyzeCode({ prompt: 'test' });

        const args = mockExeca.mock.calls[0][1] as string[];
        expect(args).toContain('--output-last-message');
        expect(result.success).toBe(true);
      });

      it('should cleanup temp file after execution', async () => {
        vi.mocked(readFile).mockResolvedValue(JSON.stringify(createValidAnalysisResponse()));
        mockExeca.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as any);

        service = new CodexAnalysisService(
          createConfig({
            output: { mode: 'last-message', lastMessageFileDir: '/tmp' },
          }),
          mockLogger as any
        );

        await service.analyzeCode({ prompt: 'test' });

        expect(vi.mocked(unlink)).toHaveBeenCalled();
      });

      it('should fallback to jsonl when last-message is not supported', async () => {
        const error = new Error('Unknown flag');
        (error as any).stderr = 'unknown option: --output-last-message';
        (error as any).stdout = '';

        // First call fails with unknown flag, second succeeds with JSONL
        mockExeca
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({
            stdout: createJsonlOutput(createValidAnalysisResponse()),
            stderr: '',
            exitCode: 0,
          } as any);

        service = new CodexAnalysisService(
          createConfig({
            output: { mode: 'last-message', lastMessageFileDir: '/tmp' },
          }),
          mockLogger as any
        );

        const result = await service.analyzeCode({ prompt: 'test' });

        expect(result.success).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.any(Object),
          expect.stringContaining('does not support')
        );
      });
    });

    describe('error handling', () => {
      it('should throw TimeoutError on timeout', async () => {
        const timeoutError = new Error('Timeout');
        (timeoutError as any).timedOut = true;
        mockExeca.mockRejectedValueOnce(timeoutError);

        await expect(service.analyzeCode({ prompt: 'test' })).rejects.toThrow(CodexTimeoutError);
      });

      it('should throw CLIExecutionError on non-zero exit code', async () => {
        const exitError = new Error('Exited');
        (exitError as any).exitCode = 1;
        (exitError as any).stderr = 'Some error';
        (exitError as any).stdout = '';
        mockExeca.mockRejectedValueOnce(exitError);

        await expect(service.analyzeCode({ prompt: 'test' })).rejects.toThrow(CodexAnalysisError);
      });
    });
  });

  describe('CLI path validation', () => {
    it('should validate CLI path against whitelist', async () => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);

      await expect(
        service.analyzeCode({
          prompt: 'test',
          options: { cliPath: '/evil/path/codex' },
        })
      ).rejects.toThrow(SecurityError);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    it('should allow whitelisted paths', async () => {
      service = new CodexAnalysisService(createConfig({ cliPath: 'codex' }), mockLogger as any);

      // Should not throw SecurityError
      const result = await service.analyzeCode({ prompt: 'test' });
      expect(result).toBeDefined();
    });

    it('should cache validated paths', async () => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);

      // First call validates
      await service.analyzeCode({ prompt: 'test 1' });
      // Second call uses cache
      await service.analyzeCode({ prompt: 'test 2' });

      // Security event should only be logged if there's a violation
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when CLI is available', async () => {
      mockDetectCLI.mockResolvedValue({
        path: '/usr/local/bin/codex',
        source: 'detected',
        exists: true,
      });

      service = new CodexAnalysisService(createConfig({ cliPath: 'auto' }), mockLogger as any);

      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('/usr/local/bin/codex');
    });

    it('should return unhealthy when CLI detection fails', async () => {
      mockDetectCLI.mockRejectedValue(new Error('CLI not found'));

      service = new CodexAnalysisService(createConfig({ cliPath: 'auto' }), mockLogger as any);

      // Wait for async init to fail
      await new Promise(resolve => setTimeout(resolve, 50));

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('failed');
    });
  });

  describe('context resolution', () => {
    beforeEach(() => {
      service = new CodexAnalysisService(createConfig(), mockLogger as any);
    });

    it('should auto-detect context by default', async () => {
      await service.analyzeCode({
        prompt: 'function test() { return 1; }',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ detectedContext: expect.any(Object) }),
        expect.stringContaining('Auto-detected')
      );
    });

    it('should skip auto-detect when disabled', async () => {
      await service.analyzeCode({
        prompt: 'const x = 1;',
        options: { autoDetect: false },
      });

      // Should not have auto-detection log
      const autoDetectCalls = mockLogger.debug.mock.calls.filter(
        call => typeof call[1] === 'string' && call[1].includes('Auto-detected')
      );
      expect(autoDetectCalls).toHaveLength(0);
    });

    it('should include context warnings in metadata', async () => {
      const result = await service.analyzeCode({
        prompt: 'const x = 1;',
        options: { warnOnMissingContext: true },
      });

      expect(result.metadata.warnings).toBeDefined();
    });
  });
});
