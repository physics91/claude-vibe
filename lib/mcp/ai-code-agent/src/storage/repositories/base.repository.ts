/**
 * Base Repository
 * Common functionality for all repositories
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../schema.js';
import type { Logger } from '../../core/logger.js';

export abstract class BaseRepository {
  protected db: BetterSQLite3Database<typeof schema>;
  protected logger: Logger | null;

  constructor(db: BetterSQLite3Database<typeof schema>, logger?: Logger) {
    this.db = db;
    this.logger = logger ?? null;
  }

  /**
   * Get current ISO timestamp
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Calculate expiration timestamp
   */
  protected getExpirationTimestamp(ttlMs: number): string {
    return new Date(Date.now() + ttlMs).toISOString();
  }

  /**
   * Check if timestamp has expired
   */
  protected isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }
}
