---
description: Decompose user intent through structured brainstorming before acting on ambiguous or underspecified requests. Classifies ambiguity type, generates competing hypotheses, and selects maximally informative clarifying questions. Use when requirements are unclear, requests could have multiple valid interpretations, or critical details are missing. Triggers on "clarify intent", "understand requirements", "ambiguous request", "underspecified", "what do they actually want".
user-invocable: false
---

# Clarify

You are about to start work on a user request. Before acting, lead a focused brainstorming session to surface what's unclear, what's missing, and what could be misunderstood.

Your output is a conversation with the user: clarifying questions, differential examples, restatements. Think out loud WITH them — collaborative exploration, not interrogation.

---

## When to Clarify

LLMs default to assuming rather than asking — even frontier models proceed without clarification in 70% of cases where information is missing. This skill counteracts that bias.

**Separate detection from execution.** Checking for ambiguity as a distinct pass — before starting work — outperforms trying to notice gaps while already solving the problem. Treat this as its own reasoning step.

**Invoke when:**
- The request could have multiple valid interpretations
- Critical constraints or details are absent
- You'd need to make assumptions to proceed
- The request contains contradictions
- You're about to make a hard-to-reverse decision

**Don't invoke when:**
- The request is unambiguous and well-specified
- The action is trivially reversible
- You can determine the answer yourself from the codebase
- Asking would only confirm what's obvious

---

## Classifying What's Unclear

Not all gaps are the same. Classifying the type of ambiguity determines what kind of question to ask.

### Fault Types

**Intention faults** — The real goal isn't recoverable from the request.
- Indirect intent: "Can you check if this is possible?" (often means "please do this")
- Vague objectives: "Make it better" (better how? for whom?)
- Contextual irrelevance: user introduces an unrelated goal mid-task

**Premise faults** — An assumption in the request is wrong.
- False presupposition: "Fix the race condition in the cache" (no race condition exists)
- Capability mismatch: asking for something the system can't do
- Factual error: assumptions based on code that has since changed

**Parameter faults** — Required details are missing or conflicting.
- Insufficient information: "Build a login page" (OAuth? email/password? SSO?)
- Contradictions: "Keep it simple but handle every edge case"
- Missing priorities: everything seems equally important

**Expression faults** — The language prevents unique interpretation.
- Referential ambiguity: "Update that component" (which one?)
- Lexical ambiguity: "Clean up the API" (refactor? deprecate? document?)
- Scope ambiguity: "Production-ready" means different things to different people

### Ambiguity Direction

Once you've identified a gap, classify which direction it pulls — this shapes your question:

| Direction | Signal | Clarification Action |
|-----------|--------|---------------------|
| **Semantic** | Key terms have multiple valid meanings | Disambiguate: "do you mean A or B?" |
| **Too broad** | Clear intent but scope is huge | Specify: "which part matters most right now?" |
| **Too narrow** | Request is oddly specific for the likely goal | Generalize: "what's the broader outcome you're after?" |

### For Coding Tasks Specifically

Three concrete ways a coding request becomes ambiguous:

- **Missing goal**: the what/why is absent — only the how is stated
- **Missing premises**: constraints are unstated (sort order, error handling, edge cases)
- **Ambiguous terminology**: precise terms replaced with vague ones ("sorted appropriately" vs "ascending by date")

Inconsistencies between requirements are the hardest to detect. Explicitly check whether parts of the request conflict with each other.

---

## Generating Questions

### Think in Hypotheses

Don't start with "what should I ask?" Start with "what are the plausible interpretations?" Then find the question whose answer eliminates the most of them.

1. Generate 2-4 competing interpretations of the request
2. Identify what distinguishes them — the axis of disagreement
3. Ask about that axis

**Example:**
- Request: "Add caching to the API"
- Interpretation A: In-memory cache for latency
- Interpretation B: External cache (Redis) for scaling
- Interpretation C: HTTP cache headers for clients
- Axis: what problem are they solving — speed, load, or bandwidth?
- Question: "What's driving the caching need — slow responses, high server load, or reducing redundant client requests?"

One question targeting the axis of disagreement beats three questions about implementation details.

### Select for Information Gain

Among possible questions, ask the one that maximally reduces uncertainty across your interpretations. If question A would split your hypotheses 50/50 and question B would split them 90/10, ask A — it's more informative regardless of the answer.

Target convergence in 3-5 rounds. Beyond that, returns diminish sharply.

### Concrete Over Abstract

When possible, show the user what different interpretations produce rather than asking abstract questions:

- Weak: "How should error handling work?"
- Strong: "Right now errors silently return null. Option A: throw and let the caller handle it. Option B: return a Result type. They'd look like [snippet A] vs [snippet B]."

