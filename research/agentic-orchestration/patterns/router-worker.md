# Router-Worker Pattern

> **Purpose:** Heterogeneous task distribution with specialized handling
> **Load when:** Tasks require classification before execution, multi-domain assistants

## When NOT to Use

- All tasks need the same handler (use simple loop)
- Task classification is ambiguous (use orchestrator-workers instead)
- Parallelization possible (use parallelization pattern)

---

## Architecture

```
┌─────────────┐
│   Router    │ ← Classifies intent, selects worker
└──────┬──────┘
       │
   ┌───┴───┬───────┬───────┐
   ▼       ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ W1  │ │ W2  │ │ W3  │ │ W4  │  ← Specialized workers
└─────┘ └─────┘ └─────┘ └─────┘
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Router = classification only | Don't mix routing logic with execution |
| Workers = stateless, single-purpose | Enables clean composition and testing |
| Always include fallback worker | Handles unclassified requests gracefully |
| Use confidence thresholds | Prevents misrouting on ambiguous inputs |

---

## Example Use Cases

- Customer service bots (billing vs. technical vs. sales)
- Multi-domain assistants (calendar vs. email vs. search)
- Code generation with language-specific handlers
- Document processing (invoice vs. contract vs. report)

---

## Router Prompt Template

```
You are a request classifier. Analyze the user's intent and select the appropriate handler.

Available handlers:
{handler_descriptions}

Output format:
{
  "selected_handler": "handler_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

If confidence < 0.7, select "fallback".
```

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Misclassification cascades | Add confidence thresholds, use fallback |
| Router prompt too complex | Keep classification simple, move logic to workers |
| Missing handler coverage | Audit all possible intents, ensure fallback exists |
