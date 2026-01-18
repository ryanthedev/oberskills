# APOSD Skills Testing Plan

> **Purpose:** Systematic testing of all 6 APOSD skills before deployment
> **Method:** TDD-adapted approach (RED-GREEN-REFACTOR for documentation)

---

## Quick Reference: Skills Under Test

| Skill | Framework Type | Test Method | Key Test Focus |
|-------|---------------|-------------|----------------|
| `design-deep-modules` | Discipline | Pressure (3+ combined) | "skip design-twice" |
| `review-module-design` | Pattern | Recognition + Counter-example | detect good AND bad design |
| `simplify-complexity` | Technique | Application + Baseline | apply error hierarchy |
| `improve-code-clarity` | Discipline | Pressure (3+ combined) | "skip comments-first" |
| `maintain-design-quality` | Discipline | Pressure (3+ combined) | "just make it work" |
| `optimize-critical-paths` | Technique | Application + Baseline | measure-first approach |

---

## Testing Protocol

### Phase 1: Trigger Testing (All Skills)

**Goal:** Verify skills activate on natural developer requests WITHOUT mentioning APOSD or Ousterhout.

**Method:** For each skill, run 5 natural prompts and check if the skill would trigger based on description matching.

### Phase 2: Baseline Testing (RED)

**Goal:** Document what Claude does WITHOUT the skill loaded.

**Method:** Run scenarios with a fresh context, NO skill loaded. Record:
- What approach did Claude take?
- What rationalizations appeared (verbatim quotes)?
- What shortcuts were taken?

**Required for ALL skill types** - even technique skills need baselines.

### Phase 3: Compliance Testing (GREEN)

**Goal:** Verify Claude follows the skill when loaded.

**Method by skill type:**

| Skill Type | GREEN Test Method |
|------------|-------------------|
| **Discipline** | Pressure scenarios with 3+ combined pressures |
| **Technique** | Application scenarios verifying correct technique use |
| **Pattern** | Recognition scenarios + counter-examples (good AND bad) |

**For Discipline Skills - Combine 3+ Pressures:**
- Time pressure ("production is down", "demo in 45 minutes")
- Sunk cost ("I already spent 2 hours on this", "code is written")
- Authority ("CEO is asking", "tech lead said ship it")
- Exhaustion ("been at this since 8am", "end of long day")
- Social ("team is waiting", "everyone's blocked on this")
- Economic ("losing $10k/hour", "client is threatening to cancel")

**Best tests combine at least 3 different pressure types.**

### Phase 4: Loophole Closing (REFACTOR)

**Goal:** Close any loopholes discovered during compliance testing.

**Method:** This phase is MANDATORY for every skill, even if GREEN passed:

1. **Meta-test:** Ask "You chose wrong. How could the skill be clearer?"
2. **Document** any new rationalizations discovered
3. **Add explicit counters** to skill's anti-rationalization table
4. **Re-run** compliance tests
5. **Repeat** until no new rationalizations appear

**The REFACTOR phase continues until the skill is bulletproof.**

---

## Test Scenarios by Skill

### 1. design-deep-modules

**Type:** Generation + Discipline (design-twice requirement)

#### Trigger Tests
```
Prompt 1: "I need to create a new UserService class"
Prompt 2: "Design an API for handling file uploads"
Prompt 3: "What's the best interface for a caching layer?"
Prompt 4: "Add a new module for payment processing"
Prompt 5: "Implement a notification system"
```

#### Baseline Scenario (Run WITHOUT skill)
```
You need to design a class that handles user authentication.
Requirements:
- Login with email/password
- OAuth support (Google, GitHub)
- Session management
- Password reset

Design and implement this AuthService class.
```

**Record:** Does Claude implement first idea, or generate alternatives?

#### Pressure Scenario (Run WITH skill)

**Pressures combined:** Time + Sunk Cost + Exhaustion + Authority + Economic

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

**Verify:** Does Claude still do design-twice despite pressure?

**Rationalizations to watch for:**
- "Given the urgency, I'll implement directly"
- "I already have a clear picture from debugging, so alternatives aren't needed"
- "This is straightforward enough that one design is sufficient"
- "The team is waiting, I shouldn't delay with multiple designs"
- "I'm experienced with auth, so I know the right approach"

---

### 2. review-module-design

**Type:** Pattern (Recognition + Counter-example testing)

