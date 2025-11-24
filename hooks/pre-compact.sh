#!/usr/bin/env bash
# Pre-Compact Hook (Bash version - Basic implementation)
# Captures context before compaction
# NOTE: This is a basic implementation. Full AGENTS.md parsing requires parser.sh

set -e

# Get plugin root directory
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
    echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
    exit 1
fi

# Read hook input from stdin (JSON format)
INPUT=$(cat)

# Parse session_id and cwd from JSON input
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
CWD=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)

# Create state directory
STATE_DIR="$PLUGIN_ROOT/.state"
mkdir -p "$STATE_DIR"

# Save basic session info
STATE_FILE="$STATE_DIR/session_${SESSION_ID}.json"
cat >"$STATE_FILE" <<EOF
{
  "session_id": "$SESSION_ID",
  "cwd": "$CWD",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "note": "Basic Bash implementation - full AGENTS.md parsing not yet implemented"
}
EOF

# Exit successfully
exit 0
