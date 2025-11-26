#!/usr/bin/env bash
# Post-Tool-Use Hook (Bash version)
# Tracks tool usage patterns and provides optimization suggestions
# NOTE: This is a basic implementation for Linux/macOS

set -euo pipefail

# Get plugin root directory
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
    # Graceful exit - don't block on missing plugin root
    exit 0
fi

# Read hook input from stdin (JSON format)
INPUT=$(cat)

# Parse tool information from JSON input using grep
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | cut -d'"' -f4 || echo "")
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4 || echo "")

# Exit if no tool name
if [ -z "$TOOL_NAME" ]; then
    exit 0
fi

# Create patterns directory
PATTERNS_DIR="$HOME/.claude/claude-vibe"
mkdir -p "$PATTERNS_DIR"

PATTERNS_FILE="$PATTERNS_DIR/patterns.json"

# Initialize patterns file if it doesn't exist
if [ ! -f "$PATTERNS_FILE" ]; then
    cat >"$PATTERNS_FILE" <<EOF
{
  "version": "1.0",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "tool_history": [],
  "suggestions_shown": []
}
EOF
fi

# Read current tool history count (basic grep-based counting)
HISTORY_COUNT=$(grep -c '"tool":' "$PATTERNS_FILE" 2>/dev/null || echo "0")

# Extract file path for certain tools
TARGET=""
case "$TOOL_NAME" in
    Read|Write|Edit|MultiEdit)
        TARGET=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        ;;
    Glob|Grep)
        TARGET=$(echo "$INPUT" | grep -o '"pattern":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        ;;
    Bash)
        TARGET=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        ;;
esac

# Append tool usage to a simple log file (JSON append is complex in bash)
LOG_FILE="$PATTERNS_DIR/tool_log.txt"
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")|$TOOL_NAME|$TARGET|$SESSION_ID" >> "$LOG_FILE"

# Keep only last 1000 lines
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

# Simple pattern detection: Check for repeated file reads
if [ "$TOOL_NAME" = "Read" ] && [ -n "$TARGET" ]; then
    # Count how many times this file was read in last 20 entries
    RECENT_READS=$(tail -n 20 "$LOG_FILE" 2>/dev/null | grep -c "|Read|$TARGET|" || echo "0")

    if [ "$RECENT_READS" -gt 2 ]; then
        # Check cooldown (simple file-based cooldown)
        COOLDOWN_FILE="$PATTERNS_DIR/.suggestion_cooldown"
        COOLDOWN_MINUTES=10

        SHOULD_SUGGEST=true
        if [ -f "$COOLDOWN_FILE" ]; then
            LAST_SUGGESTION=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo "0")
            NOW=$(date +%s)
            ELAPSED=$(( (NOW - LAST_SUGGESTION) / 60 ))
            if [ "$ELAPSED" -lt "$COOLDOWN_MINUTES" ]; then
                SHOULD_SUGGEST=false
            fi
        fi

        if [ "$SHOULD_SUGGEST" = true ]; then
            # Output optimization suggestion
            cat <<EOF

<!-- VIBE OPTIMIZATION HINT -->

**Optimization Suggestion**: Reading the same file multiple times
- File '$TARGET' was read $RECENT_READS times recently
- **Tip**: Consider caching file contents or using Edit instead of Read+Write

EOF
            # Update cooldown
            date +%s > "$COOLDOWN_FILE"
        fi
    fi
fi

# Exit successfully
exit 0
