# Claude Skills Architecture Framework

---
purpose: Canonical structural reference for building production-quality Claude Skills
load-when: Creating a new skill, reviewing skill structure, or debugging activation issues
---

## Structural Constraints (MUST Follow)

> **This is the most important section.** All Skills MUST comply with these constraints.

| Element | MUST | SHOULD | MAY |
|---------|------|--------|-----|
| `name` | Be ≤64 chars, lowercase-with-hyphens | Use gerund form (e.g., "writing-tests") | Include domain prefix |
| `description` | Be ≤1024 chars, third person | Start with action verb | Include explicit trigger keywords |
| SKILL.md | Exist in skill root | Be ≤500 lines | Include decision routing |
| References | Be one level deep max | Use flat `reference/` directory | Include templates |
| Scripts | Be deterministic only | Handle errors gracefully | Include usage examples |

**Constraint Violations = Skill Failures:**
- Name >64 chars → Discovery breaks
- Description vague → Never activates (or activates incorrectly)
- SKILL.md >500 lines → Context bloat, instructions ignored
- Nested references → Claude fails to navigate
- Non-deterministic scripts → Unreliable output

---

## When NOT to Use This Document

Skip this document if you're looking for:
- **Domain expertise guidance** → This covers structure, not content
- **Activation debugging** → Check description engineering section only
- **Quick pattern lookup** → Jump to SKILL.md Structural Patterns section

---

## The Skill Equation

**Skill = Compressed Expertise + Optimal Structure + Trigger Precision**

All three matter. This document covers **structure** and **triggers**—you bring the expertise.

---

## Progressive Disclosure Architecture

Context window is a shared resource. Load only what's needed.

**Three-Level Hierarchy:**

| Level | Content | Token Impact | Loaded When |
|-------|---------|--------------|-------------|
| 1: Metadata | name + description | ~30-50 tokens | Always (session start) |
| 2: SKILL.md | Core workflow, decision routing | 200-500 lines | Skill activates |
| 3: References | Detailed docs, templates, scripts | Variable | Claude follows link |

**Directory Structure:**
```
skill-name/
├── SKILL.md              # Level 2: Core instructions (<500 lines)
├── reference/            # Level 3: On-demand detail (flat!)
│   ├── detailed-guide.md
│   └── format-specs.md
├── scripts/              # Level 3: Deterministic operations
│   └── helper.py
└── templates/            # Level 3: Starting points
    └── output-template.md
```

---

## SKILL.md Structural Patterns

> **Skip this section if** you're reviewing an existing skill (go to Quality Checklist)

### Pattern Selection Matrix

| Pattern | Use When | Key Feature |
|---------|----------|-------------|
| Decision Routing | Multiple subtasks | Front-loads branching |
| Phased Workflow | Multi-step with dependencies | Explicit checkpoints |
| Severity Matrix | Analysis/triage tasks | Transforms judgment to classification |
| Anti-Rationalization | Claude might shortcut | Closes loopholes preemptively |
| Explicit Non-Triggers | Scope confusion likely | Reduces false activations |

### Pattern 1: Decision Routing

```markdown
## Decision Routing
- **[Subtask A]**: Use [approach/file] — [rationale]
- **[Subtask B]**: Use [approach/file] — [rationale]
```

### Pattern 2: Phased Workflow

```markdown
### Phase 1: [Name]
1. [Action]
2. [Action]
3. **Checkpoint:** [What MUST be true before Phase 2]

### Phase 2: [Name]
...
```

### Pattern 3: Severity/Priority Matrix

```markdown
| Category | Severity | Action |
|----------|----------|--------|
| [Type A] | Critical | [Immediate action] |
| [Type B] | Medium | [Standard handling] |
| [Type C] | Low | [Defer or note] |
```

### Pattern 4: Anti-Rationalization Table

```markdown
| Rationalization | Reality |
|-----------------|---------|
| "[Excuse 1]" | [Why it's wrong] |
| "[Excuse 2]" | [Why it's wrong] |
```

### Pattern 5: Explicit Non-Triggers

```markdown
## When NOT to Use This Skill
- [Scenario that seems related but isn't]
- [Edge case needing different handling]
```

---

## Description Engineering

The description determines activation. Treat it as the Skill's advertisement.

