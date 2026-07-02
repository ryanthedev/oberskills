# Prompt optimization and few-shot mechanics

How to systematically improve prompts beyond manual iteration: meta-prompting with Claude, automatic optimization pipelines, modular decomposition, cross-model transfer, and how few-shot examples actually work inside LLMs.

## Contents

1. [Seed quality is the ceiling](#1-the-foundational-law-seed-quality-is-the-ceiling)
2. [Meta-prompting: Claude as the optimizer](#2-meta-prompting-claude-as-the-optimizer)
3. [Decompose into modules](#3-decompose-into-modules-optimize-each-independently)
4. [Reflect on execution traces](#4-reflect-on-execution-traces-not-scalar-scores)
5. [Instructions vs examples by model strength](#5-instructions-vs-examples-by-model-strength)
6. [Cross-model transfer](#6-cross-model-transfer-optimize-cheap-deploy-expensive)
7. [Shorter optimized prompts win](#7-shorter-optimized-prompts-outperform-verbose-ones)
8. [Few-shot mechanics: function-vector heads](#8-few-shot-mechanics-function-vector-heads)
9. [Personas: gate by task type](#9-personas-gate-by-task-type)
10. [Example sourcing](#10-example-sourcing)
11. [Decision tables](#11-decision-tables)
12. [Framework coupling warning](#12-framework-coupling-warning)
13. [Key numbers](#13-key-numbers)

## 1. The foundational law: seed quality is the ceiling

No optimizer — evolutionary, gradient-based, or LLM-driven — can discover rules you did not hint at in the seed prompt. GEPA (2507.19457) shows a single reflective update on a minimal seed can jump from 82.26 to 97.6, but only because the seed captured the right decomposition. With aggressive cost penalties, Promptomatix (2507.14241) returns the baseline prompt unchanged — you are left with exactly your seed.

**Practical consequence:** spend most of your effort writing a clear, well-structured seed; optimization polishes, it does not rescue.

What makes a good seed: declares inputs and outputs explicitly (a bare DSPy signature beat a hand-written paragraph 82.9% vs 59% on jailbreak detection — 2507.03620); decomposes multi-step tasks into named stages with clear contracts; one constraint per failure mode you can anticipate; names implicit non-functional constraints (security, performance, style, deprecation) — requirement misunderstanding causes 43.53% of LLM code errors and non-functional constraints are invisible unless stated (2409.20550); no hedging or filler.

## 2. Meta-prompting: Claude as the optimizer

Anthropic's multi-agent team, verbatim: "The Claude 4 models can be excellent prompt engineers. When given a prompt and a failure mode, they are able to diagnose why the agent is failing and suggest improvements."

The loop:

1. Give Claude the current prompt AND a concrete failure transcript (not a description of the failure — the actual input/output).
2. Ask for a targeted diff: what single change addresses this failure mode, and why.
3. Apply the diff; removal-test the result (review.md §6) so the fix doesn't accrete noise.
4. Re-run the failing input plus inputs that previously worked (regression check).

This is the cheapest optimization method available and the right first step before any framework: it needs one failure example, not a labeled dataset.

**Anchor to a champion.** When iterating, keep the highest-scoring prompt as a fixed champion and branch every candidate from it — mutating only the spans that differ from a lower-scoring variant, never rewriting whole. EvoPrompt (2309.08532): mutating diverging spans only scored 75.55 vs 69.87 for wholesale rewrites; anchoring to the best prompt scored 75.55 vs 69.07 with no anchor.

## 3. Decompose into modules, optimize each independently

Monolithic prompts hit local optima fast. Break compound systems into separate LLM invocations, each with its own prompt, and optimize module by module.

| Approach | Aggregate gain | Method |
|---|---|---|
| Greedy single-candidate | +6.05% | Pick best candidate each round |
| Beam search | +5.11% | Expand top-K candidates |
| Pareto-based selection | **+12.44%** | GEPA: per-instance best, sample from the non-dominated set |

Source: 2507.19457. Greedy produces a deep, narrow search tree that stalls; Pareto sampling keeps the best prompt per training instance and keeps finding improvements across the distribution.

How to apply: identify each LLM call as a module; define input/output contracts; optimize round-robin across modules; propagate improved outputs forward as better inputs downstream. BetterTogether (2407.10930) confirms on a 3-module pipeline: optimize each module before composing the system.

## 4. Reflect on execution traces, not scalar scores

The difference between a useful optimization signal and a useless one: seeing WHY something failed vs only THAT it failed.

| Method | Rollouts to converge | Signal type |
|---|---|---|
| GRPO (RL) | 24,000 | Scalar reward |
| GEPA (reflective evolution) | 6,871 total | Natural-language trace feedback |
| Efficiency ratio | **up to 35x fewer rollouts** | |

Source: 2507.19457. On NPU kernel optimization, error-message-driven feedback lifted mean vector utilization from 4.25% to 30.52% — a 7x improvement from exposing the full error trace.

When building any optimization loop: log the full execution trace, include error messages and the specific failing input, and feed failure traces into the rewrite step as structured context.

## 5. Instructions vs examples by model strength

Joint instruction + few-shot optimization (MIPROv2) gains 5–13% over per-stage optimization (2407.10930) — but the winning strategy depends on model strength:

| Model class | Best strategy | Evidence |
|---|---|---|
| Frontier models | Instruction-only optimization | GEPA instruction-only beat MIPROv2 joint by +13% with far shorter prompts (2507.19457, run on GPT-4.1 Mini as the study target) |
| Weaker / small models | Joint instruction + few-shot | Optimized few-shots lifted jailbreak F1 80.2% → 92.68% on a weak model (2507.03620) |

As instruction-following improves, the marginal value of examples falls — consistent with the purpose-conditioned rule (SKILL.md #5): at the frontier, examples earn their place by purpose (format anchor, boundary, edge-case coverage, reasoning pattern), not by default inclusion. Weak-model scaffolding depth: porting.md.

## 6. Cross-model transfer: optimize cheap, deploy expensive

Optimizing on a cheaper model often produces prompts that transfer better than optimizing directly on the expensive target: GEPA optimized entirely on a small open model outperformed every method optimized directly on the deployment model, transferring without modification (+9.00% — 2507.19457).

Why: prompts optimized on weaker models must be clearer and more explicit, forcing better task decomposition and more precise constraints — qualities that help any model. (Same mechanism as the weaker-model golden test in review.md.)

Apply: run optimization on the cheapest model that can attempt the task; validate on the production model; fall back to optimizing on the target only if transfer fails (rare).

## 7. Shorter optimized prompts outperform verbose ones

At the frontier of optimization quality, higher-performing optimizers produce shorter prompts: GEPA's prompts were up to 9.2x shorter than MIPROv2's example-packed ones AND +13% better (2507.19457). Promptomatix confirms with cost-aware optimization: a moderate length penalty cut prompt length ~43% while retaining 99.9% of peak performance.

**Practical rule:** if your optimized prompt is significantly longer than your seed, something is wrong — the optimizer is memorizing training examples rather than discovering generalizable instructions.

One scope limit: this rule is about optimizer output on general tasks. For domain-intensive agent tasks, performance-only scoring drifts prompts toward generic brevity and drops domain heuristics — preserve task-specific heuristics and failure notes across iterations (evolving playbooks: context.md §6).

## 8. Few-shot mechanics: function-vector heads

Across 12 text models, function-vector (FV) heads — attention heads that compute a compact task encoding — drive in-context learning; induction heads (token copying) have minimal causal impact at production scale (2502.14010). In models past ~1B parameters, FV heads dominate overwhelmingly.

What this means for design:

- Examples are **task-specification signals, not pattern templates**. The model builds a representation of what task you want, it does not copy your format token-by-token.
- The marginal value of an extra example = the new task information it carries. Redundant examples add nothing and can add noise — the mechanism behind the purpose table's "each example must cover a different case."
- Optimize examples for task clarity, not surface similarity to expected inputs.
- Ordering is position-sensitive: if performance varies across orderings by more than a few points, the examples are ambiguous about the task — revise for clarity rather than searching for the perfect order.
- Small-model interpretability findings do not transfer to production scale; don't design examples from small-model intuitions.

## 9. Personas: gate by task type

Expert personas have asymmetric effects (PRISM 2603.18507):

| Task type | Persona effect | Action |
|---|---|---|
| Safety/refusal | Strong positive (+17.7% on JailbreakBench, detailed persona) | Use a detailed safety persona |
| Format/style (writing, extraction) | Moderate positive | Use a domain persona |
| Knowledge retrieval (MMLU-style) | **Negative** (71.6% → 66.3% with a detailed persona) | Avoid or minimize persona |

Mechanism: persona prefixes activate instruction-following pathways that crowd out factual recall; longer personas amplify both the style gain and the knowledge loss. For reasoning-distilled models the persona *content* barely matters — any long structured context activates reasoning pathways; expert-vs-random is nearly flat.

**Rule:** never apply personas unconditionally. Detailed personas for alignment/format/style tasks; minimal or none for factual Q&A. Place in the system prompt.

## 10. Example sourcing

Human-curated examples substantially outperform model-self-generated ones, which are net negative — self-generated examples encode the model's existing biases and failure modes back into the prompt (numbers and the skills-context evidence: skill-craft's build reference, 2602.12670). When you lack labeled data, generate synthetic examples from a *stronger* model (Promptomatix-style), never self-generate from the model being prompted.

## 11. Decision tables

### Manual vs automatic optimization

| Situation | Approach | Rationale |
|---|---|---|
| Few queries, single task | Meta-prompting loop (§2) | Framework overhead exceeds value |
| Stable task, measurable metric, high volume | Automatic (GEPA, MIPROv2, Promptomatix) | ROI from small % gains at scale |
| No labeled data, no clear metric | Meta-prompting + synthetic data first | Optimizers need a signal |
| Multi-step pipeline (RAG, agents) | Automatic, module by module | Pareto selection on compound systems (§3) |
| Subjective quality, no ground truth | Debate-driven evolution (DEEVO 2506.00178 — single study) | Works without labels |
| Safety-critical domain | Manual seed + domain-constrained automatic (EMPOWER 2508.17703 — single study) | Constraint preservation |

### When few-shot helps vs hurts

| Situation | Few-shot? | Why |
|---|---|---|
| Frontier model, task it already does well | No — instruction-only | Ceiling effect; examples add noise (design.md §3 caveat 2) |
| Format/boundary/edge-case/reasoning purpose identified | Yes — count per the purpose table | SKILL.md #5; full evidence in design.md §3 |
| Weak model, format matters | Yes — joint optimization with instructions | §5 |
| Knowledge retrieval | Minimal, no persona | §9 |
| Compressed reasoning format (CoD) prescribed | Mandatory worked exemplars | porting.md |
| No curated examples available | Do not self-generate | §10 |

## 12. Framework coupling warning

Some methods produce prompts entangled with their runtime: instructions extracted out of DSPy and used standalone dropped accuracy from 90% to 83% (2507.03620) — the prompt relied on the framework's inference behavior. GEPA and Promptomatix produce standalone prompts that transfer across models and frameworks. If you need portable prompt artifacts, use methods that optimize the prompt text itself.

## 13. Key numbers

| Finding | Number | Source |
|---|---|---|
| Pareto vs greedy selection | +12.44% vs +6.05% | 2507.19457 |
| Trace feedback efficiency | up to 35x fewer rollouts than RL | 2507.19457 |
| Shorter prompts at the frontier | 9.2x shorter, +13% better | 2507.19457 |
| Cross-model transfer | +9.00% (cheap → strong) | 2507.19457 |
| Joint optimization gain | +5–13% over per-stage | 2407.10930 |
| Signature vs prose seed | 82.9% vs 59% | 2507.03620 |
| Framework coupling cost | 90% → 83% extracted from runtime | 2507.03620 |
| Persona on safety tasks | +17.7% refusal accuracy | 2603.18507 |
| Persona on knowledge tasks | 71.6% → 66.3% MMLU | 2603.18507 |
| FV heads dominate ICL | overwhelming past ~1B params | 2502.14010 |
