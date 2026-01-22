---
name: oberexec
description: "DEPRECATED: Use code-foundations:building instead. Plan execution for coding tasks is better grounded in code-foundations. For general-purpose plan/execute frameworks, consider other options."
---

# Skill: oberexec

> **DEPRECATED**
>
> This skill is being retired. For coding tasks, use:
> - `code-foundations:building` - Checklist-based execution with progress tracking
> - Pairs with `code-foundations:whiteboarding` for the full plan-to-execution workflow
>
> **Why?** Planning and execution of coding tasks are better grounded in code-foundations, which provides domain-specific guidance (Code Complete, APOSD) rather than generic orchestration.
>
> **For general-purpose plan/execute needs**, there are likely better frameworks available that focus on orchestration without the coding-specific overhead this skill attempted.

Checklist-driven plan executor. Maintains a persistent execution file that IS the plan state. The skill's sole purpose is completing that checklist.

## The Iron Law

```
THE CHECKLIST FILE IS THE ONLY TRUTH
```

This applies to:
- Every action is a checklist item
- No work happens without updating the file
- If interrupted, resume from the file
- The file survives context resets

**No checklist = no execution. No update = work didn't happen.**

---

## Execution File

### Location

```
~/.local/state/oberexec/{project}-{timestamp}.md
```

Create the directory if it doesn't exist.

### Format

```markdown
# Execution: [Plan Name]

Source: [path to plan file]
Started: [ISO timestamp]
Status: IN_PROGRESS | COMPLETED | FAILED

## Checklist

- [ ] 1.1 [item description]
- [ ] 1.2 [item description]
- [x] 1.3 [item description] ✓ [brief result]
...

## Log

[HH:MM:SS] [item id] [status] - [details]
```

### Checklist Syntax

| Syntax | Meaning |
|--------|---------|
| `- [ ]` | Pending |
| `- [~]` | In progress |
| `- [x]` | Complete |
| `- [!]` | Failed/blocked |

---

## Workflow

```
1. Generate Checklist
   - Parse plan file
   - Expand phases → discrete items
   - Write execution file
      ↓
2. Execute Loop
   - Read file → find first unchecked item
   - Mark item [~] in progress
   - Execute the item
   - Mark item [x] complete (or [!] failed)
   - Add log entry
   - Write file
   - Loop
      ↓
3. Complete
   - All items [x]
   - Update status: COMPLETED
   - Report to user
```

**Every iteration reads and writes the file.**

---

## Checklist Generation

### Expansion Rules

Each plan phase expands to discrete action items:

**Implementation Phase:**
```markdown
## Phase 1: Implement auth service
- Agent: general-purpose
- Skills: code-foundations
- Output: Auth service with login/logout
```

Expands to:
```markdown
- [ ] 1.1 Identify skills for Phase 1
- [ ] 1.2 Invoke oberagent for implementation dispatch
- [ ] 1.3 Dispatch general-purpose agent: auth service
- [ ] 1.4 Verify agent returned file list
- [ ] 1.5 Invoke oberagent for review dispatch
- [ ] 1.6 Dispatch code review agent
- [ ] 1.7 Handle review verdict
- [ ] 1.8 Git commit checkpoint
```

**Checkpoint:**
```markdown
## Checkpoint: Auth tests pass
```

Expands to:
```markdown
- [ ] CP1.1 Run checkpoint validation: auth tests
- [ ] CP1.2 Handle result (pass/fail)
```

**Final Validation:**
```markdown
- [ ] FINAL.1 Dispatch integration review agent
- [ ] FINAL.2 Dispatch final code review agent
- [ ] FINAL.3 Final git commit
```

### Item Numbering

| Pattern | Meaning |
|---------|---------|
| `1.1, 1.2, 1.3` | Phase 1 items |
| `2.1, 2.2` | Phase 2 items |
| `CP1.1` | Checkpoint 1 items |
| `REV1.1` | Revision loop items |
| `FINAL.1` | Final validation items |

---

## Item Types

| Type | Description | Execution |
|------|-------------|-----------|
| `Identify skills` | Determine which skills apply to phase | Use skill identification table |
| `Invoke oberagent` | Validate prompt before dispatch | Invoke oberagent skill with skills list |
| `Dispatch agent` | Run subagent for implementation | Task tool with prompt from oberagent |
| `Verify file list` | Confirm agent returned files only | Check format, no code content |
| `Dispatch review` | Run code review agent | Task tool for checkpoint |
| `Handle verdict` | Process PASS/NEEDS_REVISION/FAIL | Decision logic, may spawn revision items |
| `Git commit` | Commit checkpoint | Bash git commit |
| `Run validation` | Execute test/build/check | Bash command |

---

## Executing Items

### Skill Identification Items

Before dispatching agents, identify applicable skills:

| If Phase Involves | Skill |
|-------------------|-------|
| Writing/modifying code | code-foundations |
| Reviewing code | code-foundations |
| Debugging | oberdebug |
| Writing LLM prompts | oberprompt |
| UI/frontend | frontend-design |

