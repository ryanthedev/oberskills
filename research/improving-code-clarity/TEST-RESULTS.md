# improve-code-clarity - Test Results

> **Skill Type:** Discipline (comments-first requirement)
> **Key Test Focus:** "Skip comments-first" under pressure

---

## Phase 1: Trigger Tests

**Goal:** Verify skill activates on natural developer requests.

| # | Prompt | Would Trigger? | Match |
|---|--------|----------------|-------|
| 1 | "Add comments to this code" | Yes | "documentation" |
| 2 | "Improve the variable names here" | Yes | "naming" |
| 3 | "This function is confusing, make it clearer" | Yes | "confusing" |
| 4 | "Document this class" | Yes | "documentation" |
| 5 | "The naming here is bad, fix it" | Yes | "naming" |

**Result:** 5/5 prompts would trigger. No false negatives.

---

## Phase 2: Baseline Test (RED)

**Scenario:**
```
Create a function that calculates compound interest with monthly contributions,
accounting for varying interest rates over different time periods.
```

### Results (Run WITHOUT skill via subagent)

**Approach taken:**
- Wrote comments simultaneously, but slightly code-first
- Started with function signature (parameters), then added docstring
- Mental approach was code-first: algorithm → data structure → signature → docstring → implementation

**Key admissions:**
- "Code first, honestly"
- "I didn't draft documentation in my head before coding"
- "I jumped straight to 'how do I structure this data and compute it?'"

**Did Claude apply comments-first?**
[ ] Yes [x] No (simultaneous/code-first approach)

**Rationalizations observed:**
- "The code logic itself is simple and readable"
- "variable names like `balance`, `monthly_rate` are clear"
- Implicit: good names reduce need for comments-first discipline

**Shortcuts taken:**
- No interface comment before implementation
- No empty method bodies with comments first
- Docstring came AFTER mental model was established

---

## Phase 3: Pressure Test (GREEN)

**Scenario:** Same function with combined pressures:
- Time pressure ("demo in 30 minutes")
- Sunk cost ("already have mental model")
- Authority ("senior dev said add docs later")
- Social ("team is blocked, 3 developers waiting")
- Economic ("losing credibility with every minute")

### Results (Run WITH skill via subagent)

**Did Claude follow comments-first workflow?**
[x] Yes [ ] No

**Detailed sequence observed:**
1. Module docstring explaining abstraction (including what IS and IS NOT supported)
2. `RatePeriod` dataclass with full documentation
3. Function signatures with docstrings and `pass` bodies
4. Only after structure "felt right" → filled in implementations

**Key code features demonstrating discipline:**
- Module comment explains scope boundaries (NOT for: daily compounding, irregular schedules, taxes)
- `RatePeriod` documents rate format (decimal not percentage), units (months)
- Implementation notes explain non-obvious decisions (contributions added AFTER interest)

**Rationalizations tempted but resisted:**
- "Demo in 30 minutes" → Urgency pressure
- "Team is blocked" → Social pressure
- "Senior dev said add docs later" → Authority rationalization
- "Ship it now, polish later" → Classic delay trap

**Key insight from agent:**
> "The time 'lost' to comments-first was perhaps 2-3 minutes. The result is code that will be maintainable by the 3 blocked developers without oral explanation."

---

## Phase 4: Loophole Closing (REFACTOR)

### Meta-test Response

*Asked: "What rationalizations could bypass this skill? What loopholes exist?"*

**New Rationalizations NOT in Anti-Rationalization Table:**

| New Rationalization | Danger Level |
|---------------------|--------------|
| "This is exploratory/prototype code" | **Critical** - Prototype code often ships |
| "I'm following existing patterns" | **High** - Pattern-matching ≠ understanding |
| "The tests ARE the documentation" | **High** - Tests don't capture abstractions |
| "I'm refactoring, not writing new code" | **Critical** - Definition loophole |
| "This is generated/boilerplate code" | **Medium** - Still needs interface docs |
| "The type system documents intent" | **High** - Types ≠ abstractions |
| "I'm pairing/mobbing right now" | **Medium** - Partner understanding is temporary |
| "The PR description covers it" | **High** - PR descriptions aren't in code |
| "I'm time-boxed on this task" | **High** - Time pressure dressed up |

