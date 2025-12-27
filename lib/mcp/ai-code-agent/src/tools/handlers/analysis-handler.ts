/**
 * Analysis Request Handler
 * Handles individual Codex and Gemini analysis requests
 * SOLID: Single Responsibility - only handles analysis request execution
 */

import type PQueue from 'p-queue';

import { ErrorHandler } from '../../core/error-handler.js';
import type { Logger } from '../../core/logger.js';
import { ValidationUtils } from '../../core/validation.js';
import type { ServerConfig } from '../../schemas/config.js';
import { createCodeAnalysisParamsSchema } from '../../schemas/tools.js';
import { AnalysisStatusStore } from '../../services/analysis-status/store.js';
import type { CacheService } from '../../services/cache/cache.service.js';
import { generateShortCacheKey, type CacheKeyParams } from '../../services/cache/cache-key.js';
import type { CodexAnalysisService } from '../../services/codex/client.js';
import type { GeminiAnalysisService } from '../../services/gemini/client.js';
import type { SecretScanner } from '../../services/scanner/secrets.js';
import { ResultFormatter } from '../formatters/index.js';

export interface AnalysisHandlerDependencies {
  config: ServerConfig;
  logger: Logger;
  cacheService: CacheService | null;
  secretScanner: SecretScanner;
  analysisStatusStore: AnalysisStatusStore;
}

export interface AnalysisExecutionOptions {
  service: CodexAnalysisService | GeminiAnalysisService;
  queue: PQueue;
  source: 'codex' | 'gemini';
  toolName: string;
}

/**
 * Analysis Request Handler
 * Executes individual code analysis requests
 */
export class AnalysisRequestHandler {
  constructor(private readonly deps: AnalysisHandlerDependencies) {}

  /**
   * Get max code length override from args
   */
  private getMaxCodeLengthOverride(args: unknown, fallback: number): number {
    if (typeof args !== 'object' || args === null) {
      return fallback;
    }

    const value = (args as Record<string, unknown>).maxCodeLength;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    // Mirror config schema bounds: 100..1,000,000
    if (value < 100 || value > 1_000_000) {
      return fallback;
    }

    return value;
  }

  /**
   * Build cache key parameters
   */
  private buildCacheKeyParams(
    source: 'codex' | 'gemini',
    params: { prompt: string; context?: Record<string, unknown>; options?: Record<string, unknown> }
  ): CacheKeyParams {
    const { config } = this.deps;

    const prompts = config.prompts ?? {};
    const serviceTemplates = prompts.serviceTemplates ?? {};

    const options = params.options ?? {};
    const templateOverride = typeof options.template === 'string' ? options.template : undefined;

    const defaultTemplate =
      source === 'codex' ? serviceTemplates.codex : serviceTemplates.gemini;

    const resolvedTemplate =
      templateOverride ?? defaultTemplate ?? prompts.defaultTemplate ?? 'default';

    const service =
      source === 'codex'
        ? {
            model: config.codex.model ?? null,
            reasoningEffort: config.codex.reasoningEffort,
            search: config.codex.search,
            args: config.codex.args,
            template: resolvedTemplate,
            version: config.server.version,
          }
        : {
            model: config.gemini.model ?? null,
            args: config.gemini.args,
            template: resolvedTemplate,
            version: config.server.version,
          };

    return {
      prompt: params.prompt,
      source,
      context: params.context as CacheKeyParams['context'] | undefined,
      options: {
        severity: typeof options.severity === 'string' ? options.severity : undefined,
        preset: typeof options.preset === 'string' ? options.preset : undefined,
        template: typeof options.template === 'string' ? options.template : undefined,
        autoDetect: typeof options.autoDetect === 'boolean' ? options.autoDetect : undefined,
        warnOnMissingContext:
          typeof options.warnOnMissingContext === 'boolean'
            ? options.warnOnMissingContext
            : undefined,
      },
      service,
    };
  }

  /**
   * Execute analysis with validation, caching, and status tracking
   */
  async execute(
    args: unknown,
    options: AnalysisExecutionOptions
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const { config, logger, cacheService, secretScanner, analysisStatusStore } = this.deps;
    const { service, queue, source, toolName } = options;

    // Allow per-request maxCodeLength override
    const maxCodeLength = this.getMaxCodeLengthOverride(args, config.analysis.maxCodeLength);
    const schema = createCodeAnalysisParamsSchema(maxCodeLength);

    // Validate with detailed error messages
    const params = ValidationUtils.validateOrThrow(schema, args, toolName);

    // Sanitize and warn about modifications
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: 'pre-validation' }, 'Input sanitization performed');
    }

    const finalParams = sanitized;

    // Queue the analysis to control concurrency
    const result = await queue.add(async () => {
      // Generate analysisId FIRST, create status entry BEFORE calling service
      const analysisId = `${source}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      analysisStatusStore.create(analysisId, source);
      analysisStatusStore.updateStatus(analysisId, 'in_progress');

      try {
        const cacheKeyParams = this.buildCacheKeyParams(source, finalParams);
        const cacheKeyShort = cacheService ? generateShortCacheKey(cacheKeyParams) : null;

        const executeServiceAnalysis = async () => {
          const result = await service.analyzeCode(finalParams);

          // Integrate secret scanning results
          if (config.secretScanning?.enabled) {
            const secretFindings = secretScanner.scan(finalParams.prompt);
            const secretAnalysisFindings = secretScanner.toAnalysisFindings(secretFindings);

            if (secretAnalysisFindings.length > 0) {
              result.findings = [...secretAnalysisFindings, ...result.findings];

              for (const finding of secretAnalysisFindings) {
                result.summary.totalFindings++;
                if (finding.severity === 'critical') result.summary.critical++;
                else if (finding.severity === 'high') result.summary.high++;
                else if (finding.severity === 'medium') result.summary.medium++;
                else if (finding.severity === 'low') result.summary.low++;
              }

              logger.debug(
                { secretCount: secretAnalysisFindings.length, analysisId },
                'Secret findings added to analysis'
              );
            }
          }

          return result;
        };

        const { result, fromCache } =
          cacheService && cacheService.isEnabled()
            ? await cacheService.getOrSet(cacheKeyParams, executeServiceAnalysis)
            : { result: await executeServiceAnalysis(), fromCache: false };

        // Override the generated analysisId with our tracked one
        result.analysisId = analysisId;
        result.timestamp = new Date().toISOString();
        result.metadata.fromCache = fromCache;
        if (cacheKeyShort) {
          result.metadata.cacheKey = cacheKeyShort;
        }

        if (fromCache) {
          logger.info({ analysisId, cacheKey: cacheKeyShort }, `${source} analysis served from cache`);
        }

        // Store result on success
        analysisStatusStore.setResult(analysisId, result);

        logger.info({ analysisId }, `${source} analysis completed successfully`);

        return {
          content: [
            {
              type: 'text' as const,
              text: ResultFormatter.formatAnalysis(result, {
                maxFindings: config.analysis.maxFindings,
                maxCodeSnippetLength: config.analysis.maxCodeSnippetLength,
                maxOutputChars: config.analysis.maxOutputChars,
              }),
            },
          ],
        };
      } catch (error) {
        // Store error on failure
        const errorInfo = ErrorHandler.classifyError(error);
        analysisStatusStore.setError(analysisId, {
          code: errorInfo.code,
          message: errorInfo.message,
        });

        throw error;
      }
    });

    if (!result) {
      throw new Error(`${source} analysis queue returned void`);
    }

    return result;
  }
}
