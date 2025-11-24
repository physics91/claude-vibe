#!/usr/bin/env bash
# Test edge cases identified by Gemini review

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find Python
PYTHON_CMD=""
if command -v python3 &> /dev/null && python3 --version &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null && python --version &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Python not found" >&2
    exit 1
fi

JSON_HELPER="$PLUGIN_ROOT/lib/core/json-helper.py"

echo "Testing edge cases from Gemini review..."
echo

# Test 1: Invalid score (non-numeric) - should fail gracefully
echo "Test 1: Invalid score (non-numeric)"
# Disable pipefail temporarily for expected failure
set +e
ERROR_OUTPUT=$("$PYTHON_CMD" "$JSON_HELPER" encode --is-ambiguous "true" --score "invalid" --prompt "test" 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$ERROR_OUTPUT" | grep -q "invalid"; then
    echo "✓ Correctly rejected invalid score (argparse validation)"
else
    echo "✗ Failed to handle invalid score properly"
    echo "Exit code: $EXIT_CODE"
    echo "Output: $ERROR_OUTPUT"
    exit 1
fi
echo

# Test 2: Missing field - should fail with clear error
echo "Test 2: Missing field extraction"
TEST_JSON='{"foo": "bar", "number": 42}'
set +e
ERROR_OUTPUT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "nonexistent" 2>&1)
EXIT_CODE=$?
set -e
if [ $EXIT_CODE -ne 0 ] && echo "$ERROR_OUTPUT" | grep -q "not found in JSON"; then
    echo "✓ Correctly detected missing field with error message"
else
    echo "✗ Failed to detect missing field"
    echo "Exit code: $EXIT_CODE"
    echo "Output: $ERROR_OUTPUT"
    exit 1
fi
echo

# Test 3: Null value vs missing field
echo "Test 3: Null value handling"
TEST_JSON='{"present": null, "value": "exists"}'
RESULT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "present")
if [ "$RESULT" = "null" ]; then
    echo "✓ Correctly handled null value"
else
    echo "✗ Failed to handle null value: got '$RESULT'"
    exit 1
fi
echo

# Test 4: Complex list items (dict in list) - should output valid JSON
echo "Test 4: Complex list items (dict in list)"
TEST_JSON='{"items": [{"name": "foo", "value": 1}, {"name": "bar", "value": 2}]}'
RESULT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "items")
echo "Output:"
echo "$RESULT"

# Verify each line is valid JSON
LINE_COUNT=0
while IFS= read -r line; do
    if [ -n "$line" ]; then
        if echo "$line" | "$PYTHON_CMD" -m json.tool &> /dev/null; then
            LINE_COUNT=$((LINE_COUNT + 1))
            echo "  Line $LINE_COUNT: Valid JSON ✓"
        else
            echo "  Line $((LINE_COUNT + 1)): Invalid JSON ✗"
            echo "  Content: $line"
            exit 1
        fi
    fi
done <<< "$RESULT"

if [ $LINE_COUNT -eq 2 ]; then
    echo "✓ All $LINE_COUNT complex items output as valid JSON"
else
    echo "✗ Expected 2 items, got $LINE_COUNT"
    exit 1
fi
echo

# Test 5: Simple list items (strings) - should output as-is
echo "Test 5: Simple list items (strings)"
TEST_JSON='{"tags": ["foo", "bar", "baz"]}'
RESULT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "tags")
echo "Output:"
echo "$RESULT"

# Count lines instead of string comparison (more reliable)
LINE_COUNT=$(echo "$RESULT" | wc -l)
FIRST_LINE=$(echo "$RESULT" | head -n1)
LAST_LINE=$(echo "$RESULT" | tail -n1)

if [ "$LINE_COUNT" -eq 3 ] && [ "$FIRST_LINE" = "foo" ] && [ "$LAST_LINE" = "baz" ]; then
    echo "✓ Simple strings output correctly (3 lines)"
else
    echo "✗ Simple strings output incorrectly"
    echo "Line count: $LINE_COUNT (expected 3)"
    echo "First: $FIRST_LINE (expected foo)"
    echo "Last: $LAST_LINE (expected baz)"
    exit 1
fi
echo

# Test 6: Boolean values
echo "Test 6: Boolean value extraction"
TEST_JSON='{"flag": true, "disabled": false}'
TRUE_RESULT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "flag")
FALSE_RESULT=$(echo "$TEST_JSON" | "$PYTHON_CMD" "$JSON_HELPER" extract "disabled")
if [ "$TRUE_RESULT" = "true" ] && [ "$FALSE_RESULT" = "false" ]; then
    echo "✓ Boolean values handled correctly"
else
    echo "✗ Boolean values incorrect: true=$TRUE_RESULT, false=$FALSE_RESULT"
    exit 1
fi
echo

echo "All edge case tests passed! ✓"
