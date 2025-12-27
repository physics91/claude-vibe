/**
 * Combined Analysis Orchestrator
 * Handles combined Codex + Gemini analysis with aggregation
 * SOLID: Single Responsibility - only handles combined analysis orchestration
 */

import type PQueue from 'p-queue';

import { ErrorHandler } from '../../core/error-handler.js';
import type { Logger } from '../../core/logger.js';
import { ValidationUtils } from '../../core/validation.js';
import type { ServerConfig } from '../../schemas/config.js';
import { createCombinedAnalysisInputSchema } from '../../schemas/tools.js';
import type { AnalysisAggregator } from '../../services/aggregator/merger.js';
import { AnalysisStatusStore } from '../../services/analysis-status/store.js';
import type { CacheService } from '../../services/cache/cache.service.js';
import { generateShortCacheKey, type CacheKeyParams } from '../../services/cache/cache-key.js';
import type { CodexAnalysisService } from '../../services/codex/client.js';
import type { GeminiAnalysisService } from '../../services/gemini/client.js';
import type { SecretScanner } from '../../services/scanner/secrets.js';
import { ResultFormatter } from '../formatters/index.js';

export interface CombinedHandlerDependencies {
  config: ServerConfig;
  logger: Logger;
  codexService: CodexAnalysisService;
  geminiService: GeminiAnalysisService;
  aggregator: AnalysisAggregator;
  cacheService: CacheService | null;
  secretScanner: SecretScanner;
  analysisStatusStore: AnalysisStatusStore;
  codexQueue: PQueue;
  geminiQueue: PQueue;
}

/**
 * Combined Analysis Orchestrator
 * Executes parallel/sequential analysis with both services and aggregates results
 */
export class CombinedAnalysisOrchestrator {
  constructor(private readonly deps: CombinedHandlerDependencies) {}

  /**
   * Build cache key parameters for combined analysis
   */
  private buildCacheKeyParams(
    params: { prompt: string; context?: Record<string, unknown>; options?: Record<string, unknown> }
  ): CacheKeyParams {
    const { config } = this.deps;

    const prompts = config.prompts ?? {};
    const serviceTemplates = prompts.serviceTemplates ?? {};

    const options = params.options ?? {};
    const templateOverride = typeof options.template === 'string' ? options.template : undefined;

    const resolvedTemplate =
      templateOverride ?? prompts.defaultTemplate ?? 'default';

    return {
      prompt: params.prompt,
      source: 'combined',
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
      service: {
        model: `${config.codex.model ?? ''}|${config.gemini.model ?? ''}`,
        reasoningEffort: config.codex.reasoningEffort,
        search: config.codex.search,
        args: [...(config.codex.args ?? []), '|', ...(config.gemini.args ?? [])],
        template: resolvedTemplate,
        version: config.server.version,
      },
    };
  }

