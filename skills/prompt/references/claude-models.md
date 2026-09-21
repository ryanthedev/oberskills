# Claude model behavior and prompt migration

How to prompt current Claude models and migrate prompts written for older ones. Scope note: the model lineup, cost ratios, and effort-selection guidance live in the agent skill's SKILL.md; live IDs and pricing via the claude-api skill. This file covers per-model PROMPTING behavior only.

Last swept 2026-09-21 against Fable 5.1 / Opus 5 / Sonnet 5 / Haiku 4.5 (Fable 5, Opus 4.8, Sonnet 4.6 are legacy, still served). Claims re-checked in a sweep carry `(verified YYYY-MM-DD)`; an older date, or none, means carried forward unchecked.

## Contents

1. [Adaptive thinking and effort mechanics](#1-adaptive-thinking-and-effort-mechanics)
2. [De-prompting checklist](#2-de-prompting-checklist)
3. [Prefill migration table](#3-prefill-migration-table)
4. [The reasoning_extraction hazard](#4-the-reasoning_extraction-hazard)
5. [Per-model prompting deltas](#5-per-model-prompting-deltas)

## 1. Adaptive thinking and effort mechanics

Adaptive thinking replaces extended thinking: Claude dynamically decides when and how much to think, calibrated by the `effort` parameter and query complexity. "In internal evaluations, adaptive thinking reliably drives better performance than extended thinking." On Fable 5.1, as on Fable 5, it is always on — `{"type": "disabled"}` is a 400 — and raw CoT is never returned (`display` defaults to `"omitted"`; set `"summarized"` for readable summaries) (verified 2026-09-21).

**Thinking defaults are per-model, and Opus 5 flipped them.** Omitting `thinking` runs adaptive on Opus 5 and Sonnet 5, but runs *without* thinking on Opus 4.8/4.7. Two consequences on Opus 5: `max_tokens` now caps thinking + response text together, so raise it on any route that never set `thinking`; and `{"type": "disabled"}` is accepted only at effort `high` or below — pairing it with `xhigh`/`max` is a 400, validated per request. Prefer thinking on at `low` effort over disabling it (§5, Opus 5; default and effort cap verified 2026-09-21).

Migration snippet — replace token budgets with:

```json
"thinking": {"type": "adaptive"},
"output_config": {"effort": "high"}
```

Manual `enabled` + `budget_tokens` is deprecated on 4.6 and rejected on newer models. The hard cost ceiling is `max_tokens`; `effort` is the soft control and "a behavioral signal, not a strict token budget" — it shapes ALL output tokens including tool calls. Which level for which model and task: the agent skill's Model and effort section.

**Per-message steering phrases** (wording-sensitive — use these forms):

- Encourage: "This task involves multi-step reasoning. Think carefully before responding." or append "Please think hard before responding."
- Suppress: "Answer directly without deliberating." or "Extended thinking adds latency and should only be used when it will meaningfully improve answer quality - typically for problems that require multi-step reasoning. When in doubt, respond directly."
- After tools: "After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding."

**Length instructions don't control reasoning length.** "Be concise" / "answer in under N tokens" are unreliable on reasoning models — requesting under-20-token reasoning still produced 350+ tokens (CoT-Valve 2502.09601). Control length structurally instead: lower `effort`, an answer-only output schema, a fixed step count, or a delimiter that terminates the trace. (Compression formats for non-Claude or thinking-off targets: porting.md.)

**Four principles for prompting thinking** (Anthropic, verbatim headings):

1. "Prefer general instructions over prescriptive steps." — "think thoroughly" often produces better reasoning than a hand-written step-by-step plan; Claude's reasoning frequently exceeds what a human would prescribe.
2. "Multishot examples work with thinking." — use `<thinking>` tags inside few-shot examples to show the reasoning pattern.
3. "Manual CoT as a fallback." — only when thinking is off; use `<thinking>`/`<answer>` tags to separate reasoning from output (depth: porting.md).
4. "Ask Claude to self-check." — "Before you finish, verify your answer against [test criteria]." Catches errors reliably for coding and math. (For anything high-stakes this supplements, never replaces, an external verifier — SKILL.md #8.) **Carve out Opus 5:** it self-verifies unprompted, and Anthropic says adding these instructions "cause over-verification… removing them reduces wasted tokens with no loss in quality" (§5). A prompt library that applies self-check uniformly needs an exception, not a global rule.

## 2. De-prompting checklist

The meta-skill payload. When migrating any prompt written for pre-4.6 models, hunt and dial back:

1. "CRITICAL/MUST/ALWAYS use [tool] when…" → "Use [tool] when…"
2. "If in doubt, use [tool]" / "Default to [tool]" → "Use [tool] when it would enhance your understanding"
3. Anti-laziness and thoroughness nudges → delete; re-test default behavior
4. Interim-progress scaffolds ("after every 3 tool calls, summarize") → delete
5. Step-by-step reasoning plans → "think thoroughly", or raise effort
6. Prefills → migration table below
7. "Show your thinking/reasoning" → delete (refusal hazard, §4)

Re-test after each removal. Anthropic, verbatim (Fable 5 prompting page; 5.1 inherits it — §5): "Skills developed for prior models are often too prescriptive for Claude Fable 5 and can degrade output quality." And: "Capability improvements at this level are also a good prompt to re-evaluate which instructions, tools, and guardrails are still needed."

**Instruction budget (community heuristic — not Anthropic guidance).** A practitioner analysis puts frontier models at roughly 150–200 reliably-followed instructions, with Claude Code's system prompt consuming about 50 (humanlayer.dev "Writing a good CLAUDE.md", citing arXiv:2507.11538 — a 2025, pre-Fable, general-LLM paper; the ~50 is the blog's own harness analysis; verified 2026-07-01 as absent from every official prompting page). The direction is sound even though the numbers are soft: treat instruction-following as a capacity bound your prompt shares with the harness, not a target — every rule you add competes for it, so each must earn its place against the removal test (review.md §6). For skill bodies, detailed-compact beats comprehensive — numbers in skill-craft's build reference (SkillsBench 2602.12670).

## 3. Prefill migration table

Prefilled responses on the last assistant turn return a 400 error on Claude 4.6+ models. Anthropic's replacements:

| Old prefill use | Replacement |
|---|---|
| Force JSON/format | Structured Outputs; or just ask (newer models reliably match complex schemas, especially with retries); classification → tool with an enum field |
| Kill preambles | System prompt: "Respond directly without preamble. Do not start with phrases like 'Here is...', 'Based on...', etc."; or XML-tag the output; strip stragglers in post |
| Steer past bad refusals | No longer needed — clear user-message prompting suffices |
| Continuations | User message: "Your previous response was interrupted and ended with `[previous_response]`. Continue from where you left off." Or just retry |
| Context hydration / role consistency | Inject reminders into the user turn; or hydrate via tools or during compaction (on Fable 5.1 keep this append-only — §5) |

In review, any prefill is a breaking bug (review.md §9).

## 4. The reasoning_extraction hazard

Anthropic, verbatim (Fable 5 prompting page): "Prompts, skills, or harness instructions that tell the model to echo, transcribe, or explain its internal reasoning as response text can trigger the `reasoning_extraction` refusal category on Claude Fable 5, causing elevated fallbacks to Claude Opus 4.8. Audit existing skills and system prompts for reflection or show-your-thinking instructions when migrating."

Refusals return HTTP 200 with `stop_reason: "refusal"`. If reasoning visibility is needed: read structured `thinking` blocks (adaptive thinking with `display: "summarized"`), or give the agent a send-to-user tool for verbatim mid-task content (elicitation: snippets.md #20). In output schemas, ask for brief task-level evidence ("cite the evidence for your verdict"), never a reasoning transcript (design.md §4).

The full classifier picture (verified 2026-09-21, Refusals and fallback page): Fable 5.1 covers "the same `stop_details` categories as Claude Fable 5", so the hazard above applies to it even though the 5.1 prompting page does not restate it. Four named categories — `cyber`, `bio`, `frontier_llm` (helping build competing AI models), `reasoning_extraction` — plus a `general_harms` catch-all. Benign security, life-sciences, and ML work can trigger them. Anthropic says 5.1 false-positives less than Fable 5 did at launch and names three remaining triggers, each with a prompt-side fix: compile-check phrasing (ask "Are there any bugs in this program?"), lesser-known languages (supply the language docs), base64 in tool output (remove it). Opus 5 runs classifiers too, so check `stop_reason` before reading `content` on all three. Configure a fallback, preferring `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) over pinning a model: it routes by refusal category and spares you a migration when a pinned fallback is deprecated (Fable 5.1's permitted targets: Opus 4.8 and Opus 5). Know the limit: fallback covers the **main model path only** — tool-embedded or advisor sub-inference calls that trip a classifier fail with a generic "unavailable" error that stays disabled for the rest of the session (claude-code#67306, reported on Fable 5; closed as not planned 2026-08-25, so treat it as standing).

## 5. Per-model prompting deltas

### Fable 5.1

Successor to Fable 5 (now legacy). Anthropic, verbatim: "Your existing Claude Fable 5 prompts should perform well on Claude Fable 5.1 without changes" — so the Fable 5 guidance carries over and the 5.1 deltas sit on top (both pages verified 2026-09-21). Verbatim fix blocks for the deltas: snippets.md #27–#38.

Carried over from Fable 5:

- **Longer turns by default** — minutes per request, hours autonomous. If turns balloon: the anti-overplanning block (snippets.md #11).
- **Performs better with intent/why.** Template: "I'm working on [the larger task] for [who it's for]. They need [what the output enables]. With that in mind: [request]."
- **Don't surface context-budget countdowns** — they trigger wrap-up behavior. Fix: snippets.md #15; long-horizon harnesses: snippets.md #10.
- **Strong instruction following** — "you can steer most behaviors with a brief instruction rather than enumerating each behavior by name." Its failure mode is over-elaboration, not laziness; one brief brevity instruction steers it (snippets.md #12).
- Common behavior fixes (fabricated progress, unrequested actions, early stopping, dense summaries) are verbatim blocks in snippets.md (#8, #11–#14, #19–#21).
- Reasoning echo = refusal hazard (§4). Prompts and skills migrated to Fable get the de-prompting pass (§2) first.

New on 5.1:

- **Quieter during long tool runs**, more so at higher effort. Before adding prompt text, request the updates it does write (`thinking.display: "updates"`, beta) and delete legacy "hold all findings for the final response" lines; then state the cadence you want (snippets.md #27).
- **One tool call per turn where Fable 5 batched several** in long agent loops — costs turns, not quality; a one-line batching instruction fixes it (snippets.md #28).
- **Forced tool use is a 400** (`tool_choice` `any`/`tool`), since it would skip the always-on thinking. Say in the prompt when the tool applies; get schema validity from strict tool use or Structured Outputs.
- **History is append-only.** Editing anything before a 5.1 thinking block invalidates it — a 400 for accounts created on or after 2026-08-31, opt-in for older ones. Send per-turn reminders as turn-scoped system messages (`clear_at: "next_user_message"`, beta), not injected-then-deleted text. If you compact on the client, tell the summary what to preserve (snippets.md #34).
- **Less chat formatting, denser prose.** Remove anti-formatting rules written for earlier models or swap in a when-to-format rule (snippets.md #30); for density, name the anti-pattern (#29). Unmarked quotation in summaries is fixed by one complete worked example with a rationale, not by a rule (#31).
- **Ends turns on a plan or a permission question** on asynchronous work, adds nearby fixes and extra tests, rewrites whole files for small edits. Fixes: snippets.md #32 with #33 (they replace #14 for 5.1 targets), #35, and #37.
- **Long deliverables at `xhigh`/`max`** get drafted in thinking and then written again — run them at `high`, or add snippets.md #38.
- **Answers from memory at `low` effort** instead of searching — raise effort for those turns or add a verify-the-name nudge (snippets.md #36). Re-sweep effort when migrating: "effort level names don't correspond to the same amount of thinking across models" (the agent skill's Model and effort section).

### Opus 5

Launched 2026-07-24 (`claude-opus-5`). Start from the fact that most prompts need nothing — verbatim: "It performs well out of the box on existing Claude Opus 4.8 prompts." What follows is the short list that does need tuning (Anthropic quotes verified 2026-09-21; practitioner reports keep their own dates). Pricing and tier: the agent skill's Model and effort section.

- **Verbosity is a prompting problem, not an effort problem** (verbatim): "The effort parameter controls how much the model thinks rather than how much it says: lowering effort can reduce thinking volume without reliably shortening the visible response." Conciseness block: snippets.md #22. Files it writes to disk run long on a *separate* axis — instruct length there too.
- **Delete verification and self-check scaffolding** (verbatim): it "verifies its own work without being told to… instructions like these cause over-verification on Claude Opus 5, and removing them reduces wasted tokens with no loss in quality." Same for "double-check your answer" / "re-verify before responding." This is a delete, not a rewrite, and it applies to harness-level verification steps as well as prompt text.
- **Narrates more, and narrates its own corrections more.** Cadence block: snippets.md #23; correction filter: snippets.md #24. To tune narration *up* instead, positive examples of the wanted style beat don't-do instructions.
- **Expands task scope** — adds unrequested steps or applies its own judgment about what the task should be. Scope block: snippets.md #25.
- **Delegates to subagents more readily — the reverse of Opus 4.8.** Any "delegate more" guidance written for 4.8 should come out, and cost-sensitive harnesses want an explicit cap (the agent skill's Parallel fan-out section).
- **Re-sweep effort rather than porting 4.8 defaults.** The prompting-side evidence points downward: a week-long practitioner test found "the more time you give it to think, the more likely it is to do the more annoying behaviors" (Every, 2026-07-24; single team, unreplicated). Which level to pick, and the `max_tokens` floor at `xhigh`/`max`: the agent skill's Model and effort section.
- **Thinking-off routes need care** — see §1 for the effort cap, and snippets.md #26 for the two visible artifacts (tool calls emitted as plain text, XML tag leakage) plus the counterintuitive fixes.
- **If a skill that worked on 4.8 misbehaves, suspect carried-over verification and scope scaffolding first (§2).** One launch-day report said Opus 5 "will often stop early or otherwise miss your instructions" with existing skills (Every, 2026-07-24 — single source, never reproduced); a debugging hint, not an established fact.
- **Its fit as a code reviewer is contested — don't make it the sole reviewer on concurrency- or correctness-heavy changes.** One vendor's launch-day benchmark found lower issue coverage than its production baseline and far more nitpicks, weakest on "logic errors, race conditions, and API misuse" (CodeRabbit, 2026-07-24, not re-run since). Anthropic's Opus 5 prompting page says the opposite — it "reviews code with high precision and recall" (vendor claim, verified 2026-09-21). Both are single-source and nothing settles it; the advice holds either way. Numbers and caveats: the agent skill's verifier-dispatch reference.
- **Review prompts saying "only report high-severity" or "be conservative" get followed literally**, so recall drops — unchanged from 4.8. Anthropic: "ask it to report everything and filter in a separate pass instead." Verbatim block: snippets.md #18.

### Opus 4.8 (legacy — migration reference)

- **Literal instruction following** (verbatim): "It does not silently generalize an instruction from one item to another, and it does not infer requests you didn't make… If you need Claude to apply an instruction broadly, state the scope explicitly (for example, 'Apply this formatting to every section, not just the first one')."
- **Concision:** "Positive examples showing how Claude can communicate with the appropriate level of concision tend to be more effective than negative examples or instructions that tell the model what not to do."
- **Shallow reasoning on complex problems:** raise effort rather than prompting around it — "If you observe shallow reasoning on complex problems, raise effort to `high` or `xhigh` rather than prompting around it." Tool-call reluctance responds to effort too.
- **Progress updates:** "If you've added scaffolding to force interim status messages ('After every 3 tool calls, summarize progress'), try removing it."
- **Review/finding prompts:** literal "only report high-severity" following started here and persists on Opus 5 (see above).

### Sonnet 5

- Launched 2026-06-30 (`claude-sonnet-5`; thinking and sampling behavior verified 2026-09-21). Adaptive thinking **on by default** (`disabled` still accepted, unlike Fable); manual extended-thinking budgets return 400; non-default `temperature`/`top_p`/`top_k` return 400 — new for the Sonnet class.
- **New tokenizer:** "The same input text produces approximately 30% more tokens than on Claude Sonnet 4.6. The exact increase depends on the content" (What's new in Claude Sonnet 5; the pricing page gives the same figure for all 4.7-and-later models; verified 2026-09-21) — re-baseline token budgets, `max_tokens` limits, and cost estimates when migrating.
- Effort defaults `high`; same de-prompting rules as the 4.6 era.
- **Context-budget countdowns: surface them** and pair with the context-awareness block (snippets.md #10) — the opposite of the Fable rule above. The persistence pattern is per-model, not universal.

### Sonnet 4.6 and older (legacy — migration reference)

Same 4.6-era rules: no prefill, adaptive thinking over `budget_tokens`, de-prompt aggressive triggers — "more responsive to the system prompt than previous models," so legacy undertriggering fixes now overtrigger. Older still: with thinking disabled, Opus 4.5 is particularly sensitive to the word "think" and its variants — prefer "consider", "evaluate", "reason through".

### Haiku 4.5

Lightest current model: keep prompts explicit and self-contained, anchor formats with an example, and lean on the weak-model scaffolding notes in porting.md when behavior is inconsistent.
