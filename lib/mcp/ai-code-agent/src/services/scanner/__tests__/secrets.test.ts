/**
 * Unit tests for SecretScanner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecretScanner, type SecretScannerConfig } from '../secrets.js';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

describe('SecretScanner', () => {
  let scanner: SecretScanner;
  let defaultConfig: SecretScannerConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultConfig = {
      enabled: true,
      patterns: {
        aws: true,
        gcp: true,
        azure: true,
        github: true,
        generic: true,
        database: true,
        privateKeys: true,
      },
    };
    scanner = new SecretScanner(defaultConfig, mockLogger as any);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const scanner = new SecretScanner({ enabled: true }, mockLogger as any);
      expect(scanner).toBeDefined();
    });

    it('should initialize with custom patterns', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        customPatterns: [
          {
            name: 'Custom Token',
            pattern: /CUSTOM_[A-Z0-9]{16}/g,
            severity: 'high',
            description: 'Custom token detected',
            recommendation: 'Remove custom token',
            category: 'token',
          },
        ],
      };
      const scanner = new SecretScanner(config, mockLogger as any);
      const findings = scanner.scan('const realtoken = "CUSTOM_ABCDEF1234567890";');
      expect(findings.length).toBe(1);
      expect(findings[0].secretType).toBe('Custom Token');
    });

    it('should add global flag to custom patterns without it', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        customPatterns: [
          {
            name: 'No Global Flag',
            pattern: /NOGLOBAL_[A-Z]{8,}/i, // Missing 'g' flag, require 8+ chars
            severity: 'medium',
            description: 'Pattern detected',
            recommendation: 'Remove pattern',
            category: 'other',
          },
        ],
      };
      const scanner = new SecretScanner(config, mockLogger as any);
      // Should still work and find multiple matches
      const findings = scanner.scan('NOGLOBAL_ABCDEFGH and NOGLOBAL_IJKLMNOP');
      expect(findings.length).toBe(2);
    });
  });

  describe('scan - disabled', () => {
    it('should return empty array when disabled', () => {
      const scanner = new SecretScanner({ enabled: false }, mockLogger as any);
      const findings = scanner.scan('const key = "AKIAIOSFODNN7EXAMPLE";');
      expect(findings).toEqual([]);
    });
  });

  describe('scan - AWS patterns', () => {
    it('should detect AWS Access Key ID', () => {
      // AWS Access Key ID is exactly 20 characters: AKIA + 16 alphanumeric
      const code = 'const accessKey = "AKIAIOSFODNN7REALK01";';
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThan(0);
      const awsFinding = findings.find(f => f.secretType === 'AWS Access Key ID');
      expect(awsFinding).toBeDefined();
      expect(awsFinding?.severity).toBe('critical');
    });

    it('should detect AWS MWS Key', () => {
      const code = 'const mwsKey = "amzn.mws.12345678-1234-1234-1234-123456789012";';
      const findings = scanner.scan(code);
      const mwsFinding = findings.find(f => f.secretType === 'AWS MWS Key');
      expect(mwsFinding).toBeDefined();
    });

    it('should filter out example/placeholder AWS keys', () => {
      // "EXAMPLE" should be filtered as false positive (though this key is also wrong length)
      const code = 'const accessKey = "AKIAIOSFODNN7EXAMPLE";';
      const findings = scanner.scan(code);
      const awsFinding = findings.find(f => f.secretType === 'AWS Access Key ID');
      expect(awsFinding).toBeUndefined();
    });
  });

  describe('scan - GitHub patterns', () => {
    it('should detect GitHub Personal Access Token', () => {
      const code = 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      const ghFinding = findings.find(f => f.secretType === 'GitHub Personal Access Token');
      expect(ghFinding).toBeDefined();
      expect(ghFinding?.severity).toBe('critical');
    });

    it('should detect GitHub OAuth Token', () => {
      const code = 'const token = "gho_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      const ghFinding = findings.find(f => f.secretType === 'GitHub OAuth Access Token');
      expect(ghFinding).toBeDefined();
    });

    it('should detect GitHub App Token (ghu)', () => {
      const code = 'const token = "ghu_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      const ghFinding = findings.find(f => f.secretType === 'GitHub App Token');
      expect(ghFinding).toBeDefined();
    });

    it('should detect GitHub Refresh Token', () => {
      const code = 'const token = "ghr_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      const ghFinding = findings.find(f => f.secretType === 'GitHub Refresh Token');
      expect(ghFinding).toBeDefined();
    });
  });

  describe('scan - Google/GCP patterns', () => {
    it('should detect Google API Key', () => {
      const code = 'const apiKey = "AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe";';
      const findings = scanner.scan(code);
      const gcpFinding = findings.find(f => f.secretType === 'Google API Key');
      expect(gcpFinding).toBeDefined();
      expect(gcpFinding?.severity).toBe('high');
    });
  });

  describe('scan - Stripe patterns', () => {
    it('should filter Stripe test keys as false positive', () => {
      // "test" keyword is filtered as placeholder in the scanner
      // Both sk_test_ and rk_test_ are filtered
      const code = 'const stripeKey = "sk_test_51ABcDeFgHiJkLmNoPqRsTuVwXyZ";';
      const findings = scanner.scan(code);
      const stripeFinding = findings.find(f => f.secretType === 'Stripe API Key');
      // Should NOT be found due to "test" in the key triggering false positive filter
      expect(stripeFinding).toBeUndefined();
    });

    it('should filter Stripe restricted test keys as false positive', () => {
      // "test" keyword triggers false positive filter
      const code = 'const stripeKey = "rk_test_51ABcDeFgHiJkLmNoPqRsTuVwXyZ";';
      const findings = scanner.scan(code);
      const stripeFinding = findings.find(f => f.secretType === 'Stripe Restricted Key');
      // Should NOT be found due to "test" in the key triggering false positive filter
      expect(stripeFinding).toBeUndefined();
    });
  });

  describe('scan - Slack patterns', () => {
    it('should detect Slack Bot Token', () => {
      const code = 'const token = "xoxb-1234567890123-1234567890123-AbCdEfGhIjKl";';
      const findings = scanner.scan(code);
      const slackFinding = findings.find(f => f.secretType === 'Slack Bot Token');
      expect(slackFinding).toBeDefined();
    });

    it('should detect Slack Webhook URL', () => {
      // Note: avoid 'xxx' which is filtered as placeholder
      // Using TFAKE/BFAKE pattern to avoid GitHub push protection
      const code = 'const webhook = "https://hooks.slack.com/services/TFAKETEAM1/BFAKEBOT12/FakeWebhookToken1234";';
      const findings = scanner.scan(code);
      const slackFinding = findings.find(f => f.secretType === 'Slack Webhook URL');
      expect(slackFinding).toBeDefined();
    });
  });

  describe('scan - Generic patterns', () => {
    it('should detect hardcoded password', () => {
      const code = 'const password = "mysecretpassword123";';
      const findings = scanner.scan(code);
      const genericFinding = findings.find(f => f.secretType === 'Generic Secret');
      expect(genericFinding).toBeDefined();
    });

    it('should detect JWT token', () => {
      const code = 'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";';
      const findings = scanner.scan(code);
      const jwtFinding = findings.find(f => f.secretType === 'JSON Web Token');
      expect(jwtFinding).toBeDefined();
    });

    it('should detect private key block', () => {
      const code = `const key = \`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----\`;`;
      const findings = scanner.scan(code);
      const pkFinding = findings.find(f => f.secretType.includes('Private Key'));
      expect(pkFinding).toBeDefined();
    });
  });

  describe('scan - line and column tracking', () => {
    it('should report correct line number', () => {
      const code = `const a = 1;
const b = 2;
const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";
const c = 3;`;
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].line).toBe(3);
    });

    it('should report column number', () => {
      const code = 'const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].column).toBeGreaterThan(0);
    });
  });

  describe('scan - masking', () => {
    it('should mask detected secrets', () => {
      const code = 'const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThan(0);
      // Match should be masked (contains asterisks)
      expect(findings[0].match).toContain('*');
      // Should not contain the full token
      expect(findings[0].match).not.toBe('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890');
    });
  });

  describe('scan - file exclusion', () => {
    it('should exclude test files when configured', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        excludePatterns: ['\\.test\\.ts$', '\\.spec\\.ts$', '__tests__'],
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      const code = 'const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code, 'auth.test.ts');
      expect(findings).toEqual([]);
    });

    it('should scan non-excluded files', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        excludePatterns: ['\\.test\\.ts$'],
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      const code = 'const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code, 'auth.ts');
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('scan - pattern filtering by config', () => {
    it('should not detect AWS patterns when disabled', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        patterns: { aws: false, github: true, generic: true },
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
      const findings = scanner.scan(code);
      const awsFinding = findings.find(f => f.secretType.includes('AWS'));
      expect(awsFinding).toBeUndefined();
    });

    it('should not detect GitHub patterns when disabled', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        patterns: { aws: true, github: false, generic: true },
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      const code = 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(code);
      const ghFinding = findings.find(f => f.secretType.includes('GitHub'));
      expect(ghFinding).toBeUndefined();
    });
  });

  describe('scan - ReDoS protection', () => {
    it('should truncate extremely long lines', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        maxLineLength: 100,
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      // Create a line longer than maxLineLength with a secret at the end
      const longLine = 'a'.repeat(200) + 'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890';
      const findings = scanner.scan(longLine);
      // Secret is beyond truncation point, so it shouldn't be found
      expect(findings).toEqual([]);
    });

    it('should truncate input exceeding maxScanLength', () => {
      const config: SecretScannerConfig = {
        enabled: true,
        maxScanLength: 100,
      };
      const scanner = new SecretScanner(config, mockLogger as any);

      // Create content longer than maxScanLength with secret at the end
      const longContent = 'a'.repeat(200) + '\nconst key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const findings = scanner.scan(longContent);
      expect(findings).toEqual([]);
    });
  });

  describe('scan - multiple findings', () => {
    it('should detect multiple secrets on different lines', () => {
      // AWS Access Key ID is exactly 20 characters: AKIA + 16 alphanumeric
      // Note: Stripe keys with test/live are filtered, so we use 2 detectable secrets
      const code = `
const awsKey = "AKIAIOSFODNN7REALK01";
const ghToken = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";
const googleKey = "AIzaSyDaGmWKa4JsXZ_HjGw7ISLn_3namBGewQe";
`;
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect multiple secrets on same line', () => {
      // AWS Access Key ID is exactly 20 characters: AKIA + 16 alphanumeric
      const code = 'const keys = { aws: "AKIAIOSFODNN7REALK01", gh: "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890" };';
      const findings = scanner.scan(code);
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('toAnalysisFindings', () => {
    it('should convert secret findings to analysis findings format', () => {
      const code = 'const key = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";';
      const secretFindings = scanner.scan(code);
      const analysisFindings = scanner.toAnalysisFindings(secretFindings);

      expect(analysisFindings.length).toBe(secretFindings.length);
      expect(analysisFindings[0]).toHaveProperty('title');
      expect(analysisFindings[0]).toHaveProperty('type', 'security');
      expect(analysisFindings[0]).toHaveProperty('severity');
      expect(analysisFindings[0]).toHaveProperty('description');
      expect(analysisFindings[0]).toHaveProperty('suggestion');
    });
  });
});
