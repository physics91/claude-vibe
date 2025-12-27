/**
 * Tool Registry
 * Manages MCP tool registration and routing
 *
 * CRITICAL FIX #3: Wire review status store operations throughout all handlers
 * CRITICAL FIX #4: Read maxCodeLength from config, allow per-request override
 * MAJOR FIX #6: Honor all per-request options (timeout, severity, cliPath)
 * MAJOR FIX #7: Implement concurrency control using p-queue
 * MAJOR FIX #12: Use AbortController for timeout cancellation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import PQueue from 'p-queue';
import { z } from 'zod';

import { ErrorHandler } from '../core/error-handler.js';
import type { Logger } from '../core/logger.js';
import { ValidationUtils, getNumberProperty } from '../core/validation.js';
import type { ServerConfig } from '../schemas/config.js';
import {
  createCombinedAnalysisInputSchema,
  createCodeAnalysisParamsSchema,
} from '../schemas/tools.js';
import type { AnalysisAggregator } from '../services/aggregator/merger.js';
import { AnalysisStatusStore } from '../services/analysis-status/store.js';
import type { CacheService } from '../services/cache/cache.service.js';
import { generateShortCacheKey, type CacheKeyParams } from '../services/cache/cache-key.js';
import type { CodexAnalysisService } from '../services/codex/client.js';
import type { GeminiAnalysisService } from '../services/gemini/client.js';
import { SecretScanner } from '../services/scanner/secrets.js';
import { ResultFormatter } from './formatters/index.js';

// Schema for scan_secrets input
const ScanSecretsInputSchema = z.object({
  code: z
    .string({
      required_error: 'Code is required',
      invalid_type_error: 'Code must be a string',
    })
    .min(1, { message: 'Code cannot be empty' })
    .max(100000, { message: 'Code exceeds maximum length of 100,000 characters' })
    .describe('Code to scan for secrets'),
  fileName: z.string().optional().describe('Optional file name for context and exclusion matching'),
});

// Schema for get_analysis_status input - Enhanced with detailed error messages
const AnalysisStatusInputSchema = z.object({
  analysisId: z
    .string({
      required_error: 'Analysis ID is required',
      invalid_type_error: 'Analysis ID must be a string',
    })
    .min(1, {
      message:
        'Analysis ID cannot be empty. Expected format: codex-<timestamp>-<hash> or gemini-<timestamp>-<hash>',
    })
    .describe('Analysis ID to check status for'),
});

export interface ToolDependencies {
  codexService: CodexAnalysisService | null;
  geminiService: GeminiAnalysisService | null;
  aggregator: AnalysisAggregator;
  logger: Logger;
  config: ServerConfig;
  secretScanner?: SecretScanner;
  cacheService?: CacheService;
}

/**
 * Tool Registry
 * MAJOR FIX #7: Add concurrency control
 */
export class ToolRegistry {
  private analysisStatusStore: AnalysisStatusStore;
  private codexQueue: PQueue;
  private geminiQueue: PQueue;
  private secretScanner: SecretScanner;
  private cacheService: CacheService | null;

  constructor(
    private server: McpServer,
    private dependencies: ToolDependencies
  ) {
    this.analysisStatusStore = AnalysisStatusStore.getInstance();
    this.cacheService = dependencies.cacheService ?? null;

    const buildQueueOptions = (
      queueConfig: { interval?: number; intervalCap?: number } | undefined,
      maxConcurrent: number
    ) => {
      const options: { concurrency: number; interval?: number; intervalCap?: number } = {
        concurrency: maxConcurrent,
      };

      if (queueConfig?.interval !== undefined && queueConfig.interval > 0) {
        options.interval = queueConfig.interval;
        options.intervalCap = queueConfig.intervalCap ?? maxConcurrent;
      }

      return options;
    };

    // MAJOR FIX #7: Initialize queues for concurrency control
    this.codexQueue = new PQueue(
      buildQueueOptions(dependencies.config.codex.queue, dependencies.config.codex.maxConcurrent)
    );

    this.geminiQueue = new PQueue(
      buildQueueOptions(dependencies.config.gemini.queue, dependencies.config.gemini.maxConcurrent)
    );

    // Initialize secret scanner
    this.secretScanner =
      dependencies.secretScanner ??
      new SecretScanner(
        {
          enabled: dependencies.config.secretScanning.enabled,
          maxScanLength: dependencies.config.secretScanning.maxScanLength,
          maxLineLength: dependencies.config.secretScanning.maxLineLength,
          patterns: dependencies.config.secretScanning.patterns,
          excludePatterns: dependencies.config.secretScanning.excludePatterns,
        },
        dependencies.logger
      );
  }

