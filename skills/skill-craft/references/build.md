# BUILD — Authoring the skill

## Contents

1. [Frontmatter reference](#1-frontmatter-reference)
2. [String substitutions and dynamic injection](#2-string-substitutions-and-dynamic-injection)
3. [Naming](#3-naming)
4. [Description engineering — both doctrines](#4-description-engineering--both-doctrines)
5. [Writing rules](#5-writing-rules)
6. [Size and focus](#6-size-and-focus)
7. [Current-model deltas — what a 2025 skill gets wrong](#7-current-model-deltas--what-a-2025-skill-gets-wrong)
8. [Examples inside skill bodies](#8-examples-inside-skill-bodies)
9. [Templates](#9-templates)

---

## 1. Frontmatter reference

Open-standard fields (portable across agents):

| Field | Required | Load-bearing semantic |
|---|---|---|
| `name` | Spec yes / Claude Code optional | Limits in SKILL.md's table; in Claude Code the *directory* name sets the command name (frontmatter `name` is display-only, except a plugin-root SKILL.md) |
| `description` | Yes (recommended) | Routing line; if omitted, the first paragraph of body is used. Put the key use case first — the listing truncates |
| `license` | No | Name or bundled-file reference |
| `compatibility` | No | ≤500 chars; product/system/network needs. Most skills don't need it |
| `metadata` | No | String→string map for out-of-spec properties |
| `allowed-tools` | No | **Pre-approves** tools while the skill is active; does NOT restrict availability. Experimental; space/comma string or YAML list |

Claude Code extensions (portable validators flag these as Claude-Code-only):

| Field | Load-bearing semantic |
|---|---|
| `when_to_use` | Trigger phrases/examples appended to the description in the listing; counts toward the 1,536-char combined cap |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]` |
| `arguments` | Named positional args mapping to `$name` substitutions |
| `disable-model-invocation` | `true` = user-only invocation; description removed from context; also blocks preloading into subagents |
| `user-invocable` | `false` = hidden from the `/` menu; Claude can still invoke |
| `disallowed-tools` | Tools removed from the pool while active; clears on the next user message |
| `model` / `effort` | Per-skill model override / effort override (`low`–`max`) for the rest of the turn |
| `context: fork` + `agent` | Run in a forked subagent context; `agent` picks the type (default `general-purpose`) |
| `hooks` | Hooks scoped to the skill's lifecycle |
| `paths` | Glob patterns gating auto-activation to matching files |
| `shell` | `bash` (default) or `powershell` for `!`-injection |

## 2. String substitutions and dynamic injection

Available in skill bodies: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name` (named args), `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}` (the directory containing SKILL.md).

- **Braced form only.** Unbraced `$CLAUDE_SKILL_DIR` / `$CLAUDE_PLUGIN_ROOT` pass through literally and break outside the plugin's own repo. `validate_skill` WARNs on bare relative `references/` paths in SKILL.md bodies.
- Substitution happens in harness-loaded content (SKILL.md bodies, hooks, configs) — **not** in files read at runtime via the Read tool. Keep substitution variables out of `references/*.md`; reference sibling files by name and let SKILL.md state the resolved location.
- If a skill takes arguments but contains no `$ARGUMENTS`, Claude Code appends `ARGUMENTS: <input>` to the content. Escape literal dollars: `\$1.00`.
- Dynamic injection: `` !`command` `` runs at render time (preprocessing, not something Claude executes); recognized at line start or after whitespace; one pass, no recursion. A policy setting (`disableSkillShellExecution`) can disable it — don't make correctness depend on injection alone.

## 3. Naming

- Prefer gerund form: `processing-pdfs`, `writing-documentation`. Noun phrases (`pdf-processing`) and action form (`process-pdfs`) are acceptable.
- Avoid vague (`helper`, `utils`, `tools`) and overly generic (`documents`, `data`, `files`) names; no "anthropic"/"claude".
- Must match the directory name; keep the pattern consistent across the collection.
- Name files descriptively: `form_validation_rules.md`, not `doc2.md`.

## 4. Description engineering — both doctrines

| Doctrine | Format | Apply when |
|---|---|---|
| **Anthropic spec** (default) | What it does (verb-first capabilities) + "Use when [triggers]" + keywords | Capability skills: technique, reference, tooling. Spec-required ("should describe both what the skill does and when to use it"); portable across agents |
| **obra CSO** (when-only) | "Use when [symptoms/triggers]" — zero capability or process content | Process/discipline skills where trigger evals or transcripts show Claude executing the description's summary instead of reading the body. Measured case: a description saying "code review between tasks" caused ONE review where the body's flowchart required TWO; removing the workflow summary fixed it |

Invariants regardless of doctrine:

- Third person — the description is injected into the system prompt; first/second person causes discovery problems.
- Key use case first (the listing truncates the combined `description` + `when_to_use` at 1,536 chars).
- Concrete trigger nouns users actually say, including jargon and file types.
- Exclusion clause: "Not for: …" listing near-misses, not absurd negatives.
- **Capability nouns allowed; workflow steps never.** A workflow summary becomes a shortcut Claude takes instead of reading the body.
- ≤1024 chars; no XML tags.
- No pushy "make sure to use this whenever…" by default — current models overtrigger under aggressive language. Add pushiness only if trigger evals measure under-triggering.

**Tie-breaker: the description is a routing hyperparameter.** Don't argue doctrine — run `test_triggers` and adjust to the measurement.

Anti-examples: "Helps with documents", "Processes data", "Does stuff with files".

## 5. Writing rules

- Imperative form ("Run X", not "You should run X").
- One term per concept, used consistently (don't mix "endpoint"/"URL"/"route").
- Positive instructions: "Write flowing prose paragraphs", not "Don't use markdown".
- Explain *why* for rules that get missed — Claude generalizes from the explanation to unanticipated cases; all-caps doesn't generalize.
- Standing instructions, not one-time steps — the body persists in context all session.
- No time-sensitive content; if old behavior must be documented, use a collapsed "Old patterns" section.
- Fully qualified MCP tool names (`ServerName:tool_name` or the harness's exposed `mcp__…` form).
- For each bundled script, state whether Claude should *execute* it or *read it as reference*. Scripts handle their own error conditions rather than punting to Claude, and carry no voodoo constants — if you don't know the right value, Claude won't either.
- List required packages and install them locally (never globally); verify availability rather than assuming.
- Forward slashes in all paths, even on Windows.
- Don't present multiple approaches unless necessary: give a default plus one escape hatch.

## 6. Size and focus

Detailed-but-compact beats comprehensive. SkillsBench (2602.12670) measured focused 2–3-module skills at **+18.8pp** task improvement while comprehensive everything-skills scored **−2.9pp** — worse than no skill. The same study found **curated content +16.2pp vs self-generated −1.3pp**: distill from real failures and authoritative sources rather than letting a model pad the skill from its own priors. (Caveats: single, non-peer-reviewed benchmark run at 8K context — treat as directional; trim and re-test rather than deleting blindly.)

Practical consequences:

- Target ~200 lines of always-relevant core in SKILL.md; push depth into references.
- Don't encode model-default behavior (formatting niceties, "no magic numbers") — the skill must add non-obvious knowledge to earn its tokens.
- Every line is a recurring per-session cost once loaded. Cut paragraphs that explain what Claude already knows.

## 7. Current-model deltas — what a 2025 skill gets wrong

Audit every skill (new or ported) against these; `oberskills:prompt`'s claude-models reference carries the prompting-level detail.

- **De-prompt the triggers.** Remove "CRITICAL: you MUST use…", "If in doubt, use X", and anti-laziness/thoroughness pushes — Opus 4.5+ models overtrigger under them. "Use X when…" is enough.
- **Never instruct "show your thinking"** or any echo-your-reasoning step — this can trigger `reasoning_extraction` refusals on Fable 5. Read structured thinking blocks instead.
- **Never instruct prefill techniques** — prefilled assistant turns return a 400 error on 4.6+ models. Use structured outputs, direct instruction, or tool enums.
- **Prefer general instructions over prescriptive step plans.** "Think thoroughly" beats a hand-written reasoning recipe; skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality. Re-test default behavior before keeping old scaffolding.
- **Effort is the reasoning dial,** not magic words; `low` suits subagents. Model/effort selection for dispatch: the `oberskills:agent` skill.
- **Porting to non-Claude or non-reasoning models?** Constraint scaffolding that current Claude no longer needs lives in `oberskills:prompt`'s porting reference — link there, don't restate.

## 8. Examples inside skill bodies

Examples teach format, not content. Follow `oberskills:prompt`'s purpose-conditioned example rule — the number and shape of examples depends on what they're for (format anchoring vs boundary-drawing vs edge-case coverage vs worked reasoning); that skill is the single home for the counts. One excellent example beats many mediocre ones; don't implement the same example in five languages.

## 9. Templates

Minimal SKILL.md skeleton:

```markdown
---
name: matching-directory-name
description: [Verb-first capabilities]. Use when [triggers]. Not for: [near-misses].
---

# Skill Name

[1–2 lines: what this does and the core principle.]

## Workflow

1. [Step — imperative form]
2. [Step]

Proceed to step N only when [checkable condition].

## [Decision table or rules]

| Situation | Action |
|---|---|

For [conditional depth]: see references/[topic].md.
```

Progress-checklist pattern (adherence aid for multi-step workflows — Claude copies it and checks items off, making skips visible):

```markdown
Copy this checklist and check off each item as it completes:
- [ ] Baseline run documented
- [ ] Validation passes with zero errors
- [ ] All evals re-run after the last edit
```

Feedback-loop pattern (quality-critical output): "Run [validator] → fix the reported errors → run again. Proceed only on a clean pass." Make the validator verbose with specific messages ("Field signature_date not found. Available fields: …").

Plan-validate-execute pattern (side-effecting workflows): produce a verifiable intermediate artifact (plan file, changes.json), validate it with a script *before* any side effects, then execute.
