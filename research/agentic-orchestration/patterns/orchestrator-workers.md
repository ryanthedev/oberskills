# Orchestrator-Workers Pattern

> **Purpose:** Complex tasks requiring dynamic decomposition and adaptive replanning
> **Load when:** Task structure unclear upfront, may need mid-execution adjustments

## When NOT to Use

- Task decomposition is static and known upfront (use parallelization)
- Simple classification suffices (use router-worker)
- Single-step tasks (overkill)

---

## Architecture

```
┌─────────────────────────────────┐
│         Orchestrator            │
│  ┌─────────────────────────┐    │
│  │ 1. Decompose into plan  │    │
│  │ 2. Dispatch to workers  │◄───┼─── Feedback loop
│  │ 3. Evaluate results     │    │
│  │ 4. Replan if needed     │    │
│  └─────────────────────────┘    │
└──────────────┬──────────────────┘
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
   ┌──────┐┌──────┐┌──────┐
   │Worker││Worker││Worker│
   └──────┘└──────┘└──────┘
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Maintain explicit task graph | Not just a list—track dependencies |
| Workers report structured outcomes | Enable orchestrator to evaluate properly |
| Define replan triggers | Worker failure, new information, goal clarification |
| Set maximum replan iterations | Prevent infinite loops |

---

## Orchestrator Responsibilities

| Step | Action |
|------|--------|
| **ANALYZE** | Understand goal and current state |
| **IDENTIFY** | Determine next atomic subtask |
| **SELECT** | Choose appropriate worker |
| **EVALUATE** | Check result against acceptance criteria |
| **DECIDE** | Continue, replan, or terminate |

---

## Orchestrator Prompt Template

```
You are a task orchestrator. Your responsibilities:
1. ANALYZE the goal and current state
2. IDENTIFY the next atomic subtask
3. SELECT the appropriate worker
4. EVALUATE the result against acceptance criteria
5. DECIDE: continue, replan, or terminate

Current Goal: {goal}
Completed Steps: {step_history}
Available Workers: {worker_descriptions}
```

---

## Replan Triggers

| Trigger | Response |
|---------|----------|
| Worker failure | Retry with different approach or skip |
| New information | Update plan based on discoveries |
| Goal clarification | Adjust scope, reprioritize |
| Resource constraints | Simplify plan, reduce scope |

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Infinite replanning | Set max iteration cap |
| Lost context | Maintain explicit state document |
| Worker overload | Balance task distribution |
| Goal drift | Re-anchor to original request periodically |
