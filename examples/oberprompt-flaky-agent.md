# Example: oberprompt Fixing Flaky Agent

Using oberprompt to diagnose and fix a prompt that produces inconsistent results.

## Question

> "My code review agent sometimes misses obvious issues and other times flags non-issues"

## Result

```
DIAGNOSIS (oberprompt principles):

1. Constraint Budget Analysis:
   Original prompt: 847 tokens of instructions
   Model: haiku
   Issue: Exceeded haiku's ~200 constraint budget

2. Anti-pattern Detection:
   ❌ "Be thorough and check everything" (vague)
   ❌ "Use your best judgment" (unbounded)
   ❌ Long list of 15 review criteria (overload)

3. Missing Structure:
   ❌ No output format specified
   ❌ No severity levels defined
   ❌ No examples of good vs bad

REVISION:

Before (flaky):
  "Review this code thoroughly. Check for bugs, style issues,
   security problems, performance issues, and anything else
   that might be wrong. Use your best judgment."

After (stable):
  "Review for: (1) bugs that cause wrong behavior, (2) security
   issues. Return: VERDICT: PASS|FAIL, ISSUES: [list] or 'none'"

Result: Consistent outputs, clear pass/fail criteria.
```

## Key Fixes

| Problem | Fix |
|---------|-----|
| Too many constraints | Reduced to 2 clear criteria |
| Vague instructions | Specific, testable conditions |
| No output format | Explicit VERDICT + ISSUES format |
| Wrong model tier | Upgraded to sonnet for reasoning task |
