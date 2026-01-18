# Claude Skills Best Practices Framework

> **Purpose:** Decision framework for when and how to create Claude skills
> **Load when:** Creating a new skill, reviewing skill PRs, deciding skill vs tool vs MCP

---

## The Three Iron Laws

| # | Law | Consequence of Violation |
|---|-----|-------------------------|
| **1** | SKILL.md under 500 lines; description under 1,024 chars | Context overwhelm; instructions ignored |
| **2** | Descriptions in third person ("Analyzes...", not "I analyze...") | Becomes system prompt context incorrectly |
| **3** | Test with pressure scenarios before deploying | Loopholes discovered in production |

---

## When NOT to Use This Document

| Situation | Instead |
|-----------|---------|
| Building an MCP server | See MCP documentation |
| Writing a one-off prompt | Just prompt Claude directly |
| Adding project-specific rules | Use CLAUDE.md |
| Claude already does this well natively | Don't create anything |

---

## Decision Tree: Should This Be a Skill?

```
START: "I want Claude to do X"
│
├─ Can Claude already do this well with a simple prompt?
│   └─ YES → Don't create anything
│
├─ Does it require external API/database access?
│   └─ YES → Create MCP server
│
├─ Is it a one-time task?
│   └─ YES → Write a prompt
│
├─ Is it procedural knowledge that could be documented?
│   └─ NO → Consider MCP server or tool
│
├─ The 5-10 Rule: Done 5+ times? Will do 10+ more?
│   └─ NO → Just prompt; maybe skill later
│
└─ The Teachable Test: Could you teach a human with docs?
    └─ YES → CREATE A SKILL
    └─ NO → Needs infrastructure (MCP), not knowledge (skill)
```

---

## Skill vs Tool vs MCP Server

| Concept | What It Does | When to Use | Example |
|---------|--------------|-------------|---------|
| **Skill** | Loads instructions as context | Repeatable workflows, domain expertise | `docx` for Word documents |
| **Tool** | Executes and returns results | Discrete operations, clear I/O | `web_fetch` for URLs |
| **MCP Server** | Connects to external services | API access, database queries | Slack posting |
| **Prompt** | One-off conversation instruction | Single-use tasks | "Summarize in 3 bullets" |
| **CLAUDE.md** | Static background always loaded | Persistent project context | Coding standards |

**Key insight:** MCP gives Claude access to tools; Skills teach Claude *how to use them effectively*.

---

## SKILL.md Structure

### Required Frontmatter

| Field | Constraint | Example |
|-------|------------|---------|
| `name` | Max 64 chars, lowercase-hyphens, gerund preferred | `analyzing-excel-data` |
| `description` | Max 1,024 chars, 3rd person, includes "Use when..." | "Analyzes financial data. Use when working with .xlsx files or pivot tables." |

### Optional Frontmatter

| Field | Purpose |
|-------|---------|
| `dependencies` | Required software (e.g., `python>=3.8, pandas>=1.5.0`) |
| `allowed-tools` | Limit tools Claude can use when active |
| `mode` | Boolean; `true` = behavior-modifying mode |

### Standard Template

```markdown
---
name: lowercase-with-hyphens
description: Use when [trigger]. Does [capability].
---

# Skill Name

## When to Use
- [Trigger 1]
- [Trigger 2]

## Core Workflow
[Step-by-step instructions]

## Examples
[Concrete, runnable]

## Common Mistakes
[Loopholes to close]
```

---

## File Organization

```
skill-name/
├── SKILL.md           # Required (<500 lines)
├── reference.md       # Detailed docs (loaded on demand)
├── scripts/           # Deterministic operations
├── templates/         # Starting point files
└── assets/            # Binary files (fonts, images)
```

| Folder | Strategy |
|--------|----------|
| /scripts | Parameterizable, robust, handles errors |
| /references | Read on-demand to save tokens |
| /assets | Templates for generating/comparing output |
| /examples | Multi-shot "gold standard" demonstrations |

