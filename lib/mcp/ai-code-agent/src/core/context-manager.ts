/**
 * Context Manager
 * Handles context resolution and merging with preset support
 *
 * Priority order: defaults -> activePreset -> detectedContext -> requestContext
 */

import type { ServerConfig } from '../schemas/config.js';
import type { AnalysisContext } from '../schemas/context.js';

export interface ContextConfig {
  defaults?: AnalysisContext;
  presets?: Record<string, AnalysisContext>;
  activePreset?: string | null;
  allowEnvOverride?: boolean;
  autoDetect?: boolean;
}

/**
 * Context Manager class
 * Resolves and merges context from multiple sources
 */
export class ContextManager {
  private defaults: AnalysisContext;
  private presets: Map<string, AnalysisContext>;
  private activePreset: string | null;

  constructor(config: ContextConfig) {
    this.defaults = config.defaults ?? {};
    this.presets = new Map(Object.entries(config.presets ?? {}));
    this.activePreset = config.activePreset ?? null;
  }

  /**
   * Resolve final context by merging all sources
   * Priority: defaults -> activePreset -> detectedContext -> requestContext
   */
  resolve(
    requestContext?: AnalysisContext,
    detectedContext?: Partial<AnalysisContext>
  ): AnalysisContext {
    // Start with defaults
    let result: AnalysisContext = { ...this.defaults };

    // Apply active preset if set
    if (this.activePreset && this.presets.has(this.activePreset)) {
      result = this.merge(result, this.presets.get(this.activePreset)!);
    }

    // Apply auto-detected context
    if (detectedContext) {
      result = this.merge(result, detectedContext);
    }

    // Apply request context (highest priority)
    if (requestContext) {
      // Handle preset reference in request
      if (requestContext.preset && this.presets.has(requestContext.preset)) {
        result = this.merge(result, this.presets.get(requestContext.preset)!);
      }
      result = this.merge(result, requestContext);
    }

    return result;
  }

  /**
   * Merge two contexts (shallow merge, undefined values ignored)
   */
  private merge(base: AnalysisContext, override: Partial<AnalysisContext>): AnalysisContext {
    const result: AnalysisContext = { ...base };

    for (const [key, value] of Object.entries(override)) {
      // Skip undefined/null values and preset references
      if (value !== undefined && value !== null && key !== 'preset') {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    // Deep merge custom fields
    if (base.custom ?? override.custom) {
      result.custom = {
        ...base.custom,
        ...override.custom,
      };
    }

    return result;
  }

  /**
   * Get list of available preset names
   */
  listPresets(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * Get a specific preset by name
   */
  getPreset(name: string): AnalysisContext | undefined {
    return this.presets.get(name);
  }

  /**
   * Add or update a preset at runtime
   */
  addPreset(name: string, context: AnalysisContext): void {
    this.presets.set(name, context);
  }

  /**
   * Set the active preset
   */
  setActivePreset(name: string | null): void {
    if (name && !this.presets.has(name)) {
      throw new Error(`Preset not found: ${name}`);
    }
    this.activePreset = name;
  }

  /**
   * Get current defaults
   */
  getDefaults(): AnalysisContext {
    return { ...this.defaults };
  }

  /**
   * Update defaults at runtime
   */
  updateDefaults(context: Partial<AnalysisContext>): void {
    this.defaults = this.merge(this.defaults, context);
  }
}

/**
 * Create a ContextManager from server config
 */
export function createContextManager(config: ServerConfig['context']): ContextManager {
  return new ContextManager({
    defaults: config.defaults,
    presets: config.presets,
    activePreset: config.activePreset,
    allowEnvOverride: config.allowEnvOverride,
    autoDetect: config.autoDetect,
  });
}
