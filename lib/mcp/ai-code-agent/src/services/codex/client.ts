/**
 * Codex Analysis Service
 * Handles code analysis using Codex CLI
 * DRY: Extends BaseAnalysisService for shared functionality
 */

import { mkdir, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { execa } from 'execa';
import { z } from 'zod';

import { detectCodexCLIPath } from '../../core/cli-detector.js';
import type { ContextConfig } from '../../core/context-manager.js';
import {
  CLIExecutionError,
  TimeoutError,
  ParseError,
  SecurityError,
  CodexAnalysisError,
  CodexTimeoutError,
  CodexParseError,
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

export interface CodexServiceConfig extends BaseServiceConfig {
  search?: boolean;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  output?: {
    mode?: 'jsonl' | 'last-message';
    lastMessageFileDir?: string;
    outputSchemaPath?: string;
  };
}

/**
 * Codex Analysis Service
 * DRY: Extends BaseAnalysisService for common functionality
 */
export class CodexAnalysisService extends BaseAnalysisService {
  protected readonly serviceName = 'codex' as const;
  protected readonly cliExecutableNames = ['codex', 'codex.cmd'];

  constructor(
    protected override config: CodexServiceConfig,
    logger: Logger
  ) {
    super(config, logger);

    // Build security-hardened whitelist
    this.allowedCLIPaths = this.buildAllowedPaths();

    this.logger.debug({ allowedPaths: this.allowedCLIPaths }, 'Codex CLI allowed paths');

    // Initialize CLI path detection if set to 'auto'
    if (config.cliPath === 'auto') {
      this.initializeCLIPath().catch((error: unknown) => {
        this.logger.warn({ error }, 'Failed to auto-detect Codex CLI path, will use default');
      });
    }
  }

  /**
   * Build allowed CLI paths list
   */
  private buildAllowedPaths(): string[] {
    const config = this.config;

    // Security-hardened whitelist: Only add config.cliPath if it's a known safe pattern
    const isConfigPathSafe =
      config.cliPath === 'codex' ||
      config.cliPath === 'codex.cmd' ||
      config.cliPath === 'auto' ||
      config.cliPath?.startsWith('/usr/local/bin/') ||
      config.cliPath?.startsWith('/usr/bin/') ||
      config.cliPath?.startsWith('/opt/codex/') ||
      config.cliPath?.startsWith('/opt/homebrew/') ||
      config.cliPath?.startsWith('C:\\Program Files\\codex\\') ||
      config.cliPath?.startsWith('C:\\Program Files (x86)\\codex\\');

    const basePaths = [
      ...(isConfigPathSafe ? [config.cliPath] : []),
      process.env.CODEX_CLI_PATH,
      '/usr/local/bin/codex',
      '/usr/bin/codex',
      '/opt/codex/bin/codex',
      '/opt/homebrew/bin/codex',
      'C:\\Program Files\\codex\\codex.exe',
      'C:\\Program Files (x86)\\codex\\codex.exe',
      'codex',
      'codex.cmd',
    ].filter(Boolean) as string[];

    // Add dynamic Windows npm global path
    if (process.platform === 'win32' && process.env.APPDATA) {
      basePaths.push(resolve(process.env.APPDATA, 'npm', 'codex.cmd'));
    }

    return basePaths;
  }

  /**
   * Initialize CLI path using auto-detection
   */
  protected async initializeCLIPath(): Promise<void> {
    try {
      const result = await detectCodexCLIPath(this.config.cliPath, this.logger);
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
        'Codex CLI path detected'
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to detect Codex CLI path');
      throw error;
    }
  }

  protected getResolvedCLIPath(): string {
    return this.detectedCLIPath ?? this.config.cliPath;
  }

  /**
   * Perform code review using Codex CLI
   */
  async analyzeCode(params: CodeAnalysisParams): Promise<AnalysisResult> {
    const startTime = Date.now();
    const analysisId = generateUUID();

    try {
      this.logger.info({ analysisId, params: sanitizeParams(params) }, 'Starting Codex review');

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

      // Validate CLI path BEFORE retry logic (security check shouldn't be retried)
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
        'Codex review'
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
        'Codex review completed'
      );

      return review;
    } catch (error: unknown) {
      this.logger.error({ analysisId, error }, 'Codex review failed');

      if (error instanceof CodexAnalysisError) throw error;
      if (error instanceof SecurityError) throw error;

      if (error instanceof TimeoutError) {
        throw new CodexTimeoutError(error.message, analysisId, { cause: error });
      }
      if (error instanceof ParseError) {
        throw new CodexParseError(error.message, analysisId, { cause: error });
      }

      throw new CodexAnalysisError(
        error instanceof Error ? error.message : 'Unknown error during Codex review',
        analysisId,
        { cause: error }
      );
    }
  }

  /**
   * Execute Codex CLI command securely
   */
  protected async executeCLI(
    prompt: string,
    timeout: number,
    cliPath: string,
    analysisId: string
  ): Promise<string> {
    const outputConfig = this.config.output;
    let outputMode = outputConfig?.mode ?? 'jsonl';
    let lastMessagePath: string | undefined;

    if (outputMode === 'last-message') {
      try {
        const baseDir = outputConfig?.lastMessageFileDir ?? tmpdir();
        await mkdir(baseDir, { recursive: true });
        lastMessagePath = join(baseDir, `codex-last-message-${analysisId}.json`);
      } catch (error) {
        this.logger.warn(
          { analysisId, error },
          'Failed to prepare last-message output file, falling back to JSONL output'
        );
        outputMode = 'jsonl';
      }
    }

    const cleanupPath = lastMessagePath;

    const runCodex = async (args: string[]) => {
      this.logger.debug({ cliPath, argsCount: args.length, timeout }, 'Executing Codex CLI');
      return execa(cliPath, ['e', ...args, '-'], {
        timeout: timeout === 0 ? undefined : timeout,
        reject: true,
        input: prompt,
        env: {
          ...process.env,
          CODEX_MODEL: this.config.model ?? undefined,
        },
        shell: false,
      });
    };

    const readOutput = async (result: { stdout?: string; stderr?: string }, path?: string) => {
      if (path) {
        try {
          const fileContents = await readFile(path, 'utf8');
          if (fileContents.trim() !== '') return fileContents;
        } catch (error) {
          this.logger.debug(
            { analysisId, error },
            'Failed to read last-message output file, falling back to stdout'
          );
        }
      }
      const stdout = result.stdout ?? '';
      if (stdout.trim() !== '') return stdout;
      const stderr = result.stderr ?? '';
      return stderr !== '' ? stderr : '';
    };

    const buildArgs = (mode: 'jsonl' | 'last-message', path?: string) =>
      this.buildCLIArgs({
        outputMode: mode,
        lastMessagePath: path,
        outputSchemaPath: outputConfig?.outputSchemaPath,
      });

    try {
      const args = buildArgs(outputMode, lastMessagePath);
      const result = await runCodex(args);
      return await readOutput(result, lastMessagePath);
    } catch (error: unknown) {
      const err = error as {
        timedOut?: boolean;
        exitCode?: number;
        stderr?: string;
        stdout?: string;
      };

      const combinedOutput = `${err.stderr ?? ''}\n${err.stdout ?? ''}`.toLowerCase();
      const outputFlagMentioned =
        combinedOutput.includes('--output-last-message') ||
        combinedOutput.includes('output-last-message');
      const unknownFlag =
        combinedOutput.includes('unknown') ||
        combinedOutput.includes('unrecognized') ||
        combinedOutput.includes('invalid') ||
        combinedOutput.includes('unexpected');

      if (outputMode === 'last-message' && outputFlagMentioned && unknownFlag) {
        this.logger.warn(
          { analysisId },
          'Codex CLI does not support output-last-message; retrying with JSONL output'
        );
        try {
          const fallbackArgs = buildArgs('jsonl');
          const fallbackResult = await runCodex(fallbackArgs);
          return await readOutput(fallbackResult);
        } catch (fallbackError: unknown) {
          error = fallbackError;
        }
      }

      const finalError = error as {
        timedOut?: boolean;
        exitCode?: number;
        stderr?: string;
        stdout?: string;
      };

      if (finalError.timedOut) {
        throw new TimeoutError(`Codex CLI timed out after ${timeout}ms`);
      }
      if (finalError.exitCode !== undefined && finalError.exitCode !== 0) {
        throw new CLIExecutionError(`Codex CLI exited with code ${finalError.exitCode}`, {
          exitCode: finalError.exitCode,
          stderr: finalError.stderr,
          stdout: finalError.stdout,
        });
      }
      throw new CLIExecutionError('Codex CLI execution failed', { cause: finalError });
    } finally {
      if (cleanupPath) {
        await unlink(cleanupPath).catch(error => {
          this.logger.debug({ analysisId, error }, 'Failed to remove last-message output file');
        });
      }
    }
  }

  /**
   * Build CLI arguments
   */
  protected buildCLIArgs(options?: {
    outputMode?: 'jsonl' | 'last-message';
    lastMessagePath?: string;
    outputSchemaPath?: string;
  }): string[] {
    const args: string[] = [];

    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    const reasoningEffort = this.config.reasoningEffort ?? 'high';
    args.push('-c', `model_reasoning_effort=${reasoningEffort}`);

    const outputMode = options?.outputMode ?? this.config.output?.mode ?? 'jsonl';

    if (outputMode === 'jsonl') {
      args.push('--json');
    } else if (outputMode === 'last-message' && options?.lastMessagePath) {
      args.push('--output-last-message', options.lastMessagePath);
      if (options.outputSchemaPath) {
        args.push('--output-schema', options.outputSchemaPath);
      }
    }

    args.push('--skip-git-repo-check');
    args.push('--sandbox', 'read-only');

    // Add user-provided arguments AFTER mandatory safety flags
    if (this.config.args && this.config.args.length > 0) {
      const dangerousFlags = [
        '--sandbox',
        '--json',
        '--no-sandbox',
        '--skip-git-repo-check',
        '--output-last-message',
        '--output-schema',
      ];
      const safeArgs = this.config.args.filter(arg => {
        const lowerArg = arg.toLowerCase();
        const isDangerous = dangerousFlags.some(
          flag => lowerArg === flag || lowerArg.startsWith(flag + '=')
        );
        const isSeparator = arg === '--';
        return !isDangerous && !isSeparator;
      });

      if (safeArgs.length !== this.config.args.length) {
        this.logger.warn(
          { filtered: this.config.args.length - safeArgs.length },
          'Some user-provided args were filtered out for security'
        );
      }
      args.push(...safeArgs);
    }

    return args;
  }

  /**
   * Parse Codex CLI output into structured format
   */
  protected parseResponse(output: string, analysisId: string): AnalysisResult {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;

    // Guard against unexpectedly large outputs
    if (!this.isOutputWithinLimits(output)) {
      this.logger.warn({ analysisId, size: output.length }, 'Codex output exceeds maximum parse size');
      return this.createRawOutputResult(
        analysisId,
        output.substring(0, 50000),
        `Output exceeds maximum parse size of ${BaseAnalysisService.MAX_PARSE_SIZE} bytes`
      );
    }

    const cleaned = this.cleanOutput(output);

    try {
      if (!cleaned) {
        return this.createRawOutputResult(analysisId, '', 'Empty output');
      }

      let analysisJson: unknown = null;

      // Try direct JSON parse first (fast path for last-message mode)
      const trimmed = cleaned.trimStart();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(cleaned) as unknown;
          const directValidation = AnalysisResponseSchema.safeParse(parsed);
          if (directValidation.success) {
            analysisJson = directValidation.data;
          }
        } catch {
          analysisJson = null;
        }
      }

      // Fall back to JSONL scan for codex exec output
      if (!analysisJson) {
        const lines = cleaned.split('\n');
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const line = lines[i]?.trim();
          if (!line || !line.includes('item.completed')) continue;
          try {
            const event: unknown = JSON.parse(line);
            if (isRecord(event) && event.type === 'item.completed') {
              const item = event.item;
              if (isRecord(item) && item.type === 'agent_message' && typeof item.text === 'string') {
                analysisJson = JSON.parse(item.text) as unknown;
                break;
              }
            }
          } catch (lineError: unknown) {
            this.logger.debug(
              { analysisId, line: line.substring(0, 100), error: lineError },
              'Skipping non-JSON line in Codex output'
            );
          }
        }
      }

      if (!analysisJson) {
        this.logger.warn(
          { analysisId, outputLength: cleaned.length },
          'Could not parse Codex output as JSON, returning raw'
        );
        return this.createRawOutputResult(analysisId, cleaned);
      }

      // Validate against schema
      const validated = AnalysisResponseSchema.parse(analysisJson);
      const summary = this.calculateSummary(validated.findings);

      const result: AnalysisResult = {
        success: true,
        analysisId,
        timestamp: new Date().toISOString(),
        source: 'codex',
        summary,
        findings: validated.findings,
        overallAssessment: validated.overallAssessment,
        recommendations: validated.recommendations,
        metadata: { analysisDuration: 0 },
      };

      AnalysisResultSchema.parse(result);
      return result;
    } catch (error) {
      this.logger.error({ error, analysisId }, 'Failed to parse Codex output');

      if (error instanceof z.ZodError) {
        return this.createRawOutputResult(
          analysisId,
          cleaned,
          `Schema validation failed: ${error.message}`
        );
      }

      throw new ParseError('Failed to parse Codex output', { cause: error });
    }
  }
}