Show differential behavioral examples — "If you mean X, here's what happens for input Z. If you mean Y, here's what happens instead." Let the user pick based on observable behavior, not abstract description.

### Five Clarification Strategies

Match your approach to the fault type:

| Strategy | When | Example |
|----------|------|---------|
| **Ask for parameter** | Specific detail is missing | "What should happen when the input is empty?" |
| **Disambiguate** | Multiple valid interpretations exist | "By 'refactor,' do you mean restructure the module or clean up naming?" |
| **Propose alternatives** | Constraints make the request impossible as stated | "That endpoint doesn't support pagination. We could add it, or switch to cursor-based fetching." |
| **Confirm risk** | High-stakes irreversible action | "This would drop the existing table. Proceed, or migrate the data first?" |
| **Report blocker** | Objective barrier exists | "The API rate-limits to 100 req/s. The current design needs 300. How should we handle that?" |

---

## Question Quality

### Attributes

Every question should pass these checks:

| Attribute | Test |
|-----------|------|
| **Focused** | Addresses ONE gap — no compound questions |
| **Answerable** | User can answer from what they already know |
| **Discriminative** | The answer meaningfully narrows interpretations |
| **Non-leading** | Doesn't presuppose the answer |
| **Task-relevant** | Directly advances the work at hand |
| **Constructive** | Builds toward shared understanding, not just gathering data |

### Effort Awareness

Estimate the effort each question requires from the user:

| Effort | Example | Policy |
|--------|---------|--------|
| **Low** | "Should this be async or sync?" | Ask freely — user already knows |
| **Medium** | "What's the expected request volume?" | Ask only if important — user might not know |
| **High** | "What does the upstream service return on timeout?" | Don't ask — investigate yourself |

**The principle: ask about intent, goals, and constraints (the user's knowledge). Figure out implementation details yourself (your job).**

High-effort questions that shift investigation to the user are far more costly than questions they can't answer. When in doubt, investigate yourself first.

---

## Managing the Conversation

### Track Intent State

Maintain two mental sets as the conversation progresses:

- **Confirmed** (+): interpretations, constraints, and goals the user has validated
- **Ruled out** (-): interpretations the user has rejected or that contradict confirmed information

Score remaining interpretations by alignment with confirmed items and conflict with ruled-out items. This naturally narrows the space with each turn.

### Decouple the Decisions

Three separate questions, in order:

1. **Should I clarify?** — Is there meaningful ambiguity that would change my approach?
2. **What type of clarification?** — Which fault type and strategy apply?
3. **How do I phrase it?** — What specific question, with what framing?

Don't collapse these. Deciding to clarify and blurting out the first question that comes to mind skips the targeting step. Poorly targeted questions waste the user's goodwill.

### Short-Circuit Rules

- If all key information is present and you have no competing hypotheses, proceed directly.
- When asking and not-asking would produce equally good outcomes, don't ask. Favor action on ties.
- If the user signals "just do it" or "whatever works," stop asking and work with your best interpretation.

---

## Wrapping Up

When you've reached clarity, restate before proceeding:

> Here's what I understand:
> - **Goal**: [what they're trying to achieve]
> - **Scope**: [what's in and what's out]
> - **Constraints**: [hard requirements, if any]
> - **Approach**: [how you plan to tackle it]
>
> Does that match what you're thinking?

This gives the user a final chance to correct course and documents the shared understanding.

---

## Anti-Patterns

| Pattern | Problem | Instead |
|---------|---------|---------|
| Proceeding without checking | 70% default execution bias — the problem this skill counters | Run detection as a separate pass first |
| Asking implementation details | Shifts investigation work to the user | Figure it out from the codebase yourself |
| Rapid-fire question lists | Feels like an interrogation, overwhelms | 1-3 questions max per turn, conversational |
| Asking what you could read from code | Wastes their time on your job | Read first, ask only about what you can't determine |
| Over-asking on clear requests | Delays work, erodes trust | If it's clear, proceed |
| Abstract questions | Harder for the user to reason about | Show differential examples with concrete behavior |
| Leading questions | Biases response, masks real intent | Open-ended, or present balanced options |
| One round and done | Complex requests need iterative refinement | Continue until hypotheses converge |
| Treating clarification as a blocking gate | Stalls all progress | Clarify the critical gap, start work, refine as you learn |
| Asking when outcomes are equivalent | Unnecessary friction | Favor direct action when asking wouldn't change the result |

---

## Integration

When another skill or agent loads this skill:

1. Run the brainstorming session BEFORE the calling skill's main workflow
2. Pass the shared understanding (goal, scope, constraints, approach) into the calling skill's context
3. If new ambiguity surfaces during work, return to the loop — clarification is not a one-time phase
