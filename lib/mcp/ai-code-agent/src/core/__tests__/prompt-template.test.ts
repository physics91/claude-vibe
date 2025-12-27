/**
 * PromptTemplateEngine Tests
 * Tests for prompt template rendering with context-aware variable substitution
 */

import { describe, it, expect } from 'vitest';
import {
  PromptTemplateEngine,
  createTemplateEngine,
  DIRECT_CODEBASE_ANALYSIS_INSTRUCTION,
  DEFAULT_FORMAT_INSTRUCTIONS,
  THREAT_MODEL_GUIDELINES,
  type TemplateEngineConfig,
  type TemplateVariables,
} from '../prompt-template.js';
import type { AnalysisContext } from '../../schemas/context.js';
import type { PromptTemplate } from '../../schemas/prompts.js';

describe('PromptTemplateEngine', () => {
  const defaultConfig: TemplateEngineConfig = {
    defaultTemplate: 'default',
  };

  describe('constructor', () => {
    it('should create engine with default config', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      expect(engine).toBeDefined();
    });

    it('should register built-in templates', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      expect(engine.listTemplates()).toContain('default');
      expect(engine.listTemplates()).toContain('security-focused');
      expect(engine.listTemplates()).toContain('performance-focused');
      expect(engine.listTemplates()).toContain('code-quality');
    });

    it('should register custom templates from config', () => {
      const customTemplate: PromptTemplate = {
        id: 'custom',
        name: 'Custom Template',
        description: 'A custom template',
        template: 'Custom: {{prompt}}',
        outputFormat: 'json',
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { custom: customTemplate },
      });

      expect(engine.listTemplates()).toContain('custom');
      expect(engine.getTemplate('custom')).toEqual(customTemplate);
    });

    it('should set service templates from config', () => {
      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        serviceTemplates: {
          codex: 'security-focused',
          gemini: 'performance-focused',
        },
      });

      expect(engine.getTemplateForService('codex')).toBe('security-focused');
      expect(engine.getTemplateForService('gemini')).toBe('performance-focused');
    });

    it('should handle missing service templates', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      expect(engine.getTemplateForService('codex')).toBe('default');
      expect(engine.getTemplateForService('gemini')).toBe('default');
    });
  });

  describe('render', () => {
    it('should render template with basic variables', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'const x = 1;',
        context: {},
        formatInstructions: 'Return JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('const x = 1;');
      expect(result).toContain('Return JSON');
      expect(result).toContain(DIRECT_CODEBASE_ANALYSIS_INSTRUCTION);
    });

    it('should fall back to default template for unknown template ID', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'test code',
        context: {},
        formatInstructions: 'JSON format',
      };

      const result = engine.render('unknown-template', variables);

      expect(result).toContain('test code');
      expect(result).toContain('Review this code');
    });

    it('should render security-focused template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'user input handling',
        context: {},
        formatInstructions: 'JSON',
      };

      const result = engine.render('security-focused', variables);

      expect(result).toContain('Injection attacks');
      expect(result).toContain('Authentication and Authorization');
      expect(result).toContain('security issues');
    });

    it('should render performance-focused template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'loop optimization',
        context: {},
        formatInstructions: 'JSON',
      };

      const result = engine.render('performance-focused', variables);

      expect(result).toContain('Inefficient algorithms');
      expect(result).toContain('Memory leaks');
      expect(result).toContain('performance issues');
    });

    it('should render code-quality template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'refactoring',
        context: {},
        formatInstructions: 'JSON',
      };

      const result = engine.render('code-quality', variables);

      expect(result).toContain('Code organization');
      expect(result).toContain('SOLID principles');
      expect(result).toContain('quality issues');
    });

    it('should clean up empty sections placeholder', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'test',
        context: {},
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).not.toContain('{{sections}}');
    });
  });

  describe('buildContextSection', () => {
    it('should build context with all fields', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: {
          scope: 'function',
          threatModel: 'public-api',
          platform: 'web',
          projectType: 'backend',
          language: 'typescript',
          framework: 'express',
          focus: ['security', 'performance'],
          fileName: 'app.ts',
        },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('Code Scope: function');
      expect(result).toContain('Threat Model: public-api');
      expect(result).toContain('Platform: web');
      expect(result).toContain('Project Type: backend');
      expect(result).toContain('Language: typescript');
      expect(result).toContain('Framework: express');
      expect(result).toContain('Focus Areas: security, performance');
      expect(result).toContain('File: app.ts');
    });

    it('should handle empty context', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: {},
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).not.toContain('Analysis Context:');
    });

    it('should include custom fields', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: {
          custom: {
            apiVersion: 'v2',
            environment: 'production',
          },
        },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('apiVersion: v2');
      expect(result).toContain('environment: production');
    });

    it('should skip null/undefined custom fields', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: {
          custom: {
            defined: 'value',
            nullField: null as unknown as string,
            undefinedField: undefined as unknown as string,
          },
        },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('defined: value');
      expect(result).not.toContain('nullField');
      expect(result).not.toContain('undefinedField');
    });
  });

  describe('getThreatModelGuideline', () => {
    it('should include local-user-tool guidelines', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'local-user-tool' },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('LOCAL tool');
      expect(result).toContain('TRUSTED developers');
      expect(result).toContain('LOW severity');
    });

    it('should include internal-service guidelines', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'internal-service' },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('INTERNAL service');
      expect(result).toContain('SQL injection → HIGH');
    });

    it('should include multi-tenant guidelines', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'multi-tenant' },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('UNTRUSTED input');
      expect(result).toContain('CRITICAL');
    });

    it('should include public-api guidelines', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'public-api' },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('INTERNET-FACING');
      expect(result).toContain('Authentication issues → CRITICAL');
    });

    it('should include library guidelines', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'library' },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('LIBRARY');
      expect(result).toContain('API design');
    });

    it('should handle unknown threat model', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const variables: TemplateVariables = {
        prompt: 'code',
        context: { threatModel: 'unknown-model' as AnalysisContext['threatModel'] },
        formatInstructions: 'JSON',
      };

      const result = engine.render('default', variables);

      expect(result).toContain('Using threat model "unknown-model"');
    });
  });

  describe('evaluateSections', () => {
    it('should include sections matching conditions', () => {
      const customTemplate: PromptTemplate = {
        id: 'with-sections',
        name: 'With Sections',
        description: 'Template with sections',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [
          { condition: 'language', content: 'Language-specific section', priority: 1 },
          { condition: 'framework', content: 'Framework-specific section', priority: 2 },
        ],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { 'with-sections': customTemplate },
      });

      const result = engine.render('with-sections', {
        prompt: 'code',
        context: { language: 'typescript', framework: 'express' },
        formatInstructions: 'JSON',
      });

      expect(result).toContain('Language-specific section');
      expect(result).toContain('Framework-specific section');
    });

    it('should exclude sections not matching conditions', () => {
      const customTemplate: PromptTemplate = {
        id: 'with-sections',
        name: 'With Sections',
        description: 'Template with sections',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [
          { condition: 'language', content: 'Language section', priority: 1 },
          { condition: 'framework', content: 'Framework section', priority: 2 },
        ],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { 'with-sections': customTemplate },
      });

      const result = engine.render('with-sections', {
        prompt: 'code',
        context: { language: 'typescript' }, // No framework
        formatInstructions: 'JSON',
      });

      expect(result).toContain('Language section');
      expect(result).not.toContain('Framework section');
    });

    it('should sort sections by priority', () => {
      const customTemplate: PromptTemplate = {
        id: 'with-sections',
        name: 'With Sections',
        description: 'Template with sections',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [
          { condition: undefined, content: 'Second (priority 2)', priority: 2 },
          { condition: undefined, content: 'First (priority 1)', priority: 1 },
          { condition: undefined, content: 'Third (priority 3)', priority: 3 },
        ],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { 'with-sections': customTemplate },
      });

      const result = engine.render('with-sections', {
        prompt: 'code',
        context: {},
        formatInstructions: 'JSON',
      });

      const firstIndex = result.indexOf('First');
      const secondIndex = result.indexOf('Second');
      const thirdIndex = result.indexOf('Third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equality condition', () => {
      const customTemplate: PromptTemplate = {
        id: 'conditional',
        name: 'Conditional',
        description: 'Template with conditional',
        template: "{{sections}}\n{{prompt}}",
        outputFormat: 'json',
        sections: [
          { condition: "language === 'typescript'", content: 'TypeScript!', priority: 1 },
        ],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { conditional: customTemplate },
      });

      const resultMatch = engine.render('conditional', {
        prompt: 'code',
        context: { language: 'typescript' },
        formatInstructions: 'JSON',
      });

      const resultNoMatch = engine.render('conditional', {
        prompt: 'code',
        context: { language: 'javascript' },
        formatInstructions: 'JSON',
      });

      expect(resultMatch).toContain('TypeScript!');
      expect(resultNoMatch).not.toContain('TypeScript!');
    });

    it('should evaluate inequality condition', () => {
      const customTemplate: PromptTemplate = {
        id: 'conditional',
        name: 'Conditional',
        description: 'Template with conditional',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [
          { condition: "threatModel !== 'local-user-tool'", content: 'Not local!', priority: 1 },
        ],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { conditional: customTemplate },
      });

      const resultMatch = engine.render('conditional', {
        prompt: 'code',
        context: { threatModel: 'public-api' },
        formatInstructions: 'JSON',
      });

      const resultNoMatch = engine.render('conditional', {
        prompt: 'code',
        context: { threatModel: 'local-user-tool' },
        formatInstructions: 'JSON',
      });

      expect(resultMatch).toContain('Not local!');
      expect(resultNoMatch).not.toContain('Not local!');
    });

    it('should evaluate field existence condition', () => {
      const customTemplate: PromptTemplate = {
        id: 'conditional',
        name: 'Conditional',
        description: 'Template with conditional',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [{ condition: 'framework', content: 'Has framework!', priority: 1 }],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { conditional: customTemplate },
      });

      const resultMatch = engine.render('conditional', {
        prompt: 'code',
        context: { framework: 'express' },
        formatInstructions: 'JSON',
      });

      const resultNoMatch = engine.render('conditional', {
        prompt: 'code',
        context: {},
        formatInstructions: 'JSON',
      });

      expect(resultMatch).toContain('Has framework!');
      expect(resultNoMatch).not.toContain('Has framework!');
    });

    it('should include sections with no condition', () => {
      const customTemplate: PromptTemplate = {
        id: 'conditional',
        name: 'Conditional',
        description: 'Template with conditional',
        template: '{{sections}}\n{{prompt}}',
        outputFormat: 'json',
        sections: [{ content: 'Always included', priority: 1 }],
      };

      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: { conditional: customTemplate },
      });

      const result = engine.render('conditional', {
        prompt: 'code',
        context: {},
        formatInstructions: 'JSON',
      });

      expect(result).toContain('Always included');
    });
  });

  describe('getTemplate', () => {
    it('should return template by ID', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      const template = engine.getTemplate('default');

      expect(template).toBeDefined();
      expect(template?.id).toBe('default');
      expect(template?.name).toBe('Default Analysis');
    });

    it('should return undefined for unknown template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      const template = engine.getTemplate('unknown');

      expect(template).toBeUndefined();
    });
  });

  describe('listTemplates', () => {
    it('should list all built-in templates', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      const templates = engine.listTemplates();

      expect(templates).toHaveLength(4);
      expect(templates).toContain('default');
      expect(templates).toContain('security-focused');
      expect(templates).toContain('performance-focused');
      expect(templates).toContain('code-quality');
    });

    it('should include custom templates', () => {
      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        templates: {
          custom1: { id: 'custom1', name: 'C1', description: 'd', template: 't', outputFormat: 'json' },
          custom2: { id: 'custom2', name: 'C2', description: 'd', template: 't', outputFormat: 'json' },
        },
      });

      const templates = engine.listTemplates();

      expect(templates).toHaveLength(6);
      expect(templates).toContain('custom1');
      expect(templates).toContain('custom2');
    });
  });

  describe('addTemplate', () => {
    it('should add template at runtime', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const newTemplate: PromptTemplate = {
        id: 'runtime',
        name: 'Runtime Template',
        description: 'Added at runtime',
        template: 'Runtime: {{prompt}}',
        outputFormat: 'json',
      };

      engine.addTemplate(newTemplate);

      expect(engine.getTemplate('runtime')).toEqual(newTemplate);
      expect(engine.listTemplates()).toContain('runtime');
    });

    it('should update existing template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);
      const updatedTemplate: PromptTemplate = {
        id: 'default',
        name: 'Updated Default',
        description: 'Updated',
        template: 'Updated: {{prompt}}',
        outputFormat: 'json',
      };

      engine.addTemplate(updatedTemplate);

      const result = engine.render('default', {
        prompt: 'test',
        context: {},
        formatInstructions: 'JSON',
      });

      expect(result).toContain('Updated: test');
    });
  });

  describe('setDefaultTemplate', () => {
    it('should set default template', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      engine.setDefaultTemplate('security-focused');

      // Render unknown template should use new default
      const result = engine.render('unknown', {
        prompt: 'test',
        context: {},
        formatInstructions: 'JSON',
      });

      expect(result).toContain('security issues');
    });

    it('should throw for unknown template ID', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      expect(() => engine.setDefaultTemplate('nonexistent')).toThrow(
        'Template not found: nonexistent'
      );
    });
  });

  describe('getTemplateForService', () => {
    it('should return service-specific template', () => {
      const engine = new PromptTemplateEngine({
        ...defaultConfig,
        serviceTemplates: {
          codex: 'security-focused',
          gemini: 'code-quality',
        },
      });

      expect(engine.getTemplateForService('codex')).toBe('security-focused');
      expect(engine.getTemplateForService('gemini')).toBe('code-quality');
    });

    it('should return default template when not configured', () => {
      const engine = new PromptTemplateEngine(defaultConfig);

      expect(engine.getTemplateForService('codex')).toBe('default');
      expect(engine.getTemplateForService('gemini')).toBe('default');
    });
  });
});

