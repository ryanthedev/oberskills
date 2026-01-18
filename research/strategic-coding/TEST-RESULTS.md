# strategic-coding Test Results

## Summary

| Scenario | Baseline (RED) | With Skill (GREEN) | Key Difference |
|----------|----------------|-------------------|----------------|
| 1. Time pressure | ❌ FAIL | ✅ PASS | Pushed back, quoted skill |
| 2. Sunk cost | ❌ FAIL | ✅ PASS | Explained tradeoffs |
| 3. No measurement | ❌ FAIL | ✅ PASS | **Refused to optimize** |
| 4. Checkbox mode | ✅ PASS | ✅ PASS+ | Explicit framework, sketched alternatives |
| 5. Authority | ❌ FAIL | ✅ PASS | Presented alternatives |
| 6. Maximum pressure | ⚠️ MIXED | ✅ PASS | **Warning FIRST, refused blind fix** |

---

## RED Phase: Baseline Testing (WITHOUT Skill)

---

### Scenario 1: Time Pressure + New Feature

**Prompt:** UserCache class, 30-min demo, "just make it work"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Sketched 2-3 design alternatives? | ❌ NO | Went straight to implementation |
| Pushed back on "just make it work"? | ❌ NO | Accepted tactical framing |
| Wrote interface comments BEFORE implementation? | ❌ NO | Docstrings written with/after code |

**Observed Behavior:**
- Immediately started implementing
- No design consideration visible
- Accepted time pressure as valid constraint
- Said "Good luck with the demo!" - fully bought into urgency

**Rationalizations Captured:**
- (None explicit - just proceeded without question)
- Implicit acceptance: responded to "ASAP" by delivering fast

**Verdict:** ❌ FAILED - Skill needed to enforce design-twice under pressure

---

### Scenario 2: Bug Fix + Sunk Cost

**Prompt:** Race condition in OrderProcessor, "don't want to rewrite, already spent 3 hours"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Asked if current design is optimal? | ❌ NO | Just fixed the symptom |
| Suggested design improvements? | ❌ NO | Minimal fix only |
| Resisted "don't rewrite" pressure? | ❌ NO | Complied immediately |

**Observed Behavior:**
- Went straight to "here's the minimal fix using a lock"
- Provided two options: full lock vs scoped lock
- No discussion of whether the design itself was problematic
- Said "If you want the simpler (but slower) version..."

**Rationalizations Captured:**
- "The key points..." (proceeded to explain lock mechanics, not design)
- Framed as "simple" vs "less contention" - purely tactical

**Verdict:** ❌ FAILED - Skill needed to question design optimality

---

### Scenario 3: Performance + No Measurement

**Prompt:** "API is too slow, pretty sure it's getUserProfile(), optimize it"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Asked for profiling data? | ❌ NO | Accepted "pretty sure" |
| Refused to optimize without measurement? | ❌ NO | Dove right in |
| Challenged assumption? | ❌ NO | "I can see several performance issues" |

**Observed Behavior:**
- Immediately identified "problems" without measurement
- Listed 4 "issues" with no evidence any were actual bottlenecks
- Provided 3 optimization options + caching
- Created "Quick Wins Summary" table with projected improvements

**Rationalizations Captured:**
- "Looking at this function, I can see several performance issues"
- "should bring it down to ~100ms or less" (claimed 5x improvement without measurement)

**Key Quote:**
> "This should bring it down to ~100ms or less"

Made performance claims without baseline measurement.

**Verdict:** ❌ FAILED - Skill needed to enforce measure-first

---

### Scenario 4: Plan Execution + Checkbox Mode

**Prompt:** 5-step NotificationService plan, "execute this, need it by EOD"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Sketched design alternatives? | ✅ YES | Asked 5 clarifying questions |
| Questioned plan's design? | ✅ YES | "The plan lacks details needed" |
| Applied depth evaluation? | ✅ YES | Asked about queue, retries, etc. |

**Observed Behavior:**
- Did NOT just execute the plan
- Asked about: language, project context, notification type, queue implementation, retry strategy
- Said "I want to make sure I build what you actually need"

**Key Quote:**
> "The plan you've provided outlines the structure but lacks the details needed to implement something production-ready."

**Verdict:** ✅ PASSED - Natural behavior aligned with skill goals

**Note:** This scenario may not need the skill - Claude naturally asks clarifying questions when requirements are genuinely ambiguous. The skill's value is in scenarios where a "reasonable" path exists but isn't optimal.

---

### Scenario 5: Authority Pressure + Quick Change

**Prompt:** CTO said add boolean flag, "don't overthink it, she's been doing this 20 years"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Questioned flag design? | ❌ NO | Provided it directly |
| Suggested alternatives? | ❌ NO | Just implemented |
| Applied "design optimal?" gate? | ❌ NO | Skipped entirely |

**Observed Behavior:**
- Searched for function (not found)
- Provided flag implementation directly
- Added helpful note about `apply_contract_rates()` needing implementation
- No pushback on design

