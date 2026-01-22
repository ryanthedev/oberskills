---
name: oberplan
description: "DEPRECATED: Use code-foundations:whiteboarding and code-foundations:building instead. Planning and execution for coding tasks is better grounded in code-foundations. For general-purpose plan/execute frameworks, consider other options."
---

# Skill: oberplan

> **DEPRECATED**
>
> This skill is being retired. For coding tasks, use:
> - `code-foundations:whiteboarding` - Discovery-oriented planning that produces implementation-ready plans
> - `code-foundations:building` - Checklist-based execution of whiteboard plans
>
> **Why?** Planning and execution of coding tasks are better grounded in code-foundations, which provides domain-specific guidance (Code Complete, APOSD) rather than generic orchestration.
>
> **For general-purpose plan/execute needs**, there are likely better frameworks available that focus on orchestration without the coding-specific overhead this skill attempted.

Meta-skill that orchestrates planning by loading domain-specific lens skills, clarifying requirements, and producing agent-executable plans.

## The Iron Law

```
NO PLAN SHIPS WITHOUT USER CONFIRMATION AND FINAL REVIEW
```

This applies to:
- "Quick" features
- "Obvious" implementations
- Plans that "should be straightforward"
- Your 5th plan after 4 successes

**Skipping phases = agents execute wrong plans = rework.**

---

## Required Workflow

```
1. Lens Selection (match user intent to domain skill)
      ↓
2. Requirements Clarification (guiding questions, expected outputs)
      ↓
3. Plan Construction (phase-by-phase OR finalized, per user preference)
      ↓
4. User Confirmation (explicit approval)
      ↓
5. Final Review (catch gaps before dispatch)
      ↓
6. Plan Quality Review (code review the plan itself)
      ↓
7. Save Plan to File (persist for execution)
      ↓
8. Output (agent-executable planning document)
      ↓
9. Generate Execution Prompt (oberprompt bootstrap for fresh context)
      ↓
10. Execution Handoff (provide bootstrap prompt for fresh context)
```

---

## Phase 1: Lens Selection

**Before ANY planning, identify the domain skill that provides the right "lens" for understanding this problem.**

### Process

1. Parse user request for domain signals
2. Match to available lens skills
3. Load the skill to inform subsequent phases

### Domain-to-Skill Mapping

| User Intent Signals | Lens Skill | Why |
|---------------------|------------|-----|
| "frontend", "UI", "component", "page", "design" | frontend-design | Visual/interaction patterns |
| "API", "endpoint", "backend", "service" | backend architecture skill | System integration patterns |
| "debug", "fix", "broken", "not working" | oberdebug | Hypothesis-driven investigation |
| "prompt", "agent", "LLM", "AI behavior" | oberprompt | Prompt engineering principles |
| "refactor", "clean up", "improve code" | code-foundations | Construction principles |
| General/unclear | None (proceed with generic planning) | Avoid over-specialization |

### Output

```
LENS SELECTED: [skill-name]
RATIONALE: [why this lens fits]
LOADING: [invoke skill to inform subsequent phases]
```

**If no lens matches, proceed directly to Phase 2 with generic planning approach.**

---

## Phase 2: Requirements Clarification

**Do NOT plan until requirements are understood.**

### Guiding Questions (ask in batches of 2-3)

| Category | Questions |
|----------|-----------|
| **Outcome** | "What does success look like?" / "How will you know it's done?" |
| **Scope** | "What's in scope? What's explicitly NOT in scope?" |
| **Constraints** | "Any technical constraints, timeline, or dependencies?" |
| **Users** | "Who uses this? What's their workflow?" |
| **Integration** | "What existing systems does this touch?" |
| **Output format** | "Should I walk through phase-by-phase, or deliver a finalized plan?" |

### Decision: Interactive vs Finalized

| User Says | Interpretation | Action |
|-----------|----------------|--------|
| "walk me through it", "let's discuss", "phase by phase" | Interactive mode | Present each plan section, get feedback, iterate |
| "just give me the plan", "finalized", "I trust you" | Finalized mode | Complete full plan, present for single approval |
| Unclear | Default to interactive | Safer - catches misalignment early |

### Output

```
REQUIREMENTS CONFIRMED:
- Outcome: [what success looks like]
- Scope: [in/out boundaries]
- Constraints: [technical, timeline, dependencies]
- Mode: [Interactive | Finalized]
```

---

## Phase 3: Plan Construction

### Plan Structure

Every plan MUST include:

| Section | Purpose | Required? |
|---------|---------|-----------|
| **Objective** | Single sentence: what we're building | YES |
| **Deliverables** | Concrete outputs agents will produce | YES |
| **Phases** | Ordered steps with clear boundaries | YES |
| **Agent Assignment** | Which agent type handles each phase | YES |
| **Dependencies** | What must complete before each phase | YES |
| **Validation Criteria** | How to verify each phase succeeded | YES |
| **Checkpoints** | Quality gates between phases | YES |
| **Risks/Assumptions** | What could go wrong, what we're assuming | YES |

### Checkpoints

See [checkpoint-templates.md](references/checkpoint-templates.md) for checkpoint types, capability proofs, placement rules, and templates.

### Interactive Mode

For each phase:
1. Present phase details
2. Ask: "Does this align with your expectations? Any adjustments?"
3. Incorporate feedback
4. Proceed to next phase

