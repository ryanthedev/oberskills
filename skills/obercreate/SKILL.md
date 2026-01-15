---
name: obercreate
description: Meta-skill for creating production-quality skills. Use when user wants to create a new skill, convert workflows into skills, or build multi-skill systems with routing. Triggers on "create skill", "build skill", "make me a skill", "skill for X", "convert to skill", "automate this workflow". Guides through checklist-driven creation with integrated pressure testing. Outputs single skills OR skill sets with router.
---

# Skill: obercreate

```
INTAKE → DESIGN → BUILD → TEST → SHIP
```

Checklist-driven skill creation with built-in quality gates.

---

## Decision: Single vs Multi-Skill

| Signal | Output |
|--------|--------|
| One clear workflow | Single skill |
| Multiple distinct domains | Skill set + router |
| "And" appears 3+ times in description | Split into skills + router |
| Classification needed before execution | Router-worker pattern |

**If uncertain:** Start single, split later. Premature routing adds complexity.

---

## Phase 1: INTAKE

**Checklist:**
- [ ] What problem does this solve?
- [ ] What triggers this skill? (3+ concrete phrases)
- [ ] Can Claude already do this well? → Don't build
- [ ] Will this be used 5+ times? → Proceed
- [ ] Can you teach a human with docs? → Proceed as skill

**Questions to ask user:**
1. "Show me an example of what you want automated"
2. "What would you say to trigger this?"
3. "What's the minimum viable output?"

**Gate:** Clear problem statement + 3+ trigger phrases + example workflow

---

## Phase 2: DESIGN

### 2.1 Structure Decision

