# Evaluator-Optimizer Pattern

> **Purpose:** Quality-critical outputs requiring iterative refinement
> **Load when:** First-pass output unlikely to meet quality bar, measurable criteria exist

## When NOT to Use

- Quality acceptable on first attempt
- No clear evaluation criteria
- Time constraints prohibit iteration

---

## Architecture

```
┌──────────────────────────────────────────┐
│                                          │
│    ┌──────────┐      ┌───────────┐       │
│    │Generator │─────►│ Evaluator │       │
│    └──────────┘      └─────┬─────┘       │
│         ▲                  │             │
│         │                  ▼             │
│         │           ┌────────────┐       │
│         └───────────│  Feedback  │       │
│                     └────────────┘       │
│                                          │
│    Loop until: quality threshold OR      │
│                max iterations reached    │
└──────────────────────────────────────────┘
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Separate evaluator and generator prompts | Separation of concerns, cleaner feedback |
| Feedback MUST be specific and actionable | "Try again" doesn't help; "Fix X by doing Y" does |
| Define quantitative metrics where possible | Enables objective threshold checking |
| Hard-cap iterations at 5 | Diminishing returns after 2-3 iterations |

---

## Evaluator Prompt Template

```
Evaluate the following output against these criteria:
{criteria_list}

For each criterion, provide:
- Score (1-5)
- Specific deficiency (if any)
- Concrete improvement suggestion

Output: {generated_content}
```

---

## Quality Criteria Examples

| Domain | Criteria |
|--------|----------|
| Code | Correctness, readability, efficiency, test coverage |
| Writing | Clarity, accuracy, completeness, tone |
| Data analysis | Accuracy, relevance, visualization quality |
| Design | Usability, aesthetics, accessibility |

---

## Iteration Strategy

| Iteration | Focus |
|-----------|-------|
| 1 | Core correctness and completeness |
| 2 | Refinement based on specific feedback |
| 3 | Polish and edge cases |
| 4-5 | Only if threshold still not met |

---

## Generator Refinement Prompt

```
Previous output received this feedback:
{evaluator_feedback}

Specific improvements needed:
{improvement_list}

Generate an improved version that addresses ALL feedback points.
Maintain strengths from the previous version.
```

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Vague feedback | Require specific, actionable suggestions |
| Oscillation (fixing A breaks B) | Track all criteria, ensure improvements don't regress |
| Over-iteration | Set hard cap, accept "good enough" |
| Evaluator hallucination | Use structured scoring, validate against examples |
