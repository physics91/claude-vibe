#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo
echo "== Lint AGENTS files =="
node "$PROJECT_ROOT/tools/lint-agents.js" --root "$PROJECT_ROOT" --no-global --strict

echo
echo "== Node.js tests (hooks) =="
node "$PROJECT_ROOT/tests/hooks.test.js"

echo
echo "== Node.js tests (lint-agents) =="
node "$PROJECT_ROOT/tests/lint-agents.test.js"

echo
echo "== Node.js tests (inject-agents) =="
node "$PROJECT_ROOT/tests/inject-agents.test.js"

echo
echo "== Node.js tests (E2E) =="
node "$PROJECT_ROOT/tests/e2e-test.js"

echo
echo "== Bash tests (prompt analyzer JSON) =="
bash "$PROJECT_ROOT/tests/test-python-json.sh"

echo
echo "== Bash tests (edge cases) =="
bash "$PROJECT_ROOT/tests/test-edge-cases.sh"

echo
echo "All tests passed."
