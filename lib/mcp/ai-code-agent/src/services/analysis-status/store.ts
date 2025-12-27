/**
 * Analysis Status Store
 * In-memory storage for async analysis tracking
 */

import type { AggregatedAnalysis, AnalysisResult } from '../../schemas/tools.js';

export type AnalysisStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface AnalysisStatusEntry {
  analysisId: string;
  status: AnalysisStatus;
  source: 'codex' | 'gemini' | 'combined';
  startTime: string;
  endTime?: string;
  result?: AnalysisResult | AggregatedAnalysis;
  error?: {
    code: string;
    message: string;
  };
  expiresAt?: string;
}

export class AnalysisStatusStore {
  private static instance: AnalysisStatusStore;
  private analyses: Map<string, AnalysisStatusEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_TTL_MS = 60 * 60 * 1000;

  private constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  static getInstance(): AnalysisStatusStore {
    if (!AnalysisStatusStore.instance) {
      AnalysisStatusStore.instance = new AnalysisStatusStore();
    }
    return AnalysisStatusStore.instance;
  }

  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];
    for (const [analysisId, entry] of this.analyses.entries()) {
      if (entry.expiresAt && now >= new Date(entry.expiresAt).getTime()) {
        expired.push(analysisId);
      }
    }
    expired.forEach(id => this.analyses.delete(id));
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  create(analysisId: string, source: 'codex' | 'gemini' | 'combined'): void {
    this.analyses.set(analysisId, {
      analysisId,
      status: 'pending',
      source,
      startTime: new Date().toISOString(),
    });
  }

  updateStatus(analysisId: string, status: AnalysisStatus): void {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      entry.status = status;
      if (status === 'completed' || status === 'failed') {
        const now = new Date();
        entry.endTime = now.toISOString();
        entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
      }
    }
  }

  setResult(analysisId: string, result: AnalysisResult | AggregatedAnalysis): void {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      const now = new Date();
      entry.status = 'completed';
      entry.result = result;
      entry.endTime = now.toISOString();
      entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
    }
  }

  setError(analysisId: string, error: { code: string; message: string }): void {
    const entry = this.analyses.get(analysisId);
    if (entry) {
      const now = new Date();
      entry.status = 'failed';
      entry.error = error;
      entry.endTime = now.toISOString();
      entry.expiresAt = new Date(now.getTime() + this.DEFAULT_TTL_MS).toISOString();
    }
  }

  get(analysisId: string): AnalysisStatusEntry | undefined {
    return this.analyses.get(analysisId);
  }

  has(analysisId: string): boolean {
    return this.analyses.has(analysisId);
  }

  delete(analysisId: string): boolean {
    return this.analyses.delete(analysisId);
  }

  clear(): void {
    this.analyses.clear();
  }

  getAllIds(): string[] {
    return Array.from(this.analyses.keys());
  }
}