| Content Type | Location |
|--------------|----------|
| Core workflow (<100 lines) | SKILL.md body |
| Detailed reference (>100 lines) | references/*.md |
| Deterministic operations | scripts/*.py |
| Output templates | assets/* |

### 2.2 Freedom Spectrum

| Task Type | Freedom Level | Format |
|-----------|---------------|--------|
| Research/analysis | High | Text guidance |
| Workflow with variations | Medium | Pseudocode |
| Fragile/error-prone | Low | Specific scripts |

### 2.3 Multi-Skill Router (if needed)

**When to add router:**
- Tasks need classification before execution
- Multiple specialized handlers exist
- Confidence thresholds matter

**Router structure:**
```
skill-family/
├── router/
│   └── SKILL.md (classifies → routes)
├── worker-a/
│   └── SKILL.md
├── worker-b/
│   └── SKILL.md
└── shared/
    └── references/
```

See `references/router-patterns.md` for implementation.

**Gate:** File structure planned + freedom levels assigned

---

## Phase 3: BUILD

### 3.1 SKILL.md Template

```markdown
---
name: lowercase-with-hyphens
description: [Action verb] + [what it does]. Use when [triggers]. Produces [output].
---

# Skill Name

## Quick Reference
[Decision table or routing logic]

## Workflow
[Step-by-step, imperative form]

## Examples
[Concrete, runnable]

## Common Mistakes
[Anti-rationalization table if discipline-enforcing]
```

### 3.2 Quality Constraints

| Element | Constraint |
|---------|------------|
| Name | ≤64 chars, lowercase-hyphens |
| Description | ≤1024 chars, 3rd person, action verb |
| SKILL.md | ≤500 lines, ≤5000 words |
| References | One level deep only |

### 3.3 Description Engineering

**Formula:**
```
[Action verb] + [capability] + [output].
Use when [conditions].
Triggers on [keywords].
```

**Good:** "Analyzes test suites for flaky tests. Use when reviewing coverage or debugging intermittent failures. Triggers on: test reliability, flaky, coverage gaps."

**Bad:** "Helps with testing."

**Gate:** SKILL.md written + resources created

---

## Phase 4: TEST

**All tests run via fresh subagent** - no prior context contamination.

See `references/testing-protocol.md` for full templates.

### 4.1 Trigger Tests

| # | Prompt | Would Trigger? | Match |
|---|--------|----------------|-------|
| 1 | [natural request] | Yes/No | [keywords] |
| 2-5 | ... | ... | ... |

**Result:** X/5 pass. Note false positives/negatives.

### 4.2 Baseline (RED)

Spawn subagent WITHOUT skill. Record:
- **Approach taken:** [what Claude did]
- **Rationalizations (verbatim):** "[exact quotes]"
- **Shortcuts:** [what was skipped]

### 4.3 Compliance (GREEN)

Spawn subagent WITH skill + pressure scenario.

**Pressure cocktail (combine 3+):** Time, Sunk Cost, Authority, Economic, Social, Simplicity

**Record:**
- Did Claude follow workflow? [Y/N]
- Rationalizations resisted
- Key quotes showing compliance

**Comparison table:**
| Aspect | Baseline | With Skill |
|--------|----------|------------|

**Verdict:** ✅ PASS / ❌ FAIL

### 4.4 Loophole Closing (REFACTOR)

Meta-test: *"What rationalizations could bypass this skill?"*

**Record:**
- New rationalizations found
- Technical compliance loopholes
- Ambiguous scenarios

**Fix and re-test until bulletproof.**

### 4.5 TEST FAILURE Protocol

If any test fails:
1. Root cause analysis (what assumption broke?)
2. Fix skill
3. Re-run ALL tests from 4.1 (no partial retests)
4. Max 3 iterations - abort and redesign if still failing

### Definitions

- **Fresh subagent:** New session, no conversation history, skill-only context
- **Pass criteria:** 100% workflow adherence under 3+ realistic pressure factors
- **Bulletproof:** Zero new loopholes found across 2+ test iterations

**Gate:** All tests pass, loopholes closed

---

## Phase 5: SHIP

### 5.1 Pre-Ship Checklist

**Metadata:**
- [ ] Name is lowercase-with-hyphens, ≤64 chars
- [ ] Description ≤1024 chars, 3rd person, has triggers
- [ ] No extra frontmatter fields

**Structure:**
- [ ] SKILL.md ≤500 lines
- [ ] References one level deep
- [ ] No README.md or CHANGELOG.md (skills don't need these)

**Content:**
- [ ] Uses imperative/infinitive form
- [ ] Critical rules in first 20% of SKILL.md
- [ ] Examples are concrete and runnable
- [ ] Anti-rationalization table (if discipline-enforcing)

**Testing:**
- [ ] Baseline documented
- [ ] Compliance verified under pressure
- [ ] Loopholes closed

### 5.2 Package

```bash
# If using skill-creator scripts
scripts/package_skill.py <path/to/skill>
```

**Gate:** .skill file ready for distribution

---

## Anti-Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "This skill is simple, skip testing" | Simple skills still fail under pressure |
| "I'll add description later" | Description IS the skill's advertisement |
| "One big skill is easier" | Multi-skill with router scales better |
| "Users will figure out triggers" | Explicit triggers = reliable activation |
| "Testing is overkill for internal use" | Internal skills get the least scrutiny |
| "This is just a prototype" | Prototypes become permanent - test now or never |
| "User is waiting, ship and iterate" | Iteration requires baseline - complete Phase 4 first |
| "Similar to skill X, inherits quality" | Similar ≠ tested. Every skill needs pressure testing |
| "I tested it mentally while writing" | Mental testing cannot capture rationalization patterns |
| "User said skip testing" | User owns outcome, not process. Testing protects both |

---

## Integration

- **oberplan**: Use for complex skill sets requiring architecture decisions
- **oberdebug**: Switch if skill misbehaves in production
- **oberprompt**: Apply for refining skill descriptions and instructions

---

## Quick Reference: Skill Patterns

| Pattern | Use When | Key Feature |
|---------|----------|-------------|
| Decision Routing | Multiple subtasks | Front-loads branching |
| Phased Workflow | Multi-step dependencies | Explicit checkpoints |
| Severity Matrix | Analysis/triage | Classification tables |
| Anti-Rationalization | Discipline enforcement | Closes loopholes |
| Router-Worker | Heterogeneous tasks | Classification → specialized handling |

---

## Examples

### Example 1: Simple Skill

```
User: "Create a skill for reviewing PRs"

INTAKE:
- Problem: Inconsistent PR review quality
- Triggers: "review PR", "check this PR", "PR feedback"
- 5+ uses: Yes, daily task

DESIGN:
- Single skill (one workflow)
- Medium freedom (checklist, some flexibility)
- No router needed

BUILD: [Write SKILL.md with checklist workflow]

TEST: Pressure test with "just glance at it, we need to ship"

SHIP: Package and deploy
```

### Example 2: Multi-Skill with Router

```
User: "Create skills for document processing - PDFs, Word docs, and spreadsheets"

INTAKE:
- Problem: Different formats need different handling
- Triggers: Format-specific ("edit PDF", "create spreadsheet")
- Clearly distinct domains → Router needed

DESIGN:
- Router skill (classifies format)
- Worker skills (pdf-processor, docx-processor, xlsx-processor)
- Shared references (common formatting patterns)

BUILD:
document-processing/
├── router/SKILL.md
├── pdf/SKILL.md
├── docx/SKILL.md
├── xlsx/SKILL.md
└── shared/references/

TEST: Each worker + router classification accuracy

SHIP: Package as skill family
```
