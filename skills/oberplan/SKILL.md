---
name: oberplan
description: Use when planning ANY implementation, feature, project, or multi-step task. Triggers on "plan", "design", "build", "implement", "create", "add feature", "how should I approach", "where do I start", "help me think through", "I want to build", "let's make", "need to implement", "new project", "from scratch". Also triggers when user seems unsure how to approach a problem or is about to start coding without a clear plan.
---

# Oberplan

Meta-planning skill that orchestrates the entire planning process - from understanding the problem domain, through iterative plan development, to final quality review.

## The Iron Law

```
NO PLAN SHIPS WITHOUT FINAL REVIEW
```

This applies to:
- "Quick" plans
- "Simple" features
- Plans you've "done before"
- Your 10th plan after 9 successes

**Skipping final review = shipping gaps you didn't catch.**

---

## Workflow

```
1. Skill Discovery (identify domain lens)
      ↓
2. Load Lens Skill (invoke if applicable)
      ↓
3. Clarify the Idea (natural dialogue)
      ↓
4. Plan Development (iterative or direct)
      ↓
5. User Approval
      ↓
6. Final Review (automated gap analysis)
      ↓
7. Output Planning Document
```

---

## Phase 1: Skill Discovery

**Purpose:** Identify which creative/design skill serves as the "lens" for the user's problem domain.

| User Signal | Domain | Lens Skill |
|-------------|--------|------------|
| "UI", "frontend", "page", "component", "web app" | Frontend | frontend-design |
| "API", "interface", "module", "service", "abstraction" | Architecture | designing-deep-modules |
| "feature", "functionality", "add X to Y" | Feature Dev | brainstorming |
| "prompt", "skill", "agent", "LLM", "system message" | Prompt/Agent | oberprompt |
| "refactor", "clean up", "improve structure" | Refactor | cc-refactoring-guidance |
| General/unclear | General | brainstorming |

### Redirects (Not Planning)

| Signal | Redirect To |
|--------|-------------|
| "debug", "fix", "broken", "not working" | oberdebug |
| "review", "check this code" | code-foundations |

### Behavior

- **High confidence** → auto-select lens, announce: "Using [skill] as our lens for this."
- **Uncertain** → ask user to confirm lens selection
- **Multiple domains** → ask which to focus on first

---

## Phase 2: Load Lens Skill

If a lens skill was identified, invoke it now.

The lens skill provides domain-specific guidance that informs the planning process. For example:
- frontend-design will guide UI/UX considerations
- designing-deep-modules will guide API design
- oberprompt will guide prompt structure

**Announce:** "Loading [skill] to guide our planning."

---

## Phase 3: Clarify the Idea

**Purpose:** Natural dialogue to understand what we're building.

### The Approach

- Check project context first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice when possible, open-ended when needed
- Only one question per message
- Focus on: purpose, constraints, success criteria
- Stop when you have enough to propose approaches

### Then

- Propose 2-3 different approaches with trade-offs
- Lead with your recommendation and why
- Let user pick or refine

### Key Principles

- **One question at a time** - don't overwhelm
- **Multiple choice preferred** - easier to answer
- **YAGNI ruthlessly** - remove unnecessary scope
- **Be flexible** - go back and clarify when needed

### Planning-Specific Questions

Once the idea is clear, also cover:
- Execution mode (single agent vs parallel agents)
- Plan granularity needed
- Skills executing agents should invoke

---

## Phase 4: Plan Development

### Two Modes

**Iterative Mode (default):**
- Present plan section by section (200-300 words each)
- Check after each: "Does this look right?"
- User can adjust, continue, or say "just give me the full plan"

**Direct Mode:**
- User asks for complete plan upfront
- Generate full plan, present for review
- Faster, but less collaborative

### Plan Sections (Iterative Order)

1. "Here's my understanding of what we're building..." → confirm
2. "Here's the approach I recommend..." → confirm
3. "Here's Task 1..." → confirm
4. Continue for each major task
5. "Here's how we'll validate it works..." → confirm

