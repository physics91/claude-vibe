/**
 * Gemini Analysis Service
 * Handles code analysis using Gemini CLI
 * DRY: Extends BaseAnalysisService for shared functionality
 */

import { resolve } from 'path';

import { execa } from 'execa';
import { z } from 'zod';

import { detectGeminiCLIPath } from '../../core/cli-detector.js';
import type { ContextConfig } from '../../core/context-manager.js';
import {
  CLIExecutionError,
  TimeoutError,
  ParseError,
  SecurityError,
  GeminiAnalysisError,
  GeminiTimeoutError,
  GeminiParseError,
} from '../../core/error-handler.js';
import { type Logger } from '../../core/logger.js';
import type { TemplateEngineConfig } from '../../core/prompt-template.js';
import { generateUUID, sanitizeParams } from '../../core/utils.js';
import type { WarningConfig } from '../../core/warnings.js';
import { AnalysisResponseSchema, type AnalysisResponse } from '../../schemas/responses.js';
import {
  CodeAnalysisParamsSchema,
  AnalysisResultSchema,
  type CodeAnalysisParams,
  type AnalysisResult,
} from '../../schemas/tools.js';
import { BaseAnalysisService, type BaseServiceConfig } from '../base/analysis.service.js';

export interface GeminiServiceConfig extends BaseServiceConfig {}

/**
 * Gemini Analysis Service
 * DRY: Extends BaseAnalysisService for common functionality
 */
export class GeminiAnalysisService extends BaseAnalysisService {
  protected readonly serviceName = 'gemini' as const;
  protected readonly cliExecutableNames = ['gemini', 'gemini.cmd'];

  constructor(
    protected override config: GeminiServiceConfig,
    logger: Logger
  ) {
    super(config, logger);

    // Build security-hardened whitelist
    this.allowedCLIPaths = this.buildAllowedPaths();

    this.logger.debug({ allowedPaths: this.allowedCLIPaths }, 'Gemini CLI allowed paths');

    // Initialize CLI path detection if set to 'auto'
    if (config.cliPath === 'auto') {
      this.initializeCLIPath().catch((error: unknown) => {
        this.logger.warn({ error }, 'Failed to auto-detect Gemini CLI path, will use default');
      });
    }
  }

  /**
   * Build allowed CLI paths list
   */
  private buildAllowedPaths(): string[] {
    const config = this.config;

    // Security-hardened whitelist
    const isConfigPathSafe =
      config.cliPath === 'gemini' ||
      config.cliPath === 'gemini.cmd' ||
      config.cliPath === 'auto' ||
      config.cliPath?.startsWith('/usr/local/bin/') ||
      config.cliPath?.startsWith('/usr/bin/') ||
      config.cliPath?.startsWith('/opt/gemini/') ||
      config.cliPath?.startsWith('/opt/homebrew/') ||
      config.cliPath?.startsWith('C:\\Program Files\\gemini\\') ||
      config.cliPath?.startsWith('C:\\Program Files (x86)\\gemini\\') ||
      config.cliPath?.startsWith('C:\\Program Files\\Google\\');

    const basePaths = [
      ...(isConfigPathSafe ? [config.cliPath] : []),
      process.env.GEMINI_CLI_PATH,
      '/usr/local/bin/gemini',
      '/usr/bin/gemini',
      '/opt/gemini/bin/gemini',
      '/opt/homebrew/bin/gemini',
      'C:\\Program Files\\gemini\\gemini.exe',
      'C:\\Program Files (x86)\\gemini\\gemini.exe',
      'C:\\Program Files\\Google\\Gemini\\gemini.exe',
      'gemini',
      'gemini.cmd',
    ].filter(Boolean) as string[];

    // Add dynamic Windows npm global path
    if (process.platform === 'win32' && process.env.APPDATA) {
      basePaths.push(resolve(process.env.APPDATA, 'npm', 'gemini.cmd'));
    }

    return basePaths;
  }

