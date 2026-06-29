# Porting notes — non-Claude and thinking-off targets

Load this only when the target is NOT a current Claude model, or thinking is disabled. On thinking-enabled Claude, everything below is superseded by adaptive thinking + effort (SKILL.md #6) — and one technique here is an active refusal hazard. This is the plugin-wide porting reference: the agent and skill-craft skills point here rather than carrying their own non-Claude notes.

## Contents

1. [Reasoning compression](#1-reasoning-compression)
2. [Thinking-trace injection (R1/o-series only)](#2-thinking-trace-injection-r1o-series-only)
3. [Termination scaffolds are model-specific](#3-termination-scaffolds-are-model-specific)
4. [Weak and non-reasoning model scaffolding](#4-weak-and-non-reasoning-model-scaffolding)

## 1. Reasoning compression

When you control reasoning via prompt text (no thinking API), compress rather than eliminate:

**Chain-of-Draft (CoD)** — replace "think step by step" with:

> Think step by step, but only keep a minimum draft for each thinking step, with 5 words at most.

Saves 75–90% of reasoning tokens at a small accuracy cost — but **exemplars are mandatory**: zero-shot CoD collapses from 90.4% to 65.5% (2502.18600). Provide 2–3 hand-crafted exemplars of the compressed format for your task type:

```
Q: Jason had 20 lollipops. He gave Denny some. Now he has 12. How many did he give?
A: 20 - 12 = 8. #### 8
```

**Sketch-of-Thought (SoT)** — route the reasoning format by task type (symbolic notation for math/logic, concept chains for multi-hop, expert shorthand for domain tasks): −0.83% accuracy at 75% fewer tokens, recovering most of CoD's accuracy loss on mixed workloads (2503.05179).

**Skip reasoning for simple traffic** — 96.8% of real production queries (mobile-assistant study) do not benefit from CoT at all (2505.11896). Route: simple → direct answer; complex → CoD/SoT. Models self-estimate difficulty unreliably; use a trained classifier or heuristics, or default to:

**Verify-then-escalate** — answer without reasoning, verify (deterministic check, separate model, or self-consistency), retry with full reasoning only on failures. Only the hard tail pays the reasoning cost.

Strategy selection (first matching row wins):

| Situation | Strategy | Cost/accuracy profile |
|---|---|---|
| Simple query (lookup, formatting, single-step) | Skip reasoning entirely | Largest savings; neutral or positive accuracy |
| Mixed task types, accuracy matters | Sketch-of-Thought with a task-type router | −0.83% accuracy, ~75% fewer tokens |
| Uniform tasks, cost is primary | Chain-of-Draft with exemplars | 75–90% savings, small accuracy cost |
| Accuracy plateau despite compression | Verify-then-escalate | Approaches full-CoT accuracy; hard tail pays |
| Novel/extremely hard reasoning | Full CoT with exemplars | Baseline cost, best available |

## 2. Thinking-trace injection (R1/o-series only)

For models that expose a writable reasoning trace (R1-style open models, o-series-style interfaces): tokens inside `<think>` blocks receive ~4x the attention weight of prompt tokens. Injecting critical constraints as first-person statements at the START of the trace ("I need to remember that I must not generate any code…") improved instruction following by +6.65% and raised safety refusal rates from under 20% to over 60% (2503.24370). Keep injections to 3–5 concise statements — overloading the trace degrades reasoning.

> **Never port this to Claude.** Prefilled assistant turns return 400 errors on Claude ≥4.6, raw CoT is never returned on Fable 5/Opus 4.8, and instructing the model to echo or reproduce its reasoning triggers `reasoning_extraction` refusals on Fable 5 (claude-models.md).

**Format resistance.** Deeply reasoning-trained open models can refuse prompted format changes outright: AIMO-2 (2504.16891) could not elicit tool-integrated reasoning from DeepSeek-R1 or QwQ-32B via direct instructions OR few-shot examples — the format had to be trained in. When porting to such a model, test format and tool-use behavior empirically; do not assume strong instruction-following extends to format-level changes.

## 3. Termination scaffolds are model-specific

Canonical numbers (2504.01848, IterativeAgent): removing self-termination / forcing continuation lifted o3-mini from 2.6% to 8.5% and o1 from 13.2% to 24.4% on long-horizon replication tasks — but **hurt Claude 3.5 Sonnet, 21.0% → 16.1%**. "Agents that can quit will quit" is an o-series finding, not a law.

Rule: test termination scaffolding per model family; never assume transfer. On Claude, address premature stopping with context-awareness prompting (snippets.md #10) and the autonomous-pipeline reminder (snippets.md #14), not termination removal.

## 4. Weak and non-reasoning model scaffolding

The guidance that current Claude has outgrown still applies to weak, small, or older models:

- **More explicit steps and guardrails.** Weak models need concrete step-by-step instructions, explicit format specs, and guardrails against common-sense failures that frontier models no longer make. The de-prompting checklist (claude-models.md §2) runs in REVERSE when porting a Claude-tuned prompt down: re-add structure as observed failures demand.
- **Joint instruction + few-shot optimization.** For weak models, optimize instructions and examples together; instruction-only optimization wins at the frontier (optimization.md §5).
- **Manual CoT fallback.** With thinking off, encourage step-by-step reasoning with structured tags — `<thinking>` for the working and `<answer>` for the result — so reasoning is cleanly separable from output. This is Anthropic's own sanctioned fallback for thinking-off Claude as well.
- **Format anchoring matters more.** Weak-compliance models get the biggest format gains from a single example (design.md §3, format-anchoring row); anchor every output format with at least one exemplar.
- **Weaker-model testing doubles as defect detection.** Running any prompt on a weaker model exposes structural defects a strong model papers over (review.md, golden test) — porting is an audit opportunity, not just a compatibility chore.
