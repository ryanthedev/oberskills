---
name: skill-craft
description: Create, evaluate, and review Claude Code skills and reusable agent definition files (structure, frontmatter, evals). Covers the skill-vs-subagent-vs-hook decision, SKILL.md authoring and frontmatter, trigger-description optimization, baseline-first evals with pressure testing via the skill-eval MCP tools, validation, and packaging. Use when creating a new skill, improving or benchmarking an existing one, reviewing a skill directory, or writing evals for a skill. Not for prompt wording design or review — including the prompt body inside an agent definition (use oberskills:prompt), live subagent dispatch (use oberskills:agent), or prose editing (use oberskills:write).
when_to_use: Trigger on "create a skill", "write a skill for", "review this skill", "skill evals", "benchmark the skill", "trigger eval", "optimize the description", "package the skill", "should this be a skill or a hook".
argument-hint: "[create <topic> | review <path>]"
allowed-tools:
  # Enumeration may be simplified to the wildcard mcp__plugin_oberskills_skill-eval__* once verified (ruling R9).
  - mcp__plugin_oberskills_skill-eval__validate_skill
  - mcp__plugin_oberskills_skill-eval__test_triggers
  - mcp__plugin_oberskills_skill-eval__optimize_description
  - mcp__plugin_oberskills_skill-eval__run_eval
  - mcp__plugin_oberskills_skill-eval__grade_run
  - mcp__plugin_oberskills_skill-eval__aggregate_benchmark
  - mcp__plugin_oberskills_skill-eval__compare_outputs
---

# skill-craft

Create skills through baseline-first evals, or audit existing ones. Judgment work (intake, design, eval authoring, interpretation, edits) happens here; everything checkable (validation, trigger probes, run spawning, grading, verdicts, stats, packaging) runs through the `skill-eval` MCP tools — never fill in compliance verdicts by hand.

## Mode router

| Intent | Mode | Load |
|---|---|---|
| Build something new ("create/write a skill for X") | CREATE | Pipeline below; references per phase |
| Audit an existing skill (path to a SKILL.md or skill directory) | REVIEW | `${CLAUDE_SKILL_DIR}/references/review-skill.md` |
| Audit the prompt body wording inside an agent definition, or a dispatch brief | Redirect | Invoke `oberskills:prompt` REVIEW (the file as an artifact — structure, frontmatter, evals — stays here) |
| Improve an existing skill | CREATE from phase 3 (BASELINE), with an `old_skill` snapshot as the baseline config | `${CLAUDE_SKILL_DIR}/references/eval.md` |
| Unclear or ambiguous request | Ask, or invoke `oberskills:clarify` for structured decomposition | — |

## Should this exist? (pre-gate)

- Can Claude already do this well? Run the task once without a skill. No documented failure means don't build — if you didn't watch an agent fail without the skill, you don't know whether the skill teaches the right thing.
- If you can't write three evals for it, don't build it.
- Will it be used 5+ times? One-off → just do the task.
- Always-relevant and small? → CLAUDE.md, not a skill (passive inline context beats skill retrieval for content needed on every task — Vercel eval; details in `${CLAUDE_SKILL_DIR}/references/design.md`).

## What to build

| You need | Build | Why |
|---|---|---|
| Reusable procedure or domain knowledge Claude loads when relevant | **Skill** (default) | Commands are merged into skills; skills add supporting files and invocation control |
| User-controlled side-effect macro (deploy, release, publish) | Skill + `disable-model-invocation: true` | You don't want Claude deciding to deploy because the code looks ready; also removes the description from context |
| Background conventions Claude applies, user never invokes | Skill + `user-invocable: false` | Reference-content archetype |
| Work that floods the main context (logs, search results, bulk reads) | **Subagent** | Isolation: explores with tens of thousands of tokens, returns a distilled summary (sizing norm: the `oberskills:agent` skill) |
| Guaranteed enforcement on every event (block a tool call, gate a commit) | **Hook** | Prose can't guarantee execution; hooks run in the harness. Measured: a forced-eval hook reached near-perfect activation where description-level fixes plateaued — numbers in `${CLAUDE_SKILL_DIR}/references/design.md` (Spence) |
| Deterministic, repeated computation | **Script bundled in a skill** | Executed, not loaded — only output costs tokens |
| Always-relevant, small project facts | **CLAUDE.md** | Passive context is consistently available; no triggering decision to miss |
| Both reusable instructions AND isolation | Skill + `context: fork` (+ `agent:`) — task content with an actionable prompt only | Guideline-only forked skills return nothing useful |

`.claude/commands/*.md` files are legacy: same frontmatter, no supporting files. New artifacts get a skill directory. Full decision detail: `${CLAUDE_SKILL_DIR}/references/design.md`.

## CREATE pipeline

| # | Phase | Load | skill-eval tools | Gate — proceed only when |
|---|---|---|---|---|
| 1 | INTAKE | — | — | Problem stated; 3+ natural trigger phrasings collected; pre-gate above passed |
| 2 | DESIGN | `${CLAUDE_SKILL_DIR}/references/design.md` | — | Artifact type chosen from the table above; file structure and freedom levels planned |
| 3 | BASELINE | `${CLAUDE_SKILL_DIR}/references/eval.md` | `run_eval` (`configurations: ["without_skill"]`, one call per eval id) | `evals.json` with ≥3 evals exists; baseline runs complete; specific failures documented from grading output |
| 4 | BUILD | `${CLAUDE_SKILL_DIR}/references/build.md` | `validate_skill` | Minimal SKILL.md written that addresses the documented baseline gaps; `validate_skill` returns zero errors |
| 5 | EVAL | `${CLAUDE_SKILL_DIR}/references/eval.md` | `run_eval`, `aggregate_benchmark`, `test_triggers`, `optimize_description`, `compare_outputs` | with-skill beats baseline on the gap assertions; trigger accuracy passes in both directions; pressure gates pass (discipline skills). Otherwise iterate — max 3 iterations, then redesign |
| 6 | SHIP | — | `validate_skill` (`package: true` if a `.skill` file is wanted) | Zero errors; warnings resolved or explicitly justified to the user; user checkpoint passed |

