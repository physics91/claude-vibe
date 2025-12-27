/**
 * Result Formatter
 * Responsible for formatting analysis results as markdown
 * SOLID: Single Responsibility - only handles result formatting
 */

import type { AggregatedAnalysis, AnalysisResult } from '../../schemas/tools.js';

export interface FormatOptions {
  maxFindings?: number;
  maxCodeSnippetLength?: number;
  maxOutputChars?: number;
}

export interface SecretScanResult {
  scanId: string;
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<string, number>;
  };
  findings: Array<{
    type: string;
    severity: string;
    line: number | null;
    title: string;
    description: string;
    suggestion?: string;
  }>;
  metadata: {
    duration: number;
    patternsUsed: number;
    fileName?: string;
  };
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  info: '⚪',
};

/**
 * Result Formatter
 * Formats analysis and scan results as markdown
 */
export class ResultFormatter {
  /**
   * Format analysis result as markdown
   */
  static formatAnalysis(
    result: AnalysisResult | AggregatedAnalysis,
    options?: FormatOptions
  ): string {
    const lines: string[] = [];
    const maxFindings =
      typeof options?.maxFindings === 'number' && options.maxFindings > 0
        ? options.maxFindings
        : Number.POSITIVE_INFINITY;
    const maxCodeSnippetLength =
      typeof options?.maxCodeSnippetLength === 'number' && options.maxCodeSnippetLength > 0
        ? options.maxCodeSnippetLength
        : Number.POSITIVE_INFINITY;

    // Overall Assessment
    lines.push('## Overall Assessment\n');
    lines.push(result.overallAssessment);
    lines.push('');

    // Summary
    if (result.summary.totalFindings > 0) {
      lines.push('## Summary\n');
      lines.push(`- **Total Issues:** ${result.summary.totalFindings}`);
      if (result.summary.critical > 0) lines.push(`- **Critical:** ${result.summary.critical}`);
      if (result.summary.high > 0) lines.push(`- **High:** ${result.summary.high}`);
      if (result.summary.medium > 0) lines.push(`- **Medium:** ${result.summary.medium}`);
      if (result.summary.low > 0) lines.push(`- **Low:** ${result.summary.low}`);
      lines.push('');
    }

    // Findings
    if (result.findings.length > 0) {
      lines.push('## Findings\n');
      const findingsToRender = result.findings.slice(0, maxFindings);
      findingsToRender.forEach((finding, index) => {
        const severityEmoji = SEVERITY_EMOJI[finding.severity] ?? '⚪';

        lines.push(`### ${index + 1}. ${severityEmoji} ${finding.title}`);
        lines.push(`**Severity:** ${finding.severity.toUpperCase()} | **Type:** ${finding.type}`);
        if (finding.line) lines.push(`**Line:** ${finding.line}`);
        lines.push('');
        lines.push(`**Description:**`);
        lines.push(finding.description);
        lines.push('');
        if (finding.suggestion) {
          lines.push(`**Suggestion:**`);
          lines.push(finding.suggestion);
          lines.push('');
        }
        if (finding.code) {
          const code =
            finding.code.length > maxCodeSnippetLength
              ? `${finding.code.slice(0, maxCodeSnippetLength)}\n... (truncated)`
              : finding.code;
          lines.push('**Code:**');
          lines.push('```');
          lines.push(code);
          lines.push('```');
          lines.push('');
        }
      });

      if (result.findings.length > findingsToRender.length) {
        lines.push(
          `*Showing ${findingsToRender.length} of ${result.findings.length} findings. Increase maxFindings to view more.*`
        );
        lines.push('');
      }
    }

    // Recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      lines.push('## Recommendations\n');
      result.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }

    // Metadata footer
    lines.push('---');
    lines.push(`*Analysis ID: ${result.analysisId} | Source: ${result.source}*`);

    // Feedback request message
    lines.push('');
    lines.push(
      '**Do you agree with this analysis?** If you have any objections or additional context, please share your feedback.'
    );

    const output = lines.join('\n');
    if (
      typeof options?.maxOutputChars === 'number' &&
      options.maxOutputChars > 0 &&
      output.length > options.maxOutputChars
    ) {
      return `${output.slice(0, options.maxOutputChars)}\n\n...[truncated]`;
    }

    return output;
  }

  /**
   * Format secret scan result as markdown
   */
  static formatSecretScan(result: SecretScanResult): string {
    const lines: string[] = [];

    lines.push('# Secret Scan Results\n');

    // Summary
    if (result.summary.totalFindings === 0) {
      lines.push('No secrets detected in the code.\n');
    } else {
      lines.push('## Summary\n');
      lines.push(`- **Total Secrets Found:** ${result.summary.totalFindings}`);
      if (result.summary.critical > 0) lines.push(`- **Critical:** ${result.summary.critical}`);
      if (result.summary.high > 0) lines.push(`- **High:** ${result.summary.high}`);
      if (result.summary.medium > 0) lines.push(`- **Medium:** ${result.summary.medium}`);
      if (result.summary.low > 0) lines.push(`- **Low:** ${result.summary.low}`);
      lines.push('');

      // By category
      const categories = Object.entries(result.summary.byCategory);
      if (categories.length > 0) {
        lines.push('### By Category\n');
        for (const [category, count] of categories) {
          lines.push(`- **${category.replace(/_/g, ' ')}:** ${count}`);
        }
        lines.push('');
      }

      // Findings
      lines.push('## Findings\n');
      result.findings.forEach((finding, index) => {
        const severityEmoji = SEVERITY_EMOJI[finding.severity] ?? '⚪';

        lines.push(`### ${index + 1}. ${severityEmoji} ${finding.title}`);
        lines.push(`**Severity:** ${finding.severity.toUpperCase()}`);
        if (finding.line) lines.push(`**Line:** ${finding.line}`);
        lines.push('');
        lines.push(finding.description);
        lines.push('');
        if (finding.suggestion) {
          lines.push(`**Recommendation:** ${finding.suggestion}`);
          lines.push('');
        }
      });
    }

    // Metadata
    lines.push('---');
    lines.push(
      `*Scan ID: ${result.scanId} | Patterns: ${result.metadata.patternsUsed} | Duration: ${result.metadata.duration}ms*`
    );

    return lines.join('\n');
  }

  /**
   * Group findings by category
   */
  static groupByCategory(findings: Array<{ category: string }>): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const finding of findings) {
      groups[finding.category] = (groups[finding.category] ?? 0) + 1;
    }
    return groups;
  }
}
