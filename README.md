# oberskills

Six commands that make Claude Code better at the things it's worst at: writing like a person, searching the web without hallucinating URLs, building skills that actually work, and not embarrassing itself when dispatching agents.

## Commands

### write

Two modes. EDIT rewrites silently. REVIEW walks you through issues one batch at a time, asks questions, then offers an edit pass.

The skill loads in three layers depending on what the piece needs:

```
Layer 1 — Core (always loaded, ~160 lines)
  Five structural rules that won a blind test against a 3-judge panel:
  lurch (sentence length variance), spike (density variation),
  wander (non-linear structure), shift register, get specific.

Layer 2 — Surface (auto-loaded for EDIT, ~170 lines)
  Kill list, em-dash ban, hollow openers, hedge limit,
  transition crutches, contractions, sycophancy, verb poverty.

Layer 3 — Deep Craft (on demand, ~200 lines)
  Syntactic variety, rhetoric calibration, discourse templating,
  register range, name patterns, cliche metaphors, parallelism.
```

Typical edit: ~330 lines of instruction. Deep edit: ~530. Built on 47 AI-writing detection papers, Pangram Labs data (N=millions), and a blind test that dropped AI detection probability from 85% to 15%.

### web-research

Parallel search agents fan out across multiple dimensions (docs, tutorials, discussions, forums). Each agent extracts precise information with source URLs. Results synthesize back through your model. No hallucinated links.

### skill-craft

Creates and reviews Claude Code skills. CREATE mode runs intake, design, build, test (baseline/compliance/loopholes), and ship. REVIEW mode loads a checklist and audits structure, efficiency, and security. Both produce concrete artifacts, not advice.

### prompt

Prompt engineering principles. Invoked standalone or chained through the agent command. Covers constraints, validation, and the structural patterns that make prompts stick.

### agent

Validation gate before dispatching subagents. Chains into prompt engineering. Catches the things that go wrong when you hand work to a subprocess without thinking about it first.

### shot

Screenshot capture and analysis. Full screen, active window, or named window. Dispatches a haiku-tier analyzer and returns a summary.

## How They Connect

```
web-research ─── parallel search agents ─── synthesize with source URLs

skill-craft ──┬─ CREATE: intake → design → build → test → ship
              └─ REVIEW: checklist → audit → verdict

agent ──── prompt (constraints, validation)

write ──┬─ EDIT: core rules + surface rules (+ deep craft if needed)
        └─ REVIEW: scan → orient → top issues → next batch → offer edit

shot ──── capture → haiku analyzer → summary
```

## Install

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
/plugin update oberskills@rtd
```

## Version

**1.27.0**

---

MIT
