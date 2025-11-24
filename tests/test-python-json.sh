#!/usr/bin/env bash
# Test Python JSON handling in prompt analyzer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find Python (prefer python3, fallback to python)
PYTHON_CMD=""
if command -v python3 &> /dev/null && python3 --version &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null && python --version &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python not found. Python is required for testing." >&2
    exit 1
fi

echo "Using Python: $PYTHON_CMD"
echo

# Source the analyzer
source "$PLUGIN_ROOT/lib/core/prompt-analyzer.sh"

echo "Testing Python-based JSON handling..."
echo

# Test 1: Simple non-ambiguous prompt
echo "Test 1: Non-ambiguous prompt"
RESULT=$(test_prompt_ambiguity "Create a React component for user authentication using JWT tokens with proper error handling")
echo "JSON Output:"
echo "$RESULT" | "$PYTHON_CMD" -m json.tool
echo

# Extract and verify fields
IS_AMBIGUOUS=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "is_ambiguous" <<< "$RESULT")
SCORE=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "ambiguity_score" <<< "$RESULT")
echo "Is Ambiguous: $IS_AMBIGUOUS"
echo "Score: $SCORE"
echo

# Test 2: Ambiguous prompt (should trigger multiple checks)
echo "Test 2: Ambiguous prompt"
RESULT=$(test_prompt_ambiguity "fix this")
echo "JSON Output:"
echo "$RESULT" | "$PYTHON_CMD" -m json.tool
echo

IS_AMBIGUOUS=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "is_ambiguous" <<< "$RESULT")
SCORE=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "ambiguity_score" <<< "$RESULT")
REASONS=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "reasons" <<< "$RESULT")
QUESTIONS=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "questions" <<< "$RESULT")

echo "Is Ambiguous: $IS_AMBIGUOUS"
echo "Score: $SCORE"
echo "Reasons:"
echo "$REASONS"
echo
echo "Questions:"
echo "$QUESTIONS"
echo

# Test 3: Medium ambiguity prompt
echo "Test 3: Medium ambiguity prompt"
RESULT=$(test_prompt_ambiguity "Create a website for my business")
echo "JSON Output:"
echo "$RESULT" | "$PYTHON_CMD" -m json.tool
echo

IS_AMBIGUOUS=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "is_ambiguous" <<< "$RESULT")
SCORE=$("$PYTHON_CMD" "$PLUGIN_ROOT/lib/core/json-helper.py" extract "ambiguity_score" <<< "$RESULT")
echo "Is Ambiguous: $IS_AMBIGUOUS"
echo "Score: $SCORE"
echo

echo "All tests completed successfully!"
