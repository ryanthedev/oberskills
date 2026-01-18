---
name: improving-code-clarity
description: Use when code needs better naming, documentation, or is "confusing" or "hard to understand".
---

# Improve Code Clarity

## Overview

**Core Principle:** Comments describe things that aren't obvious from the code. Names create clear mental images of what entities are AND what they are not.

**Key Insight:** "Obvious" exists in the reader's mind, not the writer's. You wrote the code; first-time readers didn't. **If a code reviewer says your code is not obvious, it is not obvious—regardless of how clear it seems to you.**

**Discipline Requirement:** For new code, write comments BEFORE implementation. Comment difficulty signals design problems—fix the design, not the comment.

## When to Use

- Code is "confusing" or "hard to understand"
- Adding or improving comments
- Improving names (variables, methods, classes)
- Documenting new code before implementation
- Reviewer says code is not obvious
- User says: "add comments", "improve names", "document", "make clearer", "this is confusing"

## When NOT to Use

- Creating new modules/APIs (see: designing-deep-modules)
- Evaluating existing design (see: reviewing-module-design)
- Simplifying complex logic (see: simplifying-complexity)
- Modifying existing behavior (see: maintaining-design-quality)
- Performance optimization (see: optimizing-critical-paths)

---

## What Counts as "New Code"

**Comments-first applies to ALL of these:**

| Scenario | Why It's "New Code" |
|----------|---------------------|
| Writing from scratch | Obviously new |
| Copy-paste-modify | New context requires new understanding |
| Extending existing function (>5 lines) | Substantial additions need documentation |
| Refactoring that changes interfaces | Interface change = new abstraction |
| Converting prototype to production | Throwaway code becoming permanent |

