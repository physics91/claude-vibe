/**
 * Cache Key Generator
 * Generates SHA-256 based cache keys from analysis parameters
 */

import { createHash } from 'crypto';

export interface CacheKeyParams {
  prompt: string;
  source: 'codex' | 'gemini' | 'combined';
  context?: {
    language?: string;
    framework?: string;
    platform?: string;
    projectType?: string;
    threatModel?: string;
    focus?: string[];
    scope?: string;
  };
  options?: {
    severity?: string;
    preset?: string;
    template?: string;
    autoDetect?: boolean;
    warnOnMissingContext?: boolean;
  };
  service?: {
    model?: string | null;
    reasoningEffort?: string;
    search?: boolean;
    args?: string[];
    template?: string;
    version?: string;
  };
}

/**
 * Generate a cache key from analysis parameters
 * Uses SHA-256 hash for consistent, collision-resistant keys
 */
export function generateCacheKey(params: CacheKeyParams): string {
  // Normalize and sort object keys for consistent hashing
  const normalized = {
    prompt: params.prompt,
    source: params.source,
    context: normalizeContext(params.context),
    options: normalizeOptions(params.options),
    service: normalizeService(params.service),
  };

  const json = JSON.stringify(normalized);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Generate a short cache key (first 16 chars of hash)
 * Useful for display and logging
 */
export function generateShortCacheKey(params: CacheKeyParams): string {
  return generateCacheKey(params).substring(0, 16);
}

/**
 * Normalize context for consistent hashing
 */
function normalizeContext(
  context?: CacheKeyParams['context']
): Record<string, unknown> | null {
  if (!context) return null;

  return {
    language: context.language?.toLowerCase() ?? null,
    framework: context.framework?.toLowerCase() ?? null,
    platform: context.platform?.toLowerCase() ?? null,
    projectType: context.projectType?.toLowerCase() ?? null,
    threatModel: context.threatModel?.toLowerCase() ?? null,
    focus: context.focus?.slice().sort() ?? null,
    scope: context.scope?.toLowerCase() ?? null,
  };
}

/**
 * Normalize options for consistent hashing
 */
function normalizeOptions(
  options?: CacheKeyParams['options']
): Record<string, unknown> | null {
  if (!options) return null;

  return {
    severity: options.severity?.toLowerCase() ?? null,
    preset: options.preset?.toLowerCase() ?? null,
    template: options.template?.toLowerCase() ?? null,
    autoDetect: options.autoDetect ?? null,
    warnOnMissingContext: options.warnOnMissingContext ?? null,
  };
}

/**
 * Normalize service config for consistent hashing
 */
function normalizeService(
  service?: CacheKeyParams['service']
): Record<string, unknown> | null {
  if (!service) return null;

  return {
    model: service.model ?? null,
    reasoningEffort: service.reasoningEffort?.toLowerCase() ?? null,
    search: service.search ?? null,
    args: service.args ?? null,
    template: service.template?.toLowerCase() ?? null,
    version: service.version ?? null,
  };
}

/**
 * Generate a prompt hash (for analysis tracking without full cache key)
 */
export function generatePromptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').substring(0, 32);
}
