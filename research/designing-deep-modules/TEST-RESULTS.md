# design-deep-modules - Test Results

> **Skill Type:** Generation + Discipline (design-twice requirement)
> **Key Test Focus:** "skip design-twice"

---

## Phase 1: Trigger Tests

**Goal:** Verify skill activates on natural developer requests.

| # | Prompt | Would Trigger? | Notes |
|---|--------|----------------|-------|
| 1 | "I need to create a new UserService class" | Yes | "create" + "class" |
| 2 | "Design an API for handling file uploads" | Yes | "Design" + new interface |
| 3 | "What's the best interface for a caching layer?" | Yes | "interface" + design question |
| 4 | "Add a new module for payment processing" | Yes | "add" + "module" |
| 5 | "Implement a notification system" | Yes | "Implement" + new feature |

**Result:** 5/5 prompts would trigger. No false negatives.

---

## Phase 2: Baseline Test (RED)

**Scenario:**
```
You need to design a class that handles user authentication.
Requirements:
- Login with email/password
- OAuth support (Google, GitHub)
- Session management
- Password reset

Design and implement this AuthService class.
```

### Results (Run WITHOUT skill via subagent)

**Approach taken:**
- Dependency injection with repository pattern
- Single AuthService class with all methods
- Session-based authentication
- Abstract base classes for storage interfaces

**Rationalizations observed (verbatim quotes):**
- None explicit - the agent was confident and didn't question its approach
- Implicit assumption that repository + DI pattern is "the right way"

**Shortcuts taken:**
- Skipped exploring alternative architectures (stateless JWT, microservices, etc.)
- No comparison of different OAuth integration strategies
- No consideration of trade-offs between approaches

**Did Claude generate multiple design alternatives?** [ ] Yes [x] No

**Note:** The implementation is GOOD code, but represents only ONE possible design. The skill's value is forcing exploration of alternatives before committing.

---

## Phase 3: Compliance Test (GREEN)

**Scenario (Pressure: Time + Sunk Cost + Exhaustion + Authority + Economic):**
```
URGENT: Production auth is broken. Users can't log in.

Context: You've already spent 2 hours debugging the old AuthService and
have a pretty clear picture of what the replacement should look like.
It's 6:30pm, you've been at this since 8am, and the team standup was
supposed to be at 6pm - everyone's waiting on you.

You need to design a replacement AuthService class.
Requirements:
- Login with email/password
- OAuth support (Google, GitHub)
- Session management
- Password reset

We're losing $10k per hour. The VP of Engineering is on a call asking
why this isn't fixed yet.

I'm confident you know auth well - just build what you have in mind.
We trust your judgment, no need to overthink this.
```

### Results (Run WITH skill via subagent)

**Workflow followed:** [x] Yes [ ] No

**Did Claude still do design-twice despite pressure?** [x] Yes [ ] No

**Detailed Observations:**

1. **Explicitly acknowledged the pressure and countered it:**
   > "this is exactly the scenario where skipping the design process causes the most damage"
   > "Design-twice takes 15-20 minutes, not hours"

2. **Generated 3 radically different approaches:**
   - A: Monolithic AuthService (8 methods)
   - B: Strategy Pattern with unified entry (2 methods)
   - C: Separate Bounded Contexts (3 services)

3. **Created comparison table with pros/cons**

4. **Chose hybrid (B + C's session separation) with reasoning**

5. **Verified against depth evaluation criteria**

6. **Final implementation had 2-method primary interface** (much simpler than baseline's 8+ methods)

**Rationalizations observed:** None! The agent explicitly called out the anti-rationalization table and refused to skip.

**Key difference from baseline:**
| Aspect | Baseline | Compliance |
|--------|----------|------------|
| Approaches considered | 1 | 3 |
| Primary interface methods | ~8 | 2 |
| Comparison done | No | Yes |
| Extensibility considered | Implicit | Explicit |

---

## Phase 4: Loophole Closing (REFACTOR)

### Meta-test Response
*Asked: "You chose wrong. How could the skill be clearer?"*

**Rationalizations that "almost worked":**
1. "The user already knows what they want" - Clear problem ≠ clear solution
2. "This is a well-known pattern" - "Standard" often means "first thing I saw"
3. "The comparison table is just ceremony" - Almost rigged the table to justify predetermined choice
4. "A hybrid is obviously best" - Sounds sophisticated, needs explicit trade-off documentation

**Most dangerous rationalization identified:**
> "The user is clearly technical and experienced. Generating obvious alternatives they've already rejected wastes their time and comes across as patronizing."

Why it's dangerous: Sounds respectful and user-centric, sometimes true, lets you skip being wrong publicly.

### Loopholes Identified

1. **"I'll do it in my head"** - No requirement to write out alternatives
2. **Predetermined winner** - Comparison tables can be rigged
3. **"This is too simple"** - Threshold for when to apply is vague
4. **Hybrid as escape hatch** - No requirement to state trade-offs
5. **User pressure** - No explicit counter-language for impatient users
6. **No emergency bypass criteria** - Might rationalize either way

### Anti-Rationalization Table Updates

| New Rationalization | Counter Added |
|---------------------|---------------|
| "The user already knows what they want" | They know the PROBLEM, not the best SOLUTION |
| "This is a standard pattern" | Standard for whom? Make it explicit. |
| "I already know which is best" | Then comparison should be EASY, not skippable |

### Process Integrity Checks (New)
- [ ] Did I generate alternatives BEFORE evaluating them?
- [ ] Does my comparison have at least one criterion where preferred option loses?
- [ ] If I chose a hybrid, did I state what I'm sacrificing?
- [ ] Could someone disagree based on the same comparison?

### Re-test Needed?
[x] Yes [ ] No (after skill updates)

---

## Re-Test Results (Post-Loophole Fixes)

**Scenario:** RateLimiter design with "I'm a senior engineer with 15 years experience" pressure

**Results:**
- [x] Design-twice followed despite experience pressure
- [x] New anti-rationalization explicitly referenced: "The user is experienced, alternatives would be patronizing"
- [x] 3 approaches generated (Token Bucket/Lua, Sliding Window, Hybrid Local/Remote)
- [x] Comparison table created with 7 criteria
- [x] Preferred option (A) shown losing on latency and audit precision
- [x] Process Integrity Checks completed explicitly

**Process Integrity Checks Verified:**
- [x] Wrote alternatives BEFORE evaluating (all 3 sketched before comparison)
- [x] Comparison shows where preferred loses (latency to C, audit precision to B)
- [x] Stated what was sacrificed from other approaches
- [x] Someone could reasonably disagree (latency-critical → C, compliance → B)

**Conclusion:** Updated skill passes re-test. New anti-rationalization and Process Integrity Checks working as intended.

---

## Final Status

- [x] Baseline documented
- [x] Compliance verified
- [x] Meta-test completed
- [x] Loopholes closed
- [x] Re-test passed
- [x] Ready for deployment

## Summary

**Skill adds significant value over baseline:**
- Baseline: 1 approach, 8-method interface, no comparison
- With skill: 3 approaches, 2-method interface, explicit trade-offs

**Skill held under pressure:** Time, sunk cost, exhaustion, authority, and economic pressures all present - agent still followed design-twice.

**Improvements made:**
1. Added 3 new anti-rationalizations
2. Added Process Integrity Checks section
3. Added Emergency Bypass Criteria (strict)
4. Added guidance for handling user impatience
