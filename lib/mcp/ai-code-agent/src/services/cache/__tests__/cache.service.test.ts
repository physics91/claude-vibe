/**
 * Cache Service Tests
 * Tests for high-level caching operations with mock repository
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheService, type CacheServiceConfig } from '../cache.service.js';
import type { CacheRepository, CacheSource } from '../../../storage/repositories/cache.repository.js';
import type { CacheKeyParams } from '../cache-key.js';

// Mock repository factory
function createMockRepository(overrides: Partial<CacheRepository> = {}): CacheRepository {
  return {
    get: vi.fn().mockReturnValue(null),
    getResult: vi.fn().mockReturnValue(null),
    set: vi.fn().mockReturnValue({ id: 1 }),
    delete: vi.fn().mockReturnValue(true),
    deleteExpired: vi.fn().mockReturnValue(0),
    clear: vi.fn().mockReturnValue(0),
    clearBySource: vi.fn().mockReturnValue(0),
    size: vi.fn().mockReturnValue(0),
    has: vi.fn().mockReturnValue(false),
    getStats: vi.fn().mockReturnValue({
      totalEntries: 0,
      totalHits: 0,
      bySource: { codex: 0, gemini: 0, combined: 0 },
      oldestEntry: null,
      newestEntry: null,
    }),
    ...overrides,
  } as unknown as CacheRepository;
}

// Default config
const defaultConfig: CacheServiceConfig = {
  enabled: true,
  ttl: 3600000, // 1 hour
  maxSize: 1000,
};

describe('CacheService', () => {
  let mockRepo: CacheRepository;
  let service: CacheService;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new CacheService(mockRepo, defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true when cache is enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when cache is disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('getOrSet', () => {
    const testParams: CacheKeyParams = { prompt: 'test', source: 'codex' };

    it('should return cached result on cache hit', async () => {
      const cachedResult = { findings: [] };
      mockRepo.getResult = vi.fn().mockReturnValue(cachedResult);

      const fn = vi.fn().mockResolvedValue({ findings: ['new'] });
      const { result, fromCache } = await service.getOrSet(testParams, fn);

      expect(fromCache).toBe(true);
      expect(result).toEqual(cachedResult);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should execute function on cache miss', async () => {
      const newResult = { findings: ['bug'] };
      const fn = vi.fn().mockResolvedValue(newResult);

      const { result, fromCache } = await service.getOrSet(testParams, fn);

      expect(fromCache).toBe(false);
      expect(result).toEqual(newResult);
      expect(fn).toHaveBeenCalledOnce();
      expect(mockRepo.set).toHaveBeenCalled();
    });

    it('should skip cache when disabled', async () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });
      const newResult = { data: 'test' };
      const fn = vi.fn().mockResolvedValue(newResult);

      const { result, fromCache } = await disabledService.getOrSet(testParams, fn);

      expect(fromCache).toBe(false);
      expect(result).toEqual(newResult);
      expect(mockRepo.getResult).not.toHaveBeenCalled();
      expect(mockRepo.set).not.toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'test' });
      const customTtl = 60000;

      await service.getOrSet(testParams, fn, customTtl);

      expect(mockRepo.set).toHaveBeenCalledWith(
        expect.any(String),
        'codex',
        { data: 'test' },
        customTtl
      );
    });

    it('should use default TTL when not provided', async () => {
      const fn = vi.fn().mockResolvedValue({ data: 'test' });

      await service.getOrSet(testParams, fn);

      expect(mockRepo.set).toHaveBeenCalledWith(
        expect.any(String),
        'codex',
        { data: 'test' },
        defaultConfig.ttl
      );
    });

    it('should not fail when cache write fails', async () => {
      mockRepo.set = vi.fn().mockImplementation(() => {
        throw new Error('DB write failed');
      });

      const fn = vi.fn().mockResolvedValue({ data: 'test' });

      // Should not throw
      const { result, fromCache } = await service.getOrSet(testParams, fn);

      expect(fromCache).toBe(false);
      expect(result).toEqual({ data: 'test' });
    });

    it('should track hit statistics', async () => {
      mockRepo.getResult = vi.fn()
        .mockReturnValueOnce({ cached: true })
        .mockReturnValueOnce({ cached: true })
        .mockReturnValueOnce(null);

      const fn = vi.fn().mockResolvedValue({ new: true });

      await service.getOrSet(testParams, fn);
      await service.getOrSet(testParams, fn);
      await service.getOrSet(testParams, fn);

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 5);
    });
  });

  describe('get', () => {
    const testParams: CacheKeyParams = { prompt: 'test', source: 'gemini' };

    it('should return cached value when present', () => {
      const cachedValue = { result: 'cached' };
      mockRepo.getResult = vi.fn().mockReturnValue(cachedValue);

      const result = service.get(testParams);

      expect(result).toEqual(cachedValue);
    });

    it('should return null when not cached', () => {
      const result = service.get(testParams);
      expect(result).toBeNull();
    });

    it('should return null when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });
      mockRepo.getResult = vi.fn().mockReturnValue({ data: 'test' });

      const result = disabledService.get(testParams);

      expect(result).toBeNull();
      expect(mockRepo.getResult).not.toHaveBeenCalled();
    });
  });

  describe('set', () => {
    const testParams: CacheKeyParams = { prompt: 'test', source: 'combined' };

    it('should store value in cache', () => {
      const value = { data: 'test' };

      service.set(testParams, value);

      expect(mockRepo.set).toHaveBeenCalledWith(
        expect.any(String),
        'combined',
        value,
        defaultConfig.ttl
      );
    });

    it('should use custom TTL when provided', () => {
      const value = { data: 'test' };
      const customTtl = 30000;

      service.set(testParams, value, customTtl);

      expect(mockRepo.set).toHaveBeenCalledWith(
        expect.any(String),
        'combined',
        value,
        customTtl
      );
    });

    it('should not store when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });

      disabledService.set(testParams, { data: 'test' });

      expect(mockRepo.set).not.toHaveBeenCalled();
    });
  });

  describe('has', () => {
    const testParams: CacheKeyParams = { prompt: 'exists', source: 'codex' };

    it('should return true when key exists', () => {
      mockRepo.has = vi.fn().mockReturnValue(true);

      expect(service.has(testParams)).toBe(true);
    });

    it('should return false when key does not exist', () => {
      expect(service.has(testParams)).toBe(false);
    });

    it('should return false when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });
      mockRepo.has = vi.fn().mockReturnValue(true);

      expect(disabledService.has(testParams)).toBe(false);
      expect(mockRepo.has).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    const testParams: CacheKeyParams = { prompt: 'delete-me', source: 'codex' };

    it('should delete entry and return true', () => {
      mockRepo.delete = vi.fn().mockReturnValue(true);

      expect(service.invalidate(testParams)).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalled();
    });

    it('should return false when entry not found', () => {
      mockRepo.delete = vi.fn().mockReturnValue(false);

      expect(service.invalidate(testParams)).toBe(false);
    });

    it('should return false when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });

      expect(disabledService.invalidate(testParams)).toBe(false);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('invalidateBySource', () => {
    it('should clear entries by source', () => {
      mockRepo.clearBySource = vi.fn().mockReturnValue(5);

      const count = service.invalidateBySource('codex');

      expect(count).toBe(5);
      expect(mockRepo.clearBySource).toHaveBeenCalledWith('codex');
    });

    it('should return 0 when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });

      expect(disabledService.invalidateBySource('codex')).toBe(0);
      expect(mockRepo.clearBySource).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all entries and reset stats', () => {
      mockRepo.clear = vi.fn().mockReturnValue(10);
      // Build up some stats first
      mockRepo.getResult = vi.fn().mockReturnValue(null);

      const fn = vi.fn().mockResolvedValue({ data: 'test' });

      // This will cause a miss
      service.getOrSet({ prompt: 'test', source: 'codex' }, fn);

      const count = service.clear();

      expect(count).toBe(10);
      expect(mockRepo.clear).toHaveBeenCalled();

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should return 0 when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });

      expect(disabledService.clear()).toBe(0);
      expect(mockRepo.clear).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should delete expired entries', () => {
      mockRepo.deleteExpired = vi.fn().mockReturnValue(3);

      const count = service.cleanup();

      expect(count).toBe(3);
      expect(mockRepo.deleteExpired).toHaveBeenCalled();
    });

    it('should return 0 when disabled', () => {
      const disabledService = new CacheService(mockRepo, { ...defaultConfig, enabled: false });

      expect(disabledService.cleanup()).toBe(0);
      expect(mockRepo.deleteExpired).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should combine service and repository stats', async () => {
      mockRepo.getStats = vi.fn().mockReturnValue({
        totalEntries: 50,
        totalHits: 100,
        bySource: { codex: 20, gemini: 20, combined: 10 },
        oldestEntry: '2024-01-01T00:00:00Z',
        newestEntry: '2024-12-01T00:00:00Z',
      });

      // Generate some hits and misses
      mockRepo.getResult = vi.fn()
        .mockReturnValueOnce({ cached: true })
        .mockReturnValueOnce(null);

      const fn = vi.fn().mockResolvedValue({ new: true });
      await service.getOrSet({ prompt: 'test', source: 'codex' }, fn);
      await service.getOrSet({ prompt: 'test2', source: 'codex' }, fn);

      const stats = service.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.totalEntries).toBe(50);
      expect(stats.bySource).toEqual({ codex: 20, gemini: 20, combined: 10 });
    });

    it('should handle zero total requests', () => {
      const stats = service.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset hit/miss counters', async () => {
      mockRepo.getResult = vi.fn().mockReturnValue(null);
      const fn = vi.fn().mockResolvedValue({ data: 'test' });

      await service.getOrSet({ prompt: 'test', source: 'codex' }, fn);

      let stats = service.getStats();
      expect(stats.misses).toBe(1);

      service.resetStats();

      stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('size', () => {
    it('should return repository size', () => {
      mockRepo.size = vi.fn().mockReturnValue(42);

      expect(service.size()).toBe(42);
      expect(mockRepo.size).toHaveBeenCalled();
    });
  });

  describe('with logger', () => {
    it('should log cache hits', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const serviceWithLogger = new CacheService(
        mockRepo,
        defaultConfig,
        mockLogger as any
      );

      mockRepo.getResult = vi.fn().mockReturnValue({ cached: true });
      await serviceWithLogger.getOrSet({ prompt: 'test', source: 'codex' }, vi.fn());

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'codex' }),
        'Cache hit'
      );
    });

    it('should log cache misses', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const serviceWithLogger = new CacheService(
        mockRepo,
        defaultConfig,
        mockLogger as any
      );

      await serviceWithLogger.getOrSet(
        { prompt: 'test', source: 'gemini' },
        vi.fn().mockResolvedValue({})
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'gemini' }),
        'Cache miss'
      );
    });

    it('should warn on cache write failure', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      mockRepo.set = vi.fn().mockImplementation(() => {
        throw new Error('Write failed');
      });

      const serviceWithLogger = new CacheService(
        mockRepo,
        defaultConfig,
        mockLogger as any
      );

      await serviceWithLogger.getOrSet(
        { prompt: 'test', source: 'codex' },
        vi.fn().mockResolvedValue({})
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Write failed' }),
        'Failed to write to cache (best-effort)'
      );
    });
  });
});