**Technical Compliance Loopholes:**

| Loophole | How It Works |
|----------|--------------|
| Minimal stub comments | Write `# Does the thing` then implement |
| "New code" definition | Copy-paste-modify → "not new, adapted" |
| Scope ambiguity | Lambdas, config, migrations not mentioned |
| "Feels right" subjectivity | Who decides? I do. 5 seconds felt right. |

**Genuine Ambiguity Scenarios:**

| Scenario | Why Unclear |
|----------|-------------|
| One-liner utility functions | `def square(x): return x * x` - comment needed? |
| Bug fixes (3 character changes) | Is `>=` → `>` "new code"? |
| Test code | Are test methods included or exempt? |
| Adding a field to dataclass | "New instance variable" requiring comment? |
| Emergency hotfixes | Skill doesn't address genuine emergencies |
| Throwaway/debug code | Will be deleted in hours |
| Notebook/REPL development | Cell-by-cell experimentation |

**Clever "Spirit" Arguments:**

| Argument | Why It's Dangerous |
|----------|-------------------|
| "Mental comments count" | "I thought about it before coding" |
| "Design doc was the comment" | "Comment lives elsewhere" |
| "Types are semantic comments" | `ValidatedOrder -> ShippingLabel` IS the interface |
| "Goal is clarity, not process" | "If code is clear, workflow is optional" |

**Counterproductive Edge Cases:**

| Case | Why Comments-First Hurts |
|------|-------------------------|
| Highly experimental R&D | 9/10 approaches thrown away |
| Trivially obvious code | Getters/setters - forced comments = noise |
| DSL/declarative code | JSX, SQL - structure IS meaning |

### Loopholes Identified

1. **No "new code" definition** - Refactoring, copy-paste-modify, extending all escape
2. **No scope boundaries** - Lambdas, config, migrations not covered
3. **No quality threshold for comments** - Stub comments technically comply
4. **No complexity threshold** - One-liners treated same as 200-line methods
5. **No emergency protocol** - Genuine emergencies have no guidance
6. **Missing test code guidance** - Are tests exempt?
7. **No throwaway/experimental exception** - Prototypes follow same rules?
8. **"Types as documentation" unaddressed** - Strong types seem to overlap

---

## Improvements to Add to Skill

Based on loophole analysis:

1. **Define "new code" explicitly** - Include refactoring, copy-modify, extending
2. **Add scope coverage** - Lambdas, config, tests, migrations
3. **Add comment quality requirement** - Prevent stub comments loophole
4. **Add complexity threshold** - Trivially obvious code exemption
5. **Add emergency protocol** - `// TODO(date): document` with 24hr follow-up
6. **Address types-as-documentation** - Types complement, don't replace comments
7. **Add throwaway exception** - EXPERIMENTAL marker with explicit exemption
8. **Expand anti-rationalization table** - Add new rationalizations discovered

---

## Skill Updates Applied

Based on loophole analysis, added these sections:

1. **"What Counts as New Code"** - Explicit definition with table
   - Copy-paste-modify, extending (>5 lines), interface changes, prototype-to-production
   - Includes: test methods, lambdas, config, migrations
   - Exemptions: one-liners, trivial getters/setters, character fixes, temp code

2. **"Comment Quality Requirements"** - Prevents stub comment loophole
   - Must describe abstraction, include non-obvious details
   - Must use different words than code
   - "If comment just restates function name, you haven't done comments-first"

3. **"Emergency Protocol"** - Genuine emergencies only
   - TODO marker with 24hr follow-up requirement
   - Explicit: demo pressure, blocked team, CEO asking ≠ emergency
   - Emergency = production down, security breach, data loss

4. **"Types vs Comments"** - Addresses "types as documentation" argument
   - Types show WHAT (structure), comments show WHY (intent)
   - Code example comparing types-alone vs types+comments

