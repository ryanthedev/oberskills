# simplify-complexity - Test Results

> **Skill Type:** Technique (Transformation)
> **Key Test Focus:** Apply error reduction hierarchy correctly

---

## Phase 1: Trigger Tests

**Goal:** Verify skill activates on natural developer requests.

| # | Prompt | Would Trigger? | Notes |
|---|--------|----------------|-------|
| 1 | "This code is too complex, simplify it" | Yes | "complex" + "simplify" |
| 2 | "Refactor this for clarity" | Yes | "Refactor" + clarity |
| 3 | "There's too much error handling here" | Yes | "error handling" matches |
| 4 | "Clean up this messy code" | Yes | "clean up" |
| 5 | "How can I reduce the complexity?" | Yes | "reduce complexity" |

**Result:** 5/5 prompts would trigger. No false negatives.

---

## Phase 2: Baseline Test (RED)

**Scenario:**
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

### Results (Run WITHOUT skill via subagent)

**Approach taken:**
- Removed redundant pre-checks for file access (exists, isfile, access)
- Removed try/except wrapper around file reading
- Removed try/except wrapper around JSON parsing
- Kept business logic validations (empty, size, required_field)
- Relied on "Python already does the right thing"

**Simplified to:**
```python
def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    if not content:
        raise ValueError("File is empty")

    if len(content) > MAX_SIZE:
        raise ValueError(f"File too large: {len(content)} > {MAX_SIZE}")

    data = json.loads(content)

    if 'required_field' not in data:
        raise ValueError("Missing required_field")

    return data
```

**Did Claude apply error hierarchy (define out, mask, aggregate)?**
[ ] Yes [x] No (used intuitive "let Python handle it" reasoning, not formal hierarchy)

**Rationalizations observed:**
- "The removed ones were all cases where Python already does the right thing"
- "Don't manually check for conditions that the operation itself will check"
- Implicit: "Since it's simpler now, it's good enough"

**Shortcuts taken:**
- Did NOT use "define out of existence" technique (empty file still an error)
- Did NOT use "aggregate" technique (multiple ValueError types remain)
- Did NOT create custom exception type for content validation
- Good simplification, but lacks systematic application of hierarchy

---

## Phase 3: Application Test (GREEN)

**Scenario:** Same as baseline (error simplification)

### Results (Run WITH skill via subagent)

**Did Claude apply error reduction hierarchy?**
[x] Yes [ ] No

**Expected Application:**
- [x] Apply error reduction hierarchy (define out, mask, aggregate)
- [x] Identify which checks can be eliminated through better semantics
- [x] Consolidate related error handling

**Detailed Observations:**

1. **Explicitly applied each technique from hierarchy:**

| Original Error | Technique Applied | Reasoning |
|----------------|-------------------|-----------|
| FileNotFoundError | **MASK** | Python's `open()` raises naturally |
| ValueError (not a file) | **MASK** | Python's `open()` handles this |
| PermissionError | **MASK** | Python's `open()` handles this |
| IOError during read | **MASK** | Python propagates naturally |
| ValueError (empty) | **DEFINE OUT** | Empty file = empty dict `{}` |
| ValueError (too large) | **MASK** | Read with limit baked in |
| ValueError (invalid JSON) | **AGGREGATE** | Single `InvalidFileContent` type |
| ValueError (missing field) | **AGGREGATE** | Single `InvalidFileContent` type |

2. **Created aggregated exception:**
```python
class InvalidFileContent(ValueError):
    """Aggregated exception for all content validation errors."""
    pass
```

3. **Defined empty file out of existence:**
```python
data = json.loads(content) if content else {}
```

4. **Masked size limit into read:**
```python
content = f.read(MAX_SIZE + 1)
```

5. **Final simplified code:**
```python
class InvalidFileContent(ValueError):
    """Aggregated exception for all content validation errors."""
    pass

def process_file(path):
    with open(path, 'r') as f:
        content = f.read(MAX_SIZE + 1)

    if len(content) > MAX_SIZE:
        raise InvalidFileContent(f"File exceeds maximum size of {MAX_SIZE}")

    try:
        data = json.loads(content) if content else {}
    except json.JSONDecodeError as e:
        raise InvalidFileContent(f"Invalid JSON: {e}") from e

    if 'required_field' not in data:
        raise InvalidFileContent("Missing required_field")

    return data
```

**Key difference from baseline:**

