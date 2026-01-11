---
name: oberexec
description: Execute approved plans using subagent orchestration. Use after oberplan produces a plan and user approves. Dispatches agents for each phase, enforces checkpoints with code-review subagents, and tracks progress. Triggers on "execute the plan", "run the plan", "implement the plan", "start execution", "dispatch agents for plan", or when you have an approved plan ready for implementation.
---

# Skill: oberexec

Subagent-driven plan executor that orchestrates implementation phases with checkpoints and code reviews.

## The Iron Law

```
NO PHASE ADVANCES WITHOUT CHECKPOINT VALIDATION
```

This applies to:
- "Simple" phases
- Phases that "obviously worked"
- The 5th phase after 4 successes
- "Quick" checkpoint skipping

**Skipping checkpoints = compounding bugs = rework.**

---

## Required Workflow

```
1. Plan Validation (verify plan structure)
      ↓
2. Phase Dispatch (execute with context-minimal subagents)
      ↓
3. Checkpoint Validation (code review subagent)
      ↓
4. Progress Update (mark complete, advance)
      ↓
   Loop to Step 2 until all phases complete
      ↓
5. Final Validation (integration review)
```

---

## Context-Saving Constraint

**All implementation subagents return FILE NAMES ONLY.**

This is critical for:
- Preserving main agent context
- Enabling long plan execution
- Keeping reviews focused

### Return Format for Implementation Agents

```
FILES MODIFIED:
- src/auth/login.ts
- src/auth/middleware.ts
- tests/auth/login.test.ts

FILES CREATED:
- src/auth/oauth.ts

SUMMARY: [1-2 sentences max]
```

**Do NOT have agents return:**
- Full file contents
- Code snippets
- Detailed explanations
- Line-by-line changes

The checkpoint review agent will examine the actual files.

---

## Phase 1: Plan Validation

Before executing, verify the plan has required structure:

### Validation Checklist

| Check | Required |
|-------|----------|
| Each phase has agent type specified | YES |
| Each phase has clear objective | YES |
| Each phase has expected outputs | YES |
| Checkpoints exist after impl phases | YES |
| Dependencies form valid order | YES |

### If Plan Missing Structure

```
PLAN VALIDATION FAILED:
- Missing: [list gaps]
- Action: Return to oberplan or ask user for clarification
```

**Do NOT proceed with incomplete plans.**

---

## Phase 2: Phase Dispatch

### Dispatch Template

For each implementation phase, dispatch using this pattern:

```
Task(
  subagent_type="general-purpose",
  description="[Phase N]: [3-word summary]",
  prompt="First invoke the code-foundations skill.

  OBJECTIVE: [Phase objective from plan]

  SCOPE: [Files/directories to work in]

  CONSTRAINTS:
  - Return FILE NAMES ONLY (no code content)
  - Format: FILES MODIFIED: [...], FILES CREATED: [...], SUMMARY: [1-2 sentences]

  [Additional context from plan if needed]"
)
```

### Agent Type Selection

| Phase Type | Agent | Skills to Pass |
|------------|-------|----------------|
| Code implementation | general-purpose | code-foundations |
| Refactoring | general-purpose | code-foundations |
| Test writing | general-purpose | code-foundations |
| Research/exploration | Explore | (none needed) |
| Git operations | Bash | (none needed) |
| Build/lint | Bash | (none needed) |

### Parallel vs Sequential

| Situation | Action |
|-----------|--------|
| Phases are independent | Dispatch in parallel (single message, multiple Task calls) |
| Phase B depends on Phase A output | Sequential - wait for A to complete |
| Checkpoint required | Always sequential - wait for validation |

---

## Phase 3: Checkpoint Validation

**After every implementation phase, dispatch a code review subagent.**

### Code Review Agent Template

```
Task(
  subagent_type="general-purpose",
  description="Review: [Phase N] implementation",
  prompt="First invoke the code-foundations skill.

  REVIEW TASK: Validate the implementation from Phase [N].

  FILES TO REVIEW:
  [List files returned by implementation agent]

  CHECK FOR:
  1. Implementation matches phase objective: [objective]
  2. Code follows existing patterns in codebase
  3. No obvious bugs, edge cases missed, or security issues
  4. Tests are adequate (if test files included)

  RETURN FORMAT:
  VERDICT: [PASS | FAIL | NEEDS_REVISION]

  If FAIL/NEEDS_REVISION:
  ISSUES:
  - [file.ts:line] - [issue description]

  SUMMARY: [1-2 sentences]"
)
```

### Checkpoint Decision Table

| Review Verdict | Action |
|----------------|--------|
| PASS | Mark phase complete, advance to next |
| NEEDS_REVISION | Re-dispatch implementation agent with issues |
| FAIL | Stop execution, report to user |

### Revision Dispatch

If checkpoint returns NEEDS_REVISION:

