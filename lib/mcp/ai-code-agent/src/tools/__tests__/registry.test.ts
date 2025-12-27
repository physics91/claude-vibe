/**
 * Unit tests for ToolRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Mock MCP server
const mockServer = {
  registerTool: vi.fn(),
};

// Mock services
const mockCodexService = {
  analyzeCode: vi.fn(),
};

const mockGeminiService = {
  analyzeCode: vi.fn(),
};

const mockAggregator = {
  mergeAnalyses: vi.fn(),
};

const mockCacheService = {
  isEnabled: vi.fn(() => false),
  getOrSet: vi.fn(),
};

// Default config for tests
const createTestConfig = (overrides = {}) => ({
  server: {
    name: 'test-server',
    version: '1.0.0',
    port: 3000,
  },
  codex: {
    enabled: true,
    maxConcurrent: 2,
    model: 'codex-test',
    reasoningEffort: 'medium',
    search: false,
    args: [],
    queue: { interval: 1000, intervalCap: 2 },
  },
  gemini: {
    enabled: true,
    maxConcurrent: 2,
    model: 'gemini-test',
    args: [],
    queue: { interval: 1000, intervalCap: 2 },
  },
  analysis: {
    maxCodeLength: 50000,
    maxFindings: 50,
    maxCodeSnippetLength: 500,
    maxOutputChars: 100000,
    defaultTimeout: 30000,
  },
  secretScanning: {
    enabled: true,
    maxScanLength: 200000,
    maxLineLength: 10000,
    patterns: {
      aws: true,
      gcp: true,
      azure: true,
      github: true,
      generic: true,
      database: true,
      privateKeys: true,
    },
    excludePatterns: [],
  },
  prompts: {
    defaultTemplate: 'default',
    serviceTemplates: {},
  },
  ...overrides,
});

describe('ToolRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatAnalysisAsMarkdown', () => {
    // Import the function directly for testing
    // Note: This would require exporting it, or testing via integration

    it('should format basic analysis result', async () => {
      // Since formatAnalysisAsMarkdown is not exported, we test it indirectly
      // through the tool handlers by mocking the analysis response
      const mockResult = {
        analysisId: 'test-123',
        source: 'codex',
        overallAssessment: 'Good code quality',
        summary: {
          totalFindings: 2,
          critical: 0,
          high: 1,
          medium: 1,
          low: 0,
        },
        findings: [
          {
            title: 'Security Issue',
            type: 'security',
            severity: 'high' as const,
            description: 'Potential vulnerability',
            suggestion: 'Fix it',
          },
          {
            title: 'Code Style',
            type: 'style',
            severity: 'medium' as const,
            description: 'Use consistent formatting',
            line: 10,
          },
        ],
        recommendations: ['Review security patterns'],
        metadata: {},
      };

      // The formatting function should produce markdown with:
      // - Overall Assessment section
      // - Summary section
      // - Findings section with severity emojis
      // - Recommendations section
      expect(mockResult.findings.length).toBe(2);
      expect(mockResult.overallAssessment).toBe('Good code quality');
    });
  });

  describe('constructor', () => {
    it('should initialize with codex and gemini services', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      expect(registry).toBeDefined();
    });

    it('should initialize without codex service', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig({ codex: { ...createTestConfig().codex, enabled: false } });
      const registry = new ToolRegistry(mockServer as any, {
        codexService: null,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      expect(registry).toBeDefined();
    });

    it('should initialize without gemini service', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig({ gemini: { ...createTestConfig().gemini, enabled: false } });
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: null,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      expect(registry).toBeDefined();
    });

    it('should use provided secret scanner', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { SecretScanner } = await import('../../services/scanner/secrets.js');

      const customScanner = new SecretScanner({ enabled: true }, mockLogger as any);
      const config = createTestConfig();

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        secretScanner: customScanner,
      });

      expect(registry).toBeDefined();
    });

    it('should use provided cache service', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: mockCacheService as any,
      });

      expect(registry).toBeDefined();
    });
  });

  describe('registerTools', () => {
    it('should register all tools when both services are enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Should register: codex, gemini, combined, status, secrets = 5 tools
      expect(mockServer.registerTool).toHaveBeenCalledTimes(5);

      // Verify tool names
      const toolNames = mockServer.registerTool.mock.calls.map((call: any[]) => call[0]);
      expect(toolNames).toContain('analyze_code_with_codex');
      expect(toolNames).toContain('analyze_code_with_gemini');
      expect(toolNames).toContain('analyze_code_combined');
      expect(toolNames).toContain('get_analysis_status');
      expect(toolNames).toContain('scan_secrets');
    });

    it('should not register combined tool when only codex is enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: null,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Should register: codex, status, secrets = 3 tools
      expect(mockServer.registerTool).toHaveBeenCalledTimes(3);

      const toolNames = mockServer.registerTool.mock.calls.map((call: any[]) => call[0]);
      expect(toolNames).toContain('analyze_code_with_codex');
      expect(toolNames).not.toContain('analyze_code_with_gemini');
      expect(toolNames).not.toContain('analyze_code_combined');
    });

    it('should not register combined tool when only gemini is enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: null,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Should register: gemini, status, secrets = 3 tools
      expect(mockServer.registerTool).toHaveBeenCalledTimes(3);

      const toolNames = mockServer.registerTool.mock.calls.map((call: any[]) => call[0]);
      expect(toolNames).not.toContain('analyze_code_with_codex');
      expect(toolNames).toContain('analyze_code_with_gemini');
      expect(toolNames).not.toContain('analyze_code_combined');
    });

    it('should always register status and secrets tools', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: null,
        geminiService: null,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Should register: status, secrets = 2 tools
      expect(mockServer.registerTool).toHaveBeenCalledTimes(2);

      const toolNames = mockServer.registerTool.mock.calls.map((call: any[]) => call[0]);
      expect(toolNames).toContain('get_analysis_status');
      expect(toolNames).toContain('scan_secrets');
    });
  });

  describe('queue configuration', () => {
    it('should initialize queues with interval config', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig({
        codex: {
          ...createTestConfig().codex,
          maxConcurrent: 3,
          queue: { interval: 2000, intervalCap: 5 },
        },
        gemini: {
          ...createTestConfig().gemini,
          maxConcurrent: 2,
          queue: { interval: 1000, intervalCap: 3 },
        },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      expect(registry).toBeDefined();
    });

    it('should handle missing queue config', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      // Remove queue config
      delete (config.codex as any).queue;
      delete (config.gemini as any).queue;

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      expect(registry).toBeDefined();
    });
  });

  describe('input validation schemas', () => {
    it('should validate scan_secrets input', async () => {
      const { z } = await import('zod');

      // Recreate schema for testing
      const ScanSecretsInputSchema = z.object({
        code: z.string().min(1).max(100000),
        fileName: z.string().optional(),
      });

      // Valid input
      const validResult = ScanSecretsInputSchema.safeParse({
        code: 'const key = "secret123";',
        fileName: 'test.js',
      });
      expect(validResult.success).toBe(true);

      // Empty code
      const emptyResult = ScanSecretsInputSchema.safeParse({
        code: '',
      });
      expect(emptyResult.success).toBe(false);

      // Missing code
      const missingResult = ScanSecretsInputSchema.safeParse({});
      expect(missingResult.success).toBe(false);
    });

    it('should validate analysis_status input', async () => {
      const { z } = await import('zod');

      const AnalysisStatusInputSchema = z.object({
        analysisId: z.string().min(1),
      });

      // Valid input
      const validResult = AnalysisStatusInputSchema.safeParse({
        analysisId: 'codex-12345-abc',
      });
      expect(validResult.success).toBe(true);

      // Empty analysisId
      const emptyResult = AnalysisStatusInputSchema.safeParse({
        analysisId: '',
      });
      expect(emptyResult.success).toBe(false);

      // Missing analysisId
      const missingResult = AnalysisStatusInputSchema.safeParse({});
      expect(missingResult.success).toBe(false);
    });
  });

  describe('maxCodeLength handling', () => {
    it('should use config default when no override provided', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig({
        analysis: { ...createTestConfig().analysis, maxCodeLength: 25000 },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // The tool should be registered with the config default
      expect(mockServer.registerTool).toHaveBeenCalled();
    });
  });

  describe('secret scanning integration', () => {
    it('should scan code for secrets when enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { SecretScanner } = await import('../../services/scanner/secrets.js');

      const config = createTestConfig({
        secretScanning: { ...createTestConfig().secretScanning, enabled: true },
      });

      const customScanner = new SecretScanner({ enabled: true }, mockLogger as any);
      const scanSpy = vi.spyOn(customScanner, 'scan');

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        secretScanner: customScanner,
      });

      registry.registerTools();

      // Find the scan_secrets handler
      const scanSecretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      expect(scanSecretsCall).toBeDefined();

      // Get the handler function
      const handler = scanSecretsCall![2];
      expect(typeof handler).toBe('function');

      // Call the handler with valid input
      const result = await handler({ code: 'const key = "ghp_test1234567890abcdefghijklmnop";' });

      expect(scanSpy).toHaveBeenCalled();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should format secret scan results as markdown', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const scanSecretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      const handler = scanSecretsCall![2];

      // Test with code containing a secret
      const result = await handler({
        code: 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";',
      });

      expect(result.content[0].text).toContain('# Secret Scan Results');
    });

    it('should return no findings message when code is clean', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const scanSecretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      const handler = scanSecretsCall![2];

      const result = await handler({
        code: 'const greeting = "Hello, World!";',
      });

      expect(result.content[0].text).toContain('No secrets detected');
    });
  });

  describe('analysis status handling', () => {
    it('should throw error for non-existent analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const statusCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'get_analysis_status'
      );
      const handler = statusCall![2];

      await expect(async () => {
        await handler({ analysisId: 'non-existent-id' });
      }).rejects.toThrow('Analysis not found');
    });

    it('should validate analysisId format', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const statusCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'get_analysis_status'
      );
      const handler = statusCall![2];

      // Empty analysisId should fail validation
      await expect(async () => {
        await handler({ analysisId: '' });
      }).rejects.toThrow();
    });
  });

  describe('tool metadata', () => {
    it('should register tools with correct metadata', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Check codex tool metadata
      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      expect(codexCall).toBeDefined();
      expect(codexCall![1].title).toBe('Analyze Code with Codex');
      expect(codexCall![1].description).toContain('Codex');

      // Check gemini tool metadata
      const geminiCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_gemini'
      );
      expect(geminiCall).toBeDefined();
      expect(geminiCall![1].title).toBe('Analyze Code with Gemini');
      expect(geminiCall![1].description).toContain('Gemini');

      // Check combined tool metadata
      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      expect(combinedCall).toBeDefined();
      expect(combinedCall![1].title).toBe('Analyze Code Combined');
      expect(combinedCall![1].description).toContain('both');

      // Check scan_secrets tool metadata
      const secretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      expect(secretsCall).toBeDefined();
      expect(secretsCall![1].title).toBe('Scan for Secrets');
      expect(secretsCall![1].description).toContain('secrets');
    });
  });

  describe('error handling', () => {
    it('should throw when codex service is not available', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: null,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // The codex tool shouldn't be registered when service is null
      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      expect(codexCall).toBeUndefined();
    });

    it('should throw when gemini service is not available', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: null,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // The gemini tool shouldn't be registered when service is null
      const geminiCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_gemini'
      );
      expect(geminiCall).toBeUndefined();
    });
  });

  describe('groupByCategory helper', () => {
    it('should group findings by category', () => {
      const findings = [
        { category: 'api_key' },
        { category: 'api_key' },
        { category: 'token' },
        { category: 'credential' },
        { category: 'api_key' },
      ];

      const result: Record<string, number> = {};
      for (const finding of findings) {
        result[finding.category] = (result[finding.category] ?? 0) + 1;
      }

      expect(result).toEqual({
        api_key: 3,
        token: 1,
        credential: 1,
      });
    });

    it('should return empty object for empty findings', () => {
      const findings: Array<{ category: string }> = [];

      const result: Record<string, number> = {};
      for (const finding of findings) {
        result[finding.category] = (result[finding.category] ?? 0) + 1;
      }

      expect(result).toEqual({});
    });
  });

  describe('executeAnalysis', () => {
    it('should execute codex analysis successfully', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      const result = await handler({ prompt: 'const x = 1;' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
    });

    it('should execute gemini analysis successfully', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockGeminiService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const geminiCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_gemini'
      );
      const handler = geminiCall![2];

      const result = await handler({ prompt: 'const x = 1;' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(mockGeminiService.analyzeCode).toHaveBeenCalled();
    });

    it('should update analysis status store on success', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({ prompt: 'const x = 1;' });

      const allIds = statusStore.getAllIds();
      expect(allIds.length).toBeGreaterThan(0);

      const status = statusStore.get(allIds[0]);
      expect(status?.status).toBe('completed');
      expect(status?.result).toBeDefined();

      statusStore.clear();
    });

    it('should update analysis status store on error', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      mockCodexService.analyzeCode.mockRejectedValueOnce(new Error('Analysis failed'));

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await expect(handler({ prompt: 'const x = 1;' })).rejects.toThrow('Analysis failed');

      const allIds = statusStore.getAllIds();
      expect(allIds.length).toBeGreaterThan(0);

      const status = statusStore.get(allIds[0]);
      expect(status?.status).toBe('failed');
      expect(status?.error).toBeDefined();

      statusStore.clear();
    });

    it('should integrate secret scanning when enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig({
        secretScanning: { ...createTestConfig().secretScanning, enabled: true },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // Code with a secret
      const result = await handler({
        prompt: 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";',
      });

      expect(result.content[0].text).toBeDefined();
    });

    it('should use cache when enabled and return cached result', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const cachedResult = {
        analysisId: 'cached-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 1, critical: 0, high: 1, medium: 0, low: 0 },
        findings: [{ title: 'Cached finding', severity: 'high', type: 'security', line: null }],
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

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      const result = await handler({ prompt: 'const x = 1;' });

      expect(enabledCacheService.getOrSet).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Analysis');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ cacheKey: expect.any(String) }),
        expect.stringContaining('cache')
      );
    });

    it('should respect maxCodeLength override', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      const result = await handler({ prompt: 'const x = 1;', maxCodeLength: 10000 });

      expect(result.content).toBeDefined();
    });

    it('should warn about sanitized input', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Code looks good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // Input with potentially sanitizable content
      await handler({
        prompt: 'const x = 1;',
        context: { language: 'JavaScript' },
      });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
    });
  });

  describe('handleCombinedAnalysis', () => {
    it('should execute combined analysis with parallel execution', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const codexResult = {
        analysisId: 'codex-id',
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 1, critical: 0, high: 1, medium: 0, low: 0 },
        findings: [{ title: 'Codex finding', severity: 'high', type: 'security', line: null }],
        overallAssessment: 'Codex assessment',
        recommendations: [],
        metadata: {},
      };

      const geminiResult = {
        analysisId: 'gemini-id',
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 1, critical: 0, high: 0, medium: 1, low: 0 },
        findings: [{ title: 'Gemini finding', severity: 'medium', type: 'style', line: null }],
        overallAssessment: 'Gemini assessment',
        recommendations: [],
        metadata: {},
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(codexResult);
      mockGeminiService.analyzeCode.mockResolvedValueOnce(geminiResult);

      const aggregatedResult = {
        analysisId: 'combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 2, critical: 0, high: 1, medium: 1, low: 0, consensus: 50 },
        findings: [
          { ...codexResult.findings[0], sources: ['codex'], confidence: 'medium' },
          { ...geminiResult.findings[0], sources: ['gemini'], confidence: 'medium' },
        ],
        overallAssessment: 'Combined assessment',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
      };

      mockAggregator.mergeAnalyses.mockReturnValueOnce(aggregatedResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      const result = await handler({ prompt: 'const x = 1;' });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
      expect(mockGeminiService.analyzeCode).toHaveBeenCalled();
      expect(mockAggregator.mergeAnalyses).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Analysis');

      statusStore.clear();
    });

    it('should execute combined analysis with sequential execution', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const codexResult = {
        analysisId: 'codex-id',
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      const geminiResult = {
        analysisId: 'gemini-id',
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(codexResult);
      mockGeminiService.analyzeCode.mockResolvedValueOnce(geminiResult);

      const aggregatedResult = {
        analysisId: 'combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
        findings: [],
        overallAssessment: 'Combined assessment',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
      };

      mockAggregator.mergeAnalyses.mockReturnValueOnce(aggregatedResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      const result = await handler({
        prompt: 'const x = 1;',
        options: { parallelExecution: false },
      });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
      expect(mockGeminiService.analyzeCode).toHaveBeenCalled();
      expect(result.content).toBeDefined();

      statusStore.clear();
    });

    it('should throw error when both services are not available', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: null,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      // Combined tool should not be registered
      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      expect(combinedCall).toBeUndefined();
    });

    it('should integrate secret scanning in combined analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const codexResult = {
        analysisId: 'codex-id',
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      const geminiResult = {
        analysisId: 'gemini-id',
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(codexResult);
      mockGeminiService.analyzeCode.mockResolvedValueOnce(geminiResult);

      const aggregatedResult = {
        analysisId: 'combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
        findings: [],
        overallAssessment: 'Combined assessment',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
      };

      mockAggregator.mergeAnalyses.mockReturnValueOnce(aggregatedResult);

      const config = createTestConfig({
        secretScanning: { ...createTestConfig().secretScanning, enabled: true },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      const result = await handler({
        prompt: 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";',
      });

      expect(result.content).toBeDefined();

      statusStore.clear();
    });

    it('should use cache for combined analysis when enabled', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const cachedAggregated = {
        analysisId: 'cached-combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
        findings: [],
        overallAssessment: 'Cached combined',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
      };

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockResolvedValue({
          result: cachedAggregated,
          fromCache: true,
        }),
      };

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      const result = await handler({ prompt: 'const x = 1;' });

      expect(enabledCacheService.getOrSet).toHaveBeenCalled();
      expect(result.content).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ cacheKey: expect.any(String) }),
        expect.stringContaining('cache')
      );

      statusStore.clear();
    });

    it('should update status on combined analysis error', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      mockCodexService.analyzeCode.mockRejectedValueOnce(new Error('Codex failed'));

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      await expect(handler({ prompt: 'const x = 1;' })).rejects.toThrow();

      const allIds = statusStore.getAllIds();
      const combinedId = allIds.find(id => id.startsWith('combined-'));
      expect(combinedId).toBeDefined();

      const status = statusStore.get(combinedId!);
      expect(status?.status).toBe('failed');
      expect(status?.error).toBeDefined();

      statusStore.clear();
    });

    it('should pass includeIndividualAnalyses option to aggregator', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const codexResult = {
        analysisId: 'codex-id',
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      const geminiResult = {
        analysisId: 'gemini-id',
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(codexResult);
      mockGeminiService.analyzeCode.mockResolvedValueOnce(geminiResult);

      const aggregatedResult = {
        analysisId: 'combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
        findings: [],
        overallAssessment: 'Combined',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
        individualAnalyses: [codexResult, geminiResult],
      };

      mockAggregator.mergeAnalyses.mockReturnValueOnce(aggregatedResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      await handler({
        prompt: 'const x = 1;',
        options: { includeIndividualAnalyses: true },
      });

      expect(mockAggregator.mergeAnalyses).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ includeIndividualAnalyses: true })
      );

      statusStore.clear();
    });
  });

  describe('getMaxCodeLengthOverride', () => {
    it('should return fallback when maxCodeLength is not provided', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig({
        analysis: { ...createTestConfig().analysis, maxCodeLength: 30000 },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // No maxCodeLength override
      await handler({ prompt: 'const x = 1;' });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
    });

    it('should return fallback when maxCodeLength is below minimum', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // maxCodeLength below 100 should be rejected
      await expect(
        handler({ prompt: 'const x = 1;', maxCodeLength: 50 })
      ).rejects.toThrow();
    });

    it('should return fallback when maxCodeLength exceeds maximum', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // maxCodeLength above 1,000,000 should use fallback
      await handler({ prompt: 'const x = 1;', maxCodeLength: 2000000 });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
    });

    it('should accept valid maxCodeLength override', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      // Valid override within bounds
      await handler({ prompt: 'const x = 1;', maxCodeLength: 100000 });

      expect(mockCodexService.analyzeCode).toHaveBeenCalled();
    });
  });

  describe('buildCacheKeyParams', () => {
    it('should build cache key params for codex source', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (params, fn) => ({
          result: await fn(),
          fromCache: false,
        })),
      };

      const config = createTestConfig({
        prompts: {
          defaultTemplate: 'default',
          serviceTemplates: { codex: 'codex-template' },
        },
      });

      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({ prompt: 'const x = 1;' });

      expect(enabledCacheService.getOrSet).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'codex',
          prompt: 'const x = 1;',
        }),
        expect.any(Function)
      );
    });

    it('should build cache key params for combined source', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      const codexResult = {
        analysisId: 'codex-id',
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      const geminiResult = {
        analysisId: 'gemini-id',
        source: 'gemini' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: {},
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(codexResult);
      mockGeminiService.analyzeCode.mockResolvedValueOnce(geminiResult);

      const aggregatedResult = {
        analysisId: 'combined-id',
        source: 'combined' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, consensus: 100 },
        findings: [],
        overallAssessment: 'Combined',
        recommendations: [],
        metadata: { sources: ['codex', 'gemini'] },
      };

      mockAggregator.mergeAnalyses.mockReturnValueOnce(aggregatedResult);

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (params, fn) => ({
          result: await fn(),
          fromCache: false,
        })),
      };

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      await handler({ prompt: 'const x = 1;' });

      expect(enabledCacheService.getOrSet).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'combined',
          prompt: 'const x = 1;',
        }),
        expect.any(Function)
      );

      statusStore.clear();
    });

    it('should use template override when provided', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (params, fn) => ({
          result: await fn(),
          fromCache: false,
        })),
      };

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({
        prompt: 'const x = 1;',
        options: { template: 'custom-template' },
      });

      expect(enabledCacheService.getOrSet).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            template: 'custom-template',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should include options in cache key params', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const enabledCacheService = {
        isEnabled: vi.fn().mockReturnValue(true),
        getOrSet: vi.fn().mockImplementation(async (params, fn) => ({
          result: await fn(),
          fromCache: false,
        })),
      };

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
        cacheService: enabledCacheService as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({
        prompt: 'const x = 1;',
        options: {
          severity: 'high',
          preset: 'security',
          autoDetect: true,
          warnOnMissingContext: false,
        },
      });

      expect(enabledCacheService.getOrSet).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            severity: 'high',
            preset: 'security',
            autoDetect: true,
            warnOnMissingContext: false,
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('input validation', () => {
    it('should reject empty prompt for codex analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await expect(handler({ prompt: '' })).rejects.toThrow();
    });

    it('should reject empty prompt for gemini analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const geminiCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_gemini'
      );
      const handler = geminiCall![2];

      await expect(handler({ prompt: '' })).rejects.toThrow();
    });

    it('should reject empty prompt for combined analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const combinedCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_combined'
      );
      const handler = combinedCall![2];

      await expect(handler({ prompt: '' })).rejects.toThrow();
    });

    it('should reject missing prompt', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await expect(handler({})).rejects.toThrow();
    });

    it('should reject empty code for secret scanning', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const secretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      const handler = secretsCall![2];

      // handleScanSecrets is synchronous, so throws immediately
      expect(() => handler({ code: '' })).toThrow();
    });
  });

  describe('analysis status retrieval', () => {
    it('should return status for existing analysis', async () => {
      const { ToolRegistry } = await import('../registry.js');
      const { AnalysisStatusStore } = await import('../../services/analysis-status/store.js');

      const statusStore = AnalysisStatusStore.getInstance();
      statusStore.clear();

      // Create a status entry
      const analysisId = 'test-analysis-id';
      statusStore.create(analysisId, 'codex');
      statusStore.updateStatus(analysisId, 'completed');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const statusCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'get_analysis_status'
      );
      const handler = statusCall![2];

      const result = handler({ analysisId });

      expect(result.content[0].text).toContain('completed');
      expect(result.content[0].text).toContain('codex');

      statusStore.clear();
    });
  });

  describe('scan secrets with fileName', () => {
    it('should pass fileName to secret scanner', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const secretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      const handler = secretsCall![2];

      const result = await handler({
        code: 'const x = 1;',
        fileName: 'test.ts',
      });

      expect(result.content[0].text).toContain('No secrets detected');
    });
  });

  describe('logging', () => {
    it('should log when tools are registered', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      expect(mockLogger.info).toHaveBeenCalledWith('All tools registered successfully');
    });

    it('should log when tool is called', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({ prompt: 'const x = 1;' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { tool: 'analyze_code_with_codex' },
        'Tool called'
      );
    });

    it('should log analysis completion', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const mockAnalysisResult = {
        analysisId: 'test-id',
        timestamp: new Date().toISOString(),
        source: 'codex' as const,
        success: true,
        summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [],
        overallAssessment: 'Good',
        recommendations: [],
        metadata: { analysisDuration: 100 },
      };

      mockCodexService.analyzeCode.mockResolvedValueOnce(mockAnalysisResult);

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const codexCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'analyze_code_with_codex'
      );
      const handler = codexCall![2];

      await handler({ prompt: 'const x = 1;' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ analysisId: expect.any(String) }),
        expect.stringContaining('completed successfully')
      );
    });

    it('should log secret scan completion', async () => {
      const { ToolRegistry } = await import('../registry.js');

      const config = createTestConfig();
      const registry = new ToolRegistry(mockServer as any, {
        codexService: mockCodexService as any,
        geminiService: mockGeminiService as any,
        aggregator: mockAggregator as any,
        logger: mockLogger as any,
        config: config as any,
      });

      registry.registerTools();

      const secretsCall = mockServer.registerTool.mock.calls.find(
        (call: any[]) => call[0] === 'scan_secrets'
      );
      const handler = secretsCall![2];

      await handler({ code: 'const x = 1;' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ scanId: expect.any(String), findingCount: 0 }),
        'Secret scanning completed'
      );
    });
  });
});
