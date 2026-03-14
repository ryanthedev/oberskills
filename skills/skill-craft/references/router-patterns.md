# Router Patterns for Multi-Skill Systems

> Load when building skill sets that need classification before execution

---

## When to Use a Router

| Signal | Router Needed |
|--------|---------------|
| Tasks require classification before execution | Yes |
| Multiple specialized handlers | Yes |
| Confidence thresholds matter | Yes |
| All tasks need same handler | No (use simple loop) |
| Task classification is ambiguous | Maybe (consider orchestrator) |

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

## Directory Structure

```
skill-family/
├── router/
│   └── SKILL.md           # Classification + routing
├── worker-a/
│   └── SKILL.md           # Specialized handler A
├── worker-b/
│   └── SKILL.md           # Specialized handler B
├── worker-c/
│   └── SKILL.md           # Specialized handler C
└── shared/
    └── references/        # Common reference material
        ├── schemas.md
        └── patterns.md
```

---

## Router SKILL.md Template

```markdown
---
name: [family]-router
description: Routes [domain] requests to specialized handlers. Use when [trigger]. Classifies request type and dispatches to appropriate worker skill.
---

# [Family] Router

## Classification Rules

| Pattern | Route To | Confidence |
|---------|----------|------------|
| [pattern-1] | worker-a | High |
| [pattern-2] | worker-b | High |
| [pattern-3] | worker-c | Medium |
| Unclear | fallback | Low |

## Routing Workflow

1. Analyze request intent
2. Match against classification rules
3. If confidence < 0.7 → use fallback
4. Load appropriate worker skill
5. Execute worker workflow

## Fallback Handling

When classification is ambiguous:
1. Ask clarifying question
2. Present options with brief descriptions
3. Route based on user selection
```

---

## Worker SKILL.md Template

```markdown
---
name: [family]-[specialty]
description: Handles [specific domain]. Use when router classifies as [type]. Specialized for [capability].
---

# [Specialty] Worker

## Triggers

Routed here when:
- [condition-1]
- [condition-2]

## Workflow

[Specialized workflow for this domain]

## Handoff

If task requires different specialty:
- Signal router with: "[different-type] detected"
- Router will re-route appropriately
```

---

## Implementation Principles

| Principle | Rationale |
|-----------|-----------|
| Router = classification only | Don't mix routing with execution |
| Workers = stateless, single-purpose | Clean composition and testing |
| Always include fallback | Handles unclassified gracefully |
| Use confidence thresholds | Prevents misrouting on ambiguity |

---

## Common Failures

| Failure | Prevention |
|---------|------------|
| Misclassification cascades | Confidence thresholds + fallback |
| Router prompt too complex | Keep classification simple |
| Missing handler coverage | Audit all intents, ensure fallback |
| Workers too interdependent | Each worker should be autonomous |

---

## Example: Document Processing Router

```markdown
---
name: docs-router
description: Routes document requests to format-specific handlers. Use when working with documents, files, or formats. Classifies by file type and dispatches to pdf, docx, or xlsx worker.
---

# Document Router

## Classification

| Extension/Context | Worker |
|-------------------|--------|
| .pdf, "PDF", "portable document" | docs-pdf |
| .docx, .doc, "Word", "document" | docs-docx |
| .xlsx, .xls, "spreadsheet", "Excel" | docs-xlsx |
| Unknown format | Ask user |

## Workflow

1. Identify file type from:
   - File extension
   - User mention of format
   - Content inspection
2. Route to appropriate worker
3. If ambiguous: "What format is this file?"
```

---

## Testing Routers

| Test | Method |
|------|--------|
| Classification accuracy | 10+ samples per category |
| Edge cases | Ambiguous inputs |
| Fallback behavior | Unknown/mixed types |
| Re-routing | Mid-task specialty change |
