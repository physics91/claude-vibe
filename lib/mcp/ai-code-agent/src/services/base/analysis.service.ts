/**
 * Base Analysis Service
 * Abstract base class for CLI-based analysis services (Codex, Gemini)
 * DRY: Extracts common functionality to reduce code duplication
 */

import { resolve } from 'path';

import { execa } from 'execa';

import { ContextAutoDetector } from '../../core/auto-detect.js';
import { ContextManager, type ContextConfig } from '../../core/context-manager.js';
import { SecurityError } from '../../core/error-handler.js';
import type { Logger } from '../../core/logger.js';
import {
  PromptTemplateEngine,
  type TemplateEngineConfig,
} from '../../core/prompt-template.js';
import { RetryManager } from '../../core/retry.js';
import { generateUUID, stripAnsiCodes } from '../../core/utils.js';
import { WarningSystem, type WarningConfig } from '../../core/warnings.js';
import type { AnalysisContext } from '../../schemas/context.js';
import type { AnalysisResponse, AnalysisFinding } from '../../schemas/responses.js';
import type { CodeAnalysisParams, AnalysisResult } from '../../schemas/tools.js';

/**
 * Base service configuration shared by all analysis services
 */
export interface BaseServiceConfig {
  cliPath: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  model?: string | null;
  args?: string[];
  // Context system configuration
  context?: ContextConfig;
  prompts?: TemplateEngineConfig;
  warnings?: WarningConfig;
}

/**
 * Result of CLI execution
 */
export interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * CLI detection result
 */
export interface CLIDetectionResult {
  path: string;
  source: 'env' | 'config' | 'detected' | 'which' | 'default';
  exists: boolean;
  resolvedPath?: string;
}

/**
 * Summary statistics for findings
 */
export interface FindingsSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Abstract base class for analysis services
 * Provides common functionality for CLI-based code analysis
 */
export abstract class BaseAnalysisService {
  // Service name for logging and identification
  protected abstract readonly serviceName: 'codex' | 'gemini';

  // CLI executable names for this service
  protected abstract readonly cliExecutableNames: string[];

  // CLI-related properties
  protected allowedCLIPaths: string[] = [];
  protected detectedCLIPath: string | null = null;
  protected validatedCLIPaths: Set<string> = new Set();

  // Maximum output size to parse
  protected static readonly MAX_PARSE_SIZE = 1024 * 1024; // 1MB

  // Retry manager
  protected retryManager: RetryManager;

  // Context system modules
  protected contextManager: ContextManager;
  protected autoDetector: ContextAutoDetector;
  protected warningSystem: WarningSystem;
  protected templateEngine: PromptTemplateEngine;