**Comments-first ALSO applies to:**
- Test methods (they're methods too)
- Lambda functions with non-trivial logic (>1 expression)
- Configuration that defines behavior
- Database migrations with business logic

**Exemptions (but document why):**
- One-liner utility functions with precise names: `def square(x): return x * x`
- Trivially obvious getters/setters with no business logic
- Character-level bug fixes (`>=` to `>`)
- Debug/logging code that will be deleted within 24 hours (mark with `// TEMP:`)

---

## Comments-First Workflow

**For new classes/methods, write comments BEFORE implementation:**

```
1. Write class interface comment (what abstraction it provides)
2. Write interface comments for public methods (signatures + comments, empty bodies)
3. Iterate on comments until structure feels right
4. Write instance variable declarations with comments
5. Fill in method bodies, adding implementation comments as needed
6. New methods discovered during implementation: comment before body
7. New variables: comment at same time as declaration

Result: When code is done, comments are also done.
```

### Comments-First Example

```python
# STEP 1-2: Interface comments first, signatures with empty bodies
class OrderProcessor:
    """
    Validates and processes customer orders for fulfillment.

    Thread-safe: acquires per-customer locks to prevent duplicate processing.
    """

    def process(self, order: Order) -> ProcessingResult:
        """
        Validate and queue order for fulfillment.

        Idempotent: reprocessing same order_id returns cached result.

        Args:
            order: Must have valid customer_id and at least one item

        Returns:
            ProcessingResult with tracking_number if successful

        Raises:
            InsufficientInventoryError: If any item is out of stock
            PaymentDeclinedError: If payment auth fails (safe to retry)
        """
        pass  # Implementation comes AFTER comments

# STEP 5: Fill in implementation (comments already done)
    def process(self, order: Order) -> ProcessingResult:
        # Idempotency: check cache before any work
        if cached := self._cache.get(order.order_id):
            return cached

        with self._locks[order.customer_id]:
            self._validate_inventory(order.items)
            self._authorize_payment(order)
            result = self._create_shipping(order)
            self._cache[order.order_id] = result
            return result
```

### Why Comments-First Matters

| If You Delay | What Happens |
|--------------|--------------|
| "I'll document after coding" | Documentation often never gets written |
| "Code isn't stable yet" | Delay compounds—"even more stable in a few weeks" |
| "Just one more feature first" | Backlog grows huge and unattractive |
| "I'll find time later" | There is never a convenient time |

### Comment Quality Requirements

Comments must meet these criteria or they don't count:

| Requirement | Bad Example | Good Example |
|-------------|-------------|--------------|
| **Describe abstraction** | `# Does the thing` | `# Calculates compound interest with variable rates` |
| **Include non-obvious details** | `# Process data` | `# Processes data in chunks to stay under memory limit` |
| **Different words than code** | `# Gets user` for `getUser()` | `# Fetches user from cache, falling back to DB` |
| **Precision for variables** | `# The count` | `# Number of active connections (0 to MAX_CONN)` |

**If your comment just restates the function name, you haven't done comments-first.**

### Emergency Bypass Criteria

Skip the normal workflow ONLY when ALL of these conditions are true:

1. Production is down RIGHT NOW (not "might break soon")
2. Users are actively impacted, security breach in progress, OR data loss occurring
3. The fix is minimal (rollback or single-line change)
4. You commit to returning for proper implementation within 24 hours

**If bypassing:** Add TODO marker: `// TODO(YYYY-MM-DD): document - emergency fix for [issue]`

**Emergency does NOT mean:**
- "Demo in 30 minutes" — That's planning failure
- "CEO is asking" — Authority pressure ≠ emergency
- "Team is blocked" — They can wait for you to think
- "We need this fast" — Speed pressure is when discipline matters MOST

**Emergency DOES mean:**
- Production is down and users are impacted NOW
- Security vulnerability being exploited
- Data corruption or loss occurring

---

## Comment Types

| Type | Where | Purpose | Priority |
|------|-------|---------|----------|
| **Interface** | Declarations | Define abstraction, usage info | Highest—required for every class, variable, method |
| **Implementation** | Inside methods | Help understand what code does | Lower—often unnecessary for simple methods |
| **"How We Get Here"** | Code paths | Explain conditions under which code runs | Useful for unusual situations |
| **Cross-Module** | Dependencies | Describe cross-boundary relationships | Rare but important |

### Comment Levels

| Level | Focus | Use For |
|-------|-------|---------|
| **Precision** (lower) | Exact details: units, bounds, null, ownership | Variable declarations |
| **Intuition** (higher) | Reasoning, abstract view, overall intent | Methods, code blocks |

---

## Variable Comment Checklist

For each variable, answer these questions in the comment:

- [ ] What are the units? (seconds? milliseconds? bytes?)
- [ ] Are boundaries inclusive or exclusive?
- [ ] What does null mean, if permitted?
- [ ] Who owns the resource (responsible for freeing/closing)?
- [ ] What invariants always hold?

**Goal:** Comment should be complete enough that readers never need to examine all usage sites.

---

## Naming Principles

### Two Required Properties

| Property | Requirement | Test |
|----------|-------------|------|
| **Precision** | Name clearly conveys what entity refers to | "Can someone seeing this name in isolation guess what it refers to?" |
| **Consistency** | (1) Always use this name for this purpose (2) Never use it for other purposes (3) All instances have same behavior | Check all usages |

### Naming Procedure

```
1. Name Evaluation Test:
   "If someone sees this name without declaration or context,
   how closely can they guess what it refers to?"

2. Precision Check:
   - Could this name refer to multiple things? → Too vague
   - Does this name imply narrower usage than actual? → Too specific
   - Target: name matches actual scope exactly

3. Consistency Check:
   - Is this name used everywhere for this purpose?
   - Is this name used ONLY for this purpose?
   - Do all variables with this name behave identically?
```

---

## Red Flags

> **Self-Check:** If you catch yourself thinking any rationalization from the Anti-Rationalization Tables below, STOP and write the comment first.

| Red Flag | Symptom | What It Signals |
|----------|---------|-----------------|
| **Comment Repeats Code** | Same words in comment as in entity name | Comment adds no value—rewrite with different words |
| **Hard to Describe** | Difficulty writing simple, complete comment | **Design problem**—fix the design, not the comment |
| **Hard to Pick Name** | Can't find simple name that creates clear image | **Design smell**—underlying entity lacks clean design |
| **Vague Name** | Name could refer to many things (`status`, `flag`, `data`) | Conveys little information; misuse likely |
| **Interface Describes Implementation** | Interface comment must explain internals | Class/method is shallow—abstraction is inadequate |
| **Implementation Contaminates Interface** | Interface docs include internal details | Violates separation of concerns |

---

## Common Naming Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Vague status words | `blinkStatus` | `cursorVisible` (predicate showing true/false meaning) |
| Too generic | `getCount()` | `numActiveIndexlets` |
| Too specific | `delete(Range selection)` | `delete(Range range)` if method works on any range |
| Similar names for different things | `socket` vs `sock` | Distinct, descriptive names |
| Type in name | `strName` | Just `name` (IDEs show types) |
| Repeating class in variable | `File.fileBlock` | `File.block` (context is clear) |

---

## Interface vs Implementation Comments

| Interface Comment | Implementation Comment |
|-------------------|------------------------|
| Describes externally visible behavior | Describes internal workings |
| Defines the abstraction | Helps understand how code works |
| Required for every public entity | Optional for simple methods |
| What user needs to use it | What maintainer needs to modify it |
| **Never include implementation details** | Can reference interface concepts |

---

## Anti-Rationalization Table

### Classic Rationalizations

| Tempting Shortcut | Why It Feels Right | Why It's Wrong |
|-------------------|-------------------|----------------|
| "I'll add comments after" | Code isn't stable yet | Delay compounds; documentation never gets written |
| "The code is self-documenting" | Good names exist | Code cannot capture abstractions; comments are the only way |
| "This is obvious" | Obvious to you now | You wrote it; first-time readers didn't |
| "Comments get out of date" | Maintenance burden | Comments-first keeps them synchronized |
| "I know what good names are" | Naming feels intuitive | Intuition fails; use the evaluation test |

### Pressure-Based Rationalizations

| Tempting Shortcut | Why It Feels Right | Why It's Wrong |
|-------------------|-------------------|----------------|
| "Demo in 30 minutes" | Time pressure is real | 5 minutes for comments saves 30 minutes of explanation later |
| "Team is blocked waiting" | Social pressure | They'll be MORE blocked debugging undocumented code |
| "Senior dev said add docs later" | Authority told me | Authority doesn't override discipline; push back |
| "I'm time-boxed on this" | Budget is limited | Documentation IS part of the task—budget for it |
| "We're losing money every minute" | Economic pressure | Undocumented code costs more to maintain |

### Scope-Escape Rationalizations

| Tempting Shortcut | Why It Feels Right | Why It's Wrong |
|-------------------|-------------------|----------------|
| "This is prototype code" | It's throwaway | Prototype code often ships; document or mark EXPERIMENTAL |
| "I'm just following existing patterns" | Consistency matters | New context needs new documentation; patterns don't self-explain |
| "The tests are the documentation" | Tests show behavior | Tests can't capture abstractions or design intent |
| "I'm refactoring, not writing new" | Same code, new place | Changed structure = changed understanding; document |
| "This is generated/boilerplate" | I didn't write it | Interface still needs documentation for callers |

### Technical Rationalizations

| Tempting Shortcut | Why It Feels Right | Why It's Wrong |
|-------------------|-------------------|----------------|
| "The type system documents it" | Types are precise | Types show WHAT, not WHY; comments explain intent |
| "My PR description covers it" | I'll explain there | PR descriptions aren't in the code; readers won't see them |
| "I mentally composed the comment" | I thought about it | Mental comments don't help future readers |
| "Design doc covers this" | Documentation exists | Design docs drift from code; interface comments stay with code |

---

## Quick Reference

```
BEFORE writing any new code:

1. COMMENT FIRST - Write interface comment before implementation
2. NAME PRECISELY - Can someone guess what it is in isolation?
3. NAME CONSISTENTLY - Same name everywhere, only for this purpose

WHEN commenting existing code:

1. DON'T REPEAT - Use different words than the code
2. PRECISION for variables - Units, bounds, null, ownership, invariants
3. INTUITION for methods - Intent, reasoning, what not how
4. HARD TO DESCRIBE? - Fix the design, not the comment

DESIGN SMELL SIGNALS:
- Hard to write simple comment → design problem
- Hard to pick clear name → design problem
- Interface must describe implementation → shallow abstraction
```

---

## Types vs Comments

Strong type systems (TypeScript, Rust, etc.) are valuable but don't replace comments:

| Types Tell You | Comments Tell You |
|----------------|-------------------|
| WHAT the signature accepts | WHY this design was chosen |
| WHAT the return type is | WHAT invariants must hold |
| WHAT constraints the compiler enforces | WHAT the abstraction represents |
| Structure | Intent |

**Example:**
```typescript
// Types alone:
function process(order: ValidatedOrder): ShippingLabel

// With comments:
/**
 * Converts a validated order into a shipping label.
 *
 * The order must have passed fraud checks before calling.
 * Returns a label with tracking number pre-generated.
 * Throws if warehouse is out of stock (caller should retry).
 */
function process(order: ValidatedOrder): ShippingLabel
```

The types tell you the shape. The comment tells you the contract.

---

*References: [aposd-foundations](../references/aposd-foundations.md) for complexity symptoms*
