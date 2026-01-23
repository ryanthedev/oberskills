# oberskills

Advanced agent orchestration skills for Claude Code.

## How It Works

### DEBUG
```
User: "X isn't working, use oberdebug"
  → Infer symptoms from description
  → Dispatch Explore agents (haiku) for logs/code
  → Synthesize evidence
  → Propose root cause with evidence
```

### PLAN + EXECUTE
```
User: "Build feature X with oberplan"
  → oberplan: Requirements → phases → checkpoints
  → oberexec: Execute each phase with code review gates
  → Final integration review
```

### SEARCH
```
User: "Research X with oberweb"
  → Identify search dimensions (docs, tutorials, discussions)
  → Dispatch parallel haiku agents
  → Synthesize: Here's what works...
```

### HACK
```
User: "Quick hack: add logout button"
  → GROK: Header.tsx, wire to auth.logout()
  → DISPATCH: Task(haiku, "Add button...")
  → DONE: Build passes, ship it
```

### CREATE
```
User: "Create a skill for code review"
  → INTAKE: Problem, triggers, 5+ use rule
  → DESIGN: Single vs router, freedom level
  → BUILD: SKILL.md with anti-rationalization table
  → TEST: Baseline (RED) → Compliance (GREEN) → Loopholes (REFACTOR)
  → SHIP: Pre-flight checklist, package
```

---

## Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| **oberdebug** | Hypothesis-driven debugging | "use oberdebug, X isn't working" |
| **oberprompt** | Prompt engineering principles | "use oberprompt to fix this flaky agent" |
| **oberagent** | Agent dispatch validation | "use oberagent before dispatching" |
| **oberplan** | Meta-planning with checkpoints | "use oberplan to build feature X" |
| **oberexec** | Checklist-driven execution | "use oberexec to run the plan" |
| **oberweb** | Multi-dimensional web search | "use oberweb to research X" |
| **oberhack** | Quick hack mode, no ceremony | "oberhack: add a logout button" |
| **obercreate** | Skill creation with testing | "create a skill for X" |

---

## Example

**Question:**
> "The border color isn't changing when I switch focus between windows"

**Result:**
```
Step 1: Issue Classification
  → DEBUG (signals: "isn't working", visual bug)

Step 2: Symptom Analysis
  Expected: Demote (green→blue) + Promote (blue→green)
  Actual: Border stays blue

Step 3: Dispatch Discovery Agent
  Explore(Analyze border logs) Haiku 4.5
  → Search ~/.local/state/thegrid/ for bdr.demote, bdr.promote
  → Found: promote event missing for cell-internal focus changes

Step 4: Root Cause
  Cell-internal focus changes bypass the border update path.
  Evidence: Log shows demote fired, promote never fired.
```

---

## Skill Chain

The skills chain together based on task type:

```
oberplan (planning)
       │
       └── oberexec (execution)
              │
              ├── Phase N ──→ oberagent ──→ oberprompt
              │                    │             │
              │                    │             └── Prompt engineering
              │                    │                 (constraints, validation)
              │                    │
              │                    └── Agent dispatch validation
              │                        (outcome focus, skill loading)
              │
              └── Checkpoint ──→ Code review gate
                                 Git commit on pass

oberdebug (standalone)
       │
       └── Dispatch Explore agents (haiku)
              │
              └── Synthesize evidence → root cause

oberweb (standalone)
       │
       └── Dispatch parallel search agents (haiku)
              │
              └── Synthesize results + source URLs

oberhack (standalone)
       │
       └── GROK → DISPATCH → DONE (no ceremony)

obercreate (standalone)
       │
       └── INTAKE → DESIGN → BUILD → TEST → SHIP
              │
              └── Pressure testing with fresh subagents
                  Anti-rationalization enforcement
```

---

## Installation

```bash
# Add marketplace (if not already added)
/plugin marketplace add ryanthedev/rtd-claude-inn

# Install plugin
/plugin install oberskills@rtd

# Update to latest
/plugin update oberskills@rtd
```

## Documentation

For guides and detailed documentation, see `examples/` or the **[Wiki](https://github.com/ryanthedev/oberskills/wiki)**.

## Case Studies

Ranked by how well they demonstrate the skills:

| # | Example | Type | Shows |
|---|---------|------|-------|
| 1 | [oberplan-multi-line-picker](examples/oberplan-multi-line-picker.md) ⭐ | PLAN | Full skill chain with review checkpoints |
| 2 | [oberdebug-border-focus-haiku](examples/oberdebug-border-focus-haiku.md) | DEBUG | Haiku subagent for efficient log discovery |
| 3 | [oberweb-ghostty-floating-terminal](examples/oberweb-ghostty-floating-terminal.md) | SEARCH | 5 parallel dimensions, result synthesis |
| 4 | [oberprompt-flaky-agent](examples/oberprompt-flaky-agent.md) | PROMPT | Constraint budget diagnosis |
| 5 | [oberexec-auth-feature](examples/oberexec-auth-feature.md) | EXECUTE | Checklist-driven phase execution |
| 6 | [oberagent-code-review](examples/oberagent-code-review.md) | AGENT | Checklist validation, skill inheritance |
| 7 | [oberagent-model-selection](examples/oberagent-model-selection.md) | AGENT | Model tier selection with oberprompt |
| 8 | [oberhack-logout-button](examples/oberhack-logout-button.md) | HACK | Quick hack, 30 seconds total |

## Version

Current version: **1.16.0**

## License

MIT
