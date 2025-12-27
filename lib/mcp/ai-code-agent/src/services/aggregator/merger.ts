/**
 * Analysis Aggregator
 * Merges and deduplicates analyses from multiple sources
 */

import type { Logger } from '../../core/logger.js';
import { generateUUID } from '../../core/utils.js';
import type { AnalysisResult, AggregatedAnalysis, AggregatedFinding } from '../../schemas/tools.js';
import type { AnalysisFinding, Severity, Confidence } from '../../types/index.js';

export interface AggregatorConfig {
  deduplication?: {
    enabled: boolean;
    similarityThreshold: number;
  };
}

interface FindingWithSource extends AnalysisFinding {
  source: 'codex' | 'gemini';
}

/**
 * Analysis Aggregator
 */
export class AnalysisAggregator {
  constructor(
    private config: AggregatorConfig,
    private logger: Logger
  ) {}

  /**
   * Merge reviews from multiple sources
   */
  mergeAnalyses(
    reviews: AnalysisResult[],
    options?: { includeIndividualAnalyses?: boolean }
  ): AggregatedAnalysis {
    const startTime = Date.now();

    this.logger.info({ analysisCount: reviews.length }, 'Merging reviews');

    // Collect all findings with source information
    const allFindings: FindingWithSource[] = reviews.flatMap(review =>
      review.findings.map(finding => ({
        ...finding,
        source: review.source as 'codex' | 'gemini',
      }))
    );

    // CRITICAL FIX #4: Deduplicate findings with correct totalReviewers from reviews.length
    const deduplicated = this.config.deduplication?.enabled
      ? this.deduplicateFindings(allFindings, reviews.length)
      : allFindings.map(f => ({
          ...f,
          sources: [f.source],
          confidence: 'medium' as Confidence,
        }));

    // Sort by severity (highest first)
    const sorted = deduplicated.sort((a, b) => this.compareSeverity(a.severity, b.severity));

    // Calculate summary
    const summary = this.calculateAggregatedSummary(sorted, reviews.length);

    // Generate overall assessment
    const overallAssessment = this.generateOverallAssessment(reviews, sorted);

    // Merge recommendations
    const recommendations = this.mergeRecommendations(reviews);

    const duration = Date.now() - startTime;

    this.logger.info(
      { duration, totalFindings: sorted.length, consensus: summary.consensus },
      'Reviews merged'
    );

    const result: AggregatedAnalysis = {
      success: true,
      analysisId: generateUUID(),
      timestamp: new Date().toISOString(),
      source: 'combined',
      summary,
      findings: sorted,
      overallAssessment,
      recommendations,
      metadata: {
        language: reviews[0]?.metadata.language,
        linesOfCode: reviews[0]?.metadata.linesOfCode ?? 0,
        analysisDuration: duration,
        codexDuration: reviews.find(r => r.source === 'codex')?.metadata.analysisDuration,
        geminiDuration: reviews.find(r => r.source === 'gemini')?.metadata.analysisDuration,
      },
    };

    // Include individual reviews if requested
    if (options?.includeIndividualAnalyses) {
      result.individualAnalyses = {
        codex: reviews.find(r => r.source === 'codex'),
        gemini: reviews.find(r => r.source === 'gemini'),
      };
    }

    return result;
  }

  /**
   * Deduplicate findings by similarity matching
   * CRITICAL FIX #4: Pass total reviewers from reviews.length, not from findings
   */
  private deduplicateFindings(
    findings: FindingWithSource[],
    totalReviewers: number
  ): AggregatedFinding[] {
    const threshold = this.config.deduplication?.similarityThreshold ?? 0.8;
    const deduplicated: AggregatedFinding[] = [];
    const processed = new Set<number>();
    const lineBuckets = new Map<number, number[]>();
    const titleBuckets = new Map<string, number[]>();

    // Pre-bucket findings to reduce comparisons
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      if (!finding) continue;

      if (finding.line !== null) {
        const bucket = lineBuckets.get(finding.line) ?? [];
        bucket.push(i);
        lineBuckets.set(finding.line, bucket);
      }

      const titleKey = this.buildTitleKey(finding.title);
      if (titleKey) {
        const bucket = titleBuckets.get(titleKey) ?? [];
        bucket.push(i);
        titleBuckets.set(titleKey, bucket);
      }
    }

