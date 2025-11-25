---
description: Initialize AGENTS.md file with codebase documentation (like /init but for AGENTS.md)
allowed-tools: Read, Glob, Grep, Write, Bash, LS
---

# Initialize AGENTS.md

**IMPORTANT: Before proceeding, check if AGENTS.md already exists in the project root directory.**

First, check for existing AGENTS.md:
- If `AGENTS.md` already exists in the project root, **DO NOT overwrite it**. Instead, inform the user that AGENTS.md already exists and ask if they want to update it manually.

If AGENTS.md does not exist, analyze the codebase and create a comprehensive AGENTS.md file in the project root directory with the following structure:

## Required Sections

### 1. Project Overview
- Brief description of the project
- Main technologies and frameworks used
- Project structure overview

### 2. Build & Run Commands
- How to install dependencies
- How to build the project
- How to run the project
- How to run tests

### 3. Code Style & Conventions
- Naming conventions (files, functions, variables, classes)
- Code formatting rules
- Import/export patterns
- Error handling patterns

### 4. Architecture Guidelines
- Directory structure explanation
- Key design patterns used
- Module organization

### 5. Agent Instructions
- Key directives for AI agents working on this codebase
- Important constraints (MUST, NEVER, ALWAYS patterns)
- Project-specific rules

## Analysis Steps

1. Scan for package.json, Cargo.toml, pyproject.toml, go.mod, pom.xml, or similar config files
2. Check for existing README.md, CONTRIBUTING.md for context
3. Analyze directory structure
4. Look for .editorconfig, .prettierrc, eslint config, etc.
5. Identify test frameworks and patterns
6. Look for CI/CD configurations

## Output

Create the AGENTS.md file in the project root with all gathered information, formatted clearly and concisely.
