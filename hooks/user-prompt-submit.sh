#!/usr/bin/env bash
# User Prompt Submit Hook (Bash version)
# Analyzes user prompts and requests clarification if ambiguous

set -euo pipefail

# Get plugin root directory
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
    echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
    exit 1
fi

# Get user prompt from environment variable
USER_PROMPT="${CLAUDE_PROMPT:-}"
if [ -z "$USER_PROMPT" ]; then
    # No prompt to analyze, exit silently
    exit 0
fi

# Find Python (prefer python3, fallback to python)
# Test actual execution, not just existence (Windows symlink issues)
PYTHON_CMD=""
if command -v python3 &> /dev/null && python3 --version &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null && python --version &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python not found. Python 2.7+ or 3.x is required." >&2
    exit 1
fi

# Import analyzer module
ANALYZER_PATH="$PLUGIN_ROOT/lib/core/prompt-analyzer.sh"
if [ ! -f "$ANALYZER_PATH" ]; then
    echo "Error: Analyzer module not found: $ANALYZER_PATH" >&2
    exit 1
fi
source "$ANALYZER_PATH"

# Analyze the prompt (returns JSON)
ANALYSIS_JSON=$(test_prompt_ambiguity "$USER_PROMPT")

# Check if analysis succeeded
if [ $? -ne 0 ]; then
    echo "Error: Prompt analysis failed" >&2
    exit 1
fi

# Use Python to safely extract fields from JSON
JSON_HELPER="$PLUGIN_ROOT/lib/core/json-helper.py"

# Extract fields using Python
IS_AMBIGUOUS=$("$PYTHON_CMD" "$JSON_HELPER" extract "is_ambiguous" <<< "$ANALYSIS_JSON")
AMBIGUITY_SCORE=$("$PYTHON_CMD" "$JSON_HELPER" extract "ambiguity_score" <<< "$ANALYSIS_JSON")

# If prompt is ambiguous, activate Prompt Clarifier Skill
if [ "$IS_AMBIGUOUS" = "true" ]; then
    # Extract reasons as space-separated values
    REASONS=$("$PYTHON_CMD" "$JSON_HELPER" extract "reasons" <<< "$ANALYSIS_JSON" | tr '\n' ' ')

    # Extract questions (one per line)
    QUESTIONS_RAW=$("$PYTHON_CMD" "$JSON_HELPER" extract "questions" <<< "$ANALYSIS_JSON")

    # Build question topics
    QUESTION_TOPICS=""
    while IFS= read -r question; do
        if [ -n "$question" ]; then
            QUESTION_TOPICS+="- $question"$'\n'
        fi
    done <<< "$QUESTIONS_RAW"

    # Build conditional instructions based on reasons
    CONDITIONAL_INSTRUCTIONS=""
    if echo "$REASONS" | grep -q "MISSING_TECH_STACK"; then
        CONDITIONAL_INSTRUCTIONS+="   - Technology stack preferences"$'\n'
    fi
    if echo "$REASONS" | grep -q "MISSING_DETAILS"; then
        CONDITIONAL_INSTRUCTIONS+="   - Main features needed"$'\n'
    fi
    if echo "$REASONS" | grep -q "VAGUE_OPTIMIZATION"; then
        CONDITIONAL_INSTRUCTIONS+="   - Optimization aspect (performance, memory, size, readability)"$'\n'
    fi
    if echo "$REASONS" | grep -q "INSUFFICIENT_REQUIREMENTS"; then
        CONDITIONAL_INSTRUCTIONS+="   - Project scope/size"$'\n'
    fi
    if echo "$REASONS" | grep -q "MISSING_CODE_CONTEXT"; then
        CONDITIONAL_INSTRUCTIONS+="   - File path or code location"$'\n'
    fi

    # Output skill activation message
    cat <<EOF

<!-- VIBE CODING ASSISTANT: PROMPT CLARIFICATION NEEDED -->

**[Activate Skill: prompt-clarifier]**

The user submitted an ambiguous prompt. Use the **prompt-clarifier** skill to ask targeted clarification questions using AskUserQuestion with interactive selections.

**Analysis Results:**
- Ambiguity Score: $AMBIGUITY_SCORE/100
- Issues Detected: $REASONS

**Suggested Question Topics:**
$QUESTION_TOPICS

**Instructions:**
1. Acknowledge the user's request briefly
2. Use AskUserQuestion to present interactive selections for:
$CONDITIONAL_INSTRUCTIONS
3. After receiving answers, proceed with the enhanced context

**Original Prompt:** "$USER_PROMPT"

EOF

    # Log to file for debugging (optional)
    LOG_DIR="$PLUGIN_ROOT/logs"
    mkdir -p "$LOG_DIR"

    TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
    LOG_FILE="$LOG_DIR/prompt-clarification_$TIMESTAMP.log"

    cat >"$LOG_FILE" <<EOF
Timestamp: $(date +"%Y-%m-%d %H:%M:%S")
Original Prompt: $USER_PROMPT
Ambiguity Score: $AMBIGUITY_SCORE
Reasons: $REASONS

Questions:
$QUESTION_TOPICS

JSON Output:
$ANALYSIS_JSON
EOF
fi

# Exit successfully
exit 0
