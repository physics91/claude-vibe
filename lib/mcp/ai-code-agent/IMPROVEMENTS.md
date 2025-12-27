# AI Code Agent MCP - Future Improvements

This document captures the findings from the security audit, code review, and test coverage analysis conducted during the integration of ai-code-agent-mcp into the claude-vibe plugin.

## Security Audit Summary (Rating: B+)

### Fixed Issues
- **[MEDIUM] Tilde Path Expansion**: Added proper `expandPath()` method in `database.ts` to safely expand `~` paths to user home directory.

### Remaining Low-Severity Items

1. **[LOW] Environment Variable CLI Path Injection Risk**
   - Location: `src/services/codex/client.ts`, `src/services/gemini/client.ts`
   - The `validateCLIPath` method provides good mitigation, but consider validating env paths against allowed patterns.

2. **[LOW] SQLite Database Not Encrypted**
   - Location: `src/storage/database.ts`
   - Cached analysis results are stored in plaintext. Consider `better-sqlite3-multiple-ciphers` for encryption.

3. **[LOW] ReDoS Pattern Risk**
   - Location: `src/services/scanner/secrets.ts`
   - Line length limit (10000) provides protection, but could be reduced to 2000 for additional safety.

4. **[LOW] CLI Arguments Not Fully Sanitized**
   - The `shell: false` in execa prevents injection, but additional value validation could be added.

### Positive Security Findings
- Strong input validation with Zod schemas
- CLI path whitelisting with security logging
- No shell injection (`shell: false` with execa)
- Secret detection with proper masking
- Log sanitization for sensitive data
- 0 known vulnerable dependencies

---

## Code Quality Review Summary

### Critical DRY Violations (~700 lines duplicated)

1. **CodexService/GeminiService Duplication** (~300 lines)
   - Both services contain near-identical implementations
   - `BaseAnalysisService` exists but is NOT USED
   - **Fix**: Extract common methods to base class:
     - CLI validation logic
     - Context system integration
     - Error handling wrapper
     - Summary calculation
     - Severity filtering

2. **Config Merging Duplication** (~100 lines)
   - `config.ts` lines 71-174 have repetitive merge patterns
   - **Fix**: Implement generic `deepMerge<T>()` utility

3. **ToolRegistry Handler Duplication** (~100 lines)
   - `handleCodexAnalysis` and `handleGeminiAnalysis` are 95% identical
   - **Fix**: Extract generic `executeAnalysis()` method

### SOLID Violations

1. **ToolRegistry SRP Violation** (1028 lines)
   - Multiple responsibilities: registration, handling, caching, formatting, scanning
   - **Fix**: Extract to separate classes:
     - `AnalysisRequestHandler`
     - `CombinedAnalysisOrchestrator`
     - `ResultFormatter`
     - `CacheKeyGenerator`

### TypeScript Issues
- Unsafe `unknown` casting in parsing logic
- **Fix**: Use proper Zod validation FIRST before any data access

### Configuration SSOT Violation
- Duplicate settings: `server.logLevel` vs `logging.level`
- **Fix**: Single source of truth for each setting

---

## Test Coverage Analysis

### Current Coverage: ~5-10%
The existing tests only check file existence and structure, not actual functionality.

### Critical Missing Tests (Priority 1)

1. **ToolRegistry Unit Tests** (20+ tests needed)
   - Input validation
   - Error handling
   - Cache integration
   - Secret scanning integration

2. **SecretScanner Unit Tests** (15+ tests needed)
   - Pattern detection for 40+ secret types
   - False positive filtering
   - ReDoS protection

3. **Service Unit Tests** (30+ tests each)
   - CLI execution and parsing
   - Context system integration
   - Error classification

4. **Aggregator Unit Tests** (15+ tests needed)
   - Finding deduplication
   - Confidence calculation
   - Similarity algorithms

### Missing Integration Tests

- MCP tool execution flow
- Cache persistence
- Database integration
- CLI integration (with mocks)

### Missing E2E Tests

- `/cr` command execution
- Preset integration
- Error recovery scenarios

### Recommended Test Infrastructure

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "fast-check": "^3.15.0"
  }
}
```

### Coverage Goals
- Global: 80%
- Tools path: 90%
- Scanner path: 85%

---

## Implementation Roadmap

### Phase 1: Critical Unit Tests (Week 1-2)
- Tool registry validation
- Secret scanner patterns
- CLI security tests
- Error handling

### Phase 2: DRY Refactoring (Week 3-4)
- Extract BaseAnalysisService usage
- Create generic deepMerge utility
- Refactor ToolRegistry handlers

### Phase 3: SOLID Compliance (Week 5-6)
- Split ToolRegistry into focused classes
- Implement proper type guards

### Phase 4: Test Coverage (Week 7-10)
- Integration tests
- E2E tests
- Achieve 80%+ coverage

---

## Source Information

- **Original Repository**: https://github.com/physics91/ai-code-review-mcp.git
- **Version**: 1.3.0
- **Integration Date**: 2025-12-27
- **Token Estimate**: 6,000 tokens

---

## Files Modified During Integration

| File | Status | Notes |
|------|--------|-------|
| `lib/mcp/ai-code-agent/src/storage/database.ts` | Modified | Added tilde expansion |
| `lib/mcp/ai-code-agent/package.json` | Modified | Internal package name |
| `lib/mcp/ai-code-agent/config/default.json` | Modified | Plugin-relative paths |
| `skills/ai-code-reviewer/SKILL.md` | Created | New skill |
| `commands/cr.md` | Created | New command |
| `schemas/mcp-config.schema.json` | Created | Schema validation |
| `scripts/build-mcp.ps1` | Created | Build script |
| `scripts/build-mcp.sh` | Created | Build script |
| `presets/*.json` (8 files) | Modified | Added ai-code-agent-mcp |