```
Task(
  subagent_type="general-purpose",
  description="Fix: [Phase N] revisions",
  prompt="First invoke the code-foundations skill.

  REVISION TASK: Address review feedback for Phase [N].

  ISSUES TO FIX:
  [List from review agent]

  CONSTRAINTS:
  - Return FILE NAMES ONLY
  - Format: FILES MODIFIED: [...], SUMMARY: [1-2 sentences]"
)
```

Then re-run checkpoint validation. **Max 2 revision cycles per phase.** If still failing after 2 revisions, escalate to user.

---

## Phase 4: Progress Tracking

### Track execution state

```
EXECUTION PROGRESS:
- [x] Phase 1: [name] - COMPLETE
- [x] Checkpoint 1 - PASS
- [ ] Phase 2: [name] - IN_PROGRESS
- [ ] Checkpoint 2 - PENDING
- [ ] Phase 3: [name] - PENDING
...
```

### Update after each step

Use TodoWrite to track:
- Current phase
- Checkpoint status
- Any issues encountered
- Files modified so far

---

## Phase 5: Final Validation

After all phases complete, run integration review:

### Integration Review Agent

```
Task(
  subagent_type="general-purpose",
  description="Final review: plan integration",
  prompt="First invoke the code-foundations skill.

  INTEGRATION REVIEW: Validate complete implementation.

  ALL FILES MODIFIED:
  [Aggregate list from all phases]

  ORIGINAL OBJECTIVE:
  [Plan objective]

  CHECK FOR:
  1. All plan deliverables are present
  2. Components integrate correctly
  3. No regressions in existing functionality
  4. Build passes (if applicable)
  5. Tests pass (if applicable)

  RETURN FORMAT:
  VERDICT: [COMPLETE | INCOMPLETE | ISSUES]

  If INCOMPLETE/ISSUES:
  GAPS:
  - [description]

  SUMMARY: [2-3 sentences]"
)
```

---

## Execution State Machine

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐        │
│  │ Dispatch │───▶│ Execute  │───▶│ Checkpoint │        │
│  │  Phase   │    │  Agent   │    │   Review   │        │
│  └──────────┘    └──────────┘    └────────────┘        │
│       ▲                               │                 │
│       │                               ▼                 │
│       │         ┌─────────┐    ┌────────────┐          │
│       │         │ Revision│◀───│  PASS?     │          │
│       │         │  Agent  │ NO └────────────┘          │
│       │         └─────────┘          │ YES             │
│       │              │               ▼                  │
│       │              ▼         ┌────────────┐          │
│       └──────────────┴────────▶│ Next Phase │          │
│                                └────────────┘          │
│                                      │                  │
│                                      ▼                  │
│                           ┌──────────────────┐         │
│                           │ Final Validation │         │
│                           └──────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Red Flags - STOP

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "Skip checkpoint, phase was simple" | Simple phases still have bugs | Run the checkpoint |
| "Review will just slow us down" | Debugging will slow you more | Run the checkpoint |
| "I'll review all files at the end" | Late discovery = expensive fixes | Review after each phase |
| "Agent returned full code, I'll use it" | You're burning context | Re-dispatch with constraints |
| "Failed checkpoint twice, keep trying" | Escalate to user | Stop after 2 revision cycles |
| "Phase 3 doesn't need code-foundations" | All impl phases need it | Pass the skill |

---

## Example Execution

### Input: Plan from oberplan

```markdown
## Phase 1: Implement auth service
- Agent: general-purpose
- Skills: code-foundations
- Output: Auth service with login/logout

## Checkpoint: Auth tests pass

## Phase 2: Add auth middleware
- Agent: general-purpose
- Skills: code-foundations
- Output: Middleware protecting routes
```

### Execution Flow

**1. Dispatch Phase 1:**
```
Task(general-purpose, "Phase 1: auth service",
  "First invoke code-foundations skill.
   Implement auth service with login/logout in src/auth/.
   Return FILE NAMES ONLY.")
```

**2. Phase 1 Returns:**
```
FILES CREATED: src/auth/service.ts, src/auth/types.ts
FILES MODIFIED: src/auth/index.ts
SUMMARY: Implemented AuthService with login/logout methods.
```

**3. Checkpoint Review:**
```
Task(general-purpose, "Review: Phase 1",
  "First invoke code-foundations skill.
   Review auth implementation in:
   - src/auth/service.ts
   - src/auth/types.ts
   - src/auth/index.ts
   Check for: patterns, bugs, edge cases.
   Return: VERDICT, ISSUES if any, SUMMARY.")
```

**4. Review Returns:**
```
VERDICT: PASS
SUMMARY: Implementation follows codebase patterns, handles edge cases.
```

**5. Advance to Phase 2...**

---

## Integration

### With oberplan
Receives approved plans for execution.

### With oberagent
All agent dispatches follow oberagent principles (outcome-focused, minimal constraints).

### With code-foundations
All implementation and review agents invoke code-foundations first.

### With oberdebug
If execution reveals bugs, escalate to oberdebug workflow.
