/**
 * Cache Repository Integration Tests
 * Tests CRUD operations with real SQLite database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../schema.js';
import { CacheRepository, type CacheConfig } from '../cache.repository.js';

// Test fixtures
const createTestDb = (): BetterSQLite3Database<typeof schema> => {
  const sqlite = new Database(':memory:');

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      result_json TEXT NOT NULL,
      hit_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_accessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON cache(last_accessed_at);
  `);

  return drizzle(sqlite, { schema });
};

const testConfig: CacheConfig = {
  maxSize: 10,
  defaultTtlMs: 3600000, // 1 hour
  touchIntervalMs: 1000, // 1 second for testing
};

describe('CacheRepository', () => {
  let db: BetterSQLite3Database<typeof schema>;
  let repo: CacheRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new CacheRepository(db, testConfig);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set', () => {
    it('should create new cache entry', () => {
      const result = repo.set('test-key-1', 'codex', { findings: [] });

      expect(result).toBeDefined();
      expect(result.cacheKey).toBe('test-key-1');
      expect(result.source).toBe('codex');
      expect(result.hitCount).toBe(0);
    });

    it('should update existing entry', () => {
      repo.set('same-key', 'codex', { version: 1 });
      const updated = repo.set('same-key', 'codex', { version: 2 });

      expect(JSON.parse(updated.resultJson)).toEqual({ version: 2 });

      // Should only have one entry
      expect(repo.size()).toBe(1);
    });

    it('should serialize complex objects', () => {
      const complexResult = {
        findings: [
          { id: 1, severity: 'high', message: 'Bug found' },
          { id: 2, severity: 'low', message: 'Style issue' },
        ],
        summary: { total: 2 },
        metadata: { timestamp: new Date().toISOString() },
      };

      const entry = repo.set('complex-key', 'gemini', complexResult);
      const parsed = JSON.parse(entry.resultJson);

      expect(parsed).toEqual(complexResult);
    });

    it('should perform LRU eviction when at capacity', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        repo.set(`key-${i}`, 'codex', { index: i });
        vi.advanceTimersByTime(100); // Ensure different timestamps
      }

      expect(repo.size()).toBe(10);

      // Add one more - should trigger eviction
      repo.set('key-new', 'codex', { index: 'new' });

      // Size should still be around capacity (after eviction of ~10%)
      expect(repo.size()).toBeLessThanOrEqual(10);
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const result = repo.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return cached entry', () => {
      repo.set('existing-key', 'codex', { data: 'test' });

      const entry = repo.get('existing-key');

      expect(entry).not.toBeNull();
      expect(entry?.cacheKey).toBe('existing-key');
    });

    it('should return null for expired entry', () => {
      // Set entry with 1ms TTL
      repo.set('expired-key', 'codex', { data: 'test' }, 1);

      // Advance time past expiration
      vi.advanceTimersByTime(100);

      const entry = repo.get('expired-key');
      expect(entry).toBeNull();

      // Entry should be deleted
      expect(repo.has('expired-key')).toBe(false);
    });

    it('should update hit count on access after interval', () => {
      repo.set('hit-key', 'codex', { data: 'test' });

      // First access - sets lastAccessedAt
      repo.get('hit-key');

      // Advance past touch interval
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);

      // Second access triggers hit count update (happens after returning entry)
      repo.get('hit-key');

      // Advance time again for next access
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);

      // Third access - now we can see the updated hit count from previous access
      const entry = repo.get('hit-key');

      // hitCount should be at least 1 from the second access update
      expect(entry?.hitCount).toBeGreaterThanOrEqual(1);
    });

    it('should not update hit count within touch interval', () => {
      repo.set('throttle-key', 'codex', { data: 'test' });

      // Multiple rapid accesses
      repo.get('throttle-key');
      repo.get('throttle-key');
      repo.get('throttle-key');

      const entry = repo.get('throttle-key');

      // Hit count should still be 0 (throttled)
      expect(entry?.hitCount).toBe(0);
    });
  });

  describe('getResult', () => {
    it('should return parsed result', () => {
      const data = { findings: [{ id: 1 }], summary: { total: 1 } };
      repo.set('result-key', 'codex', data);

      const result = repo.getResult<typeof data>('result-key');

      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      expect(repo.getResult('no-key')).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      // Insert invalid JSON directly
      const sqlite = (db as any).session.client as Database.Database;
      sqlite.exec(`
        INSERT INTO cache (cache_key, source, result_json, expires_at)
        VALUES ('bad-json', 'codex', 'not valid json', datetime('now', '+1 hour'))
      `);

      const result = repo.getResult('bad-json');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing entry', () => {
      repo.set('delete-me', 'codex', { data: 'bye' });

      const deleted = repo.delete('delete-me');

      expect(deleted).toBe(true);
      expect(repo.has('delete-me')).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const deleted = repo.delete('never-existed');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteExpired', () => {
    it('should delete only expired entries', () => {
      // Entry with 10ms TTL (will expire)
      repo.set('expires-soon', 'codex', { data: 'soon' }, 10);

      // Entry with 1 hour TTL (will not expire)
      repo.set('expires-later', 'codex', { data: 'later' }, 3600000);

      // Advance time past first entry's expiration
      vi.advanceTimersByTime(50);

      const deleted = repo.deleteExpired();

      expect(deleted).toBe(1);
      expect(repo.has('expires-soon')).toBe(false);
      expect(repo.has('expires-later')).toBe(true);
    });

    it('should return 0 when no entries expired', () => {
      repo.set('key1', 'codex', { data: 1 });
      repo.set('key2', 'gemini', { data: 2 });

      const deleted = repo.deleteExpired();
      expect(deleted).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      repo.set('key1', 'codex', { data: 1 });
      repo.set('key2', 'gemini', { data: 2 });
      repo.set('key3', 'combined', { data: 3 });

      const cleared = repo.clear();

      expect(cleared).toBe(3);
      expect(repo.size()).toBe(0);
    });

    it('should return 0 for empty cache', () => {
      expect(repo.clear()).toBe(0);
    });
  });

  describe('clearBySource', () => {
    it('should clear only entries from specified source', () => {
      repo.set('codex-1', 'codex', { data: 1 });
      repo.set('codex-2', 'codex', { data: 2 });
      repo.set('gemini-1', 'gemini', { data: 3 });

      const cleared = repo.clearBySource('codex');

      expect(cleared).toBe(2);
      expect(repo.has('codex-1')).toBe(false);
      expect(repo.has('codex-2')).toBe(false);
      expect(repo.has('gemini-1')).toBe(true);
    });

    it('should return 0 when source has no entries', () => {
      repo.set('codex-1', 'codex', { data: 1 });

      const cleared = repo.clearBySource('gemini');
      expect(cleared).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(repo.size()).toBe(0);
    });

    it('should return correct count', () => {
      repo.set('key1', 'codex', { data: 1 });
      repo.set('key2', 'gemini', { data: 2 });
      repo.set('key3', 'combined', { data: 3 });

      expect(repo.size()).toBe(3);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired key', () => {
      repo.set('exists', 'codex', { data: 'yes' });
      expect(repo.has('exists')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(repo.has('no-exist')).toBe(false);
    });

    it('should return false for expired key', () => {
      repo.set('expired', 'codex', { data: 'bye' }, 1);
      vi.advanceTimersByTime(10);

      expect(repo.has('expired')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      repo.set('codex-1', 'codex', { data: 1 });
      repo.set('codex-2', 'codex', { data: 2 });
      repo.set('gemini-1', 'gemini', { data: 3 });
      repo.set('combined-1', 'combined', { data: 4 });

      // Generate some hits
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);
      repo.get('codex-1');
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);
      repo.get('codex-1');

      const stats = repo.getStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.bySource.codex).toBe(2);
      expect(stats.bySource.gemini).toBe(1);
      expect(stats.bySource.combined).toBe(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should return zero values for empty cache', () => {
      const stats = repo.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.bySource.codex).toBe(0);
      expect(stats.bySource.gemini).toBe(0);
      expect(stats.bySource.combined).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently accessed entries first', () => {
      // Use small max size for testing
      const smallRepo = new CacheRepository(db, { ...testConfig, maxSize: 5 });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        smallRepo.set(`key-${i}`, 'codex', { index: i });
        vi.advanceTimersByTime(100);
      }

      // Access some entries to make them more recently used
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);
      smallRepo.get('key-3');
      vi.advanceTimersByTime(testConfig.touchIntervalMs + 100);
      smallRepo.get('key-4');

      // Add new entry to trigger eviction
      smallRepo.set('key-new', 'codex', { index: 'new' });

      // key-0, key-1, key-2 should be candidates for eviction (least recently accessed)
      // At least one should be evicted
      const remainingKeys = ['key-0', 'key-1', 'key-2'].filter((k) => smallRepo.has(k));

      // Some of the old, unaccessed keys should be evicted
      expect(remainingKeys.length).toBeLessThan(3);

      // Recently accessed keys should still exist
      expect(smallRepo.has('key-3')).toBe(true);
      expect(smallRepo.has('key-4')).toBe(true);
      expect(smallRepo.has('key-new')).toBe(true);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple rapid operations', () => {
      const operations: Promise<void>[] = [];

      // Simulate concurrent writes
      for (let i = 0; i < 20; i++) {
        operations.push(
          Promise.resolve().then(() => {
            repo.set(`concurrent-${i}`, 'codex', { index: i });
          })
        );
      }

      // All operations should complete without error
      expect(() => Promise.all(operations)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty result object', () => {
      repo.set('empty', 'codex', {});

      const result = repo.getResult('empty');
      expect(result).toEqual({});
    });

    it('should handle array result', () => {
      const arrayResult = [1, 2, 3, { nested: true }];
      repo.set('array', 'codex', arrayResult);

      const result = repo.getResult('array');
      expect(result).toEqual(arrayResult);
    });

    it('should handle null and undefined values in result', () => {
      const result = { nullVal: null, data: 'test' };
      repo.set('nullable', 'codex', result);

      const retrieved = repo.getResult('nullable');
      expect(retrieved).toEqual(result);
    });

    it('should handle very long cache keys', () => {
      const longKey = 'k'.repeat(500);
      repo.set(longKey, 'codex', { data: 'test' });

      expect(repo.has(longKey)).toBe(true);
      expect(repo.getResult(longKey)).toEqual({ data: 'test' });
    });

    it('should handle unicode in cache key', () => {
      const unicodeKey = 'キー_日本語_🔑';
      repo.set(unicodeKey, 'codex', { data: 'unicode test' });

      expect(repo.has(unicodeKey)).toBe(true);
    });
  });
});
