# Phase Templates Reference

This document contains phase and document templates for oberplan.

---

## Phase Template

```markdown
## Phase N: [Name]

**Objective:** [What this phase accomplishes]

**Agent:** [agent-type] with [relevant skills]

**Inputs:** [What this phase needs to start]

**Outputs:** [Concrete deliverables]

**Validation:** [How to verify success]

**Dependencies:** [What must complete first]
```

---

## Document Format

The final plan document follows this structure:

```markdown
# Plan: [Title]

## Objective
[Single sentence]

## Phases

### Phase 1: [Name]
- **Agent:** [type] | **Skills:** [list]
- **Prompt:** [exact prompt for agent dispatch]
- **Inputs:** [what agent receives]
- **Outputs:** [what agent produces]
- **Validation:** [how to verify]

### Checkpoint: [Name]
- **Type:** [Code Review | Test Validation | Integration Check | Build Gate]
- **Pass Criteria:**
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]
- **If Fails:** Return to Phase 1

### Phase 2: [Name]
[...]

## Execution Order
[Dependency graph showing phases AND checkpoints]

## Risk Register
| Risk | Likelihood | Mitigation |
|------|------------|------------|

## Assumptions
- [List of assumptions]
```
