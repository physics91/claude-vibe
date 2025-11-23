# Claude Vibe

A comprehensive Claude Code plugin that enhances your AI-assisted development workflow with intelligent context management and prompt optimization for vibe coding.

[한국어 문서](./README.ko.md)

## Installation

### Method 1: Plugin Command (Recommended)

```bash
# Add marketplace
/plugin marketplace add physics91/claude-vibe

# Install plugin
/plugin install agents-context-preserver@physics91
```

### Method 2: Manual Installation

```powershell
# 1. Clone repository
git clone https://github.com/physics91/claude-vibe.git
cd claude-vibe

# 2. Register hooks in settings.json
```

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/pre-compact.ps1\""]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": ["powershell -ExecutionPolicy Bypass -File \"path/to/hooks/session-start.ps1\""]
      }
    ]
  }
}
```

## Structure

```
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace definition
├── hooks/
│   ├── hooks.json              # Hook configuration
│   ├── pre-compact.ps1         # Captures context before compaction
│   ├── session-start.ps1       # Restores context on session start
│   └── user-prompt-submit.ps1  # Analyzes prompts and activates skill
├── skills/
│   └── prompt-clarifier/
│       └── SKILL.md            # Prompt clarification skill
├── lib/
│   ├── core/
│   │   ├── parser.ps1                  # AGENTS.md parser
│   │   ├── storage.ps1                 # State storage/loading
│   │   ├── prompt-analyzer.ps1         # Prompt ambiguity detection
│   │   └── clarification-generator.ps1 # Question generation
│   └── utils/
│       └── security.ps1        # Security utilities
├── schemas/                    # JSON schemas
└── tests/
    ├── test-*.ps1              # Test scripts
    └── test-prompt-analyzer.ps1 # Prompt analyzer tests
```

## Features

### Context Preservation
- Automatic AGENTS.md parsing (project/global/local)
- Automatic context saving on compaction
- Automatic context restoration on session start
- Task state tracking

### Vibe Coding Assistant (NEW!)
- **Intelligent Prompt Analysis**: Automatically detects ambiguous or unclear prompts
- **Interactive Clarification**: Uses AskUserQuestion to present multiple-choice selections
- **Smart Question Generation**: Creates targeted questions based on detected issues
- **Seamless Skill Integration**: Automatically activates the prompt-clarifier skill
- **Detailed Logging**: Tracks prompt quality metrics for continuous improvement

The Vibe Coding Assistant helps you write better prompts by:
- Detecting missing technical details (tech stack, file paths, requirements)
- Identifying vague instructions (unclear verbs, excessive pronouns)
- Presenting interactive selections for quick clarification
- Guiding you toward more effective vibe coding practices

**How it works:**
1. You submit a prompt → Hook analyzes for ambiguity
2. If ambiguous → Activates prompt-clarifier skill
3. Claude asks clarifying questions → You select from options
4. Claude proceeds with full context → Better results!

## Requirements

- Windows PowerShell 5.1+ or PowerShell Core 7+
- Claude Code v1.0.0+

## Usage Examples

### Vibe Coding Assistant

The plugin automatically analyzes your prompts when you submit them. Here are some examples:

#### Example 1: Ambiguous Prompt
```
User: "웹사이트 만들어줘"
```

**Claude's Response (with plugin):**
```
좋습니다. 웹사이트 개발을 도와드리겠습니다.
더 정확한 결과를 위해 몇 가지 질문드리겠습니다.

[AskUserQuestion appears with selections]

어떤 기술 스택을 사용하고 싶으신가요?
○ React + TypeScript + Node.js
○ Vue + JavaScript + Express
○ Vanilla JS + Python + FastAPI
○ 직접 입력할게요

[After selection]

주요 기능을 선택해주세요 (여러 개 선택 가능):
□ 사용자 인증/로그인
□ 데이터베이스 CRUD
□ 파일 업로드
□ 실시간 통신 (WebSocket)
□ 결제 시스템
□ 관리자 대시보드

[After selections, Claude proceeds with implementation]
```

#### Example 2: Clear Prompt
```
User: "React와 TypeScript를 사용해서 사용자 인증 기능이 있는 Todo 앱을 만들어주세요.
PostgreSQL과 Prisma를 백엔드로 사용합니다"
```

**Result:** No clarification needed - Claude proceeds directly with implementation.

### Testing

#### Unit Tests - Prompt Analyzer

Run the unit test suite to see how different prompts are analyzed:

```powershell
.\tests\test-prompt-analyzer.ps1
```

#### End-to-End Tests

Run the complete e2e test suite to verify the entire workflow:

```powershell
.\tests\e2e\run-e2e-tests.ps1
```

For verbose output:

```powershell
.\tests\e2e\run-e2e-tests.ps1 -Verbose
```

**What the e2e tests cover:**
- ✅ Ambiguous prompt detection (7 scenarios)
- ✅ Skill activation verification
- ✅ Expected ambiguity reasons validation
- ✅ Output structure checks
- ✅ Log file creation and content
- ✅ Module dependency loading

**Example output:**
```
================================
Vibe Coding Assistant E2E Tests
================================

Running 7 test scenarios...

Scenario: Ambiguous Prompt - Too Short
  Prompt: '이거 고쳐줘'
  ✓ Hook executes successfully
  ✓ Skill should be activated
  ✓ Expected ambiguity reasons detected
  ✓ Output contains required sections

Scenario: Clear Prompt - Specific with Tech Stack
  Prompt: 'React와 TypeScript를 사용해서...'
  ✓ Hook executes successfully
  ✓ Skill should NOT be activated
  ✓ Output is minimal (no clarification needed)

...

================================
Test Summary
================================
Total Tests: 25
Passed: 25
Failed: 0
Success Rate: 100%

✓ All tests passed!
```

### Viewing Logs

Prompt analysis logs are saved in the `logs/` directory:
- `prompt-clarification_*.log`: Detailed analysis of ambiguous prompts
- `hook-error.log`: Any errors during hook execution

## Configuration

### Adjusting Ambiguity Threshold

Edit `lib/core/prompt-analyzer.ps1` to customize the ambiguity detection threshold (default: 40):

```powershell
# Line 115 in prompt-analyzer.ps1
$isAmbiguous = $ambiguityScore -ge 40  # Lower = more sensitive
```

### Disabling Specific Checks

Comment out unwanted checks in the `Test-PromptAmbiguity` function.

## License

MIT
