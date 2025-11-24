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

# Import analyzer module
ANALYZER_PATH="$PLUGIN_ROOT/lib/core/prompt-analyzer.sh"
if [ ! -f "$ANALYZER_PATH" ]; then
    echo "Error: Analyzer module not found: $ANALYZER_PATH" >&2
    exit 1
fi
source "$ANALYZER_PATH"

# Analyze the prompt (returns JSON)
ANALYSIS_JSON=$(test_prompt_ambiguity "$USER_PROMPT")

# Parse JSON safely without eval (using grep and sed)
parse_json_bool() {
    echo "$ANALYSIS_JSON" | grep -o "\"$1\": *[^,}]*" | sed 's/.*: *//' | tr -d ' '
}

parse_json_number() {
    echo "$ANALYSIS_JSON" | grep -o "\"$1\": *[0-9]*" | sed 's/.*: *//'
}

parse_json_array() {
    # Extract array content between brackets
    local array_content=$(echo "$ANALYSIS_JSON" | sed -n "s/.*\"$1\": *\[\([^]]*\)\].*/\1/p")
    # Split by comma and remove quotes
    echo "$array_content" | sed 's/"//g' | sed 's/\\n/\n/g'
}

# Parse analysis results
IS_AMBIGUOUS=$(parse_json_bool "is_ambiguous")
AMBIGUITY_SCORE=$(parse_json_number "ambiguity_score")

# If prompt is ambiguous, activate Prompt Clarifier Skill
if [ "$IS_AMBIGUOUS" = "true" ]; then
    # Parse reasons and questions arrays
    REASONS=$(parse_json_array "reasons" | tr '\n' ',' | sed 's/,$//' | tr ',' ' ')

    # Build question topics
    QUESTION_TOPICS=""
    while IFS= read -r question; do
        if [ -n "$question" ]; then
            QUESTION_TOPICS+="- $question"$'\n'
        fi
    done < <(parse_json_array "questions")

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
