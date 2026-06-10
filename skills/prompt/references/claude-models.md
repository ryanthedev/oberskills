# Claude model behavior and prompt migration

How to prompt current Claude models and migrate prompts written for older ones. Scope note: the model lineup, cost ratios, and effort-selection guidance live in the agent skill's SKILL.md; live IDs and pricing via the claude-api skill. This file covers per-model PROMPTING behavior only.

## Contents

1. [Adaptive thinking and effort mechanics](#1-adaptive-thinking-and-effort-mechanics)
2. [De-prompting checklist](#2-de-prompting-checklist)
3. [Prefill migration table](#3-prefill-migration-table)
4. [The reasoning_extraction hazard](#4-the-reasoning_extraction-hazard)
5. [Per-model prompting deltas](#5-per-model-prompting-deltas)

## 1. Adaptive thinking and effort mechanics

Adaptive thinking replaces extended thinking: Claude dynamically decides when and how much to think, calibrated by the `effort` parameter and query complexity. "In internal evaluations, adaptive thinking reliably drives better performance than extended thinking." On Fable 5 it is always on and cannot be disabled; raw CoT is never returned (`display` defaults to `"omitted"`; set `"summarized"` for readable summaries).

Migration snippet — replace token budgets with:

```json
"thinking": {"type": "adaptive"},
"output_config": {"effort": "high"}
```

Manual `enabled` + `budget_tokens` is deprecated on 4.6 and rejected on newer models. The hard cost ceiling is `max_tokens`; `effort` is the soft control and "a behavioral signal, not a strict token budget" — it shapes ALL output tokens including tool calls. Which level for which model and task: the agent skill's SKILL.md §3 effort guide.

**Per-message steering phrases** (wording-sensitive — use these forms):

- Encourage: "This task involves multi-step reasoning. Think carefully before responding." or append "Please think hard before responding."
- Suppress: "Answer directly without deliberating." or "Extended thinking adds latency and should only be used when it will meaningfully improve answer quality - typically for problems that require multi-step reasoning. When in doubt, respond directly."
- After tools: "After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding."

**Four principles for prompting thinking** (Anthropic, verbatim headings):

1. "Prefer general instructions over prescriptive steps." — "think thoroughly" often produces better reasoning than a hand-written step-by-step plan; Claude's reasoning frequently exceeds what a human would prescribe.
2. "Multishot examples work with thinking." — use `<thinking>` tags inside few-shot examples to show the reasoning pattern.
3. "Manual CoT as a fallback." — only when thinking is off; use `<thinking>`/`<answer>` tags to separate reasoning from output (depth: porting.md).
4. "Ask Claude to self-check." — "Before you finish, verify your answer against [test criteria]." Catches errors reliably for coding and math. (For anything high-stakes this supplements, never replaces, an external verifier — SKILL.md #8.)

Quirk: with thinking disabled, Claude Opus 4.5 is particularly sensitive to the word "think" and its variants — prefer "consider", "evaluate", "reason through".

## 2. De-prompting checklist

The meta-skill payload. When migrating any prompt written for pre-4.6 models, hunt and dial back:

1. "CRITICAL/MUST/ALWAYS use [tool] when…" → "Use [tool] when…"
2. "If in doubt, use [tool]" / "Default to [tool]" → "Use [tool] when it would enhance your understanding"
3. Anti-laziness and thoroughness nudges → delete; re-test default behavior
4. Interim-progress scaffolds ("after every 3 tool calls, summarize") → delete
5. Step-by-step reasoning plans → "think thoroughly", or raise effort
6. Prefills → migration table below
7. "Show your thinking/reasoning" → delete (refusal hazard, §4)

Re-test after each removal. Anthropic, verbatim: "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality." And: "Capability improvements at this level are also a good prompt to re-evaluate which instructions, tools, and guardrails are still needed."

**Instruction budget.** Frontier models reliably follow roughly 150–200 instructions — and Claude Code's system prompt already uses about 50 of that budget (alexop.dev, via practitioner research). Treat this as a capacity bound your prompt shares with the harness, not a target: every rule you add competes for it, so each must earn its place against the removal test (review.md §6). For skill bodies, detailed-compact beats comprehensive — numbers in skill-craft's build reference (SkillsBench 2602.12670).

## 3. Prefill migration table

Prefilled responses on the last assistant turn return a 400 error on Claude 4.6+ models. Anthropic's replacements:

| Old prefill use | Replacement |
|---|---|
| Force JSON/format | Structured Outputs; or just ask (newer models reliably match complex schemas, especially with retries); classification → tool with an enum field |
| Kill preambles | System prompt: "Respond directly without preamble. Do not start with phrases like 'Here is...', 'Based on...', etc."; or XML-tag the output; strip stragglers in post |
| Steer past bad refusals | No longer needed — clear user-message prompting suffices |
| Continuations | User message: "Your previous response was interrupted and ended with `[previous_response]`. Continue from where you left off." Or just retry |
| Context hydration / role consistency | Inject reminders into the user turn; or hydrate via tools or during compaction |

In review, any prefill is a breaking bug (review.md §9).

## 4. The reasoning_extraction hazard

Anthropic, verbatim: "Prompts, skills, or harness instructions that tell the model to echo, transcribe, or explain its internal reasoning as response text can trigger the `reasoning_extraction` refusal category on Claude Fable 5, causing elevated fallbacks to Claude Opus 4.8. Audit existing skills and system prompts for reflection or show-your-thinking instructions when migrating."

Refusals return HTTP 200 with `stop_reason: "refusal"`. If reasoning visibility is needed: read structured `thinking` blocks (adaptive thinking with `display: "summarized"`), or give the agent a send-to-user tool for verbatim mid-task content. In output schemas, ask for brief task-level evidence ("cite the evidence for your verdict"), never a reasoning transcript (design.md §4).

## 5. Per-model prompting deltas

### Fable 5

- **Longer turns by default** — minutes per request, hours autonomous. If turns balloon: the anti-overplanning block (snippets.md #11).
- **Performs better with intent/why.** Template: "I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request]."
- **Don't surface context-budget countdowns** — they trigger wrap-up behavior. Fix: snippets.md #15; long-horizon harnesses: snippets.md #10.
- **Strong instruction following** — "you can steer most behaviors with a brief instruction rather than enumerating each behavior by name."
- Common behavior fixes (fabricated progress, unrequested actions, early stopping, dense summaries) are verbatim blocks in snippets.md (#8, #11–#14).
- Reasoning echo = refusal hazard (§4). Prompts and skills migrated to Fable 5 get the de-prompting pass (§2) first.

### Opus 4.8

- **Literal instruction following** (verbatim): "It does not silently generalize an instruction from one item to another, and it does not infer requests you didn't make… If you need Claude to apply an instruction broadly, state the scope explicitly (for example, 'Apply this formatting to every section, not just the first one')."
- **Concision:** "Positive examples showing how Claude can communicate with the appropriate level of concision tend to be more effective than negative examples or instructions that tell the model what not to do."
- **Shallow reasoning on complex problems:** raise effort rather than prompting around it — "If you observe shallow reasoning on complex problems, raise effort to `high` or `xhigh` rather than prompting around it." Tool-call reluctance responds to effort too.
- **Progress updates:** "If you've added scaffolding to force interim status messages ('After every 3 tool calls, summarize progress'), try removing it."
- **Review/finding prompts:** it follows "only report high-severity" instructions faithfully, so recall drops. Use the coverage-first stage + downstream filter pattern — verbatim block at snippets.md #18.

### Sonnet 4.6

Same 4.6-era rules: no prefill, adaptive thinking over `budget_tokens`, de-prompt aggressive triggers — "more responsive to the system prompt than previous models," so legacy undertriggering fixes now overtrigger.

### Haiku 4.5

Lightest current model: keep prompts explicit and self-contained, anchor formats with an example, and lean on the weak-model scaffolding notes in porting.md when behavior is inconsistent.
