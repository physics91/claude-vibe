#!/usr/bin/env bash
# Session Start Hook (Bash version - Basic implementation)
# Restores context on session start
# NOTE: This is a basic implementation. Full context restoration requires parser.sh and storage.sh

set -euo pipefail

# Get plugin root directory
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
    echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
    exit 1
fi

# Read hook input from stdin (JSON format)
INPUT=$(cat)

# Parse session_id from JSON input
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

# Check if state file exists
STATE_DIR="$PLUGIN_ROOT/.state"
STATE_FILE="$STATE_DIR/session_${SESSION_ID}.json"

if [ -f "$STATE_FILE" ]; then
    # State exists - output restoration message
    TIMESTAMP=$(grep -o '"timestamp":"[^"]*"' "$STATE_FILE" | cut -d'"' -f4)
    cat <<EOF

<!-- AGENTS Context Restored -->
Session state from $TIMESTAMP has been found.

**Note:** This is a basic Bash implementation. Full AGENTS.md context restoration is available in the PowerShell version.

EOF
fi

# Exit successfully
exit 0
