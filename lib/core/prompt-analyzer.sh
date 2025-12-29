#!/usr/bin/env bash
# Prompt Analyzer Module (Bash version)
# Delegates prompt analysis to the shared Node.js analyzer

test_prompt_ambiguity() {
    local prompt="$1"
    local node_cmd=""

    if command -v node &> /dev/null; then
        node_cmd="node"
    else
        echo "Error: Node.js not found. Node.js is required for prompt analysis." >&2
        return 1
    fi

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local analyzer="$script_dir/prompt-analyzer.js"

    if [ ! -f "$analyzer" ]; then
        echo "Error: Analyzer module not found: $analyzer" >&2
        return 1
    fi

    printf '%s' "$prompt" | "$node_cmd" "$analyzer"
}

# Export function for use by other scripts
export -f test_prompt_ambiguity