    for (let i = 0; i < findings.length; i++) {
      if (processed.has(i)) continue;

      const current = findings[i];
      if (!current) continue; // Skip if undefined

      const sources: Array<'codex' | 'gemini'> = [current.source];
      const similarIndices: number[] = [];

      const candidates = new Set<number>();
      if (current.line !== null) {
        for (const idx of lineBuckets.get(current.line) ?? []) {
          candidates.add(idx);
        }
      }
      const currentTitleKey = this.buildTitleKey(current.title);
      if (currentTitleKey) {
        for (const idx of titleBuckets.get(currentTitleKey) ?? []) {
          candidates.add(idx);
        }
      }

      // Fallback: if no candidates, compare against all remaining items
      const candidateList =
        candidates.size > 0
          ? Array.from(candidates)
          : Array.from({ length: findings.length - i - 1 }, (_, idx) => i + 1 + idx);

      // Find similar findings
      for (const j of candidateList) {
        if (j <= i || processed.has(j)) continue;

        const otherFinding = findings[j];
        if (!otherFinding) continue; // Skip if undefined

        const similarity = this.calculateSimilarity(current, otherFinding);
        if (similarity >= threshold) {
          sources.push(otherFinding.source);
          similarIndices.push(j);
        }
      }

      // Mark similar findings as processed
      similarIndices.forEach(idx => processed.add(idx));

      // CRITICAL FIX #4: Determine confidence based on actual total reviewers
      // Use totalReviewers parameter, NOT derived from findings sources
      const confidence = this.determineConfidence(sources.length, totalReviewers);

      // Use highest severity among duplicates
      const allSimilar = [
        current,
        ...similarIndices
          .map(idx => findings[idx])
          .filter((f): f is FindingWithSource => f !== undefined),
      ];
      const highestSeverity = this.getHighestSeverity(allSimilar.map(f => f.severity));

      deduplicated.push({
        type: current.type,
        severity: highestSeverity,
        line: current.line,
        lineRange: current.lineRange,
        title: current.title,
        description: current.description,
        suggestion: current.suggestion,
        code: current.code,
        sources: Array.from(new Set(sources)),
        confidence,
      });
    }

