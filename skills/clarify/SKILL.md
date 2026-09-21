---
name: clarify
description: >-
  Pins down what a user actually wants before work starts on an ambiguous or
  underspecified request — surfaces the competing interpretations and asks the
  clarifying question that removes the most uncertainty. Use when a request has
  multiple valid readings, critical details or constraints are missing, or it
  contradicts itself, and the gap would change the approach. Not for:
  well-specified tasks (renames, typo fixes, version bumps, running tests or
  commands, edits naming an explicit file and change), details readable from
  the codebase, or research and planning workflows that own their own scoping.
when_to_use: >-
  help me pin down what I want, clarify intent, understand requirements,
  ambiguous request, underspecified, this request is vague, what do they
  actually want, multiple valid interpretations, missing critical details,
  before acting on an unclear ask. Not for already-clear requests or facts
  readable from the code.
---

# Clarify

You are about to start work on a user request — because the user asked for help pinning down what they want, because you spotted an ambiguity yourself, or because another skill handed you an unclear ask. Before acting, lead a focused brainstorming session to surface what's unclear, what's missing, and what could be misunderstood.

Your output is a conversation with the user: clarifying questions, differential examples, restatements. Think out loud WITH them — collaborative exploration, not interrogation.

## When to Clarify

LLMs default to assuming rather than asking — on underspecified software tasks, "without explicit prompting, models almost never interact, even for severely underspecified inputs" (Ambig-SWE, Vijayvargiya et al., ICLR 2026, arXiv:2502.13069). This skill counteracts that bias.

**Separate detection from execution.** Check for ambiguity as a distinct pass — before starting work — rather than trying to notice gaps while already solving the problem. A coding-agent scaffold that decoupled underspecification detection from code execution significantly outperformed a single agent doing both, which tended to start modifying code before it recognized the gap (Edwards & Schuster, "Ask or Assume?", arXiv:2603.26233 — one preprint, SWE-bench-style tasks). Treat this as its own reasoning step. (Both sources checked 2026-09-21.)

**Clarify when:**
- The request could have multiple valid interpretations
- Critical constraints or details are absent
- You'd need to make assumptions to proceed
- The request contains contradictions
- You're about to make a hard-to-reverse decision

**Don't clarify when:**
- The request is unambiguous and well-specified
- The action is trivially reversible
- You can determine the answer yourself from the codebase
- Asking would only confirm what's obvious

## The Method

Three separate decisions, in order:

1. **Should I clarify?** — Is there meaningful ambiguity that would change my approach? The lists above and the short-circuit rules below decide this.
2. **What kind of gap is it?** — The type of gap determines the kind of question.
3. **How do I phrase it?** — What specific question, with what framing?

Don't collapse these. Deciding to clarify and blurting out the first question that comes to mind skips the targeting step. Poorly targeted questions waste the user's goodwill.

### Name the Gap

| The gap | What to do |
|---------|------------|
| The real goal isn't recoverable from the request | Ask what outcome they're after |
| An assumption in the request is wrong | Say what you found; propose alternatives |
| A required detail is missing or conflicts with another | Ask for that detail, or which side wins |
| The wording admits several readings | Offer the readings: "do you mean A or B?" |

If the gap doesn't fall cleanly into one row, or you sense something is off but can't say what, load `references/taxonomy.md` in this skill directory.

### Find the Question

Don't start with "what should I ask?" Start with "what are the plausible interpretations?"

1. Generate a few competing interpretations of the request
2. Identify what distinguishes them — the axis of disagreement
3. Ask about that axis

One question targeting the axis of disagreement beats three questions about implementation details.

**Concrete over abstract.** Show what the interpretations would produce — "If you mean X, here's what happens for input Z. If you mean Y, here's what happens instead." — and let the user pick based on observable behavior.

**Ask about intent, goals, and constraints (the user's knowledge). Figure out implementation details yourself (your job).** If answering would send the user off to investigate, investigate yourself first.

**Keep it conversational.** A few questions per turn at most; a list of ten is an interrogation.

A single quick question needs nothing more than this. Load `references/question-craft.md` in this skill directory when the first answer didn't converge and you're heading into a multi-round exchange, when you're choosing among several candidate questions, or when the decision is high-stakes enough to check a drafted question before sending it.

### Short-Circuit Rules

- If all key information is present and you have no competing hypotheses, proceed directly.
- When asking and not-asking would produce equally good outcomes, don't ask. Favor action on ties.
- If the user signals "just do it" or "whatever works," stop asking and work with your best interpretation.

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

## Anti-Patterns

| Pattern | Problem | Instead |
|---------|---------|---------|
| Proceeding without checking | Default execution bias — the problem this skill counters | Run detection as a separate pass first |
| Asking implementation details | Shifts investigation work to the user | Figure it out from the codebase yourself |
| Rapid-fire question lists | Feels like an interrogation, overwhelms | A few questions per turn, conversational |
| Asking what you could read from code | Wastes their time on your job | Read first, ask only about what you can't determine |
| Over-asking on clear requests | Delays work, erodes trust | If it's clear, proceed |
| Abstract questions | Harder for the user to reason about | Show differential examples with concrete behavior |
| Leading questions | Biases response, masks real intent | Open-ended, or present balanced options |
| One round and done | Complex requests need iterative refinement | Continue until hypotheses converge |
| Treating clarification as a blocking gate | Stalls all progress | Clarify the critical gap, start work, refine as you learn |
| Asking when outcomes are equivalent | Unnecessary friction | Favor direct action when asking wouldn't change the result |

## Integration

**When the user invokes this skill directly**, they have already answered "should I clarify?" — go straight to naming the gap. If they haven't said what they're trying to get done, ask that first. If the request turns out to be clear, don't manufacture questions: give the Wrapping Up restatement and confirm. Either way, finish by asking whether to go ahead with the work.

**When another skill or agent loads this skill:**

1. Run the brainstorming session BEFORE the calling skill's main workflow
2. Pass the shared understanding (goal, scope, constraints, approach) into the calling skill's context
3. If new ambiguity surfaces during work, return to the loop — clarification is not a one-time phase

## References

| File | Load when |
|------|-----------|
| `references/taxonomy.md` in this skill directory | The gap is hard to name: fault types with examples, ambiguity direction, coding-specific gaps |
| `references/question-craft.md` in this skill directory | Multi-round or high-stakes clarification: worked hypothesis example, information-gain selection, strategy table, question-quality checks, effort tiers, intent tracking |
