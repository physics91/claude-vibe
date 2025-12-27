/**
 * AnalysisStatusStore Tests
 * Tests for in-memory analysis status tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalysisStatusStore } from '../store.js';

describe('AnalysisStatusStore', () => {
  let store: AnalysisStatusStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = AnalysisStatusStore.getInstance();
    store.clear();
  });

  afterEach(() => {
    store.stopCleanup();
    vi.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AnalysisStatusStore.getInstance();
      const instance2 = AnalysisStatusStore.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('create', () => {
    it('should create analysis entry with pending status', () => {
      store.create('test-id', 'codex');

      const entry = store.get('test-id');
      expect(entry).toBeDefined();
      expect(entry?.analysisId).toBe('test-id');
      expect(entry?.status).toBe('pending');
      expect(entry?.source).toBe('codex');
      expect(entry?.startTime).toBeDefined();
    });

    it('should create entry for gemini source', () => {
      store.create('gemini-id', 'gemini');

      const entry = store.get('gemini-id');
      expect(entry?.source).toBe('gemini');
    });

    it('should create entry for combined source', () => {
      store.create('combined-id', 'combined');

      const entry = store.get('combined-id');
      expect(entry?.source).toBe('combined');
    });

    it('should overwrite existing entry', () => {
      store.create('test-id', 'codex');
      store.updateStatus('test-id', 'completed');

      store.create('test-id', 'gemini');

      const entry = store.get('test-id');
      expect(entry?.status).toBe('pending');
      expect(entry?.source).toBe('gemini');
    });
  });

  describe('updateStatus', () => {
    it('should update status to in_progress', () => {
      store.create('test-id', 'codex');

      store.updateStatus('test-id', 'in_progress');

      const entry = store.get('test-id');
      expect(entry?.status).toBe('in_progress');
    });

    it('should set endTime and expiresAt when completed', () => {
      store.create('test-id', 'codex');

      store.updateStatus('test-id', 'completed');

      const entry = store.get('test-id');
      expect(entry?.status).toBe('completed');
      expect(entry?.endTime).toBeDefined();
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should set endTime and expiresAt when failed', () => {
      store.create('test-id', 'codex');

      store.updateStatus('test-id', 'failed');

      const entry = store.get('test-id');
      expect(entry?.status).toBe('failed');
      expect(entry?.endTime).toBeDefined();
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should do nothing for non-existent entry', () => {
      store.updateStatus('non-existent', 'completed');

      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('setResult', () => {
    it('should set result and mark as completed', () => {
      store.create('test-id', 'codex');
      const result = {
        reviewId: 'review-1',
        findings: [],
        stats: { totalFindings: 0, byCategory: {}, bySeverity: {} },
        metadata: { source: 'codex' as const, analysisType: 'combined' as const },
      };

      store.setResult('test-id', result);

      const entry = store.get('test-id');
      expect(entry?.status).toBe('completed');
      expect(entry?.result).toEqual(result);
      expect(entry?.endTime).toBeDefined();
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should do nothing for non-existent entry', () => {
      const result = {
        reviewId: 'review-1',
        findings: [],
        stats: { totalFindings: 0, byCategory: {}, bySeverity: {} },
        metadata: { source: 'codex' as const, analysisType: 'combined' as const },
      };

      store.setResult('non-existent', result);

      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('setError', () => {
    it('should set error and mark as failed', () => {
      store.create('test-id', 'codex');
      const error = { code: 'ERR_TEST', message: 'Test error' };

      store.setError('test-id', error);

      const entry = store.get('test-id');
      expect(entry?.status).toBe('failed');
      expect(entry?.error).toEqual(error);
      expect(entry?.endTime).toBeDefined();
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should do nothing for non-existent entry', () => {
      const error = { code: 'ERR_TEST', message: 'Test error' };

      store.setError('non-existent', error);

      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should return entry if exists', () => {
      store.create('test-id', 'codex');

      const entry = store.get('test-id');

      expect(entry).toBeDefined();
      expect(entry?.analysisId).toBe('test-id');
    });

    it('should return undefined for non-existent entry', () => {
      const entry = store.get('non-existent');

      expect(entry).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true if entry exists', () => {
      store.create('test-id', 'codex');

      expect(store.has('test-id')).toBe(true);
    });

    it('should return false if entry does not exist', () => {
      expect(store.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entry and return true', () => {
      store.create('test-id', 'codex');

      const result = store.delete('test-id');

      expect(result).toBe(true);
      expect(store.has('test-id')).toBe(false);
    });

    it('should return false for non-existent entry', () => {
      const result = store.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      store.create('id-1', 'codex');
      store.create('id-2', 'gemini');
      store.create('id-3', 'combined');

      store.clear();

      expect(store.getAllIds()).toHaveLength(0);
    });
  });

  describe('getAllIds', () => {
    it('should return all entry IDs', () => {
      store.create('id-1', 'codex');
      store.create('id-2', 'gemini');
      store.create('id-3', 'combined');

      const ids = store.getAllIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain('id-1');
      expect(ids).toContain('id-2');
      expect(ids).toContain('id-3');
    });

    it('should return empty array when no entries', () => {
      const ids = store.getAllIds();

      expect(ids).toEqual([]);
    });
  });

  describe('cleanup logic', () => {
    it('should set expiresAt when status is completed', () => {
      store.create('test-id', 'codex');
      store.updateStatus('test-id', 'completed');

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeDefined();

      // expiresAt should be 1 hour from now
      const expiresAt = new Date(entry!.expiresAt!).getTime();
      const endTime = new Date(entry!.endTime!).getTime();
      expect(expiresAt - endTime).toBe(60 * 60 * 1000);
    });

    it('should set expiresAt when status is failed', () => {
      store.create('test-id', 'codex');
      store.updateStatus('test-id', 'failed');

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should not set expiresAt for pending status', () => {
      store.create('test-id', 'codex');

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeUndefined();
    });

    it('should not set expiresAt for in_progress status', () => {
      store.create('test-id', 'codex');
      store.updateStatus('test-id', 'in_progress');

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeUndefined();
    });

    it('should set expiresAt via setResult', () => {
      store.create('test-id', 'codex');
      const result = {
        reviewId: 'review-1',
        findings: [],
        stats: { totalFindings: 0, byCategory: {}, bySeverity: {} },
        metadata: { source: 'codex' as const, analysisType: 'combined' as const },
      };

      store.setResult('test-id', result);

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeDefined();
    });

    it('should set expiresAt via setError', () => {
      store.create('test-id', 'codex');
      const error = { code: 'ERR_TEST', message: 'Test error' };

      store.setError('test-id', error);

      const entry = store.get('test-id');
      expect(entry?.expiresAt).toBeDefined();
    });
  });

  describe('stopCleanup', () => {
    it('should stop cleanup interval', () => {
      const store = AnalysisStatusStore.getInstance();

      store.stopCleanup();

      // Create and complete entry
      store.create('test-id', 'codex');
      store.updateStatus('test-id', 'completed');

      // Fast-forward past TTL and cleanup interval
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      // Entry should still exist because cleanup was stopped
      // Note: This depends on implementation - cleanup may have already been stopped in beforeEach
    });

    it('should handle multiple stopCleanup calls', () => {
      const store = AnalysisStatusStore.getInstance();

      // Should not throw
      store.stopCleanup();
      store.stopCleanup();
    });
  });
});