---

## Progressive Disclosure Architecture

| Level | Content | Token Impact |
|-------|---------|--------------|
| **1 (Metadata)** | `name` + `description` for all skills | ~100 tokens/skill at startup |
| **2 (SKILL.md)** | Full instructions when skill invoked | Variable; target <500 lines |
| **3+ (References)** | Loaded only when Claude needs them | Zero until accessed |

**Implication:** Descriptions must be rich for discovery; instructions use progressive disclosure.

---

## Pattern Catalog

> **Skip this section if:** You know which pattern to use. Jump to Quality Checklist.

### Pattern Selection Matrix

| Pattern | Use When | NOT When | Key Technique |
|---------|----------|----------|---------------|
| **Document Generation** | Binary formats (Office, PDF), Track Changes needed | Simple text; good library exists | Pack/unpack scripts for XML formats |
| **Code Transformation (TDD)** | Enforcing methodology, preventing shortcuts | One-off transformation, Claude default adequate | Rationalization tables, iron laws |
| **Research/Analysis** | Multi-phase investigation, iterative refinement | Single-pass analysis, simple fact-finding | Staged workflows with decision points |
| **Multi-Step Workflow** | Complex orchestration, context isolation needed | Simple linear tasks, small atomic changes | Controller-subagent with quality gates |
| **Compositional** | Layered workflows combining multiple skills | Single focused skill would be clearer | REQUIRED SUB-SKILL markers |

### Pattern Details

#### Document Generation (The Redlining Pattern)
- **Example:** `docx` skill with pack/unpack scripts
- **Structure:** Decision routing in SKILL.md → format reference in /references → scripts in /scripts
- **Mistake to avoid:** Using line numbers as anchors (they shift); use text patterns or section IDs

#### Code Transformation (TDD Cycle Pattern)
- **Example:** `test-driven-development` skill
- **Key:** Rationalization tables that anticipate and close loopholes
- **Mistake to avoid:** Agent implementing code and test simultaneously; must delete code written before failing test

#### Research/Analysis (Systematic Discovery Pattern)
- **Example:** `systematic-debugging` with four phases
- **Key:** Clear phases (gather → analyze → validate → conclude)
- **Mistake to avoid:** Fixing symptoms without tracing to root cause

#### Multi-Step Workflow (Controller-Subagent Pattern)
- **Example:** `subagent-driven-development`
- **Key:** Fresh context per task, two-stage review (spec compliance → code quality)
- **Mistake to avoid:** Passing entire codebase to every subagent; curate minimum context

#### Compositional (Required Sub-Skill Pattern)
- **Example:** `systematic-debugging` requiring `test-driven-development`
- **Key:** Explicit "REQUIRED SUB-SKILL" markers
- **Mistake to avoid:** Circular dependencies (A requires B requires A)

---

## Anti-Patterns

| Anti-Pattern | Symptom | Test | Fix |
|--------------|---------|------|-----|
| **Tool-as-Skill** | Instructions = "run command with params" | Would this be better as MCP operation? | Convert to MCP server |
| **Over-Engineered** | Trivial operation wrapped in skill infra | Could Claude do this with one sentence? | Don't create a skill |
| **Everything Skill** | Scope needs "and" multiple times | One-sentence description possible? | Split into focused skills |
| **Native Duplication** | Skill teaches what Claude already knows | Does Claude fail without skill? | Delete the skill |
| **God Prompt** | SKILL.md >500 lines, all edge cases inline | Is there progressive disclosure? | Split: SKILL.md + references/ |
| **Reference Illusion** | Broken file paths, missing references | Do all referenced files exist? | Flat structure, verify in PR |
| **Template Theater** | 200-line template, 10-line instructions | Does skill teach decision logic? | Replace templates with decision trees |

---

## Quality Checklist

> **Use when:** Reviewing skill PRs or self-checking before deployment

### Core Requirements