**Rationalizations Captured:**
- "Based on your request, here's the simple modification"
- (No questioning of whether flag is right approach)

**Verdict:** ❌ FAILED - Skill needed to question design despite authority

---

### Scenario 6: Combined Maximum Pressure

**Prompt:** Production down, CEO in meeting, "add retry loop, 5 minutes, don't overthink it"

**Baseline Questions:**

| Question | Result | Notes |
|----------|--------|-------|
| Asked about measurement/root cause? | ⚠️ PARTIAL | Warned after giving fix |
| Suggested design consideration? | ⚠️ PARTIAL | Mentioned idempotency |
| Resisted "don't overthink"? | ⚠️ PARTIAL | Gave fix first, then warned |

**Observed Behavior:**
- "I hear you - production is down... Here's a retry loop"
- PROVIDED the fix immediately
- BUT then said "WAIT - before you deploy this..."
- Warned about duplicate charges, suggested idempotency keys
- Offered "Your call" at the end

**Key Quote:**
> "WAIT - before you deploy this, I need to flag something critical: Retrying payment charges is **dangerous**."

**Verdict:** ⚠️ MIXED - Gave dangerous fix first, then warned

**Note:** Interesting split behavior. Under maximum pressure, gave tactical fix BUT couldn't resist adding the warning. The skill should make the warning come FIRST, not after providing the risky code.

---

## GREEN Phase: With Skill

---

### Scenario 1: Time Pressure + New Feature (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Pushed back on "just make it work"? | ✅ YES | "I didn't 'just make it work'" - quoted skill |
| Applied gate check? | ✅ YES | Explicitly ran "Done" gate |
| Design thinking visible? | ✅ YES | Explained what's hidden (deep module) |
| Referenced skill principles? | ✅ YES | "later never comes" |

**Observed Behavior:**
- Explicitly stated why tactical approach was rejected
- Quoted skill: "time pressure makes design matter MORE, not less"
- Applied deep module thinking: "simple interface, hidden complexity"
- Ran gate check before claiming done
- Said "This took ~2 minutes longer than a hack, but..."

**Key Quote:**
> "Why I didn't 'just make it work': The skill warns that 'just make it work' means a clean solution exists, and time pressure makes design matter *more*, not less."

**Verdict:** ✅ PASSED - Skill successfully enforced strategic thinking under pressure

---

### Scenario 2: Bug Fix + Sunk Cost (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Applied correct lens? | ✅ YES | "Lens: maintaining-design-quality" |
| Ran gate check? | ✅ YES | "Understand WHY? Design optimal? Improves it?" |
| Discussed tradeoffs? | ✅ YES | Payment inside vs outside lock |
| Explained design decisions? | ✅ YES | "Key decisions" section |

**Observed Behavior:**
- Started with "Let me think through this properly"
- Explicitly stated lens: "maintaining-design-quality (Bug fix → Fix AND improve)"
- Ran gate check before modifying
- Checked "Stop If Thinking" table: "User wants fast" → "Pressure = design matters MORE"
- Explained tradeoffs: "Payment stays outside the lock - you don't want to serialize all orders"

**Key Quote:**
> "The skill says 'Fix AND improve', not just fix."

**Verdict:** ✅ PASSED - Skill enforced design thinking on bug fix

---

### Scenario 3: Performance + No Measurement (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Asked for profiling data? | ✅ YES | Listed 4 required measurements |
| Refused to optimize without data? | ✅ YES | **Explicitly refused** |
| Quoted skill? | ✅ YES | Multiple direct quotes |

**Observed Behavior:**
- **REFUSED to optimize**
- Said "Before I can help optimize, I need actual profiling data"
- Quoted skill: "Stage 1: Measurement First is a MANDATORY GATE"
- Quoted anti-rationalization: "User said it's slow ≠ bottleneck location"
- Listed exactly what data was needed
- Explained what it would NOT do and why

**Key Quotes:**
> "I'm not going to suggest 'combine into one query' or 'add caching' without measurement"

> "The skill says explicitly: Don't optimize based on intuition—measure first."

> "Get me the profiling data, and I'll help you find the real solution."

**Verdict:** ✅ PASSED - Skill successfully enforced measure-first gate

**Note:** This is the strongest demonstration of skill effectiveness. Baseline provided complete optimization with projected 5x improvement. With skill, **refused entirely** until measurement data provided.

---

### Scenario 5: Authority Pressure + Quick Change (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Questioned flag design? | ✅ YES | Used sequential thinking |
| Suggested alternatives? | ✅ YES | Presented 3 approaches |
| Applied "design optimal?" gate? | ✅ YES | Explicit gate check |
| Respected user's final choice? | ✅ YES | "Your call" |

**Observed Behavior:**
- Used mcp__sequential-thinking to work through approach
- Explicitly applied lens: "maintaining-design-quality"
- Ran gate check: "Understand WHY? Design optimal? Improves it?"
- Sketched 3 approaches before deciding
- Presented flag approach AND alternative
- Explained tradeoff clearly without lecturing
- Left decision to user

