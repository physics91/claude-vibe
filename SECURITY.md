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
