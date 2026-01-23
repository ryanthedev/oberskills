# Example: oberagent + oberprompt Model Selection

Demonstrates the complete oberagent workflow with oberprompt integration, including proper model tier selection.

## Context

User needs to catalog all testable patterns across code-foundations skills to build a comprehensive checklist.

## Transcript

```
⏺ Skill(oberskills:oberagent)
  ⎿  Successfully loaded skill

⏺ I need to follow the oberagent workflow. Let me invoke oberprompt first,
   then dispatch an exploration agent.

⏺ Skill(oberskills:oberprompt)
  ⎿  Successfully loaded skill

⏺ Good, oberprompt is loaded. Now let me complete the oberagent checklist
   for the exploration task:

  Purpose: Understand ALL testable patterns across ALL code-foundations
  skills to build a ~100 item checklist for the Ralph Wiggum loop.

  Agent Type: Explore (codebase understanding, finding patterns)

  Model: sonnet (moderate complexity - needs to understand skill structure
  but not architectural decisions)

  Skills needed: None for pure exploration

  Prompt (outcome-focused, ~2 sentences):
  Catalog every skill in ~/repos/code-foundations and extract what
  issues/patterns each skill is designed to catch. I need a comprehensive
  list of testable patterns organized by skill.

  Let me dispatch:

⏺ Explore(Catalog all code-foundations skills) Sonnet 4.5
  ⎿

     +42 more tool uses (ctrl+o to expand)
```

## What Makes This Work

| Step | What Happened | Why It Matters |
|------|---------------|----------------|
| Load oberagent | Triggered the workflow | Prevents skipping checklist |
| Load oberprompt | Step 1 of checklist | Gets constraint budget + validation criteria |
| Define purpose | Clear outcome stated | "Understand patterns to build checklist" |
| Select agent type | Explore for codebase understanding | Not general-purpose (overkill for search) |
| Select model | Sonnet, not Opus | Moderate complexity - finding patterns, not designing architecture |
| Identify skills | None needed | Pure exploration, no code writing/review |
| Write prompt | 2 sentences, outcome-focused | Follows oberprompt constraint budget |

## Model Selection Reasoning

The key insight is the explicit model reasoning:

> "sonnet (moderate complexity - needs to understand skill structure but not architectural decisions)"

This shows:
- **Why not haiku**: Task requires understanding structure, not just finding files
- **Why not opus**: Not making architectural decisions or complex trade-offs
- **Why sonnet**: Right balance for pattern recognition across a codebase

## Checklist Visibility

Notice how the checklist items are explicitly visible in the output:
- Purpose ✓
- Agent Type ✓
- Model ✓
- Skills needed ✓
- Prompt ✓

This transparency helps catch errors before dispatch.

## Skills Referenced

- [oberagent](../skills/oberagent/SKILL.md) - Agent dispatch enforcement
- [oberprompt](../skills/oberprompt/SKILL.md) - Prompt engineering principles