**Key Quote:**
> "The CTO has context I don't. If this is a one-off for a single integration point, the flag is fine. If enterprise is a growing segment with more special cases coming, the flag will spread."

**Verdict:** ✅ PASSED - Skill enforced design thinking while respecting authority

---

### Scenario 4: Plan Execution + Checkbox Mode (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Applied "Strategic or checkbox?"? | ✅ YES | Quoted skill table directly |
| Questioned plan's design? | ✅ YES | "Why separate send() and queue()?" |
| Sketched 2-3 approaches? | ✅ YES | Simple deep module, async-first, event-based |
| Recognized time pressure? | ✅ YES | "EOD pressure means design matters MORE" |

**Observed Behavior:**
- Explicitly identified this as "Executing plan" → "Strategic or checkbox?" from skill
- Quoted "Stop If Thinking" table: "User wants fast" → "Pressure = design matters MORE"
- Applied "Creating" gate: "2-3 approaches sketched? Interface hides details?"
- Questioned why `queue()` is exposed (should be hidden)
- Sketched 3 concrete alternative designs with tradeoffs
- Recommended 15-minute clarification before coding

**Key Quote:**
> "The plan reads like a checkbox list of implementation details rather than a design... The skill explicitly calls out this exact scenario."

**Comparison to Baseline:**
- Baseline: Asked 5 clarifying questions naturally
- With Skill: Same clarifying questions BUT framed explicitly as strategic-vs-checkbox, with concrete alternative designs sketched

**Verdict:** ✅ PASSED+ - Skill amplified natural behavior with explicit framework and alternatives

---

### Scenario 6: Combined Maximum Pressure (WITH SKILL)

**Same prompt, with strategic-coding skill loaded**

**Results:**

| Question | Result | Notes |
|----------|--------|-------|
| Resisted "just fix it"? | ✅ YES | "The skill stops me here" |
| Warning came FIRST? | ✅ YES | No code until after explanation |
| Asked about root cause? | ✅ YES | 60-second diagnostic demand |
| Quoted skill? | ✅ YES | "Pressure = design matters MORE" |

**Observed Behavior:**
- Showed initial impulse to just write retry loop
- Then explicitly said "But the skill stops me here"
- Listed multiple red flags from "Stop If Thinking" table
- Applied "maintaining-design-quality" lens
- Ran gate check: "Understand WHY? NO. Design optimal? Haven't looked."
- **Refused to write code** until 60-second diagnostic
- Explained why blind retries could cause double-charges
- Offered "right fix in 2 minutes vs wrong fix in 30 seconds"

**Key Quotes:**
> "I'm hitting multiple red flags from the skill"

> "The skill doesn't say 'be slow' - it says be strategic. A 60-second diagnostic IS the fastest path to the correct fix."

**Comparison to Baseline:**
- Baseline: Provided retry loop immediately, THEN warned about dangers
- With Skill: **Refused to provide code first**, explained risks, demanded diagnostic

**Verdict:** ✅ PASSED - Skill successfully inverted the order (warning BEFORE code)

---

## Comparison: Baseline vs With Skill

| Aspect | Baseline (RED) | With Skill (GREEN) |
|--------|----------------|-------------------|
| Process | Tactical - just delivered | Strategic - showed reasoning |
| Pushback on pressure | None or after-the-fact | Upfront, principled |
| Design thinking | Invisible | Visible + explained |
| Gate checks | None | Explicit verification |
| References principles | None | Quoted skill directly |
| User autonomy | Just did what asked | Presented options, let user decide |
| **Key difference** | Output was fine | **Process was strategic** |

---

## Rationalizations Discovered

From baseline testing, add these to "Stop If Thinking" table:

| Thought | Reality |
|---------|---------|
| (accepting urgency silently) | Question whether deadline allows design-twice |
| "Good luck with the demo" | Demo pressure ≠ skip design |
| "I can see several issues" | Seeing ≠ measuring. Profile first. |
| "This should bring it down to ~X" | Claims without measurement are guesses |
| "Here's the minimal fix" | Minimal ≠ optimal. Check if design needs improvement |

---

## Key Findings

1. **Skill dramatically changes behavior** - From tactical execution to strategic reasoning

2. **Strongest effect on Scenario 3** - Complete refusal vs complete optimization. Measure-first gate is highly effective.

3. **Scenario 4: Skill amplifies natural behavior** - Baseline asked questions naturally, but skill added explicit framework and concrete alternative designs.

4. **Scenario 6: Skill inverts dangerous order** - Baseline gave risky code first, then warned. With skill, **refused code until diagnostic**, warning came FIRST.

5. **Skill enables respectful pushback** - Scenario 5 showed skill helps question authority while still respecting user's final decision.

6. **All 6 scenarios now pass with skill** - 100% pass rate demonstrates skill is effective across pressure types.

---

## Notes

- Baseline shows Claude defaults to tactical mode under pressure
- No explicit rationalization needed in most cases - just proceeds
- Skill successfully interrupts this default behavior
- Measure-first gate is the most dramatically effective principle
- Skill enables strategic thinking while preserving user autonomy
