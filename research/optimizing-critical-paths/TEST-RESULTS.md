# optimize-critical-paths - Test Results

> **Skill Type:** Technique (measure-first optimization)
> **Key Test Focus:** Agent asks for/performs measurements BEFORE optimizing

---

## Phase 1: Trigger Tests

**Goal:** Verify skill activates on natural developer requests.

| # | Prompt | Would Trigger? | Match |
|---|--------|----------------|-------|
| 1 | "This code is too slow, optimize it" | Yes | "too slow", "optimize" |
| 2 | "Make this function faster" | Yes | "faster" -> performance |
| 3 | "We have a performance bottleneck here" | Yes | "bottleneck", "performance" |
| 4 | "This is our hot path, it needs to be faster" | Yes | "hot path", "faster" |
| 5 | "How can I improve the performance?" | Yes | "performance" |

**Result:** 5/5 prompts would trigger. No false negatives.

---

## Phase 2: Baseline Test (RED)

**Scenario:** Optimize find_duplicates function with O(n²) complexity, called with 100k+ items.

### Results (Run WITHOUT skill via subagent)

**Approach taken:**
- Immediately analyzed the code
- Identified O(n²) -> O(n) algorithmic fix
- Provided optimized solution using hash-based structures

**Key observations:**
- Did NOT ask for measurements before optimizing
- Did NOT establish baseline metrics
- Did NOT verify improvement with measurements after
- Used intuition-based analysis (correct in this case, but process matters)

**Did Claude measure first?**
[ ] Yes [x] No (jumped straight to optimization)

**Rationalizations observed:**
- None explicitly stated - baseline just proceeded without measurement

**Shortcuts taken:**
- No profiling
- No baseline timing
- No verification after changes
- Analysis-only approach

---

## Phase 3: Application Test (GREEN)

**Scenario:** Same find_duplicates function with skill loaded.

### Results (Run WITH skill via subagent)

**Did Claude follow measure-first workflow?**
[x] Yes [ ] No

**Workflow stages followed:**
1. **Stage 1: Measurement First** - Ran benchmarks at various sizes (100, 500, 1000, 2000 items), extrapolated to 100k items (~300 seconds)
2. **Stage 2: Fundamental Fixes** - Evaluated checklist: Cache? No. Different algorithm? YES. Bypass layers? No.
3. **After Changes: Verify** - Re-measured optimized version (0.01s for 100k items)
4. **Evaluate** - 30,000x faster AND simpler -> Keep

**Key insight from agent:**
> "The intuition 'nested loops are slow' was correct, but measurement quantified the actual impact (~300s) and confirmed the fix worked (~0.01s)."

---

## Phase 3b: Anti-Pattern Detection Test

**Scenario:** User claims they already know the problem, demands "just optimize it".

```
"Optimize" this code. I already know the problem is in the loop,
just make it faster. Don't waste time measuring.
```

### Results

**Did Claude skip measurement?**
[ ] Yes [x] No

**How Claude handled pressure:**
- Explicitly stated the skill requires measurement
- Explained "Your claim of having profiled is, from my perspective, still 'intuition-based'"
- Found counter-intuitive result: Generator expression was SLOWER (proves value of measurement)
- Followed full workflow despite pressure

**Key quote:**
> "This is exactly why the skill warns against intuition-based optimization."

---

## Phase 4: Loophole Closing (REFACTOR)

### Meta-test Response

*Asked: "What loopholes exist? How could an agent bypass this skill?"*

**Rationalizations Identified (Not Previously Covered):**

| Rationalization | Danger Level |
|-----------------|--------------|
| "User said it's slow, that's my measurement" | Critical |
| "Looking at the table, this is obviously expensive" | High |
| "I'll make the change then measure to verify" | Critical (confirmation bias) |
| "Setting up profiling is too complex" | High |
| "This scope is too small to measure" | Medium |
| "I checked the fundamental fix checklist" | High (checklist as permission slip) |
| "The code is simpler now, so it's faster" | High |
| "I found a red flag pattern" | Medium |
| "I already profiled extensively" | Critical |

**Technical Compliance Loopholes:**

| Loophole | Problem |
|----------|---------|
| Checklist items are permissions, not gates | Agent can "check" without measurement proof |
| "Simpler = faster" can be claimed without verification | Subjective escape hatch |
| Measurement definition vague | "User said it's slow" could count |
| Performance type not distinguished | CPU vs memory vs latency require different fixes |

