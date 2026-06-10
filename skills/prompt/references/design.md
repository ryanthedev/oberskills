# DESIGN mode — depth reference

Loaded in DESIGN mode. The SKILL.md core principles govern; this file adds the structural templates, the full few-shot evidence, output-schema rules, and the escalation ladder.

## Contents

1. [Target classification](#1-target-classification)
2. [Structure templates](#2-structure-templates)
3. [Few-shot design: the purpose-conditioned rule](#3-few-shot-design-the-purpose-conditioned-rule)
4. [Output-schema design](#4-output-schema-design)
5. [Progressive escalation ladder](#5-progressive-escalation-ladder)
6. [Dispatch briefs and agent definitions](#6-dispatch-briefs-and-agent-definitions)
7. [Skill-body prompts](#7-skill-body-prompts)

## 1. Target classification

What dominates the design changes with the target:

| Target | What dominates | Notes |
|---|---|---|
| System prompt | Governance layers (§2); right altitude between hardcoded logic and vagueness | Persists across the whole session — every token is paid on every turn |
| Agent definition / dispatch brief | Outcome + output contract; zero authorship framing for verifiers | Dispatch decisions belong to the agent skill (§6) |
| Skill body | Standing instructions, not one-time steps — the body persists in context for the rest of the session | Format and evals belong to skill-craft (§7) |
| Pipeline stage | Input/output contract per stage; structured formats between stages | Module decomposition: optimization.md |
| Human-runnable prompt | Self-contained context; include a model and effort recommendation inline | The runner may not know the defaults you assume |
| Degrees of freedom | High freedom (text instructions) for tasks with many valid approaches; low freedom (exact scripts, templates) for fragile operations | Full doctrine for skills lives in skill-craft |

## 2. Structure templates

Four layers, kept distinct and independently editable (NLD-P 2602.22790):

```
<role>            provenance: who the model is, operational scope
<constraints>     behavioral rules, format bounds — declared apart from task
<task>            the objective, isolated from governance
<evaluation>      how output will be judged; self-check criteria
```

Verbatim rule (grug memory, NLD-P): "Never merge 'what to do' with 'how to behave' in a single paragraph." Surface syntax (brackets, field labels) doesn't matter; independent revisability does. Constraints embedded in running prose get reinterpreted as models change and "dissolve by paragraph three of output."

**Assembly order for data-heavy prompts (20k+ tokens):** longform data at the TOP, then instructions, then examples, then the query and output format at the END. Wrap each document in `<document>` with `<document_content>` and `<source>` subtags. Effect size and quote-grounding pattern: context.md.

**Persona caveat:** a one-sentence role helps tone and format steering; detailed personas damage factual recall and must be gated by task type (evidence: optimization.md, persona gating).

## 3. Few-shot design: the purpose-conditioned rule

This is the canonical home of the few-shot evidence. The SKILL.md table repeats the counts by design — the one sanctioned duplication, because the counts are needed at the point of every prompt decision.

> Pick example count by purpose, not by a universal number: 1–2 to anchor a format or style (more degrades); one positive + one negative pair to define a boundary; 3–5 *diverse* examples when the model must internalize edge cases or judgment criteria — each example must cover a different case, or it's dead weight; and always include at least one worked example (with visible reasoning) when you prescribe a reasoning format. Examples steer format, tone, and structure — they rarely raise capability on tasks the model already does well, so add them in response to observed failures.

| Purpose of examples | Count | Evidence the branch rests on |
|---|---|---|
| **Format anchoring** — output schema, project house style, terminology, tone | **1–2** (often 1) | CL4SE 2602.23047 RQ3: 1-shot definitive optimum, monotonic decline, 5-shot falls below zero-shot; RQ2: 1–2 optimal, 3–5 degrade; ALICE 2603.20433: single example produces the full format-compliance jump — directional support only (audio-language models, format-constrained audio tasks) |
| **Boundary definition** — what counts as correct vs incorrect | **2, paired** (one positive + one negative; never negative-only) | CL4SE RQ5: 2-shot mixed (correct + overfit) optimal for all five models tested, positive-only beats negative-only; Anthropic Opus 4.8 guidance: positive examples beat negative instructions for length/tone |
| **Edge-case and judgment coverage** — review, assessment, classification with nuanced criteria | **3–5, each covering a DIFFERENT case** | CL4SE RQ4: monotonic gain 0→5 shots with no redundancy-induced degradation — each shot adds a new discussion pattern or edge case; Anthropic S2: "Include 3–5 examples" with the Diverse quality ("cover edge cases"); MOF 2504.06969: formatting diversity across 5 examples cuts style-induced brittleness by up to 46% |
| **Reasoning-pattern demonstration** — prescribing a reasoning format | **≥1 mandatory, 1–2 typical, reasoning inside the example** | Chain-of-Draft 2502.18600: zero-shot collapse without exemplars (numbers: porting.md); CL4SE RQ2: interpreted examples beat bare pairs; Anthropic S2: `<thinking>` tags inside few-shot examples show the reasoning pattern |

Caveats — state these alongside the table whenever you add examples:

1. **Examples steer format/style/judgment, not raw capability.** Anthropic's own wording ("steer output format, tone, and structure") agrees with the research; no current source supports flat accuracy-gain percentages for examples.
2. **Ceiling effect:** on tasks a frontier model already does well zero-shot, examples add noise more than signal. Add examples in response to observed failures, not by default — this is Anthropic's calibration loop (start minimal on the strongest model, add from observed failure modes).
3. **The degradation mechanism is redundancy, not count per se:** repeating same-purpose examples degrades; adding new-information examples doesn't. Function-vector research (2502.14010) shows examples act as task-specification signals, not pattern templates — the marginal value of an extra example is the new task information it carries. N diverse examples ≠ N copies of one example.
4. **Vary surface formatting between examples** (punctuation, labels, layout — MOF 2504.06969), so the model learns task semantics, not surface cues.

## 4. Output-schema design

Order rationale before answer: a schema with `final_answer` before the reasoning field cripples accuracy — in VISTA (2603.18388), GEPA dropped from 23.81% to 13.50% from that one wrong ordering, because the answer field was committed before reasoning could influence it.

On thinking-enabled Claude, deliberation happens in thinking blocks, so keep output rationale fields brief and task-level — `evidence`, `quotes`, `justification` — and never phrase them as "transcribe your thinking" or "show your reasoning step by step", which triggers `reasoning_extraction` refusals on Fable 5 (claude-models.md).

For strict formats prefer structured outputs or a tool with an enum field over prose instructions (claude-models.md, prefill migration).

## 5. Progressive escalation ladder

Start minimal; add a level only when the named failure occurs. Test several inputs before escalating.

| Level | Add when | What to add |
|---|---|---|
| 1. Direct instruction | Always start here | "Summarize this article" + output format |
| 2. Constraints | Output wrong length/format | "…in 2–3 sentences" |
| 3. Grounding / quote requests | Factual errors, unsupported claims | "Quote the relevant passage before answering" |
| 4. Examples | Format varies across 3+ runs | Per the §3 purpose table |

This matches Anthropic's calibration loop: begin with the minimal set of information that fully outlines expected behavior, test on the strongest model first, add instructions and examples only from observed failure modes. Prefer deleting instructions to adding them — the removal test (review.md) is the check.

## 6. Dispatch briefs and agent definitions

This skill writes the prompt text; the agent skill owns the dispatch decision. The four-part delegation contract, model and effort selection, parallelism, and failure prevention live in the agent skill — invoke oberskills:agent for them.

What this skill's principles add to any dispatch text: outcome-focused phrasing rather than an action list; an explicit output contract with a constrained return size (a distilled summary sized per the agent skill's norm, file handoff for bulk); name the artifact the subagent must produce; and zero authorship or intent framing when the subagent is a reviewer or verifier.

## 7. Skill-body prompts

Skill bodies are prompts — all SKILL.md principles apply, plus two skill-specific facts: the body persists in context for the rest of the session (write standing instructions, never one-time steps), and the description is the routing surface (what + when + triggers + exclusions). Creating, validating, and eval-testing skills is skill-craft's job — invoke oberskills:skill-craft.
