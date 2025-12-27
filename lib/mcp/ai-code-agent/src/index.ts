#!/usr/bin/env node

/**
 * AI Code Agent MCP Server
 * Entry point for the MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ConfigManager } from './core/config.js';
import { Logger } from './core/logger.js';
import { AnalysisAggregator } from './services/aggregator/merger.js';
import { CacheService } from './services/cache/cache.service.js';
import { CodexAnalysisService } from './services/codex/client.js';
import { GeminiAnalysisService } from './services/gemini/client.js';
import { CacheRepository, DatabaseManager } from './storage/index.js';
import { ToolRegistry } from './tools/registry.js';
import { PromptRegistry } from './prompts/registry.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  let logger: Logger | undefined;
  let cacheService: CacheService | null = null;
  let cacheCleanupInterval: NodeJS.Timeout | null = null;
  let dbManager: DatabaseManager | null = null;

  try {
    // Load configuration
    const config = await ConfigManager.load();

    // Use server.logLevel (priority) or logging.level for logger initialization
    logger = Logger.create({
      level: config.server.logLevel ?? config.logging.level,
      pretty: config.logging.pretty,
      file: config.logging.file,
    });

    logger.info({ version: config.server.version }, 'Starting AI Code Agent MCP Server');

    // Create MCP server using high-level API (automatically handles capabilities)
    const server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });

    // Initialize cache + storage if enabled
    if (config.cache.enabled) {
      if (config.storage.type === 'sqlite') {
        dbManager = DatabaseManager.initialize(config.storage.sqlite, logger);
        const cacheRepo = new CacheRepository(
          dbManager.getDb(),
          {
            maxSize: config.cache.maxSize,
            defaultTtlMs: config.cache.ttl,
            touchIntervalMs: config.cache.touchIntervalMs,
          },
          logger
        );
        cacheService = new CacheService(
          cacheRepo,
          {
            enabled: config.cache.enabled,
            ttl: config.cache.ttl,
            maxSize: config.cache.maxSize,
          },
          logger
        );

        const cleanupIntervalMs = config.cache.cleanupIntervalMs ?? 5 * 60 * 1000;
        if (cleanupIntervalMs > 0) {
          cacheCleanupInterval = setInterval(() => {
            cacheService?.cleanup();
          }, cleanupIntervalMs);
        }
      } else {
        logger.warn(
          { storageType: config.storage.type },
          'Cache enabled but storage type is not sqlite; cache disabled'
        );
      }
    }

    // Initialize services with context system configuration
    const codexService = config.codex.enabled
      ? new CodexAnalysisService(
          {
            ...config.codex,
            context: config.context,
            prompts: config.prompts,
            warnings: config.warnings,
          },
          logger
        )
      : null;

    const geminiService = config.gemini.enabled
      ? new GeminiAnalysisService(
          {
            ...config.gemini,
            context: config.context,
            prompts: config.prompts,
            warnings: config.warnings,
          },
          logger
        )
      : null;

    const aggregator = new AnalysisAggregator(config.analysis, logger);

    // Register tools
    const registry = new ToolRegistry(server, {
      codexService,
      geminiService,
      aggregator,
      logger,
      config,
      cacheService: cacheService ?? undefined,
    });

    registry.registerTools();

    // Register MCP Prompts
    const promptRegistry = new PromptRegistry(server, {
      enabled: true,
      builtInPrompts: [
        'security-review',
        'performance-review',
        'style-review',
        'general-review',
        'bug-detection',
      ],
    }, logger);
    promptRegistry.registerPrompts();

    // Setup transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Code Review MCP Server started successfully');

    // Handle graceful shutdown
    const shutdown = (): void => {
      logger?.info('Shutting down Code Review MCP Server');
      if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
      }
      if (dbManager) {
        dbManager.close();
        dbManager = null;
      }
      void server
        .close()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger?.error({ error }, 'Error during server shutdown');
          process.exit(1);
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    if (logger) {
      logger.error({ error }, 'Failed to start Code Review MCP Server');
    } else {
      console.error('Fatal error:', error);
    }
    process.exit(1);
  }
}

// Start server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
