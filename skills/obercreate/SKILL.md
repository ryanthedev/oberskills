---
name: obercreate
description: Create and review skills and agent prompts.
---

# Skill: obercreate

**On load:** Read `../../.claude-plugin/plugin.json` from this skill's base directory. Display `obercreate v{version}` before proceeding.

Create or review skills and agent prompts with checklist-driven quality gates.

---

## Mode Selection

| User Intent | Mode | Workflow |
|-------------|------|----------|
| "create skill", "build skill", "make skill for X" | CREATE | INTAKE → DESIGN → BUILD → TEST → SHIP |
| "review skill", "audit skill", "check skill" | REVIEW-SKILL | Load `references/review-skill.md` |
| "review prompt", "audit agent", "check agent prompt" | REVIEW-PROMPT | Load `references/review-prompt.md` |

**If unclear:** Ask "Are you creating something new or reviewing something existing?"

---

# CREATE Mode

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
[Action verb] + [what it does] + [scope].
Use when [trigger conditions].
Triggers on [quoted keyword phrases].
```

**Good:** "Meta-skill for creating AND reviewing production-quality skills and agent prompts. Use when creating new skills, reviewing existing skills for quality, or auditing agent prompts for issues. Triggers on "create skill", "review skill", "audit agent"."

**Bad:** "Helps with testing."

### 3.4 Description Optimization (Recommended)

After writing the description, optimize trigger accuracy:

```bash
python scripts/optimize_description.py --skill-path <path> --model <model-id>
```

Generates 20 eval queries, splits train/test, iterates up to 5 rounds. Selects best description by held-out test score. Claude under-triggers skills — make descriptions aggressively specific about when to activate.

For manual trigger checking: `python scripts/run_trigger_eval.py --eval-set queries.json --skill-path <path>`

**Gate:** SKILL.md written + resources created + description optimized (or manually verified)

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

### 4.1b Eval Infrastructure (Recommended)

For automated testing, use the eval pipeline:

1. Define evals in `evals/evals.json` (see `references/schemas.md`)
2. Spawn with-skill and without-skill subagents for each eval
3. Grade with `agents/grader.md` (checks correctness AND pressure compliance)
4. Review with `scripts/generate_review.py <workspace>/iteration-N`
5. Aggregate with `scripts/aggregate_benchmark.py <workspace>/iteration-N --skill-name <name>`
6. For A/B comparison: dispatch `agents/comparator.md` with two outputs

Workspace layout: `<skill>-workspace/iteration-N/eval-NAME/{with_skill,without_skill}/`

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

### 5.2 Validate and Package

```bash
# Pre-ship validation
python scripts/quick_validate.py <path/to/skill>

# Package into .skill file
python scripts/package_skill.py <path/to/skill>
```

**Gate:** .skill file ready for distribution

---

## Anti-Rationalization Table

### CREATE Mode
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
| "Manual testing is enough, skip the eval pipeline" | Manual testing misses what automated runs catch at scale |
| "The eval infrastructure is optional tooling" | It is recommended. Skipping it means less evidence of quality |

### REVIEW Mode
| Rationalization | Reality |
|-----------------|---------|
| "The skill works, no need to review" | Working ≠ quality. Review catches drift and rot |
| "I wrote it, I know what's wrong" | Author blindness is real. Fresh eyes find issues |
| "Review is just testing again" | Review audits design decisions, not just behavior |
| "Quick glance is enough" | Quick glance misses structure and pressure resistance |
| "The prompt is short, no issues" | Short prompts often miss constraints and edge cases |
| "Security testing is overkill" | Internal prompts often have elevated permissions |

---

## Integration

- **oberprompt**: Apply for refining skill descriptions and instructions
- **oberagent**: Invoke before dispatching subagents during TEST phase
- **code-foundations:whiteboarding**: Use for complex skill sets requiring architecture decisions
- **External:** Scripts in `scripts/` invoke `claude -p` via subprocess. The `claude` CLI must be installed and on PATH.

---

## Reference Files

| File | Purpose |
|------|---------|
| `agents/grader.md` | Grade eval outputs + check pressure compliance |
| `agents/analyzer.md` | Post-hoc comparison analysis or benchmark pattern analysis |
| `agents/comparator.md` | Blind A/B comparison between two outputs |
| `references/schemas.md` | JSON schemas for all data formats |
| `references/testing-protocol.md` | Full testing protocol with pressure blocks |
| `references/review-skill.md` | Skill review checklist |
| `references/review-prompt.md` | Prompt/agent review checklist |
| `references/router-patterns.md` | Multi-skill router architecture |
| `scripts/optimize_description.py` | Automated description optimization loop |
| `scripts/run_trigger_eval.py` | Standalone trigger accuracy checker |
| `scripts/aggregate_benchmark.py` | Aggregate grading results into benchmarks |
| `scripts/generate_review.py` | Generate HTML review page for eval results |
| `scripts/quick_validate.py` | Pre-ship validation checks |
| `scripts/package_skill.py` | Validate and package into .skill file |

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
