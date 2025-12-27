/**
 * Warning System
 * Generates warnings for missing or incomplete context
 */

import type { AnalysisContext } from '../schemas/context.js';

/**
 * Context warning structure
 */
export interface ContextWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  tip: string;
  field: string;
}

/**
 * Warning system configuration
 */
export interface WarningConfig {
  enabled: boolean;
  showTips: boolean;
  suppressions: string[];
}

/**
 * Warning definition type (without field)
 */
type WarningDefinition = {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  tip: string;
};

/**
 * Warning definitions
 */
const WARNING_DEFINITIONS = {
  MISSING_SCOPE: {
    code: 'WARN_MISSING_SCOPE',
    severity: 'info' as const,
    message: 'Code scope not specified. Treating as partial code.',
    tip: 'Set context.scope = "full" if analyzing complete files to avoid false positives like "unused import".',
  },
  MISSING_THREAT_MODEL: {
    code: 'WARN_MISSING_THREAT_MODEL',
    severity: 'warning' as const,
    message: 'Threat model not specified. Using conservative severity assessment.',
    tip: 'Set context.threatModel = "local-user-tool" for internal tools to get accurate severity ratings.',
  },
  MISSING_PLATFORM: {
    code: 'WARN_MISSING_PLATFORM',
    severity: 'info' as const,
    message: 'Platform not specified. Analyzing for cross-platform compatibility.',
    tip: 'Set context.platform = "windows" or "unix" for platform-specific code analysis.',
  },
  MISSING_LANGUAGE: {
    code: 'WARN_MISSING_LANGUAGE',
    severity: 'info' as const,
    message: 'Programming language not specified. Auto-detection may be less accurate.',
    tip: 'Set context.language = "typescript" (or appropriate language) for better analysis.',
  },
  PARTIAL_CODE_ANALYSIS: {
    code: 'WARN_PARTIAL_CODE',
    severity: 'info' as const,
    message: 'Analyzing partial code. Some findings may be false positives.',
    tip: 'Import/export warnings may be incorrect for partial code snippets.',
  },
} satisfies Record<string, WarningDefinition>;

/**
 * Create a context warning from a definition
 */
function createWarning(def: WarningDefinition, field: string): ContextWarning {
  return {
    code: def.code,
    severity: def.severity,
    message: def.message,
    tip: def.tip,
    field,
  };
}

/**
 * Warning System class
 */
export class WarningSystem {
  private suppressions: Set<string>;
  private enabled: boolean;
  private showTips: boolean;

  constructor(config: WarningConfig) {
    this.enabled = config.enabled;
    this.showTips = config.showTips;
    this.suppressions = new Set(config.suppressions);
  }

  /**
   * Check context and generate appropriate warnings
   */
  checkContext(context: AnalysisContext): ContextWarning[] {
    if (!this.enabled) {
      return [];
    }

    const warnings: ContextWarning[] = [];

    // Check for missing scope
    if (!context.scope && !this.isSuppressed('MISSING_SCOPE')) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_SCOPE, 'scope'));
    }

    // Check for missing threat model
    if (!context.threatModel && !this.isSuppressed('MISSING_THREAT_MODEL')) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_THREAT_MODEL, 'threatModel'));
    }

    // Check for missing platform
    if (!context.platform && !this.isSuppressed('MISSING_PLATFORM')) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_PLATFORM, 'platform'));
    }

    // Check for missing language (only if not auto-detected)
    if (!context.language && !this.isSuppressed('MISSING_LANGUAGE')) {
      warnings.push(createWarning(WARNING_DEFINITIONS.MISSING_LANGUAGE, 'language'));
    }

    // Warn about partial code analysis
    if (context.scope === 'partial' && !this.isSuppressed('PARTIAL_CODE_ANALYSIS')) {
      warnings.push(createWarning(WARNING_DEFINITIONS.PARTIAL_CODE_ANALYSIS, 'scope'));
    }

    return warnings;
  }

  /**
   * Check if a warning is suppressed
   */
  private isSuppressed(warningKey: keyof typeof WARNING_DEFINITIONS): boolean {
    const definition = WARNING_DEFINITIONS[warningKey];
    return this.suppressions.has(warningKey) || this.suppressions.has(definition.code);
  }

  /**
   * Format warnings as markdown string
   */
  formatWarnings(warnings: ContextWarning[]): string {
    if (warnings.length === 0) {
      return '';
    }

    const lines: string[] = ['## Warnings\n'];

    for (const warning of warnings) {
      const icon = warning.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`> ${icon} **${warning.message}** (\`${warning.code}\`)`);

      if (this.showTips && warning.tip) {
        lines.push(`>`);
        lines.push(`> **Tip:** ${warning.tip}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format warnings as JSON-friendly array
   */
  formatWarningsAsJson(warnings: ContextWarning[]): Array<{
    code: string;
    severity: 'info' | 'warning';
    message: string;
    tip?: string;
    field: string;
  }> {
    return warnings.map(w => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
      tip: this.showTips ? w.tip : undefined,
      field: w.field,
    }));
  }

  /**
   * Suppress a specific warning
   */
  suppress(warningCode: string): void {
    this.suppressions.add(warningCode);
  }

  /**
   * Unsuppress a specific warning
   */
  unsuppress(warningCode: string): void {
    this.suppressions.delete(warningCode);
  }

  /**
   * Check if warnings are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable warnings
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Create a WarningSystem from config
 */
export function createWarningSystem(config: WarningConfig): WarningSystem {
  return new WarningSystem(config);
}

/**
 * Default warning configuration
 */
export const DEFAULT_WARNING_CONFIG: WarningConfig = {
  enabled: true,
  showTips: true,
  suppressions: [],
};
