---
name: prompt-clarifier
description: Automatically detects ambiguous prompts and asks targeted clarification questions using interactive selections to improve vibe coding effectiveness
---

# Prompt Clarifier Skill

## Purpose
This skill helps improve the quality of user prompts by detecting ambiguity and automatically asking clarification questions using the AskUserQuestion tool with interactive selections.

## When to Use
Activate this skill automatically when:
1. You receive a prompt that seems ambiguous or lacks necessary details
2. The user mentions wanting to create/build something without specifying technical details
3. The prompt contains vague instructions like "fix this", "optimize", or "improve" without context
4. The prompt uses excessive pronouns ("this", "that", "it") without clear references

## Detection Criteria
Consider a prompt ambiguous if it:
- Is very short (< 5 words) and lacks context
- Mentions a project type (website, app, tool) without specifying:
  - Technology stack preferences
  - Main features or requirements
  - Project scope or constraints
- Contains optimization requests without specifying the optimization aspect:
  - Performance/speed
  - Memory usage
  - Code readability
  - Bundle size
- References code/files without providing file paths or locations
- Uses vague verbs without specifying what aspect to modify

## How to Respond

### Step 1: Acknowledge the Request
Briefly acknowledge what the user is asking for.

### Step 2: Use AskUserQuestion for Clarification
Present targeted questions using the AskUserQuestion tool with multiple-choice options.

**Example Question Patterns:**

For missing tech stack:
```
AskUserQuestion: "어떤 기술 스택을 사용하고 싶으신가요?"
Options:
- React + TypeScript + Node.js
- Vue + JavaScript + Express
- Vanilla JS + Python + FastAPI
- 직접 입력할게요
```

For missing features:
```
AskUserQuestion: "주요 기능을 선택해주세요 (여러 개 선택 가능)"
Options:
- 사용자 인증/로그인
- 데이터베이스 CRUD
- 파일 업로드
- 실시간 통신 (WebSocket)
- 결제 시스템
- 관리자 대시보드
```

For vague optimization:
```
AskUserQuestion: "어떤 최적화를 원하시나요?"
Options:
- 실행 속도/성능 개선
- 메모리 사용량 감소
- 번들 크기 축소
- 코드 가독성 향상
```

For project scope:
```
AskUserQuestion: "프로젝트 규모는 어느 정도인가요?"
Options:
- 간단한 프로토타입/MVP
- 중소 규모 프로젝트
- 대규모 엔터프라이즈급
- 잘 모르겠어요 (추천해주세요)
```

### Step 3: Provide Helpful Guidance
After receiving answers, proceed with the task using the enhanced context.

If the user selects "직접 입력" or similar options, ask follow-up questions in a conversational manner.

## Response Template

When you detect ambiguity:

1. **Acknowledge**: "좋습니다. [요청 내용]을 도와드리겠습니다."
2. **Explain**: "더 나은 결과를 위해 몇 가지 질문드리겠습니다."
3. **Ask**: Use AskUserQuestion with relevant options
4. **Proceed**: After getting answers, start implementation with full context

## Examples

### Example 1: Vague Web Project
**User**: "웹사이트 만들어줘"

**Your Response**:
```
좋습니다. 웹사이트 개발을 도와드리겠습니다.
더 정확한 결과를 위해 몇 가지 질문드리겠습니다.

[Use AskUserQuestion]
1. 기술 스택 선택
2. 주요 기능 선택
3. 프로젝트 규모 확인

[After getting answers, proceed with implementation]
```

### Example 2: Vague Optimization Request
**User**: "코드 최적화해줘"

**Your Response**:
```
코드 최적화를 도와드리겠습니다.
먼저 어떤 측면의 최적화가 필요한지 확인하겠습니다.

[Use AskUserQuestion for optimization type]
[Ask for file path if not specified]

[Proceed with targeted optimization]
```

## Best Practices
1. **Keep questions focused**: Ask only what's necessary
2. **Provide sensible defaults**: Include common choices in options
3. **Allow custom input**: Always include "직접 입력" or "기타" option
4. **Be conversational**: Don't make it feel like a form
5. **Group related questions**: Ask related questions together
6. **Proceed efficiently**: Once you have enough context, start working

## Integration with Hook
This skill works in conjunction with the UserPromptSubmit hook, which detects ambiguity and adds context. When you see a context marker like:

```
<!-- VIBE CODING ASSISTANT: PROMPT CLARIFICATION NEEDED -->
```

You should automatically activate this skill and use AskUserQuestion to gather the needed information.

## Notes
- This skill enhances vibe coding by ensuring Claude has sufficient context before starting work
- The interactive selections make it easy for users to provide details without typing long responses
- Always be respectful of user's time - if the prompt is clear enough, don't ask unnecessary questions
