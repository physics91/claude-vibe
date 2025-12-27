/**
 * Cache Repository
 * CRUD operations for cache with LRU eviction support
 */

import { eq, lt, asc, sql, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import { cache } from '../schema.js';
import type { CacheEntry, NewCacheEntry } from '../schema.js';
import { BaseRepository } from './base.repository.js';
import type { Logger } from '../../core/logger.js';

export type CacheSource = 'codex' | 'gemini' | 'combined';

export interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  touchIntervalMs: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 1000,
  defaultTtlMs: 3600000, // 1 hour
  touchIntervalMs: 30000, // 30 seconds
};

export class CacheRepository extends BaseRepository {
  private config: CacheConfig;

  constructor(
    db: BetterSQLite3Database<typeof schema>,
    config?: Partial<CacheConfig>,
    logger?: Logger
  ) {
    super(db, logger);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached result by key
   * Updates hit count and last accessed time
   */
  get(cacheKey: string): CacheEntry | null {
    const entry = this.db
      .select()
      .from(cache)
      .where(eq(cache.cacheKey, cacheKey))
      .get();

    if (!entry) return null;

    // Check expiration
    if (this.isExpired(entry.expiresAt)) {
      this.delete(cacheKey);
      return null;
    }

    const now = Date.now();
    const lastAccessedMs = entry.lastAccessedAt ? new Date(entry.lastAccessedAt).getTime() : 0;
    const shouldTouch = now - lastAccessedMs >= this.config.touchIntervalMs;

    if (shouldTouch) {
      // Update hit count and last accessed time (throttled)
      this.db
        .update(cache)
        .set({
          hitCount: sql`${cache.hitCount} + 1`,
          lastAccessedAt: this.getCurrentTimestamp(),
        })
        .where(eq(cache.cacheKey, cacheKey))
        .run();

      this.logger?.debug({ cacheKey, hitCount: (entry.hitCount ?? 0) + 1 }, 'Cache hit');
    }
    return entry;
  }

  /**
   * Set cache entry
   * Performs LRU eviction if needed
   */
  set(
    cacheKey: string,
    source: CacheSource,
    result: unknown,
    ttlMs?: number
  ): CacheEntry {
    const now = this.getCurrentTimestamp();
    const expiresAt = this.getExpirationTimestamp(ttlMs ?? this.config.defaultTtlMs);
    const resultJson = JSON.stringify(result);

    // Check if entry exists
    const existing = this.db
      .select()
      .from(cache)
      .where(eq(cache.cacheKey, cacheKey))
      .get();

    if (existing) {
      // Update existing entry
      this.db
        .update(cache)
        .set({
          resultJson,
          expiresAt,
          lastAccessedAt: now,
        })
        .where(eq(cache.cacheKey, cacheKey))
        .run();

      this.logger?.debug({ cacheKey }, 'Cache updated');
      return this.db
        .select()
        .from(cache)
        .where(eq(cache.cacheKey, cacheKey))
        .get()!;
    }

    // Evict if at capacity
    this.evictIfNeeded();

    // Insert new entry
    const newEntry: NewCacheEntry = {
      cacheKey,
      source,
      resultJson,
      hitCount: 0,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
    };

    this.db.insert(cache).values(newEntry).run();
    this.logger?.debug({ cacheKey, source }, 'Cache entry created');

    return this.db
      .select()
      .from(cache)
      .where(eq(cache.cacheKey, cacheKey))
      .get()!;
  }

  /**
   * Delete cache entry by key
   */
  delete(cacheKey: string): boolean {
    const result = this.db.delete(cache).where(eq(cache.cacheKey, cacheKey)).run();
    const deleted = result.changes > 0;
    if (deleted) {
      this.logger?.debug({ cacheKey }, 'Cache entry deleted');
    }
    return deleted;
  }

  /**
   * Delete expired entries
   */
  deleteExpired(): number {
    const now = this.getCurrentTimestamp();
    const result = this.db.delete(cache).where(lt(cache.expiresAt, now)).run();

    if (result.changes > 0) {
      this.logger?.info({ count: result.changes }, 'Deleted expired cache entries');
    }
    return result.changes;
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    const result = this.db.delete(cache).run();
    this.logger?.info({ count: result.changes }, 'Cache cleared');
    return result.changes;
  }

  /**
   * Clear cache by source
   */
  clearBySource(source: CacheSource): number {
    const result = this.db.delete(cache).where(eq(cache.source, source)).run();
    this.logger?.info({ source, count: result.changes }, 'Cache cleared by source');
    return result.changes;
  }

  /**
   * Get cache size (entry count)
   */
  size(): number {
    const result = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(cache)
      .get();
    return result?.count ?? 0;
  }

  /**
   * Check if key exists and is not expired
   */
  has(cacheKey: string): boolean {
    const entry = this.db
      .select({ expiresAt: cache.expiresAt })
      .from(cache)
      .where(eq(cache.cacheKey, cacheKey))
      .get();

    if (!entry) return false;
    return !this.isExpired(entry.expiresAt);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    totalHits: number;
    bySource: Record<CacheSource, number>;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const totalEntries = this.size();

    const hitResult = this.db
      .select({ total: sql<number>`COALESCE(SUM(${cache.hitCount}), 0)` })
      .from(cache)
      .get();
    const totalHits = hitResult?.total ?? 0;

    const sourceResults = this.db
      .select({
        source: cache.source,
        count: sql<number>`COUNT(*)`,
      })
      .from(cache)
      .groupBy(cache.source)
      .all();

    const bySource: Record<CacheSource, number> = {
      codex: 0,
      gemini: 0,
      combined: 0,
    };
    for (const row of sourceResults) {
      bySource[row.source as CacheSource] = row.count;
    }

    const oldest = this.db
      .select({ createdAt: cache.createdAt })
      .from(cache)
      .orderBy(asc(cache.createdAt))
      .limit(1)
      .get();

    const newest = this.db
      .select({ createdAt: cache.createdAt })
      .from(cache)
      .orderBy(desc(cache.createdAt))
      .limit(1)
      .get();

    return {
      totalEntries,
      totalHits,
      bySource,
      oldestEntry: oldest?.createdAt ?? null,
      newestEntry: newest?.createdAt ?? null,
    };
  }

  /**
   * Perform LRU eviction if at capacity
   */
  private evictIfNeeded(): void {
    const currentSize = this.size();
    if (currentSize < this.config.maxSize) return;

    // Calculate how many to evict (10% of max size)
    const toEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1));

    // Find least recently accessed entries
    const lruEntries = this.db
      .select({ id: cache.id })
      .from(cache)
      .orderBy(asc(cache.lastAccessedAt))
      .limit(toEvict)
      .all();

    if (lruEntries.length === 0) return;

    const ids = lruEntries.map(e => e.id);
    this.db
      .delete(cache)
      .where(sql`${cache.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
      .run();

    this.logger?.info({ evicted: lruEntries.length }, 'LRU cache eviction performed');
  }

  /**
   * Get parsed result from cache
   */
  getResult<T = unknown>(cacheKey: string): T | null {
    const entry = this.get(cacheKey);
    if (!entry) return null;

    try {
      return JSON.parse(entry.resultJson) as T;
    } catch {
      this.logger?.warn({ cacheKey }, 'Failed to parse cached result');
      return null;
    }
  }
}
