---
name: kotlin-lsp
description: |
  WHEN: JetBrains Kotlin LSP (K2) setup, IntelliJ LSP Support/LSP4IJ client configuration, Kotlin LSP troubleshooting, or IntelliJ language-server wiring.
  WHAT: Locate/install Kotlin LSP, configure IntelliJ LSP client, validate server handshake, and debug startup/diagnostics issues end-to-end.
  WHEN NOT: Kotlin code review only -> kotlin-android-reviewer or kotlin-spring-reviewer; general Kotlin language questions -> Kotlin docs.
---
# Kotlin LSP (JetBrains) Skill

## Purpose
Provide a repeatable workflow to install JetBrains Kotlin LSP, connect it to IntelliJ via LSP4IJ (LSP Support plugin), and troubleshoot issues.

## When to Use
- Setting up JetBrains Kotlin LSP (K2)
- Wiring Kotlin LSP to IntelliJ via LSP4IJ
- Investigating LSP startup/diagnostics/completion issues
- Verifying project compatibility and file mapping

## Environment Detection
- IntelliJ IDEA in use
- LSP4IJ (LSP Support) plugin installed
- Kotlin Gradle project or folder with `.kt`/`.kts` files

## Workflow

### Step 1: Gather inputs
Ask for:
- OS (macOS, Linux, Windows)
- IntelliJ version and edition
- Project type (JVM-only Gradle, KMP, Android, other)
- Install method (Homebrew vs manual)
- File extensions to map (.kt, .kts)

### Step 2: Install or locate Kotlin LSP
Prefer official install instructions and record the exact server binary path.

**Homebrew (macOS/Linux):**
```bash
brew install JetBrains/utils/kotlin-lsp
```

**Manual install (all OSes):**
1. Download the latest release zip for your OS.
2. Unzip it to a stable location.
3. Make the launcher executable (if needed) and add it to PATH.
4. Verify:
```bash
kotlin-lsp --help
```

Confirm Java runtime (capture for troubleshooting):
```bash
java -version
```

### Step 3: Configure IntelliJ as an LSP client (LSP4IJ)
1. Install the **LSP Support / LSP4IJ** plugin from the IntelliJ Marketplace.
2. Open **Settings/Preferences | Languages & Frameworks | Language Servers**.
3. Click **+** to add a new Language Server.
4. In the **Server** tab, set:
   - **Name**: Kotlin LSP
   - **Command**: Absolute path to `kotlin-lsp` (add `--stdio` if listed in `--help`)
   - **File name patterns**: `*.kt` (and `*.kts` if you need Kotlin scripts)
5. If you rely on environment variables, wrap the command:
   - **Windows**: `cmd /c <command>`
   - **macOS/Linux**: `sh -c <command>`

### Step 4: Validate
1. Open a Kotlin file in the target project.
2. Open **Tools | LSP Console** and confirm the server starts.
3. Verify basic features (diagnostics, completion, go-to-definition).

### Step 5: Troubleshoot
- **Server fails to start**: Re-check Java runtime requirements, PATH, and the exact command IntelliJ runs. Test the command in a terminal.
- **No diagnostics**: Ensure the client supports pull diagnostics and the plugin is up to date.
- **Project not recognized**: Try a JVM-only Kotlin Gradle sample; KMP/Android may have limited support.
- **Wrong files attached**: Verify the file name pattern mapping (`*.kt`, `*.kts`).
- **Logs needed**: Use **Tools | LSP Console** and Language Servers settings to capture startup logs.

**IntelliJ-specific issues**
- **LSP4IJ not loading**: Confirm the plugin is enabled and the IDE has restarted after install.
- **Conflicting language features**: Temporarily disable overlapping plugins to isolate LSP4IJ behavior, then re-enable one by one.
- **Gradle sync stalled**: Re-sync Gradle and ensure the project JDK matches the runtime used by Kotlin LSP.
- **Indexing never completes**: Close unused projects, invalidate caches, and restart.
- **No file association**: Re-check Language Server file pattern mappings for `*.kt` and `*.kts`.

## AskUserQuestion prompts
Use these when details are missing:
```
AskUserQuestion: "Which OS are you on and how did you install Kotlin LSP?"
Options:
- macOS + Homebrew
- macOS + manual
- Linux + manual
- Windows + manual
```

```
AskUserQuestion: "What project type are you opening in IntelliJ?"
Options:
- JVM-only Kotlin (Gradle)
- Kotlin Multiplatform (KMP)
- Android (Gradle)
- Other
```

## Response Template
```
## Kotlin LSP Setup/Triage

**IDE**: IntelliJ IDEA [version]
**Project**: [name/path]
**Server**: JetBrains Kotlin LSP (K2)
**Install**: [brew/manual]

### Checks
- [x] Kotlin LSP binary resolves
- [x] LSP4IJ installed
- [ ] File mapping (*.kt/*.kts)
- [ ] LSP Console handshake

### Findings
| Severity | Area | Detail |
|----------|------|--------|
| MEDIUM | Startup | Missing Java runtime on PATH |

### Next Actions
1. [ ] Fix Java runtime and retest `kotlin-lsp --help`
2. [ ] Update LSP4IJ plugin and restart IntelliJ
3. [ ] Re-open project and verify diagnostics
```

## Output checklist
- [ ] Confirm Java runtime requirement
- [ ] Confirm Kotlin LSP binary resolves
- [ ] Configure LSP4IJ Language Server
- [ ] Map .kt (and .kts if needed)
- [ ] Validate in LSP Console
- [ ] Explain limitations for KMP/Android

## Best Practices
1. **Version alignment**: Keep Kotlin LSP and IntelliJ/LSP4IJ up to date.
2. **Repro steps**: Always capture the exact command IntelliJ runs.
3. **Minimal repro**: Validate in a fresh JVM-only Gradle sample when debugging.
4. **Logs first**: Use LSP Console before changing project settings.

## Integration
- `code-reviewer` skill: General Kotlin code review
- `kotlin-android-reviewer` skill: Android-specific Kotlin review
- `kotlin-spring-reviewer` skill: Backend Kotlin review

## Notes
- Kotlin LSP evolves quickly; check official release notes for current requirements and limitations.
