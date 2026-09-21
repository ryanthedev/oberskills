# Classifying What's Unclear

Not all gaps are the same. Classifying the type of ambiguity determines what kind of question to ask. Load this when the four-row table in the clarify skill's SKILL.md doesn't settle which kind of gap you're looking at.

## Fault Types

The four families follow Drift-Bench's taxonomy of flawed user input — "Flaw of Intention, Flaw of Premise, Flaw of Parameter, and Flaw of Expression" — which the authors ground in Grice's maxims of relation, quality, quantity, and manner (Bao et al., 2026; source 1). The sub-types are theirs except where the note below says otherwise; the examples are ours.

**Intention faults** — The real goal isn't recoverable from the request.
- Indirect intent: "Can you check if this is possible?" (often means "please do this")
- Vague objectives: "Make it better" (better how? for whom?)
- Contextual irrelevance: user introduces an unrelated goal mid-task

**Premise faults** — An assumption in the request is wrong.
- False presupposition: "Fix the race condition in the cache" (no race condition exists)
- Capability mismatch: asking for something the system can't do
- Factual error: assumptions based on code that has since changed

**Parameter faults** — Required details are missing, conflicting, or mixed with distracting extras.
- Insufficient information: "Build a login page" (OAuth? email/password? SSO?)
- Redundant information: extra detail that may or may not be a constraint — "The old service was written in Go; add a health-check endpoint" (does the new endpoint have to be in Go?)
- Contradictions: "Keep it simple but handle every edge case"
- Missing priorities: everything seems equally important

**Expression faults** — The language prevents unique interpretation.
- Referential ambiguity: "Update that component" (which one?)
- Lexical ambiguity: "Clean up the API" (refactor? deprecate? document?)
- Syntactic ambiguity: the sentence structure allows two parses — "Log errors from the worker with retries" (the worker that has retries, or log with retries?)
- Scope ambiguity: "Production-ready" means different things to different people

House adaptations, not in the paper: contradictions, missing priorities, and scope ambiguity are additions for software work; the paper files vagueness under Expression, while this skill puts vague *objectives* under Intention because the fix is the same — ask for the goal.

## Ambiguity Direction

Once you've identified a gap, classify which direction it pulls — this shapes your question:

| Direction | Signal | Clarification Action |
|-----------|--------|---------------------|
| **Semantic** | Key terms have multiple valid meanings | Disambiguate: "do you mean A or B?" |
| **Too broad** | Clear intent but scope is huge | Specify: "which part matters most right now?" |
| **Too narrow** | Request is oddly specific for the likely goal | Generalize: "what's the broader outcome you're after?" |

This is the Semantic / Specify / Generalize scheme of Tang, Soulier & Guigue (SIGIR 2025; source 2), which names each ambiguity type after the action that resolves it. It was built for conversational search queries; applying it to task requests is this skill's extension, and "disambiguate" is our label for the Semantic action.

## For Coding Tasks Specifically

Three concrete ways a coding request becomes ambiguous — the three types ClarEval injects into standard coding tasks (Li, Wu & Chang, 2026; source 3):

- **Missing goal**: the what/why is absent — only the how is stated
- **Missing premises**: constraints are unstated (sort order, error handling, edge cases)
- **Ambiguous terminology**: precise terms replaced with vague ones ("sorted appropriately" vs "ascending by date")

Two kinds of gap are measured as easy to miss, so check for them explicitly:

- **Vague terms that look like specification.** Ambiguous terminology was ClarEval's hardest type across models: agents notice missing information more readily than they notice that a term already present ("fast", "clean up", "user-friendly") is underspecified.
- **Requirements that conflict with each other.** In HumanEvalComm, inconsistent problem statements drew clarifying questions less often than ambiguous or incomplete ones; the authors' hypothesis is that inconsistency takes stronger reasoning to detect (Wu & Fard; source 4). Check whether parts of the request conflict before starting.

## Sources

All opened and checked against the quoted or paraphrased passage on 2026-09-21.

1. Bao, Zhang, Jing, Yuan, Shi & Ye, "Drift-Bench: Diagnosing Cooperative Breakdowns in LLM Agents under Input Faults via Multi-Turn Interaction," arXiv preprint, Feb 2026 — https://arxiv.org/abs/2602.02455 (Figure 1, §2)
2. Tang, Soulier & Guigue, "Clarifying Ambiguities: on the Role of Ambiguity Types in Prompting Methods for Clarification Generation," SIGIR 2025 — https://arxiv.org/abs/2504.12113 (§3, Table 1)
3. Li, Wu & Chang, "ClarEval: A Benchmark for Evaluating Clarification Skills of Code Agents under Ambiguous Instructions," arXiv preprint, Feb 2026 — https://arxiv.org/abs/2603.00187
4. Wu & Fard, "HumanEvalComm: Benchmarking the Communication Competence of Code Generation for LLMs and LLM Agent," ACM TOSEM — https://arxiv.org/abs/2406.00215