  constructor(
    protected config: BaseServiceConfig,
    protected logger: Logger
  ) {
    // Initialize retry manager
    this.retryManager = new RetryManager(
      {
        maxAttempts: config.retryAttempts,
        initialDelay: config.retryDelay,
        maxDelay: 10000,
        backoffFactor: 2,
      },
      logger
    );

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
        gemini: config.prompts?.serviceTemplates?.gemini ?? 'default',
      },
    });

    this.logger.debug(`Context system modules initialized for ${this.serviceName} service`);
  }

  /**
   * Initialize CLI path detection
   * Should be implemented by subclasses to detect their specific CLI
   */
  protected abstract initializeCLIPath(): Promise<void>;

  /**
   * Get the resolved CLI path to use
   */
  protected abstract getResolvedCLIPath(): string;

  /**
   * Build CLI arguments for the analysis
   */
  protected abstract buildCLIArgs(options?: Record<string, unknown>): string[];

  /**
   * Execute CLI command and return result
   */
  protected abstract executeCLI(
    prompt: string,
    timeout: number,
    cliPath: string,
    analysisId: string
  ): Promise<string>;

  /**
   * Parse CLI response into structured result
   */
  protected abstract parseResponse(output: string, analysisId: string): AnalysisResult;

  /**
   * Analyze code (main entry point)
   */
  abstract analyzeCode(params: CodeAnalysisParams): Promise<AnalysisResult>;

  /**
   * Generate analysis ID
   */
  protected generateAnalysisId(): string {
    return generateUUID();
  }

  /**
   * Strip ANSI codes and clean output
   */
  protected cleanOutput(output: string): string {
    // Remove ANSI escape codes
    let cleaned = stripAnsiCodes(output);

    // Remove null bytes
    cleaned = cleaned.replace(/\0/g, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Check if output is within size limits
   */
  protected isOutputWithinLimits(output: string): boolean {
    return output.length <= BaseAnalysisService.MAX_PARSE_SIZE;
  }

  /**
   * Calculate summary statistics from findings
   */
  protected calculateSummary(findings: AnalysisFinding[]): FindingsSummary {
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
   * Filter findings by severity threshold
   */
  protected filterFindingsBySeverity(
    findings: AnalysisFinding[],
    severity: 'high' | 'medium'
  ): AnalysisFinding[] {
    if (severity === 'high') {
      return findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    } else if (severity === 'medium') {
      return findings.filter(
        f => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium'
      );
    }
    return findings;
  }

  /**
   * Create result with raw output when parsing fails
   */
  protected createRawOutputResult(
    analysisId: string,
    rawOutput: string,
    error?: string
  ): AnalysisResult {
    return {
      success: false,
      analysisId,
      timestamp: new Date().toISOString(),
      source: this.serviceName,
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
   * Validate CLI path against allowed paths
   * SECURITY: Prevents PATH manipulation attacks by resolving to absolute paths
   */
  protected async validateCLIPath(cliPath: string): Promise<void> {
    try {
      if (this.validatedCLIPaths.has(cliPath)) {
        return;
      }

      // Special handling for system PATH executables
      if (this.cliExecutableNames.includes(cliPath)) {
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
          // Skip system PATH executables (already handled above)
          if (this.cliExecutableNames.includes(allowed)) {
            return false;
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
   * Resolve context for analysis
   * Returns resolved context and warnings
   */
  protected async resolveContext(
    params: CodeAnalysisParams,
    enableAutoDetect: boolean,
    enableWarnings: boolean
  ): Promise<{
    resolvedContext: AnalysisContext;
    warnings: ReturnType<WarningSystem['checkContext']>;
    templateId: string;
    prompt: string;
  }> {
    // Step 1: Auto-detect context if enabled
    let detectedContext: Partial<AnalysisContext> | undefined;
    if (enableAutoDetect) {
      const detection = await this.autoDetector.detect({
        code: params.prompt,
        fileName: params.context?.fileName,
        workingDirectory: process.cwd(),
      });
      detectedContext = detection.context;
      this.logger.debug({ detectedContext, sources: detection.sources }, 'Auto-detected context');
    }

    // Step 2: Resolve final context (priority: defaults -> preset -> detected -> request)
    const contextWithPreset: AnalysisContext = {
      ...params.context,
      preset: params.options?.preset ?? params.context?.preset,
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
      params.options?.template ?? this.templateEngine.getTemplateForService(this.serviceName);

    // Import DEFAULT_FORMAT_INSTRUCTIONS dynamically to avoid circular deps
    const { DEFAULT_FORMAT_INSTRUCTIONS } = await import('../../core/prompt-template.js');

    const prompt = this.templateEngine.render(templateId, {
      prompt: params.prompt,
      context: resolvedContext,
      formatInstructions: DEFAULT_FORMAT_INSTRUCTIONS,
    });

    this.logger.debug(
      { templateId, promptLength: prompt.length },
      'Prompt rendered from template'
    );

    return { resolvedContext, warnings, templateId, prompt };
  }

  /**
   * Add metadata to analysis result
   */
  protected addMetadata(
    result: AnalysisResult,
    resolvedContext: AnalysisContext,
    warnings: ReturnType<WarningSystem['checkContext']>,
    templateId: string,
    enableAutoDetect: boolean,
    startTime: number
  ): void {
    result.metadata.analysisDuration = Date.now() - startTime;
    result.metadata.resolvedContext = {
      threatModel: resolvedContext.threatModel,
      platform: resolvedContext.platform,
      projectType: resolvedContext.projectType,
      language: resolvedContext.language,
      framework: resolvedContext.framework,
      scope: resolvedContext.scope,
      fileName: resolvedContext.fileName,
    };
    result.metadata.warnings = this.warningSystem.formatWarningsAsJson(warnings);
    result.metadata.templateUsed = templateId;
    result.metadata.autoDetected = enableAutoDetect;
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.initializeCLIPath();
      return {
        healthy: this.detectedCLIPath !== null,
        message: this.detectedCLIPath
          ? `CLI available at: ${this.detectedCLIPath}`
          : 'CLI not detected',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
