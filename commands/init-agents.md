---
description: Initialize AGENTS.md with codebase documentation
allowed-tools: Read, Glob, Grep, Write, Bash, LS
---

# Initialize AGENTS.md

**Check if AGENTS.md exists before proceeding.**

- If exists: Inform user and ask if they want to update manually
- If not exists: Create comprehensive AGENTS.md in project root

## Required Sections

### 1. Project Overview
- Brief project description
- Main technologies and frameworks
- Project structure overview

### 2. Build & Run Commands
- Install dependencies
- Build project
- Run project
- Run tests

### 3. Code Style & Conventions
- Naming conventions (files, functions, variables, classes)
- Code formatting rules
- Import/export patterns
- Error handling patterns

### 4. Architecture Guidelines
- Directory structure explanation
- Key design patterns
- Module organization

### 5. Agent Instructions
- Key directives for AI agents
- Important constraints (MUST, NEVER, ALWAYS)
- Project-specific rules

## Analysis Steps

1. Scan config files: package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml
2. Check README.md, CONTRIBUTING.md for context
3. Analyze directory structure
4. Check .editorconfig, .prettierrc, eslint config
5. Identify test frameworks and patterns
6. Look for CI/CD configurations

## Output

Create AGENTS.md in project root with all gathered information, formatted clearly and concisely.