### User Controls

| User Says | Action |
|-----------|--------|
| "looks good" / "continue" | Next section |
| "change X" | Revise and re-present |
| "skip to full plan" | Switch to direct mode |
| "start over" | Back to Phase 3 |

### Task Structure

Each task includes:
- **Outcome** - what exists when done
- **Files** - explicit paths to create/modify
- **Steps** - bite-sized (2-5 min each)
- **Success criteria** - how to verify
- **Skills** - for executing agent to invoke

---

## Phase 5: User Approval

Before final review, confirm:

**"Here's the complete plan. Does this capture what you want to build?"**

User options:
- "Yes, looks good" → proceed to Final Review
- "Change X" → revise and re-confirm
- "Let's discuss Y" → back to clarification

---

## Phase 6: Final Review

**Purpose:** Automatically review for gaps the user might have missed. This is the Iron Law - non-negotiable.

### Review Checklist

| Check | Looking For |
|-------|-------------|
| **Completeness** | Every task has success criteria? Dependencies explicit? Edge cases covered? |
| **Executability** | File paths explicit? Steps small enough for single agent? Commands exact? |
| **Consistency** | Follows existing project patterns? Matches stated constraints? |
| **Risk** | Steps that could break existing code? Hidden assumptions? Missing error handling? |
| **Skills** | Right skills identified for executing agents? |

### Output Format

```
PLAN REVIEW COMPLETE

✓ Passed: [list what's solid]

⚠ Suggestions: [non-blocking improvements]

✗ Issues: [must fix before execution]
```

### If Issues Found

- Present issues to user
- Revise plan together
- Re-run review after fixes

### If Clean

"Plan passed review. Ready to save and execute?"

---

## Phase 7: Output Planning Document

**Save to:** `docs/plans/YYYY-MM-DD-<name>-plan.md`

### Document Template

```markdown
# [Feature Name] Implementation Plan

> **For Agents:** Invoke [relevant skills] before starting each task.

**Goal:** [One sentence - what exists when done]

**Approach:** [2-3 sentences - how we're building it]

**Execution Mode:** [Single agent / Parallel agents]

---

## Task 1: [Name]

**Outcome:** [What exists when this task is done]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts`

**Steps:**
1. [Bite-sized step]
2. [Bite-sized step]
3. [Verify/test step]

**Success:** [How to know it worked]

---

## Task 2: [Name]
...

---

## Validation

**How to verify the full plan worked:**
- [ ] [Criteria 1]
- [ ] [Criteria 2]
```

### After Saving

Offer execution options:

**"Plan saved to `docs/plans/<filename>.md`. How do you want to execute?"**

1. **Subagent-Driven (this session)** - Dispatch fresh subagent per task, review between tasks
2. **Parallel Session** - Open new session with executing-plans skill

If subagent-driven: invoke `superpowers:subagent-driven-development`
If parallel session: guide user to open new session, invoke `superpowers:executing-plans`

---

## Red Flags - STOP and Reconsider

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "I'll just start coding" | You'll build the wrong thing or miss cases | Complete the planning process |
| "The plan is in my head" | Heads don't have version control or review | Write it down |
| "This is too simple to plan" | Simple things have hidden complexity | At minimum, do quick plan + review |
| "Planning takes too long" | Rework takes longer | 15 min planning saves hours of rework |
| "I'll figure it out as I go" | You'll figure out you missed something | Plan first, then execute |
| "The user approved it, we're done" | User approval ≠ gap-free plan | Final review is mandatory |

---

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| **brainstorming** | Often used as lens skill; oberplan adds execution focus |
| **writing-plans** | Complementary - oberplan discovers, writing-plans formats |
| **oberagent** | Use when dispatching agents to execute plan tasks |
| **oberdebug** | Redirect if user actually needs debugging, not planning |
| **executing-plans** | Handoff target for plan execution |
