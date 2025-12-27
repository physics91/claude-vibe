/**
 * Analysis Repository Integration Tests
 * Tests CRUD operations for analysis history with real SQLite database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../schema.js';
import { AnalysisRepository } from '../analysis.repository.js';

// Test fixtures
const createTestDb = (): BetterSQLite3Database<typeof schema> => {
  const sqlite = new Database(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      prompt_hash TEXT NOT NULL,
      context_json TEXT,
      result_json TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
    CREATE INDEX IF NOT EXISTS idx_analyses_source ON analyses(source);
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
  `);

  return drizzle(sqlite, { schema });
};

describe('AnalysisRepository', () => {
  let db: BetterSQLite3Database<typeof schema>;
  let repo: AnalysisRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new AnalysisRepository(db);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('should create new analysis with pending status', () => {
      const analysis = repo.create({
        id: 'test-1',
        source: 'codex',
        promptHash: 'abc123',
      });

      expect(analysis.id).toBe('test-1');
      expect(analysis.source).toBe('codex');
      expect(analysis.status).toBe('pending');
      expect(analysis.promptHash).toBe('abc123');
      expect(analysis.createdAt).toBeDefined();
    });

    it('should store context as JSON', () => {
      const context = { language: 'typescript', framework: 'react' };

      repo.create({
        id: 'with-context',
        source: 'gemini',
        promptHash: 'def456',
        context,
      });

      const retrieved = repo.getContext('with-context');
      expect(retrieved).toEqual(context);
    });

    it('should set expiration time when ttlMs provided', () => {
      const ttlMs = 3600000; // 1 hour

      const analysis = repo.create({
        id: 'with-ttl',
        source: 'codex',
        promptHash: 'ghi789',
        ttlMs,
      });

      expect(analysis.expiresAt).toBeDefined();
      const expiresAt = new Date(analysis.expiresAt!).getTime();
      const createdAt = new Date(analysis.createdAt!).getTime();
      expect(expiresAt - createdAt).toBeCloseTo(ttlMs, -2);
    });

    it('should not set expiration when ttlMs not provided', () => {
      const analysis = repo.create({
        id: 'no-ttl',
        source: 'codex',
        promptHash: 'jkl012',
      });

      expect(analysis.expiresAt).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return null for non-existent id', () => {
      expect(repo.findById('no-exist')).toBeNull();
    });

    it('should return analysis for existing id', () => {
      repo.create({ id: 'exists', source: 'codex', promptHash: 'hash' });

      const found = repo.findById('exists');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('exists');
    });
  });

  describe('updateStatus', () => {
    it('should update status to running', () => {
      repo.create({ id: 'status-test', source: 'codex', promptHash: 'hash' });

      const updated = repo.updateStatus('status-test', 'running');

      expect(updated?.status).toBe('running');
    });

    it('should set completedAt when status is completed', () => {
      repo.create({ id: 'complete-test', source: 'codex', promptHash: 'hash' });

      const updated = repo.updateStatus('complete-test', 'completed');

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should set completedAt when status is failed', () => {
      repo.create({ id: 'fail-test', source: 'codex', promptHash: 'hash' });

      const updated = repo.updateStatus('fail-test', 'failed');

      expect(updated?.status).toBe('failed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should return null for non-existent id', () => {
      expect(repo.updateStatus('no-exist', 'running')).toBeNull();
    });
  });

  describe('complete', () => {
    it('should complete analysis with result', () => {
      repo.create({ id: 'result-test', source: 'codex', promptHash: 'hash' });

      const result = { findings: [{ id: 1, severity: 'high' }], summary: 'Found 1 issue' };
      const completed = repo.complete('result-test', result);

      expect(completed?.status).toBe('completed');
      expect(completed?.completedAt).toBeDefined();

      const retrievedResult = repo.getResult('result-test');
      expect(retrievedResult).toEqual(result);
    });

    it('should overwrite previous result', () => {
      repo.create({ id: 'overwrite-test', source: 'codex', promptHash: 'hash' });
      repo.complete('overwrite-test', { version: 1 });
      repo.complete('overwrite-test', { version: 2 });

      const result = repo.getResult('overwrite-test');
      expect(result).toEqual({ version: 2 });
    });
  });

  describe('fail', () => {
    it('should fail analysis with error details', () => {
      repo.create({ id: 'error-test', source: 'codex', promptHash: 'hash' });

      const failed = repo.fail('error-test', 'TIMEOUT', 'Analysis timed out after 60s');

      expect(failed?.status).toBe('failed');
      expect(failed?.errorCode).toBe('TIMEOUT');
      expect(failed?.errorMessage).toBe('Analysis timed out after 60s');
      expect(failed?.completedAt).toBeDefined();
    });
  });

  describe('find', () => {
    beforeEach(() => {
      // Create test data
      repo.create({ id: 'codex-1', source: 'codex', promptHash: 'h1' });
      repo.create({ id: 'codex-2', source: 'codex', promptHash: 'h2' });
      repo.create({ id: 'gemini-1', source: 'gemini', promptHash: 'h3' });
      repo.updateStatus('codex-1', 'completed');
      repo.updateStatus('gemini-1', 'failed');
    });

    it('should return all analyses when no filter', () => {
      const results = repo.find();
      expect(results).toHaveLength(3);
    });

    it('should filter by status', () => {
      const pending = repo.find({ status: 'pending' });
      const completed = repo.find({ status: 'completed' });
      const failed = repo.find({ status: 'failed' });

      expect(pending).toHaveLength(1);
      expect(completed).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });

    it('should filter by source', () => {
      const codex = repo.find({ source: 'codex' });
      const gemini = repo.find({ source: 'gemini' });

      expect(codex).toHaveLength(2);
      expect(gemini).toHaveLength(1);
    });

    it('should filter by both status and source', () => {
      const result = repo.find({ status: 'completed', source: 'codex' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('codex-1');
    });

    it('should apply limit', () => {
      const result = repo.find({ limit: 2 });
      expect(result).toHaveLength(2);
    });

    it('should apply offset with limit', () => {
      const all = repo.find();
      // SQLite requires LIMIT when using OFFSET
      const withOffset = repo.find({ limit: 10, offset: 1 });

      expect(withOffset).toHaveLength(2);
      expect(withOffset[0].id).not.toBe(all[0].id);
    });

    it('should order by createdAt descending', () => {
      vi.advanceTimersByTime(1000);
      repo.create({ id: 'newest', source: 'codex', promptHash: 'h4' });

      const result = repo.find();
      expect(result[0].id).toBe('newest');
    });
  });

  describe('findActive', () => {
    it('should return pending and running analyses', () => {
      repo.create({ id: 'pending-1', source: 'codex', promptHash: 'h1' });
      repo.create({ id: 'running-1', source: 'codex', promptHash: 'h2' });
      repo.create({ id: 'completed-1', source: 'codex', promptHash: 'h3' });
      repo.updateStatus('running-1', 'running');
      repo.updateStatus('completed-1', 'completed');

      const active = repo.findActive();

      expect(active).toHaveLength(2);
      expect(active.map((a) => a.id)).toContain('pending-1');
      expect(active.map((a) => a.id)).toContain('running-1');
    });

    it('should return empty array when no active analyses', () => {
      repo.create({ id: 'done', source: 'codex', promptHash: 'h1' });
      repo.updateStatus('done', 'completed');

      expect(repo.findActive()).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete existing analysis', () => {
      repo.create({ id: 'delete-me', source: 'codex', promptHash: 'h1' });

      const deleted = repo.delete('delete-me');

      expect(deleted).toBe(true);
      expect(repo.findById('delete-me')).toBeNull();
    });

    it('should return false for non-existent id', () => {
      expect(repo.delete('no-exist')).toBe(false);
    });
  });

  describe('deleteExpired', () => {
    it('should delete only expired analyses', () => {
      // Short TTL (expires)
      repo.create({ id: 'expires', source: 'codex', promptHash: 'h1', ttlMs: 10 });
      // Long TTL (doesn't expire)
      repo.create({ id: 'keeps', source: 'codex', promptHash: 'h2', ttlMs: 3600000 });
      // No TTL (never expires)
      repo.create({ id: 'forever', source: 'codex', promptHash: 'h3' });

      vi.advanceTimersByTime(100);

      const deleted = repo.deleteExpired();

      expect(deleted).toBe(1);
      expect(repo.findById('expires')).toBeNull();
      expect(repo.findById('keeps')).not.toBeNull();
      expect(repo.findById('forever')).not.toBeNull();
    });
  });

  describe('getResult', () => {
    it('should return null for non-existent analysis', () => {
      expect(repo.getResult('no-exist')).toBeNull();
    });

    it('should return null for analysis without result', () => {
      repo.create({ id: 'no-result', source: 'codex', promptHash: 'h1' });
      expect(repo.getResult('no-result')).toBeNull();
    });

    it('should parse and return result', () => {
      repo.create({ id: 'has-result', source: 'codex', promptHash: 'h1' });
      repo.complete('has-result', { findings: [], summary: 'No issues' });

      const result = repo.getResult('has-result');
      expect(result).toEqual({ findings: [], summary: 'No issues' });
    });
  });

  describe('getContext', () => {
    it('should return null for non-existent analysis', () => {
      expect(repo.getContext('no-exist')).toBeNull();
    });

    it('should return null for analysis without context', () => {
      repo.create({ id: 'no-context', source: 'codex', promptHash: 'h1' });
      expect(repo.getContext('no-context')).toBeNull();
    });

    it('should parse and return context', () => {
      const context = { language: 'python', version: '3.11' };
      repo.create({ id: 'has-context', source: 'codex', promptHash: 'h1', context });

      const result = repo.getContext('has-context');
      expect(result).toEqual(context);
    });
  });

  describe('countByStatus', () => {
    it('should return zero counts for empty db', () => {
      const counts = repo.countByStatus();

      expect(counts).toEqual({
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
      });
    });

    it('should count analyses by status', () => {
      repo.create({ id: 'p1', source: 'codex', promptHash: 'h1' });
      repo.create({ id: 'p2', source: 'codex', promptHash: 'h2' });
      repo.create({ id: 'r1', source: 'codex', promptHash: 'h3' });
      repo.create({ id: 'c1', source: 'codex', promptHash: 'h4' });
      repo.create({ id: 'f1', source: 'codex', promptHash: 'h5' });
      repo.create({ id: 'f2', source: 'codex', promptHash: 'h6' });

      repo.updateStatus('r1', 'running');
      repo.updateStatus('c1', 'completed');
      repo.updateStatus('f1', 'failed');
      repo.updateStatus('f2', 'failed');

      const counts = repo.countByStatus();

      expect(counts).toEqual({
        pending: 2,
        running: 1,
        completed: 1,
        failed: 2,
      });
    });
  });

  describe('findByPromptHash', () => {
    it('should find completed analysis by prompt hash and source', () => {
      repo.create({ id: 'hash-match', source: 'codex', promptHash: 'unique-hash' });
      repo.complete('hash-match', { findings: [] });

      const found = repo.findByPromptHash('unique-hash', 'codex');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('hash-match');
    });

    it('should return null for non-matching source', () => {
      repo.create({ id: 'wrong-source', source: 'codex', promptHash: 'hash1' });
      repo.complete('wrong-source', { findings: [] });

      const found = repo.findByPromptHash('hash1', 'gemini');
      expect(found).toBeNull();
    });

    it('should return null for non-completed analysis', () => {
      repo.create({ id: 'pending', source: 'codex', promptHash: 'hash2' });

      const found = repo.findByPromptHash('hash2', 'codex');
      expect(found).toBeNull();
    });

    it('should return most recent when multiple matches', () => {
      repo.create({ id: 'old', source: 'codex', promptHash: 'same-hash' });
      repo.complete('old', { version: 1 });

      vi.advanceTimersByTime(1000);

      repo.create({ id: 'new', source: 'codex', promptHash: 'same-hash' });
      repo.complete('new', { version: 2 });

      const found = repo.findByPromptHash('same-hash', 'codex');

      expect(found?.id).toBe('new');
      expect(repo.getResult(found!.id)).toEqual({ version: 2 });
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in prompt hash', () => {
      const specialHash = 'hash+with/special=chars';
      repo.create({ id: 'special', source: 'codex', promptHash: specialHash });

      const found = repo.findById('special');
      expect(found?.promptHash).toBe(specialHash);
    });

    it('should handle unicode in context', () => {
      const context = { message: '日本語テスト with émojis 🔥' };
      repo.create({ id: 'unicode', source: 'codex', promptHash: 'h1', context });

      const retrieved = repo.getContext('unicode');
      expect(retrieved).toEqual(context);
    });

    it('should handle large result objects', () => {
      const largeResult = {
        findings: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            title: `Finding ${i}`,
            description: 'x'.repeat(1000),
          })),
      };

      repo.create({ id: 'large', source: 'codex', promptHash: 'h1' });
      repo.complete('large', largeResult);

      const retrieved = repo.getResult('large');
      expect(retrieved?.findings).toHaveLength(100);
    });
  });
});
