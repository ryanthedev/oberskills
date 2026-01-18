# Context Management

> **Purpose:** Manage context window as a scarce resource
> **Load when:** Building agents with long conversations, large tool outputs

## When NOT to Use

- Short interactions (few turns)
- Small context windows are not a concern
- Single-turn LLM usage

---

## The Context Budget Model

| Component | Budget % | Notes |
|-----------|----------|-------|
| System prompt | 5-10% | Core instructions, personality |
| Tool definitions | 5-15% | Scales with tool count |
| Conversation history | 30-40% | Summarize aggressively |
| Working memory | 20-30% | Current task state |
| Tool outputs | 10-20% | Truncate/summarize large outputs |
| Safety margin | 10% | Buffer for response generation |

---

## Summarization Strategies

### Progressive Summarization

| Turn Range | Strategy |
|------------|----------|
| 1-5 | Full messages retained |
| 6-15 | Summarized to key facts/decisions |
| 16+ | Compressed to essential state only |

### Hierarchical State Tracking

```json
{
  "goal": "Build a REST API for inventory management",
  "completed": [
    "Created project structure",
    "Implemented GET /items endpoint"
  ],
  "current_task": "Implement POST /items endpoint",
  "blockers": [],
  "key_decisions": [
    "Using FastAPI framework",
    "PostgreSQL for database"
  ]
}
```

---

## Tool Output Management

Large tool outputs poison context. Strategies:

| Strategy | When to Use |
|----------|-------------|
| **Truncation** | Keep first/last N lines |
| **Extraction** | Pull only goal-relevant portions |
| **Summarization** | Generate key info summary |
| **Reference** | Store externally, keep pointer |

### Implementation Pattern

```python
def manage_tool_output(output: str, max_tokens: int = 1000) -> str:
    if token_count(output) <= max_tokens:
        return output

    return f"""[Output truncated: {token_count(output)} tokens]

Key information extracted:
{extract_key_info(output)}

Full output available in working memory."""
```

---

## Context Management Checklist

| Check | Target |
|-------|--------|
| System prompt | < 10% of context |
| Summarization strategy | Defined for long conversations |
| Tool output handling | Truncation/extraction in place |
| State document | Maintained and updated |
| Safety margin | 10% preserved for generation |
