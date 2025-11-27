# Security Policy

## Threat Model

claude-vibe operates as a **local-user-tool**, meaning it runs in a trusted developer environment where the user has full control over inputs and execution context.

### Trust Boundaries

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| User's config files (`~/.claude/`) | Trusted | User-controlled configuration |
| Project files in working directory | Semi-trusted | May contain untrusted code from cloned repos |
| Preset files (built-in) | Trusted | Shipped with the plugin |
| User-created presets | Trusted | Created by the user |
| External dependencies (pom.xml, package.json) | Untrusted | May come from third-party sources |

### Severity Guidelines

For this local-user-tool context:

- **HIGH**: Remote code execution, credential theft without user action
- **MEDIUM**: Attacks requiring user to clone/open malicious project
- **LOW**: Attacks requiring pre-existing system compromise

### Known Security Considerations

#### XML External Entity (XXE) Prevention

XML files like `pom.xml` are parsed with secure settings:
- DTD processing is disabled (`DtdProcessing::Prohibit`)
- External entity resolution is disabled (`XmlResolver = $null`)

This prevents XXE attacks when analyzing untrusted Maven projects.

#### Path Traversal Prevention

User-provided preset names are sanitized:
- Non-alphanumeric characters (except `-`) are replaced
- Path separators are stripped

#### File Operations

All file I/O operations use:
- `Set-StrictMode -Version Latest` for undefined variable detection
- `$ErrorActionPreference = 'Stop'` for proper error propagation

#### Sensitive Data Detection (v0.4.1+)

Automatic detection and redaction of secrets in cached/stored data:

| Pattern Type | Examples |
|-------------|----------|
| API Keys | `api_key=...`, `"api_key": "..."` (JSON) |
| AWS Keys | `AKIA...`, `aws_secret_access_key=...` |
| OpenAI Keys | `sk-...T3BlbkFJ...` |
| Anthropic Keys | `sk-ant-...` |
| GitHub Tokens | `ghp_...`, `gho_...`, `ghu_...` |
| JWT Tokens | `eyJ...` (base64 segments) |
| Stripe Keys | `sk_live_...`, `pk_test_...` |
| Connection Strings | `mongodb://`, `postgres://` with credentials |
| High-Entropy Secrets | 32+ hex chars in JSON values |

#### Cross-Platform Permission Hardening (v0.4.1+)

- **Windows**: ACL-based permissions (current user + SYSTEM only)
- **Unix/Linux/macOS**: `chmod 600` for files, `chmod 700` for directories
- Graceful degradation: continues without blocking if permission changes fail

#### Atomic File Writes (v0.4.1+)

Cache and context files use atomic write pattern:
1. Write to temporary file with random suffix
2. Verify temp file integrity
3. Atomic move/replace to target path
4. Cleanup temp file on failure

This prevents data corruption from interrupted writes or concurrent access

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment

We will respond within 48 hours and work on a fix promptly.

## Security Updates

Security fixes are released as patch versions and documented in CHANGELOG.md.