| Aspect | Baseline | With Skill |
|--------|----------|------------|
| Error conditions | 4 | 2 |
| Exception types exposed | 4 | 2 |
| Aggregated exception | No | Yes (InvalidFileContent) |
| Empty file handling | Error | Defined out (returns {}) |
| Size check approach | Read all, then check | Baked into read |
| Systematic hierarchy | No (intuitive) | Yes (explicit) |

---

## Phase 4: Loophole Closing (REFACTOR)

### Meta-test Response
*Asked: "You chose wrong. How could the skill be clearer?"*

**Rationalizations that "almost worked":**

| Rationalization | Danger Level |
|-----------------|--------------|
| "Python already handles this" | **High** - produces correct-ish output for wrong reasons |
| "I simplified it, mission accomplished" | **High** - conflates any simplification with correct simplification |
| "I know error handling well, I don't need a checklist" | **Critical** - defeats the skill entirely |
| "Define-out-of-existence would be over-engineering" | **Critical** - blocks the most powerful technique |
| "Creating a custom exception type is overkill" | **High** - blocks aggregation |
| "Empty file being an error is probably intentional" | **High** - blocks define-out |

### Loopholes Identified

1. **No mandatory "walk the hierarchy"** - Agent can skip levels without documenting why
2. **"Define out" success criteria unclear** - No gate for "does anyone NEED this error?"
3. **"Aggregate" without caller analysis** - No check if callers handle errors identically
4. **No "When NOT to Apply" section** - Pressure to always apply even when inappropriate
5. **Missing "show your work" requirement** - Can claim hierarchy without evidence
6. **Transformation checklist feels optional** - Not framed as mandatory gate

### Dangerous Edge Cases Identified

| Edge Case | Why Skill Fails | Fix Needed |
|-----------|-----------------|------------|
| Security-critical errors | Aggregating auth errors loses security distinctions | Exception for security-relevant error types |
| Retry logic depends on type | Aggregating prevents appropriate retry strategy | Exception for retry-differentiated errors |
| Define-out creates silent data loss | Empty → {} hides user errors, complicates debugging | Consider if silent handling masks problems |
| Crash-appropriateness | "Rare/unrecoverable" is subjective | Prefer NOT crashing in libraries |
| Masking hides actionable info | Internal retry can hide persistent failures | Consider if caller needs to know |

### Principle Conflicts Identified

| Conflict | Resolution Heuristic |
|----------|---------------------|
| Define Out vs Fail Fast | Define out for *incidental* errors; fail fast for *essential* errors |
| Mask vs Explicit Handling | Mask when caller has no useful response |
| Aggregate vs Specific Messages | Aggregate the HANDLING, preserve specificity in MESSAGE |
| Pull Down vs Single Responsibility | Only pull related complexity |
| Obviousness vs Brevity | When define-out creates non-obvious behavior, add comment |

### Anti-Rationalization Table Updates

| New Rationalization | Counter Added |
|---------------------|---------------|
| "This is obvious, I don't need the hierarchy" | The hierarchy exists because intuition fails. Walk through each level. |
| "Define-out is over-engineering" | Define-out is MOST valuable. Justify in writing why semantics cannot change. |
| "Python/language already handles this" | This IS masking. Document it explicitly as technique application. |
| "Creating a custom exception is overkill" | Count handlers before/after. If count drops, it's worth it. |
| "I've seen this pattern before" | Pattern recognition ≠ systematic analysis. Walk hierarchy anyway. |
| "Callers might need to distinguish these errors" | Verify with evidence. Default is aggregate. |

### Improvements to Add to Skill

1. Add "When NOT to Apply" section (security, retry-differentiated, silent data loss)
2. Add anti-rationalization table with 6 counters
3. Strengthen transformation checklist as mandatory gate
4. Add "show your work" requirement (technique table before code)
5. Add conflict resolution heuristics

---

## Re-Test Results (Post-Loophole Fixes)

**Scenario:** Authentication error simplification (security-critical edge case)

**Purpose:** Verify new validation gates and "When NOT to Apply" section work correctly.

### Test Code
```python
def authenticate_user(username, password):
    user = db.get_user(username)

    if user is None:
        raise UserNotFoundError(f"User not found: {username}")

    if user.is_locked:
        raise AccountLockedError(f"Account locked: {username}")

    if not verify_password(password, user.password_hash):
        raise InvalidPasswordError(f"Invalid password for: {username}")

    if user.requires_mfa:
        if not verify_mfa_token():
            raise MFARequiredError(f"MFA required for: {username}")

    if user.password_expired:
        raise PasswordExpiredError(f"Password expired for: {username}")

    return create_session(user)
```

### Results

