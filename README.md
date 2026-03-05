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

## Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| **oberprompt** | Prompt engineering principles | "use oberprompt to fix this flaky agent" |
| **oberagent** | Agent dispatch validation | "use oberagent before dispatching" |
| **oberweb** | Multi-dimensional web search | "use oberweb to research X" |
| **obercreate** | Skill creation AND review | "create a skill for X" / "review this prompt" |
| **oberscribe** | Human-sounding writing (Strunk + AI pattern detection) | "this sounds robotic, fix it" / "oberscribe this README" |
| **obershot** | Screenshot capture and analysis (full, active, or named window) | "take a screenshot and analyze it" / "screenshot of Firefox" |

---

## Skill Chain

```
oberweb (standalone)
       │
       └── Dispatch parallel sonnet search agents
              │ (extract and distill precise info, no summaries)
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

oberscribe (standalone)
       │
       └── PURGE → STRUCTURE → STRUNK → VOICE
              │
              └── Hard rules (em-dash ban, aidiolect kill list)
                  + Craft (specificity, rhythm, voice, gaps)

obershot (standalone)
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

Current version: **1.22.0**

Each skill displays its version at runtime by reading from `.claude-plugin/plugin.json` (e.g., `obershot v1.20.0`).

## License

MIT
