# Example: oberdebug Border Focus with Haiku Subagent

This example demonstrates oberdebug dispatching an Explore agent with Haiku 4.5 for efficient log analysis during hypothesis-driven debugging.

## Task Summary

**Issue:** Border color not changing on focus switch in a non-tabbed cell. Should change from blue (inactive) to green (active) but stays blue.

**Skills Used:**
- `oberdebug` - Hypothesis-driven debugging workflow
- Explore subagent with `haiku` model - Fast log discovery

**Key Insight:** Using Haiku for discovery/exploration tasks saves context and cost while maintaining quality for well-scoped searches.

---

## Workflow

### Step 1: Issue Identified

```
Symptom: In a non-tabbed cell, when switching focus between windows,
the border stays blue (inactive) instead of changing to green (active)
for the newly focused window.

Expected: Demote (green→blue) + Promote (blue→green)
Actual: Border stays blue
```

### Step 2: Reproduction Confirmed

User confirmed the issue is reproducible - enables instrumentation approach.

### Step 3: Dispatching Discovery Agent

```
Explore(Analyze border logs) Haiku 4.5
⎿  Prompt:
     Issue: Border color not changing when switching focus within a
     non-tabbed cell. Should change from blue (inactive) to green
     (active) but stays blue.

     Find and analyze relevant logs:
     1. Check ~/.local/state/thegrid/thegrid-server.json for border-related events
     2. Look for events: bdr.demote, bdr.promote, bdr.focus_change, bdr.config_change
     3. Look for any errors related to border style updates

     Return: Summary of relevant log entries showing what happens
     during a focus change within a cell

   ❯ Waiting…-lah ~/.local/state/thegrid/ 2>/dev/null | head -20)
   total 1056
   Waiting…p -E '"ev":"(bdr\.|err\.)"' ~/.local/state/thegrid/thegrid-server.
```

---

## Model Selection Rationale

| Task | Model | Why |
|------|-------|-----|
| Log discovery/exploration | Haiku 4.5 | Well-scoped search, no complex reasoning needed |
| Hypothesis formation | Sonnet/Opus | Requires deeper analysis of evidence |
| Fix implementation | Sonnet | Code changes need higher quality |

**Pattern:** Use Haiku for Explore agents doing file/log discovery. Save Sonnet/Opus for reasoning and implementation.
