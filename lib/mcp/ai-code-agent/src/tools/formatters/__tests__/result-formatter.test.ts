/**
 * Result Formatter Tests
 * Tests for markdown formatting of analysis and scan results
 */

import { describe, it, expect } from 'vitest';
import { ResultFormatter, type SecretScanResult } from '../result-formatter.js';
import type { AnalysisResult } from '../../../schemas/tools.js';

describe('ResultFormatter', () => {
  describe('formatAnalysis', () => {
    const createMockAnalysisResult = (overrides = {}): AnalysisResult => ({
      analysisId: 'test-123',
      timestamp: '2024-01-01T00:00:00Z',
      source: 'codex',
      success: true,
      summary: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      overallAssessment: 'Code looks good',
      recommendations: [],
      metadata: { analysisDuration: 100 },
      ...overrides,
    });

    it('should format basic analysis result', () => {
      const result = createMockAnalysisResult();
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('## Overall Assessment');
      expect(formatted).toContain('Code looks good');
      expect(formatted).toContain('Analysis ID: test-123');
      expect(formatted).toContain('Source: codex');
    });

    it('should format summary with finding counts', () => {
      const result = createMockAnalysisResult({
        summary: { totalFindings: 5, critical: 1, high: 2, medium: 1, low: 1 },
      });
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('**Total Issues:** 5');
      expect(formatted).toContain('**Critical:** 1');
      expect(formatted).toContain('**High:** 2');
      expect(formatted).toContain('**Medium:** 1');
      expect(formatted).toContain('**Low:** 1');
    });

    it('should omit summary section when no findings', () => {
      const result = createMockAnalysisResult();
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).not.toContain('## Summary');
    });

    it('should format findings with severity emojis', () => {
      const result = createMockAnalysisResult({
        summary: { totalFindings: 3, critical: 1, high: 1, medium: 1, low: 0 },
        findings: [
          {
            title: 'Critical Bug',
            type: 'security',
            severity: 'critical',
            description: 'This is critical',
            suggestion: 'Fix immediately',
          },
          {
            title: 'High Issue',
            type: 'bug',
            severity: 'high',
            description: 'This is high severity',
            line: 42,
          },
          {
            title: 'Medium Style',
            type: 'style',
            severity: 'medium',
            description: 'This is medium',
          },
        ],
      });
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('## Findings');
      expect(formatted).toContain('🔴 Critical Bug');
      expect(formatted).toContain('🟠 High Issue');
      expect(formatted).toContain('🟡 Medium Style');
      expect(formatted).toContain('**Line:** 42');
      expect(formatted).toContain('**Suggestion:**');
      expect(formatted).toContain('Fix immediately');
    });

    it('should format findings with code snippets', () => {
      const result = createMockAnalysisResult({
        summary: { totalFindings: 1, critical: 0, high: 1, medium: 0, low: 0 },
        findings: [
          {
            title: 'Code Issue',
            type: 'bug',
            severity: 'high',
            description: 'Found issue',
            code: 'const x = 1;\nconst y = 2;',
          },
        ],
      });
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('**Code:**');
      expect(formatted).toContain('```');
      expect(formatted).toContain('const x = 1;');
    });

    it('should truncate long code snippets', () => {
      const longCode = 'x'.repeat(1000);
      const result = createMockAnalysisResult({
        summary: { totalFindings: 1, critical: 0, high: 1, medium: 0, low: 0 },
        findings: [
          {
            title: 'Long Code',
            type: 'bug',
            severity: 'high',
            description: 'Found issue',
            code: longCode,
          },
        ],
      });
      const formatted = ResultFormatter.formatAnalysis(result, { maxCodeSnippetLength: 100 });

      expect(formatted).toContain('... (truncated)');
      expect(formatted).not.toContain('x'.repeat(1000));
    });

    it('should limit number of findings shown', () => {
      const findings = Array(10)
        .fill(null)
        .map((_, i) => ({
          title: `Finding ${i + 1}`,
          type: 'bug',
          severity: 'medium' as const,
          description: `Description ${i + 1}`,
        }));

      const result = createMockAnalysisResult({
        summary: { totalFindings: 10, critical: 0, high: 0, medium: 10, low: 0 },
        findings,
      });
      const formatted = ResultFormatter.formatAnalysis(result, { maxFindings: 3 });

      expect(formatted).toContain('Finding 1');
      expect(formatted).toContain('Finding 2');
      expect(formatted).toContain('Finding 3');
      expect(formatted).not.toContain('Finding 4');
      expect(formatted).toContain('Showing 3 of 10 findings');
    });

    it('should format recommendations', () => {
      const result = createMockAnalysisResult({
        recommendations: [
          'Use TypeScript strict mode',
          'Add unit tests',
          'Consider code review',
        ],
      });
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('## Recommendations');
      expect(formatted).toContain('- Use TypeScript strict mode');
      expect(formatted).toContain('- Add unit tests');
      expect(formatted).toContain('- Consider code review');
    });

    it('should truncate output when exceeding maxOutputChars', () => {
      const longDescription = 'x'.repeat(10000);
      const result = createMockAnalysisResult({
        overallAssessment: longDescription,
      });
      const formatted = ResultFormatter.formatAnalysis(result, { maxOutputChars: 500 });

      expect(formatted.length).toBeLessThanOrEqual(530); // 500 + "[truncated]" message
      expect(formatted).toContain('...[truncated]');
    });

    it('should include feedback request message', () => {
      const result = createMockAnalysisResult();
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('Do you agree with this analysis?');
    });

    it('should handle unknown severity gracefully', () => {
      const result = createMockAnalysisResult({
        summary: { totalFindings: 1, critical: 0, high: 0, medium: 0, low: 0 },
        findings: [
          {
            title: 'Unknown Severity',
            type: 'unknown',
            severity: 'unknown' as any,
            description: 'Unknown issue',
          },
        ],
      });
      const formatted = ResultFormatter.formatAnalysis(result);

      expect(formatted).toContain('⚪ Unknown Severity'); // Falls back to ⚪
    });
  });

  describe('formatSecretScan', () => {
    const createMockSecretScanResult = (overrides = {}): SecretScanResult => ({
      scanId: 'scan-123',
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byCategory: {},
      },
      findings: [],
      metadata: {
        duration: 50,
        patternsUsed: 10,
      },
      ...overrides,
    });

    it('should format empty scan result', () => {
      const result = createMockSecretScanResult();
      const formatted = ResultFormatter.formatSecretScan(result);

      expect(formatted).toContain('# Secret Scan Results');
      expect(formatted).toContain('No secrets detected');
      expect(formatted).toContain('Scan ID: scan-123');
    });

    it('should format scan with findings', () => {
      const result = createMockSecretScanResult({
        summary: {
          totalFindings: 2,
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          byCategory: { api_key: 1, token: 1 },
        },
        findings: [
          {
            type: 'api_key',
            severity: 'critical',
            line: 5,
            title: 'AWS API Key',
            description: 'Found AWS API key',
            suggestion: 'Remove and rotate',
          },
          {
            type: 'token',
            severity: 'high',
            line: 10,
            title: 'GitHub Token',
            description: 'Found GitHub token',
          },
        ],
      });
      const formatted = ResultFormatter.formatSecretScan(result);

      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('**Total Secrets Found:** 2');
      expect(formatted).toContain('**Critical:** 1');
      expect(formatted).toContain('**High:** 1');
      expect(formatted).toContain('### By Category');
      expect(formatted).toContain('**api key:** 1');
      expect(formatted).toContain('**token:** 1');
      expect(formatted).toContain('## Findings');
      expect(formatted).toContain('🔴 AWS API Key');
      expect(formatted).toContain('🟠 GitHub Token');
      expect(formatted).toContain('**Line:** 5');
      expect(formatted).toContain('**Recommendation:** Remove and rotate');
    });

    it('should include metadata', () => {
      const result = createMockSecretScanResult({
        metadata: {
          duration: 150,
          patternsUsed: 25,
          fileName: 'config.ts',
        },
      });
      const formatted = ResultFormatter.formatSecretScan(result);

      expect(formatted).toContain('Patterns: 25');
      expect(formatted).toContain('Duration: 150ms');
    });

    it('should handle finding without line number', () => {
      const result = createMockSecretScanResult({
        summary: {
          totalFindings: 1,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          byCategory: { token: 1 },
        },
        findings: [
          {
            type: 'token',
            severity: 'high',
            line: null,
            title: 'Token Found',
            description: 'Found a token',
          },
        ],
      });
      const formatted = ResultFormatter.formatSecretScan(result);

      expect(formatted).not.toContain('**Line:**');
    });
  });

  describe('groupByCategory', () => {
    it('should group findings by category', () => {
      const findings = [
        { category: 'api_key' },
        { category: 'api_key' },
        { category: 'token' },
        { category: 'credential' },
        { category: 'api_key' },
      ];

      const result = ResultFormatter.groupByCategory(findings);

      expect(result).toEqual({
        api_key: 3,
        token: 1,
        credential: 1,
      });
    });

    it('should return empty object for empty array', () => {
      const result = ResultFormatter.groupByCategory([]);
      expect(result).toEqual({});
    });

    it('should handle single category', () => {
      const findings = [{ category: 'secret' }, { category: 'secret' }];

      const result = ResultFormatter.groupByCategory(findings);

      expect(result).toEqual({ secret: 2 });
    });
  });
});
