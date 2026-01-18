# Prompt Engineering for Agents

> **Purpose:** Techniques for reliable agent prompts
> **Load when:** Writing or debugging agent prompts

## When NOT to Use

- Single-turn prompts (simpler techniques apply)
- Non-agentic LLM usage
- Already have working prompts (don't over-engineer)

---

## Technique 1: Chain of Thought for Tool Selection

**Problem:** LLMs select tools impulsively without considering alternatives.

**Solution:** Force explicit reasoning before selection:

```
Before selecting a tool, work through these steps:

1. GOAL: What am I trying to achieve?
2. OPTIONS: What tools could help? List 2-3 candidates.
3. TRADE-OFFS: What are pros/cons of each?
4. SELECTION: Which tool best fits this specific situation?
5. PARAMETERS: What exact parameters should I use?

Only after completing this analysis, make the tool call.
```

---

## Technique 2: Self-Correction Loops

Embed reflection checkpoints in agent prompts:

```
After each action, pause and verify:

□ Did the action succeed? (Check return value/output)
□ Did it move me closer to the goal?
□ Were there unexpected side effects?
□ Should I continue, adjust, or abort?

If anything is wrong, diagnose before proceeding.
```

---

## Technique 3: Goal Anchoring

Prevent drift with periodic re-grounding:

```
Every 3 steps, re-read the original user request and ask:
- Am I still working toward this goal?
- Have I learned anything that changes the approach?
- What's the shortest path from here to completion?
```

---

## Technique 4: Uncertainty Quantification

Make agents explicit about confidence:

```
For each conclusion or recommendation, state:
- Confidence level: HIGH / MEDIUM / LOW
- Basis: What evidence supports this?
- Caveats: What assumptions am I making?
- Alternatives: What other interpretations exist?
```

---

## Technique Summary

| Technique | Problem Solved | When to Apply |
|-----------|----------------|---------------|
| CoT Tool Selection | Impulsive tool choice | Complex toolsets |
| Self-Correction | Unnoticed failures | Multi-step tasks |
| Goal Anchoring | Drift from objective | Long conversations |
| Uncertainty | Overconfident claims | User-facing outputs |

---

## Anti-Patterns in Agent Prompts

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| "Do your best" | No clear success criteria | Define explicit criteria |
| "Use any tool" | Decision paralysis | Suggest appropriate tools |
| No termination logic | Infinite loops | Add explicit stop conditions |
| No error handling | Crashes on failures | Define recovery strategies |
