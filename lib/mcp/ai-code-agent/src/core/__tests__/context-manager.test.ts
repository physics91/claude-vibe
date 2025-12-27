/**
 * ContextManager Tests
 * Tests for context resolution and merging with preset support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager, createContextManager, type ContextConfig } from '../context-manager.js';
import type { AnalysisContext } from '../../schemas/context.js';

describe('ContextManager', () => {
  describe('constructor', () => {
    it('should create instance with empty config', () => {
      const manager = new ContextManager({});

      expect(manager).toBeDefined();
      expect(manager.getDefaults()).toEqual({});
      expect(manager.listPresets()).toEqual([]);
    });

    it('should create instance with defaults', () => {
      const defaults: AnalysisContext = {
        language: 'typescript',
        platform: 'cross-platform',
      };
      const manager = new ContextManager({ defaults });

      expect(manager.getDefaults()).toEqual(defaults);
    });

    it('should create instance with presets', () => {
      const presets = {
        'web-app': { platform: 'web' as const, framework: 'react' },
        'cli-tool': { platform: 'cross-platform' as const, projectType: 'cli-tool' as const },
      };
      const manager = new ContextManager({ presets });

      expect(manager.listPresets()).toEqual(['web-app', 'cli-tool']);
      expect(manager.getPreset('web-app')).toEqual(presets['web-app']);
    });

    it('should create instance with active preset', () => {
      const presets = {
        'web-app': { platform: 'web' as const },
      };
      const manager = new ContextManager({ presets, activePreset: 'web-app' });

      // Active preset should be applied in resolve
      const resolved = manager.resolve();
      expect(resolved.platform).toBe('web');
    });

    it('should handle null activePreset', () => {
      const manager = new ContextManager({ activePreset: null });

      expect(manager.resolve()).toEqual({});
    });
  });

  describe('resolve', () => {
    describe('priority order', () => {
      it('should use defaults when no other context provided', () => {
        const defaults: AnalysisContext = {
          language: 'typescript',
          platform: 'cross-platform',
        };
        const manager = new ContextManager({ defaults });

        const result = manager.resolve();

        expect(result).toEqual(defaults);
      });

      it('should apply active preset over defaults', () => {
        const defaults: AnalysisContext = {
          language: 'javascript',
          platform: 'web',
        };
        const presets = {
          secure: { language: 'typescript', threatModel: 'public-api' as const },
        };
        const manager = new ContextManager({ defaults, presets, activePreset: 'secure' });

        const result = manager.resolve();

        expect(result.language).toBe('typescript'); // Overridden by preset
        expect(result.platform).toBe('web'); // From defaults
        expect(result.threatModel).toBe('public-api'); // From preset
      });

      it('should apply detected context over active preset', () => {
        const presets = {
          default: { language: 'javascript', platform: 'web' as const },
        };
        const manager = new ContextManager({ presets, activePreset: 'default' });
        const detectedContext = { language: 'python', framework: 'flask' };

        const result = manager.resolve(undefined, detectedContext);

        expect(result.language).toBe('python'); // Detected
        expect(result.platform).toBe('web'); // From preset
        expect(result.framework).toBe('flask'); // Detected
      });

      it('should apply request context over detected context', () => {
        const defaults: AnalysisContext = { language: 'javascript' };
        const manager = new ContextManager({ defaults });
        const detectedContext = { language: 'typescript', platform: 'cross-platform' as const };
        const requestContext: AnalysisContext = { language: 'python' };

        const result = manager.resolve(requestContext, detectedContext);

        expect(result.language).toBe('python'); // Request overrides
        expect(result.platform).toBe('cross-platform'); // From detected
      });

      it('should apply all four layers correctly', () => {
        const defaults: AnalysisContext = {
          language: 'javascript',
          platform: 'web',
          scope: 'full',
        };
        const presets = {
          secure: { threatModel: 'public-api' as const, platform: 'unix' as const },
        };
        const manager = new ContextManager({ defaults, presets, activePreset: 'secure' });
        const detectedContext = { framework: 'express', language: 'typescript' };
        const requestContext: AnalysisContext = { projectType: 'api-service' };

        const result = manager.resolve(requestContext, detectedContext);

        expect(result).toEqual({
          language: 'typescript', // Detected overrides preset which overrides default
          platform: 'unix', // Preset overrides default
          scope: 'full', // From defaults
          threatModel: 'public-api', // From preset
          framework: 'express', // From detected
          projectType: 'api-service', // From request
        });
      });
    });

    describe('preset reference in request', () => {
      it('should apply preset referenced in request context', () => {
        const presets = {
          security: { threatModel: 'multi-tenant' as const, focus: ['security'] as const },
        };
        const manager = new ContextManager({ presets });
        const requestContext: AnalysisContext = { preset: 'security', language: 'go' };

        const result = manager.resolve(requestContext);

        expect(result.threatModel).toBe('multi-tenant');
        expect(result.focus).toEqual(['security']);
        expect(result.language).toBe('go');
        expect(result.preset).toBeUndefined(); // preset reference should not be in result
      });

      it('should ignore non-existent preset reference', () => {
        const manager = new ContextManager({});
        const requestContext: AnalysisContext = { preset: 'non-existent', language: 'rust' };

        const result = manager.resolve(requestContext);

        expect(result.language).toBe('rust');
        expect(result.preset).toBeUndefined();
      });

      it('should apply request preset over active preset', () => {
        const presets = {
          active: { platform: 'web' as const },
          requested: { platform: 'mobile' as const },
        };
        const manager = new ContextManager({ presets, activePreset: 'active' });
        const requestContext: AnalysisContext = { preset: 'requested' };

        const result = manager.resolve(requestContext);

        expect(result.platform).toBe('mobile'); // Request preset wins
      });
    });

    describe('empty and undefined handling', () => {
      it('should return empty object when no context sources', () => {
        const manager = new ContextManager({});

        const result = manager.resolve();

        expect(result).toEqual({});
      });

      it('should handle undefined requestContext', () => {
        const defaults: AnalysisContext = { language: 'typescript' };
        const manager = new ContextManager({ defaults });

        const result = manager.resolve(undefined);

        expect(result).toEqual(defaults);
      });

      it('should handle undefined detectedContext', () => {
        const defaults: AnalysisContext = { language: 'typescript' };
        const manager = new ContextManager({ defaults });

        const result = manager.resolve({}, undefined);

        expect(result).toEqual(defaults);
      });

      it('should skip undefined values in context', () => {
        const defaults: AnalysisContext = { language: 'typescript', platform: 'web' };
        const manager = new ContextManager({ defaults });
        const requestContext: AnalysisContext = { language: undefined, projectType: 'web-app' };

        const result = manager.resolve(requestContext);

        expect(result.language).toBe('typescript'); // Not overridden by undefined
        expect(result.platform).toBe('web');
        expect(result.projectType).toBe('web-app');
      });

      it('should skip null values in context', () => {
        const defaults: AnalysisContext = { language: 'typescript' };
        const manager = new ContextManager({ defaults });
        const requestContext = { language: null } as unknown as AnalysisContext;

        const result = manager.resolve(requestContext);

        expect(result.language).toBe('typescript'); // Not overridden by null
      });
    });

    describe('custom fields deep merge', () => {
      it('should deep merge custom fields', () => {
        const defaults: AnalysisContext = {
          custom: { key1: 'value1', nested: { a: 1 } },
        };
        const manager = new ContextManager({ defaults });
        const requestContext: AnalysisContext = {
          custom: { key2: 'value2', nested: { b: 2 } },
        };

        const result = manager.resolve(requestContext);

        expect(result.custom).toEqual({
          key1: 'value1',
          key2: 'value2',
          nested: { b: 2 }, // Shallow merge within custom, so nested is replaced
        });
      });

      it('should handle custom field in detected context', () => {
        const manager = new ContextManager({});
        const detectedContext = { custom: { detected: true } };

        const result = manager.resolve(undefined, detectedContext);

        expect(result.custom).toEqual({ detected: true });
      });

      it('should merge custom from all sources', () => {
        const defaults: AnalysisContext = { custom: { from: 'defaults' } };
        const presets = { test: { custom: { from: 'preset' } } };
        const manager = new ContextManager({ defaults, presets, activePreset: 'test' });
        const detectedContext = { custom: { detected: true } };
        const requestContext: AnalysisContext = { custom: { requested: true } };

        const result = manager.resolve(requestContext, detectedContext);

        expect(result.custom).toEqual({
          from: 'preset', // Preset overrides defaults
          detected: true,
          requested: true,
        });
      });
    });
  });

  describe('listPresets', () => {
    it('should return empty array when no presets', () => {
      const manager = new ContextManager({});

      expect(manager.listPresets()).toEqual([]);
    });

    it('should return all preset names', () => {
      const presets = {
        'web-app': { platform: 'web' as const },
        'cli-tool': { platform: 'cross-platform' as const },
        'api-service': { platform: 'unix' as const },
      };
      const manager = new ContextManager({ presets });

      const names = manager.listPresets();

      expect(names).toHaveLength(3);
      expect(names).toContain('web-app');
      expect(names).toContain('cli-tool');
      expect(names).toContain('api-service');
    });
  });

  describe('getPreset', () => {
    it('should return preset by name', () => {
      const presets = {
        security: { threatModel: 'public-api' as const },
      };
      const manager = new ContextManager({ presets });

      expect(manager.getPreset('security')).toEqual({ threatModel: 'public-api' });
    });

    it('should return undefined for non-existent preset', () => {
      const manager = new ContextManager({});

      expect(manager.getPreset('non-existent')).toBeUndefined();
    });
  });

  describe('addPreset', () => {
    it('should add new preset', () => {
      const manager = new ContextManager({});

      manager.addPreset('new-preset', { language: 'rust' });

      expect(manager.getPreset('new-preset')).toEqual({ language: 'rust' });
      expect(manager.listPresets()).toContain('new-preset');
    });

    it('should update existing preset', () => {
      const presets = { existing: { language: 'javascript' } };
      const manager = new ContextManager({ presets });

      manager.addPreset('existing', { language: 'typescript', framework: 'react' });

      expect(manager.getPreset('existing')).toEqual({
        language: 'typescript',
        framework: 'react',
      });
    });

    it('should allow adding multiple presets', () => {
      const manager = new ContextManager({});

      manager.addPreset('preset1', { language: 'go' });
      manager.addPreset('preset2', { language: 'rust' });
      manager.addPreset('preset3', { language: 'python' });

      expect(manager.listPresets()).toHaveLength(3);
    });
  });

  describe('setActivePreset', () => {
    it('should set active preset', () => {
      const presets = {
        preset1: { language: 'typescript' },
        preset2: { language: 'python' },
      };
      const manager = new ContextManager({ presets });

      manager.setActivePreset('preset2');

      const result = manager.resolve();
      expect(result.language).toBe('python');
    });

    it('should allow setting null to clear active preset', () => {
      const presets = { preset1: { language: 'typescript' } };
      const manager = new ContextManager({ presets, activePreset: 'preset1' });

      manager.setActivePreset(null);

      const result = manager.resolve();
      expect(result.language).toBeUndefined();
    });

    it('should throw for non-existent preset', () => {
      const manager = new ContextManager({});

      expect(() => manager.setActivePreset('non-existent')).toThrow('Preset not found: non-existent');
    });

    it('should allow setting newly added preset', () => {
      const manager = new ContextManager({});

      manager.addPreset('new-preset', { language: 'kotlin' });
      manager.setActivePreset('new-preset');

      const result = manager.resolve();
      expect(result.language).toBe('kotlin');
    });
  });

  describe('getDefaults', () => {
    it('should return copy of defaults', () => {
      const defaults: AnalysisContext = { language: 'typescript' };
      const manager = new ContextManager({ defaults });

      const result = manager.getDefaults();

      expect(result).toEqual(defaults);
      expect(result).not.toBe(defaults); // Should be a copy
    });

    it('should return empty object when no defaults', () => {
      const manager = new ContextManager({});

      expect(manager.getDefaults()).toEqual({});
    });

    it('should not be affected by external modifications', () => {
      const manager = new ContextManager({ defaults: { language: 'typescript' } });

      const returned = manager.getDefaults();
      returned.language = 'python';

      expect(manager.getDefaults().language).toBe('typescript');
    });
  });

  describe('updateDefaults', () => {
    it('should update defaults', () => {
      const manager = new ContextManager({ defaults: { language: 'javascript' } });

      manager.updateDefaults({ platform: 'web' });

      expect(manager.getDefaults()).toEqual({
        language: 'javascript',
        platform: 'web',
      });
    });

    it('should override existing default values', () => {
      const manager = new ContextManager({ defaults: { language: 'javascript' } });

      manager.updateDefaults({ language: 'typescript' });

      expect(manager.getDefaults().language).toBe('typescript');
    });

    it('should deep merge custom fields in defaults', () => {
      const manager = new ContextManager({
        defaults: { custom: { key1: 'value1' } },
      });

      manager.updateDefaults({ custom: { key2: 'value2' } });

      expect(manager.getDefaults().custom).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should affect future resolve calls', () => {
      const manager = new ContextManager({});

      manager.updateDefaults({ language: 'go' });

      expect(manager.resolve().language).toBe('go');
    });
  });
});

describe('createContextManager', () => {
  it('should create ContextManager from server config', () => {
    const config = {
      defaults: { language: 'typescript' },
      presets: { web: { platform: 'web' as const } },
      activePreset: 'web',
      allowEnvOverride: true,
      autoDetect: true,
    };

    const manager = createContextManager(config);

    expect(manager).toBeInstanceOf(ContextManager);
    expect(manager.getDefaults()).toEqual({ language: 'typescript' });
    expect(manager.listPresets()).toEqual(['web']);
    expect(manager.resolve().platform).toBe('web');
  });

  it('should handle minimal config', () => {
    const config = {};

    const manager = createContextManager(config);

    expect(manager).toBeInstanceOf(ContextManager);
    expect(manager.getDefaults()).toEqual({});
    expect(manager.listPresets()).toEqual([]);
  });

  it('should handle config with undefined values', () => {
    const config = {
      defaults: undefined,
      presets: undefined,
      activePreset: undefined,
    };

    const manager = createContextManager(config);

    expect(manager.getDefaults()).toEqual({});
    expect(manager.listPresets()).toEqual([]);
  });
});
