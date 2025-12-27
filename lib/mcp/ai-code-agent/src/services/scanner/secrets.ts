/**
 * Secret Scanner Service
 * Detects hardcoded secrets, API keys, and sensitive data in code
 */

import type { Logger } from '../../core/logger.js';
import type { AnalysisFinding, Severity } from '../../types/common.js';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: Severity;
  description: string;
  recommendation: string;
  category: 'api_key' | 'credential' | 'token' | 'private_key' | 'connection_string' | 'other';
}

export interface SecretFinding {
  type: 'security';
  secretType: string;
  category: SecretPattern['category'];
  severity: Severity;
  line: number;
  column: number; // 1-based column number
  match: string; // Masked value
  description: string;
  recommendation: string;
}

export interface SecretScannerConfig {
  enabled: boolean;
  patterns?: {
    aws?: boolean;
    gcp?: boolean;
    azure?: boolean;
    github?: boolean;
    generic?: boolean;
    database?: boolean;
    privateKeys?: boolean;
  };
  customPatterns?: SecretPattern[];
  excludePatterns?: string[]; // Regex patterns to exclude (e.g., test files)
  maxScanLength?: number; // Max characters to scan
  maxLineLength?: number; // Max characters per line to scan
}

/**
 * Default secret patterns library
 */