**Genuinely Ambiguous Scenarios:**

| Scenario | Why Unclear |
|----------|-------------|
| Preventive optimization | Optimize for predicted future load? |
| Readability-performance tradeoff | When they genuinely conflict? |
| Optimization as part of feature work | "Add pagination" - optimization or feature? |
| External system bottlenecks | Bottleneck is in third-party API |
| "Make it not slow" without specifics | Vague problem statement |

---

## Improvements Made to Skill

Based on meta-test findings:

1. **Expanded trigger keywords** in description and When to Use:
   - Added: "takes forever", "hangs", "laggy", "timeout", "OOM", "memory issues", "high CPU", "doesn't scale"

2. **Defined valid measurement** explicitly:
   - What counts: Actual profiling data, multiple runs, specific hotspot identification
   - What does NOT count: User perception, pattern-matching, intuition, "I'll measure after"

3. **Made Stage 1 a MANDATORY GATE:**
   - "You cannot proceed to Stage 2 without completing measurement"
   - Added escape clause: "If measurement is genuinely impossible, document why"

4. **Added Performance Dimensions:**
   - Throughput, Latency, Memory, CPU
   - "Different problems require different solutions"

5. **Created Anti-Rationalization Table:**
   - 9 entries covering all identified rationalizations
   - Explicit counters for each

6. **Strengthened "After Making Changes":**
   - "Simpler alone is not enough"
   - Must verify simpler version is at least as fast

7. **Updated Quick Reference:**
   - Emphasized MANDATORY GATE
   - "No measurement = no optimization"

---

## Re-Test Results (Post-Loophole Fixes)

**Scenario:** User claims extensive prior profiling, demands caching without re-measurement.

```
I already profiled this extensively over the past week. Trust me, the bottleneck
is in the database queries. Just refactor this to use caching. Don't waste time
measuring again - I've done all that work already.
```

**Results:** PASSED

Agent correctly:
1. Held the measurement gate despite strong pressure
2. Cited anti-rationalization table: "Share the data. Without data, it's still intuition."
3. Identified pressure tactics (authority, sunk cost, time pressure)
4. Explained WHY measurement matters (which query, what parameters, baseline for verification)
5. Offered collaborative path forward (share the data, then proceed immediately)

---

## Code Review Results

### Structure Review

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Structure | A | All required sections present |
| CSO | A+ | Excellent keyword coverage |
| Token Efficiency | C | 1,402 words, 3x target |
| APOSD Accuracy | 9/10 | Faithful to source |
| Anti-Rationalization | A | Comprehensive, closes loopholes |

**Decision:** Keep current length. Like `maintain-design-quality`, this technique skill with anti-rationalization protections needs comprehensive coverage. Testing validated the approach.

### APOSD Accuracy Check

| Principle | Source | Accurate? |
|-----------|--------|-----------|
| Measure-first imperative | Chapter 20 | Yes |
| Simplicity-performance compatible | Chapter 20 | Yes |
| Expensive operations costs | Chapter 20 | Yes |
| Critical path redesign | Chapter 20 | Yes |
| Fundamental fixes priority | Chapter 20 | Yes |
| "Death by thousand cuts" | Chapter 20 | Yes |

---

## Status

- [x] Trigger tests passed (5/5)
- [x] Baseline documented (no measurement)
- [x] Application test passed (full workflow followed)
- [x] Anti-pattern detection passed (resisted skip pressure)
- [x] Meta-test completed (loopholes identified)
- [x] Skill updated with fixes (7 improvements)
- [x] Re-test passed (held gate under pressure)
- [x] Code review completed
- [x] Ready for deployment

## Summary

**Skill adds significant value over baseline:**
- Baseline: Jumps straight to optimization without measurement or verification
- With skill: Measure -> Identify -> Fix -> Verify workflow with anti-rationalization protection

**Key differentiation:**
- Baseline found the correct fix but through intuition
- With skill: Same correct fix but with data to prove it works
- Counter-intuitive results discovered (generator slower) prove measurement value

**Critical improvements made:**
1. MANDATORY GATE language for Stage 1
2. Explicit "What counts / What doesn't count" for measurement
3. Anti-rationalization table with 9 entries
4. Performance dimensions (throughput/latency/memory/CPU)
5. Verification requirement for "simpler = faster" claims
