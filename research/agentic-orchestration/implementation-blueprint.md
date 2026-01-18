# Implementation Blueprint

> **Purpose:** Step-by-step guide for building an agentic system
> **Load when:** Starting a new agent implementation from scratch

## When NOT to Use

- Extending existing agent (focus on specific components)
- Already have implementation experience
- Just exploring concepts (see `QUICK-REFERENCE.md`)

---

## Phase 1: Foundation

| Step | Action | Deliverable |
|------|--------|-------------|
| 1 | Define success clearly | Written acceptance criteria |
| 2 | Identify required tools | Minimal viable toolset |
| 3 | Design state schema | State persistence structure |
| 4 | Establish termination criteria | Explicit stop conditions |

---

## Phase 2: Core Loop

```python
def agent_loop(goal: str, max_iterations: int = 20) -> Result:
    state = initialize_state(goal)

    for i in range(max_iterations):
        # 1. Observe
        observation = gather_context(state)

        # 2. Think
        plan = reason_about_next_step(state, observation)

        # 3. Act
        action_result = execute_action(plan.next_action)

        # 4. Update
        state = update_state(state, action_result)

        # 5. Check termination
        if state.is_complete or state.is_failed:
            break

    return finalize(state)
```

---

## Phase 3: Reliability Layer

| Task | Purpose |
|------|---------|
| Add error handling to all tool calls | Prevent crashes |
| Implement retry with exponential backoff | Handle transient failures |
| Add context summarization | Prevent overflow |
| Implement stuck detection | Prevent infinite loops |
| Add observability/logging | Enable debugging |

---

## Phase 4: Evaluation

| Task | Purpose |
|------|---------|
| Build test suite (happy path + edge cases) | Catch regressions |
| Implement LLM-as-judge evaluation | Automated quality assessment |
| Benchmark against baseline | Measure improvement |
| Identify failure modes and iterate | Continuous improvement |

---

## Phase 5: Hardening

| Task | Purpose |
|------|---------|
| Add human-in-the-loop checkpoints | Safety for risky actions |
| Implement graceful degradation | Handle partial failures |
| Add monitoring and alerting | Production visibility |
| Document failure modes | Team knowledge |

---

## Tool Schema Checklist

| Requirement | Status |
|-------------|--------|
| Description explains WHEN to use | [ ] |
| All parameters have descriptions + examples | [ ] |
| Required vs optional clearly specified | [ ] |
| Constraints (min, max, enum) added | [ ] |
| Error response format documented | [ ] |
| Rate limits and quotas noted | [ ] |

---

## Pre-Launch Checklist

| Category | Check | Status |
|----------|-------|--------|
| **Testing** | Happy path tested end-to-end | [ ] |
| **Testing** | Error recovery tested for each tool | [ ] |
| **Safety** | Stuck detection verified | [ ] |
| **Safety** | Maximum iteration limit set | [ ] |
| **Safety** | Human escalation path defined | [ ] |
| **Operations** | Monitoring dashboards configured | [ ] |
| **Operations** | Rollback procedure documented | [ ] |
