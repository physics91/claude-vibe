#!/usr/bin/env bash
# Prompt Analyzer Module (Bash version)
# Analyzes user prompts to detect ambiguity

test_prompt_ambiguity() {
    local prompt="$1"
    local ambiguity_score=0
    local ambiguity_reasons=()
    local questions=()

    # 1. Check prompt length (too short)
    local word_count=$(echo "$prompt" | wc -w)
    if [ "$word_count" -lt 5 ]; then
        ((ambiguity_score += 30))
        ambiguity_reasons+=("TOO_SHORT")
        questions+=("What specific task would you like to accomplish?")
    fi

    # 2. Check for vague verbs
    local vague_verbs=("fix" "change" "improve" "optimize" "handle" "update" "modify")
    for verb in "${vague_verbs[@]}"; do
        if echo "$prompt" | grep -qi "\b$verb\b"; then
            ((ambiguity_score += 15))
            if [[ ! " ${ambiguity_reasons[@]} " =~ " VAGUE_VERB " ]]; then
                ambiguity_reasons+=("VAGUE_VERB")
                questions+=("Which specific aspect do you want to $verb? (e.g., performance, readability, structure)")
            fi
            break
        fi
    done

    # 3. Check for pronouns
    local pronouns=("this" "that" "it" "these" "those")
    local pronoun_count=0
    for pronoun in "${pronouns[@]}"; do
        count=$(echo "$prompt" | grep -oi "\b$pronoun\b" | wc -l)
        ((pronoun_count += count))
    done
    if [ "$pronoun_count" -ge 2 ]; then
        ((ambiguity_score += 20))
        ambiguity_reasons+=("EXCESSIVE_PRONOUNS")
        questions+=("Which specific file or code are you referring to?")
    fi

    # 4. Check for project type without specifics
    local project_types=("website" "app" "application" "system" "tool" "service" "program")
    local has_project_type=false
    for type in "${project_types[@]}"; do
        if echo "$prompt" | grep -qi "\b$type\b"; then
            has_project_type=true
            break
        fi
    done

    if [ "$has_project_type" = true ] && [ "$word_count" -lt 15 ]; then
        ((ambiguity_score += 25))
        ambiguity_reasons+=("MISSING_DETAILS")
        questions+=("What are the main features needed?")
        questions+=("What technology stack would you like to use? (e.g., React, Vue, Node.js)")
    fi

    # 5. Check for missing context in coding tasks
    local coding_keywords=("code" "function" "class" "method" "module" "component")
    local has_coding_keyword=false
    for keyword in "${coding_keywords[@]}"; do
        if echo "$prompt" | grep -qi "\b$keyword\b"; then
            has_coding_keyword=true
            break
        fi
    done

    if [ "$has_coding_keyword" = true ]; then
        # Check for file path or specific code reference
        if ! echo "$prompt" | grep -qE '\.(js|py|java|ts|ps1|md|sh)|/|\\'; then
            ((ambiguity_score += 20))
            ambiguity_reasons+=("MISSING_CODE_CONTEXT")
            questions+=("Which file's code are you referring to?")
        fi
    fi

    # 6. Check for optimization without specifying aspect
    if echo "$prompt" | grep -qi "\boptimize\b"; then
        if ! echo "$prompt" | grep -qiE "\b(performance|speed|memory|size|readability)\b"; then
            ((ambiguity_score += 15))
            ambiguity_reasons+=("VAGUE_OPTIMIZATION")
            questions+=("Which aspect of optimization? (performance, memory, code size, readability)")
        fi
    fi

    # 7. Check for "make" or "create" without details
    if echo "$prompt" | grep -qiE "\b(create|make|build)\b"; then
        if [ "$word_count" -lt 10 ]; then
            ((ambiguity_score += 20))
            ambiguity_reasons+=("INSUFFICIENT_REQUIREMENTS")
            questions+=("What are the requirements or constraints?")
        fi
    fi

    # 8. Check for database/API without tech stack
    if echo "$prompt" | grep -qiE "\b(database|db|api)\b"; then
        if ! echo "$prompt" | grep -qiE "\b(mysql|postgres|mongodb|sqlite|redis|rest|graphql)\b"; then
            ((ambiguity_score += 15))
            ambiguity_reasons+=("MISSING_TECH_STACK")
            questions+=("Which database/API technology would you like to use?")
        fi
    fi

    # Determine if prompt is ambiguous (threshold: 40)
    local is_ambiguous=false
    if [ "$ambiguity_score" -ge 40 ]; then
        is_ambiguous=true
    fi

    # Return results as JSON-like output
    echo "IS_AMBIGUOUS=$is_ambiguous"
    echo "AMBIGUITY_SCORE=$ambiguity_score"
    echo "REASONS=${ambiguity_reasons[*]}"
    printf 'QUESTION_%d=%s\n' "${!questions[@]}" "${questions[@]}"
    echo "QUESTION_COUNT=${#questions[@]}"
    echo "ORIGINAL_PROMPT=$prompt"
}

# Export function for use by other scripts
export -f test_prompt_ambiguity
