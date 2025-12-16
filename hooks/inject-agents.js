#!/usr/bin/env node
/**
 * inject-agents.js
 *
 * SessionStart hook that re-injects AGENTS.md content after context compaction.
 * This solves the known issue where AGENTS.md instructions are lost during
 * auto-compact (GitHub Issue #4017).
 *
 * @author physics91
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Maximum size for AGENTS.md content (100KB per file)
const MAX_FILE_SIZE = 100 * 1024;

// Maximum total context size (500KB)
const MAX_TOTAL_BYTES = 500 * 1024;

// Maximum number of AGENTS.md files to process
const MAX_FILES = 20;

/**
 * Get platform-specific home directory
 * @returns {string} Home directory path
 */
function getHomeDir() {
  return os.homedir();
}

/**
 * Find and read all AGENTS.md files
 * @param {string} cwd - Current working directory
 * @returns {Array<{type: string, path: string, content: string}>}
 */
function findAgentsMd(cwd) {
  const files = [];

  // 1. Global AGENTS.md (~/.claude/AGENTS.md)
  const globalPath = path.join(getHomeDir(), '.claude', 'AGENTS.md');
  const globalContent = readFileSafe(globalPath);
  if (globalContent) {
    files.push({
      type: 'global',
      path: globalPath,
      content: globalContent
    });
  }

  // 2. Project AGENTS.md (in cwd)
  const projectPath = path.join(cwd, 'AGENTS.md');
  const projectContent = readFileSafe(projectPath);
  if (projectContent) {
    files.push({
      type: 'project',
      path: projectPath,
      content: projectContent
    });
  }

  // 3. Search for local AGENTS.md in subdirectories (max depth 2)
  const localFiles = findLocalAgentsMd(cwd, 2);
  files.push(...localFiles);

  return files;
}

/**
 * Safely read a file with size limit (memory-safe)
 * @param {string} filePath - Path to file
 * @returns {string|null} File content or null if not found/error
 */
function readFileSafe(filePath) {
  try {
    // Normalize path to prevent traversal
    const normalized = path.normalize(path.resolve(filePath));

    if (!fs.existsSync(normalized)) {
      return null;
    }

    // Use lstatSync to detect symlinks (statSync follows symlinks)
    const stats = fs.lstatSync(normalized);

    // Skip symlinks for security
    if (stats.isSymbolicLink()) {
      return null;
    }

    // Memory-safe reading for large files
    if (stats.size > MAX_FILE_SIZE) {
      const buffer = Buffer.alloc(MAX_FILE_SIZE);
      const fd = fs.openSync(normalized, 'r');
      try {
        const bytesRead = fs.readSync(fd, buffer, 0, MAX_FILE_SIZE, 0);
        return buffer.toString('utf-8', 0, bytesRead) +
               '\n\n[... truncated due to size limit ...]';
      } finally {
        fs.closeSync(fd);
      }
    }

    return fs.readFileSync(normalized, 'utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * Find local AGENTS.md files in subdirectories
 * @param {string} baseDir - Base directory to search
 * @param {number} maxDepth - Maximum search depth
 * @returns {Array<{type: string, path: string, content: string}>}
 */
function findLocalAgentsMd(baseDir, maxDepth) {
  const files = [];
  const blockedDirs = new Set([
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    '.pytest_cache', 'dist', 'build', '.next', 'coverage',
    'target', 'vendor', '.idea', '.vscode', 'out', 'bin', 'obj'
  ]);

  function search(dir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (blockedDirs.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        const subDir = path.join(dir, entry.name);
        const agentsPath = path.join(subDir, 'AGENTS.md');

        const content = readFileSafe(agentsPath);
        if (content) {
          files.push({
            type: 'local',
            path: agentsPath,
            content: content
          });
        }

        // Recurse
        search(subDir, depth + 1);
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  search(baseDir, 1);
  return files;
}

/**
 * Build context string from AGENTS.md files with size limits
 * @param {Array} files - Array of file objects
 * @returns {string} Formatted context string
 */
function buildContext(files) {
  if (files.length === 0) {
    return '';
  }

  let context = '## AGENTS.md Instructions (Re-injected after compact)\n\n';
  context += '> These instructions were automatically re-injected to ensure they are preserved after context compaction.\n\n';

  let totalBytes = Buffer.byteLength(context, 'utf-8');
  let filesIncluded = 0;
  let filesTruncated = 0;
  let filesSkipped = 0;

  for (const file of files) {
    // Check file count limit
    if (filesIncluded >= MAX_FILES) {
      filesSkipped++;
      continue;
    }

    const typeLabel = file.type.charAt(0).toUpperCase() + file.type.slice(1);
    let section = `### ${typeLabel} AGENTS.md\n`;
    section += `> Source: \`${file.path}\`\n\n`;
    section += file.content;
    section += '\n\n---\n\n';

    const sectionBytes = Buffer.byteLength(section, 'utf-8');

    // Check total size limit
    if (totalBytes + sectionBytes > MAX_TOTAL_BYTES) {
      // Try to include partial content
      const remainingBytes = MAX_TOTAL_BYTES - totalBytes - 200; // Reserve space for truncation notice
      if (remainingBytes > 500) {
        const partialContent = file.content.substring(0, remainingBytes);
        section = `### ${typeLabel} AGENTS.md\n`;
        section += `> Source: \`${file.path}\`\n\n`;
        section += partialContent;
        section += '\n\n[... truncated due to total size limit ...]\n\n---\n\n';
        context += section;
        filesTruncated++;
      }
      filesSkipped += files.length - filesIncluded - 1;
      break;
    }

    context += section;
    totalBytes += sectionBytes;
    filesIncluded++;
  }

  // Add summary if files were skipped or truncated
  if (filesSkipped > 0 || filesTruncated > 0) {
    context += `\n> Note: ${filesIncluded} file(s) included`;
    if (filesTruncated > 0) context += `, ${filesTruncated} truncated`;
    if (filesSkipped > 0) context += `, ${filesSkipped} skipped due to limits`;
    context += '.\n';
  }

  return context.trim();
}

/**
 * Read stdin synchronously
 * @returns {string} stdin content
 */
function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch (error) {
    return '{}';
  }
}

/**
 * Main entry point
 */
function main() {
  try {
    // Read hook input from stdin
    const stdinContent = readStdin();
    let input = {};

    try {
      input = JSON.parse(stdinContent);
    } catch (e) {
      // Invalid JSON, use empty object
    }

    // Get current working directory from input or fallback
    const cwd = input.cwd || process.cwd();

    // Find all AGENTS.md files
    const agentsFiles = findAgentsMd(cwd);

    // If no AGENTS.md files found, exit silently
    if (agentsFiles.length === 0) {
      console.log(JSON.stringify({}));
      process.exit(0);
    }

    // Build context string
    const context = buildContext(agentsFiles);

    // Output in Claude Code hook format
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);

  } catch (error) {
    // On any error, fail gracefully (no sensitive info in error messages)
    process.stderr.write('inject-agents.js: An error occurred during execution\n');
    console.log(JSON.stringify({}));
    process.exit(0);
  }
}

// Run main
main();
