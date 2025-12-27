/**
 * Unit tests for AnalysisAggregator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisAggregator, type AggregatorConfig } from '../merger.js';
import type { AnalysisResult } from '../../../schemas/tools.js';
import type { Logger } from '../../../core/logger.js';

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// Helper to create mock analysis results
function createMockAnalysis(
  source: 'codex' | 'gemini',
  findings: Array<{
    type?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    line?: number | null;
    title: string;
    description: string;
    suggestion?: string;
  }>,
  overrides?: Partial<AnalysisResult>
): AnalysisResult {
  return {
    success: true,
    analysisId: `${source}-test-123`,
    timestamp: new Date().toISOString(),
    source,
    summary: {
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    },
    findings: findings.map(f => ({
      type: f.type ?? 'security',
      severity: f.severity ?? 'medium',
      line: f.line ?? null,
      title: f.title,
      description: f.description,
      suggestion: f.suggestion,
    })),
    overallAssessment: 'Test assessment',
    recommendations: [],
    metadata: {
      analysisDuration: 100,
    },
    ...overrides,
  };
}

describe('AnalysisAggregator', () => {
  let aggregator: AnalysisAggregator;
  let mockLogger: Logger;
  let config: AggregatorConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    config = {
      deduplication: {
        enabled: true,
        similarityThreshold: 0.8,
      },
    };
    aggregator = new AnalysisAggregator(config, mockLogger);
  });

  describe('mergeAnalyses', () => {
    it('should merge analyses from multiple sources', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'SQL Injection', description: 'Unsafe query', severity: 'critical' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'XSS Vulnerability', description: 'Unescaped output', severity: 'high' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.success).toBe(true);
      expect(result.source).toBe('combined');
      expect(result.findings.length).toBe(2);
    });

    it('should return correct summary counts', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Critical Issue', description: 'desc', severity: 'critical' },
        { title: 'High Issue', description: 'desc', severity: 'high' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Medium Issue', description: 'desc', severity: 'medium' },
        { title: 'Low Issue', description: 'desc', severity: 'low' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.summary.totalFindings).toBe(4);
      expect(result.summary.critical).toBe(1);
      expect(result.summary.high).toBe(1);
      expect(result.summary.medium).toBe(1);
      expect(result.summary.low).toBe(1);
    });

    it('should sort findings by severity (highest first)', () => {
      const analysis = createMockAnalysis('codex', [
        { title: 'Low Issue', description: 'desc', severity: 'low' },
        { title: 'Critical Issue', description: 'desc', severity: 'critical' },
        { title: 'Medium Issue', description: 'desc', severity: 'medium' },
        { title: 'High Issue', description: 'desc', severity: 'high' },
      ]);

      const result = aggregator.mergeAnalyses([analysis]);

      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[1].severity).toBe('high');
      expect(result.findings[2].severity).toBe('medium');
      expect(result.findings[3].severity).toBe('low');
    });

    it('should include individual analyses when requested', () => {
      const codexAnalysis = createMockAnalysis('codex', [{ title: 'Test', description: 'desc' }]);
      const geminiAnalysis = createMockAnalysis('gemini', [{ title: 'Test', description: 'desc' }]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis], {
        includeIndividualAnalyses: true,
      });

      expect(result.individualAnalyses).toBeDefined();
      expect(result.individualAnalyses?.codex).toBeDefined();
      expect(result.individualAnalyses?.gemini).toBeDefined();
    });

    it('should not include individual analyses by default', () => {
      const codexAnalysis = createMockAnalysis('codex', [{ title: 'Test', description: 'desc' }]);

      const result = aggregator.mergeAnalyses([codexAnalysis]);

      expect(result.individualAnalyses).toBeUndefined();
    });

    it('should handle empty findings', () => {
      const codexAnalysis = createMockAnalysis('codex', []);
      const geminiAnalysis = createMockAnalysis('gemini', []);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings.length).toBe(0);
      expect(result.summary.totalFindings).toBe(0);
      expect(result.summary.consensus).toBe(100);
    });

    it('should generate overall assessment mentioning critical issues', () => {
      const analysis = createMockAnalysis('codex', [
        { title: 'Critical Bug', description: 'desc', severity: 'critical' },
      ]);

      const result = aggregator.mergeAnalyses([analysis]);

      expect(result.overallAssessment).toContain('critical');
    });

    it('should generate overall assessment mentioning high severity issues', () => {
      const analysis = createMockAnalysis('codex', [
        { title: 'High Bug', description: 'desc', severity: 'high' },
      ]);

      const result = aggregator.mergeAnalyses([analysis]);

      expect(result.overallAssessment).toContain('high-severity');
    });

    it('should note good code quality when no critical/high issues', () => {
      const analysis = createMockAnalysis('codex', [
        { title: 'Minor Issue', description: 'desc', severity: 'low' },
      ]);

      const result = aggregator.mergeAnalyses([analysis]);

      expect(result.overallAssessment).toContain('good');
    });
  });

  describe('deduplication', () => {
    it('should deduplicate identical findings from different sources', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'SQL Injection', description: 'Unsafe query on line 10', line: 10, severity: 'critical' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'SQL Injection', description: 'Unsafe query on line 10', line: 10, severity: 'critical' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings.length).toBe(1);
      expect(result.findings[0].sources).toContain('codex');
      expect(result.findings[0].sources).toContain('gemini');
    });

    it('should mark deduplicated findings with high confidence', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Same Issue', description: 'Same description', line: 5 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Same Issue', description: 'Same description', line: 5 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings[0].confidence).toBe('high');
    });

    it('should keep unique findings separate', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'SQL Injection', description: 'Database issue', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'XSS Vulnerability', description: 'Browser issue', line: 20 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings.length).toBe(2);
    });

    it('should use highest severity among duplicates', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Issue on line 10', description: 'Same issue', line: 10, severity: 'medium' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Issue on line 10', description: 'Same issue', line: 10, severity: 'critical' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings[0].severity).toBe('critical');
    });

    it('should handle deduplication when disabled', () => {
      const disabledConfig: AggregatorConfig = {
        deduplication: {
          enabled: false,
          similarityThreshold: 0.8,
        },
      };
      const disabledAggregator = new AnalysisAggregator(disabledConfig, mockLogger);

      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Same Issue', description: 'Same', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Same Issue', description: 'Same', line: 10 },
      ]);

      const result = disabledAggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings.length).toBe(2);
    });
  });

  describe('similarity calculation', () => {
    it('should consider same line + same type as high similarity', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Bug A', description: 'Description A', line: 10, type: 'security' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Bug B', description: 'Description B', line: 10, type: 'security' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      // Should deduplicate as they're on same line with same type
      expect(result.findings.length).toBe(1);
    });

    it('should consider similar titles as similar findings when on same line', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'SQL Injection vulnerability in query', description: 'Unsafe query', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'SQL Injection vulnerability detected', description: 'Unsafe database query', line: 10 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      // Should deduplicate due to same line
      expect(result.findings.length).toBe(1);
    });

    it('should keep findings with similar titles but different lines separate', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'SQL Injection vulnerability in query', description: 'Unsafe query', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'SQL Injection vulnerability detected', description: 'Unsafe database query', line: 20 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      // Different lines means separate findings even with similar titles
      expect(result.findings.length).toBe(2);
    });

    it('should keep different findings separate', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Memory leak in module A', description: 'Resources not freed' },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'XSS in template rendering', description: 'Unescaped user input' },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings.length).toBe(2);
    });
  });

  describe('confidence calculation', () => {
    it('should return high confidence when all reviewers agree', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Same Finding', description: 'Same desc', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Same Finding', description: 'Same desc', line: 10 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.findings[0].confidence).toBe('high');
    });

    it('should return medium confidence when only one reviewer reports', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Unique Finding', description: 'Only codex found this', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Different Finding', description: 'Gemini found something else', line: 20 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      // Both findings should have medium confidence (50% agreement)
      expect(result.findings[0].confidence).toBe('medium');
      expect(result.findings[1].confidence).toBe('medium');
    });
  });

  describe('recommendations merging', () => {
    it('should merge recommendations from multiple analyses', () => {
      const codexAnalysis = createMockAnalysis('codex', [], {
        recommendations: ['Use parameterized queries', 'Add input validation'],
      });
      const geminiAnalysis = createMockAnalysis('gemini', [], {
        recommendations: ['Enable CSP headers', 'Use HTTPS'],
      });

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.recommendations.length).toBe(4);
    });

    it('should deduplicate identical recommendations', () => {
      const codexAnalysis = createMockAnalysis('codex', [], {
        recommendations: ['Use parameterized queries for SQL injection prevention'],
      });
      const geminiAnalysis = createMockAnalysis('gemini', [], {
        recommendations: ['Use parameterized queries for SQL injection prevention'],
      });

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.recommendations.length).toBe(1);
    });

    it('should keep distinct recommendations separate', () => {
      const codexAnalysis = createMockAnalysis('codex', [], {
        recommendations: ['Use parameterized queries'],
      });
      const geminiAnalysis = createMockAnalysis('gemini', [], {
        recommendations: ['Enable HTTPS everywhere'],
      });

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.recommendations.length).toBe(2);
    });

    it('should handle empty recommendations', () => {
      const codexAnalysis = createMockAnalysis('codex', [], { recommendations: [] });
      const geminiAnalysis = createMockAnalysis('gemini', [], { recommendations: undefined });

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.recommendations).toEqual([]);
    });
  });

  describe('consensus calculation', () => {
    it('should calculate 100% consensus for all high confidence findings', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Issue 1', description: 'desc', line: 10 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Issue 1', description: 'desc', line: 10 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.summary.consensus).toBe(100);
    });

    it('should calculate lower consensus for mixed confidence', () => {
      const codexAnalysis = createMockAnalysis('codex', [
        { title: 'Shared Issue', description: 'desc', line: 10 },
        { title: 'Codex Only', description: 'desc', line: 20 },
      ]);
      const geminiAnalysis = createMockAnalysis('gemini', [
        { title: 'Shared Issue', description: 'desc', line: 10 },
        { title: 'Gemini Only', description: 'desc', line: 30 },
      ]);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      // 1 high confidence (shared) + 2 medium confidence = 33% consensus
      expect(result.summary.consensus).toBeLessThan(100);
    });

    it('should return 100% consensus for empty findings', () => {
      const codexAnalysis = createMockAnalysis('codex', []);

      const result = aggregator.mergeAnalyses([codexAnalysis]);

      expect(result.summary.consensus).toBe(100);
    });
  });

  describe('metadata', () => {
    it('should include language from first analysis', () => {
      const codexAnalysis = createMockAnalysis('codex', [], {
        metadata: { analysisDuration: 100, language: 'typescript' },
      });

      const result = aggregator.mergeAnalyses([codexAnalysis]);

      expect(result.metadata.language).toBe('typescript');
    });

    it('should include individual durations', () => {
      const codexAnalysis = createMockAnalysis('codex', [], {
        metadata: { analysisDuration: 150 },
      });
      const geminiAnalysis = createMockAnalysis('gemini', [], {
        metadata: { analysisDuration: 200 },
      });

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.metadata.codexDuration).toBe(150);
      expect(result.metadata.geminiDuration).toBe(200);
    });

    it('should calculate total analysis duration', () => {
      const codexAnalysis = createMockAnalysis('codex', []);
      const geminiAnalysis = createMockAnalysis('gemini', []);

      const result = aggregator.mergeAnalyses([codexAnalysis, geminiAnalysis]);

      expect(result.metadata.analysisDuration).toBeGreaterThanOrEqual(0);
    });
  });
});