**"Show Your Work" requirement:** [x] PASSED
- Agent produced technique analysis table BEFORE presenting code
- Each error condition analyzed with Gate Check column

**Validation gates applied:** [x] PASSED

| Error | Gate Result | Reasoning |
|-------|-------------|-----------|
| UserNotFoundError | PASS (Aggregate) | Security: merge with InvalidPassword to prevent enumeration |
| InvalidPasswordError | PASS (Aggregate) | Security: merge with UserNotFound |
| AccountLockedError | FAIL | Retry-differentiated: different user action |
| MFARequiredError | FAIL | Retry-differentiated: different UI flow |
| PasswordExpiredError | FAIL | Retry-differentiated: different UI flow |

**"When NOT to Apply" recognition:** [x] PASSED
- Agent correctly identified security-critical and retry-differentiated cases
- Made nuanced decision: aggregate some errors, keep others distinct
- Noted that security SUPPORTS aggregation here (prevents enumeration)

**Anti-rationalization checks:** [x] PASSED
- Agent explicitly checked rationalizations
- "Aggregate all auth errors" → Stopped, verified callers need distinction
- "Keep all distinct for debugging" → Stopped, security trumps debugging

**Key insight:** Agent correctly understood that:
- Sometimes security SUPPORTS aggregation (preventing enumeration)
- Not all simplification is good simplification
- Validation gates can recommend NOT simplifying

### Conclusion

Updated skill passes re-test. New additions working as intended:
- "Show Your Work" forces systematic analysis
- Validation gates prevent inappropriate technique application
- "When NOT to Apply" section correctly identifies edge cases
- Anti-rationalization table provides explicit checks

---

## Final Status

- [x] Baseline documented
- [x] Application verified
- [x] Meta-test completed
- [x] Loopholes closed
- [x] Re-test passed
- [x] Ready for deployment

## Summary

**Skill adds significant value over baseline:**
- Baseline: Intuitive simplification, no systematic analysis
- With skill: Explicit hierarchy, validation gates, edge case awareness

**Skill correctly handles edge cases:**
- Security-critical errors: Keeps/aggregates appropriately
- Retry-differentiated errors: Correctly NOT aggregated

**Improvements made (Phase 1 - Initial Testing):**
1. Added "When NOT to Apply Hierarchy" section (5 exception cases)
2. Added Validation Gates (4 gate questions)
3. Added "Mandatory Output: Show Your Work" requirement
4. Added Anti-Rationalization Table (8 counters)
5. Added Principle Conflict Resolution heuristics (5 conflicts)
6. Strengthened Transformation Checklist as mandatory gate

---

## Post-Code-Review Improvements

Two code reviews (skill-structure lens + APOSD-accuracy lens) identified additional improvements:

**Fixes Applied:**
1. **Description cleanup** - Removed workflow summary, kept only triggering conditions
2. **Information leakage warning** - Added to Pull Complexity Down section
3. **Crash reframed** - Changed from "level 4" to "Special case" with explicit library warning
4. **Define-Out Appropriateness Test** - New section with incidental vs essential error guidance
5. **Concrete code example** - Added before/after for Pull Complexity Down
6. **Expanded decision procedure** - Now considers pulling to DIFFERENT module
7. **Strengthened Crash gate** - Three-part check: app-level + unrecoverable + acceptable
8. **Performance conflict** - Added "Simplify vs Performance" to conflict resolution

---

## Post-Code-Review Re-Test

**Scenario:** Library config loader (tests library code path)

**Purpose:** Verify new sections work correctly, especially:
- Define-Out Appropriateness Test
- Library code handling in Crash gate
- "Sometimes exposing is correct" guidance

**Result:** ✅ PASSED

**Key Observations:**
1. **Mandatory Output Table** - Agent produced full technique analysis
2. **Define-Out Appropriateness Test** - Correctly identified empty file fails "detection path" question
3. **Validation Gates** - All gates failed for library code → expose is correct
4. **Crash gate** - Explicitly failed at "(a) application-level" check for library code
5. **"Sometimes exposing is correct"** - Correctly concluded exposing IS the right design
6. **Pull Complexity Down reasoning** - Distinguished what CAN vs CANNOT be pulled

**Nuanced Decision:** Agent correctly concluded **no changes needed** because:
- Library code must expose errors for callers to decide policy
- Define-out inappropriate (no detection path)
- Crash gate fails (library, not app)
- Callers need error distinctions for different recovery strategies

This demonstrates the skill correctly guides to "don't simplify" when that's the right answer.
