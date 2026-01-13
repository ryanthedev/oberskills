# oberskills

Advanced Claude Code skills for debugging, prompt engineering, agent dispatch, planning, and execution.

## Quick Example

**Question:**
> "The border color isn't changing when I switch focus between windows"

**Result with oberdebug:**
```
Step 1: Issue Identified
  Symptom: Border stays blue (inactive) instead of green (active)
  Expected: Demote (green→blue) + Promote (blue→green)

Step 2: Reproduction confirmed ✓

Step 3: Dispatching Discovery Agent
  Explore(Analyze border logs) Haiku 4.5
  → Searching ~/.local/state/thegrid/ for bdr.demote, bdr.promote events...
  → Found: promote event missing when focus changes within same cell

Root cause: Cell-internal focus changes bypass the border update path.
```

Each skill follows this pattern: **understand the problem → dispatch targeted agents → synthesize results**.

---

## Skills

| Skill | Purpose | Triggers |
|-------|---------|----------|
| **oberdebug** | Hypothesis-driven debugging with evidence-based root cause analysis | bugs, errors, "not working", test failures |
| **oberprompt** | Research-backed prompt engineering for LLM systems | writing prompts, system messages, "prompt not working" |
| **oberagent** | Enforces oberprompt principles before agent dispatch | Task tool, agent dispatch, subagent |
| **oberplan** | Meta-planning with lens skills and checkpoints | "build", "create", "implement", "plan for" |
| **oberexec** | Checklist-driven plan executor with code reviews | "execute the plan", "run the plan" |
| **oberweb** | Multi-dimensional web search with parallel subagents | "research this", "comprehensive search", web research |
| **oberhack** | Quick hack mode - mini planning, direct dispatch, no files | "quick hack", "just build it", "prototype" |

## Skill Chain

The skills chain together to enforce quality at every step:

```
oberplan ──→ oberexec ──→ oberagent ──→ oberprompt
   │            │             │             │
   │            │             │             └── Prompt engineering principles
   │            │             │                 (constraint budget, validation)
   │            │             │
   │            │             └── Agent dispatch validation
   │            │                 (Step 1: invoke oberprompt)
   │            │
   │            └── Phase execution with checkpoints
   │                (identify skills → invoke oberagent)
   │
   └── Planning orchestration
       (lens selection, requirements, plan structure)

oberhack ──→ (skip all ceremony, just dispatch)
```

## Installation

```bash
# Add the RTD marketplace
/plugin marketplace add ryanthedev/rtd-claude-inn

# Install the plugin
/plugin install oberskills@rtd

# Update to latest
/plugin update oberskills@rtd
```

## Examples

Each skill has a real-world example showing question → result:

| Skill | Example | Shows |
|-------|---------|-------|
| **oberdebug** | [border-focus-haiku](examples/oberdebug-border-focus-haiku.md) | Haiku subagent for log discovery |
| **oberprompt** | [flaky-agent](examples/oberprompt-flaky-agent.md) | Diagnosing inconsistent prompts |
| **oberagent** | [code-review](examples/oberagent-code-review.md) | Checklist validation, skill inheritance |
| **oberplan** | [multi-line-picker](examples/oberplan-multi-line-picker.md) | Full planning with checkpoints |
| **oberexec** | [auth-feature](examples/oberexec-auth-feature.md) | Checklist-driven execution |
| **oberweb** | [ghostty-floating](examples/oberweb-ghostty-floating-terminal.md) | Parallel search dimensions |
| **oberhack** | [logout-button](examples/oberhack-logout-button.md) | Quick hack, no ceremony |

## How It Works

### oberdebug
```
User: "X isn't working"
  → Infer symptoms
  → Dispatch Explore agents (haiku) for logs/code
  → Synthesize evidence
  → Propose root cause
```

### oberplan + oberexec
```
User: "Build feature X"
  → oberplan: Requirements → phases → checkpoints
  → oberexec: Execute each phase with code review gates
  → Final integration review
```

### oberhack
```
User: "Quick hack: add logout button"
  → GROK: Header.tsx, wire to auth.logout()
  → DISPATCH: Task(haiku, "Add button...")
  → DONE: Build passes, ship it
```

### oberweb
```
User: "Research ghostty floating terminal"
  → Identify dimensions: docs, config, WM integration, scripts
  → Dispatch 5 parallel haiku agents
  → Synthesize: Here's what works...
```

## Version

Current version: **1.14.0**

## License

MIT