const DEFAULT_PATTERNS: SecretPattern[] = [
  // AWS
  {
    name: 'AWS Access Key ID',
    pattern: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected in code',
    recommendation:
      'Use environment variables or AWS Secrets Manager. Never commit AWS credentials to version control.',
    category: 'api_key',
  },
  {
    name: 'AWS Secret Access Key',
    pattern: /\b[A-Za-z0-9/+=]{40}\b(?=.*(?:aws|secret|key))/gi,
    severity: 'critical',
    description: 'Potential AWS Secret Access Key detected',
    recommendation:
      'Use environment variables or AWS Secrets Manager. Rotate this key immediately if exposed.',
    category: 'api_key',
  },
  {
    name: 'AWS MWS Key',
    pattern: /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    severity: 'critical',
    description: 'AWS Marketplace Web Service key detected',
    recommendation: 'Store MWS keys in secure configuration management.',
    category: 'api_key',
  },

  // GitHub
  {
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub Personal Access Token detected',
    recommendation:
      'Use GitHub Actions secrets or environment variables. Revoke and regenerate this token.',
    category: 'token',
  },
  {
    name: 'GitHub OAuth Access Token',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub OAuth Access Token detected',
    recommendation: 'Store OAuth tokens in secure secret management systems.',
    category: 'token',
  },
  {
    name: 'GitHub App Token',
    pattern: /(?:ghu|ghs)_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub App Token detected',
    recommendation: 'Use environment variables for GitHub App tokens.',
    category: 'token',
  },
  {
    name: 'GitHub Refresh Token',
    pattern: /ghr_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub Refresh Token detected',
    recommendation: 'Never hardcode refresh tokens. Use secure storage.',
    category: 'token',
  },

  // Google/GCP
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: 'high',
    description: 'Google API Key detected',
    recommendation: 'Restrict API key usage in Google Cloud Console. Use environment variables.',
    category: 'api_key',
  },
  {
    name: 'Google OAuth Client ID',
    pattern: /[0-9]+-[a-z0-9_]{32}\.apps\.googleusercontent\.com/gi,
    severity: 'medium',
    description: 'Google OAuth Client ID detected',
    recommendation: 'Client IDs are less sensitive but should still be configured externally.',
    category: 'credential',
  },
  {
    name: 'Firebase Cloud Messaging',
    pattern: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g,
    severity: 'high',
    description: 'Firebase Cloud Messaging server key detected',
    recommendation: 'Store FCM keys in secure configuration. Rotate immediately if exposed.',
    category: 'api_key',
  },

  // Azure
  {
    name: 'Azure Storage Account Key',
    pattern: /[a-zA-Z0-9+/]{86}==/g,
    severity: 'critical',
    description: 'Potential Azure Storage Account Key detected',
    recommendation: 'Use Azure Key Vault for storage account keys.',
    category: 'api_key',
  },
  {
    name: 'Azure Service Bus Connection String',
    pattern: /Endpoint=sb:\/\/[^;]+;SharedAccessKeyName=[^;]+;SharedAccessKey=[^;]+/gi,
    severity: 'critical',
    description: 'Azure Service Bus connection string detected',
    recommendation: 'Store connection strings in Azure Key Vault or environment variables.',
    category: 'connection_string',
  },

  // Stripe
  {
    name: 'Stripe API Key',
    pattern: /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
    description: 'Stripe API Key detected',
    recommendation:
      'Use environment variables for Stripe keys. Rotate live keys immediately if exposed.',
    category: 'api_key',
  },
  {
    name: 'Stripe Restricted Key',
    pattern: /rk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
    description: 'Stripe Restricted API Key detected',
    recommendation: 'Store Stripe keys in secure configuration management.',
    category: 'api_key',
  },

  // Slack
  {
    name: 'Slack Bot Token',
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: 'high',
    description: 'Slack Bot Token detected',
    recommendation: 'Use environment variables for Slack tokens.',
    category: 'token',
  },
  {
    name: 'Slack User Token',
    pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: 'high',
    description: 'Slack User Token detected',
    recommendation: 'Never hardcode user tokens. Use OAuth flow with secure storage.',
    category: 'token',
  },
  {
    name: 'Slack Webhook URL',
    pattern:
      /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
    severity: 'medium',
    description: 'Slack Webhook URL detected',
    recommendation: 'Store webhook URLs in environment variables.',
    category: 'token',
  },

  // Database Connection Strings
  {
    name: 'MySQL Connection String',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+\/[^\s'"]+/gi,
    severity: 'critical',
    description: 'MySQL connection string with credentials detected',
    recommendation: 'Use environment variables or secret management for database credentials.',
    category: 'connection_string',
  },
  {
    name: 'PostgreSQL Connection String',
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^\s'"]+/gi,
    severity: 'critical',
    description: 'PostgreSQL connection string with credentials detected',
    recommendation: 'Use environment variables or secret management for database credentials.',
    category: 'connection_string',
  },
  {
    name: 'MongoDB Connection String',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+(?:\/[^\s'"]*)?/gi,
    severity: 'critical',
    description: 'MongoDB connection string with credentials detected',
    recommendation: 'Use environment variables or secret management for database credentials.',
    category: 'connection_string',
  },
  {
    name: 'Redis Connection String',
    pattern: /redis:\/\/[^:]*:[^@]+@[^/]+(?::[0-9]+)?(?:\/[0-9]+)?/gi,
    severity: 'critical',
    description: 'Redis connection string with credentials detected',
    recommendation: 'Use environment variables for Redis credentials.',
    category: 'connection_string',
  },

  // Private Keys
  {
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'RSA Private Key header detected',
    recommendation: 'Never commit private keys. Use secure key management systems.',
    category: 'private_key',
  },
  {
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'OpenSSH Private Key detected',
    recommendation: 'Never commit SSH keys. Use SSH agent or secure key storage.',
    category: 'private_key',
  },
  {
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'EC Private Key detected',
    recommendation: 'Never commit private keys. Use secure key management.',
    category: 'private_key',
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: 'critical',
    description: 'PGP Private Key Block detected',
    recommendation: 'Never commit PGP private keys. Use secure key storage.',
    category: 'private_key',
  },

  // JWT and Auth Tokens
  {
    name: 'JSON Web Token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'high',
    description: 'JSON Web Token (JWT) detected',
    recommendation:
      'JWTs should be generated dynamically, not hardcoded. Check if this is a test token.',
    category: 'token',
  },
  {
    name: 'Bearer Token',
    pattern: /(?:bearer|authorization)\s*[:=]\s*['"][a-zA-Z0-9_.-]+['"]/gi,
    severity: 'high',
    description: 'Bearer/Authorization token detected',
    recommendation: 'Use environment variables for authentication tokens.',
    category: 'token',
  },

  // Generic Patterns
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    severity: 'high',
    description: 'Generic API key pattern detected',
    recommendation: 'Store API keys in environment variables or secret management systems.',
    category: 'api_key',
  },
  {
    name: 'Generic Secret',
    pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'high',
    description: 'Hardcoded secret or password detected',
    recommendation: 'Never hardcode passwords. Use environment variables or secret management.',
    category: 'credential',
  },
  {
    name: 'Generic Token',
    pattern: /(?:access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    severity: 'high',
    description: 'Hardcoded access/auth token detected',
    recommendation: 'Store tokens in secure configuration or use OAuth flows.',
    category: 'token',
  },
  {
    name: 'Private Key Variable',
    pattern: /(?:private[_-]?key)\s*[:=]\s*['"][^'"]{20,}['"]/gi,
    severity: 'critical',
    description: 'Private key value in variable detected',
    recommendation: 'Load private keys from secure storage, not hardcoded values.',
    category: 'private_key',
  },

  // Twilio
  {
    name: 'Twilio API Key',
    pattern: /SK[0-9a-fA-F]{32}/g,
    severity: 'high',
    description: 'Twilio API Key detected',
    recommendation: 'Store Twilio credentials in environment variables.',
    category: 'api_key',
  },
  {
    name: 'Twilio Account SID',
    pattern: /AC[a-zA-Z0-9_-]{32}/g,
    severity: 'medium',
    description: 'Twilio Account SID detected',
    recommendation: 'While less sensitive, consider using environment variables.',
    category: 'credential',
  },

  // SendGrid
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: 'high',
    description: 'SendGrid API Key detected',
    recommendation: 'Store SendGrid keys in environment variables.',
    category: 'api_key',
  },

  // NPM
  {
    name: 'NPM Token',
    pattern: /npm_[a-zA-Z0-9]{36}/g,
    severity: 'high',
    description: 'NPM access token detected',
    recommendation: 'Use npm config or environment variables for NPM tokens.',
    category: 'token',
  },

  // Heroku
  {
    name: 'Heroku API Key',
    pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    severity: 'medium',
    description: 'Potential Heroku API Key (UUID format) detected',
    recommendation: 'Use Heroku CLI authentication or environment variables.',
    category: 'api_key',
  },

  // Mailchimp
  {
    name: 'Mailchimp API Key',
    pattern: /[a-f0-9]{32}-us[0-9]{1,2}/g,
    severity: 'high',
    description: 'Mailchimp API Key detected',
    recommendation: 'Store Mailchimp keys in environment variables.',
    category: 'api_key',
  },

  // Square
  {
    name: 'Square Access Token',
    pattern: /sq0atp-[0-9A-Za-z\-_]{22}/g,
    severity: 'critical',
    description: 'Square Access Token detected',
    recommendation: 'Use environment variables for Square credentials.',
    category: 'token',
  },
  {
    name: 'Square OAuth Secret',
    pattern: /sq0csp-[0-9A-Za-z\-_]{43}/g,
    severity: 'critical',
    description: 'Square OAuth Secret detected',
    recommendation: 'Store OAuth secrets in secure configuration.',
    category: 'credential',
  },

  // PayPal
  {
    name: 'PayPal Braintree Token',
    pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g,
    severity: 'critical',
    description: 'PayPal/Braintree Access Token detected',
    recommendation: 'Use environment variables for payment credentials.',
    category: 'token',
  },

  // Discord
  {
    name: 'Discord Bot Token',
    pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
    severity: 'high',
    description: 'Discord Bot Token detected',
    recommendation: 'Store Discord tokens in environment variables.',
    category: 'token',
  },
  {
    name: 'Discord Webhook URL',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/g,
    severity: 'medium',
    description: 'Discord Webhook URL detected',
    recommendation: 'Store webhook URLs in environment variables.',
    category: 'token',
  },

  // Telegram
  {
    name: 'Telegram Bot Token',
    pattern: /[0-9]+:AA[0-9A-Za-z\-_]{33}/g,
    severity: 'high',
    description: 'Telegram Bot Token detected',
    recommendation: 'Use environment variables for bot tokens.',
    category: 'token',
  },
];

/**
 * Secret Scanner Service
 */
export class SecretScanner {
  private patterns: SecretPattern[];
  private excludeRegexes: RegExp[];

  constructor(
    private config: SecretScannerConfig,
    private logger: Logger
  ) {
    this.patterns = this.initializePatterns();
    this.excludeRegexes = this.initializeExcludePatterns(config.excludePatterns ?? []);
  }

  /**
   * Initialize exclude patterns with validation
   */
  private initializeExcludePatterns(patterns: string[]): RegExp[] {
    const regexes: RegExp[] = [];

    for (const pattern of patterns) {
      try {
        regexes.push(new RegExp(pattern, 'gi'));
      } catch (error) {
        this.logger.warn(
          { pattern, error: (error as Error).message },
          'Invalid exclude pattern, skipping'
        );
      }
    }

    return regexes;
  }

  /**
   * Initialize patterns based on configuration
   */
  private initializePatterns(): SecretPattern[] {
    const patterns: SecretPattern[] = [];
    const patternConfig = this.config.patterns ?? {
      aws: true,
      gcp: true,
      azure: true,
      github: true,
      generic: true,
      database: true,
      privateKeys: true,
    };

    // Add default patterns based on config
    for (const pattern of DEFAULT_PATTERNS) {
      const shouldInclude = this.shouldIncludePattern(pattern, patternConfig);
      if (shouldInclude) {
        patterns.push(pattern);
      }
    }

    // Add custom patterns with global flag enforcement
    if (this.config.customPatterns) {
      for (const customPattern of this.config.customPatterns) {
        // Ensure custom patterns have global flag to prevent infinite loops
        const flags = customPattern.pattern.flags;
        if (!flags.includes('g')) {
          const normalizedPattern: SecretPattern = {
            ...customPattern,
            pattern: new RegExp(customPattern.pattern.source, flags + 'g'),
          };
          patterns.push(normalizedPattern);
          this.logger.debug(
            { patternName: customPattern.name },
            'Added global flag to custom pattern'
          );
        } else {
          patterns.push(customPattern);
        }
      }
    }

    this.logger.debug({ patternCount: patterns.length }, 'Secret scanner patterns initialized');

    return patterns;
  }

  /**
   * Check if pattern should be included based on config
   */
  private shouldIncludePattern(
    pattern: SecretPattern,
    config: NonNullable<SecretScannerConfig['patterns']>
  ): boolean {
    const name = pattern.name.toLowerCase();

    if (name.includes('aws') && !config.aws) return false;
    if (
      (name.includes('google') || name.includes('gcp') || name.includes('firebase')) &&
      !config.gcp
    )
      return false;
    if (name.includes('azure') && !config.azure) return false;
    if (name.includes('github') && !config.github) return false;
    if (pattern.category === 'connection_string' && !config.database) return false;
    if (pattern.category === 'private_key' && !config.privateKeys) return false;

    // Generic patterns
    if (
      (name.includes('generic') ||
        name.includes('jwt') ||
        name.includes('bearer') ||
        name.includes('slack') ||
        name.includes('stripe') ||
        name.includes('twilio') ||
        name.includes('sendgrid') ||
        name.includes('npm') ||
        name.includes('discord') ||
        name.includes('telegram')) &&
      !config.generic
    ) {
      return false;
    }

    return true;
  }

  /**
   * Scan code for secrets
   */
  scan(code: string, fileName?: string): SecretFinding[] {
    if (!this.config.enabled) {
      return [];
    }

    // Check if file should be excluded
    if (fileName && this.shouldExcludeFile(fileName)) {
      this.logger.debug({ fileName }, 'File excluded from secret scanning');
      return [];
    }

    const findings: SecretFinding[] = [];

    const maxScanLength = this.config.maxScanLength ?? 200000;
    let scanCode = code;
    if (scanCode.length > maxScanLength) {
      scanCode = scanCode.substring(0, maxScanLength);
      this.logger.debug(
        { fileName, originalLength: code.length, maxScanLength },
        'Secret scanning input truncated for performance'
      );
    }

    const lines = scanCode.split('\n');

    // ReDoS protection: max line length to prevent catastrophic backtracking
    const maxLineLength = this.config.maxLineLength ?? 10000;

    for (const pattern of this.patterns) {
      try {
        // Reset regex lastIndex for global patterns (inside try for safety)
        if (!(pattern.pattern instanceof RegExp)) {
          this.logger.warn({ patternName: pattern.name }, 'Invalid pattern object, skipping');
          continue;
        }
        pattern.pattern.lastIndex = 0;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          let line = lines[lineIndex];
          if (!line) continue;

          // ReDoS protection: truncate extremely long lines
          if (line.length > maxLineLength) {
            line = line.substring(0, maxLineLength);
            this.logger.debug(
              { lineIndex: lineIndex + 1, originalLength: lines[lineIndex]?.length },
              'Line truncated for ReDoS protection'
            );
          }

          // Skip comment lines (basic detection)
          const trimmedLine = line.trim();
          if (
            trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('#') ||
            trimmedLine.startsWith('*') ||
            trimmedLine.startsWith('/*')
          ) {
            // Still scan, but we could add a flag for "in comment"
          }

          // Reset for each line when using global flag
          pattern.pattern.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = pattern.pattern.exec(line)) !== null) {
            // Check for false positives
            if (this.isFalsePositive(match[0], line, pattern)) {
              continue;
            }

            findings.push({
              type: 'security',
              secretType: pattern.name,
              category: pattern.category,
              severity: pattern.severity,
              line: lineIndex + 1,
              column: match.index + 1, // 1-based column index
              match: this.maskSecret(match[0]),
              description: pattern.description,
              recommendation: pattern.recommendation,
            });
          }
        }
      } catch (error) {
        // Per-pattern error handling - continue with other patterns
        this.logger.warn(
          { patternName: pattern.name, error: (error as Error).message },
          'Error scanning with pattern, skipping'
        );
      }
    }

    this.logger.info({ findingCount: findings.length, fileName }, 'Secret scanning completed');

    return findings;
  }

  /**
   * Check if file should be excluded from scanning
   */
  private shouldExcludeFile(fileName: string): boolean {
    for (const regex of this.excludeRegexes) {
      regex.lastIndex = 0;
      if (regex.test(fileName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for common false positives
   */
  private isFalsePositive(match: string, line: string, pattern: SecretPattern): boolean {
    const lowerLine = line.toLowerCase();
    const lowerMatch = match.toLowerCase();

    // Skip example/placeholder values
    const placeholders = [
      'your_',
      'example',
      'placeholder',
      'xxx',
      'yyy',
      'zzz',
      'test',
      'dummy',
      'sample',
      'changeme',
      'replace',
      '<your',
      '{your',
      '${',
      'process.env',
      'env.',
      'config.',
      'settings.',
    ];

    for (const placeholder of placeholders) {
      if (lowerLine.includes(placeholder) || lowerMatch.includes(placeholder)) {
        return true;
      }
    }

    // Skip if it's a variable reference, not an actual value
    if (lowerLine.includes('process.env') || lowerLine.includes('env[')) {
      return true;
    }

    // For generic patterns, require more context
    if (pattern.name.startsWith('Generic')) {
      // Skip if the "secret" is too short or looks like a code identifier
      if (match.length < 16) {
        return true;
      }
    }

    // Skip Heroku-like UUID if it's not in a sensitive context
    if (pattern.name === 'Heroku API Key') {
      const sensitiveContext = ['heroku', 'api', 'key', 'token', 'secret', 'auth'];
      const hasContext = sensitiveContext.some(ctx => lowerLine.includes(ctx));
      if (!hasContext) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mask secret value for safe display
   * Reveals minimal information to prevent secret reconstruction
   */
  private maskSecret(secret: string): string {
    const length = secret.length;

    if (length <= 4) {
      return '***';
    }
    if (length <= 12) {
      // Show only first char and length indicator
      return secret.slice(0, 1) + '***[' + length + ' chars]';
    }
    // For longer secrets, show minimal prefix only
    return secret.slice(0, 2) + '***[' + length + ' chars]';
  }

  /**
   * Convert secret findings to analysis findings format
   * Includes input validation for safety
   */
  toAnalysisFindings(secretFindings: SecretFinding[]): AnalysisFinding[] {
    if (!Array.isArray(secretFindings)) {
      this.logger.warn('Invalid input to toAnalysisFindings: expected array');
      return [];
    }

    return secretFindings
      .filter(finding => {
        // Validate required fields - log only non-sensitive metadata
        if (!finding || typeof finding !== 'object') {
          this.logger.warn('Invalid finding object (not an object), skipping');
          return false;
        }
        if (!finding.secretType || !finding.severity || typeof finding.line !== 'number') {
          this.logger.warn(
            {
              secretType: finding.secretType || 'unknown',
              severity: finding.severity || 'unknown',
              line: finding.line,
            },
            'Finding missing required fields, skipping'
          );
          return false;
        }
        return true;
      })
      .map(finding => ({
        type: 'security' as const,
        severity: finding.severity,
        line: finding.line,
        title: `Hardcoded ${finding.secretType}`,
        description: `${finding.description || 'Secret detected'}\n\nDetected value: \`${finding.match || '***'}\` at column ${finding.column || 1}`,
        suggestion:
          finding.recommendation || 'Remove hardcoded secret and use environment variables',
      }));
  }

  /**
   * Get scanner statistics
   */
  getStats(): { patternCount: number; categories: string[] } {
    const categories = [...new Set(this.patterns.map(p => p.category))];
    return {
      patternCount: this.patterns.length,
      categories,
    };
  }
}

export { DEFAULT_PATTERNS };