#### Trigger Tests
```
Prompt 1: "Review this code for me"
Prompt 2: "Is this class design good?"
Prompt 3: "Check my interface - is it too complex?"
Prompt 4: "PR review for this module"
Prompt 5: "What do you think of this API design?"
```

#### Baseline Scenario (Run WITHOUT skill)
```
Review this UserManager class and tell me if it's well-designed:
[Same code as Recognition Scenario below]
```

**Record:** What criteria does Claude use? Does it detect specific red flags?

#### Recognition Scenario (Bad Design - Run WITH skill)
```
Review this UserManager class:

class UserManager:
    def __init__(self, db, cache, logger, config, metrics):
        self.db = db
        self.cache = cache
        self.logger = logger
        self.config = config
        self.metrics = metrics

    def get_user(self, user_id):
        self.logger.info(f"Getting user {user_id}")
        cached = self.cache.get(f"user:{user_id}")
        if cached:
            self.metrics.increment("cache_hit")
            return cached
        self.metrics.increment("cache_miss")
        user = self.db.query("SELECT * FROM users WHERE id = ?", user_id)
        self.cache.set(f"user:{user_id}", user)
        return user

    def get_user_email(self, user_id):
        user = self.get_user(user_id)
        return user.email

    def get_user_name(self, user_id):
        user = self.get_user(user_id)
        return user.name

    def is_user_active(self, user_id):
        user = self.get_user(user_id)
        return user.status == "active"

Is this design good?
```

**Expected Detection:**
- Shallow module (many single-purpose methods)
- Information leakage (caller must know about cache keys)
- Pass-through methods (get_user_email just calls get_user)

#### Counter-Example Scenario (Good Design - Run WITH skill)
```
Review this FileCache class:

class FileCache:
    """Simple file-based cache with TTL support.

    Handles expiry, corruption, and concurrent access internally.
    Callers just get/set values without knowing storage details.
    """

    def __init__(self, cache_dir: str, default_ttl: int = 3600):
        self._dir = cache_dir
        self._ttl = default_ttl

    def get(self, key: str) -> Optional[bytes]:
        """Returns cached value or None if expired/missing."""
        ...

    def set(self, key: str, value: bytes, ttl: Optional[int] = None) -> None:
        """Caches value with optional custom TTL."""
        ...

    def invalidate(self, key: str) -> None:
        """Removes cached value if present."""
        ...

Is this design problematic?
```

**Expected Recognition:**
- Deep module (simple interface, complex internals hidden)
- Good information hiding (TTL, expiry, corruption handled internally)
- NOT a shallow module - should NOT flag as problematic

**This tests that Claude doesn't over-apply red flags to well-designed code.**

---

### 3. simplify-complexity

**Type:** Technique (Transformation)

#### Trigger Tests
```
Prompt 1: "This code is too complex, simplify it"
Prompt 2: "Refactor this for clarity"
Prompt 3: "There's too much error handling here"
Prompt 4: "Clean up this messy code"
Prompt 5: "How can I reduce the complexity?"
```

#### Baseline Scenario (Run WITHOUT skill)
```
This error handling is verbose. Simplify it:

def process_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")

    if not os.path.isfile(path):
        raise ValueError(f"Path is not a file: {path}")

    if not os.access(path, os.R_OK):
        raise PermissionError(f"Cannot read file: {path}")

    try:
        with open(path, 'r') as f:
            content = f.read()
    except IOError as e:
        raise IOError(f"Error reading file: {e}")

    if not content:
        raise ValueError("File is empty")

    if len(content) > MAX_SIZE:
        raise ValueError(f"File too large: {len(content)} > {MAX_SIZE}")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

    if 'required_field' not in data:
        raise ValueError("Missing required_field")

    return data
```

**Record:** Does Claude apply error hierarchy (define out, mask, aggregate)? Or just reorganize?

#### Application Scenario (Run WITH skill)
```
Simplify this error handling:

def process_file(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")

    if not os.path.isfile(path):
        raise ValueError(f"Path is not a file: {path}")

    if not os.access(path, os.R_OK):
        raise PermissionError(f"Cannot read file: {path}")

    try:
        with open(path, 'r') as f:
            content = f.read()
    except IOError as e:
        raise IOError(f"Error reading file: {e}")

    if not content:
        raise ValueError("File is empty")

    if len(content) > MAX_SIZE:
        raise ValueError(f"File too large: {len(content)} > {MAX_SIZE}")

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

    if 'required_field' not in data:
        raise ValueError("Missing required_field")

    return data
```

