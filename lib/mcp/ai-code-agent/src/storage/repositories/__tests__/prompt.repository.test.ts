/**
 * Prompt Repository Integration Tests
 * Tests CRUD operations for MCP prompts with real SQLite database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../schema.js';
import { PromptRepository, type PromptArgs } from '../prompt.repository.js';

// Test fixtures
const createTestDb = (): BetterSQLite3Database<typeof schema> => {
  const sqlite = new Database(':memory:');

  sqlite.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_prompts_is_builtin ON prompts(is_builtin);
  `);

  return drizzle(sqlite, { schema });
};

describe('PromptRepository', () => {
  let db: BetterSQLite3Database<typeof schema>;
  let repo: PromptRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new PromptRepository(db);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('should create prompt with required fields', () => {
      const prompt = repo.create({
        id: 'test-prompt',
        name: 'Test Prompt',
        template: 'Review this code: {{code}}',
      });

      expect(prompt.id).toBe('test-prompt');
      expect(prompt.name).toBe('Test Prompt');
      expect(prompt.template).toBe('Review this code: {{code}}');
      expect(prompt.isBuiltin).toBe(false);
      expect(prompt.createdAt).toBeDefined();
      expect(prompt.updatedAt).toBeDefined();
    });

    it('should create prompt with description', () => {
      const prompt = repo.create({
        id: 'with-desc',
        name: 'Descriptive Prompt',
        description: 'A detailed description',
        template: '{{input}}',
      });

      expect(prompt.description).toBe('A detailed description');
    });

    it('should create prompt with args schema', () => {
      const argsSchema: PromptArgs = {
        code: { type: 'string', description: 'Code to review', required: true },
        language: { type: 'string', default: 'javascript' },
      };

      repo.create({
        id: 'with-args',
        name: 'Args Prompt',
        template: '{{code}}',
        argsSchema,
      });

      const retrieved = repo.getArgsSchema('with-args');
      expect(retrieved).toEqual(argsSchema);
    });

    it('should create builtin prompt', () => {
      const prompt = repo.create({
        id: 'builtin-1',
        name: 'Builtin Prompt',
        template: '{{input}}',
        isBuiltin: true,
      });

      expect(prompt.isBuiltin).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent id', () => {
      expect(repo.findById('no-exist')).toBeNull();
    });

    it('should return prompt for existing id', () => {
      repo.create({ id: 'find-me', name: 'Find Me', template: '{{x}}' });

      const found = repo.findById('find-me');

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Find Me');
    });
  });

  describe('findByName', () => {
    it('should return null for non-existent name', () => {
      expect(repo.findByName('Unknown')).toBeNull();
    });

    it('should return prompt for existing name', () => {
      repo.create({ id: 'id-1', name: 'Unique Name', template: '{{x}}' });

      const found = repo.findByName('Unique Name');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('id-1');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repo.create({
        id: 'update-me',
        name: 'Original Name',
        description: 'Original desc',
        template: 'Original template',
      });
    });

    it('should update name', () => {
      const updated = repo.update('update-me', { name: 'New Name' });
      expect(updated?.name).toBe('New Name');
    });

    it('should update description', () => {
      const updated = repo.update('update-me', { description: 'New desc' });
      expect(updated?.description).toBe('New desc');
    });

    it('should update template', () => {
      const updated = repo.update('update-me', { template: 'New template' });
      expect(updated?.template).toBe('New template');
    });

    it('should update args schema', () => {
      const newSchema: PromptArgs = {
        newArg: { type: 'number', required: true },
      };

      repo.update('update-me', { argsSchema: newSchema });

      const retrieved = repo.getArgsSchema('update-me');
      expect(retrieved).toEqual(newSchema);
    });

    it('should update updatedAt timestamp', () => {
      const original = repo.findById('update-me');
      const originalUpdatedAt = original?.updatedAt;

      // Advance time to ensure different timestamp
      vi.advanceTimersByTime(1000);

      const updated = repo.update('update-me', { name: 'Changed' });

      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should return null for non-existent id', () => {
      expect(repo.update('no-exist', { name: 'x' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing prompt', () => {
      repo.create({ id: 'delete-me', name: 'Delete', template: '{{x}}' });

      const deleted = repo.delete('delete-me');

      expect(deleted).toBe(true);
      expect(repo.findById('delete-me')).toBeNull();
    });

    it('should return false for non-existent id', () => {
      expect(repo.delete('no-exist')).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return empty array for empty db', () => {
      expect(repo.findAll()).toHaveLength(0);
    });

    it('should return all prompts', () => {
      repo.create({ id: 'p1', name: 'Prompt 1', template: '{{a}}' });
      repo.create({ id: 'p2', name: 'Prompt 2', template: '{{b}}' });
      repo.create({ id: 'p3', name: 'Prompt 3', template: '{{c}}' });

      expect(repo.findAll()).toHaveLength(3);
    });
  });

  describe('findBuiltin', () => {
    beforeEach(() => {
      repo.create({ id: 'b1', name: 'Builtin 1', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'b2', name: 'Builtin 2', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'c1', name: 'Custom 1', template: '{{x}}', isBuiltin: false });
    });

    it('should return only builtin prompts', () => {
      const builtins = repo.findBuiltin();

      expect(builtins).toHaveLength(2);
      expect(builtins.every((p) => p.isBuiltin)).toBe(true);
    });
  });

  describe('findCustom', () => {
    beforeEach(() => {
      repo.create({ id: 'b1', name: 'Builtin 1', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'c1', name: 'Custom 1', template: '{{x}}', isBuiltin: false });
      repo.create({ id: 'c2', name: 'Custom 2', template: '{{x}}', isBuiltin: false });
    });

    it('should return only custom prompts', () => {
      const custom = repo.findCustom();

      expect(custom).toHaveLength(2);
      expect(custom.every((p) => !p.isBuiltin)).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent id', () => {
      expect(repo.exists('no-exist')).toBe(false);
    });

    it('should return true for existing id', () => {
      repo.create({ id: 'exists', name: 'Exists', template: '{{x}}' });
      expect(repo.exists('exists')).toBe(true);
    });
  });

  describe('upsert', () => {
    it('should create new prompt if not exists', () => {
      const prompt = repo.upsert({
        id: 'new-prompt',
        name: 'New Prompt',
        template: '{{new}}',
      });

      expect(prompt.id).toBe('new-prompt');
      expect(repo.exists('new-prompt')).toBe(true);
    });

    it('should update existing prompt', () => {
      repo.create({ id: 'existing', name: 'Old Name', template: '{{old}}' });

      const updated = repo.upsert({
        id: 'existing',
        name: 'New Name',
        template: '{{new}}',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.template).toBe('{{new}}');
    });
  });

  describe('seedBuiltinPrompts', () => {
    const builtinPrompts = [
      { id: 'code-review', name: 'Code Review', template: 'Review: {{code}}' },
      { id: 'security-audit', name: 'Security Audit', template: 'Audit: {{code}}' },
    ];

    it('should seed prompts when database is empty', () => {
      const seeded = repo.seedBuiltinPrompts(builtinPrompts);

      expect(seeded).toBe(2);
      expect(repo.findBuiltin()).toHaveLength(2);
    });

    it('should not duplicate existing prompts', () => {
      repo.seedBuiltinPrompts(builtinPrompts);
      const secondSeeded = repo.seedBuiltinPrompts(builtinPrompts);

      expect(secondSeeded).toBe(0);
      expect(repo.findBuiltin()).toHaveLength(2);
    });

    it('should seed only missing prompts', () => {
      repo.create({ id: 'code-review', name: 'Existing', template: '{{x}}', isBuiltin: true });

      const seeded = repo.seedBuiltinPrompts(builtinPrompts);

      expect(seeded).toBe(1); // Only security-audit seeded
    });

    it('should mark seeded prompts as builtin', () => {
      repo.seedBuiltinPrompts(builtinPrompts);

      const prompts = repo.findAll();
      expect(prompts.every((p) => p.isBuiltin)).toBe(true);
    });
  });

  describe('getArgsSchema', () => {
    it('should return null for non-existent prompt', () => {
      expect(repo.getArgsSchema('no-exist')).toBeNull();
    });

    it('should return null for prompt without schema', () => {
      repo.create({ id: 'no-schema', name: 'No Schema', template: '{{x}}' });
      expect(repo.getArgsSchema('no-schema')).toBeNull();
    });

    it('should return parsed schema', () => {
      const schema: PromptArgs = {
        input: { type: 'string', required: true },
        format: { type: 'string', enum: ['json', 'text'], default: 'text' },
      };

      repo.create({
        id: 'with-schema',
        name: 'With Schema',
        template: '{{input}}',
        argsSchema: schema,
      });

      expect(repo.getArgsSchema('with-schema')).toEqual(schema);
    });
  });

  describe('count', () => {
    it('should return zeros for empty db', () => {
      const counts = repo.count();

      expect(counts).toEqual({ total: 0, builtin: 0, custom: 0 });
    });

    it('should count prompts correctly', () => {
      repo.create({ id: 'b1', name: 'B1', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'b2', name: 'B2', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'c1', name: 'C1', template: '{{x}}', isBuiltin: false });
      repo.create({ id: 'c2', name: 'C2', template: '{{x}}', isBuiltin: false });
      repo.create({ id: 'c3', name: 'C3', template: '{{x}}', isBuiltin: false });

      const counts = repo.count();

      expect(counts).toEqual({ total: 5, builtin: 2, custom: 3 });
    });
  });

  describe('clearCustom', () => {
    beforeEach(() => {
      repo.create({ id: 'b1', name: 'Builtin', template: '{{x}}', isBuiltin: true });
      repo.create({ id: 'c1', name: 'Custom 1', template: '{{x}}' });
      repo.create({ id: 'c2', name: 'Custom 2', template: '{{x}}' });
    });

    it('should delete only custom prompts', () => {
      const deleted = repo.clearCustom();

      expect(deleted).toBe(2);
      expect(repo.findBuiltin()).toHaveLength(1);
      expect(repo.findCustom()).toHaveLength(0);
    });

    it('should not affect builtin prompts', () => {
      repo.clearCustom();

      const builtin = repo.findById('b1');
      expect(builtin).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle complex template with special characters', () => {
      const template = `
        # Review {{code}}

        <instructions>
        Look for: \`bugs\`, "issues", and 'problems'
        </instructions>
      `;

      repo.create({
        id: 'complex',
        name: 'Complex Template',
        template,
      });

      const found = repo.findById('complex');
      expect(found?.template).toBe(template);
    });

    it('should handle unicode in all fields', () => {
      repo.create({
        id: 'unicode-test',
        name: 'テスト Prompt 🔥',
        description: 'Description with émojis 日本語',
        template: 'Review: {{코드}}',
      });

      const found = repo.findById('unicode-test');
      expect(found?.name).toBe('テスト Prompt 🔥');
      expect(found?.description).toBe('Description with émojis 日本語');
    });

    it('should handle large templates', () => {
      const largeTemplate = 'x'.repeat(100000);

      repo.create({
        id: 'large',
        name: 'Large',
        template: largeTemplate,
      });

      const found = repo.findById('large');
      expect(found?.template).toHaveLength(100000);
    });

    it('should handle complex args schema', () => {
      const complexSchema: PromptArgs = {
        code: {
          type: 'string',
          description: 'The code to review',
          required: true,
        },
        options: {
          type: 'object',
          default: { strict: true, maxIssues: 10 },
        },
        tags: {
          type: 'array',
          enum: ['security', 'performance', 'style'],
        },
      };

      repo.create({
        id: 'complex-schema',
        name: 'Complex',
        template: '{{code}}',
        argsSchema: complexSchema,
      });

      const retrieved = repo.getArgsSchema('complex-schema');
      expect(retrieved).toEqual(complexSchema);
    });
  });
});
