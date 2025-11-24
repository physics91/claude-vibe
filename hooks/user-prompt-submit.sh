#!/usr/bin/env bash
# User Prompt Submit Hook (Bash version)
# Analyzes user prompts and requests clarification if ambiguous

set -e

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

# Analyze the prompt
ANALYSIS=$(test_prompt_ambiguity "$USER_PROMPT")

# Parse analysis results
IS_AMBIGUOUS=$(echo "$ANALYSIS" | grep "^IS_AMBIGUOUS=" | cut -d= -f2)
AMBIGUITY_SCORE=$(echo "$ANALYSIS" | grep "^AMBIGUITY_SCORE=" | cut -d= -f2)
REASONS=$(echo "$ANALYSIS" | grep "^REASONS=" | cut -d= -f2-)
QUESTION_COUNT=$(echo "$ANALYSIS" | grep "^QUESTION_COUNT=" | cut -d= -f2)

# Parse questions
QUESTIONS=()
for i in $(seq 0 $((QUESTION_COUNT - 1))); do
    question=$(echo "$ANALYSIS" | grep "^QUESTION_$i=" | cut -d= -f2-)
    QUESTIONS+=("$question")
done

# If prompt is ambiguous, activate Prompt Clarifier Skill
if [ "$IS_AMBIGUOUS" = "true" ]; then
    # Build suggested question topics
    QUESTION_TOPICS=""
    for question in "${QUESTIONS[@]}"; do
        QUESTION_TOPICS+="- $question"$'\n'
    done

    # Build conditional instructions
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
Questions Generated: $QUESTION_COUNT

Questions:
$QUESTION_TOPICS
EOF
fi

# Exit successfully
exit 0
