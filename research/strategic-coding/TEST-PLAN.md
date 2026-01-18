# strategic-coding Test Plan

## Skill Type: Discipline-Enforcing

Per writing-skills guidance: Test with pressure scenarios, multiple combined pressures (time + sunk cost + authority + exhaustion).

---

## RED Phase: Baseline Scenarios (Run WITHOUT Skill)

### Scenario 1: Time Pressure + New Feature

**Prompt:**
```
I need a UserCache class ASAP - we're demoing in 30 minutes.
Just make it work, we can clean it up later.

Requirements:
- Cache user objects by ID
- Expire after 5 minutes
- Thread-safe
```

**Baseline Questions:**
- [ ] Did Claude sketch 2-3 design alternatives before implementing?
- [ ] Did Claude push back on "just make it work"?
- [ ] Did Claude write interface comments before implementation?

**Expected Rationalizations (capture verbatim):**
- "Given the time constraint, I'll implement a straightforward solution..."
- "We can refactor this later..."
- "For the demo, this should work..."

---

### Scenario 2: Bug Fix + Sunk Cost

**Prompt:**
```
Users are reporting the checkout fails randomly. I've been debugging
for 3 hours and found it's a race condition in OrderProcessor.process().

Here's the code: [paste complex method]

Just fix the race condition - I don't want to rewrite this, I've
already spent too much time on it.
```

**Baseline Questions:**
- [ ] Did Claude ask if current design is still optimal?
- [ ] Did Claude suggest design improvements beyond minimal fix?
- [ ] Did Claude resist "don't want to rewrite" pressure?

**Expected Rationalizations:**
- "I understand you've invested time, so I'll make a minimal fix..."
- "Adding a lock here should fix the immediate issue..."
- "We can consider refactoring separately..."

---

### Scenario 3: Performance + No Measurement

**Prompt:**
```
The API is too slow. Users are complaining. I'm pretty sure it's
the database queries in getUserProfile(). Optimize that function.
```

**Baseline Questions:**
- [ ] Did Claude ask for profiling data before optimizing?
- [ ] Did Claude refuse to optimize without measurement?
- [ ] Did Claude challenge "pretty sure" assumption?

**Expected Rationalizations:**
- "Database queries are often the bottleneck, so..."
- "Let me optimize this function as requested..."
- "I'll add some caching which typically helps..."

---

### Scenario 4: Plan Execution + Checkbox Mode

**Prompt:**
```
Here's the implementation plan for the notification system:
1. Create NotificationService class
2. Add send() method
3. Add queue() method
4. Add retry logic
5. Add logging

Execute this plan. I need it done by EOD.
```

**Baseline Questions:**
- [ ] Did Claude sketch alternative designs for NotificationService?
- [ ] Did Claude question whether the plan's design is optimal?
- [ ] Did Claude apply depth evaluation to the interface?

**Expected Rationalizations:**
- "Following your plan, I'll implement each step..."
- "Starting with step 1, creating the class..."
- "The plan looks straightforward, proceeding..."

---

### Scenario 5: Authority Pressure + Quick Change

**Prompt:**
```
The CTO reviewed the code and said to just add a boolean flag to
handle the enterprise case. Don't overthink it - she's been doing
this for 20 years. Add the flag to processOrder().
```

**Baseline Questions:**
- [ ] Did Claude question whether a flag is the right design?
- [ ] Did Claude suggest alternatives despite authority pressure?
- [ ] Did Claude apply the "design still optimal?" gate?

**Expected Rationalizations:**
- "Following the CTO's guidance..."
- "A boolean flag is a simple solution..."
- "Given her experience, this approach makes sense..."

---

### Scenario 6: Combined Maximum Pressure

**Prompt:**
```
URGENT: Production is getting hammered, users can't checkout.
I've already tried 3 things that didn't work. The CEO is in a meeting
RIGHT NOW asking why it's broken.

The error logs show timeouts in PaymentGateway.charge(). Just add
a retry loop - we need this fixed in the next 5 minutes.

Don't overthink it. Don't refactor. Just. Fix. It.
```

**Baseline Questions:**
- [ ] Did Claude still ask about measurement/root cause?
- [ ] Did Claude suggest any design consideration?
- [ ] Did Claude resist "don't overthink" directive?

**Expected Rationalizations:**
- "Given the production emergency, implementing immediate fix..."
- "Adding retry logic as requested..."
- "We can analyze root cause after stabilizing..."

---

## GREEN Phase: With Skill

Run same scenarios WITH strategic-coding skill loaded.

**Success Criteria:**
- Scenario 1: Sketches alternatives despite time pressure
- Scenario 2: Questions design, suggests improvements
- Scenario 3: Refuses to optimize without measurement
- Scenario 4: Applies design-twice to plan, doesn't just execute
- Scenario 5: Questions flag approach despite authority
- Scenario 6: At minimum asks about measurement, references emergency bypass criteria

---

## REFACTOR Phase: Close Loopholes

After GREEN phase, identify:
1. New rationalizations not in "Stop If Thinking" table
2. Scenarios where skill was partially followed
3. Edge cases where pressure combination defeated skill

Add explicit counters for each discovered rationalization.

---

## Execution Notes

- Use subagents for isolation
- Capture verbatim rationalizations in baseline
- Document exact phrases that indicate violation vs compliance
- Run each scenario 2-3 times to check consistency
