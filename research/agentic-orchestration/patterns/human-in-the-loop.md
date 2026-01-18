# Human-in-the-Loop Pattern

> **Purpose:** High-stakes decisions requiring human approval or correction
> **Load when:** Irreversible actions, regulatory requirements, safety-critical operations

## When NOT to Use

- Low-risk, reversible operations
- Speed is critical and risk is acceptable
- Fully automated pipelines with no human oversight need

---

## Architecture

```
┌───────┐    ┌───────────┐    ┌─────────┐
│ Agent │───►│ Checkpoint│───►│  Human  │
└───────┘    │  (pause)  │    │ Review  │
             └───────────┘    └────┬────┘
                                   │
              ┌────────────────────┘
              ▼
        ┌──────────┐
        │ Approved │──► Continue execution
        ├──────────┤
        │ Modified │──► Inject correction, continue
        ├──────────┤
        │ Rejected │──► Rollback, replan
        └──────────┘
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Serialize agent state at checkpoint | Enable resumption after human review |
| Present: action, rationale, alternatives | Give human full context for decision |
| Support partial approval | Approve some actions, modify others |
| Define timeout behavior | Default-deny (safe) or default-approve (low-risk) |

---

## Checkpoint Presentation

| Element | Purpose |
|---------|---------|
| **Proposed action** | What the agent wants to do |
| **Rationale** | Why this action was chosen |
| **Alternatives considered** | What else was evaluated |
| **Risk assessment** | Potential negative outcomes |
| **Reversibility** | Can this be undone? |

---

## Human Response Handling

| Response | Agent Action |
|----------|--------------|
| **Approved** | Execute proposed action, continue |
| **Modified** | Execute modified version, update state |
| **Rejected** | Do not execute, trigger replan |
| **Escalated** | Pause for higher authority |
| **Timeout** | Apply default policy |

---

## Timeout Policies

| Risk Level | Default | Rationale |
|------------|---------|-----------|
| Safety-critical | Deny | Err on side of caution |
| Data modification | Deny | Preserve data integrity |
| Read-only operations | Approve | Low risk, high friction otherwise |
| User-initiated actions | Approve | User intent already expressed |

---

## State Serialization Requirements

```python
checkpoint_state = {
    "conversation_id": str,
    "step_number": int,
    "goal": str,
    "completed_steps": list,
    "proposed_action": dict,
    "context_snapshot": str,
    "rollback_instructions": str
}
```

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Checkpoint fatigue | Reduce checkpoint frequency, batch low-risk items |
| Incomplete state | Ensure full serializability before checkpoint |
| Lost modifications | Apply human edits to state, not just action |
| Unclear presentation | Use structured format, highlight key info |
