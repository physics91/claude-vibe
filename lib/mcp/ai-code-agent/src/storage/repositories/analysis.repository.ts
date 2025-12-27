/**
 * Analysis Repository
 * CRUD operations for analysis history
 */

import { eq, and, lt, desc, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import { analyses } from '../schema.js';
import type { Analysis, NewAnalysis } from '../schema.js';
import { BaseRepository } from './base.repository.js';
import type { Logger } from '../../core/logger.js';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AnalysisSource = 'codex' | 'gemini' | 'combined';

export interface AnalysisFilter {
  status?: AnalysisStatus;
  source?: AnalysisSource;
  limit?: number;
  offset?: number;
}

export interface AnalysisResult {
  findings?: unknown[];
  summary?: string;
  [key: string]: unknown;
}

export class AnalysisRepository extends BaseRepository {
  constructor(db: BetterSQLite3Database<typeof schema>, logger?: Logger) {
    super(db, logger);
  }

  /**
   * Create a new analysis record
   */
  create(data: {
    id: string;
    source: AnalysisSource;
    promptHash: string;
    context?: Record<string, unknown>;
    ttlMs?: number;
  }): Analysis {
    const now = this.getCurrentTimestamp();
    const expiresAt = data.ttlMs ? this.getExpirationTimestamp(data.ttlMs) : null;

    const newAnalysis: NewAnalysis = {
      id: data.id,
      source: data.source,
      status: 'pending',
      promptHash: data.promptHash,
      contextJson: data.context ? JSON.stringify(data.context) : null,
      createdAt: now,
      expiresAt,
    };

    this.db.insert(analyses).values(newAnalysis).run();
    this.logger?.debug({ id: data.id, source: data.source }, 'Analysis created');

    return this.findById(data.id)!;
  }

  /**
   * Find analysis by ID
   */
  findById(id: string): Analysis | null {
    const result = this.db.select().from(analyses).where(eq(analyses.id, id)).get();
    return result ?? null;
  }

  /**
   * Update analysis status
   */
  updateStatus(id: string, status: AnalysisStatus): Analysis | null {
    const updates: Partial<NewAnalysis> = { status };

    if (status === 'completed' || status === 'failed') {
      updates.completedAt = this.getCurrentTimestamp();
    }

    this.db.update(analyses).set(updates).where(eq(analyses.id, id)).run();
    this.logger?.debug({ id, status }, 'Analysis status updated');

    return this.findById(id);
  }

  /**
   * Complete analysis with result
   */
  complete(id: string, result: AnalysisResult): Analysis | null {
    this.db
      .update(analyses)
      .set({
        status: 'completed',
        resultJson: JSON.stringify(result),
        completedAt: this.getCurrentTimestamp(),
      })
      .where(eq(analyses.id, id))
      .run();

    this.logger?.debug({ id }, 'Analysis completed');
    return this.findById(id);
  }

  /**
   * Fail analysis with error
   */
  fail(id: string, errorCode: string, errorMessage: string): Analysis | null {
    this.db
      .update(analyses)
      .set({
        status: 'failed',
        errorCode,
        errorMessage,
        completedAt: this.getCurrentTimestamp(),
      })
      .where(eq(analyses.id, id))
      .run();

    this.logger?.debug({ id, errorCode }, 'Analysis failed');
    return this.findById(id);
  }

  /**
   * Find analyses with filters
   */
  find(filter: AnalysisFilter = {}): Analysis[] {
    let query = this.db.select().from(analyses).$dynamic();

    const conditions = [];
    if (filter.status) {
      conditions.push(eq(analyses.status, filter.status));
    }
    if (filter.source) {
      conditions.push(eq(analyses.source, filter.source));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(analyses.createdAt));

    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    if (filter.offset) {
      query = query.offset(filter.offset);
    }

    return query.all();
  }

  /**
   * Find pending or running analyses
   */
  findActive(): Analysis[] {
    return this.db
      .select()
      .from(analyses)
      .where(
        sql`${analyses.status} IN ('pending', 'running')`
      )
      .orderBy(desc(analyses.createdAt))
      .all();
  }

  /**
   * Delete analysis by ID
   */
  delete(id: string): boolean {
    const result = this.db.delete(analyses).where(eq(analyses.id, id)).run();
    const deleted = result.changes > 0;
    if (deleted) {
      this.logger?.debug({ id }, 'Analysis deleted');
    }
    return deleted;
  }

  /**
   * Delete expired analyses
   */
  deleteExpired(): number {
    const now = this.getCurrentTimestamp();
    const result = this.db
      .delete(analyses)
      .where(
        and(
          sql`${analyses.expiresAt} IS NOT NULL`,
          lt(analyses.expiresAt, now)
        )
      )
      .run();

    if (result.changes > 0) {
      this.logger?.info({ count: result.changes }, 'Deleted expired analyses');
    }
    return result.changes;
  }

  /**
   * Get analysis result parsed from JSON
   */
  getResult(id: string): AnalysisResult | null {
    const analysis = this.findById(id);
    if (!analysis?.resultJson) return null;

    try {
      return JSON.parse(analysis.resultJson) as AnalysisResult;
    } catch {
      this.logger?.warn({ id }, 'Failed to parse analysis result');
      return null;
    }
  }

  /**
   * Get analysis context parsed from JSON
   */
  getContext(id: string): Record<string, unknown> | null {
    const analysis = this.findById(id);
    if (!analysis?.contextJson) return null;

    try {
      return JSON.parse(analysis.contextJson) as Record<string, unknown>;
    } catch {
      this.logger?.warn({ id }, 'Failed to parse analysis context');
      return null;
    }
  }

  /**
   * Count analyses by status
   */
  countByStatus(): Record<AnalysisStatus, number> {
    const results = this.db
      .select({
        status: analyses.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(analyses)
      .groupBy(analyses.status)
      .all();

    const counts: Record<AnalysisStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of results) {
      counts[row.status as AnalysisStatus] = row.count;
    }

    return counts;
  }

  /**
   * Find by prompt hash (for potential cache lookup)
   */
  findByPromptHash(promptHash: string, source: AnalysisSource): Analysis | null {
    const result = this.db
      .select()
      .from(analyses)
      .where(
        and(
          eq(analyses.promptHash, promptHash),
          eq(analyses.source, source),
          eq(analyses.status, 'completed')
        )
      )
      .orderBy(desc(analyses.createdAt))
      .limit(1)
      .get();

    return result ?? null;
  }
}
