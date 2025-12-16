#!/usr/bin/env node
/**
 * session-start.js
 *
 * SessionStart hook that re-injects AGENTS.md content after context compaction.
 * This solves the known issue where AGENTS.md instructions are lost during
 * auto-compact (GitHub Issue #4017).
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  readStdinJson,
  normalizeHookInput,
  formatContextOutput,
  outputAndExit,
  errorAndExit,
  createLogger,
  FILE_LIMITS,
  BLOCKED_DIRS
} = require('./lib/core');

const { isSymlink, normalizePath } = require('./lib/utils');

const logger = createLogger('session-start');

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
    const normalized = normalizePath(filePath);

    if (!fs.existsSync(normalized)) {
      return null;
    }

    // Use lstatSync to detect symlinks
    const stats = fs.lstatSync(normalized);

    // Skip symlinks for security
    if (stats.isSymbolicLink()) {
      return null;
    }

    // Memory-safe reading for large files
    if (stats.size > FILE_LIMITS.MAX_FILE_SIZE) {
      const buffer = Buffer.alloc(FILE_LIMITS.MAX_FILE_SIZE);
      const fd = fs.openSync(normalized, 'r');
      try {
        const bytesRead = fs.readSync(fd, buffer, 0, FILE_LIMITS.MAX_FILE_SIZE, 0);
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

  function search(dir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (BLOCKED_DIRS.has(entry.name)) continue;
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
    if (filesIncluded >= FILE_LIMITS.MAX_FILES) {
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
    if (totalBytes + sectionBytes > FILE_LIMITS.MAX_TOTAL_BYTES) {
      // Try to include partial content
      const remainingBytes = FILE_LIMITS.MAX_TOTAL_BYTES - totalBytes - 200;
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
 * Main entry point
 */
function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    logger.debug('Received input', { sessionId: input.sessionId, source: input.source });

    // Get current working directory from input or fallback
    const cwd = input.cwd;

    // Find all AGENTS.md files
    const agentsFiles = findAgentsMd(cwd);

    // If no AGENTS.md files found, exit silently
    if (agentsFiles.length === 0) {
      logger.debug('No AGENTS.md files found');
      outputAndExit({});
    }

    // Build context string
    const context = buildContext(agentsFiles);

    logger.debug('Built context', { files: agentsFiles.length, bytes: Buffer.byteLength(context, 'utf-8') });

    // Output in Claude Code hook format
    const output = formatContextOutput('SessionStart', context);
    outputAndExit(output);

  } catch (error) {
    // On any error, fail gracefully
    errorAndExit('session-start', 'An error occurred during execution');
  }
}

// Run main
main();
