# Example: oberhack Logout Button

Quick hack mode in action - no planning files, no checklists, just dispatch and done.

## Question

> "hack in a logout button"

## Result

```
GROK (internal, 10 seconds):
- Feature: Logout button in header
- Files: src/components/Header.tsx
- Approach: Add button, wire to auth.logout()
- Gotchas: none

DISPATCH:
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Hack: logout button",
  prompt="Add logout button to src/components/Header.tsx.
  Wire to auth logout. Match existing styles.
  Return FILES, SUMMARY."
)

Result:
  FILES: src/components/Header.tsx
  SUMMARY: Added logout button with onClick calling auth.logout()

SANITY: Build passes. Done.
```

**Total time:** ~30 seconds

## Why oberhack?

- Single file change
- Clear scope
- No architectural decisions
- User wanted speed

If any of these weren't true → escalate to oberplan.