  /**
   * Execute combined analysis
   */
  async execute(
    args: unknown
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const {
      config,
      logger,
      codexService,
      geminiService,
      aggregator,
      cacheService,
      secretScanner,
      analysisStatusStore,
      codexQueue,
      geminiQueue,
    } = this.deps;

    // Validate input with detailed error messages
    const maxCodeLength = config.analysis.maxCodeLength;
    const combinedSchema = createCombinedAnalysisInputSchema(maxCodeLength);
    const params = ValidationUtils.validateOrThrow(
      combinedSchema,
      args,
      'analyze_code_combined'
    );

    // Sanitize and warn about modifications
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: 'pre-validation' }, 'Input sanitization performed');
    }

    // Use sanitized params
    const finalParams = sanitized;

    const parallelExecution = finalParams.options?.parallelExecution ?? true;
    const includeIndividualAnalyses = finalParams.options?.includeIndividualAnalyses ?? false;

    // Create combined analysis status entry
    const analysisId = `combined-${Date.now()}`;
    analysisStatusStore.create(analysisId, 'combined');
    analysisStatusStore.updateStatus(analysisId, 'in_progress');

    logger.info(
      { parallelExecution, includeIndividualAnalyses, analysisId },
      'Starting combined analysis'
    );

    try {
      const cacheKeyParams = this.buildCacheKeyParams(finalParams);
      const cacheKeyShort = cacheService ? generateShortCacheKey(cacheKeyParams) : null;

      const executeCombined = async () => {
        // Extract params compatible with individual analysis services
        const serviceParams = {
          prompt: finalParams.prompt,
          context: finalParams.context,
          options: finalParams.options
            ? {
                timeout: finalParams.options.timeout,
                severity: finalParams.options.severity,
                template: finalParams.options.template,
                preset: finalParams.options.preset,
                autoDetect: finalParams.options.autoDetect,
                warnOnMissingContext: finalParams.options.warnOnMissingContext,
              }
            : undefined,
        };

        // Execute analyses (parallel or sequential based on option)
        const analyses = parallelExecution
          ? await Promise.all([
              codexQueue.add(() => codexService.analyzeCode(serviceParams)),
              geminiQueue.add(() => geminiService.analyzeCode(serviceParams)),
            ])
          : [
              await codexQueue.add(() => codexService.analyzeCode(serviceParams)),
              await geminiQueue.add(() => geminiService.analyzeCode(serviceParams)),
            ];

        // Filter out undefined results (shouldn't happen, but for type safety)
        const validAnalyses = analyses.filter((r): r is Exclude<typeof r, void> => r !== undefined);

        if (validAnalyses.length === 0) {
          throw new Error('No analyses completed successfully');
        }

        // Aggregate results
        const aggregated = aggregator.mergeAnalyses(validAnalyses, { includeIndividualAnalyses });

        // Integrate secret scanning results once for combined output
        if (config.secretScanning?.enabled) {
          const secretFindings = secretScanner.scan(finalParams.prompt);
          const secretAnalysisFindings = secretScanner.toAnalysisFindings(secretFindings);

          if (secretAnalysisFindings.length > 0) {
            const secretAggregated = secretAnalysisFindings.map(finding => ({
              ...finding,
              sources: ['codex', 'gemini'] as Array<'codex' | 'gemini'>,
              confidence: 'high' as const,
            }));

            aggregated.findings = [...secretAggregated, ...aggregated.findings];

            for (const finding of secretAggregated) {
              aggregated.summary.totalFindings++;
              if (finding.severity === 'critical') aggregated.summary.critical++;
              else if (finding.severity === 'high') aggregated.summary.high++;
              else if (finding.severity === 'medium') aggregated.summary.medium++;
              else if (finding.severity === 'low') aggregated.summary.low++;
            }

            const highConfidence = aggregated.findings.filter(f => f.confidence === 'high').length;
            aggregated.summary.consensus =
              aggregated.findings.length > 0
                ? Math.round((highConfidence / aggregated.findings.length) * 100)
                : 100;
          }
        }

        return aggregated;
      };

      const { result: aggregated, fromCache } =
        cacheService && cacheService.isEnabled()
          ? await cacheService.getOrSet(cacheKeyParams, executeCombined)
          : { result: await executeCombined(), fromCache: false };

      // Override analysis ID with combined ID
      aggregated.analysisId = analysisId;
      aggregated.timestamp = new Date().toISOString();
      aggregated.metadata.fromCache = fromCache;
      if (cacheKeyShort) {
        aggregated.metadata.cacheKey = cacheKeyShort;
      }

      if (fromCache) {
        logger.info({ analysisId, cacheKey: cacheKeyShort }, 'Combined analysis served from cache');
      }

      // Store aggregated result
      analysisStatusStore.setResult(analysisId, aggregated);

      logger.info({ analysisId }, 'Combined analysis completed successfully');

      return {
        content: [
          {
            type: 'text' as const,
            text: ResultFormatter.formatAnalysis(aggregated, {
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
  }
}
