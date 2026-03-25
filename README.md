# oberskills

Discipline plugins for Claude Code — prompt engineering, agent dispatch, writing, and search.

## How It Works

### SEARCH
```
User: "Research X with web-research"
  → Identify search dimensions (docs, tutorials, discussions)
  → Dispatch parallel sonnet search agents
  → Synthesize results with user's model + source URLs
```

### CREATE / REVIEW
```
User: "Create a skill for code review"
  → INTAKE: Problem, triggers, 5+ use rule
  → DESIGN: Single vs router, freedom level
  → BUILD: SKILL.md with workflow, examples, and common mistakes
  → TEST: Baseline (RED) → Compliance (GREEN) → Loopholes (REFACTOR)
  → SHIP: Pre-flight checklist, package

User: "Review this agent prompt"
  → Load review-prompt.md checklist
  → Structure, efficiency, security audit
  → Verdict table with fixes
```

### WRITE
```
User: "This sounds too robotic, fix it"
  → PURGE: Strip aidiolect, em-dashes, hollow openers, hedges
  → STRUCTURE: Fix burstiness, vary rhythm
  → STRUNK: Active voice, concrete language, omit needless words
  → VOICE: Add specificity, positions, gaps, contractions
```

### SCREENSHOT
```
User: "Take a screenshot and analyze it"
  → Capture screen (full, active window, or named window)
  → Dispatch haiku analyzer
  → Return summary with insights
```

---

## Commands

| Command | Purpose | Example |
|---------|---------|---------|
| **prompt** | Prompt engineering principles | "use prompt to fix this flaky agent" |
| **agent** | Agent dispatch validation | "use agent before dispatching" |
| **web-research** | Multi-dimensional web search | "use web-research to research X" |
| **skill-craft** | Skill creation AND review | "create a skill for X" / "review this prompt" |
| **write** | Human-sounding writing (Strunk + AI pattern detection) | "this sounds robotic, fix it" / "write this README" |
| **shot** | Screenshot capture and analysis (full, active, or named window) | "take a screenshot and analyze it" / "screenshot of Firefox" |

---

## Command Chain

```
web-research (standalone)
       │
       └── Dispatch parallel sonnet search agents
              │ (extract and distill precise info, no summaries)
              └── Synthesize with user's model + source URLs

skill-craft (standalone)
       │
       ├── CREATE: INTAKE → DESIGN → BUILD → TEST → SHIP
       │              │
       │              └── Pressure testing with fresh subagents
       │
       └── REVIEW: Load checklist → Audit → Verdict table

agent (invoked before any agent dispatch)
       │
       └── prompt
              │
              └── Prompt engineering
                  (constraints, validation)

write (standalone)
       │
       └── PURGE → STRUCTURE → STRUNK → VOICE
              │
              └── Hard rules (em-dash ban, aidiolect kill list)
                  + Craft (specificity, rhythm, voice, gaps)

shot (standalone)
       │
       └── Capture (full / active / --mode window --name "App")
              │
              └── Dispatch haiku analyzer → Return summary
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

## Version

Current version: **1.26.0**

Each command displays its version at runtime by reading from `.claude-plugin/plugin.json`.

## License

MIT
