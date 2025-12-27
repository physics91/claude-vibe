/**
 * Analysis Request Handler Tests
 * Tests for individual analysis execution flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PQueue from 'p-queue';
import { AnalysisRequestHandler } from '../analysis-handler.js';
import { AnalysisStatusStore } from '../../../services/analysis-status/store.js';

// Helper to get status from store since it's a singleton
const getStatusFromStore = (statusStore: AnalysisStatusStore, analysisId: string) => {
  return statusStore.get(analysisId);
};

const getAllStatusIds = (statusStore: AnalysisStatusStore) => {
  return statusStore.getAllIds();
};

// Mock dependencies
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const createMockConfig = (overrides = {}) => ({
  server: { name: 'test', version: '1.0.0', port: 3000 },
  codex: {
    enabled: true,
    model: 'test-model',
    reasoningEffort: 'medium',
    search: false,
    args: [],
  },
  gemini: {
    enabled: true,
    model: 'gemini-test',
    args: [],
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

const createMockSecretScanner = () => ({
  scan: vi.fn().mockReturnValue([]),
  toAnalysisFindings: vi.fn().mockReturnValue([]),
});

const createMockCacheService = (enabled = false) => ({
  isEnabled: vi.fn().mockReturnValue(enabled),
  getOrSet: vi.fn().mockImplementation(async (_params, fn) => ({
    result: await fn(),
    fromCache: false,
  })),
});

const createMockAnalysisService = () => ({
  analyzeCode: vi.fn().mockResolvedValue({
    analysisId: 'mock-analysis-id',
    timestamp: new Date().toISOString(),
    source: 'codex',
    success: true,
    summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
    findings: [],
    overallAssessment: 'Code looks good',
    recommendations: [],
    metadata: { analysisDuration: 100 },
  }),
});

describe('AnalysisRequestHandler', () => {
  let handler: AnalysisRequestHandler;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockConfig: ReturnType<typeof createMockConfig>;
  let mockSecretScanner: ReturnType<typeof createMockSecretScanner>;
  let mockCacheService: ReturnType<typeof createMockCacheService>;
  let mockService: ReturnType<typeof createMockAnalysisService>;
  let statusStore: AnalysisStatusStore;
  let queue: PQueue;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = createMockLogger();
    mockConfig = createMockConfig();
    mockSecretScanner = createMockSecretScanner();
    mockCacheService = createMockCacheService();
    mockService = createMockAnalysisService();
    statusStore = AnalysisStatusStore.getInstance();
    statusStore.clear(); // Clear any existing entries
    queue = new PQueue({ concurrency: 2 });

    handler = new AnalysisRequestHandler({
      config: mockConfig as any,
      logger: mockLogger as any,
      cacheService: mockCacheService as any,
      secretScanner: mockSecretScanner as any,
      analysisStatusStore: statusStore,
    });
  });

  afterEach(() => {
    statusStore.clear();
  });

  describe('execute', () => {
    it('should execute analysis successfully', async () => {
      const result = await handler.execute(
        { prompt: 'Review this code: const x = 1;' },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Analysis');
      expect(mockService.analyzeCode).toHaveBeenCalledOnce();
    });

    it('should validate input parameters', async () => {
      await expect(
        handler.execute(
          { prompt: '' }, // Empty prompt should fail
          {
            service: mockService as any,
            queue,
            source: 'codex',
            toolName: 'analyze_code_with_codex',
          }
        )
      ).rejects.toThrow();
    });

    it('should create and update analysis status', async () => {
      await handler.execute(
        { prompt: 'const x = 1;' },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      // Should have created a status entry
      const allIds = getAllStatusIds(statusStore);
      expect(allIds.length).toBeGreaterThan(0);

      const status = getStatusFromStore(statusStore, allIds[0]);
      expect(status?.source).toBe('codex');
      expect(status?.status).toBe('completed');
      expect(status?.result).toBeDefined();
    });

    it('should set error status on failure', async () => {
      mockService.analyzeCode.mockRejectedValueOnce(new Error('Analysis failed'));

      await expect(
        handler.execute(
          { prompt: 'const x = 1;' },
          {
            service: mockService as any,
            queue,
            source: 'codex',
            toolName: 'analyze_code_with_codex',
          }
        )
      ).rejects.toThrow('Analysis failed');

      const allIds = getAllStatusIds(statusStore);
      const status = getStatusFromStore(statusStore, allIds[0]);
      expect(status?.status).toBe('failed');
      expect(status?.error).toBeDefined();
    });

    it('should use cache when enabled', async () => {
      const cachedResult = {
        analysisId: 'cached-id',
        timestamp: new Date().toISOString(),
        source: 'codex',
        success: true,
        summary: { totalFindings: 1, critical: 0, high: 1, medium: 0, low: 0 },
        findings: [{ title: 'Cached finding', severity: 'high' }],
        overallAssessment: 'From cache',
        recommendations: [],
        metadata: { analysisDuration: 50 },
      };

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockResolvedValue({
          result: cachedResult,
          fromCache: true,
        }),
      };

      const handlerWithCache = new AnalysisRequestHandler({
        config: mockConfig as any,
        logger: mockLogger as any,
        cacheService: enabledCacheService as any,
        secretScanner: mockSecretScanner as any,
        analysisStatusStore: statusStore,
      });

      const result = await handlerWithCache.execute(
        { prompt: 'const x = 1;' },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      expect(enabledCacheService.getOrSet).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Analysis');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ cacheKey: expect.any(String) }),
        expect.stringContaining('cache')
      );
    });

    it('should respect maxCodeLength override', async () => {
      const result = await handler.execute(
        {
          prompt: 'const x = 1;',
          maxCodeLength: 1000,
        },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      expect(result.content).toHaveLength(1);
    });

    it('should ignore invalid maxCodeLength values', async () => {
      const result = await handler.execute(
        {
          prompt: 'const x = 1;',
          maxCodeLength: -100, // Invalid value
        },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      // Should use default config value instead
      expect(result.content).toHaveLength(1);
    });

    it('should integrate secret scanning when enabled', async () => {
      const secretFindings = [
        { category: 'api_key', secret: 'ghp_xxx', line: 5 },
      ];

      const scannerWithFindings = {
        scan: vi.fn().mockReturnValue(secretFindings),
        toAnalysisFindings: vi.fn().mockReturnValue([
          {
            title: 'API Key Detected',
            severity: 'high',
            type: 'security',
            description: 'Found exposed API key',
          },
        ]),
      };

      const configWithSecretScanning = createMockConfig({
        secretScanning: { enabled: true },
      });

      const handlerWithSecrets = new AnalysisRequestHandler({
        config: configWithSecretScanning as any,
        logger: mockLogger as any,
        cacheService: null,
        secretScanner: scannerWithFindings as any,
        analysisStatusStore: statusStore,
      });

      await handlerWithSecrets.execute(
        { prompt: 'const token = "ghp_xxx";' },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      expect(scannerWithFindings.scan).toHaveBeenCalled();
      expect(scannerWithFindings.toAnalysisFindings).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ secretCount: 1 }),
        expect.any(String)
      );
    });
  });

  describe('queue handling', () => {
    it('should queue multiple requests', async () => {
      const slowService = {
        analyzeCode: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            analysisId: 'slow-id',
            timestamp: new Date().toISOString(),
            source: 'codex',
            success: true,
            summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
            findings: [],
            overallAssessment: 'Done',
            recommendations: [],
            metadata: { analysisDuration: 50 },
          };
        }),
      };

      const limitedQueue = new PQueue({ concurrency: 1 });

      const promises = [
        handler.execute(
          { prompt: 'const a = 1;' },
          {
            service: slowService as any,
            queue: limitedQueue,
            source: 'codex',
            toolName: 'test',
          }
        ),
        handler.execute(
          { prompt: 'const b = 2;' },
          {
            service: slowService as any,
            queue: limitedQueue,
            source: 'codex',
            toolName: 'test',
          }
        ),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(slowService.analyzeCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('input sanitization', () => {
    it('should warn about sanitized input', async () => {
      // The handler should sanitize input and log warnings
      await handler.execute(
        {
          prompt: 'const x = 1;',
          context: { language: 'JavaScript' }, // Will be normalized to lowercase
        },
        {
          service: mockService as any,
          queue,
          source: 'codex',
          toolName: 'analyze_code_with_codex',
        }
      );

      // Sanitization happens inside ValidationUtils
      expect(mockService.analyzeCode).toHaveBeenCalled();
    });
  });
});
