/**
 * Drizzle ORM Schema for SQLite Database
 * Defines tables for analyses, cache, and prompts
 */

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Analysis history table
 * Stores analysis results with status tracking
 */
export const analyses = sqliteTable('analyses', {
  id: text('id').primaryKey(),
  source: text('source').notNull(), // 'codex' | 'gemini' | 'combined'
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
  promptHash: text('prompt_hash').notNull(),
  contextJson: text('context_json'),
  resultJson: text('result_json'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at'),
});

/**
 * Cache table
 * Stores cached analysis results with LRU eviction support
 */
export const cache = sqliteTable('cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cacheKey: text('cache_key').unique().notNull(),
  source: text('source').notNull(), // 'codex' | 'gemini' | 'combined'
  resultJson: text('result_json').notNull(),
  hitCount: integer('hit_count').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastAccessedAt: text('last_accessed_at').default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at').notNull(),
});

/**
 * MCP Prompts table
 * Stores prompt templates for code review
 */
export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  template: text('template').notNull(),
  argsSchemaJson: text('args_schema_json'),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Settings table
 * Stores key-value settings for persistence
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Type exports for use in repositories
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type CacheEntry = typeof cache.$inferSelect;
export type NewCacheEntry = typeof cache.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
