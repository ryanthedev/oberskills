# DESIGN — Choosing and structuring the artifact

## Contents

1. [Intake questions](#1-intake-questions)
2. [Artifact decision, expanded](#2-artifact-decision-expanded)
3. [Invocation control](#3-invocation-control)
4. [Progressive disclosure](#4-progressive-disclosure)
5. [Degrees of freedom](#5-degrees-of-freedom)
6. [Single vs multi-skill, and routers](#6-single-vs-multi-skill-and-routers)
7. [When NOT a skill](#7-when-not-a-skill)

---

## 1. Intake questions

Ask the user before designing anything:

1. "Show me an example of what you want automated."
2. "What would you say to trigger this?" (collect 3+ natural phrasings — these seed the trigger evals)
3. "What's the minimum viable output?"

Expand the pre-gate from SKILL.md:

- **Run the task once without a skill.** Document the specific failure (wrong approach, missing knowledge, skipped step, bad format). No failure → no skill. The failure list becomes the eval assertions.
- **Three evals or no build.** If you can't name three concrete scenarios with checkable outcomes, the problem is too vague to teach.
- **Frequency test.** Used fewer than ~5 times → the skill costs more to build and maintain than it saves.
- **Size-and-relevance test.** Content that is small AND needed on every task belongs in CLAUDE.md (see §7), not behind a triggering decision.

## 2. Artifact decision, expanded

SKILL.md carries the core decision table. Additional mechanics that change the choice:

| Mechanic | Detail |
|---|---|
| Skill + `context: fork` vs subagent with `skills:` field | Forked skill: system prompt comes from the agent type, the task IS the SKILL.md content, CLAUDE.md also loads (except Explore/Plan agents). Subagent with `skills:`: system prompt is the subagent's markdown body, the task is Claude's delegation message, preloaded skills + CLAUDE.md also load |
| `context: fork` precondition | Only for task content with an actionable prompt. A guideline-only forked skill hands the subagent guidelines with no task — it returns without meaningful output |
| `paths` frontmatter | Glob patterns gate auto-activation to matching files — use for file-type-bound skills (e.g. only when touching `*.tf`) |
| `/btw` | For one-off side questions, `/btw` (full context, no tool access) beats spawning a subagent |
| Subagent nesting | Subagents cannot spawn other subagents — don't design workflows that assume they can |
| Skill preloading into subagents | Subagents don't inherit skills. Preload via the subagent's `skills:` frontmatter field, or explicit flat `Skill(...)` lines in the dispatch prompt. Field reference and dispatch rules: the `oberskills:agent` skill |

## 3. Invocation control

| Frontmatter | User can invoke | Claude can invoke | Context cost |
|---|---|---|---|
| (default) | Yes | Yes | Description always in context; full skill loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; full skill loads when the user invokes |
| `user-invocable: false` | No | Yes | Description always in context; full skill loads when invoked |

Two content archetypes map onto this:

- **Reference content** — conventions and knowledge Claude applies in place. Often `user-invocable: false`.
- **Task content** — step-by-step actions with side effects. Often `disable-model-invocation: true` so the user controls timing: you don't want Claude deciding to deploy because the code looks ready. Bonus: the description leaves Claude's context entirely, freeing listing budget.

## 4. Progressive disclosure

Three official levels:

| Level | Loaded | Cost | Content |
|---|---|---|---|
| 1 — Metadata | Always, at startup | ~100 tokens per skill | `name` + `description` |
| 2 — Instructions | When triggered | <5k tokens | SKILL.md body |
| 3 — Resources | As needed | Effectively unlimited | References read on demand; scripts executed, not loaded |

Structure patterns:

- **(a) High-level guide + linked references** — SKILL.md is the table of contents; depth lives in `references/*.md` linked directly from it.
- **(b) Domain-organized references** — one file per variant (`reference/aws.md`, `reference/gcp.md`); Claude reads only the relevant one. For files >10k words, add a "quick search" section with grep patterns in SKILL.md so Claude searches instead of reading whole files.
- **(c) Conditional details** — "For tracked changes: see REDLINING.md."

Rules that override naive extraction:

- **One level deep.** Reference files link directly from SKILL.md; nested chains get previewed with `head -100` and read incompletely.
- **Deletion beats extraction.** Most size savings come from deleting duplication and explanations Claude doesn't need, not from creating more files.
- **Point-of-decision content stays inline.** Content used at the most-executed decision points (gates, routing, hard rules) must live in SKILL.md — conditional file loads get skipped exactly when they matter.
- **One home per fact.** Information lives in SKILL.md *or* a reference, never both.

## 5. Degrees of freedom

| Task type | Freedom | Format |
|---|---|---|
| Research, analysis, open-ended judgment | High | Text guidance, heuristics |
| Workflow with acceptable variation | Medium | Pseudocode, templates with parameters |
| Fragile, sequence-critical, or consistency-critical operations | Low | Exact script: "Run exactly this. Do not modify." |

The analogy: a narrow bridge with cliffs on both sides gets a guardrail (low freedom); an open field doesn't (high freedom). Bundled scripts are the strongest low-freedom tool — deterministic, repeatable, and only their output costs tokens. State explicitly whether each script is *executed* or *read as reference*.

## 6. Single vs multi-skill, and routers

Split signals:

- Genuinely distinct domains with distinct triggers (PDF handling vs spreadsheet handling).
- Classification must happen before execution (heterogeneous requests routed to specialized handling).

If uncertain, start single and split later — premature routing adds complexity. When a router is warranted:

- **Thin router**: the router skill does classification and linking only; no execution logic in the router body.
- **Stateless workers**: each worker handles one mode end-to-end; depth in its own references.
- **Fallback on ambiguity**: the router asks rather than guessing between modes.

**Bias toward fewer, broader skills.** Per-skill descriptions compete for a listing budget of roughly 1% of the context window, and many near-duplicate descriptions confuse selection — Superpowers 4 consolidated overlapping skills for exactly this reason. A single skill with domain-organized references usually beats a family of narrow skills.

## 7. When NOT a skill

State the dissent honestly:

- **Always-relevant content: passive context wins.** Vercel's evals on undocumented framework APIs: an 8KB compressed docs index inline in AGENTS.md passed 100%, while the same content as a skill maxed out at 79% even with explicit invoke instructions — and added nothing (+0pp) when left to default triggering, because the skill wasn't invoked in over half the runs. For content needed on every task, eliminate the triggering decision: put it in CLAUDE.md.
- **Critical workflows: hooks win.** Descriptions are probabilistic; a forced-eval hook measured 100% activation with 100% true negatives, versus roughly half for description- and instruction-level fixes (Spence). When activation failure is unacceptable, pair the skill with a hook or build the enforcement as a hook outright.
- **Trivial tasks may never trigger.** Claude consults skills for tasks it can't trivially handle — a simple one-step query may not trigger even a perfectly described skill. If the use case is all one-step queries, a skill is the wrong shape.
- **Low-lift domains: narrow the content or skip it.** SkillsBench (2602.12670) found skills help most where procedural knowledge is thin in pretraining (Natural Science +28.8pp, Media +24.1, Cybersecurity +18.9) and least where the model already knows the procedure (Software Engineering +11.6, Math/OR +9.7 — smaller, not zero). For high-coverage domains a skill earns its tokens only by encoding domain-specific constraints, formats, or tool quirks — never the general algorithm.
