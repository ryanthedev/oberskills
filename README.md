# oberskills

Advanced agent orchestration skills for Claude Code.

## How It Works

### SEARCH
```
User: "Research X with oberweb"
  → Identify search dimensions (docs, tutorials, discussions)
  → Dispatch parallel sonnet search agents
  → Synthesize results with user's model + source URLs
```

### CREATE / REVIEW
```
User: "Create a skill for code review"
  → INTAKE: Problem, triggers, 5+ use rule
  → DESIGN: Single vs router, freedom level
  → BUILD: SKILL.md with anti-rationalization table
  → TEST: Baseline (RED) → Compliance (GREEN) → Loopholes (REFACTOR)
  → SHIP: Pre-flight checklist, package

User: "Review this agent prompt"
  → Load review-prompt.md checklist
  → Structure, efficiency, security audit
  → Verdict table with fixes
```

### SCREENSHOT
```
User: "Take a screenshot and analyze it"
  → Capture screen
  → Dispatch haiku analyzer
  → Return summary with insights
```

---

## Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| **oberprompt** | Prompt engineering principles | "use oberprompt to fix this flaky agent" |
| **oberagent** | Agent dispatch validation | "use oberagent before dispatching" |
| **oberweb** | Multi-dimensional web search | "use oberweb to research X" |
| **obercreate** | Skill creation AND review | "create a skill for X" / "review this prompt" |
| **obershot** | Screenshot capture and analysis | "take a screenshot and analyze it" |

---

## Skill Chain

```
oberweb (standalone)
       │
       └── Dispatch parallel sonnet search agents
              │
              └── Synthesize with user's model + source URLs

obercreate (standalone)
       │
       ├── CREATE: INTAKE → DESIGN → BUILD → TEST → SHIP
       │              │
       │              └── Pressure testing with fresh subagents
       │
       └── REVIEW: Load checklist → Audit → Verdict table

oberagent (invoked before any agent dispatch)
       │
       └── oberprompt
              │
              └── Prompt engineering
                  (constraints, validation)

obershot (standalone)
       │
       └── Capture → Dispatch haiku analyzer → Return summary
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

| # | Example | Type | Shows |
|---|---------|------|-------|
| 1 | [oberweb-ghostty-floating-terminal](examples/oberweb-ghostty-floating-terminal.md) | SEARCH | 5 parallel dimensions, result synthesis |
| 2 | [oberagent-code-review](examples/oberagent-code-review.md) | AGENT | Checklist validation, skill inheritance |
| 3 | [oberagent-model-selection](examples/oberagent-model-selection.md) | AGENT | Model tier selection with oberprompt |

## Version

Current version: **1.20.0**

## License

MIT
