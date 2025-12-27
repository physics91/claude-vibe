/**
 * Common types for AI Code Agent MCP Server
 */

export type AnalysisSource = 'codex' | 'gemini' | 'combined';

export type FindingType = 'bug' | 'security' | 'performance' | 'style' | 'suggestion';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Confidence = 'high' | 'medium' | 'low';

export type AnalysisFocus = 'security' | 'performance' | 'style' | 'bugs' | 'all';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AnalysisFinding {
  type: FindingType;
  severity: Severity;
  line: number | null;
  lineRange?: {
    start: number;
    end: number;
  };
  title: string;
  description: string;
  suggestion?: string;
  code?: string;
}

export interface AnalysisSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ContextWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  tip?: string;
  field: string;
}

export interface ResolvedContext {
  threatModel?: string;
  platform?: string;
  projectType?: string;
  language?: string;
  framework?: string;
  scope?: string;
  fileName?: string;
}

export interface AnalysisMetadata {
  language?: string;
  linesOfCode?: number;
  analysisDuration: number;
  fromCache?: boolean;
  cacheKey?: string;
  resolvedContext?: ResolvedContext;
  warnings?: ContextWarning[];
  templateUsed?: string;
  autoDetected?: boolean;
}

export interface CodeAnalysisParams {
  code: string;
  language?: string;
  context?: {
    fileName?: string;
    projectType?: string;
    analysisFocus?: AnalysisFocus[];
  };
  options?: {
    timeout?: number;
    includeExplanations?: boolean;
    severity?: 'all' | 'high' | 'medium';
    cliPath?: string; // For Gemini
  };
}

export interface AnalysisResult {
  success: boolean;
  analysisId: string;
  timestamp: string;
  source: AnalysisSource;
  summary: AnalysisSummary;
  findings: AnalysisFinding[];
  overallAssessment: string;
  recommendations?: string[];
  metadata: AnalysisMetadata;
}

export interface AggregatedFinding extends AnalysisFinding {
  sources: AnalysisSource[];
  confidence: Confidence;
}

export interface AggregatedAnalysis
  extends Omit<AnalysisResult, 'source' | 'summary' | 'findings'> {
  source: 'combined';
  summary: AnalysisSummary & {
    consensus: number;
  };
  findings: AggregatedFinding[];
  individualAnalyses?: {
    codex?: AnalysisResult;
    gemini?: AnalysisResult;
  };
  metadata: AnalysisMetadata & {
    codexDuration?: number;
    geminiDuration?: number;
  };
}

export class BaseError extends Error {
  public code: string;

  constructor(
    message: string,
    code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}