**Formula:**
```
[Action verb] + [what it does] + [output].
Use when [trigger conditions].
Triggers on [keywords/scenarios].
```

| Quality | Example | Problem |
|---------|---------|---------|
| Good | "Analyzes test suites to identify flaky tests and coverage gaps. Use when reviewing test quality or debugging intermittent failures. Triggers on: test reliability, coverage reports, test suite maintenance." | None—specific activation criteria |
| Bad | "Helps with testing." | Matches everything or nothing |

---

## Reference Files

**MUST:** One level deep maximum. Claude fails to navigate nested directories.

| Use Reference Files For | Keep in SKILL.md |
|------------------------|------------------|
| Format specs (>50 lines) | Core workflow |
| Detailed examples | Decision routing |
| Domain-specific lookups | Checkpoints |
| Subtask-specific content | Anti-rationalization table |

**Reference pattern:**
```markdown
For [specific subtask], see reference/detailed-guide.md before proceeding.
```

---

## Script Integration

Scripts = deterministic operations. Output enters context; code does not.

| Good Script Candidates | Bad Script Candidates |
|-----------------------|----------------------|
| Parsing (AST, JSON, XML) | Anything requiring judgment |
| Validation (syntax, links) | Operations needing mid-process reasoning |
| Transformation (format conversion) | Tasks where "how" matters |
| Calculation (numerical) | |

---

## Testing Skills (TDD Approach)

| Step | Action | Output |
|------|--------|--------|
| 1 | Create pressure scenarios | Situations tempting shortcuts |
| 2 | Test without Skill | Document baseline (what Claude does wrong) |
| 3 | Test with Skill | Verify process followed, checkpoints hit |
| 4 | Strengthen | Add to anti-rationalization table, repeat |

**Pressure Scenario Types:**
- Time pressure: "This is urgent, just do it quickly"
- Sunk cost: "I already did it this way"
- Apparent simplicity: "This is trivial, skip the process"

---

## Pre-Deployment Audit Checklist

> **Run this checklist before deploying ANY Skill.** This is your quality gate.

### Metadata Audit

| Check | Status |
|-------|--------|
| Name is lowercase-with-hyphens | [ ] |
| Name ≤64 characters | [ ] |
| Description ≤1024 characters | [ ] |
| Description is third person | [ ] |
| Description includes trigger conditions | [ ] |
| Description includes output/outcome | [ ] |

### Structure Audit

| Check | Status |
|-------|--------|
| SKILL.md exists in root | [ ] |
| SKILL.md ≤500 lines | [ ] |
| Reference files one level deep only | [ ] |
| Decision routing at top (if multiple subtasks) | [ ] |
| Progressive disclosure used (heavy content in refs) | [ ] |

### Content Audit

| Check | Status |
|-------|--------|
| No duplication of Claude's native capabilities | [ ] |
| "When NOT to use" section present (if scope ambiguous) | [ ] |
| Anti-rationalization table (if discipline-enforcing) | [ ] |
| Checkpoints in multi-step workflows | [ ] |
| Critical rules in first 20% of SKILL.md | [ ] |
| Verification/checklist in final 10% of SKILL.md | [ ] |

### Testing Audit

| Check | Status |
|-------|--------|
| Pressure scenarios designed | [ ] |
| Baseline behavior documented (without Skill) | [ ] |
| Confirmed improvement with Skill active | [ ] |
| Loopholes closed based on test failures | [ ] |

---

## Common Anti-Patterns (Self-Check)

> **If any of these apply to your Skill, fix before deploying.**

| Anti-Pattern | Symptom | Fix |
|--------------|---------|-----|
| God Skill | Triggers on unrelated requests | Split into focused Skills |
| Wall of Text | Claude skips instructions | Use headers, tables; move to refs |
| Inline Everything | Context bloat | Progressive disclosure |
| Vague Triggers | Never activates or wrong activation | Specific description with keywords |
| Deep Nesting | Claude can't find files | Flat structure (one level) |
| Redundant Instructions | Wasted tokens | Assume competence; domain-specific only |

---

## Final Principle

A Skill is not a prompt dump. It's an architecture for loading expertise on demand.

**The best Skills are:**
- Invisible when not needed
- Precise when triggered
- Structured for efficient navigation

**Optimize for:** Activation accuracy + Context efficiency
