# Plan: Metaprompt Skill Redesign

**Created:** 2026-03-25
**Status:** ready
**Complexity:** medium

---

## Context

Redesign the oberskills `prompt` command into a unified, research-backed metaprompt skill. The current prompt.md (413 lines) is anchored to 2023-era techniques (CoT-only flowchart, stale model tiers, no reasoning compression, no context engineering, no architectural security). We have 9 research synthesis themes distilled from 117+ papers covering prompt engineering and agentic planning. The redesign absorbs `agent.md` (dispatch workflow) and `review-prompt.md` (audit checklist), eliminating the current 3-way overlap. Serves both Claude (designing agent/skill prompts) and humans (designing product prompts).

## Constraints

- Self-contained: ships as a plugin to machines without grug or research databases
- 2 modes only: DESIGN and REVIEW
- Modular architecture: small router + focused modules loaded by task type
- ≤500 lines per file ceiling — content determines actual length
- Must apply the research principles in its own structure (practice what it preaches)

## Chosen Approach

**Small router + focused modules, composed per task.**

The command file is a lean router (~100-150 lines) that detects the task type and loads relevant modules. A principles file (~40 lines) is always loaded. Focused modules cover specific domains (reasoning, context, safety, agents, optimization, review). Each module is self-contained, ≤500 lines, sized by what the content needs.

This follows the research:
- Shorter declarative prompts generalize better (GEPA, 2507.19457: 9.2x shorter, +13%)
- Route by task type, not user self-assessment (SoT, 2503.05179)
- Monolithic context collapses — modular wins (ACE, 2510.04618)
- Skills need condition/policy/termination/interface — small composable units (2512.16301)
- Front-load critical info, 73% perf drop for middle content (2507.13334)

**Fallback:** If module routing proves unreliable, merge into fewer, larger files.

## Rejected Approaches

- **500-line monolithic command file:** Research says shorter wins. Dumping 9 themes into one file is the context collapse antipattern (ACE).
- **Keep separate skills:** Perpetuates the 3-way overlap between prompt.md, agent.md, and review-prompt.md.

---

## Implementation Phases

### Phase 1: Build the router and principles
**Model:** opus

**Goal:** Write the new `prompt.md` router command and the always-loaded `principles.md` that encodes the 9 core research findings as first principles.

**Scope:**
- IN: Command file rewrite as a task-type router. 2 modes (DESIGN, REVIEW). Task-type detection logic (keyword signals in the user request → which modules to load). Always-loaded principles file distilling 9 synthesis themes into actionable first principles. Module loading protocol using `${CLAUDE_PLUGIN_ROOT}` paths.
- OUT: Module content (Phase 2). Old file cleanup (Phase 3).

**Approach notes:**
- Router detects task type from signals in the request, not from user self-assessment — follows SoT research
- principles.md is always loaded — the seed that sets the ceiling for everything else
- Router loads 1-2 modules per task, never all of them

**File hints:**
- `commands/prompt.md` — rewrite target
- `skills/prompt/principles.md` — new file
- `commands/agent.md` — reference for dispatch workflow to absorb
- `skills/skill-craft/references/review-prompt.md` — reference for review checklist to absorb
- Research synthesis: `/Users/r/repos/grug-brain.mcp/docs/research-synthesis/` — source for principles

**Depends on:** None | **Unlocks:** Phase 2, Phase 3

**Done when:**
- [ ] DW-1.1: `prompt.md` has exactly 2 modes (DESIGN, REVIEW) with task-type routing
- [ ] DW-1.2: Router detects task type from request signals and loads relevant modules
- [ ] DW-1.3: `principles.md` distills all 9 research themes into actionable first principles with citations
- [ ] DW-1.4: DESIGN mode covers new prompts, fixing prompts, agent dispatch, skill prompts
- [ ] DW-1.5: REVIEW mode loads review checklist module
- [ ] DW-1.6: Verification step is part of both modes' workflow
- [ ] DW-1.7: No runtime dependency on grug or external databases
- [ ] DW-1.8: Router's own structure demonstrates the principles it teaches

**Difficulty:** HIGH
**Uncertainty:** Getting the routing signals right — must detect task type without asking the user.

---

### Phase 2: Build the focused modules
**Model:** opus

**Goal:** Write the domain-specific modules that the router loads per task type. Each module is a self-contained reference on one aspect of prompt/skill design, backed by the research synthesis.

**Scope:**
- IN: Writing all modules. Content condensed from the 8 research synthesis files. Each module carries its own decision tables, key numbers, and actionable workflows. Modules must work independently.
- OUT: Router changes (Phase 1). Old file cleanup (Phase 3).