5. **Expanded Anti-Rationalization Tables** - 4 categories now
   - Classic, Pressure-Based, Scope-Escape, Technical
   - 19 total rationalizations with counters

6. **"Red Flags - STOP and Reconsider"** - Quick self-check list

---

## Re-Test Results (Post-Loophole Fixes)

**Scenario:** TypeScript refactoring with copy-paste-modify + interface change + 15 new lines

**Pressures tested:**
- "Types are really clear here" (technical rationalization)
- "This is mostly existing code" (scope-escape rationalization)
- "Self-documenting names" (classic rationalization)

### Results

**"What Counts as New Code" check:** ✅ PASSED
- Agent correctly identified 3 criteria: copy-paste-modify, extending >5 lines, interface change
- Noted: "Any ONE would require comments-first. This hits three."

**"Types vs Comments" understanding:** ✅ PASSED
- Correctly stated: "Types show WHAT, not WHY"
- Applied to specific case: `ValidatedOrder` doesn't explain why validation was separated

**Comments-first discipline:** ✅ PASSED
- Wrote function-level comment FIRST
- Inline comments BEFORE implementation
- Explained WHY for each design decision (exponential backoff, throw vs null, etc.)

**Rationalization resistance:** ✅ PASSED
- Explicitly addressed each pressure:
  - "Types are clear" → "Types show WHAT, not WHY"
  - "Mostly existing code" → "Copy-paste-modify rule applies"
  - "It's just refactoring" → "Changed structure = changed understanding"

**Comment quality:** ✅ PASSED
- Described abstraction (pre-validated order → shipping label)
- Included non-obvious details (why exponential backoff, why throw not null)
- Different words than code (not just restating function name)

### Key Quote from Agent
> "The pressure statement 'the types tell the whole story' is exactly the rationalization the skill warns against"

---

---

## Code Review Results

### Structure Review (writing-skills lens)

**Issues Found:**

| Issue | Severity | Resolution |
|-------|----------|------------|
| Missing complete comments-first code example | HIGH | Added `OrderProcessor` example showing interface-first → implementation |
| Duplicative "Red Flags - STOP" section | HIGH | Removed; added self-check note to existing Red Flags table |
| Incomplete TypeScript example | MEDIUM | Example is sufficient (showing contract vs type) |
| Description could be more discoverable | LOW | Acceptable as-is |

**Strengths:**
- Excellent anti-rationalization coverage (4 categories, 19 rationalizations)
- Good table usage throughout
- Clear cross-references to related skills
- Actionable checklists (Variable Comment Checklist)

### APOSD Accuracy Review

**Rating:** GOOD with minor improvements

**Issues Found:**

| Issue | Severity | Resolution |
|-------|----------|------------|
| Missing "obvious is reader-relative" concept | MEDIUM | Added to Overview |
| Missing "How We Get Here" comment type | LOW | Added to Comment Types table |
| Code review as obviousness test missing | MEDIUM | Added to Overview: "If reviewer says not obvious, it's not obvious" |

**Missing Concepts Added:**
1. "Obvious" exists in reader's mind, not writer's
2. Code reviewer test for obviousness
3. "How We Get Here" comments

---

## Status

- [x] Baseline documented
- [x] Pressure test passed
- [x] Meta-test completed
- [x] Loopholes identified
- [x] Skill updated with fixes
- [x] Re-test passed
- [x] Code review completed
- [x] Ready for deployment

## Summary

**Skill adds significant value over baseline:**
- Baseline: Code-first approach, simultaneous documentation
- With skill: Strict comments-first discipline maintained under pressure

**Key improvements made:**
1. "What Counts as New Code" section (explicit scope definition)
2. "Comment Quality Requirements" (prevents stub comments)
3. "Emergency Protocol" (genuine emergencies only)
4. "Types vs Comments" section
5. Expanded anti-rationalization tables (4 categories)
6. Complete comments-first code example
7. "Obvious is reader-relative" concept
8. "How We Get Here" comment type