Write the skill *after* the baseline. The baseline failures are the spec.

## Hard limits (summary — enforced by `validate_skill`; the tool's output is normative)

| Limit | Value |
|---|---|
| `name` | ≤64 chars, lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens, must match the directory name, no "anthropic"/"claude" |
| `description` | 1–1024 chars, third person, no XML tags |
| `description` + `when_to_use` in the listing | truncated at 1,536 chars combined |
| SKILL.md body | <500 lines hard; <5k tokens recommended; ~200 lines for the always-relevant core |
| References | One level deep from SKILL.md; >100 lines → table of contents at top |
| Evals | ≥3 before ship |

When this summary and the tool disagree, trust the tool.

## Description quick formula

`[Verb-first capabilities]. Use when [triggers/contexts]. Not for: [near-miss exclusions].`

- Third person, always — the description is injected into the system prompt.
- Capability nouns are fine; **never process steps** — a workflow summary becomes a shortcut Claude follows instead of reading the body.
- The exclusion clause lists *near-misses* (tasks that share keywords but belong elsewhere), not absurd negatives.
- Measure, don't guess: `test_triggers`. Full doctrine and when to deviate: `${CLAUDE_SKILL_DIR}/references/build.md`.

## skill-eval tool quick reference

Tools are exposed as `mcp__plugin_oberskills_skill-eval__<tool>`; short names below.

| Tool | Use at | Does |
|---|---|---|
| `validate_skill` | BUILD, SHIP, REVIEW | Spec lint + house WARN lints; zero errors required to ship; `package: true` also zips a `.skill` |
| `test_triggers` | EVAL, REVIEW | Activation rate over should/shouldn't queries via isolated probe sessions |
| `optimize_description` | EVAL | Train/holdout description improvement; chunked — one iteration per call, loop until `done: true` |
| `run_eval` | BASELINE, EVAL | Runs one eval id across configurations × runs in parallel, composes pressure blocks, grades externally |
| `grade_run` | EVAL | (Re)grades an existing run directory after editing assertions |
| `aggregate_benchmark` | EVAL | Stats, named-config delta, ship gates, notes → `benchmark.json` + `benchmark.md` |
| `compare_outputs` | EVAL (subjective skills) | Blind A/B judgment with shuffled sides |

If these tools are missing, the server isn't running: tell the user to run `/reload-plugins` (dependencies install via the plugin's SessionStart hook on next session start).

## Core authoring rules

1. **Claude is already smart.** Only add context Claude doesn't have; challenge every paragraph's token cost — the context window is a public good.
2. **Standing instructions, not one-time steps.** Skill content persists in context for the rest of the session.
3. **Don't over-prompt.** No CRITICAL/MUST trigger language by default — current models overtrigger under it, and skills written for prior models are often too prescriptive for current ones and can degrade output quality. Escalate force only for rules that measurably get missed, and then explain *why*.
4. **Gates beat persuasion.** "Proceed only when X passes" plus external or deterministic checks. Never self-assessed compliance, never anti-rationalization tables — `validate_skill` WARNs on these constructs.
5. **Match freedom to fragility.** Fragile or sequence-critical work gets an exact script ("run exactly this, do not modify"); open-ended work gets heuristics.
6. **Feedback loops for quality-critical output.** Run validator → fix → repeat; make validators verbose with specific error messages.

## Integration

| Counterpart | Hand-off |
|---|---|
| `oberskills:prompt` | Skill bodies are prompts — apply its DESIGN principles to body text; it owns example-count guidance, snippets, and the porting reference for non-Claude/weak-model targets. All prompt-wording review, including the prompt body inside an agent definition, goes to its REVIEW mode; the definition file as an artifact (structure, frontmatter, evals) stays here |
| `oberskills:agent` | Dispatching any subagent during development or review (analyzer, behavioral tests); owns model/effort selection and the subagent-frontmatter field table (its mechanics reference) |
| `oberskills:clarify` | Ambiguous intake |
| skill-eval MCP server | All checkable steps (table above). Server owns validation rules, pressure-block language, trigger-probe mechanics, grading schema, verdict computation, workspace layout |

Analyzer agent prompt (dispatched during EVAL, see `${CLAUDE_SKILL_DIR}/references/eval.md`): `${CLAUDE_SKILL_DIR}/agents/analyzer.md`.

## References

| File | Load when |
|---|---|
| `${CLAUDE_SKILL_DIR}/references/design.md` | DESIGN phase: artifact choice, invocation control, structure, disclosure, routers |
| `${CLAUDE_SKILL_DIR}/references/build.md` | BUILD phase: frontmatter, naming, description doctrines, writing rules, model deltas, templates |
| `${CLAUDE_SKILL_DIR}/references/eval.md` | BASELINE/EVAL phases: evals.json authoring, checks, pressure evals, trigger evals, interpretation, ship gates |
| `${CLAUDE_SKILL_DIR}/references/review-skill.md` | REVIEW mode: audit dimensions, behavioral test, verdict |
