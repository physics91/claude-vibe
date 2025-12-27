/**
 * Codex Analysis Service
 * Handles code analysis using Codex CLI
 *
 * Migrated from MCP tool to direct CLI execution for consistency with Gemini service
 */

import { mkdir, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { execa } from 'execa';
import { z } from 'zod';

import { ContextAutoDetector } from '../../core/auto-detect.js';
import { detectCodexCLIPath } from '../../core/cli-detector.js';
import { ContextManager, type ContextConfig } from '../../core/context-manager.js';
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
import {
  PromptTemplateEngine,
  DEFAULT_FORMAT_INSTRUCTIONS,
  type TemplateEngineConfig,
} from '../../core/prompt-template.js';
import { RetryManager } from '../../core/retry.js';
import { generateUUID, sanitizeParams, stripAnsiCodes } from '../../core/utils.js';
import { WarningSystem, type WarningConfig } from '../../core/warnings.js';
import type { AnalysisContext } from '../../schemas/context.js';
import { CodexResponseSchema, type CodexResponse } from '../../schemas/responses.js';
import {
  CodeAnalysisParamsSchema,
  AnalysisResultSchema,
  type CodeAnalysisParams,
  type AnalysisResult,
} from '../../schemas/tools.js';

export interface CodexServiceConfig {
  cliPath: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  model?: string | null;
  search?: boolean;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  args?: string[];
  output?: {
    mode?: 'jsonl' | 'last-message';
    lastMessageFileDir?: string;
    outputSchemaPath?: string;
  };
  // Context system configuration
  context?: ContextConfig;
  prompts?: TemplateEngineConfig;
  warnings?: WarningConfig;
}

/**
 * Codex Analysis Service
 * Uses direct CLI execution instead of MCP tool
 */
export class CodexAnalysisService {
  private retryManager: RetryManager;
  private allowedCLIPaths: string[];
  private detectedCLIPath: string | null = null;
  private validatedCLIPaths: Set<string> = new Set();

  // Maximum output size to parse (guard against unexpectedly large responses)
  private static readonly MAX_PARSE_SIZE = 1024 * 1024; // 1MB

  // Context system modules
  private contextManager: ContextManager;
  private autoDetector: ContextAutoDetector;
  private warningSystem: WarningSystem;
  private templateEngine: PromptTemplateEngine;

  constructor(
    private config: CodexServiceConfig,
    private logger: Logger
  ) {
    this.retryManager = new RetryManager(
      {
        maxAttempts: config.retryAttempts,
        initialDelay: config.retryDelay,
        maxDelay: 10000,
        backoffFactor: 2,
      },
      logger
    );

    // Security-hardened whitelist: Only add config.cliPath if it's a known safe pattern
    // Don't blindly trust config - only allow well-known paths or relative names
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
      process.env.CODEX_CLI_PATH, // Environment variable
      '/usr/local/bin/codex', // Common install location (Unix)
      '/usr/bin/codex', // System bin (Unix)
      '/opt/codex/bin/codex', // Alternative install location (Unix)
      '/opt/homebrew/bin/codex', // Homebrew (macOS Apple Silicon)
      'C:\\Program Files\\codex\\codex.exe', // Windows
      'C:\\Program Files (x86)\\codex\\codex.exe', // Windows (x86)
      'codex', // System PATH
      'codex.cmd', // Windows system PATH
    ].filter(Boolean) as string[];

    // Add dynamic Windows npm global path if on Windows
    if (process.platform === 'win32' && process.env.APPDATA) {
      basePaths.push(resolve(process.env.APPDATA, 'npm', 'codex.cmd'));
    }

    this.allowedCLIPaths = basePaths;

    this.logger.debug({ allowedPaths: this.allowedCLIPaths }, 'Codex CLI allowed paths');

    // Initialize CLI path detection if set to 'auto'
    if (config.cliPath === 'auto') {
      this.initializeCLIPath().catch((error: unknown) => {
        this.logger.warn({ error }, 'Failed to auto-detect Codex CLI path, will use default');
      });
    }

    // Initialize context system modules
    this.contextManager = new ContextManager({
      defaults: config.context?.defaults,
      presets: config.context?.presets,
      activePreset: config.context?.activePreset,
      allowEnvOverride: config.context?.allowEnvOverride ?? true,
      autoDetect: config.context?.autoDetect ?? true,
    });

    this.autoDetector = new ContextAutoDetector(logger);

    this.warningSystem = new WarningSystem({
      enabled: config.warnings?.enabled ?? true,
      showTips: config.warnings?.showTips ?? true,
      suppressions: config.warnings?.suppressions ?? [],
    });

    this.templateEngine = new PromptTemplateEngine({
      templates: config.prompts?.templates,
      defaultTemplate: config.prompts?.defaultTemplate ?? 'default',
      serviceTemplates: {
        codex: config.prompts?.serviceTemplates?.codex ?? 'default',
        gemini: config.prompts?.serviceTemplates?.gemini,
      },
    });

    this.logger.debug('Context system modules initialized for Codex service');
  }

  /**
   * Initialize CLI path using auto-detection
   */
  private async initializeCLIPath(): Promise<void> {
    try {
      const result = await detectCodexCLIPath(this.config.cliPath, this.logger);
      this.detectedCLIPath = result.path;

      // Update config with detected path
      this.config.cliPath = result.path;

      // Add detected path to whitelist if not already present
      if (!this.allowedCLIPaths.includes(result.path)) {
        this.allowedCLIPaths.push(result.path);
      }

      // If resolved path is different, add it too
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

      // Ensure CLI path is initialized (in case auto-detection is still in progress)
      if (this.config.cliPath === 'auto' && !this.detectedCLIPath) {
        await this.initializeCLIPath();
      }

      // Validate CLI path BEFORE retry logic (security check shouldn't be retried)
      const cliPath = validated.options?.cliPath ?? this.config.cliPath;
      await this.validateCLIPath(cliPath);

      // === Context System Integration ===
      const enableAutoDetect = validated.options?.autoDetect ?? true;
      const enableWarnings = validated.options?.warnOnMissingContext ?? true;

      // Step 1: Auto-detect context if enabled
      let detectedContext: Partial<AnalysisContext> | undefined;
      if (enableAutoDetect) {
        const detection = await this.autoDetector.detect({
          code: validated.prompt,
          fileName: validated.context?.fileName,
          workingDirectory: process.cwd(),
        });
        detectedContext = detection.context;
        this.logger.debug({ detectedContext, sources: detection.sources }, 'Auto-detected context');
      }

      // Step 2: Resolve final context (priority: defaults -> preset -> detected -> request)
      // Copy preset from options to context if provided (options.preset takes precedence)
      const contextWithPreset: AnalysisContext = {
        ...validated.context,
        preset: validated.options?.preset ?? validated.context?.preset,
      };
      const resolvedContext = this.contextManager.resolve(contextWithPreset, detectedContext);
      this.logger.debug(
        { resolvedContext, preset: contextWithPreset.preset },
        'Resolved analysis context'
      );

      // Step 3: Generate warnings for missing context
      const warnings = enableWarnings ? this.warningSystem.checkContext(resolvedContext) : [];
      if (warnings.length > 0) {
        this.logger.debug({ warnings: warnings.map(w => w.code) }, 'Context warnings generated');
      }

      // Step 4: Select and render prompt template
      const templateId =
        validated.options?.template ?? this.templateEngine.getTemplateForService('codex');
      const prompt = this.templateEngine.render(templateId, {
        prompt: validated.prompt,
        context: resolvedContext,
        formatInstructions: DEFAULT_FORMAT_INSTRUCTIONS,
      });

      this.logger.debug(
        { templateId, promptLength: prompt.length },
        'Prompt rendered from template'
      );

      // Execute CLI with retry logic
      const output = await this.retryManager.execute(
        () => this.executeCodexCLI(prompt, timeout, cliPath, analysisId),
        'Codex review'
      );

      // Parse and structure response
      const review = this.parseCodexOutput(output, analysisId);

      // Apply severity filtering if requested
      if (validated.options?.severity && validated.options.severity !== 'all') {
        review.findings = this.filterFindingsBySeverity(
          review.findings,
          validated.options.severity
        );
        review.summary = this.calculateSummary(review.findings);
      }

      // Add metadata including context information
      review.metadata.analysisDuration = Date.now() - startTime;
      review.metadata.resolvedContext = {
        threatModel: resolvedContext.threatModel,
        platform: resolvedContext.platform,
        projectType: resolvedContext.projectType,
        language: resolvedContext.language,
        framework: resolvedContext.framework,
        scope: resolvedContext.scope,
        fileName: resolvedContext.fileName,
      };
      review.metadata.warnings = this.warningSystem.formatWarningsAsJson(warnings);
      review.metadata.templateUsed = templateId;
      review.metadata.autoDetected = enableAutoDetect;

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

      // Wrap in domain-specific error if not already
      if (error instanceof CodexAnalysisError) {
        throw error;
      }

      // Re-throw SecurityError without wrapping (important for validation)
      if (error instanceof SecurityError) {
        throw error;
      }

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
   * @param cliPath - Pre-validated CLI path (validation done before retry logic)
   */
  private async executeCodexCLI(
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
        timeout: timeout === 0 ? undefined : timeout, // 0 = unlimited (no timeout)
        reject: true, // Throw on ANY non-zero exit code
        input: prompt, // Send prompt via stdin
        env: {
          ...process.env,
          // Use model config if specified
          CODEX_MODEL: this.config.model ?? undefined,
        },
        // Security: Don't use shell
        shell: false,
      });
    };

    const readOutput = async (result: { stdout?: string; stderr?: string }, path?: string) => {
      if (path) {
        try {
          const fileContents = await readFile(path, 'utf8');
          if (fileContents.trim() !== '') {
            return fileContents;
          }
        } catch (error) {
          this.logger.debug(
            { analysisId, error },
            'Failed to read last-message output file, falling back to stdout'
          );
        }
      }

      const stdout = result.stdout ?? '';
      if (stdout.trim() !== '') {
        return stdout;
      }

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
        failed?: boolean;
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
        failed?: boolean;
      };

      if (finalError.timedOut) {
        throw new TimeoutError(`Codex CLI timed out after ${timeout}ms`);
      }

      // ANY non-zero exit code is now an error
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
          this.logger.debug(
            { analysisId, error },
            'Failed to remove last-message output file'
          );
        });
      }
    }
  }

  /**
   * Validate CLI path against allowed paths
   * SECURITY: Prevents PATH manipulation attacks by resolving to absolute paths
   */
  private async validateCLIPath(cliPath: string): Promise<void> {
    try {
      if (this.validatedCLIPaths.has(cliPath)) {
        return;
      }

      // Special handling for system PATH executables
      if (cliPath === 'codex' || cliPath === 'codex.cmd') {
        // Check if in whitelist first
        if (!this.allowedCLIPaths.includes(cliPath)) {
          this.logger.logSecurityEvent('System PATH executable not in whitelist', {
            cliPath,
            allowed: this.allowedCLIPaths,
          });
          throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
        }

        // On non-Windows systems, try to resolve actual path for extra security
        if (process.platform !== 'win32') {
          try {
            const { stdout } = await execa('which', [cliPath], {
              shell: false,
              timeout: 5000,
            });
            const resolvedPath = stdout.trim();

            // Verify the resolved path is also in our whitelist or is a known good path
            const resolvedAllowed = this.allowedCLIPaths.some(allowed => {
              try {
                const resolvedAllowed = resolve(allowed);
                return resolvedAllowed === resolvedPath || allowed === cliPath;
              } catch {
                return false;
              }
            });

            if (!resolvedAllowed) {
              this.logger.logSecurityEvent('System PATH resolved to non-whitelisted path', {
                cliPath,
                resolvedPath,
                allowed: this.allowedCLIPaths,
              });
              throw new SecurityError(`Resolved CLI path not in allowed list: ${resolvedPath}`);
            }
          } catch (whichError) {
            // Re-throw SecurityError
            if (whichError instanceof SecurityError) {
              throw whichError;
            }
            // 'which' failed but cliPath is in whitelist, allow it
            this.logger.debug(
              { cliPath, error: whichError },
              'Could not resolve PATH executable, but in whitelist'
            );
          }
        }

        // Passed all checks
        this.validatedCLIPaths.add(cliPath);
        return;
      }

      // For absolute/relative paths, resolve to absolute path
      const resolved = resolve(cliPath);

      // Check against whitelist
      const isAllowed = this.allowedCLIPaths.some(allowed => {
        try {
          // Allow system PATH executables
          if (allowed === 'codex' || allowed === 'codex.cmd') {
            return false; // Already handled above
          }
          return resolve(allowed) === resolved;
        } catch {
          return false;
        }
      });

      if (!isAllowed) {
        this.logger.logSecurityEvent('Invalid CLI path attempted', {
          cliPath,
          resolved,
          allowed: this.allowedCLIPaths,
        });
        throw new SecurityError(`CLI path not in allowed list: ${cliPath}`);
      }

      this.validatedCLIPaths.add(cliPath);
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      throw new SecurityError('Failed to validate CLI path');
    }
  }

  /**
   * Build CLI arguments
   */
  private buildCLIArgs(options?: {
    outputMode?: 'jsonl' | 'last-message';
    lastMessagePath?: string;
    outputSchemaPath?: string;
  }): string[] {
    const args: string[] = [];

    // Add model if specified
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Add search flag if enabled (not supported in codex exec, using config override)
    // if (this.config.search) {
    //   args.push('--search');
    // }

    // Add reasoning effort via config override (--model-reasoning-effort not supported in exec)
    const reasoningEffort = this.config.reasoningEffort ?? 'high';
    args.push('-c', `model_reasoning_effort=${reasoningEffort}`);

    const outputMode = options?.outputMode ?? this.config.output?.mode ?? 'jsonl';

    if (outputMode === 'jsonl') {
      // Add JSONL output flag
      args.push('--json');
    } else if (outputMode === 'last-message' && options?.lastMessagePath) {
      args.push('--output-last-message', options.lastMessagePath);
      if (options.outputSchemaPath) {
        args.push('--output-schema', options.outputSchemaPath);
      }
    }

    // Skip git repo check for code review
    args.push('--skip-git-repo-check');

    // Use read-only sandbox for safety
    args.push('--sandbox', 'read-only');

    // Add user-provided arguments AFTER mandatory safety flags
    // This prevents bypassing security options like --sandbox
    if (this.config.args && this.config.args.length > 0) {
      // Filter out dangerous flags that could override safety settings
      // Using exact match or flag=value pattern to avoid filtering all --flags
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
        // Check for exact match or flag=value pattern
        const isDangerous = dangerousFlags.some(
          flag => lowerArg === flag || lowerArg.startsWith(flag + '=')
        );
        // Also block the '--' separator which ends flag parsing
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
   * SIMPLIFIED: Single-pass parsing with raw output preservation
   */
  private parseCodexOutput(output: string, analysisId: string): AnalysisResult {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;

    // Step 0: Guard against unexpectedly large outputs
    if (output.length > CodexAnalysisService.MAX_PARSE_SIZE) {
      this.logger.warn(
        { analysisId, size: output.length },
        'Codex output exceeds maximum parse size'
      );
      return this.createRawOutputResult(
        analysisId,
        output.substring(0, 50000),
        'codex',
        `Output exceeds maximum parse size of ${CodexAnalysisService.MAX_PARSE_SIZE} bytes`
      );
    }

    // Step 1: Clean output (minimal preprocessing)
    const cleaned = this.cleanOutput(output);

    try {
      if (!cleaned) {
        return this.createRawOutputResult(analysisId, '', 'codex', 'Empty output');
      }

      let analysisJson: unknown = null;

      // Step 2: Try direct JSON parse first (fast path for last-message mode)
      const trimmed = cleaned.trimStart();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(cleaned) as unknown;
          const directValidation = CodexResponseSchema.safeParse(parsed);
          if (directValidation.success) {
            analysisJson = directValidation.data;
          }
        } catch {
          analysisJson = null;
        }
      }

      // Step 3: Fall back to JSONL scan for codex exec output
      if (!analysisJson) {
        const lines = cleaned.split('\n');
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const line = lines[i]?.trim();
          if (!line) {
            continue;
          }
          if (!line.includes('item.completed')) {
            continue;
          }
          try {
            const event: unknown = JSON.parse(line);

            // Look for the final agent message with analysis result
            if (isRecord(event) && event.type === 'item.completed') {
              const item = event.item;
              if (isRecord(item) && item.type === 'agent_message' && typeof item.text === 'string') {
                // The text field contains the JSON response as a string
                analysisJson = JSON.parse(item.text) as unknown;
                break;
              }
            }
          } catch (lineError: unknown) {
            // Non-JSON line, log at debug level and skip
            this.logger.debug(
              { analysisId, line: line.substring(0, 100), error: lineError },
              'Skipping non-JSON line in Codex output'
            );
          }
        }
      }

      // Step 4: If parsing failed, return raw output
      if (!analysisJson) {
        this.logger.warn(
          { analysisId, outputLength: cleaned.length },
          'Could not parse Codex output as JSON, returning raw'
        );
        return this.createRawOutputResult(analysisId, cleaned, 'codex');
      }

      // Step 5: Validate against schema (JSONL path)
      const validated =
        analysisJson && typeof analysisJson === 'object'
          ? CodexResponseSchema.parse(analysisJson)
          : CodexResponseSchema.parse(analysisJson);

      // Step 6: Build result
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
        metadata: {
          analysisDuration: 0,
        },
      };

      // Validate final result
      AnalysisResultSchema.parse(result);

      return result;
    } catch (error) {
      this.logger.error({ error, analysisId }, 'Failed to parse Codex output');

      // Preserve raw output on parse failure - use sanitized 'cleaned' output
      if (error instanceof z.ZodError) {
        return this.createRawOutputResult(
          analysisId,
          cleaned,
          'codex',
          `Schema validation failed: ${error.message}`
        );
      }

      throw new ParseError('Failed to parse Codex output', { cause: error });
    }
  }

  /**
   * Create result with raw output when parsing fails
   */
  private createRawOutputResult(
    analysisId: string,
    rawOutput: string,
    source: 'codex' | 'gemini',
    error?: string
  ): AnalysisResult {
    return {
      success: false,
      analysisId,
      timestamp: new Date().toISOString(),
      source,
      summary: {
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      findings: [],
      overallAssessment: error ?? 'Failed to parse AI response',
      metadata: {
        analysisDuration: 0,
      },
      rawOutput: rawOutput.substring(0, 50000), // Limit size
    };
  }

  /**
   * Clean CLI output (remove ANSI codes, etc.)
   */
  private cleanOutput(output: string): string {
    // Remove ANSI escape codes
    let cleaned = stripAnsiCodes(output);

    // Remove null bytes
    cleaned = cleaned.replace(/\0/g, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Calculate summary statistics from findings
   */
  private calculateSummary(findings: CodexResponse['findings']): {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const finding of findings) {
      if (finding.severity === 'critical') critical++;
      else if (finding.severity === 'high') high++;
      else if (finding.severity === 'medium') medium++;
      else if (finding.severity === 'low') low++;
    }

    return {
      totalFindings: findings.length,
      critical,
      high,
      medium,
      low,
    };
  }

  /**
   * Filter findings by severity
   */
  private filterFindingsBySeverity(
    findings: CodexResponse['findings'],
    severity: 'high' | 'medium'
  ): CodexResponse['findings'] {
    if (severity === 'high') {
      return findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    } else if (severity === 'medium') {
      return findings.filter(
        f => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium'
      );
    }
    return findings;
  }
}