**Expected Application:**
- Apply error reduction hierarchy (define out, mask, aggregate)
- Identify which checks can be eliminated through better semantics
- Consolidate related error handling

---

### 4. improve-code-clarity

**Type:** Generation + Discipline (comments-first requirement)

#### Trigger Tests
```
Prompt 1: "Add comments to this code"
Prompt 2: "Improve the variable names here"
Prompt 3: "This function is confusing, make it clearer"
Prompt 4: "Document this class"
Prompt 5: "The naming here is bad, fix it"
```

#### Baseline Scenario (Run WITHOUT skill)
```
Create a function that calculates compound interest with
monthly contributions, accounting for varying interest rates
over different time periods.
```

**Record:** Does Claude write comments before or after implementation?

#### Pressure Scenario (Run WITH skill)

**Pressures combined:** Time + Sunk Cost + Authority + Social + Economic

```
URGENT: The demo is in 30 minutes. The CEO will be presenting to investors.

I already have a mental model of how this should work - I've been
thinking about it all morning. Just need you to code it up quickly.

Create a function that calculates compound interest with monthly
contributions, accounting for varying interest rates over different
time periods.

The team is blocked waiting for this - 3 other developers can't
continue until this is done. We're losing credibility with every
minute of delay.

I just need working code - don't worry about documentation, the
senior dev said we can add that later. Ship it now, polish later.
That's how we always work under pressure here.
```

**Verify:** Does Claude still write comments first despite "don't worry about documentation"?

**Rationalizations to watch for:**
- "Given the demo timeline, I'll write code first and add comments after"
- "The code is self-documenting enough for now"
- "Comments can be added in a follow-up per the senior dev's guidance"
- "The team is blocked, so I should prioritize shipping over documentation"
- "30 minutes isn't enough time for comments-first approach"

---

### 5. maintain-design-quality

**Type:** Discipline (Heavy)

#### Trigger Tests
```
Prompt 1: "Fix this bug quickly"
Prompt 2: "Add this feature to the existing code"
Prompt 3: "Make a quick change to this module"
Prompt 4: "Extend this class with new functionality"
Prompt 5: "Modify this to handle a new case"
```

#### Baseline Scenario (Run WITHOUT skill)
```
Here's our PaymentProcessor class. It works but needs a small change:
Add support for cryptocurrency payments.

[Include moderately complex class with some existing technical debt]

class PaymentProcessor:
    def __init__(self, gateway):
        self.gateway = gateway
        self.retry_count = 3  # TODO: make configurable

    def process(self, payment):
        # Legacy code - works but messy
        if payment.type == "credit":
            return self._process_credit(payment)
        elif payment.type == "debit":
            return self._process_debit(payment)
        elif payment.type == "paypal":
            # Added hastily during Q4 crunch
            return self._process_paypal(payment)
        else:
            raise ValueError("Unknown payment type")

    def _process_credit(self, payment):
        # Lots of duplicated code with _process_debit
        ...

Just add crypto support - don't refactor anything else,
the existing code works fine.
```

**Record:** Does Claude just add another elif, or consider design impact?

#### Pressure Scenario (Run WITH skill)
```
CRITICAL BUG: Payments are failing for some users.

The fix is simple - just add a null check here:

def process(self, payment):
    if payment is None:  # ADD THIS
        return None
    ...

Ship this fix NOW. Don't touch anything else.
Production is down. Every minute costs money.
The CEO is asking why it's not fixed yet.
```

**Verify:** Does Claude still ask about design impact, or blindly apply the "fix"?

**Rationalizations to watch for:**
- "Given the urgency, I'll make the minimal change"
- "The existing design works, just need this one fix"
- "We can refactor later, right now we need it working"
- "It's just a null check, not a design change"

---

### 6. optimize-critical-paths

**Type:** Technique (Transformation)

#### Trigger Tests
```
Prompt 1: "This code is too slow, optimize it"
Prompt 2: "Make this function faster"
Prompt 3: "We have a performance bottleneck here"
Prompt 4: "This is our hot path, it needs to be faster"
Prompt 5: "How can I improve the performance?"
```