  private getMaxCodeLengthOverride(args: unknown, fallback: number): number {
    // Use type guard instead of unsafe cast
    const value = getNumberProperty(args, 'maxCodeLength');
    if (value === undefined) {
      return fallback;
    }

    // Mirror config schema bounds: 100..1,000,000
    if (value < 100 || value > 1_000_000) {
      return fallback;
    }

    return value;
  }

  /**
   * Generic analysis execution
   * DRY: Extracts common logic from handleCodexAnalysis and handleGeminiAnalysis
   */
  private async executeAnalysis(
    args: unknown,
    options: {
      service: CodexAnalysisService | GeminiAnalysisService;
      queue: PQueue;
      source: 'codex' | 'gemini';
      toolName: string;
    }
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const { config, logger } = this.dependencies;
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
      this.analysisStatusStore.create(analysisId, source);
      this.analysisStatusStore.updateStatus(analysisId, 'in_progress');

      try {
        const cacheKeyParams = this.buildCacheKeyParams(source, finalParams);
        const cacheKeyShort = this.cacheService ? generateShortCacheKey(cacheKeyParams) : null;

        const executeServiceAnalysis = async () => {
          const result = await service.analyzeCode(finalParams);

          // Integrate secret scanning results
          if (config.secretScanning?.enabled) {
            const secretFindings = this.secretScanner.scan(finalParams.prompt);
            const secretAnalysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);

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
          this.cacheService && this.cacheService.isEnabled()
            ? await this.cacheService.getOrSet(cacheKeyParams, executeServiceAnalysis)
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
        this.analysisStatusStore.setResult(analysisId, result);

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
        this.analysisStatusStore.setError(analysisId, {
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

  private buildCacheKeyParams(
    source: 'codex' | 'gemini' | 'combined',
    params: { prompt: string; context?: Record<string, unknown>; options?: Record<string, unknown> }
  ): CacheKeyParams {
    const { config } = this.dependencies;

    const prompts = config.prompts ?? {};
    const serviceTemplates = prompts.serviceTemplates ?? {};

    const options = params.options ?? {};
    const templateOverride = typeof options.template === 'string' ? options.template : undefined;

    const defaultTemplate =
      source === 'codex'
        ? serviceTemplates.codex
        : source === 'gemini'
        ? serviceTemplates.gemini
        : undefined;

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
        : source === 'gemini'
        ? {
            model: config.gemini.model ?? null,
            args: config.gemini.args,
            template: resolvedTemplate,
            version: config.server.version,
          }
        : {
            model: `${config.codex.model ?? ''}|${config.gemini.model ?? ''}`,
            reasoningEffort: config.codex.reasoningEffort,
            search: config.codex.search,
            args: [...(config.codex.args ?? []), '|', ...(config.gemini.args ?? [])],
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
   * Register all tools with MCP server using high-level API
   */
  registerTools(): void {
    const { logger, codexService, geminiService } = this.dependencies;
    const maxCodeLength = this.dependencies.config.analysis.maxCodeLength;

    // Register Codex analysis tool if enabled
    if (codexService) {
      const analysisParamsSchema = createCodeAnalysisParamsSchema(maxCodeLength);
      this.server.registerTool(
        'analyze_code_with_codex',
        {
          title: 'Analyze Code with Codex',
          description: 'Perform comprehensive code analysis using Codex AI',
          inputSchema: analysisParamsSchema.shape,
        },
        async args => {
          logger.info({ tool: 'analyze_code_with_codex' }, 'Tool called');
          return await this.handleCodexAnalysis(args);
        }
      );
    }

    // Register Gemini analysis tool if enabled
    if (geminiService) {
      const analysisParamsSchema = createCodeAnalysisParamsSchema(maxCodeLength);
      this.server.registerTool(
        'analyze_code_with_gemini',
        {
          title: 'Analyze Code with Gemini',
          description: 'Perform comprehensive code analysis using Gemini CLI',
          inputSchema: analysisParamsSchema.shape,
        },
        async args => {
          logger.info({ tool: 'analyze_code_with_gemini' }, 'Tool called');
          return await this.handleGeminiAnalysis(args);
        }
      );
    }

    // Register combined analysis tool if both services are enabled
    if (codexService && geminiService) {
      const combinedSchema = createCombinedAnalysisInputSchema(maxCodeLength);
      this.server.registerTool(
        'analyze_code_combined',
        {
          title: 'Analyze Code Combined',
          description: 'Perform code analysis using both Codex and Gemini, then aggregate results',
          inputSchema: combinedSchema.shape,
        },
        async args => {
          logger.info({ tool: 'analyze_code_combined' }, 'Tool called');
          return await this.handleCombinedAnalysis(args);
        }
      );
    }

    // Register analysis status tool (always available)
    this.server.registerTool(
      'get_analysis_status',
      {
        title: 'Get Analysis Status',
        description: 'Get the status of an async code analysis by analysis ID',
        inputSchema: AnalysisStatusInputSchema.shape,
      },
      args => {
        logger.info({ tool: 'get_analysis_status' }, 'Tool called');
        return this.handleGetAnalysisStatus(args);
      }
    );

    // Register secret scanning tool (always available)
    this.server.registerTool(
      'scan_secrets',
      {
        title: 'Scan for Secrets',
        description: 'Scan code for hardcoded secrets, API keys, passwords, and sensitive data',
        inputSchema: ScanSecretsInputSchema.shape,
      },
      args => {
        logger.info({ tool: 'scan_secrets' }, 'Tool called');
        return this.handleScanSecrets(args);
      }
    );

    logger.info('All tools registered successfully');
  }

  /**
   * Handle Codex analysis tool
   * DRY: Uses generic executeAnalysis method
   */
  private async handleCodexAnalysis(
    args: unknown
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const { codexService } = this.dependencies;

    if (!codexService) {
      throw new Error('Codex service is not enabled');
    }

    return this.executeAnalysis(args, {
      service: codexService,
      queue: this.codexQueue,
      source: 'codex',
      toolName: 'analyze_code_with_codex',
    });
  }

  /**
   * Handle Gemini analysis tool
   * DRY: Uses generic executeAnalysis method
   */
  private async handleGeminiAnalysis(
    args: unknown
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const { geminiService } = this.dependencies;

    if (!geminiService) {
      throw new Error('Gemini service is not enabled');
    }

    return this.executeAnalysis(args, {
      service: geminiService,
      queue: this.geminiQueue,
      source: 'gemini',
      toolName: 'analyze_code_with_gemini',
    });
  }

  /**
   * Handle combined analysis tool
   * CRITICAL FIX #3: Wire analysis status store operations
   * MAJOR FIX #6: Honor all per-request options
   * MAJOR FIX #7: Respect parallelExecution flag for concurrency
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  private async handleCombinedAnalysis(
    args: unknown
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const { codexService, geminiService, aggregator, logger, config } = this.dependencies;

    if (!codexService || !geminiService) {
      throw new Error('Both Codex and Gemini services must be enabled for combined analysis');
    }

    // ENHANCEMENT: Validate input with detailed error messages
    const maxCodeLength = config.analysis.maxCodeLength;
    const combinedSchema = createCombinedAnalysisInputSchema(maxCodeLength);
    const params = ValidationUtils.validateOrThrow(
      combinedSchema,
      args,
      'analyze_code_combined'
    );

    // ENHANCEMENT: Sanitize and warn about modifications
    const { sanitized, warnings } = ValidationUtils.sanitizeParams(params);
    if (warnings.length > 0) {
      logger.warn({ warnings, analysisId: 'pre-validation' }, 'Input sanitization performed');
    }

    // Use sanitized params
    const finalParams = sanitized;

    const parallelExecution = finalParams.options?.parallelExecution ?? true;
    const includeIndividualAnalyses = finalParams.options?.includeIndividualAnalyses ?? false;

    // CRITICAL FIX #3: Create combined analysis status entry
    const analysisId = `combined-${Date.now()}`;
    this.analysisStatusStore.create(analysisId, 'combined');
    this.analysisStatusStore.updateStatus(analysisId, 'in_progress');

    logger.info(
      { parallelExecution, includeIndividualAnalyses, analysisId },
      'Starting combined analysis'
    );

    try {
      const cacheKeyParams = this.buildCacheKeyParams('combined', finalParams);
      const cacheKeyShort = this.cacheService ? generateShortCacheKey(cacheKeyParams) : null;

      const executeCombined = async () => {
        // Extract params compatible with individual analysis services
        // (excludes combined-specific options like parallelExecution, includeIndividualAnalyses)
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
              this.codexQueue.add(() => codexService.analyzeCode(serviceParams)),
              this.geminiQueue.add(() => geminiService.analyzeCode(serviceParams)),
            ])
          : [
              await this.codexQueue.add(() => codexService.analyzeCode(serviceParams)),
              await this.geminiQueue.add(() => geminiService.analyzeCode(serviceParams)),
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
          const secretFindings = this.secretScanner.scan(finalParams.prompt);
          const secretAnalysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);

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
        this.cacheService && this.cacheService.isEnabled()
          ? await this.cacheService.getOrSet(cacheKeyParams, executeCombined)
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

      // CRITICAL FIX #3: Store aggregated result
      this.analysisStatusStore.setResult(analysisId, aggregated);

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
      // CRITICAL FIX #3: Store error on failure
      const errorInfo = ErrorHandler.classifyError(error);
      this.analysisStatusStore.setError(analysisId, {
        code: errorInfo.code,
        message: errorInfo.message,
      });

      throw error;
    }
  }

  /**
   * Handle get analysis status tool
   * CRITICAL FIX #3: Properly retrieve and return status
   * ENHANCEMENT: Use enhanced validation with detailed error messages
   */
  private handleGetAnalysisStatus(args: unknown): {
    content: Array<{ type: 'text'; text: string }>;
  } {
    // ENHANCEMENT: Validate input with detailed error messages
    const params = ValidationUtils.validateOrThrow(
      AnalysisStatusInputSchema,
      args,
      'get_analysis_status'
    );

    // Get status from store
    const status = this.analysisStatusStore.get(params.analysisId);

    if (!status) {
      throw new Error(`Analysis not found: ${params.analysisId}`);
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  /**
   * Handle secret scanning tool
   */
  private handleScanSecrets(args: unknown): { content: Array<{ type: 'text'; text: string }> } {
    const { logger } = this.dependencies;

    // Validate input
    const params = ValidationUtils.validateOrThrow(ScanSecretsInputSchema, args, 'scan_secrets');

    const startTime = Date.now();

    // Perform secret scanning
    const secretFindings = this.secretScanner.scan(params.code, params.fileName);
    const analysisFindings = this.secretScanner.toAnalysisFindings(secretFindings);

    const duration = Date.now() - startTime;

    // Build result
    const result = {
      success: true,
      scanId: `secrets-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      summary: {
        totalFindings: secretFindings.length,
        critical: secretFindings.filter(f => f.severity === 'critical').length,
        high: secretFindings.filter(f => f.severity === 'high').length,
        medium: secretFindings.filter(f => f.severity === 'medium').length,
        low: secretFindings.filter(f => f.severity === 'low').length,
        byCategory: ResultFormatter.groupByCategory(secretFindings),
      },
      findings: analysisFindings,
      metadata: {
        duration,
        patternsUsed: this.secretScanner.getStats().patternCount,
        fileName: params.fileName,
      },
    };

    logger.info(
      { scanId: result.scanId, findingCount: result.summary.totalFindings, duration },
      'Secret scanning completed'
    );

    // Format as markdown using ResultFormatter
    const markdown = ResultFormatter.formatSecretScan(result);

    return {
      content: [
        {
          type: 'text' as const,
          text: markdown,
        },
      ],
    };
  }
}
