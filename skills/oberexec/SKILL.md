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
2. Invoke oberagent (validate prompt before EVERY dispatch)
      ↓
3. Phase Dispatch (execute with context-minimal subagents)
      ↓
4. Checkpoint Validation (code review subagent via oberagent)
      ↓
5. Progress Update (mark complete, advance)
      ↓
   Loop to Step 2 until all phases complete
      ↓
6. Final Validation (integration review via oberagent)
```

**Every agent dispatch in oberexec goes through oberagent first.**

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

### Before Every Dispatch: Identify Skills for oberagent

**Subagents don't inherit skill awareness.** Before invoking oberagent, you must identify which skills apply to the phase so oberagent can include them in the subagent prompt.

#### Skill Identification Process

**Even if the plan specifies skills, verify and augment.** Plans may be incomplete, outdated, or missing skills that become relevant during execution. Treat plan-specified skills as a starting point, not the final answer.

For each phase, ask: **"What type of work is this phase doing?"**

| If Phase Involves... | Skill to Load | Why |
|---------------------|---------------|-----|
| Writing/modifying code | code-foundations | Construction quality, defensive programming |
| Reviewing code or plans | code-foundations | Design principles, review standards |
| Debugging or investigating failures | oberdebug | Hypothesis-driven investigation |
| Writing prompts for LLMs | oberprompt | Prompt engineering principles |
| Planning implementation | oberplan | Meta-planning orchestration |
| Building UI/frontend | frontend-design (if available) | Design patterns, accessibility |
| Working with specific formats | Relevant format skill (pdf, docx, etc.) | Format-specific workflows |

**Heuristics when uncertain:**
- If writing ANY code → include code-foundations
- If the phase could fail and need debugging → consider oberdebug
- If multiple skills seem relevant → include all of them (cheap to invoke, expensive to miss)
- If pure exploration/search → no skills needed

#### Pass Skills to oberagent

When invoking oberagent, specify which skills to include:

```
Invoke oberagent for Phase [N].
Skills identified for this phase: [skill-1, skill-2]
Phase objective: [objective from plan]
```

oberagent will incorporate these into the subagent prompt.

### Invoke oberagent

**After identifying skills, invoke the oberagent skill.** This ensures:
- Prompt follows oberprompt principles (outcome-focused, minimal constraints)
- Agent type matches the purpose
- Identified skills are passed to the subagent
- Validation checklist is completed

```
1. Identify applicable skills (above)
2. Invoke oberagent skill with skills list
3. oberagent invokes oberprompt first, then: define purpose → select type → write prompt → validate
4. Only then dispatch the Task
```

**The chain is: oberexec → oberagent → oberprompt → agent prompt.**

### Dispatch Template

For each implementation phase, dispatch using this pattern:

```
Task(
  subagent_type="general-purpose",
  description="[Phase N]: [3-word summary]",
  prompt="First invoke [identified skills, comma-separated].

  OBJECTIVE: [Phase objective from plan]

  SCOPE: [Files/directories to work in]

  CONSTRAINTS:
  - Return FILE NAMES ONLY (no code content)
  - Format: FILES MODIFIED: [...], FILES CREATED: [...], SUMMARY: [1-2 sentences]

  [Additional context from plan if needed]"
)
```

**Note:** The template above is the OUTPUT of following oberagent. Don't skip oberagent and jump to the template.

### Agent Type Selection

| Phase Type | Agent | Typical Skills |
|------------|-------|----------------|
| Code implementation | general-purpose | code-foundations |
| Refactoring | general-purpose | code-foundations |
| Test writing | general-purpose | code-foundations |
| Debugging | general-purpose | oberdebug, code-foundations |
| UI/Frontend work | general-purpose | frontend-design, code-foundations |
| Research/exploration | Explore | (none needed) |
| Git operations | Bash | (none needed) |
| Build/lint | Bash | (none needed) |

**These are starting points.** Use the skill identification process above to determine actual skills per phase.

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

**Identify skills for review:** Reviews typically need `code-foundations`. If the phase involved UI work, also include `frontend-design`. If debugging was involved, include `oberdebug`.

```
Task(
  subagent_type="general-purpose",
  description="Review: [Phase N] implementation",
  prompt="First invoke [identified review skills].

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
| PASS | Git commit, mark phase complete, advance to next |
| NEEDS_REVISION | Re-dispatch implementation agent with issues |
| FAIL | Stop execution, report to user |

### Git Commit on Checkpoint Pass

**When a checkpoint passes, commit the work before advancing.**

```bash
git add -A && git commit -m "feat([feature]): complete Phase [N] - [phase name]

[1-2 sentence summary of what was implemented]

Checkpoint: [checkpoint name] PASSED

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Why commit at checkpoints:**
- Work is validated and known-good
- Creates restore points if later phases fail
- Enables partial rollback without losing progress
- Documents implementation in git history

**Commit message format:**
- `feat([feature]):` for new functionality
- `fix([feature]):` for bug fixes during revision
- Include phase number and name
- Reference checkpoint that passed

### Revision Dispatch

If checkpoint returns NEEDS_REVISION:

**Re-use the same skills identified for the original phase.** Revisions need the same domain knowledge.

```
Task(
  subagent_type="general-purpose",
  description="Fix: [Phase N] revisions",
  prompt="First invoke [same skills as original phase].

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

After all phases complete, run two final reviews:

### Step 1: Integration Review Agent

**Aggregate all skills used across phases.** The integration review should have access to all domain knowledge used during implementation.

```
Task(
  subagent_type="general-purpose",
  description="Final review: plan integration",
  prompt="First invoke [all skills used across plan phases].

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

### Step 2: Final Code Review Agent

**After integration passes, dispatch comprehensive code review via oberagent.**

**Always include code-foundations for final review.** Add other skills based on what the plan involved (frontend-design for UI work, etc.).

```
Task(
  subagent_type="pr-review-toolkit:code-reviewer",
  description="Final code review: all changes",
  prompt="First invoke [code-foundations + other relevant skills].

  FINAL CODE REVIEW: Review all implementation changes from this plan.

  FILES TO REVIEW:
  [Aggregate list from all phases]

  REVIEW USING:
  1. code-foundations principles (construction quality, defensive programming)
  2. Project CLAUDE.md guidelines (if present)
  3. Existing codebase patterns

  CHECK FOR:
  - Code quality and readability
  - Error handling completeness
  - Edge cases and defensive programming
  - Naming conventions and consistency
  - No hardcoded values that should be configurable
  - No security vulnerabilities (OWASP top 10)
  - Tests cover critical paths

  RETURN FORMAT:
  VERDICT: [APPROVED | NEEDS_CHANGES]

  If NEEDS_CHANGES:
  ISSUES:
  - [file:line] - [severity: high/medium/low] - [issue]

  SUMMARY: [2-3 sentences on overall quality]"
)
```

### Final Review Decision Table

| Integration | Code Review | Action |
|-------------|-------------|--------|
| COMPLETE | APPROVED | Final git commit, execution complete |
| COMPLETE | NEEDS_CHANGES | Address issues, re-review (max 1 cycle) |
| INCOMPLETE | — | Return to relevant phase |
| ISSUES | — | Report to user, await decision |

### Final Git Commit

**After both reviews pass, commit with comprehensive message:**

```bash
git add -A && git commit -m "feat([feature]): complete [plan name]

[Summary of what was implemented]

Phases completed: [N]
Checkpoints passed: [M]
Final review: APPROVED

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Execution State Machine

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐              │
│  │ Dispatch │───▶│ Execute  │───▶│ Checkpoint │              │
│  │  Phase   │    │  Agent   │    │   Review   │              │
│  └──────────┘    └──────────┘    └────────────┘              │
│       ▲                               │                       │
│       │                               ▼                       │
│       │         ┌─────────┐    ┌────────────┐                │
│       │         │ Revision│◀───│  PASS?     │                │
│       │         │  Agent  │ NO └────────────┘                │
│       │         └─────────┘          │ YES                   │
│       │              │               ▼                        │
│       │              │         ┌────────────┐                │
│       │              │         │ Git Commit │ ◀── checkpoint │
│       │              │         └────────────┘     restore    │
│       │              │               │            point      │
│       │              ▼               ▼                        │
│       └─────────────────────▶ ┌────────────┐                 │
│                               │ Next Phase │                 │
│                               └────────────┘                 │
│                                      │                        │
│                                      ▼                        │
│                           ┌──────────────────┐               │
│                           │ Integration      │               │
│                           │ Review           │               │
│                           └──────────────────┘               │
│                                      │                        │
│                                      ▼                        │
│                           ┌──────────────────┐               │
│                           │ Final Code Review│               │
│                           │ (code-reviewer)  │               │
│                           └──────────────────┘               │
│                                      │                        │
│                                      ▼                        │
│                           ┌──────────────────┐               │
│                           │ Final Commit     │               │
│                           └──────────────────┘               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Red Flags - STOP

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "Skip checkpoint, phase was simple" | Simple phases still have bugs | Run the checkpoint |
| "Simple phase, no skills needed" | If it writes code, it needs code-foundations | Follow the heuristics |
| "Review will just slow us down" | Debugging will slow you more | Run the checkpoint |
| "I'll review all files at the end" | Late discovery = expensive fixes | Review after each phase |
| "Agent returned full code, I'll use it" | You're burning context | Re-dispatch with constraints |
| "Failed checkpoint twice, keep trying" | Escalate to user | Stop after 2 revision cycles |
| "Phase 3 doesn't need code-foundations" | All impl phases need it | Pass the skill |
| "I know oberagent, I'll skip it" | You'll miss the checklist | Invoke oberagent every time |
| "oberagent doesn't need oberprompt" | oberagent requires oberprompt in Step 1 | Let oberagent invoke oberprompt |
| "Plan already specifies skills" | Plans may be incomplete or outdated | Verify and augment plan skills |
| "I'll just use code-foundations" | Different phases need different skills | Check the skill table each time |

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

**0. Identify Skills for Phase 1:**
Phase 1 involves writing code → `code-foundations`

**1. Dispatch Phase 1:**
```
Task(general-purpose, "Phase 1: auth service",
  "First invoke code-foundations.
   Implement auth service with login/logout in src/auth/.
   Return FILE NAMES ONLY.")
```

**2. Phase 1 Returns:**
```
FILES CREATED: src/auth/service.ts, src/auth/types.ts
FILES MODIFIED: src/auth/index.ts
SUMMARY: Implemented AuthService with login/logout methods.
```

**3. Checkpoint Review (same skill):**
```
Task(general-purpose, "Review: Phase 1",
  "First invoke code-foundations.
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

**5. Git Commit (checkpoint passed):**
```bash
git add -A && git commit -m "feat(auth): complete Phase 1 - auth service

Implemented AuthService with login/logout methods.

Checkpoint: Auth tests pass - PASSED

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**6. Advance to Phase 2...**

---

## Integration

### With oberplan
Receives approved plans for execution.

### With oberagent
**Explicitly invoked before EVERY agent dispatch.** oberagent validates prompt structure, identifies skills, and completes the agent prompt checklist. This is not optional - it's part of the workflow.

### With oberprompt
**Invoked by oberagent in Step 1.** oberagent requires oberprompt invocation before writing any agent prompt. This ensures constraint budget, progressive disclosure, and validation checklist are applied to every dispatch.

### With code-foundations
All implementation and review agents invoke code-foundations first (specified in their prompts).

### With pr-review-toolkit
Final code review uses `pr-review-toolkit:code-reviewer` for comprehensive quality assessment. Combines with code-foundations for defense-in-depth review.

### With oberdebug
If execution reveals bugs, escalate to oberdebug workflow.