### Finalized Mode

1. Construct complete plan
2. Present entire plan
3. Ask for single approval

### Phase Template

See [phase-templates.md](references/phase-templates.md) for phase and document templates.

---

## Phase 4: User Confirmation

**MANDATORY - Do not proceed without explicit approval.**

### Confirmation Request

```
PLAN COMPLETE

[Summary of phases]

Ready to proceed? Please confirm:
- [ ] Scope is correct
- [ ] Phase order makes sense
- [ ] Agent assignments are appropriate
- [ ] Nothing critical is missing

Reply "approved" to proceed to final review, or specify changes.
```

| User Response | Action |
|---------------|--------|
| "approved", "looks good", "yes" | Proceed to Phase 5 |
| Specific feedback | Revise plan, re-present for confirmation |
| "wait", "hold on", "not sure" | Pause, ask clarifying questions |

---

## Phase 5: Final Review

**After user approval, systematic gap check.**

### Review Checklist (Complete EVERY item)

| # | Check | Verification |
|---|-------|--------------|
| 1 | Each phase has exactly ONE responsible agent | No shared ownership |
| 2 | Agent skills are explicitly assigned | Subagents don't inherit |
| 3 | Dependencies form valid DAG (no cycles) | Phases can execute in order |
| 4 | Validation criteria are testable | Not vague like "works correctly" |
| 5 | Checkpoints after every implementation phase | No impl→impl without quality gate |
| 6 | Tests specified for each checkpoint | Not just "verify it works" |
| 7 | Capability proofs before visual/rendering work | Prove it renders before building on it |
| 8 | Edge cases considered | What if X fails? |
| 9 | Integration points identified | Where do phases connect? |
| 10 | Rollback path exists | Can we undo if wrong? |

### Gap Detection

For each phase, ask:
- "What could go wrong here?"
- "What am I assuming that might not be true?"
- "What would an agent need to know that isn't explicitly stated?"

### Output

```
FINAL REVIEW COMPLETE:
- Gaps identified: [list or "none"]
- Mitigations added: [list or "n/a"]
- Plan status: READY FOR QUALITY REVIEW
```

---

## Phase 6: Plan Quality Review

**Code review the plan itself before execution.**

Plans are code for agents. They have edge cases, implicit assumptions, and phases that may be too vague.

### Review Process

Dispatch a review agent (via oberagent) to evaluate the plan:

```
Task(
  subagent_type="general-purpose",
  description="Review: implementation plan quality",
  prompt="Review this implementation plan for completeness and executability.

  PLAN:
  [Full plan content]

  REVIEW CRITERIA:
  1. Phase objectives are actionable (not vague)
  2. Agent prompts have enough context to succeed
  3. Checkpoints have testable pass criteria
  4. Dependencies are explicit (no hidden assumptions)
  5. Risk mitigations are realistic
  6. Nothing requires information not available at that phase

  RETURN FORMAT:
  VERDICT: [READY | NEEDS_REVISION]

  If NEEDS_REVISION:
  ISSUES:
  - [Phase N] - [specific issue]

  SUMMARY: [1-2 sentences]"
)
```

| Verdict | Action |
|---------|--------|
| READY | Proceed to Save Plan |
| NEEDS_REVISION | Revise plan, re-review (max 2 cycles) |

---

## Phase 7: Save Plan to File

**Persist the plan for execution in this or a fresh context.**

### File Location

```
~/.local/state/oberplan/plans/{project-name}-{timestamp}.md
```

### File Format

Include: Plan content, execution instructions, and bootstrap prompt.

---

## Phase 8: Output

**Produce agent-executable planning document.**

See [phase-templates.md](references/phase-templates.md) for the document format.

---

## Phases 9-10: Bootstrap & Handoff

See [bootstrap-guide.md](references/bootstrap-guide.md) for execution prompt generation and handoff procedures.

---

## Red Flags - STOP and Reconsider

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "Requirements are obvious" | Obvious to you ≠ obvious to user | Ask the guiding questions anyway |
| "Skip to finalized, user is busy" | Fast planning = slow rework | Default to interactive mode |
| "This phase is too small to plan" | Small gaps compound | Every phase needs the template |
| "User already approved" | Approval ≠ no gaps exist | Final review is mandatory |
| "I'll figure it out during execution" | That's not planning | Complete the plan first |
| "No lens skill matches" | Proceed without over-specializing | Generic planning is valid |
| "We can test everything at the end" | Late bugs are 10x more expensive | Checkpoint after every impl phase |
| "Checkpoints add overhead" | Debugging without checkpoints adds more | Quality gates are mandatory |

---

## Integration

### With oberexec
After plan approval, provide bootstrap prompt for fresh context execution. oberexec handles subagent-driven execution with checkpoints.

### With oberagent
- Phase 6: Dispatch plan review agent via oberagent
- Execution: oberexec uses oberagent for all dispatches (in fresh context)

### With oberprompt
- Phase 9: Use oberprompt principles to craft the bootstrap prompt for fresh context execution
- Ensures bootstrap prompt is outcome-focused, minimal constraints, high confidence

### With oberdebug
If user request involves fixing bugs, redirect to `oberdebug` - debugging is not planning.

### With code-foundations
- Phase 6: Plan review agent invokes code-foundations for quality evaluation
- Phases are designed with code-foundations principles (clear objectives, testable outputs)
