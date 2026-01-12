# Bootstrap Guide Reference

This document contains detailed guidance for generating execution prompts and handoff procedures.

---

## Phase 9: Generate Execution Prompt

**Use oberprompt to create a bootstrap prompt for executing the plan in a fresh context.**

### Why a Fresh Context?

Complex plans may exceed the current context window during execution. A fresh context starts with:
- Full context budget available
- No accumulated conversation noise
- Clean state for oberexec

### Bootstrap Prompt Requirements

The bootstrap prompt must:
1. Load the saved plan file
2. Invoke the required skills (oberexec, code-foundations, etc.)
3. Provide enough context for oberexec to start immediately
4. Be self-contained (no dependencies on prior conversation)

### Generating the Prompt

Invoke oberprompt to craft the bootstrap prompt:

```
Invoke oberprompt skill, then:

TARGET: Bootstrap prompt for oberexec in fresh Claude Code context
MODEL TIER: Frontier (Claude Opus 4.5)
TASK TYPE: Agent orchestration startup

OUTCOME: Single prompt that:
1. Navigates to project directory
2. Invokes oberexec skill
3. Reads the saved plan file
4. Begins execution immediately

CONSTRAINTS:
- Must be copy-pasteable into fresh Claude Code session
- Must reference the saved plan file path
- Should include skill invocation instructions
- No ambiguity - oberexec should start without questions
```

### Bootstrap Prompt Template

```markdown
## oberexec Bootstrap Prompt

Copy this into a fresh Claude Code session:

---

Navigate to: [project path]

I need you to execute an approved implementation plan.

First, invoke the oberexec skill.

Then read the plan file at:
[saved plan file path]

Execute the plan following oberexec's workflow:
- Dispatch implementation agents phase by phase
- Run checkpoint reviews after each phase
- Track progress through all phases
- Complete final integration review

The plan has [N] phases and [M] checkpoints.

Required skills for agents: [skill list]

Begin execution now.

---
```

### Output

```
BOOTSTRAP PROMPT GENERATED:
- Saved to: [plan file path] (appended to plan document)
- Ready for: Copy into fresh Claude Code context
```

Present the bootstrap prompt to the user in a copyable format.

---

## Phase 10: Execution Handoff

**Provide bootstrap prompt for fresh context execution.**

Planning consumes significant context. Always hand off to a fresh session for execution.

### Handoff Process

```
1. Display the bootstrap prompt in a copyable format
2. Provide the saved plan file path
3. Instruct user to:
   a. Open new Claude Code session
   b. Navigate to project directory
   c. Paste the bootstrap prompt
4. End current planning session
```

### Handoff Output

```
PLAN COMPLETE - READY FOR EXECUTION

Plan saved to: [file path]

To execute, open a fresh Claude Code session and paste this prompt:
─────────────────────────────────────
[bootstrap prompt content]
─────────────────────────────────────

Instructions:
1. Open a new Claude Code session
2. Navigate to [project directory]
3. Paste the bootstrap prompt above
4. oberexec will begin plan execution

Planning session complete. Go rest, then execute fresh.
```