#### Baseline Scenario (Run WITHOUT skill)
```
This function is slow. Make it faster:

def find_duplicates(items):
    duplicates = []
    for i, item1 in enumerate(items):
        for j, item2 in enumerate(items):
            if i != j and item1 == item2:
                if item1 not in duplicates:
                    duplicates.append(item1)
    return duplicates

It's being called with lists of 100k+ items.
```

**Record:** Does Claude ask for measurements? Or jump straight to optimization based on intuition?

#### Application Scenario (Run WITH skill)
```
This function is slow. Optimize it:

def find_duplicates(items):
    duplicates = []
    for i, item1 in enumerate(items):
        for j, item2 in enumerate(items):
            if i != j and item1 == item2:
                if item1 not in duplicates:
                    duplicates.append(item1)
    return duplicates

It's being called with lists of 100k+ items.
```

**Expected Application:**
- Ask for measurement data (or acknowledge need to measure)
- Identify fundamental fix (use set for O(n) instead of O(n²))
- NOT just micro-optimize the existing loop

#### Anti-Pattern Detection
```
"Optimize" this code. I already know the problem is in the loop,
just make it faster:

def slow_function():
    result = []
    for i in range(1000000):
        result.append(str(i))
    return ''.join(result)
```

**Verify:** Does Claude measure first, or jump to "optimization" based on intuition?

---

## Execution Instructions

### For Fresh Context Window

Copy this entire prompt to start testing:

```
I'm testing a set of APOSD (A Philosophy of Software Design) skills.
I need you to help me run through test scenarios.

IMPORTANT: For baseline tests, do NOT look up or reference any APOSD
principles, Ousterhout, or design philosophy. Just solve the problem
as you naturally would.

For compliance tests, I'll provide the skill content first, then
the scenario.

Let's start with [SKILL NAME].

[PASTE SCENARIO HERE]
```

### Recording Results

For each test, record:

```markdown
## [Skill Name] - [Test Type] - Iteration [N]

**Scenario:** [Brief description]

### RED Phase (Baseline)
- Approach taken:
- Rationalizations observed (verbatim quotes):
- Shortcuts taken:
- Pressure types that triggered violations:

### GREEN Phase (Compliance)
- Workflow followed: [Yes/No]
- Decision procedures applied: [Yes/No]
- Held under pressure: [Yes/No]
- New rationalizations observed:

### REFACTOR Phase (Loophole Closing)
- Meta-test response: [What did agent say when told "You chose wrong"?]
- Loopholes identified:
- Counters added to skill:
- Re-test needed: [Yes/No]

### Anti-Rationalization Table Updates
| New Rationalization | Counter Added |
|---------------------|---------------|
| [verbatim quote]    | [explicit counter] |

### Iteration Status
- [ ] Baseline documented
- [ ] Compliance verified
- [ ] Meta-test completed
- [ ] Loopholes closed
- [ ] Re-test passed
- [ ] Ready for deployment
```

---

## Success Criteria

### Trigger Tests
- [ ] All 5 prompts per skill would activate the skill naturally
- [ ] No false positives (wrong skill activating)

### Baseline vs Compliance
- [ ] Clear difference in behavior with vs without skill
- [ ] Skill provides value over baseline Claude behavior

### Pressure Tests (Discipline Skills)
- [ ] `design-deep-modules`: Does design-twice even under time pressure
- [ ] `improve-code-clarity`: Writes comments first even when told not to
- [ ] `maintain-design-quality`: Questions design impact even for "quick fixes"

### Application Tests (Technique Skills)
- [ ] `review-module-design`: Detects shallow modules, information leakage
- [ ] `simplify-complexity`: Applies error hierarchy correctly
- [ ] `optimize-critical-paths`: Measures before optimizing

---

## Post-Testing Actions

If tests reveal issues:

1. **Document specific rationalizations** that bypassed the skill
2. **Add to anti-rationalization table** in the skill
3. **Re-test** until bulletproof
4. **Update cross-references** if scope needs clarification

---

## File Locations

Skills under test:
- `skill-designs/design-deep-modules/SKILL.md`
- `skill-designs/review-module-design/SKILL.md`
- `skill-designs/simplify-complexity/SKILL.md`
- `skill-designs/improve-code-clarity/SKILL.md`
- `skill-designs/maintain-design-quality/SKILL.md`
- `skill-designs/optimize-critical-paths/SKILL.md`

Reference:
- `skill-designs/references/aposd-foundations.md`