**Approach notes:**
- Module list (content determines actual count and size):
  - Reasoning strategy (compressed CoT, adaptive triggering, thinking trace injection, verify-then-escalate)
  - Context engineering (6 components, position effects, format selection, token budgeting)
  - Safety and security (architectural defenses, instruction hierarchy, capability-alignment paradox, skill injection patterns)
  - Agent and multi-agent design (dispatch workflow, topology > prompting, orchestration patterns, failure prevention)
  - Prompt optimization (seed quality ceiling, DSPy/MIPRO/GEPA, few-shot as search, cross-model transfer)
  - Review checklist (research-backed audit criteria, absorbed from review-prompt.md + new research)
- Each module ≤500 lines, sized by what the content needs
- Preserve key numbers and arXiv citations

**File hints:**
- `skills/prompt/` — module directory
- Research synthesis: `/Users/r/repos/grug-brain.mcp/docs/research-synthesis/` — source material

**Depends on:** Phase 1 (need routing signals to know what each module must cover) | **Unlocks:** Phase 3

**Done when:**
- [ ] DW-2.1: All modules exist in `skills/prompt/`
- [ ] DW-2.2: Each module ≤500 lines
- [ ] DW-2.3: Each module is self-contained (no cross-references)
- [ ] DW-2.4: Reasoning module covers compressed CoT, adaptive triggering, thinking trace injection
- [ ] DW-2.5: Context module covers 6 typed components, position effects, format selection
- [ ] DW-2.6: Safety module covers architectural defenses, instruction hierarchy, capability-alignment paradox
- [ ] DW-2.7: Agent module covers dispatch workflow (replaces agent.md)
- [ ] DW-2.8: Review module covers research-backed audit (replaces review-prompt.md)
- [ ] DW-2.9: Key numbers and arXiv citations preserved in every module
- [ ] DW-2.10: No stale model names

**Difficulty:** HIGH
**Uncertainty:** Compression — condensing synthesis into focused modules without losing actionability.

---

### Phase 3: Cleanup, validation, and integration
**Model:** sonnet

**Goal:** Remove absorbed files, update skill-craft, validate with A/B test, bump version.

**Scope:**
- IN: Deprecate agent.md. Remove REVIEW-PROMPT from skill-craft.md. Delete old optimization-reference.md. A/B validation test. Version bump.
- OUT: Marketplace publishing.

**File hints:**
- `commands/agent.md` — replace with redirect stub
- `commands/skill-craft.md` — remove REVIEW-PROMPT mode
- `skills/prompt/optimization-reference.md` — delete
- `.claude-plugin/plugin.json` — version bump

**Depends on:** Phase 1, Phase 2

**Done when:**
- [ ] DW-3.1: `agent.md` replaced with redirect stub pointing to `prompt` DESIGN mode
- [ ] DW-3.2: `skill-craft.md` REVIEW-PROMPT mode removed, references `prompt` REVIEW mode
- [ ] DW-3.3: Old `optimization-reference.md` deleted
- [ ] DW-3.4: A/B test: REVIEW mode audit of a sample prompt cites ≥3 specific research principles (with arXiv IDs or named effects) where the old skill's review cites zero
- [ ] DW-3.5: No broken `${CLAUDE_PLUGIN_ROOT}` references across all remaining files
- [ ] DW-3.6: `plugin.json` version bumped

**Difficulty:** LOW
**Uncertainty:** None.

---

## Test Coverage

**Level:** A/B comparison test (Phase 3)

## Test Plan

- [ ] A/B review test: old skill vs new skill on the same prompt
- [ ] Smoke test: DESIGN mode produces a valid prompt for a sample task
- [ ] Smoke test: REVIEW mode produces a structured audit with verdict
- [ ] Routing test: 5 different task types → correct modules loaded each time
- [ ] Regression: skill-craft CREATE mode still works after REVIEW-PROMPT removal

---

## Assumptions

| Assumption | Confidence | Verify Before Phase | Fallback If Wrong |
|-----------|-----------|--------------------|--------------------|
| Task-type routing from request signals is reliable | MED | Phase 1 | Add explicit mode hints or fallback to loading more modules |
| Modules can be condensed from synthesis without losing actionability | MED | Phase 2 | Keep modules longer or split further |
| Users will accept agent.md deprecation | HIGH | Phase 3 | Keep agent.md as thin wrapper |

## Decision Log

| Decision | Alternatives Considered | Rationale | Phase |
|----------|------------------------|-----------|-------|
| 2 modes (DESIGN + REVIEW) | 4 modes | Simpler. FIX = DESIGN on existing. DISPATCH = DESIGN for agent. | 1 |
| Modular router + focused files | 500-line monolith | Research: shorter wins (GEPA), monolithic collapses (ACE), route by task type (SoT) | 1 |
| Absorb agent.md + review-prompt.md | Keep separate | Eliminates 3-way overlap | 1-2 |
| ≤500 lines per file ceiling | Fixed line targets | Content determines length. Ceiling, not target. | All |

---

## Notes

- The skill practices what it preaches: modular, front-loaded, decision tables, verification built in
- Research citations use arXiv IDs for traceability
- Module count and sizes are flexible — driven by content, not predetermined

---

## Execution Log

_To be filled during building_
