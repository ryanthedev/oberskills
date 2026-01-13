---
name: oberhack
description: Quick hack mode for small features. Mini planning in-memory, then direct subagent execution. No plan files, no checklists, no checkpoints - just understand, dispatch, done. Use when user says "quick hack", "just build it", "hack this together", "prototype", "quick feature", or when scope is clearly small (1-2 files, single concern) and user wants speed over ceremony. NOT for multi-phase work, architectural decisions, or anything needing user confirmation.
---

# Skill: oberhack

```
GROK → DISPATCH → DONE
```

No files. No checklists. Mini-plan in your head, fire subagents, ship it.

---

## Workflow

### 1. GROK (30 sec max)

Mental checklist - don't write this down:
- Feature in one sentence?
- Which files?
- Minimum viable approach?
- Gotchas?

**If you can't grok it in 30 seconds, escalate to oberplan.**

### 2. DISPATCH

| Task | Subagent | Model |
|------|----------|-------|
| Code changes | general-purpose | sonnet |
| Quick exploration | Explore | haiku |
| Parallel tasks | multiple general-purpose | haiku |

**Prompt template:**
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Hack: [3-5 words]",
  prompt="[What to build - 1-2 sentences]
  [Context if needed]
  [Files if known]
  Return: FILES touched, SUMMARY 1 sentence"
)
```

**Parallel dispatch** - fire multiple in one message:
```
Task(description="Hack: part A", ...)
Task(description="Hack: part B", ...)
```

### 3. SANITY

Quick gut check. Build passes? Tests pass? Ship it.

| Problem | Action |
|---------|--------|
| Subagent confused | Re-dispatch clearer |
| Bigger than expected | Escalate to oberplan |
| Failed twice | Escalate to oberplan |

---

## Examples

### Add a button
```
User: "hack in a logout button"

GROK: Logout button in Header.tsx, wire to auth.logout()

DISPATCH:
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Hack: logout button",
  prompt="Add logout button to src/components/Header.tsx.
  Wire to auth logout. Match existing styles.
  Return FILES, SUMMARY."
)

SANITY: Build passes. Done.
```

### Parallel changes
```
User: "add created_at to users and orders"

GROK: Timestamp on both tables, parallel, no ordering

DISPATCH (parallel):
Task(model="haiku", description="Hack: users timestamp",
  prompt="Add created_at to users table. Migration + model.")
Task(model="haiku", description="Hack: orders timestamp",
  prompt="Add created_at to orders table. Migration + model.")

SANITY: Run migrations. Done.
```

---

## Escalate to oberplan when:

- Can't grok in 30 seconds
- Need to ask 3+ questions
- Affects multiple systems
- Not sure about approach
- Subagent failed twice
- User needs to confirm decisions

**oberhack is for when you know what to do.** If you don't, plan first.

---

## Integration

- **oberagent**: Skip for trivial hacks, use for anything non-obvious
- **oberplan**: Escalate when scope exceeds "quick"
- **oberdebug**: Switch if hack reveals bugs