    return deduplicated;
  }

  /**
   * Build a lightweight title key to bucket similar findings
   */
  private buildTitleKey(title: string): string | null {
    const tokens = title
      .toLowerCase()
      .split(/\W+/)
      .filter(token => token.length >= 3);

    if (tokens.length === 0) return null;

    return tokens.slice(0, 4).join('|');
  }

  /**
   * Calculate similarity between two findings
   */
  private calculateSimilarity(a: AnalysisFinding, b: AnalysisFinding): number {
    // Check if same line
    const sameLine = a.line !== null && b.line !== null && a.line === b.line;
    if (sameLine) {
      // Same line + same type = high similarity
      if (a.type === b.type) return 1.0;
      // Same line + different type = medium similarity
      return 0.7;
    }

    // Check line range overlap
    if (a.lineRange && b.lineRange) {
      const overlap = this.calculateLineRangeOverlap(a.lineRange, b.lineRange);
      if (overlap > 0.5 && a.type === b.type) {
        return 0.8;
      }
    }

    // Compare text similarity
    const titleSimilarity = this.textSimilarity(a.title, b.title);
    const descSimilarity = this.textSimilarity(a.description, b.description);

    // Weight title more heavily
    return titleSimilarity * 0.6 + descSimilarity * 0.4;
  }

  /**
   * Calculate line range overlap percentage
   */
  private calculateLineRangeOverlap(
    range1: { start: number; end: number },
    range2: { start: number; end: number }
  ): number {
    const overlapStart = Math.max(range1.start, range2.start);
    const overlapEnd = Math.min(range1.end, range2.end);
    const overlapSize = Math.max(0, overlapEnd - overlapStart + 1);

    const range1Size = range1.end - range1.start + 1;
    const range2Size = range2.end - range2.start + 1;
    const minRangeSize = Math.min(range1Size, range2Size);

    return overlapSize / minRangeSize;
  }

  /**
   * Calculate text similarity using Jaccard similarity (token overlap)
   */
  private textSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\W+/).filter(Boolean));
    const tokens2 = new Set(text2.toLowerCase().split(/\W+/).filter(Boolean));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Determine confidence level based on reviewer agreement
   */
  private determineConfidence(agreeCount: number, totalReviewers: number): Confidence {
    const agreement = agreeCount / totalReviewers;

    if (agreement >= 0.8) return 'high';
    if (agreement >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Get highest severity from list
   */
  private getHighestSeverity(severities: Severity[]): Severity {
    const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of order) {
      if (severities.includes(sev)) return sev;
    }
    return 'info';
  }

  /**
   * Compare severities for sorting (higher severity first)
   */
  private compareSeverity(a: Severity, b: Severity): number {
    const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
    return order.indexOf(a) - order.indexOf(b);
  }

  /**
   * Calculate aggregated summary with consensus
   */
  private calculateAggregatedSummary(
    findings: AggregatedFinding[],
    _reviewerCount: number
  ): {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    consensus: number;
  } {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let highConfidence = 0;

    for (const finding of findings) {
      if (finding.severity === 'critical') critical++;
      else if (finding.severity === 'high') high++;
      else if (finding.severity === 'medium') medium++;
      else if (finding.severity === 'low') low++;
      if (finding.confidence === 'high') highConfidence++;
    }

    const totalFindings = findings.length;
    const consensus =
      totalFindings > 0 ? Math.round((highConfidence / totalFindings) * 100) : 100;

    return {
      totalFindings,
      critical,
      high,
      medium,
      low,
      consensus,
    };
  }

  /**
   * Generate overall assessment from multiple reviews
   */
  private generateOverallAssessment(
    reviews: AnalysisResult[],
    findings: AggregatedFinding[]
  ): string {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;

    let combined = `Combined review from ${reviews.length} reviewer(s): `;

    if (critical > 0) {
      combined += `Found ${critical} critical issue${critical > 1 ? 's' : ''} that require immediate attention. `;
    }

    if (high > 0) {
      combined += `Found ${high} high-severity issue${high > 1 ? 's' : ''} that should be addressed. `;
    }

    if (critical === 0 && high === 0) {
      combined += `Code quality is good with only minor issues identified. `;
    }

    // Add reviewer agreement note
    const highConfidence = findings.filter(f => f.confidence === 'high').length;
    if (highConfidence > findings.length * 0.5) {
      combined += `Reviewers show strong agreement on most findings.`;
    }

    return combined;
  }

  /**
   * Merge recommendations from multiple reviews
   */
  private mergeRecommendations(reviews: AnalysisResult[]): string[] {
    const allRecommendations = reviews.flatMap(r => r.recommendations ?? []).filter(Boolean);

    if (allRecommendations.length === 0) {
      return [];
    }

    // Deduplicate recommendations by similarity
    const unique: string[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < allRecommendations.length; i++) {
      if (processed.has(i)) continue;

      const current = allRecommendations[i];
      if (!current) continue; // Skip undefined

      let isDuplicate = false;

      for (let j = 0; j < unique.length; j++) {
        const uniqueItem = unique[j];
        if (uniqueItem && this.textSimilarity(current, uniqueItem) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(current);
      }

      processed.add(i);
    }

    return unique;
  }
}
