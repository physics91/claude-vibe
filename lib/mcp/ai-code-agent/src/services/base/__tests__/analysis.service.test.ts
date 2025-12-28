/**
 * BaseAnalysisService Tests
 * Tests for the abstract base class for CLI-based analysis services
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { execa } from 'execa';
import { SecurityError } from '../../../core/error-handler.js';
import type { Logger } from '../../../core/logger.js';
import type { CodeAnalysisParams, AnalysisResult } from '../../../schemas/tools.js';
import type { AnalysisFinding } from '../../../schemas/responses.js';
import { BaseAnalysisService, type BaseServiceConfig } from '../analysis.service.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock logger
const createMockLogger = (): Logger =>
  ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
    logSecurityEvent: vi.fn(),
  }) as unknown as Logger;

// Concrete implementation for testing abstract class
class TestAnalysisService extends BaseAnalysisService {
  protected readonly serviceName = 'codex' as const;
  protected readonly cliExecutableNames = ['test-cli', 'codex'];

  constructor(config: BaseServiceConfig, logger: Logger) {
    super(config, logger);
    this.allowedCLIPaths = ['test-cli', 'codex', '/usr/bin/test-cli', '/usr/local/bin/codex'];
  }

  // Expose protected methods for testing
  public async testInitializeCLIPath(): Promise<void> {
    return this.initializeCLIPath();
  }

  public testGetResolvedCLIPath(): string {
    return this.getResolvedCLIPath();
  }

  public testBuildCLIArgs(options?: Record<string, unknown>): string[] {
    return this.buildCLIArgs(options);
  }

  public async testExecuteCLI(
    prompt: string,
    timeout: number,
    cliPath: string,
    analysisId: string
  ): Promise<string> {
    return this.executeCLI(prompt, timeout, cliPath, analysisId);
  }

  public testParseResponse(output: string, analysisId: string): AnalysisResult {
    return this.parseResponse(output, analysisId);
  }

  public testGenerateAnalysisId(): string {
    return this.generateAnalysisId();
  }

  public testCleanOutput(output: string): string {
    return this.cleanOutput(output);
  }

  public testIsOutputWithinLimits(output: string): boolean {
    return this.isOutputWithinLimits(output);
  }

  public testCalculateSummary(findings: AnalysisFinding[]): ReturnType<typeof this.calculateSummary> {
    return this.calculateSummary(findings);
  }

  public testFilterFindingsBySeverity(
    findings: AnalysisFinding[],
    severity: 'high' | 'medium'
  ): AnalysisFinding[] {
    return this.filterFindingsBySeverity(findings, severity);
  }

  public testCreateRawOutputResult(
    analysisId: string,
    rawOutput: string,
    error?: string
  ): AnalysisResult {
    return this.createRawOutputResult(analysisId, rawOutput, error);
  }

  public async testValidateCLIPath(cliPath: string): Promise<void> {
    return this.validateCLIPath(cliPath);
  }

  public async testResolveContext(
    params: CodeAnalysisParams,
    enableAutoDetect: boolean,
    enableWarnings: boolean
  ) {
    return this.resolveContext(params, enableAutoDetect, enableWarnings);
  }

  public testAddMetadata(
    result: AnalysisResult,
    resolvedContext: any,
    warnings: any[],
    templateId: string,
    enableAutoDetect: boolean,
    startTime: number
  ): void {
    return this.addMetadata(result, resolvedContext, warnings, templateId, enableAutoDetect, startTime);
  }

  // Implement abstract methods
  protected async initializeCLIPath(): Promise<void> {
    this.detectedCLIPath = 'test-cli';
  }

  protected getResolvedCLIPath(): string {
    return this.detectedCLIPath ?? this.config.cliPath;
  }

  protected buildCLIArgs(options?: Record<string, unknown>): string[] {
    return ['--analyze', ...(this.config.args ?? [])];
  }

  protected async executeCLI(
    prompt: string,
    timeout: number,
    cliPath: string,
    analysisId: string
  ): Promise<string> {
    return '{"findings": []}';
  }

  protected parseResponse(output: string, analysisId: string): AnalysisResult {
    return {
      success: true,
      analysisId,
      timestamp: new Date().toISOString(),
      source: 'codex',
      summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      overallAssessment: 'Analysis complete',
      metadata: { analysisDuration: 0 },
    };
  }

  async analyzeCode(params: CodeAnalysisParams): Promise<AnalysisResult> {
    const analysisId = this.generateAnalysisId();
    return this.parseResponse('{}', analysisId);
  }
}

describe('BaseAnalysisService', () => {
  let mockLogger: Logger;
  let defaultConfig: BaseServiceConfig;
  let service: TestAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    defaultConfig = {
      cliPath: 'test-cli',
      timeout: 60000,
      retryAttempts: 3,
      retryDelay: 1000,
    };
    service = new TestAnalysisService(defaultConfig, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should initialize context system modules', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Context system modules initialized')
      );
    });

    it('should use default values for optional config', () => {
      const minimalConfig: BaseServiceConfig = {
        cliPath: 'cli',
        timeout: 30000,
        retryAttempts: 1,
        retryDelay: 500,
      };
      const minimalService = new TestAnalysisService(minimalConfig, mockLogger);
      expect(minimalService).toBeDefined();
    });

    it('should accept full config with context options', () => {
      const fullConfig: BaseServiceConfig = {
        cliPath: 'cli',
        timeout: 30000,
        retryAttempts: 1,
        retryDelay: 500,
        model: 'gpt-4',
        args: ['--verbose'],
        context: {
          defaults: { language: 'typescript' },
          presets: { web: { platform: 'web' } },
          activePreset: 'web',
          allowEnvOverride: false,
          autoDetect: false,
        },
        prompts: {
          defaultTemplate: 'security',
          serviceTemplates: { codex: 'default', gemini: 'default' },
        },
        warnings: {
          enabled: false,
          showTips: false,
          suppressions: ['MISSING_SCOPE'],
        },
      };
      const fullService = new TestAnalysisService(fullConfig, mockLogger);
      expect(fullService).toBeDefined();
    });
  });

  describe('generateAnalysisId', () => {
    it('should generate a valid UUID', () => {
      const id = service.testGenerateAnalysisId();

      // UUID v4 format
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.testGenerateAnalysisId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('cleanOutput', () => {
    it('should strip ANSI codes', () => {
      const input = '\x1b[31mred text\x1b[0m';
      const result = service.testCleanOutput(input);
      expect(result).toBe('red text');
    });

    it('should remove null bytes', () => {
      const input = 'hello\0world';
      const result = service.testCleanOutput(input);
      expect(result).toBe('helloworld');
    });

    it('should trim whitespace', () => {
      const input = '  content  ';
      const result = service.testCleanOutput(input);
      expect(result).toBe('content');
    });

    it('should handle combined cases', () => {
      const input = '  \x1b[32m\0hello\x1b[0m  ';
      const result = service.testCleanOutput(input);
      expect(result).toBe('hello');
    });
  });

  describe('isOutputWithinLimits', () => {
    it('should return true for small output', () => {
      const output = 'small output';
      expect(service.testIsOutputWithinLimits(output)).toBe(true);
    });

    it('should return true for output at limit', () => {
      const output = 'x'.repeat(1024 * 1024); // 1MB
      expect(service.testIsOutputWithinLimits(output)).toBe(true);
    });

    it('should return false for output over limit', () => {
      const output = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1
      expect(service.testIsOutputWithinLimits(output)).toBe(false);
    });
  });

  describe('calculateSummary', () => {
    it('should count findings by severity', () => {
      const findings: AnalysisFinding[] = [
        { severity: 'critical', category: 'security', title: 'Critical 1', description: '' },
        { severity: 'critical', category: 'security', title: 'Critical 2', description: '' },
        { severity: 'high', category: 'security', title: 'High 1', description: '' },
        { severity: 'medium', category: 'performance', title: 'Medium 1', description: '' },
        { severity: 'low', category: 'style', title: 'Low 1', description: '' },
        { severity: 'low', category: 'style', title: 'Low 2', description: '' },
      ];

      const summary = service.testCalculateSummary(findings);

      expect(summary.totalFindings).toBe(6);
      expect(summary.critical).toBe(2);
      expect(summary.high).toBe(1);
      expect(summary.medium).toBe(1);
      expect(summary.low).toBe(2);
    });

    it('should handle empty findings', () => {
      const summary = service.testCalculateSummary([]);

      expect(summary.totalFindings).toBe(0);
      expect(summary.critical).toBe(0);
      expect(summary.high).toBe(0);
      expect(summary.medium).toBe(0);
      expect(summary.low).toBe(0);
    });
  });

  describe('filterFindingsBySeverity', () => {
    const findings: AnalysisFinding[] = [
      { severity: 'critical', category: 'security', title: 'Critical', description: '' },
      { severity: 'high', category: 'security', title: 'High', description: '' },
      { severity: 'medium', category: 'performance', title: 'Medium', description: '' },
      { severity: 'low', category: 'style', title: 'Low', description: '' },
    ];

    it('should filter to high and critical only', () => {
      const filtered = service.testFilterFindingsBySeverity(findings, 'high');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(f => f.severity === 'critical' || f.severity === 'high')).toBe(true);
    });

    it('should filter to medium and above', () => {
      const filtered = service.testFilterFindingsBySeverity(findings, 'medium');

      expect(filtered).toHaveLength(3);
      expect(filtered.some(f => f.severity === 'low')).toBe(false);
    });
  });

  describe('createRawOutputResult', () => {
    it('should create result with raw output', () => {
      const result = service.testCreateRawOutputResult('test-id', 'raw output content');

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe('test-id');
      expect(result.rawOutput).toBe('raw output content');
      expect(result.overallAssessment).toBe('Failed to parse AI response');
    });

    it('should use custom error message', () => {
      const result = service.testCreateRawOutputResult('test-id', 'output', 'Custom error');

      expect(result.overallAssessment).toBe('Custom error');
    });

    it('should truncate long raw output', () => {
      const longOutput = 'x'.repeat(60000);
      const result = service.testCreateRawOutputResult('test-id', longOutput);

      expect(result.rawOutput?.length).toBe(50000);
    });
  });

  describe('validateCLIPath', () => {
    it('should allow whitelisted system PATH executable', async () => {
      await expect(service.testValidateCLIPath('test-cli')).resolves.toBeUndefined();
    });

    it('should reject non-whitelisted executable', async () => {
      await expect(service.testValidateCLIPath('malicious-cli')).rejects.toThrow(SecurityError);
    });

    it('should cache validated paths', async () => {
      await service.testValidateCLIPath('test-cli');
      await service.testValidateCLIPath('test-cli');

      // Second call should use cache and not log again
      expect(mockLogger.logSecurityEvent).not.toHaveBeenCalled();
    });

    it('should validate absolute paths against whitelist', async () => {
      await expect(service.testValidateCLIPath('/usr/bin/test-cli')).resolves.toBeUndefined();
    });

    it('should reject non-whitelisted absolute path', async () => {
      await expect(service.testValidateCLIPath('/tmp/evil-cli')).rejects.toThrow(SecurityError);
    });

    describe('on unix systems', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should resolve PATH executable with which', async () => {
        vi.mocked(execa).mockResolvedValueOnce({
          stdout: '/usr/local/bin/codex',
          stderr: '',
          exitCode: 0,
        } as any);

        await expect(service.testValidateCLIPath('codex')).resolves.toBeUndefined();
      });

      it('should allow whitelisted name even if which resolves to different path', async () => {
        // When command name is explicitly in allowedCLIPaths, it's trusted
        // regardless of where 'which' resolves it (design decision)
        vi.mocked(execa).mockResolvedValueOnce({
          stdout: '/tmp/different/codex',
          stderr: '',
          exitCode: 0,
        } as any);

        await expect(service.testValidateCLIPath('codex')).resolves.toBeUndefined();
      });

      it('should allow if which fails but path is whitelisted', async () => {
        vi.mocked(execa).mockRejectedValueOnce(new Error('which not found'));

        await expect(service.testValidateCLIPath('codex')).resolves.toBeUndefined();
      });
    });

    describe('on windows', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should skip which resolution on windows', async () => {
        await service.testValidateCLIPath('codex');

        expect(execa).not.toHaveBeenCalled();
      });
    });
  });

  describe('resolveContext', () => {
    it('should resolve context with auto-detection enabled', async () => {
      const params: CodeAnalysisParams = {
        prompt: 'const x: string = "test";',
        context: { language: 'typescript' },
      };

      const result = await service.testResolveContext(params, true, true);

      expect(result.resolvedContext).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.templateId).toBeDefined();
    });

    it('should skip auto-detection when disabled', async () => {
      const params: CodeAnalysisParams = {
        prompt: 'test code',
      };

      const result = await service.testResolveContext(params, false, false);

      expect(result.resolvedContext).toBeDefined();
      expect(result.warnings).toEqual([]);
    });

    it('should use preset from options', async () => {
      const configWithPresets: BaseServiceConfig = {
        ...defaultConfig,
        context: {
          presets: {
            security: { threatModel: 'public-api' },
          },
        },
      };
      const serviceWithPresets = new TestAnalysisService(configWithPresets, mockLogger);

      const params: CodeAnalysisParams = {
        prompt: 'test',
        options: { preset: 'security' },
      };

      const result = await serviceWithPresets.testResolveContext(params, false, false);

      expect(result.resolvedContext.threatModel).toBe('public-api');
    });
  });

  describe('addMetadata', () => {
    it('should add metadata to result', () => {
      const result: AnalysisResult = {
        success: true,
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex',
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'OK',
        metadata: { analysisDuration: 0 },
      };

      const resolvedContext = {
        threatModel: 'public-api',
        platform: 'unix',
        language: 'typescript',
      };

      const startTime = Date.now() - 1000; // 1 second ago

      service.testAddMetadata(result, resolvedContext, [], 'default', true, startTime);

      expect(result.metadata.analysisDuration).toBeGreaterThanOrEqual(1000);
      expect(result.metadata.resolvedContext).toEqual({
        threatModel: 'public-api',
        platform: 'unix',
        projectType: undefined,
        language: 'typescript',
        framework: undefined,
        scope: undefined,
        fileName: undefined,
      });
      expect(result.metadata.templateUsed).toBe('default');
      expect(result.metadata.autoDetected).toBe(true);
      expect(result.metadata.warnings).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when CLI is detected', async () => {
      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.message).toContain('CLI available');
    });

    it('should return unhealthy when CLI is not detected', async () => {
      // Create service that fails to detect CLI
      class FailingService extends TestAnalysisService {
        protected async initializeCLIPath(): Promise<void> {
          this.detectedCLIPath = null;
        }
      }

      const failingService = new FailingService(defaultConfig, mockLogger);
      const result = await failingService.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('CLI not detected');
    });

    it('should handle initialization errors', async () => {
      // Create service that throws during init
      class ErrorService extends TestAnalysisService {
        protected async initializeCLIPath(): Promise<void> {
          throw new Error('Init failed');
        }
      }

      const errorService = new ErrorService(defaultConfig, mockLogger);
      const result = await errorService.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Health check failed');
      expect(result.message).toContain('Init failed');
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code and return result', async () => {
      const result = await service.analyzeCode({ prompt: 'test code' });

      expect(result.success).toBe(true);
      expect(result.source).toBe('codex');
      expect(result.analysisId).toBeDefined();
    });
  });
});
