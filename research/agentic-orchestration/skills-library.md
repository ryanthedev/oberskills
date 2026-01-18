# Skills Library: Agent Capabilities

> **Purpose:** Patterns for common agent capabilities (RAG, APIs, files, code)
> **Load when:** Implementing specific capability types in an agent

## When NOT to Use

- Designing orchestration (see `QUICK-REFERENCE.md`)
- Prompt engineering (see `prompt-engineering.md`)
- Not building agent capabilities

---

## Skill Category 1: Retrieval-Augmented Generation (RAG)

### Query Decomposition

| Complex Query | Decomposed Queries |
|---------------|-------------------|
| "Apple vs Microsoft revenue 2020-2023" | Apple revenue 2020, 2021, 2022, 2023; Microsoft revenue 2020, 2021, 2022, 2023 |
| "Compare Python and Rust for web servers" | Python web frameworks, Rust web frameworks, performance benchmarks |

### Retrieval Validation Checklist

| Check | Question |
|-------|----------|
| **Relevance** | Does content address the query? |
| **Recency** | Is information current enough? |
| **Authority** | Is source credible for this domain? |
| **Contradiction** | Do retrieved chunks conflict? |

### Citation Anchoring Pattern

```
Claim: "Revenue increased 15% YoY"
Source: chunk_id=doc_42_para_7
Confidence: HIGH (exact match)
```

---

## Skill Category 2: API Interaction

### Schema Design Principles

| Principle | Example |
|-----------|---------|
| **Rich descriptions** | "Creates calendar event. Use when user wants to schedule..." |
| **Concrete examples** | `"examples": ["Team standup", "Dentist appointment"]` |
| **Constraints** | `"minimum": 15, "maximum": 480` |
| **Sensible defaults** | `"default": 60` |
| **Format hints** | `"format": "date-time"` |

### Error Handling Table

| Error Code | Agent Response |
|------------|----------------|
| **400 Bad Request** | Self-correct parameters, retry |
| **401 Unauthorized** | Report to user, do NOT retry |
| **404 Not Found** | Verify entity exists, suggest alternatives |
| **429 Rate Limited** | Exponential backoff with jitter |
| **500 Server Error** | Retry with backoff, then fallback |

### Idempotency Pattern

```python
def safe_tool_execution(tool_name, params, execution_log):
    op_key = hash(f"{tool_name}:{json.dumps(params, sort_keys=True)}")
    if op_key in execution_log:
        return execution_log[op_key].result  # Cached
    result = execute_tool(tool_name, params)
    execution_log[op_key] = result
    return result
```

---

## Skill Category 3: Data Synthesis

### Multi-Source Reconciliation

| Condition | Confidence | Action |
|-----------|------------|--------|
| All sources agree | HIGH | Assert claim |
| Majority agrees | MODERATE | Note dissent |
| Sources split | LOW | Present all views |
| Unverifiable | FLAG | Mark explicitly |

### Structured Output Schema

```python
response_schema = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "maxLength": 500},
        "key_points": {"type": "array", "maxItems": 5},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["summary", "key_points", "confidence"]
}
```

---

## Skill Category 4: File Operations

### Transactional File Editing

| Step | Action |
|------|--------|
| 1 | READ current state |
| 2 | VALIDATE preconditions |
| 3 | CREATE checkpoint/backup |
| 4 | APPLY modifications atomically |
| 5 | VERIFY post-conditions |
| 6 | COMMIT or ROLLBACK |

### Incremental Document Building

| Phase | Focus |
|-------|-------|
| 1 | Generate outline/structure |
| 2 | Generate sections independently |
| 3 | Integration pass (transitions) |
| 4 | Polish pass (style, consistency) |

---

## Skill Category 5: Code Generation & Execution

### Test-First Pattern

| Step | Action |
|------|--------|
| 1 | Clarify requirements → acceptance criteria |
| 2 | Generate test cases FIRST |
| 3 | Generate implementation |
| 4 | Execute tests |
| 5 | If failures: analyze, patch, re-test (max 3) |
| 6 | Deliver with test suite |

### Sandboxed Execution Safety

| Operation | Policy |
|-----------|--------|
| File read | Allowed |
| File write | Constrained paths only |
| Network | Allowlisted domains only |
| Subprocess | Prohibited |
| eval/exec | Prohibited |
