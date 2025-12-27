/**
 * Combined Analysis Orchestrator Tests
 * Tests for parallel/sequential analysis with aggregation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import PQueue from 'p-queue';
import {
  CombinedAnalysisOrchestrator,
  type CombinedHandlerDependencies,
} from '../combined-handler.js';
import { AnalysisStatusStore } from '../../../services/analysis-status/store.js';

// Mock logger
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// Mock config
const createMockConfig = (overrides = {}) => ({
  server: { name: 'test', version: '1.0.0', port: 3000 },
  codex: {
    enabled: true,
    model: 'codex-model',
    reasoningEffort: 'medium',
    search: false,
    args: ['--codex-arg'],
  },
  gemini: {
    enabled: true,
    model: 'gemini-model',
    args: ['--gemini-arg'],
  },
  analysis: {
    maxCodeLength: 50000,
    maxFindings: 50,
    maxCodeSnippetLength: 500,
    maxOutputChars: 100000,
    defaultTimeout: 30000,
  },
  secretScanning: {
    enabled: false,
  },
  prompts: {
    defaultTemplate: 'default',
    serviceTemplates: {},
  },
  ...overrides,
});

// Mock analysis result
const createMockAnalysisResult = (source: 'codex' | 'gemini', findings = []) => ({
  analysisId: `${source}-123`,
  timestamp: new Date().toISOString(),
  source,
  success: true,
  summary: {
    totalFindings: findings.length,
    critical: findings.filter((f: any) => f.severity === 'critical').length,
    high: findings.filter((f: any) => f.severity === 'high').length,
    medium: findings.filter((f: any) => f.severity === 'medium').length,
    low: findings.filter((f: any) => f.severity === 'low').length,
  },
  findings,
  overallAssessment: `${source} assessment`,
  recommendations: [`${source} recommendation`],
  metadata: { analysisDuration: 100 },
});

// Mock aggregated result
const createMockAggregatedResult = (includeIndividual = false) => ({
  analysisId: 'aggregated-123',
  timestamp: new Date().toISOString(),
  sources: ['codex', 'gemini'],
  success: true,
  summary: {
    totalFindings: 2,
    critical: 0,
    high: 1,
    medium: 1,
    low: 0,
    consensus: 75,
  },
  findings: [
    {
      title: 'Finding 1',
      type: 'security',
      severity: 'high',
      line: null,
      description: 'High severity issue',
      sources: ['codex', 'gemini'],
      confidence: 'high',
    },
    {
      title: 'Finding 2',
      type: 'style',
      severity: 'medium',
      line: null,
      description: 'Medium severity issue',
      sources: ['codex'],
      confidence: 'medium',
    },
  ],
  overallAssessment: 'Combined assessment',
  recommendations: ['Combined recommendation'],
  metadata: { analysisDuration: 200 },
  ...(includeIndividual
    ? {
        individualAnalyses: {
          codex: createMockAnalysisResult('codex'),
          gemini: createMockAnalysisResult('gemini'),
        },
      }
    : {}),
});

// Create mock dependencies
const createMockDeps = (overrides: Partial<CombinedHandlerDependencies> = {}): CombinedHandlerDependencies => {
  const codexResult = createMockAnalysisResult('codex', [
    { title: 'Codex Finding', type: 'security', severity: 'high', line: null, description: 'Issue' },
  ]);
  const geminiResult = createMockAnalysisResult('gemini', [
    { title: 'Gemini Finding', type: 'style', severity: 'medium', line: null, description: 'Issue' },
  ]);

  return {
    config: createMockConfig() as any,
    logger: createMockLogger() as any,
    codexService: {
      analyzeCode: vi.fn().mockResolvedValue(codexResult),
    } as any,
    geminiService: {
      analyzeCode: vi.fn().mockResolvedValue(geminiResult),
    } as any,
    aggregator: {
      mergeAnalyses: vi.fn().mockReturnValue(createMockAggregatedResult()),
    } as any,
    cacheService: null,
    secretScanner: {
      scan: vi.fn().mockReturnValue([]),
      toAnalysisFindings: vi.fn().mockReturnValue([]),
    } as any,
    analysisStatusStore: AnalysisStatusStore.getInstance(),
    codexQueue: new PQueue({ concurrency: 1 }),
    geminiQueue: new PQueue({ concurrency: 1 }),
    ...overrides,
  };
};

describe('CombinedAnalysisOrchestrator', () => {
  let orchestrator: CombinedAnalysisOrchestrator;
  let mockDeps: CombinedHandlerDependencies;
  let statusStore: AnalysisStatusStore;

  beforeEach(() => {
    vi.clearAllMocks();
    statusStore = AnalysisStatusStore.getInstance();
    statusStore.clear();
    mockDeps = createMockDeps();
    orchestrator = new CombinedAnalysisOrchestrator(mockDeps);
  });

  describe('execute', () => {
    it('should execute combined analysis successfully', async () => {
      const result = await orchestrator.execute({
        prompt: 'Review this code: const x = 1;',
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Analysis');
      expect(mockDeps.codexService.analyzeCode).toHaveBeenCalled();
      expect(mockDeps.geminiService.analyzeCode).toHaveBeenCalled();
      expect(mockDeps.aggregator.mergeAnalyses).toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      await expect(
        orchestrator.execute({
          prompt: '', // Empty prompt should fail
        })
      ).rejects.toThrow();
    });

    it('should create analysis status entry', async () => {
      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      const allIds = statusStore.getAllIds();
      expect(allIds.length).toBeGreaterThan(0);

      const status = statusStore.get(allIds[0]);
      expect(status?.source).toBe('combined');
    });

    it('should execute in parallel by default', async () => {
      const callOrder: string[] = [];

      mockDeps.codexService.analyzeCode = vi.fn().mockImplementation(async () => {
        callOrder.push('codex-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push('codex-end');
        return createMockAnalysisResult('codex');
      });

      mockDeps.geminiService.analyzeCode = vi.fn().mockImplementation(async () => {
        callOrder.push('gemini-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push('gemini-end');
        return createMockAnalysisResult('gemini');
      });

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      // In parallel, both should start before either ends
      expect(callOrder[0]).toBe('codex-start');
      expect(callOrder[1]).toBe('gemini-start');
    });

    it('should execute sequentially when parallelExecution is false', async () => {
      const callOrder: string[] = [];

      mockDeps.codexService.analyzeCode = vi.fn().mockImplementation(async () => {
        callOrder.push('codex-start');
        await new Promise(resolve => setTimeout(resolve, 5));
        callOrder.push('codex-end');
        return createMockAnalysisResult('codex');
      });

      mockDeps.geminiService.analyzeCode = vi.fn().mockImplementation(async () => {
        callOrder.push('gemini-start');
        await new Promise(resolve => setTimeout(resolve, 5));
        callOrder.push('gemini-end');
        return createMockAnalysisResult('gemini');
      });

      await orchestrator.execute({
        prompt: 'const x = 1;',
        options: { parallelExecution: false },
      });

      // In sequential, codex should complete before gemini starts
      expect(callOrder).toEqual(['codex-start', 'codex-end', 'gemini-start', 'gemini-end']);
    });

    it('should pass includeIndividualAnalyses option to aggregator', async () => {
      await orchestrator.execute({
        prompt: 'const x = 1;',
        options: { includeIndividualAnalyses: true },
      });

      expect(mockDeps.aggregator.mergeAnalyses).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ includeIndividualAnalyses: true })
      );
    });

    it('should pass service params correctly', async () => {
      await orchestrator.execute({
        prompt: 'const x = 1;',
        context: { language: 'javascript' },
        options: {
          timeout: 60000,
          severity: 'high',
          template: 'security',
          preset: 'web',
          autoDetect: true,
          warnOnMissingContext: false,
        },
      });

      const expectedParams = expect.objectContaining({
        prompt: 'const x = 1;',
        context: { language: 'javascript' },
        options: expect.objectContaining({
          timeout: 60000,
          severity: 'high',
          template: 'security',
          preset: 'web',
          autoDetect: true,
          warnOnMissingContext: false,
        }),
      });

      expect(mockDeps.codexService.analyzeCode).toHaveBeenCalledWith(expectedParams);
      expect(mockDeps.geminiService.analyzeCode).toHaveBeenCalledWith(expectedParams);
    });

    it('should throw error when no analyses complete', async () => {
      mockDeps.aggregator.mergeAnalyses = vi.fn().mockImplementation(() => {
        throw new Error('No analyses completed successfully');
      });

      // Both services return undefined (simulating queue failure)
      mockDeps.codexQueue = {
        add: vi.fn().mockResolvedValue(undefined),
      } as any;
      mockDeps.geminiQueue = {
        add: vi.fn().mockResolvedValue(undefined),
      } as any;

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await expect(
        orchestrator.execute({ prompt: 'const x = 1;' })
      ).rejects.toThrow();
    });

    it('should set error status on failure', async () => {
      mockDeps.codexService.analyzeCode = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      await expect(
        orchestrator.execute({ prompt: 'const x = 1;' })
      ).rejects.toThrow('Analysis failed');

      const allIds = statusStore.getAllIds();
      const status = statusStore.get(allIds[0]);
      expect(status?.error).toBeDefined();
    });

    it('should sanitize input and log warnings', async () => {
      await orchestrator.execute({
        prompt: 'const x = 1;',
        context: { language: 'JavaScript' }, // Will be normalized
      });

      // Sanitization happens, check logger was called if there were warnings
      expect(mockDeps.codexService.analyzeCode).toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should use cache when enabled', async () => {
      const cachedResult = createMockAggregatedResult();
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockResolvedValue({
          result: cachedResult,
          fromCache: true,
        }),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      const result = await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Analysis');
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ cacheKey: expect.any(String) }),
        expect.stringContaining('cache')
      );
    });

    it('should skip cache when disabled', async () => {
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(false),
        getOrSet: vi.fn(),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(mockCacheService.getOrSet).not.toHaveBeenCalled();
      expect(mockDeps.codexService.analyzeCode).toHaveBeenCalled();
      expect(mockDeps.geminiService.analyzeCode).toHaveBeenCalled();
    });

    it('should execute analysis on cache miss', async () => {
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (_params, executeFn) => ({
          result: await executeFn(),
          fromCache: false,
        })),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(mockDeps.codexService.analyzeCode).toHaveBeenCalled();
      expect(mockDeps.geminiService.analyzeCode).toHaveBeenCalled();
      expect(mockDeps.aggregator.mergeAnalyses).toHaveBeenCalled();
    });
  });

  describe('secret scanning integration', () => {
    it('should integrate secret findings when enabled', async () => {
      const secretFindings = [
        { category: 'api_key', secret: 'ghp_xxx', line: 5 },
      ];

      const secretAnalysisFindings = [
        {
          title: 'API Key Detected',
          type: 'security',
          severity: 'critical',
          line: 5,
          description: 'Found exposed API key',
        },
      ];

      mockDeps.config = createMockConfig({
        secretScanning: { enabled: true },
      }) as any;

      mockDeps.secretScanner = {
        scan: vi.fn().mockReturnValue(secretFindings),
        toAnalysisFindings: vi.fn().mockReturnValue(secretAnalysisFindings),
      } as any;

      // Mock aggregator to return modifiable result
      const aggregatedResult = createMockAggregatedResult();
      aggregatedResult.findings = [...aggregatedResult.findings];
      aggregatedResult.summary = { ...aggregatedResult.summary };
      mockDeps.aggregator.mergeAnalyses = vi.fn().mockReturnValue(aggregatedResult);

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const token = "ghp_xxx";',
      });

      expect(mockDeps.secretScanner.scan).toHaveBeenCalled();
      expect(mockDeps.secretScanner.toAnalysisFindings).toHaveBeenCalled();
    });

    it('should skip secret scanning when disabled', async () => {
      mockDeps.config = createMockConfig({
        secretScanning: { enabled: false },
      }) as any;

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(mockDeps.secretScanner.scan).not.toHaveBeenCalled();
    });

    it('should add secret findings to aggregated result', async () => {
      const secretAnalysisFindings = [
        {
          title: 'Secret Found',
          type: 'security',
          severity: 'high',
          line: null,
          description: 'Found secret',
        },
      ];

      mockDeps.config = createMockConfig({
        secretScanning: { enabled: true },
      }) as any;

      mockDeps.secretScanner = {
        scan: vi.fn().mockReturnValue([{ category: 'secret' }]),
        toAnalysisFindings: vi.fn().mockReturnValue(secretAnalysisFindings),
      } as any;

      // Return mutable result
      const mutableResult = {
        ...createMockAggregatedResult(),
        findings: [],
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
      };
      mockDeps.aggregator.mergeAnalyses = vi.fn().mockReturnValue(mutableResult);

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      // The secret finding should be added
      expect(mutableResult.findings.length).toBeGreaterThan(0);
      expect(mutableResult.summary.high).toBe(1);
    });
  });

  describe('buildCacheKeyParams', () => {
    it('should build cache key with combined source', async () => {
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (_params, executeFn) => ({
          result: await executeFn(),
          fromCache: false,
        })),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      const cacheParams = mockCacheService.getOrSet.mock.calls[0][0];
      expect(cacheParams.source).toBe('combined');
      expect(cacheParams.service.model).toContain('codex-model');
      expect(cacheParams.service.model).toContain('gemini-model');
    });

    it('should include options in cache key', async () => {
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (_params, executeFn) => ({
          result: await executeFn(),
          fromCache: false,
        })),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
        options: {
          severity: 'high',
          preset: 'security',
          template: 'custom',
          autoDetect: false,
          warnOnMissingContext: true,
        },
      });

      const cacheParams = mockCacheService.getOrSet.mock.calls[0][0];
      expect(cacheParams.options.severity).toBe('high');
      expect(cacheParams.options.preset).toBe('security');
      expect(cacheParams.options.template).toBe('custom');
      expect(cacheParams.options.autoDetect).toBe(false);
      expect(cacheParams.options.warnOnMissingContext).toBe(true);
    });

    it('should use default template when not specified', async () => {
      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (_params, executeFn) => ({
          result: await executeFn(),
          fromCache: false,
        })),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      const cacheParams = mockCacheService.getOrSet.mock.calls[0][0];
      expect(cacheParams.service.template).toBe('default');
    });
  });

  describe('result formatting', () => {
    it('should format analysis with config limits', async () => {
      mockDeps.config = createMockConfig({
        analysis: {
          maxCodeLength: 50000,
          maxFindings: 10,
          maxCodeSnippetLength: 200,
          maxOutputChars: 5000,
        },
      }) as any;

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      const result = await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(result.content[0].text).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should set analysisId and timestamp on result', async () => {
      let capturedResult: any;
      mockDeps.aggregator.mergeAnalyses = vi.fn().mockImplementation(() => {
        capturedResult = createMockAggregatedResult();
        return capturedResult;
      });

      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      // The result should have combined analysis ID
      expect(capturedResult.analysisId).toContain('combined-');
      expect(capturedResult.timestamp).toBeDefined();
    });

    it('should add cache metadata when from cache', async () => {
      const cachedResult = createMockAggregatedResult();
      cachedResult.metadata = { analysisDuration: 100 };

      const mockCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockResolvedValue({
          result: cachedResult,
          fromCache: true,
        }),
      };

      mockDeps.cacheService = mockCacheService as any;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(cachedResult.metadata.fromCache).toBe(true);
      expect(cachedResult.metadata.cacheKey).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should classify and store error on failure', async () => {
      const testError = new Error('Service unavailable');
      mockDeps.codexService.analyzeCode = vi.fn().mockRejectedValue(testError);

      await expect(
        orchestrator.execute({ prompt: 'const x = 1;' })
      ).rejects.toThrow('Service unavailable');

      const allIds = statusStore.getAllIds();
      const status = statusStore.get(allIds[0]);
      expect(status?.error).toBeDefined();
      expect(status?.error?.message).toContain('unavailable');
    });

    it('should propagate original error', async () => {
      const customError = new Error('Custom analysis error');
      mockDeps.geminiService.analyzeCode = vi.fn().mockRejectedValue(customError);

      await expect(
        orchestrator.execute({ prompt: 'const x = 1;' })
      ).rejects.toThrow('Custom analysis error');
    });
  });

  describe('queue handling', () => {
    it('should use separate queues for each service', async () => {
      const codexQueue = new PQueue({ concurrency: 1 });
      const geminiQueue = new PQueue({ concurrency: 1 });

      const codexAddSpy = vi.spyOn(codexQueue, 'add');
      const geminiAddSpy = vi.spyOn(geminiQueue, 'add');

      mockDeps.codexQueue = codexQueue;
      mockDeps.geminiQueue = geminiQueue;
      orchestrator = new CombinedAnalysisOrchestrator(mockDeps);

      await orchestrator.execute({
        prompt: 'const x = 1;',
      });

      expect(codexAddSpy).toHaveBeenCalled();
      expect(geminiAddSpy).toHaveBeenCalled();
    });
  });
});
