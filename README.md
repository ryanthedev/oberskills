# oberskills

Skills that make Claude Code better at the things it's worst at: writing like a person, searching the web without hallucinating URLs, building skills that actually work, and not embarrassing itself when dispatching agents.

As of v2.0.0 the three meta-skills — `prompt`, `agent`, `skill-craft` — are full skills (`skills/<name>/SKILL.md`) rebuilt on a 2026 research pass (Anthropic platform docs, ~100 arXiv papers, practitioner practice), and the skill-eval pipeline is a Bun/TypeScript MCP server instead of Python scripts.

## Skills

### prompt

Claude-first prompt engineering. DESIGN mode drafts or fixes a prompt; REVIEW mode audits one adversarially and returns a verdict table. Nine evidence-cited principles inline; eight reference files on demand (Claude model deltas, verbatim Anthropic snippet library, context engineering, optimization, security, porting to non-Claude models). Covers the current-era shifts: de-prompting, prefill removal, adaptive thinking and effort instead of CoT incantations, purpose-conditioned few-shot counts, reasoning-before-answer schema ordering.

### agent

Subagent dispatch guidance, built for the moment you write an `Agent` call: dispatch-vs-inline cost gate, the four-part delegation contract, model and effort selection for the current lineup, fan-out sizing, fork vs fresh subagent, and debiased verifier dispatch (no intent framing, separate verifier, weaker model allowed). References carry platform mechanics, orchestration patterns, and the canonical verification-bias evidence.

### skill-craft

Create, evaluate, and review Claude Code skills. CREATE runs intake → design → baseline → build → eval → ship with gates; REVIEW audits a skill directory. Judgment stays with Claude; everything checkable runs through the `skill-eval` MCP tools.

### skill-eval (MCP server)

Bun/TS server bundled with the plugin (`mcp/`), spawning real headless Claude sessions via the Agent SDK. Seven tools:

| Tool | Does |
|---|---|
| `validate_skill` | Frontmatter/structure/content lints (agentskills.io spec + house rules), optional `.skill` packaging |
| `test_triggers` | Live trigger-rate measurement: does the description actually route? |
| `optimize_description` | Iterative description optimization with a held-out test split (chunked: one iteration per call) |
| `run_eval` | Run one eval with/without the skill, optional pressure blocks (composed in code, 3+ enforced), auto-grade |
| `grade_run` | Externally-dispatched grader; severities and verdicts computed in TypeScript, not by the LLM |
| `aggregate_benchmark` | Mean/stddev/min/max + deltas across configurations, gate evaluation |
| `compare_outputs` | Blind A/B comparison of two outputs |

Dependencies install automatically via a SessionStart hook into `${CLAUDE_PLUGIN_DATA}` (requires `bun` on PATH). After install or update, run `/reload-plugins` once. Optional: allow `mcp__plugin_oberskills_skill-eval__*` in settings to skip permission prompts.

### write

Two modes. EDIT rewrites silently. REVIEW walks you through issues one batch at a time, asks questions, then offers an edit pass. Built on 47 AI-writing detection papers, Pangram Labs data (N=millions), and a blind test that dropped AI detection probability from 85% to 15%.

### web-research

Parallel search agents fan out across multiple dimensions (docs, tutorials, discussions, forums). Each agent extracts precise information with source URLs. Results synthesize back through your model. No hallucinated links.

### shot

Screenshot capture and analysis. Full screen, active window, or named window. Dispatches a haiku-tier analyzer and returns a summary.

### clarify

Decomposes user intent through structured brainstorming before acting on ambiguous requests. Model-invoked; other skills chain into it.

## How They Connect

```
skill-craft ──┬─ CREATE: intake → design → baseline → build → eval → ship
              │           └── skill-eval MCP tools (validate, triggers, evals, grading)
              └─ REVIEW: validator floor → quality dimensions → behavioral test

prompt ──┬─ DESIGN: principles + on-demand references
         └─ REVIEW: adversarial audit → verdict table
              (owns ALL prompt review, including agent prompt files)

agent ──── dispatch gate → delegation contract → model/effort → verifier dispatch
              (chains to prompt for long/novel briefs, clarify for ambiguous intent)

write ──┬─ EDIT: core rules + surface rules (+ deep craft if needed)
        └─ REVIEW: scan → orient → top issues → next batch → offer edit

web-research ─── parallel search agents ─── synthesize with source URLs
shot ──── capture → haiku analyzer → summary
```

## Install

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
/plugin update oberskills@rtd
```

Then `/reload-plugins` (or restart) so the `skill-eval` MCP server connects.

## Version

**2.0.0**

---

MIT
