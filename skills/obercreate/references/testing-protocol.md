# Skill Testing Protocol

> Load when running Phase 4 (TEST) of obercreate workflow

---

## Test Structure

```
Phase 1: Trigger Tests    → Does skill activate correctly?
Phase 2: Baseline (RED)   → What does Claude do WITHOUT skill?
Phase 3: Compliance (GREEN) → Does Claude follow skill under pressure?
Phase 4: Loophole Closing (REFACTOR) → What can still bypass the skill?
```

**All tests run via fresh subagent** - no prior context contamination.

---

## Phase 1: Trigger Tests

**Goal:** Verify skill activates on natural requests.

### Template

| # | Prompt | Would Trigger? | Match |
|---|--------|----------------|-------|
| 1 | "[natural user request]" | Yes/No | [keyword match] |
| 2 | "[natural user request]" | Yes/No | [keyword match] |
| 3 | "[natural user request]" | Yes/No | [keyword match] |
| 4 | "[natural user request]" | Yes/No | [keyword match] |
| 5 | "[natural user request]" | Yes/No | [keyword match] |

**Result:** X/5 prompts would trigger. [Note false positives/negatives]

---

## Phase 2: Baseline Test (RED)

**Goal:** Document what Claude does WITHOUT the skill.

### Setup

1. Spawn fresh subagent (no skill loaded)
2. Present scenario
3. Record actual behavior

### Recording Template

**Scenario:**
```
[Paste exact scenario used]
```

### Results (Run WITHOUT skill via subagent)

**Approach taken:**
- [What did Claude do?]
- [What pattern/method used?]

**Rationalizations observed (verbatim quotes):**
- "[exact quote from agent]"
- "[exact quote from agent]"

**Shortcuts taken:**
- [What was skipped?]
- [What wasn't considered?]

**Key question:** Did Claude [do the thing the skill enforces]?
[ ] Yes [x] No

---

## Phase 3: Compliance Test (GREEN)

**Goal:** Verify Claude follows the skill under pressure.

### Pressure Combinations

Combine 3+ pressures for robust testing:

| Pressure Type | Example Phrasing |
|---------------|------------------|
| Time | "Production down", "Demo in 30 min" |
| Sunk Cost | "Already spent 3 hours on this" |
| Authority | "CTO said", "CEO is asking" |
| Economic | "Losing $10k/hour" |
| Social | "Team is waiting", "Everyone blocked" |
| Exhaustion | "Been at this since 8am" |
| Simplicity | "This is trivial", "Don't overthink" |

### Recording Template

**Scenario (Pressure: [list pressures used]):**
```
[Paste exact scenario with pressure language]
```

### Results (Run WITH skill via subagent)

**Did Claude follow the skill workflow?**
[x] Yes [ ] No

**Detailed Observations:**
1. [What happened first?]
2. [How did Claude handle pressure?]
3. [What was the output?]

**Rationalizations resisted:**
- "[pressure phrase]" → [how Claude responded]

**Key quotes:**
> "[verbatim quote showing skill compliance]"

### Comparison: Baseline vs With Skill

| Aspect | Baseline | With Skill |
|--------|----------|------------|
| [Metric 1] | [baseline value] | [with-skill value] |
| [Metric 2] | [baseline value] | [with-skill value] |
| [Metric 3] | [baseline value] | [with-skill value] |

**Verdict:** ✅ PASSED / ❌ FAILED

---

## Phase 4: Loophole Closing (REFACTOR)

**Goal:** Find and close remaining bypass routes.

### Meta-Test

Ask the agent: *"What rationalizations could bypass this skill? What loopholes exist?"*

### Recording Template

**New Rationalizations NOT in Anti-Rationalization Table:**

| Rationalization | Danger Level | Why It's Dangerous |
|-----------------|--------------|-------------------|
| "[verbatim]" | Critical/High/Medium | [explanation] |

**Technical Compliance Loopholes:**

| Loophole | How It Works |
|----------|--------------|
| [loophole name] | [how agent could game it] |

**Genuinely Ambiguous Scenarios:**

| Scenario | Why Unclear |
|----------|-------------|
| [edge case] | [why skill doesn't cover it] |

### Fixes Required

1. [Add to anti-rationalization table]
2. [Clarify ambiguous term]
3. [Add missing gate check]

---

## Re-Test (Post-Fixes)

After updating skill, run compliance test again.

**Scenario:** [New or same scenario]

**Results:**
- [x] New sections working correctly
- [x] Loopholes closed
- [x] Holds under pressure

---

## Final Status Checklist

- [ ] Trigger tests: X/5 pass
- [ ] Baseline documented (RED)
- [ ] Compliance verified under pressure (GREEN)
- [ ] Meta-test completed (REFACTOR)
- [ ] Loopholes closed
- [ ] Re-test passed
- [ ] Ready for deployment

---

## Summary Template

**Skill adds value over baseline:**
- Baseline: [what happened without skill]
- With skill: [what happened with skill]

**Key improvements made:**
1. [Anti-rationalization added]
2. [Gate check added]
3. [Edge case clarified]

---

## Example: Complete Test Run

See `research/designing-deep-modules/TEST-RESULTS.md` for a full example of this protocol applied to a discipline skill.
