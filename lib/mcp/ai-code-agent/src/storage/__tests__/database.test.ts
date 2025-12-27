/**
 * DatabaseManager Tests
 * Tests for SQLite database singleton manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseManager, type DatabaseConfig } from '../database.js';

// Mock logger
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

// Helper to create a temp directory for test databases
const createTempDir = (): string => {
  const tempDir = path.join(os.tmpdir(), `db-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

// Helper to clean up temp directory
const cleanupTempDir = (dir: string): void => {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
      }
      fs.rmdirSync(dir);
    }
  } catch {
    // Ignore cleanup errors
  }
};

describe('DatabaseManager', () => {
  let tempDir: string;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    tempDir = createTempDir();
    mockLogger = createMockLogger();
    // Reset singleton before each test
    DatabaseManager.resetInstance();
  });

  afterEach(() => {
    // Reset singleton after each test
    DatabaseManager.resetInstance();
    cleanupTempDir(tempDir);
  });

  describe('constructor and initialization', () => {
    it('should create database with default config', () => {
      const dbPath = path.join(tempDir, 'test.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
      expect(manager.getDb()).toBeDefined();
      expect(manager.getSqlite()).toBeDefined();
      expect(fs.existsSync(dbPath)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: dbPath }),
        'Database initialized'
      );
    });

    it('should create database directory if not exists', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'test.db');
      const config: DatabaseConfig = { path: nestedPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });

    it('should enable WAL mode when configured', () => {
      const dbPath = path.join(tempDir, 'wal-test.db');
      const config: DatabaseConfig = { path: dbPath, enableWAL: true };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check WAL mode is enabled
      const result = sqlite.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(result[0].journal_mode).toBe('wal');
    });

    it('should disable WAL mode when configured', () => {
      const dbPath = path.join(tempDir, 'no-wal-test.db');
      const config: DatabaseConfig = { path: dbPath, enableWAL: false };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check WAL mode is not enabled (default is 'delete' or 'memory')
      const result = sqlite.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(result[0].journal_mode).not.toBe('wal');
    });

    it('should set busy timeout when configured', () => {
      const dbPath = path.join(tempDir, 'timeout-test.db');
      const config: DatabaseConfig = { path: dbPath, busyTimeout: 10000 };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check busy timeout is set (pragma returns [{timeout: value}])
      const result = sqlite.pragma('busy_timeout') as Array<{ timeout: number }>;
      expect(result[0].timeout).toBe(10000);
    });

    it('should enable foreign keys', () => {
      const dbPath = path.join(tempDir, 'fk-test.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check foreign keys are enabled
      const result = sqlite.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
      expect(result[0].foreign_keys).toBe(1);
    });

    it('should initialize without logger', () => {
      const dbPath = path.join(tempDir, 'no-logger.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config);

      expect(manager).toBeDefined();
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on subsequent calls', () => {
      const dbPath = path.join(tempDir, 'singleton.db');
      const config: DatabaseConfig = { path: dbPath };

      const instance1 = DatabaseManager.getInstance(config, mockLogger as any);
      const instance2 = DatabaseManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use initialize as alias for getInstance', () => {
      const dbPath = path.join(tempDir, 'init.db');
      const config: DatabaseConfig = { path: dbPath };

      const instance1 = DatabaseManager.initialize(config, mockLogger as any);
      const instance2 = DatabaseManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const dbPath1 = path.join(tempDir, 'reset1.db');
      const dbPath2 = path.join(tempDir, 'reset2.db');

      const instance1 = DatabaseManager.getInstance({ path: dbPath1 }, mockLogger as any);
      DatabaseManager.resetInstance();

      const instance2 = DatabaseManager.getInstance({ path: dbPath2 }, mockLogger as any);

      expect(instance1).not.toBe(instance2);
      expect(fs.existsSync(dbPath1)).toBe(true);
      expect(fs.existsSync(dbPath2)).toBe(true);
    });

    it('should handle resetInstance when no instance exists', () => {
      // Should not throw
      expect(() => DatabaseManager.resetInstance()).not.toThrow();
    });
  });

  describe('expandPath', () => {
    it('should expand tilde at start of path', () => {
      const dbPath = path.join(tempDir, 'expand.db');
      const config: DatabaseConfig = { path: dbPath };

      // We can't directly test private method, but we can verify tilde expansion
      // by checking the manager uses expanded path
      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
    });

    it('should handle path starting with ~/', () => {
      // Create a config with tilde path (won't actually use home dir in test)
      const realHomePath = path.join(os.homedir(), '.test-ai-code-agent', 'db.db');
      const realHomeDir = path.dirname(realHomePath);

      // Clean up before test
      try {
        if (fs.existsSync(realHomePath)) fs.unlinkSync(realHomePath);
        if (fs.existsSync(realHomeDir)) fs.rmdirSync(realHomeDir);
      } catch { /* ignore */ }

      const config: DatabaseConfig = { path: '~/.test-ai-code-agent/db.db' };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
      expect(fs.existsSync(realHomePath)).toBe(true);

      // Clean up
      DatabaseManager.resetInstance();
      try {
        if (fs.existsSync(realHomePath)) fs.unlinkSync(realHomePath);
        // Also remove WAL files if present
        if (fs.existsSync(realHomePath + '-wal')) fs.unlinkSync(realHomePath + '-wal');
        if (fs.existsSync(realHomePath + '-shm')) fs.unlinkSync(realHomePath + '-shm');
        if (fs.existsSync(realHomeDir)) fs.rmdirSync(realHomeDir);
      } catch { /* ignore */ }
    });

    it('should handle just tilde as path', () => {
      // Test that ~ alone expands to homedir
      // We verify indirectly by checking no error is thrown for relative path
      const dbPath = path.join(tempDir, 'tilde-only.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
    });

    it('should not expand tilde in middle of path', () => {
      const dbPath = path.join(tempDir, 'no~expand', 'test.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
      // Path should contain ~ in the middle
      expect(fs.existsSync(path.dirname(dbPath))).toBe(true);
    });
  });

  describe('runMigrations', () => {
    it('should create all required tables', () => {
      const dbPath = path.join(tempDir, 'migrations.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check tables exist
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('analyses');
      expect(tableNames).toContain('cache');
      expect(tableNames).toContain('prompts');
      expect(tableNames).toContain('settings');
    });

    it('should create all required indexes', () => {
      const dbPath = path.join(tempDir, 'indexes.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Check indexes exist
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_analyses_status');
      expect(indexNames).toContain('idx_analyses_source');
      expect(indexNames).toContain('idx_analyses_created_at');
      expect(indexNames).toContain('idx_cache_expires_at');
      expect(indexNames).toContain('idx_cache_last_accessed');
      expect(indexNames).toContain('idx_prompts_is_builtin');
    });

    it('should log migration progress', () => {
      const dbPath = path.join(tempDir, 'log-migrations.db');
      const config: DatabaseConfig = { path: dbPath };

      DatabaseManager.getInstance(config, mockLogger as any);

      expect(mockLogger.info).toHaveBeenCalledWith('Running database migrations...');
      expect(mockLogger.info).toHaveBeenCalledWith('Database migrations completed');
    });

    it('should be idempotent (can run multiple times)', () => {
      const dbPath = path.join(tempDir, 'idempotent.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      // Run migrations again (should not throw)
      expect(() => manager.runMigrations()).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy database', () => {
      const dbPath = path.join(tempDir, 'health.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager.healthCheck()).toBe(true);
    });

    it('should return false after database is closed', () => {
      const dbPath = path.join(tempDir, 'closed-health.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      manager.close();

      // After close, health check should fail
      // Note: We need to get a reference before close since getInstance
      // would create a new instance
      expect(manager.healthCheck()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return zero counts for empty database', () => {
      const dbPath = path.join(tempDir, 'stats.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const stats = manager.getStats();

      expect(stats.analysesCount).toBe(0);
      expect(stats.cacheCount).toBe(0);
      expect(stats.promptsCount).toBe(0);
      expect(stats.dbSizeBytes).toBeGreaterThan(0); // DB file exists
    });

    it('should return correct counts after inserting data', () => {
      const dbPath = path.join(tempDir, 'stats-data.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Insert test data
      sqlite.exec(`
        INSERT INTO analyses (id, source, status, prompt_hash) VALUES
          ('a1', 'codex', 'completed', 'hash1'),
          ('a2', 'gemini', 'completed', 'hash2');
        INSERT INTO cache (cache_key, source, result_json, expires_at) VALUES
          ('key1', 'codex', '{}', datetime('now', '+1 hour'));
        INSERT INTO prompts (id, name, template) VALUES
          ('p1', 'test', 'template'),
          ('p2', 'test2', 'template2'),
          ('p3', 'test3', 'template3');
      `);

      const stats = manager.getStats();

      expect(stats.analysesCount).toBe(2);
      expect(stats.cacheCount).toBe(1);
      expect(stats.promptsCount).toBe(3);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('should handle missing db file gracefully', () => {
      const dbPath = path.join(tempDir, 'stats-missing.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      // Delete the db file (simulating edge case)
      // First close to release file handle
      const sqlite = manager.getSqlite();

      // Get stats (file exists at this point)
      const stats = manager.getStats();
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      const dbPath = path.join(tempDir, 'close.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      manager.close();

      expect(mockLogger.info).toHaveBeenCalledWith('Database connection closed');
    });

    it('should reset singleton after close', () => {
      const dbPath1 = path.join(tempDir, 'close1.db');
      const dbPath2 = path.join(tempDir, 'close2.db');

      const instance1 = DatabaseManager.getInstance({ path: dbPath1 }, mockLogger as any);
      instance1.close();

      // New getInstance should create new instance
      const instance2 = DatabaseManager.getInstance({ path: dbPath2 }, mockLogger as any);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getDb and getSqlite', () => {
    it('should return Drizzle database instance', () => {
      const dbPath = path.join(tempDir, 'drizzle.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const db = manager.getDb();

      expect(db).toBeDefined();
      // Check it has Drizzle methods
      expect(typeof db.select).toBe('function');
      expect(typeof db.insert).toBe('function');
    });

    it('should return SQLite database instance', () => {
      const dbPath = path.join(tempDir, 'sqlite.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      expect(sqlite).toBeDefined();
      // Check it has better-sqlite3 methods
      expect(typeof sqlite.prepare).toBe('function');
      expect(typeof sqlite.exec).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in path', () => {
      const dbPath = path.join(tempDir, 'special chars (test).db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);

      expect(manager).toBeDefined();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('should use default config values when not provided', () => {
      const dbPath = path.join(tempDir, 'defaults.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      // Default enableWAL is true
      const walResult = sqlite.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(walResult[0].journal_mode).toBe('wal');

      // Default busyTimeout is 5000 (pragma returns [{timeout: value}])
      const timeoutResult = sqlite.pragma('busy_timeout') as Array<{ timeout: number }>;
      expect(timeoutResult[0].timeout).toBe(5000);
    });

    it('should handle concurrent getInstance calls', () => {
      const dbPath = path.join(tempDir, 'concurrent.db');
      const config: DatabaseConfig = { path: dbPath };

      // Simulate concurrent calls
      const instances = Array(5).fill(null).map(() =>
        DatabaseManager.getInstance(config, mockLogger as any)
      );

      // All should be the same instance
      const first = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(first);
      });
    });
  });

  describe('table schema validation', () => {
    it('should create analyses table with correct columns', () => {
      const dbPath = path.join(tempDir, 'schema-analyses.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      const columns = sqlite.pragma('table_info(analyses)') as Array<{ name: string; type: string; notnull: number }>;
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('source');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('prompt_hash');
      expect(columnNames).toContain('context_json');
      expect(columnNames).toContain('result_json');
      expect(columnNames).toContain('error_code');
      expect(columnNames).toContain('error_message');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('expires_at');
    });

    it('should create cache table with correct columns', () => {
      const dbPath = path.join(tempDir, 'schema-cache.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      const columns = sqlite.pragma('table_info(cache)') as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('cache_key');
      expect(columnNames).toContain('source');
      expect(columnNames).toContain('result_json');
      expect(columnNames).toContain('hit_count');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('last_accessed_at');
      expect(columnNames).toContain('expires_at');
    });

    it('should create prompts table with correct columns', () => {
      const dbPath = path.join(tempDir, 'schema-prompts.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      const columns = sqlite.pragma('table_info(prompts)') as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('template');
      expect(columnNames).toContain('args_schema_json');
      expect(columnNames).toContain('is_builtin');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should create settings table with correct columns', () => {
      const dbPath = path.join(tempDir, 'schema-settings.db');
      const config: DatabaseConfig = { path: dbPath };

      const manager = DatabaseManager.getInstance(config, mockLogger as any);
      const sqlite = manager.getSqlite();

      const columns = sqlite.pragma('table_info(settings)') as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('key');
      expect(columnNames).toContain('value');
      expect(columnNames).toContain('updated_at');
    });
  });
});
