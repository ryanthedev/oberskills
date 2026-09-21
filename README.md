# oberskills

Skills that make Claude Code and Codex better at the things they are worst at: writing like a person, searching the web without hallucinating URLs, building skills that actually work, and not embarrassing themselves when dispatching agents.

As of v2.0.0 the three meta-skills — `prompt`, `agent`, `skill-craft` — are full skills (`skills/<name>/SKILL.md`) rebuilt on a 2026 research pass (Anthropic platform docs, ~100 arXiv papers, practitioner practice), and the skill-eval pipeline is a Bun/TypeScript MCP server instead of Python scripts.

This repo keeps one shared source tree for both hosts. Claude Code uses `.claude-plugin/plugin.json`; Codex uses `.codex-plugin/plugin.json` and `.mcp.json`.

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

On Claude Code, dependencies install automatically via a SessionStart hook into `${CLAUDE_PLUGIN_DATA}` (requires `bun` on PATH). After install or update, run `/reload-plugins` once. Optional: allow `mcp__plugin_oberskills_skill-eval__*` in settings to skip permission prompts.

On Codex/local installs, the MCP wrapper scripts install package dependencies into the plugin directory on first start. To prewarm that step manually, run:

```bash
cd mcp && bun install
cd ../mcp-browser && bun install
```

For local development, this repo directory is the plugin directory. `skill-eval` still uses the Anthropic Agent SDK until a Codex-native eval runner exists.

### write

Two modes. EDIT rewrites silently. REVIEW walks you through issues one batch at a time, asks questions, then offers an edit pass. Six axes route any piece: the reader's job, edit depth (proofread → copy edit → line edit → developmental, so "just tidy this" doesn't come back as a rewrite), shape (BLUF, inverted pyramid, PAS, AIDA, changelog, press release), style cards distilled from published house guides (Economist, AP, GOV.UK, plain language) with style-by-extraction for anything else, copy organized by reader awareness with a never-invent-proof claims rider, and private voice profiles. A zero-dependency prose lint (`bun` or `node`) measures what a model can't see by rereading — sentence-length variance, monotone runs, kill-list hits, hedge stacking — and REVIEW carries an argument-integrity lens that asks whether the piece works, not just whether it reads human. Built on a 147-paper synthesis of AI-detection, co-writing, and style-transfer research, Pangram Labs data (N=millions), and a blind test that dropped AI detection probability from 85% to 15%.

### web-research

Parallel search agents fan out across multiple dimensions (docs, tutorials, discussions, forums). Each agent extracts precise information with source URLs. Results synthesize back through your model. No hallucinated links.

### browser

Drives a live Chrome through a persistent puppeteer-core connection (the bundled `mcp-browser` server, 40 tools): snapshot the accessibility tree and act on stable element refs; click, type, drag, fill forms; extract and collect structured data; screenshots and PDFs; Lighthouse audits and Core Web Vitals traces; intercept, stub, or block network requests and export HAR; emulate devices; save and restore sessions. Large payloads spill to disk and get read by a subagent, so a DOM dump never lands in your main context.

### clarify

Decomposes user intent through structured brainstorming before acting on ambiguous requests. Run it yourself with `/oberskills:clarify`, let Claude reach for it when a request is genuinely ambiguous, or let other skills chain into it. The fault taxonomy and question-selection method are cited to the clarification-question literature.

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

write ──┬─ EDIT: axes (job · depth · shape · style · copy · voice) → core rules + surface rules (+ deep craft if needed)
        └─ REVIEW: scan → orient → top issues → next batch → offer edit

web-research ─── parallel search agents ─── synthesize with source URLs

browser ──── snapshot → act on refs → read/extract (large payloads → file → subagent)
              └── mcp-browser MCP tools
```

## Install

### Claude Code

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
/plugin update oberskills@rtd
```

Then `/reload-plugins` (or restart) so the `skill-eval` MCP server connects.

### Codex Local Development

The MCP wrappers install dependencies on first start. To prewarm both MCP packages manually:

```bash
cd mcp && bun install
cd ../mcp-browser && bun install
```

Codex installs plugins from a configured marketplace. For local development, create or use a marketplace root with an entry whose `source.path` points at `./plugins/oberskills`, place this repo at that path, then run:

```bash
codex plugin marketplace add <path-to-marketplace-root>
codex plugin add oberskills@<marketplace-name>
```

MCP dependencies are installed in the plugin directory Codex launches. Browser MCP also requires Chrome or Chromium availability.

## Version

**3.0.0** — `plugin.json` is the source of truth.

---

MIT
