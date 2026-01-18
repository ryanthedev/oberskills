# Agentic Anti-Patterns

> **Purpose:** Common mistakes to avoid when building agents
> **Load when:** Reviewing agent design, debugging failures

## When NOT to Use

- Building simple non-agentic systems
- Already have working, reliable agent

---

## Anti-Pattern Summary Table

| Anti-Pattern | Symptom | Root Cause | Solution |
|--------------|---------|------------|----------|
| **God Prompt** | Single massive prompt handling every scenario | Cognitive overload, instruction failures | Decompose into focused role-specific prompts |
| **Optimistic Tool Assumptions** | No error handling, crashes on failures | Assuming tools always succeed | Defensive programming with explicit error paths |
| **Context Amnesia** | Re-asks clarified questions, forgets decisions | State not persisted across iterations | Explicit state tracking document, updated each turn |
| **Infinite Optimism** | Keeps trying without progress | No stuck detection | Progress tracking with loop detection |
| **Tool Hoarding** | Dozens of tools defined "just in case" | Selection confusion, more errors | Minimal viable toolset, meta-tool for expansion |
| **Ignoring Partial Success** | Any error = complete failure | Loses valid work on late failures | Checkpoint intermediate results |
| **Premature Abstraction** | "Generic" framework before understanding needs | Over-engineered, poor fit | Build 3 specific agents, then extract patterns |

---

## Detailed Prevention Strategies

### God Prompt

```
❌ BAD: One 5000-token prompt covering research, writing,
        editing, and publishing

✓ GOOD: Separate prompts for Researcher, Writer, Editor, Publisher
        with clear handoff protocols
```

### Optimistic Tool Assumptions

```python
# ❌ BAD
result = call_tool(params)
use_result(result)

# ✓ GOOD
result = call_tool(params)
if result.is_error:
    if result.is_retryable:
        result = retry_with_backoff(call_tool, params)
    else:
        return fallback_strategy(params)
use_result(result)
```

### Context Amnesia

```markdown
# Maintain running state document:
## Decisions Made
- Using Python 3.11 (confirmed turn 3)
- Target audience: beginners (confirmed turn 5)

## Facts Gathered
- API rate limit: 100/min
- File size limit: 10MB

## Current Focus
Building authentication module
```

### Infinite Optimism

```python
progress_tracker = {"last_3_states": [], "stuck_threshold": 3}

def detect_stuck(current_state):
    tracker["last_3_states"].append(hash(current_state))
    if len(set(tracker["last_3_states"][-3:])) == 1:
        raise StuckException("No progress in 3 iterations")
```

### Tool Hoarding

```
❌ BAD: 50 tools defined upfront

✓ GOOD: 5-10 core tools, with meta-tool to request additional
        capabilities when needed
```

### Ignoring Partial Success

```python
def robust_pipeline(tasks):
    results = []
    for task in tasks:
        try:
            result = execute(task)
            results.append({"task": task, "status": "success", "data": result})
            save_checkpoint(results)  # Persist partial progress
        except Exception as e:
            results.append({"task": task, "status": "failed", "error": str(e)})
    return results  # Return all results, not just failures
```

### Premature Abstraction

```
Iteration 1: Build CustomerSupportAgent (specific)
Iteration 2: Build ResearchAgent (specific)
Iteration 3: Build CodingAgent (specific)
Iteration 4: NOW extract common AgentBase framework
```
