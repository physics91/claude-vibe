/**
 * WarningSystem Tests
 * Tests for warning generation based on context analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WarningSystem,
  createWarningSystem,
  DEFAULT_WARNING_CONFIG,
  type WarningConfig,
  type ContextWarning,
} from '../warnings.js';
import type { AnalysisContext } from '../../schemas/context.js';

describe('WarningSystem', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      expect(system).toBeDefined();
      expect(system.isEnabled()).toBe(true);
    });

    it('should create instance with suppressions', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: ['MISSING_SCOPE', 'WARN_MISSING_PLATFORM'],
      });

      expect(system).toBeDefined();
    });

    it('should create disabled instance', () => {
      const system = new WarningSystem({
        enabled: false,
        showTips: true,
        suppressions: [],
      });

      expect(system.isEnabled()).toBe(false);
    });
  });

  describe('checkContext', () => {
    let system: WarningSystem;

    beforeEach(() => {
      system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });
    });

    it('should return empty array when disabled', () => {
      const disabledSystem = new WarningSystem({
        enabled: false,
        showTips: true,
        suppressions: [],
      });

      const warnings = disabledSystem.checkContext({});

      expect(warnings).toEqual([]);
    });

    it('should warn about missing scope', () => {
      const warnings = system.checkContext({ language: 'typescript' });

      const scopeWarning = warnings.find(w => w.field === 'scope' && w.code === 'WARN_MISSING_SCOPE');
      expect(scopeWarning).toBeDefined();
      expect(scopeWarning?.severity).toBe('info');
      expect(scopeWarning?.message).toContain('scope not specified');
    });

    it('should warn about missing threat model', () => {
      const warnings = system.checkContext({ language: 'typescript' });

      const threatWarning = warnings.find(w => w.field === 'threatModel');
      expect(threatWarning).toBeDefined();
      expect(threatWarning?.severity).toBe('warning');
      expect(threatWarning?.code).toBe('WARN_MISSING_THREAT_MODEL');
    });

    it('should warn about missing platform', () => {
      const warnings = system.checkContext({ language: 'typescript' });

      const platformWarning = warnings.find(w => w.field === 'platform');
      expect(platformWarning).toBeDefined();
      expect(platformWarning?.severity).toBe('info');
      expect(platformWarning?.code).toBe('WARN_MISSING_PLATFORM');
    });

    it('should warn about missing language', () => {
      const warnings = system.checkContext({});

      const languageWarning = warnings.find(w => w.field === 'language');
      expect(languageWarning).toBeDefined();
      expect(languageWarning?.severity).toBe('info');
      expect(languageWarning?.code).toBe('WARN_MISSING_LANGUAGE');
    });

    it('should warn about partial code analysis', () => {
      const warnings = system.checkContext({ scope: 'partial' });

      const partialWarning = warnings.find(w => w.code === 'WARN_PARTIAL_CODE');
      expect(partialWarning).toBeDefined();
      expect(partialWarning?.severity).toBe('info');
      expect(partialWarning?.field).toBe('scope');
    });

    it('should not warn about scope when scope is full', () => {
      const warnings = system.checkContext({ scope: 'full' });

      const scopeWarning = warnings.find(w => w.code === 'WARN_MISSING_SCOPE');
      expect(scopeWarning).toBeUndefined();
    });

    it('should not warn about threat model when specified', () => {
      const warnings = system.checkContext({ threatModel: 'public-api' });

      const threatWarning = warnings.find(w => w.code === 'WARN_MISSING_THREAT_MODEL');
      expect(threatWarning).toBeUndefined();
    });

    it('should not warn about platform when specified', () => {
      const warnings = system.checkContext({ platform: 'unix' });

      const platformWarning = warnings.find(w => w.code === 'WARN_MISSING_PLATFORM');
      expect(platformWarning).toBeUndefined();
    });

    it('should not warn about language when specified', () => {
      const warnings = system.checkContext({ language: 'python' });

      const languageWarning = warnings.find(w => w.code === 'WARN_MISSING_LANGUAGE');
      expect(languageWarning).toBeUndefined();
    });

    it('should return no warnings for complete context', () => {
      const context: AnalysisContext = {
        scope: 'full',
        threatModel: 'local-user-tool',
        platform: 'cross-platform',
        language: 'typescript',
      };

      const warnings = system.checkContext(context);

      expect(warnings).toHaveLength(0);
    });

    it('should respect suppressions by key', () => {
      const suppressedSystem = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: ['MISSING_SCOPE', 'MISSING_LANGUAGE'],
      });

      const warnings = suppressedSystem.checkContext({});

      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeUndefined();
      expect(warnings.find(w => w.code === 'WARN_MISSING_LANGUAGE')).toBeUndefined();
      expect(warnings.find(w => w.code === 'WARN_MISSING_THREAT_MODEL')).toBeDefined();
    });

    it('should respect suppressions by code', () => {
      const suppressedSystem = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: ['WARN_MISSING_SCOPE', 'WARN_MISSING_LANGUAGE'],
      });

      const warnings = suppressedSystem.checkContext({});

      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeUndefined();
      expect(warnings.find(w => w.code === 'WARN_MISSING_LANGUAGE')).toBeUndefined();
    });

    it('should suppress partial code warning', () => {
      const suppressedSystem = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: ['PARTIAL_CODE_ANALYSIS'],
      });

      const warnings = suppressedSystem.checkContext({ scope: 'partial' });

      expect(warnings.find(w => w.code === 'WARN_PARTIAL_CODE')).toBeUndefined();
    });
  });

  describe('formatWarnings', () => {
    it('should return empty string for no warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const formatted = system.formatWarnings([]);

      expect(formatted).toBe('');
    });

    it('should format warnings as markdown', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_TEST',
          severity: 'warning',
          message: 'Test warning message',
          tip: 'Test tip',
          field: 'test',
        },
      ];

      const formatted = system.formatWarnings(warnings);

      expect(formatted).toContain('## Warnings');
      expect(formatted).toContain('⚠️');
      expect(formatted).toContain('Test warning message');
      expect(formatted).toContain('WARN_TEST');
      expect(formatted).toContain('**Tip:** Test tip');
    });

    it('should use info icon for info severity', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'INFO_TEST',
          severity: 'info',
          message: 'Info message',
          tip: 'Info tip',
          field: 'test',
        },
      ];

      const formatted = system.formatWarnings(warnings);

      expect(formatted).toContain('ℹ️');
    });

    it('should hide tips when showTips is false', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: false,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_TEST',
          severity: 'warning',
          message: 'Test message',
          tip: 'Hidden tip',
          field: 'test',
        },
      ];

      const formatted = system.formatWarnings(warnings);

      expect(formatted).not.toContain('**Tip:**');
      expect(formatted).not.toContain('Hidden tip');
    });

    it('should format multiple warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_1',
          severity: 'warning',
          message: 'First warning',
          tip: 'Tip 1',
          field: 'field1',
        },
        {
          code: 'WARN_2',
          severity: 'info',
          message: 'Second warning',
          tip: 'Tip 2',
          field: 'field2',
        },
      ];

      const formatted = system.formatWarnings(warnings);

      expect(formatted).toContain('First warning');
      expect(formatted).toContain('Second warning');
      expect(formatted).toContain('WARN_1');
      expect(formatted).toContain('WARN_2');
    });
  });

  describe('formatWarningsAsJson', () => {
    it('should return empty array for no warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const result = system.formatWarningsAsJson([]);

      expect(result).toEqual([]);
    });

    it('should include tip when showTips is true', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_TEST',
          severity: 'warning',
          message: 'Test message',
          tip: 'Test tip',
          field: 'test',
        },
      ];

      const result = system.formatWarningsAsJson(warnings);

      expect(result).toHaveLength(1);
      expect(result[0].tip).toBe('Test tip');
    });

    it('should exclude tip when showTips is false', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: false,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_TEST',
          severity: 'warning',
          message: 'Test message',
          tip: 'Hidden tip',
          field: 'test',
        },
      ];

      const result = system.formatWarningsAsJson(warnings);

      expect(result).toHaveLength(1);
      expect(result[0].tip).toBeUndefined();
    });

    it('should preserve all warning fields', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const warnings: ContextWarning[] = [
        {
          code: 'WARN_CODE',
          severity: 'info',
          message: 'Message text',
          tip: 'Tip text',
          field: 'fieldName',
        },
      ];

      const result = system.formatWarningsAsJson(warnings);

      expect(result[0]).toEqual({
        code: 'WARN_CODE',
        severity: 'info',
        message: 'Message text',
        tip: 'Tip text',
        field: 'fieldName',
      });
    });
  });

  describe('suppress and unsuppress', () => {
    it('should dynamically suppress warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      // Initially should warn
      let warnings = system.checkContext({});
      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeDefined();

      // Suppress
      system.suppress('MISSING_SCOPE');

      // Now should not warn
      warnings = system.checkContext({});
      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeUndefined();
    });

    it('should dynamically unsuppress warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: ['MISSING_SCOPE'],
      });

      // Initially suppressed
      let warnings = system.checkContext({});
      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeUndefined();

      // Unsuppress
      system.unsuppress('MISSING_SCOPE');

      // Now should warn
      warnings = system.checkContext({});
      expect(warnings.find(w => w.code === 'WARN_MISSING_SCOPE')).toBeDefined();
    });

    it('should suppress by warning code', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      system.suppress('WARN_MISSING_THREAT_MODEL');

      const warnings = system.checkContext({});
      expect(warnings.find(w => w.code === 'WARN_MISSING_THREAT_MODEL')).toBeUndefined();
    });
  });

  describe('isEnabled and setEnabled', () => {
    it('should return enabled state', () => {
      const enabledSystem = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      const disabledSystem = new WarningSystem({
        enabled: false,
        showTips: true,
        suppressions: [],
      });

      expect(enabledSystem.isEnabled()).toBe(true);
      expect(disabledSystem.isEnabled()).toBe(false);
    });

    it('should dynamically enable warnings', () => {
      const system = new WarningSystem({
        enabled: false,
        showTips: true,
        suppressions: [],
      });

      expect(system.isEnabled()).toBe(false);
      expect(system.checkContext({})).toEqual([]);

      system.setEnabled(true);

      expect(system.isEnabled()).toBe(true);
      expect(system.checkContext({}).length).toBeGreaterThan(0);
    });

    it('should dynamically disable warnings', () => {
      const system = new WarningSystem({
        enabled: true,
        showTips: true,
        suppressions: [],
      });

      expect(system.checkContext({}).length).toBeGreaterThan(0);

      system.setEnabled(false);

      expect(system.isEnabled()).toBe(false);
      expect(system.checkContext({})).toEqual([]);
    });
  });
});

describe('createWarningSystem', () => {
  it('should create WarningSystem from config', () => {
    const config: WarningConfig = {
      enabled: true,
      showTips: false,
      suppressions: ['MISSING_SCOPE'],
    };

    const system = createWarningSystem(config);

    expect(system).toBeInstanceOf(WarningSystem);
    expect(system.isEnabled()).toBe(true);
  });
});

describe('DEFAULT_WARNING_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_WARNING_CONFIG.enabled).toBe(true);
    expect(DEFAULT_WARNING_CONFIG.showTips).toBe(true);
    expect(DEFAULT_WARNING_CONFIG.suppressions).toEqual([]);
  });

  it('should work with createWarningSystem', () => {
    const system = createWarningSystem(DEFAULT_WARNING_CONFIG);

    expect(system).toBeInstanceOf(WarningSystem);
    expect(system.isEnabled()).toBe(true);
  });
});
