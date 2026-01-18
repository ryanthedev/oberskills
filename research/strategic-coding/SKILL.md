---
name: strategic-coding
description: Use when writing code, implementing features, executing plans, building, creating, modifying, fixing bugs, or refactoring.
---

# Strategic Coding

**Working code is not a high enough standard.** Every change improves or degrades design.

## Task → Lens (Apply Silently)

| Task | Lens | Ask |
|------|------|-----|
| New module/API | designing-deep-modules | Simplest interface? |
| Executing plan | designing-deep-modules | Strategic or checkbox? |
| Modifying | maintaining-design-quality | Design still optimal? |
| Bug fix | maintaining-design-quality | Fix AND improve |
| "Slow" | optimizing-critical-paths | Measured first? |
| "Complex" | simplifying-complexity | Eliminate/consolidate/hide? |
| "Confusing" | improving-code-clarity | First-time reader? |
| Review | reviewing-module-design | Complexity symptoms? |

## Gates

| Before | Verify |
|--------|--------|
| Creating | 2-3 approaches sketched? Interface hides details? |
| Modifying | Understand WHY? Design optimal? Improves it? |
| "Done" | Reader understands? No "later" items? |

**STOP before "Done":** INVOKE verifying-correctness skill. Do not claim done until correctness verified.

## Stop If Thinking

| Thought | Reality |
|---------|---------|
| "Just make it work" | Clean solution exists |
| "Refactor later" | Later = never |
| "Obviously right" | Sketch alternatives |
| "User wants fast" | Pressure = design matters MORE |
| "Too small" | Small → core dependency |
| "Slow, optimize X" | Measure first |
| "Minimal fix" | Minimal ≠ optimal |
| "Per [authority]" | Authority ≠ optimal design |
| "Execute step 1..." | Plan ≠ design |
| "I see the issues" | Seeing ≠ measuring |

Reference specific skill when asked. Don't lecture.