Update checklist:
```markdown
- [x] 1.1 Identify skills for Phase 1 ✓ code-foundations
```

### Invoke oberagent Items

Invoke the oberagent skill before every dispatch:

```
Invoke oberagent for Phase [N].
Skills identified: [skill-1, skill-2]
Phase objective: [objective from plan]
```

Update checklist:
```markdown
- [x] 1.2 Invoke oberagent for implementation dispatch ✓ prompt validated
```

### Dispatch Agent Items

After oberagent validation, dispatch the agent:

```
Task(
  subagent_type="general-purpose",
  description="Phase [N]: [summary]",
  prompt="[Prompt from oberagent]

  CONSTRAINTS:
  - Return FILE NAMES ONLY (no code content)
  - Format: FILES MODIFIED: [...], FILES CREATED: [...], SUMMARY: [1-2 sentences]"
)
```

Update checklist:
```markdown
- [x] 1.3 Dispatch general-purpose agent: auth service ✓ 3 files
```

Add to log:
```
[10:30:15] 1.3 COMPLETE - FILES CREATED: src/auth/service.ts, src/auth/types.ts
```

### Verify File List Items

Confirm agent returned file names only, not code content:

| Agent Returned | Action |
|----------------|--------|
| File names only | Mark complete, proceed |
| Code content | Log warning, extract file names, proceed |
| Error/failure | Mark failed, escalate |

### Dispatch Review Items

Invoke oberagent, then dispatch code review:

```
Task(
  subagent_type="general-purpose",
  description="Review: Phase [N]",
  prompt="[Review prompt from oberagent]

  FILES TO REVIEW: [list from implementation agent]

  RETURN FORMAT:
  VERDICT: [PASS | NEEDS_REVISION | FAIL]
  ISSUES: [if any]
  SUMMARY: [1-2 sentences]"
)
```

### Handle Verdict Items

| Verdict | Action |
|---------|--------|
| PASS | Mark complete, proceed to git commit |
| NEEDS_REVISION | Insert revision items, execute them |
| FAIL | Mark failed, escalate to user |

**On NEEDS_REVISION**, insert new items:
```markdown
- [x] 1.6 Dispatch code review agent ✓ NEEDS_REVISION
- [ ] REV1.1 Dispatch revision agent with issues
- [ ] REV1.2 Dispatch code review agent (attempt 2)
- [ ] REV1.3 Handle review verdict
- [ ] 1.7 Git commit checkpoint  <- resume here after revision
```

**Max 2 revision cycles.** After 2 failures, mark [!] and escalate.

### Git Commit Items

```bash
git add -A && git commit -m "feat([feature]): Phase [N] - [name]

[1-2 sentence summary]

Checkpoint: [name] PASSED

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

Update checklist:
```markdown
- [x] 1.8 Git commit checkpoint ✓ abc1234
```

---

## Updating the File

### After Every Item

1. Read current file
2. Update item status: `[ ]` → `[x]` (or `[!]`)
3. Add result annotation: `✓ [brief result]`
4. Add log entry
5. Write file

### Log Entry Format

```
[HH:MM:SS] [item-id] [STATUS] - [details]
```

Examples:
```
[10:30:15] 1.3 COMPLETE - FILES: src/auth/service.ts, src/auth/types.ts
[10:31:02] 1.6 COMPLETE - VERDICT: PASS
[10:31:45] 1.8 COMPLETE - COMMIT: abc1234
[10:32:00] 2.1 FAILED - Agent timeout, escalating
```

### Inserting Items

When revision is needed, insert items after current position:

```markdown
- [x] 1.6 Dispatch code review ✓ NEEDS_REVISION
- [ ] REV1.1 Dispatch revision agent    <- inserted
- [ ] REV1.2 Re-review                  <- inserted
- [ ] 1.7 Git commit checkpoint         <- original next item
```

---

## Resumption

If execution is interrupted (context reset, error, user pause):

### Resume Protocol

1. Read execution file
2. Find first item that is `[ ]` or `[~]`
3. If `[~]` (was in progress): verify state, re-execute if needed
4. Continue from that item

### Resumption Check

```
Read: ~/.local/state/oberexec/{project}-*.md
If exists and Status: IN_PROGRESS:
  "Found interrupted execution. Resume from item [X.Y]?"
