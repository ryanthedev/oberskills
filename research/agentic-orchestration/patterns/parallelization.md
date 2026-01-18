# Parallelization Pattern

> **Purpose:** Execute independent subtasks simultaneously to reduce latency
> **Load when:** Tasks can be decomposed into independent units, speed matters

## When NOT to Use

- Subtasks have data dependencies
- Order of execution matters
- Single sequential task (no decomposition possible)

---

## Architecture

```
         ┌─────────────┐
         │ Orchestrator│
         └──────┬──────┘
                │ Fan-out
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐   ┌───────┐   ┌───────┐
│Task A │   │Task B │   │Task C │  ← Parallel execution
└───┬───┘   └───┬───┘   └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │ Fan-in
         ┌──────▼──────┐
         │  Aggregator │
         └─────────────┘
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Tasks MUST be independent | No shared state or data dependencies |
| Handle partial failures | Aggregation continues even if some tasks fail |
| Set per-task timeouts | Prevent stragglers from blocking completion |
| Consider "first-N" aggregation | For redundant tasks, use first N successful results |

---

## Example Use Cases

- Multi-source research (search multiple databases)
- Bulk data processing (transform many records)
- Ensemble reasoning (multiple approaches to same problem)
- Validation checks (run multiple validators in parallel)

---

## Aggregation Strategies

| Strategy | Use When |
|----------|----------|
| **All-or-nothing** | Every result required for valid output |
| **Best-effort** | Partial results acceptable |
| **First-N** | Redundant tasks, need only N successes |
| **Voting/Consensus** | Ensemble approaches, majority wins |

---

## Aggregator Prompt Template

```
You have received results from parallel tasks.

Task results:
{task_results}

Failed tasks (if any):
{failed_tasks}

Synthesize these results into a coherent response:
1. Merge non-conflicting information
2. Resolve conflicts by {conflict_strategy}
3. Note any gaps from failed tasks
4. Provide confidence level based on result coverage
```

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Hidden dependencies | Audit tasks for shared state before parallelizing |
| Straggler blocking | Use timeouts, proceed without slow tasks |
| Aggregation complexity | Design simple merge logic, test edge cases |
| Resource exhaustion | Limit concurrent tasks, implement backpressure |
