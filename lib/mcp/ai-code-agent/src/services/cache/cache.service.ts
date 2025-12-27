/**
 * Cache Service
 * High-level caching service with getOrSet pattern
 */

import type { Logger } from '../../core/logger.js';
import type { CacheRepository, CacheSource } from '../../storage/repositories/cache.repository.js';
import { generateCacheKey, type CacheKeyParams } from './cache-key.js';

export interface CacheServiceConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  bySource: Record<CacheSource, number>;
}

/**
 * Cache Service
 * Provides high-level caching operations with automatic key generation
 */
export class CacheService {
  private repository: CacheRepository;
  private config: CacheServiceConfig;
  private logger: Logger | null;
  private stats: { hits: number; misses: number };

  constructor(
    repository: CacheRepository,
    config: CacheServiceConfig,
    logger?: Logger
  ) {
    this.repository = repository;
    this.config = config;
    this.logger = logger ?? null;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get cached result or execute function and cache result
   */
  async getOrSet<T>(
    params: CacheKeyParams,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<{ result: T; fromCache: boolean }> {
    if (!this.config.enabled) {
      const result = await fn();
      return { result, fromCache: false };
    }

    const cacheKey = generateCacheKey(params);

    // Try to get from cache
    const cached = this.repository.getResult<T>(cacheKey);
    if (cached !== null) {
      this.stats.hits++;
      this.logger?.debug({ cacheKey: cacheKey.substring(0, 16), source: params.source }, 'Cache hit');
      return { result: cached, fromCache: true };
    }

    // Execute function and cache result
    this.stats.misses++;
    this.logger?.debug({ cacheKey: cacheKey.substring(0, 16), source: params.source }, 'Cache miss');

    const result = await fn();

    // Store in cache (best-effort - don't fail if cache write fails)
    try {
      this.repository.set(cacheKey, params.source, result, ttl ?? this.config.ttl);
    } catch (error) {
      this.logger?.warn(
        { cacheKey: cacheKey.substring(0, 16), error: error instanceof Error ? error.message : String(error) },
        'Failed to write to cache (best-effort)'
      );
    }

    return { result, fromCache: false };
  }

  /**
   * Get cached result by key
   */
  get<T>(params: CacheKeyParams): T | null {
    if (!this.config.enabled) return null;

    const cacheKey = generateCacheKey(params);
    return this.repository.getResult<T>(cacheKey);
  }

  /**
   * Set cache entry
   */
  set<T>(params: CacheKeyParams, result: T, ttl?: number): void {
    if (!this.config.enabled) return;

    const cacheKey = generateCacheKey(params);
    this.repository.set(cacheKey, params.source, result, ttl ?? this.config.ttl);
  }

  /**
   * Check if entry exists in cache
   */
  has(params: CacheKeyParams): boolean {
    if (!this.config.enabled) return false;

    const cacheKey = generateCacheKey(params);
    return this.repository.has(cacheKey);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(params: CacheKeyParams): boolean {
    if (!this.config.enabled) return false;

    const cacheKey = generateCacheKey(params);
    return this.repository.delete(cacheKey);
  }

  /**
   * Invalidate all entries for a source
   */
  invalidateBySource(source: CacheSource): number {
    if (!this.config.enabled) return 0;

    return this.repository.clearBySource(source);
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    if (!this.config.enabled) return 0;

    this.stats = { hits: 0, misses: 0 };
    return this.repository.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    if (!this.config.enabled) return 0;

    return this.repository.deleteExpired();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const repoStats = this.repository.getStats();
    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      totalEntries: repoStats.totalEntries,
      bySource: repoStats.bySource,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.repository.size();
  }
}