```

### State Verification

For `[~]` items, verify before re-executing:

| Item Type | Verification |
|-----------|--------------|
| Dispatch agent | Check if files exist |
| Git commit | Check git log |
| Review | Re-run review |

---

## Final Validation

After all phase items complete:

```markdown
- [ ] FINAL.1 Invoke oberagent for integration review
- [ ] FINAL.2 Dispatch integration review agent
- [ ] FINAL.3 Invoke oberagent for final code review
- [ ] FINAL.4 Dispatch pr-review-toolkit:code-reviewer
- [ ] FINAL.5 Handle final verdict
- [ ] FINAL.6 Final git commit
```

### Integration Review

```
Task(
  subagent_type="general-purpose",
  description="Final: integration review",
  prompt="First invoke [all skills used].

  INTEGRATION REVIEW for [plan objective].

  ALL FILES MODIFIED: [aggregate list]

  CHECK:
  1. All deliverables present
  2. Components integrate correctly
  3. Build passes
  4. Tests pass

  RETURN: VERDICT: [COMPLETE | INCOMPLETE | ISSUES]"
)
```

### Final Code Review

```
Task(
  subagent_type="pr-review-toolkit:code-reviewer",
  description="Final: code review",
  prompt="First invoke code-foundations.

  FINAL CODE REVIEW for all changes.

  FILES: [aggregate list]

  RETURN: VERDICT: [APPROVED | NEEDS_CHANGES]"
)
```

### Completion

When all items `[x]`:

1. Update file status: `Status: COMPLETED`
2. Add final log entry: `[HH:MM:SS] EXECUTION COMPLETE`
3. Report to user

---

## Red Flags - STOP

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "Skip updating the file" | File IS the truth | Update after every item |
| "I'll batch updates" | Interruption loses state | Update immediately |
| "This item is obvious, skip it" | Every action is an item | Execute and mark |
| "File is overhead" | File enables resumption | Embrace it |
| "I remember where I was" | Context resets happen | Read the file |
| "Mark complete before doing" | That's lying | Do then mark |
| "Revision loop, just keep trying" | Max 2 cycles | Escalate after 2 |

---

## Context-Saving Constraint

**All implementation subagents return FILE NAMES ONLY.**

```
FILES MODIFIED:
- src/auth/login.ts
- src/auth/middleware.ts

FILES CREATED:
- src/auth/oauth.ts

SUMMARY: [1-2 sentences max]
```

**Do NOT have agents return:**
- Full file contents
- Code snippets
- Detailed explanations

The review agent examines actual files.

---

## Example Execution

### Input: Plan with 2 phases

### Generated Checklist

```markdown
# Execution: Auth Feature

Source: ~/.local/state/oberplan/plans/auth-20240115.md
Started: 2024-01-15T10:30:00Z
Status: IN_PROGRESS

## Checklist

- [ ] 1.1 Identify skills for Phase 1
- [ ] 1.2 Invoke oberagent for implementation
- [ ] 1.3 Dispatch agent: auth service
- [ ] 1.4 Verify file list
- [ ] 1.5 Invoke oberagent for review
- [ ] 1.6 Dispatch code review
- [ ] 1.7 Handle verdict
- [ ] 1.8 Git commit checkpoint
- [ ] 2.1 Identify skills for Phase 2
- [ ] 2.2 Invoke oberagent for implementation
- [ ] 2.3 Dispatch agent: auth middleware
- [ ] 2.4 Verify file list
- [ ] 2.5 Invoke oberagent for review
- [ ] 2.6 Dispatch code review
- [ ] 2.7 Handle verdict
- [ ] 2.8 Git commit checkpoint
- [ ] FINAL.1 Invoke oberagent for integration
- [ ] FINAL.2 Dispatch integration review
- [ ] FINAL.3 Invoke oberagent for code review
- [ ] FINAL.4 Dispatch final code review
- [ ] FINAL.5 Handle final verdict
- [ ] FINAL.6 Final git commit

## Log

[10:30:00] STARTED
```

### After Phase 1 Complete

```markdown
## Checklist

- [x] 1.1 Identify skills for Phase 1 ✓ code-foundations
- [x] 1.2 Invoke oberagent for implementation ✓ validated
- [x] 1.3 Dispatch agent: auth service ✓ 3 files
- [x] 1.4 Verify file list ✓ ok
- [x] 1.5 Invoke oberagent for review ✓ validated
- [x] 1.6 Dispatch code review ✓ PASS
- [x] 1.7 Handle verdict ✓ proceed
- [x] 1.8 Git commit checkpoint ✓ abc1234
- [~] 2.1 Identify skills for Phase 2
...

## Log

[10:30:00] STARTED
[10:30:05] 1.1 COMPLETE - skills: code-foundations
[10:30:10] 1.2 COMPLETE - prompt validated
[10:30:45] 1.3 COMPLETE - FILES: src/auth/service.ts, types.ts, index.ts
[10:30:50] 1.4 COMPLETE - verified 3 files
[10:31:00] 1.5 COMPLETE - prompt validated
[10:31:30] 1.6 COMPLETE - VERDICT: PASS
[10:31:32] 1.7 COMPLETE - proceeding
[10:31:40] 1.8 COMPLETE - commit abc1234
[10:31:45] 2.1 STARTED
```

---

## Integration

### With oberplan
Receives plan file path. Generates checklist from plan content.

### With oberagent
Invoked before EVERY agent dispatch (checklist items 1.2, 1.5, etc.).

### With oberprompt
Invoked by oberagent. Chain: oberexec → oberagent → oberprompt → dispatch.

### With code-foundations
All implementation and review agents invoke code-foundations.

### With pr-review-toolkit
Final code review uses `pr-review-toolkit:code-reviewer`.

### With oberdebug
If execution reveals bugs, escalate to oberdebug workflow.
