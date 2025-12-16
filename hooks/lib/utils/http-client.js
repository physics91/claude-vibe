/**
 * http-client.js
 *
 * Lightweight HTTP client for webhook notifications.
 * Uses built-in Node.js modules (no external dependencies).
 *
 * @author physics91
 * @license MIT
 */

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Default request timeout (ms)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Maximum response body size (1MB) - prevents memory exhaustion from large responses
 */
const MAX_RESPONSE_BYTES = 1024 * 1024;

/**
 * Send an HTTP/HTTPS request
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, etc.)
 * @param {Object} options.headers - Request headers
 * @param {string|Object} options.body - Request body
 * @param {number} options.timeout - Request timeout in ms
 * @returns {Promise<{status: number, body: string}>}
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || DEFAULT_TIMEOUT
    };

    const req = client.request(requestOptions, (res) => {
      let body = '';
      let bodySize = 0;

      res.on('data', chunk => {
        bodySize += chunk.length;
        if (bodySize > MAX_RESPONSE_BYTES) {
          req.destroy();
          reject(new Error(`Response too large (>${MAX_RESPONSE_BYTES} bytes)`));
          return;
        }
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body
        });
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      const bodyStr = typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
      req.write(bodyStr);
    }

    req.end();
  });
}

/**
 * Send a POST request with JSON body
 * @param {string} url - Request URL
 * @param {Object} data - JSON data to send
 * @param {Object} headers - Additional headers
 * @param {number} timeout - Request timeout
 * @returns {Promise<{status: number, body: string}>}
 */
function postJson(url, data, headers = {}, timeout = DEFAULT_TIMEOUT) {
  return request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: data,
    timeout
  });
}

/**
 * Send a notification to ntfy.sh
 * @param {string} topic - ntfy.sh topic
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @param {string} options.server - ntfy server URL (default: https://ntfy.sh)
 * @param {string} options.title - Notification title
 * @param {string} options.priority - Priority (min, low, default, high, urgent)
 * @param {string[]} options.tags - Tags/emojis
 * @returns {Promise<boolean>} Success status
 */
async function sendNtfyNotification(topic, message, options = {}) {
  const server = options.server || 'https://ntfy.sh';
  const url = `${server}/${topic}`;

  const headers = {};
  if (options.title) headers['Title'] = options.title;
  if (options.priority) headers['Priority'] = options.priority;
  if (options.tags) headers['Tags'] = options.tags.join(',');

  try {
    const response = await request(url, {
      method: 'POST',
      headers,
      body: message,
      timeout: options.timeout || DEFAULT_TIMEOUT
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Send a notification to Slack webhook
 * @param {string} webhookUrl - Slack webhook URL
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @param {string} options.channel - Channel override
 * @param {string} options.username - Username override
 * @param {string} options.icon_emoji - Icon emoji
 * @returns {Promise<boolean>} Success status
 */
async function sendSlackNotification(webhookUrl, message, options = {}) {
  const payload = {
    text: message
  };

  if (options.channel) payload.channel = options.channel;
  if (options.username) payload.username = options.username;
  if (options.icon_emoji) payload.icon_emoji = options.icon_emoji;

  try {
    const response = await postJson(webhookUrl, payload, {}, options.timeout || DEFAULT_TIMEOUT);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Send a notification to a generic webhook
 * @param {string} webhookUrl - Webhook URL
 * @param {Object} payload - JSON payload
 * @param {Object} headers - Custom headers
 * @returns {Promise<boolean>} Success status
 */
async function sendWebhook(webhookUrl, payload, headers = {}) {
  try {
    const response = await postJson(webhookUrl, payload, headers);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    return false;
  }
}

module.exports = {
  request,
  postJson,
  sendNtfyNotification,
  sendSlackNotification,
  sendWebhook,
  DEFAULT_TIMEOUT,
  MAX_RESPONSE_BYTES
};