describe('createTemplateEngine', () => {
  it('should create engine using factory function', () => {
    const engine = createTemplateEngine({ defaultTemplate: 'default' });

    expect(engine).toBeInstanceOf(PromptTemplateEngine);
    expect(engine.listTemplates()).toContain('default');
  });
});

describe('Exported constants', () => {
  it('should export DIRECT_CODEBASE_ANALYSIS_INSTRUCTION', () => {
    expect(DIRECT_CODEBASE_ANALYSIS_INSTRUCTION).toBeDefined();
    expect(DIRECT_CODEBASE_ANALYSIS_INSTRUCTION).toContain('DIRECT CODE ANALYSIS');
  });

  it('should export DEFAULT_FORMAT_INSTRUCTIONS', () => {
    expect(DEFAULT_FORMAT_INSTRUCTIONS).toBeDefined();
    expect(DEFAULT_FORMAT_INSTRUCTIONS).toContain('valid JSON');
    expect(DEFAULT_FORMAT_INSTRUCTIONS).toContain('findings');
  });

  it('should export THREAT_MODEL_GUIDELINES', () => {
    expect(THREAT_MODEL_GUIDELINES).toBeDefined();
    expect(THREAT_MODEL_GUIDELINES).toContain('local-user-tool');
    expect(THREAT_MODEL_GUIDELINES).toContain('multi-tenant');
  });
});
