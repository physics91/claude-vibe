/**
 * SQLite Database Manager
 * Singleton pattern for database connection management
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import type { Logger } from '../core/logger.js';

export interface DatabaseConfig {
  path: string;
  enableWAL?: boolean;
  busyTimeout?: number;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  path: './data/ai-code-agent.db',
  enableWAL: true,
  busyTimeout: 5000,
};

/**
 * Database Manager - Singleton
 * Manages SQLite connection with Drizzle ORM
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private sqlite: Database.Database;
  private db: BetterSQLite3Database<typeof schema>;
  private logger: Logger | null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? null;

    // Expand tilde in path (security: validate path before use)
    this.config.path = this.expandPath(this.config.path);

    // Ensure data directory exists
    this.ensureDataDirectory();

    // Initialize SQLite connection
    this.sqlite = new Database(this.config.path);

    // Configure SQLite
    if (this.config.enableWAL) {
      this.sqlite.pragma('journal_mode = WAL');
    }
    if (this.config.busyTimeout) {
      this.sqlite.pragma(`busy_timeout = ${this.config.busyTimeout}`);
    }

    // Enable foreign keys
    this.sqlite.pragma('foreign_keys = ON');

    // Initialize Drizzle ORM
    this.db = drizzle(this.sqlite, { schema });

    // Run migrations automatically on initialization
    this.runMigrations();

    this.logger?.info({ path: this.config.path }, 'Database initialized');
  }

  /**
   * Expand tilde (~) in path to user home directory
   * Security: Only expands ~ at start of path to prevent path injection
   */
  private expandPath(p: string): string {
    if (p.startsWith('~/')) {
      return path.join(homedir(), p.slice(2));
    }
    if (p === '~') {
      return homedir();
    }
    return p;
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    const dir = path.dirname(this.config.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger?.debug({ dir }, 'Created data directory');
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: DatabaseConfig, logger?: Logger): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config ?? DEFAULT_CONFIG, logger);
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database (create instance if not exists)
   */
  static initialize(config?: DatabaseConfig, logger?: Logger): DatabaseManager {
    return DatabaseManager.getInstance(config, logger);
  }

  /**
   * Get Drizzle database instance
   */
  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db;
  }

  /**
   * Get raw SQLite database instance
   */
  getSqlite(): Database.Database {
    return this.sqlite;
  }

  /**
   * Run database migrations
   */
  runMigrations(): void {
    this.logger?.info('Running database migrations...');

    // Create tables if not exist
    this.sqlite.exec(`
      -- Analysis history table
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

      -- Cache table
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

      -- MCP Prompts table
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template TEXT NOT NULL,
        args_schema_json TEXT,
        is_builtin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
      CREATE INDEX IF NOT EXISTS idx_analyses_source ON analyses(source);
      CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON cache(last_accessed_at);
      CREATE INDEX IF NOT EXISTS idx_prompts_is_builtin ON prompts(is_builtin);
    `);

    this.logger?.info('Database migrations completed');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.sqlite.close();
    DatabaseManager.instance = null;
    this.logger?.info('Database connection closed');
  }

  /**
   * Check if database is healthy
   */
  healthCheck(): boolean {
    try {
      this.sqlite.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    analysesCount: number;
    cacheCount: number;
    promptsCount: number;
    dbSizeBytes: number;
  } {
    const analysesCount = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM analyses')
      .get() as { count: number };
    const cacheCount = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM cache')
      .get() as { count: number };
    const promptsCount = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM prompts')
      .get() as { count: number };

    let dbSizeBytes = 0;
    try {
      const stats = fs.statSync(this.config.path);
      dbSizeBytes = stats.size;
    } catch {
      // File might not exist yet
    }

    return {
      analysesCount: analysesCount.count,
      cacheCount: cacheCount.count,
      promptsCount: promptsCount.count,
      dbSizeBytes,
    };
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
    }
    DatabaseManager.instance = null;
  }
}
