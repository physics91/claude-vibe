/**
 * Gemini Analysis Service Tests
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
  detectGeminiCLIPath: vi.fn(),
}));

import { execa } from 'execa';
import { detectGeminiCLIPath } from '../../../core/cli-detector.js';
import { GeminiAnalysisService, type GeminiServiceConfig } from '../client.js';
import {
  TimeoutError,
  CLIExecutionError,
  ParseError,
  SecurityError,
  GeminiAnalysisError,
  GeminiTimeoutError,
  GeminiParseError,
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
const createConfig = (overrides: Partial<GeminiServiceConfig> = {}): GeminiServiceConfig => ({
  cliPath: 'gemini',
  timeout: 30000,
  retryAttempts: 1,
  retryDelay: 100,
  model: 'gemini-pro',
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

// Gemini wrapper format
const createWrapperResponse = (response: unknown, error?: string) => ({
  response: response,
  stats: { promptTokens: 100, responseTokens: 50 },
  error: error ?? null,
});

describe('GeminiAnalysisService', () => {
  let service: GeminiAnalysisService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockExeca: MockInstance;
  let mockDetectCLI: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockExeca = vi.mocked(execa);
    mockDetectCLI = vi.mocked(detectGeminiCLIPath);

    // Default mock implementations
    mockDetectCLI.mockResolvedValue({
      path: '/usr/local/bin/gemini',
      source: 'detected',
      exists: true,
    });

    mockExeca.mockResolvedValue({
      stdout: JSON.stringify(createWrapperResponse(createValidAnalysisResponse())),
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
      service = new GeminiAnalysisService(config, mockLogger as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ allowedPaths: expect.any(Array) }),
        'Gemini CLI allowed paths'
      );
    });

    it('should auto-detect CLI path when set to auto', async () => {
      const config = createConfig({ cliPath: 'auto' });
      service = new GeminiAnalysisService(config, mockLogger as any);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDetectCLI).toHaveBeenCalled();
    });

    it('should include config path in whitelist when safe', () => {
      const config = createConfig({ cliPath: '/usr/local/bin/gemini' });
      service = new GeminiAnalysisService(config, mockLogger as any);

      // Find the debug call with allowedPaths
      const pathsCall = mockLogger.debug.mock.calls.find(
        call => call[0]?.allowedPaths !== undefined
      );
      expect(pathsCall).toBeDefined();
      expect(pathsCall![0].allowedPaths).toContain('/usr/local/bin/gemini');
    });

    it('should exclude config path from whitelist when not safe', () => {
      const config = createConfig({ cliPath: '/tmp/malicious/gemini' });
      service = new GeminiAnalysisService(config, mockLogger as any);

      // Find the debug call with allowedPaths
      const pathsCall = mockLogger.debug.mock.calls.find(
        call => call[0]?.allowedPaths !== undefined
      );
      expect(pathsCall).toBeDefined();
      expect(pathsCall![0].allowedPaths).not.toContain('/tmp/malicious/gemini');
    });

    it('should include Google Program Files path on Windows', () => {
      const config = createConfig({ cliPath: 'C:\\Program Files\\Google\\Gemini\\gemini.exe' });
      service = new GeminiAnalysisService(config, mockLogger as any);

      // Find the debug call with allowedPaths
      const pathsCall = mockLogger.debug.mock.calls.find(
        call => call[0]?.allowedPaths !== undefined
      );
      expect(pathsCall).toBeDefined();
      expect(pathsCall![0].allowedPaths).toContain('C:\\Program Files\\Google\\Gemini\\gemini.exe');
    });
  });

  describe('analyzeCode', () => {
    beforeEach(() => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);
    });

    it('should analyze code successfully', async () => {
      const result = await service.analyzeCode({
        prompt: 'Review this code: const x = 1;',
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('gemini');
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
      service = new GeminiAnalysisService(configWithNoTimeout, mockLogger as any);

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
        stdout: JSON.stringify(createWrapperResponse(multiSeverityResponse)),
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
      it('should throw GeminiTimeoutError on timeout', async () => {
        const timeoutError = new Error('Timed out');
        (timeoutError as any).timedOut = true;
        mockExeca.mockRejectedValueOnce(timeoutError);

        await expect(
          service.analyzeCode({ prompt: 'const x = 1;' })
        ).rejects.toThrow(GeminiTimeoutError);
      });

      it('should throw GeminiAnalysisError on CLI exit code error', async () => {
        const exitCodeError = new Error('CLI failed');
        (exitCodeError as any).exitCode = 1;
        (exitCodeError as any).stderr = 'Error output';
        (exitCodeError as any).stdout = '';
        mockExeca.mockRejectedValueOnce(exitCodeError);

        await expect(
          service.analyzeCode({ prompt: 'const x = 1;' })
        ).rejects.toThrow(GeminiAnalysisError);
      });

      it('should throw SecurityError when CLI path is not in whitelist', async () => {
        await expect(
          service.analyzeCode({
            prompt: 'const x = 1;',
            options: { cliPath: '/tmp/evil/gemini' },
          })
        ).rejects.toThrow(SecurityError);
      });

      it('should return raw output on invalid JSON response', async () => {
        mockExeca.mockResolvedValueOnce({
          stdout: 'not valid json at all',
          stderr: '',
          exitCode: 0,
        } as any);

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
      service = new GeminiAnalysisService(createConfig({ model: 'gemini-pro' }), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--model');
      expect(args).toContain('gemini-pro');
    });

    it('should include output format json', async () => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
    });

    it('should include user-provided args', async () => {
      service = new GeminiAnalysisService(
        createConfig({ args: ['--custom-arg', 'value'] }),
        mockLogger as any
      );

      await service.analyzeCode({ prompt: 'test' });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain('--custom-arg');
      expect(args).toContain('value');
    });
  });

  describe('parseResponse', () => {
    beforeEach(() => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);
    });

    it('should parse direct JSON output', async () => {
      const response = createValidAnalysisResponse();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(response),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
      expect(result.overallAssessment).toBe(response.overallAssessment);
    });

    it('should parse wrapper format with object response', async () => {
      const response = createValidAnalysisResponse();
      const wrapper = createWrapperResponse(response);

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(wrapper),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
    });

    it('should parse wrapper format with string response', async () => {
      const response = createValidAnalysisResponse();
      const wrapper = createWrapperResponse(JSON.stringify(response));

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(wrapper),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
    });

    it('should parse wrapper with markdown code block in response', async () => {
      const response = createValidAnalysisResponse();
      const wrapper = createWrapperResponse('```json\n' + JSON.stringify(response) + '\n```');

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(wrapper),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
      expect(result.findings).toEqual(response.findings);
    });

    it('should handle wrapper with error field', async () => {
      const wrapper = createWrapperResponse(null, 'API rate limit exceeded');

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(wrapper),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(result.overallAssessment).toContain('Gemini error');
    });

    it('should handle wrapper with null response', async () => {
      const wrapper = createWrapperResponse(null);

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(wrapper),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(result.overallAssessment).toContain('response is null');
    });

    it('should handle empty output', async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(false);
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
      expect(result.overallAssessment).toContain('Schema validation failed');
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
        stdout: JSON.stringify(createWrapperResponse(response)),
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
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);
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

    it('should set GEMINI_MODEL environment variable', async () => {
      service = new GeminiAnalysisService(createConfig({ model: 'gemini-pro' }), mockLogger as any);

      await service.analyzeCode({ prompt: 'test' });

      expect(mockExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ GEMINI_MODEL: 'gemini-pro' }),
        })
      );
    });

    it('should use stderr when stdout is empty', async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: '',
        stderr: JSON.stringify(createWrapperResponse(createValidAnalysisResponse())),
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({ prompt: 'test' });

      expect(result.success).toBe(true);
    });

    describe('error handling', () => {
      it('should throw TimeoutError on timeout', async () => {
        const timeoutError = new Error('Timeout');
        (timeoutError as any).timedOut = true;
        mockExeca.mockRejectedValueOnce(timeoutError);

        await expect(service.analyzeCode({ prompt: 'test' })).rejects.toThrow(GeminiTimeoutError);
      });

      it('should throw CLIExecutionError on non-zero exit code', async () => {
        const exitError = new Error('Exited');
        (exitError as any).exitCode = 1;
        (exitError as any).stderr = 'Some error';
        (exitError as any).stdout = '';
        mockExeca.mockRejectedValueOnce(exitError);

        await expect(service.analyzeCode({ prompt: 'test' })).rejects.toThrow(GeminiAnalysisError);
      });
    });
  });

  describe('CLI path validation', () => {
    it('should validate CLI path against whitelist', async () => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);

      await expect(
        service.analyzeCode({
          prompt: 'test',
          options: { cliPath: '/evil/path/gemini' },
        })
      ).rejects.toThrow(SecurityError);

      expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
    });

    it('should allow whitelisted paths', async () => {
      service = new GeminiAnalysisService(createConfig({ cliPath: 'gemini' }), mockLogger as any);

      // Should not throw SecurityError
      const result = await service.analyzeCode({ prompt: 'test' });
      expect(result).toBeDefined();
    });

    it('should cache validated paths', async () => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);

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
        path: '/usr/local/bin/gemini',
        source: 'detected',
        exists: true,
      });

      service = new GeminiAnalysisService(createConfig({ cliPath: 'auto' }), mockLogger as any);

      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('/usr/local/bin/gemini');
    });

    it('should return unhealthy when CLI detection fails', async () => {
      mockDetectCLI.mockRejectedValue(new Error('CLI not found'));

      service = new GeminiAnalysisService(createConfig({ cliPath: 'auto' }), mockLogger as any);

      // Wait for async init to fail
      await new Promise(resolve => setTimeout(resolve, 50));

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('failed');
    });
  });

  describe('context resolution', () => {
    beforeEach(() => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);
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

  describe('severity filtering', () => {
    beforeEach(() => {
      service = new GeminiAnalysisService(createConfig(), mockLogger as any);
    });

    it('should filter to high severity only', async () => {
      const response = {
        findings: [
          { title: 'Critical', type: 'security', severity: 'critical', line: null, description: 'a' },
          { title: 'High', type: 'security', severity: 'high', line: null, description: 'b' },
          { title: 'Medium', type: 'style', severity: 'medium', line: null, description: 'c' },
          { title: 'Low', type: 'style', severity: 'low', line: null, description: 'd' },
        ],
        overallAssessment: 'Test',
        recommendations: [],
      };

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(createWrapperResponse(response)),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({
        prompt: 'test',
        options: { severity: 'high' },
      });

      expect(result.findings).toHaveLength(2);
      expect(result.findings.map(f => f.severity)).toEqual(['critical', 'high']);
      expect(result.summary.totalFindings).toBe(2);
    });

    it('should filter to medium severity and above', async () => {
      const response = {
        findings: [
          { title: 'Critical', type: 'security', severity: 'critical', line: null, description: 'a' },
          { title: 'High', type: 'security', severity: 'high', line: null, description: 'b' },
          { title: 'Medium', type: 'style', severity: 'medium', line: null, description: 'c' },
          { title: 'Low', type: 'style', severity: 'low', line: null, description: 'd' },
        ],
        overallAssessment: 'Test',
        recommendations: [],
      };

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(createWrapperResponse(response)),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({
        prompt: 'test',
        options: { severity: 'medium' },
      });

      expect(result.findings).toHaveLength(3);
      expect(result.findings.map(f => f.severity)).toEqual(['critical', 'high', 'medium']);
      expect(result.summary.totalFindings).toBe(3);
    });

    it('should not filter when severity is all', async () => {
      const response = {
        findings: [
          { title: 'Critical', type: 'security', severity: 'critical', line: null, description: 'a' },
          { title: 'Low', type: 'style', severity: 'low', line: null, description: 'd' },
        ],
        overallAssessment: 'Test',
        recommendations: [],
      };

      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify(createWrapperResponse(response)),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await service.analyzeCode({
        prompt: 'test',
        options: { severity: 'all' },
      });

      expect(result.findings).toHaveLength(2);
    });
  });
});
