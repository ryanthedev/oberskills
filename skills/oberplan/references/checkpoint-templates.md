# Checkpoint Templates Reference

This document contains checkpoint types, capability proofs, placement rules, and templates for oberplan.

---

## Mandatory Checkpoints

**Every plan MUST include quality gates.** Don't just chain implementation phases - insert checkpoints to catch issues early.

### Checkpoint Types

| Type | Purpose | When to Use |
|------|---------|-------------|
| **Code Review** | Verify implementation quality, patterns, edge cases | After any phase that writes/modifies code |
| **Test Validation** | Confirm functionality works as expected | After implementation, before integration |
| **Integration Check** | Verify components work together | When phases connect or share state |
| **Build/Lint Gate** | Catch syntax errors, type issues, style violations | After any code changes |
| **Capability Proof** | Prove you CAN do something before building on it | Before any visual/rendering/hardware work |

### Capability Proofs (Visual & Rendering)

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

### Checkpoint Placement Rules

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

### Checkpoint Template

```markdown
## Checkpoint: [Name]

**Type:** [Code Review | Test Validation | Integration Check | Build Gate]

**Verifies:** [What this checkpoint confirms]

**Pass Criteria:**
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**If Fails:** [What to do - usually "return to Phase N"]
```

### Example Checkpoint Sequence

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

## Checkpoint Red Flags

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "We'll test at the end" | Bugs compound; late discovery = expensive fixes | Add checkpoint after each impl phase |
| "This phase is too small for review" | Small phases still introduce bugs | At minimum: build/lint gate |
| "Tests slow us down" | Debugging without tests is slower | Tests are non-negotiable |
| "Code review is overkill" | Fresh eyes catch what you missed | Review after significant changes |
| "The rendering library definitely works" | Prove it. In THIS environment. | Capability proof before building on it |
| "I'll verify the UI later" | You'll build 5 phases on broken rendering | Prove visual output works FIRST |