  /**
   * Initialize CLI path using auto-detection
   */
  protected async initializeCLIPath(): Promise<void> {
    try {
      const result = await detectGeminiCLIPath(this.config.cliPath, this.logger);
      this.detectedCLIPath = result.path;
      this.config.cliPath = result.path;

      // Add detected paths to whitelist
      if (!this.allowedCLIPaths.includes(result.path)) {
        this.allowedCLIPaths.push(result.path);
      }
      if (result.resolvedPath && !this.allowedCLIPaths.includes(result.resolvedPath)) {
        this.allowedCLIPaths.push(result.resolvedPath);
      }

      this.logger.info(
        {
          path: result.path,
          source: result.source,
          exists: result.exists,
          platform: process.platform,
        },
        'Gemini CLI path detected'
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to detect Gemini CLI path');
      throw error;
    }
  }

  protected getResolvedCLIPath(): string {
    return this.detectedCLIPath ?? this.config.cliPath;
  }

  /**
   * Perform code review using Gemini CLI
   */
  async analyzeCode(params: CodeAnalysisParams): Promise<AnalysisResult> {
    const startTime = Date.now();
    const analysisId = generateUUID();

    try {
      this.logger.info({ analysisId, params: sanitizeParams(params) }, 'Starting Gemini review');

      // Validate input
      const validated = CodeAnalysisParamsSchema.parse(params);

      // Use per-request timeout if specified
      const timeout =
        this.config.timeout === 0
          ? 0
          : (validated.options?.timeout ?? this.config.timeout);

      // Ensure CLI path is initialized
      if (this.config.cliPath === 'auto' && !this.detectedCLIPath) {
        await this.initializeCLIPath();
      }

      // Validate CLI path BEFORE retry logic
      const cliPath = validated.options?.cliPath ?? this.config.cliPath;
      await this.validateCLIPath(cliPath);

      // Resolve context using base class method
      const enableAutoDetect = validated.options?.autoDetect ?? true;
      const enableWarnings = validated.options?.warnOnMissingContext ?? true;
      const { resolvedContext, warnings, templateId, prompt } = await this.resolveContext(
        validated,
        enableAutoDetect,
        enableWarnings
      );

      // Execute CLI with retry logic
      const output = await this.retryManager.execute(
        () => this.executeCLI(prompt, timeout, cliPath, analysisId),
        'Gemini review'
      );

      // Parse and structure response
      const review = this.parseResponse(output, analysisId);

      // Apply severity filtering if requested
      if (validated.options?.severity && validated.options.severity !== 'all') {
        review.findings = this.filterFindingsBySeverity(
          review.findings,
          validated.options.severity
        );
        review.summary = this.calculateSummary(review.findings);
      }

      // Add metadata using base class method
      this.addMetadata(review, resolvedContext, warnings, templateId, enableAutoDetect, startTime);

      this.logger.info(
        {
          analysisId,
          duration: review.metadata.analysisDuration,
          findings: review.findings.length,
          warnings: warnings.length,
          context: resolvedContext.language ?? 'unknown',
        },
        'Gemini review completed'
      );

      return review;
    } catch (error) {
      this.logger.error({ analysisId, error }, 'Gemini review failed');

      if (error instanceof GeminiAnalysisError) throw error;
      if (error instanceof SecurityError) throw error;

      if (error instanceof TimeoutError) {
        throw new GeminiTimeoutError(error.message, analysisId, { cause: error });
      }
      if (error instanceof ParseError) {
        throw new GeminiParseError(error.message, analysisId, { cause: error });
      }

      throw new GeminiAnalysisError(
        error instanceof Error ? error.message : 'Unknown error during Gemini review',
        analysisId,
        { cause: error }
      );
    }
  }

  /**
   * Execute Gemini CLI command securely
   */
  protected async executeCLI(
    prompt: string,
    timeout: number,
    cliPath: string,
    analysisId: string
  ): Promise<string> {
    const args = this.buildCLIArgs();

    this.logger.debug({ cliPath, argsCount: args.length, timeout }, 'Executing Gemini CLI');

    try {
      const result = await execa(cliPath, args, {
        timeout: timeout === 0 ? undefined : timeout,
        reject: true,
        input: prompt,
        env: {
          ...process.env,
          GEMINI_MODEL: this.config.model ?? undefined,
        },
        shell: false,
      });

      const stdout = result.stdout ?? '';
      if (stdout.trim() !== '') return stdout;

      const stderr = result.stderr ?? '';
      return stderr !== '' ? stderr : '';
    } catch (error: unknown) {
      const err = error as {
        timedOut?: boolean;
        exitCode?: number;
        stderr?: string;
        stdout?: string;
      };

      if (err.timedOut) {
        throw new TimeoutError(`Gemini CLI timed out after ${timeout}ms`);
      }
      if (err.exitCode !== undefined && err.exitCode !== 0) {
        throw new CLIExecutionError(`Gemini CLI exited with code ${err.exitCode}`, {
          exitCode: err.exitCode,
          stderr: err.stderr,
          stdout: err.stdout,
        });
      }
      throw new CLIExecutionError('Gemini CLI execution failed', { cause: error });
    }
  }

  /**
   * Build CLI arguments
   */
  protected buildCLIArgs(): string[] {
    const args: string[] = [];

    // Add configured arguments
    if (this.config.args && this.config.args.length > 0) {
      args.push(...this.config.args);
    }

    // Add model if specified
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Add output format
    args.push('--output-format', 'json');

    return args;
  }

  /**
   * Parse Gemini CLI output into structured format
   */
  protected parseResponse(output: string, analysisId: string): AnalysisResult {
    // Guard against unexpectedly large outputs
    if (!this.isOutputWithinLimits(output)) {
      this.logger.warn({ analysisId, size: output.length }, 'Gemini output exceeds maximum parse size');
      return this.createRawOutputResult(
        analysisId,
        output.substring(0, 50000),
        `Output exceeds maximum parse size of ${BaseAnalysisService.MAX_PARSE_SIZE} bytes`
      );
    }

    const cleaned = this.cleanOutput(output);

    try {
      // Parse as JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        this.logger.warn(
          { analysisId, outputLength: cleaned.length },
          'Could not parse Gemini output as JSON, returning raw'
        );
        return this.createRawOutputResult(analysisId, cleaned, 'Failed to parse as JSON');
      }

      // Handle Gemini wrapper format { response: ..., stats: ..., error: ... }
      let analysisData: unknown = parsed;

      if (this.isGeminiWrapper(parsed)) {
        const wrapper = parsed as { response?: unknown; error?: string | null };

        if (wrapper.error) {
          this.logger.error({ analysisId, error: wrapper.error }, 'Gemini CLI returned an error');
          return this.createRawOutputResult(analysisId, cleaned, `Gemini error: ${wrapper.error}`);
        }

        if (wrapper.response === null || wrapper.response === undefined) {
          return this.createRawOutputResult(analysisId, cleaned, 'Gemini response is null');
        }

        // If response is a string, parse it
        if (typeof wrapper.response === 'string') {
          try {
            const responseText = wrapper.response
              .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
              .replace(/\n?```\s*$/gm, '')
              .trim();
            analysisData = JSON.parse(responseText);
          } catch {
            return this.createRawOutputResult(analysisId, cleaned, 'Failed to parse response string');
          }
        } else {
          analysisData = wrapper.response;
        }
      }

      // Validate against schema
      const validated = AnalysisResponseSchema.parse(analysisData);
      const summary = this.calculateSummary(validated.findings);

      const result: AnalysisResult = {
        success: true,
        analysisId,
        timestamp: new Date().toISOString(),
        source: 'gemini',
        summary,
        findings: validated.findings,
        overallAssessment: validated.overallAssessment,
        recommendations: validated.recommendations,
        metadata: { analysisDuration: 0 },
      };

      AnalysisResultSchema.parse(result);

      this.logger.debug(
        { analysisId, findingsCount: result.findings.length },
        'Gemini output parsed successfully'
      );

      return result;
    } catch (error) {
      this.logger.error({ analysisId, error }, 'Failed to parse Gemini output');

      if (error instanceof z.ZodError) {
        return this.createRawOutputResult(
          analysisId,
          cleaned,
          `Schema validation failed: ${error.message}`
        );
      }

      throw new ParseError('Failed to parse Gemini output', { cause: error });
    }
  }

  /**
   * Check if parsed data is a Gemini CLI wrapper format
   */
  private isGeminiWrapper(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return 'response' in obj || 'stats' in obj || 'error' in obj;
  }
}
