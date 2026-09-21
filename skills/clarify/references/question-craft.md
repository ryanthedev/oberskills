# Question Craft

Generating, selecting, and checking clarifying questions, and keeping a multi-round exchange on track. The core loop — interpretations, axis, question — is in the clarify skill's SKILL.md; this file is the depth behind it.

## Contents

1. [Think in hypotheses — worked example](#1-think-in-hypotheses--worked-example)
2. [Select for information gain](#2-select-for-information-gain)
3. [Concrete over abstract](#3-concrete-over-abstract)
4. [Clarification strategies](#4-clarification-strategies)
5. [Question quality](#5-question-quality)
6. [Effort awareness](#6-effort-awareness)
7. [Track intent state](#7-track-intent-state)
8. [Sources](#sources)

## 1. Think in hypotheses — worked example

- Request: "Add caching to the API"
- Interpretation A: In-memory cache for latency
- Interpretation B: External cache (Redis) for scaling
- Interpretation C: HTTP cache headers for clients
- Axis: what problem are they solving — speed, load, or bandwidth?
- Question: "What's driving the caching need — slow responses, high server load, or reducing redundant client requests?"

## 2. Select for information gain

Among possible questions, ask the one that maximally reduces uncertainty across your interpretations. Formally, expected information gain is highest for the question whose possible answers partition the remaining hypotheses into equally sized subsets (Kobalczyk et al., ICLR 2025, Corollary 1; source 1 — the result assumes the hypotheses are equally likely). As an illustration: a question you expect to split your interpretations about evenly beats one whose answer you could already predict nine times out of ten, because the second answer will most likely tell you what you assumed anyway.

Aim for better questions, not more rounds. Across the models in Claw-Eval's multi-turn tasks, the number of clarification rounds showed near-zero correlation with task success, while question precision was the strong predictor (Ye et al., 2026, §5.3; source 2). House heuristic (a rule of thumb, not a research number): if a handful of rounds hasn't converged, the questions are aimed at the wrong axis — regenerate the interpretations instead of asking more.

## 3. Concrete over abstract

- Weak: "How should error handling work?"
- Strong: "Right now errors silently return null. Option A: throw and let the caller handle it. Option B: return a Result type. They'd look like [snippet A] vs [snippet B]."

## 4. Clarification strategies

Match your approach to the fault type. The five strategies are Drift-Bench's clarification actions — Ask_Parameter, Disambiguate, Propose_Solution, Confirm_Risk, Report_Blocker (Bao et al., 2026, §3.2; source 3); the examples are ours.

| Strategy | When | Example |
|----------|------|---------|
| **Ask for parameter** | Specific detail is missing | "What should happen when the input is empty?" |
| **Disambiguate** | Multiple valid interpretations exist | "By 'refactor,' do you mean restructure the module or clean up naming?" |
| **Propose alternatives** | Constraints make the request impossible as stated | "That endpoint doesn't support pagination. We could add it, or switch to cursor-based fetching." |
| **Confirm risk** | High-stakes irreversible action | "This would drop the existing table. Proceed, or migrate the data first?" |
| **Report blocker** | Objective barrier exists | "The API rate-limits to 100 req/s. The current design needs 300. How should we handle that?" |

## 5. Question quality

Every question should pass these checks. This is a house checklist, not a published rubric. It overlaps with the attributes ALFA defines for good clinical questions — focus, answerability, and avoiding leading wording among them (Li et al., COLM 2025; source 4) — and "discriminative" is the information-gain rule above restated as a test.

| Attribute | Test |
|-----------|------|
| **Focused** | Addresses ONE gap — no compound questions |
| **Answerable** | User can answer from what they already know |
| **Discriminative** | The answer meaningfully narrows interpretations |
| **Non-leading** | Doesn't presuppose the answer |
| **Task-relevant** | Directly advances the work at hand |
| **Constructive** | Builds toward shared understanding, not just gathering data |

## 6. Effort awareness

Estimate the effort each question requires from the user. The tiers are a house heuristic:

| Effort | Example | Policy |
|--------|---------|--------|
| **Low** | "Should this be async or sync?" | Ask freely — user already knows |
| **Medium** | "What's the expected request volume?" | Ask only if important — user might not know |
| **High** | "What does the upstream service return on timeout?" | Don't ask — investigate yourself |

High-effort questions shift your investigation onto the user. The pattern that works is explore first, then ask: in Ambig-SWE, the models that explored the codebase before asking got comparable information from fewer questions, "asking only what cannot be independently discovered," and details recoverable from the codebase added little (Vijayvargiya et al., ICLR 2026; source 5).

## 7. Track intent state

For exchanges that run past one round, maintain two mental sets as the conversation progresses (a house technique — the same shrinking-hypothesis-space idea as source 1, kept informal):

- **Confirmed** (+): interpretations, constraints, and goals the user has validated
- **Ruled out** (-): interpretations the user has rejected or that contradict confirmed information

Score remaining interpretations by alignment with confirmed items and conflict with ruled-out items. This naturally narrows the space with each turn.

## Sources

All opened and checked against the quoted or paraphrased passage on 2026-09-21.

1. Kobalczyk, Astorga, Liu & van der Schaar, "Active Task Disambiguation with LLMs," ICLR 2025 — https://arxiv.org/abs/2502.04485
2. Ye, Li, et al., "Claw-Eval: Towards Trustworthy Evaluation of Autonomous Agents," arXiv preprint, 2026 — https://arxiv.org/abs/2604.06132
3. Bao et al., "Drift-Bench: Diagnosing Cooperative Breakdowns in LLM Agents under Input Faults via Multi-Turn Interaction," arXiv preprint, Feb 2026 — https://arxiv.org/abs/2602.02455
4. Li, Mun, Brahman, et al., "ALFA: Aligning LLMs to Ask Good Questions — A Case Study in Clinical Reasoning," COLM 2025 — https://arxiv.org/abs/2502.14860
5. Vijayvargiya, Zhou, Yerukola, Sap & Neubig, "Ambig-SWE: Interactive Agents to Overcome Underspecificity in Software Engineering," ICLR 2026 — https://arxiv.org/abs/2502.13069