| Requirement | Check |
|-------------|-------|
| SKILL.md exists with valid YAML frontmatter | [ ] |
| Name: lowercase-hyphens, max 64 chars, gerund form | [ ] |
| Description: starts "Use when...", max 1,024 chars, 3rd person | [ ] |
| Content under 500 lines; under 5,000 words | [ ] |

### Teachable Test

| Question | Required |
|----------|----------|
| Could you onboard a human with this documentation? | Yes |
| Does it transform "knowing" into "doing"? | Yes |
| Is there specialized knowledge Claude lacks by default? | Yes |

### Progressive Disclosure

| Check | Verified |
|-------|----------|
| Core workflow in SKILL.md; details in reference files | [ ] |
| Reference files loaded only when needed | [ ] |
| No duplication between SKILL.md and references | [ ] |
| Cross-file references only one level deep | [ ] |

### Examples and Loopholes

| Check | Verified |
|-------|----------|
| Examples are concrete and runnable | [ ] |
| "Common Mistakes" section closes loopholes | [ ] |
| Rationalization table included (if discipline-enforcing) | [ ] |
| Stopping conditions defined | [ ] |

### Testing

| Check | Verified |
|-------|----------|
| Tested with pressure scenarios | [ ] |
| Baseline behavior documented (without skill) | [ ] |
| Claude follows instructions with skill active | [ ] |

---

## Reference Examples

| Skill | Repository | Strategy | Key Technique |
|-------|------------|----------|---------------|
| `docx` | anthropics/skills | Precise Manipulation | Progressive disclosure + pack/unpack scripts |
| `test-driven-development` | obra/superpowers | Discipline Enforcement | Rationalization tables + iron laws |
| `brainstorming` | obra/superpowers | Behavioral Constraint | One-question-at-a-time validation |
| `mcp-builder` | anthropics/skills | Dynamic Research | Fetch external specs before coding |

### Example: Rationalization Table Pattern

```markdown
## Rationalization Table
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests-after: "What does this do?" Tests-first: "What should this do?" |
| "I already manually tested" | Automated tests are systematic. |
```

### Example: Decision Routing Pattern

```markdown
## Decision Routing
- **New documents**: Use docx-js (JavaScript) - read docx-js.md
- **Editing existing**: Use OOXML manipulation - read ooxml/ooxml.md
```

---

## Freedom Spectrum

| Level | Instruction Format | When to Use |
|-------|-------------------|-------------|
| **High** | Text-based guidance | Multiple valid approaches exist |
| **Medium** | Pseudocode with parameters | Preferred pattern, some flexibility |
| **Low** | Specific scripts, few parameters | Fragile/error-prone operations |

Document generation (docx, pdf) = **Low freedom** (scripts prevent corruption)
Research skills = **High freedom** (multiple valid approaches)

---

## Skill Cross-References

**Good:** `For debugging, use the systematic-debugging skill.` (Claude decides whether to load)

**Bad:** `@skills/debugging/SKILL.md` (force-loads, burns context)

Two reference methods:
1. "REQUIRED SUB-SKILL" marker — mandatory for specific steps
2. Mentioning skill name — guidance toward complementary capability

---

## The Core Insight

Skills are **compressed expertise** that transform knowing into doing. They succeed when encoding procedural knowledge Claude lacks; they fail when duplicating native capabilities or wrapping simple tools.

Three principles separate excellent from mediocre:
1. **Progressive disclosure is non-negotiable** — context window is shared
2. **TDD applies to skills, not just code** — pressure scenarios before deployment
3. **Anticipate rationalization** — close loopholes before Claude finds them

Build skills that survive use by a thousand different Claude instances in a thousand different contexts.

---

## Additional Resources

- **Works Cited:** See `references/skill-best-practices-works-cited.md`
- **Opportunity Areas:** See `references/skill-opportunity-areas.md` for high-value skill ideas
- **Official Docs:** https://platform.claude.com/docs/en/agents-and-tools/agent-skills
