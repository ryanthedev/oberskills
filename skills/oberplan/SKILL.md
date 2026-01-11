---
name: oberplan
description: Use when ANY planning, scoping, or design work is needed BEFORE implementation. Invoke when user asks to "build", "create", "implement", "add feature", "design", or describes desired functionality. CRITICAL - this skill dispatches FIRST, identifies relevant lens skills, clarifies requirements, and produces agent-executable plans. Triggers on "help me build", "I want to create", "let's implement", "design a", "plan for", "how should we approach", "figure out how to", or any request that requires understanding WHAT to build before building it.
---

# Skill: oberplan

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
6. Output (agent-executable planning document)
      ↓
7. Execution Handoff (chain to oberexec)
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

---

### Mandatory Checkpoints

**Every plan MUST include quality gates.** Don't just chain implementation phases - insert checkpoints to catch issues early.

#### Checkpoint Types

| Type | Purpose | When to Use |
|------|---------|-------------|
| **Code Review** | Verify implementation quality, patterns, edge cases | After any phase that writes/modifies code |
| **Test Validation** | Confirm functionality works as expected | After implementation, before integration |
| **Integration Check** | Verify components work together | When phases connect or share state |
| **Build/Lint Gate** | Catch syntax errors, type issues, style violations | After any code changes |
| **Capability Proof** | Prove you CAN do something before building on it | Before any visual/rendering/hardware work |

#### Capability Proofs (Visual & Rendering)

**If the plan involves rendering, displaying, or visual output - PROVE IT WORKS FIRST.**

Don't assume APIs, libraries, or rendering pipelines work. Build a minimal proof before investing in the full implementation.

| If Building... | Capability Proof Required |
|----------------|---------------------------|
| Desktop app with UI | Render a basic window with test content |
| Charts/graphs | Render one hardcoded chart, verify it displays |
| PDF/document generation | Generate minimal PDF, open and verify |
| Image processing | Load one image, apply one transform, save and verify |
| Canvas/WebGL | Render a colored rectangle, confirm it appears |
| Native graphics APIs | Call the API, render primitive, screenshot proof |
| Electron/Tauri app | Window opens, IPC works, basic render confirmed |
| Print output | Generate and preview one test page |

**Capability Proof Template:**

```markdown
## Checkpoint: [Component] Capability Proof

**Type:** Capability Proof

**Proves:** [The specific rendering/visual capability works]

**Minimal Test:**
1. [Simplest possible code to exercise the capability]
2. [How to run it]
3. [What output proves success - screenshot, file, etc.]

**Pass Criteria:**
- [ ] Output is visible/verifiable (not just "no errors")
- [ ] API/library behaves as documented
- [ ] Performance is acceptable for use case

**If Fails:** Stop. Research alternatives before proceeding.
```

**Why This Matters:**

| Skipping Proof | What Happens |
|----------------|--------------|
| "The docs say it works" | Docs lie. Environment differs. Versions conflict. |
| "I've used this before" | Different OS, different deps, different context. |
| "We'll fix rendering later" | You build 10 phases on broken foundation. |

#### Checkpoint Placement Rules

| After This... | Insert This Checkpoint |
|---------------|------------------------|
| Implementation phase | Test + Code Review |
| Multiple implementation phases | Integration Check |
| Refactoring phase | Test (ensure no regression) |
| API/interface changes | Integration Check + Test |
| Final implementation phase | Full validation (all types) |

| Before This... | Insert This Checkpoint |
|----------------|------------------------|
| Any visual/rendering work | Capability Proof |
| Using new library/API | Capability Proof |
| Hardware/device integration | Capability Proof |
| External service integration | Capability Proof (API responds) |

#### Checkpoint Template

```markdown
## Checkpoint: [Name]

**Type:** [Code Review | Test Validation | Integration Check | Build Gate]

**Verifies:** [What this checkpoint confirms]

**Pass Criteria:**
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**If Fails:** [What to do - usually "return to Phase N"]
```

#### Example Checkpoint Sequence

```
Phase 1: Implement auth service
    ↓
Checkpoint: Auth unit tests pass
    ↓
Phase 2: Implement auth middleware
    ↓
Checkpoint: Code review + integration test
    ↓
Phase 3: Update API routes
    ↓
Checkpoint: Full auth flow validation
```

---

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

```markdown
## Phase N: [Name]

**Objective:** [What this phase accomplishes]

**Agent:** [agent-type] with [relevant skills]

**Inputs:** [What this phase needs to start]

**Outputs:** [Concrete deliverables]

**Validation:** [How to verify success]

**Dependencies:** [What must complete first]
```

### Checkpoint Red Flags

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "We'll test at the end" | Bugs compound; late discovery = expensive fixes | Add checkpoint after each impl phase |
| "This phase is too small for review" | Small phases still introduce bugs | At minimum: build/lint gate |
| "Tests slow us down" | Debugging without tests is slower | Tests are non-negotiable |
| "Code review is overkill" | Fresh eyes catch what you missed | Review after significant changes |
| "The rendering library definitely works" | Prove it. In THIS environment. | Capability proof before building on it |
| "I'll verify the UI later" | You'll build 5 phases on broken rendering | Prove visual output works FIRST |

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
- Plan status: READY FOR EXECUTION
```

---

## Phase 6: Output

**Produce agent-executable planning document.**

### Document Format

```markdown
# Plan: [Title]

## Objective
[Single sentence]

## Phases

### Phase 1: [Name]
- **Agent:** [type] | **Skills:** [list]
- **Prompt:** [exact prompt for agent dispatch]
- **Inputs:** [what agent receives]
- **Outputs:** [what agent produces]
- **Validation:** [how to verify]

### Checkpoint: [Name]
- **Type:** [Code Review | Test Validation | Integration Check | Build Gate]
- **Pass Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]
- **If Fails:** Return to Phase 1

### Phase 2: [Name]
[...]

## Execution Order
[Dependency graph showing phases AND checkpoints]

## Risk Register
| Risk | Likelihood | Mitigation |
|------|------------|------------|

## Assumptions
- [List of assumptions]
```

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

## Phase 7: Execution Handoff

**After final review passes, chain to oberexec for execution.**

### Handoff Decision

| User Intent | Action |
|-------------|--------|
| "execute", "implement", "build it" | Invoke oberexec immediately |
| "I'll implement later", "save the plan" | Output plan document, stop |
| Unclear | Ask: "Ready to execute this plan?" |

### Handoff Process

```
1. Confirm user wants execution
2. Invoke oberexec skill
3. Pass the approved plan
4. oberexec takes over execution loop
```

### Handoff Output

```
PLAN APPROVED - HANDING OFF TO EXECUTION

Invoking oberexec with:
- [N] implementation phases
- [M] checkpoints
- Skills: [list of skills to pass to agents]

[Invoke oberexec skill]
```

---

## Integration

### With oberexec
After plan approval and final review, chain to `oberexec` for subagent-driven execution with checkpoints.

### With oberagent
When dispatching agents from the plan, invoke `oberagent` to validate each agent prompt.

### With oberprompt
If plan involves LLM prompts, invoke `oberprompt` for prompt engineering phases.

### With oberdebug
If user request involves fixing bugs, redirect to `oberdebug` - debugging is not planning.
