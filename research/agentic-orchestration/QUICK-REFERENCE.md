# Agentic Orchestration Quick Reference

> **Purpose:** Fast pattern selection and core principles for agentic AI systems
> **Load when:** Starting a new agentic implementation, choosing orchestration pattern

## When NOT to Use This Document

- Single-turn LLM interactions (no loops)
- Simple prompt engineering without tool use
- Non-agentic retrieval or generation tasks

---

## Pattern Selection Decision Tree

```
Is the task decomposable into independent subtasks?
├─ Yes → PARALLELIZATION (patterns/parallelization.md)
└─ No → Does the task have distinct phases?
        ├─ Yes → Does each phase need specialized handling?
        │       ├─ Yes → ROUTER-WORKER (patterns/router-worker.md)
        │       └─ No → ORCHESTRATOR-WORKERS (patterns/orchestrator-workers.md)
        └─ No → Does quality need iterative refinement?
                ├─ Yes → EVALUATOR-OPTIMIZER (patterns/evaluator-optimizer.md)
                └─ No → Simple sequential loop
```

**Add HUMAN-IN-THE-LOOP** (`patterns/human-in-the-loop.md`) when: high-stakes decisions, irreversible actions, or regulatory requirements.

---

## Pattern Overview

| Pattern | Use Case | Key Characteristic |
|---------|----------|-------------------|
| **Router-Worker** | Heterogeneous tasks needing specialized handling | Classification → dispatch |
| **Parallelization** | Independent subtasks, latency reduction | Fan-out → fan-in |
| **Orchestrator-Workers** | Complex tasks with dynamic replanning | Maintains task graph |
| **Evaluator-Optimizer** | Quality-critical iterative refinement | Generate → evaluate → feedback loop |
| **Human-in-the-Loop** | High-stakes approval checkpoints | Pause → review → resume/modify/reject |

---

## Three Laws of Agentic Reliability

| Law | Implication |
|-----|-------------|
| **Accumulation** | 95% per-step success = 36% over 20 steps. Design for recovery. |
| **Context Degradation** | Loops fill context with noise. Summarize aggressively. |
| **Grounding** | Agents fail in vacuums. Couple to verifiable external state. |

---

## Related Documents

| Topic | File |
|-------|------|
| Detailed patterns | `patterns/*.md` |
| Tool schemas & RAG | `skills-library.md` |
| Prompt techniques | `prompt-engineering.md` |
| Context budgets | `context-management.md` |
| Testing & monitoring | `reliability.md` |
| What NOT to do | `anti-patterns.md` |
| Getting started | `implementation-blueprint.md` |
