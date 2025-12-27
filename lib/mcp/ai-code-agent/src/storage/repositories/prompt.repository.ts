/**
 * Prompt Repository
 * CRUD operations for MCP prompts
 */

import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import { prompts } from '../schema.js';
import type { Prompt, NewPrompt } from '../schema.js';
import { BaseRepository } from './base.repository.js';
import type { Logger } from '../../core/logger.js';

export interface PromptArgs {
  [key: string]: {
    type: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    enum?: unknown[];
  };
}

export class PromptRepository extends BaseRepository {
  constructor(db: BetterSQLite3Database<typeof schema>, logger?: Logger) {
    super(db, logger);
  }

  /**
   * Create a new prompt
   */
  create(data: {
    id: string;
    name: string;
    description?: string;
    template: string;
    argsSchema?: PromptArgs;
    isBuiltin?: boolean;
  }): Prompt {
    const now = this.getCurrentTimestamp();

    const newPrompt: NewPrompt = {
      id: data.id,
      name: data.name,
      description: data.description ?? null,
      template: data.template,
      argsSchemaJson: data.argsSchema ? JSON.stringify(data.argsSchema) : null,
      isBuiltin: data.isBuiltin ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(prompts).values(newPrompt).run();
    this.logger?.debug({ id: data.id, name: data.name }, 'Prompt created');

    return this.findById(data.id)!;
  }

  /**
   * Find prompt by ID
   */
  findById(id: string): Prompt | null {
    const result = this.db.select().from(prompts).where(eq(prompts.id, id)).get();
    return result ?? null;
  }

  /**
   * Find prompt by name
   */
  findByName(name: string): Prompt | null {
    const result = this.db.select().from(prompts).where(eq(prompts.name, name)).get();
    return result ?? null;
  }

  /**
   * Update prompt
   */
  update(
    id: string,
    data: {
      name?: string;
      description?: string;
      template?: string;
      argsSchema?: PromptArgs;
    }
  ): Prompt | null {
    const updates: Partial<NewPrompt> = {
      updatedAt: this.getCurrentTimestamp(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.template !== undefined) updates.template = data.template;
    if (data.argsSchema !== undefined) {
      updates.argsSchemaJson = JSON.stringify(data.argsSchema);
    }

    this.db.update(prompts).set(updates).where(eq(prompts.id, id)).run();
    this.logger?.debug({ id }, 'Prompt updated');

    return this.findById(id);
  }

  /**
   * Delete prompt by ID
   */
  delete(id: string): boolean {
    const result = this.db.delete(prompts).where(eq(prompts.id, id)).run();
    const deleted = result.changes > 0;
    if (deleted) {
      this.logger?.debug({ id }, 'Prompt deleted');
    }
    return deleted;
  }

  /**
   * Get all prompts
   */
  findAll(): Prompt[] {
    return this.db.select().from(prompts).all();
  }

  /**
   * Get builtin prompts only
   */
  findBuiltin(): Prompt[] {
    return this.db
      .select()
      .from(prompts)
      .where(eq(prompts.isBuiltin, true))
      .all();
  }

  /**
   * Get custom (non-builtin) prompts only
   */
  findCustom(): Prompt[] {
    return this.db
      .select()
      .from(prompts)
      .where(eq(prompts.isBuiltin, false))
      .all();
  }

  /**
   * Check if prompt exists
   */
  exists(id: string): boolean {
    const result = this.db
      .select({ id: prompts.id })
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    return !!result;
  }

  /**
   * Upsert prompt (create or update)
   */
  upsert(data: {
    id: string;
    name: string;
    description?: string;
    template: string;
    argsSchema?: PromptArgs;
    isBuiltin?: boolean;
  }): Prompt {
    if (this.exists(data.id)) {
      return this.update(data.id, {
        name: data.name,
        description: data.description,
        template: data.template,
        argsSchema: data.argsSchema,
      })!;
    }
    return this.create(data);
  }

  /**
   * Seed builtin prompts
   */
  seedBuiltinPrompts(builtinPrompts: Array<{
    id: string;
    name: string;
    description?: string;
    template: string;
    argsSchema?: PromptArgs;
  }>): number {
    let seeded = 0;

    for (const prompt of builtinPrompts) {
      if (!this.exists(prompt.id)) {
        this.create({
          ...prompt,
          isBuiltin: true,
        });
        seeded++;
      }
    }

    if (seeded > 0) {
      this.logger?.info({ count: seeded }, 'Seeded builtin prompts');
    }

    return seeded;
  }

  /**
   * Get parsed args schema
   */
  getArgsSchema(id: string): PromptArgs | null {
    const prompt = this.findById(id);
    if (!prompt?.argsSchemaJson) return null;

    try {
      return JSON.parse(prompt.argsSchemaJson) as PromptArgs;
    } catch {
      this.logger?.warn({ id }, 'Failed to parse prompt args schema');
      return null;
    }
  }

  /**
   * Count prompts
   */
  count(): { total: number; builtin: number; custom: number } {
    const total = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(prompts)
      .get()?.count ?? 0;

    const builtin = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(prompts)
      .where(eq(prompts.isBuiltin, true))
      .get()?.count ?? 0;

    return {
      total,
      builtin,
      custom: total - builtin,
    };
  }

  /**
   * Delete all non-builtin prompts
   */
  clearCustom(): number {
    const result = this.db
      .delete(prompts)
      .where(eq(prompts.isBuiltin, false))
      .run();

    if (result.changes > 0) {
      this.logger?.info({ count: result.changes }, 'Cleared custom prompts');
    }
    return result.changes;
  }
}
