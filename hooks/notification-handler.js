#!/usr/bin/env node
/**
 * notification-handler.js
 *
 * Notification hook that sends alerts via ntfy.sh, Slack, or desktop notifications.
 * Supports configurable triggers and suppression in sub-agents.
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const {
  readStdinJson,
  normalizeHookInput,
  formatNotificationOutput,
  outputAndExit,
  createLogger,
  STATE_PATHS
} = require('./lib/core');

const {
  sendNtfyNotification,
  sendSlackNotification,
  sendWebhook
} = require('./lib/utils');

const logger = createLogger('notification-handler');

/**
 * Default notification configuration
 */
const DEFAULT_CONFIG = {
  enabled: true,
  suppressInSubAgent: true,
  subAgentFlagFile: '.claude_in_subtask.flag',
  services: {
    ntfy: {
      enabled: false,
      url: 'https://ntfy.sh/claude-vibe',
      priority: 'default'
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '',
      username: 'Claude Code'
    },
    desktop: {
      enabled: true
    }
  },
  triggers: {
    task_complete: { enabled: true, services: ['desktop'] },
    permission_prompt: { enabled: true, services: ['desktop'] },
    error: { enabled: true, services: ['desktop', 'ntfy'] },
    idle_prompt: { enabled: false, services: ['desktop'] }
  }
};

/**
 * Load notification configuration
 * @param {string} cwd - Current working directory
 * @returns {Object} Merged configuration
 */
function loadConfig(cwd) {
  const configLocations = [
    path.join(cwd, STATE_PATHS.PLUGIN_STATE, STATE_PATHS.NOTIFICATION_CONFIG),
    path.join(os.homedir(), '.claude', STATE_PATHS.PLUGIN_STATE, STATE_PATHS.NOTIFICATION_CONFIG)
  ];

  for (const configPath of configLocations) {
    try {
      if (fs.existsSync(configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...userConfig };
      }
    } catch (error) {
      logger.debug('Could not load config', { path: configPath, error: error.message });
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Check if we're in a sub-agent context
 * @param {string} cwd - Current working directory
 * @param {string} flagFile - Flag file name
 * @returns {boolean}
 */
function isInSubAgent(cwd, flagFile) {
  const flagPath = path.join(cwd, flagFile);
  return fs.existsSync(flagPath);
}

/**
 * Send desktop notification
 * @param {string} message - Notification message
 * @param {string} title - Notification title
 * @returns {Promise<boolean>}
 */
async function sendDesktopNotification(message, title = 'Claude Code') {
  const platform = os.platform();

  try {
    if (platform === 'win32') {
      // Windows: Use PowerShell toast notification with -File to avoid shell injection
      // Create a temporary script file for complex PowerShell commands
      const tempDir = os.tmpdir();
      const scriptPath = path.join(tempDir, `toast-${Date.now()}.ps1`);

      // Escape for XML (not for shell)
      const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
<toast>
  <visual>
    <binding template="ToastText02">
      <text id="1">${safeTitle}</text>
      <text id="2">${safeMessage}</text>
    </binding>
  </visual>
</toast>
"@
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Claude Code").Show($toast)
`;

      fs.writeFileSync(scriptPath, script, { mode: 0o600 });
      try {
        // Use execFileSync with -File (no shell interpretation)
        execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], { timeout: 5000 });
        return true;
      } finally {
        // Clean up temp file
        try { fs.unlinkSync(scriptPath); } catch (e) { /* ignore */ }
      }
    } else if (platform === 'darwin') {
      // macOS: Use execFileSync with separate arguments (no shell)
      const appleScript = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
      execFileSync('osascript', ['-e', appleScript], { timeout: 5000 });
      return true;
    } else if (platform === 'linux') {
      // Linux: Use execFileSync with separate arguments (no shell)
      execFileSync('notify-send', [title, message], { timeout: 5000 });
      return true;
    }
  } catch (error) {
    logger.debug('Desktop notification failed', { error: error.message });
  }

  return false;
}

/**
 * Send notifications to configured services
 * @param {string} message - Notification message
 * @param {string} notificationType - Type of notification
 * @param {Object} config - Configuration
 * @returns {Promise<Array<{service: string, status: string}>>}
 */
async function sendNotifications(message, notificationType, config) {
  const results = [];
  const trigger = config.triggers[notificationType];

  if (!trigger || !trigger.enabled) {
    logger.debug('Trigger not enabled', { notificationType });
    return results;
  }

  const services = trigger.services || [];

  for (const serviceName of services) {
    const serviceConfig = config.services[serviceName];

    if (!serviceConfig || !serviceConfig.enabled) {
      continue;
    }

    let success = false;

    try {
      switch (serviceName) {
        case 'ntfy':
          success = await sendNtfyNotification(
            new URL(serviceConfig.url).pathname.slice(1), // Extract topic from URL
            message,
            {
              server: new URL(serviceConfig.url).origin,
              title: 'Claude Code',
              priority: serviceConfig.priority
            }
          );
          break;

        case 'slack':
          if (serviceConfig.webhookUrl) {
            success = await sendSlackNotification(
              serviceConfig.webhookUrl,
              message,
              {
                channel: serviceConfig.channel,
                username: serviceConfig.username
              }
            );
          }
          break;

        case 'desktop':
          success = await sendDesktopNotification(message);
          break;

        default:
          logger.debug('Unknown service', { serviceName });
      }
    } catch (error) {
      logger.debug('Service notification failed', { serviceName, error: error.message });
    }

    results.push({
      service: serviceName,
      status: success ? 'success' : 'failed'
    });
  }

  return results;
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Read and normalize input
    const rawInput = readStdinJson();
    const input = normalizeHookInput(rawInput);

    logger.debug('Received input', {
      notificationType: rawInput.notification_type,
      message: input.message
    });

    // Load configuration
    const config = loadConfig(input.cwd);

    // Check if notifications are enabled
    if (!config.enabled) {
      logger.debug('Notifications disabled');
      outputAndExit(formatNotificationOutput([]));
    }

    // Check if we're in a sub-agent and should suppress
    if (config.suppressInSubAgent && isInSubAgent(input.cwd, config.subAgentFlagFile)) {
      logger.debug('Suppressing notification in sub-agent');
      outputAndExit(formatNotificationOutput([]));
    }

    // Get notification type and message
    const notificationType = rawInput.notification_type || 'task_complete';
    const message = input.message || 'Claude Code notification';

    // Send notifications
    const results = await sendNotifications(message, notificationType, config);

    logger.debug('Notification results', { results });

    // Output results
    outputAndExit(formatNotificationOutput(results));

  } catch (error) {
    // On error, output empty results
    logger.error('Error handling notification', { error: error.message });
    outputAndExit(formatNotificationOutput([]));
  }
}

// Run main
main();
