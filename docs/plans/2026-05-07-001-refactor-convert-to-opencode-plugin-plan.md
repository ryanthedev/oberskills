---
title: "Convert oberskills plugin from Claude Code to opencode"
type: refactor
status: active
date: 2026-05-07
---

# Convert oberskills plugin from Claude Code to opencode

## Summary

Migrate the oberskills Claude Code plugin to the opencode skill/plugin format. Restructure commands as skills, update path references, create opencode manifest, and modernize installation docs.

---

## Problem Frame

The oberskills plugin currently targets Claude Code's plugin architecture (`/plugin marketplace add` / `/plugin install`). The user wants to use it with opencode, which has a different skill-based architecture using `install-manifest.json` and `skills/<name>/SKILL.md` files.

---

## Assumptions

*This plan was authored without synchronous user confirmation. The items below are agent inferences that fill gaps in the input — un-validated bets that should be reviewed before implementation proceeds.*

- The target is opencode's skill/plugin format (not a programmatic TypeScript plugin using `@opencode-ai/plugin`)
- The user wants to migrate fully to opencode (not maintain dual compatibility with Claude Code)
- Skill names should match the current command names for familiarity (agent, prompt, shot, skill-craft, web-research, write)
- The existing supporting files under `skills/` already follow opencode's directory conventions and need only path updates

---

## Requirements

- R1. All 6 commands must be invocable as opencode skills
- R2. Supporting files (scripts, references, agents) must remain accessible via updated relative paths
- R3. Installation instructions must document the opencode install process
- R4. Legacy Claude Code artifacts must be removed or clearly deprecated
- R5. No behavioral changes to skill logic — pure structural migration

---

## Scope Boundaries

- **In scope:** Structural conversion, path updates, manifest creation, doc updates
- **Out of scope:** Behavioral changes to skill logic, new features, bug fixes
- **Deferred:** Programmatic TypeScript plugin API (if user wants deeper integration later)

---

## Context & Research

### Current Architecture (Claude Code)

- Manifest: `.claude-plugin/plugin.json` (name, version, description)
- Commands: `commands/*.md` with YAML frontmatter (`description:` only)
- Supporting files: `skills/<name>/` (scripts, references, agents)
- Path variable: `${CLAUDE_PLUGIN_ROOT}`
- Version pattern: Read `.claude-plugin/plugin.json` and display `{skill} v{version}`

### Target Architecture (opencode)

- Manifest: `install-manifest.json` with `version`, `pluginName`, `groups` (agents, commands, plugins, skills)
- Skills: `skills/<name>/SKILL.md` with YAML frontmatter (`name:`, `description:`, optional `argument-hint:`)
- Supporting files: relative paths from skill directory (e.g., `scripts/capture.py`, `references/review-skill.md`)
- No version display boilerplate in skills
- No `${CLAUDE_PLUGIN_ROOT}` variable — paths are relative to skill directory

### Mapping

| Claude Code Command | Opencode Skill | Supporting Files |
|---|---|---|
| `commands/agent.md` | `skills/agent/SKILL.md` | None (self-contained) |
| `commands/prompt.md` | `skills/prompt/SKILL.md` | `skills/prompt/optimization-reference.md` |
| `commands/shot.md` | `skills/shot/SKILL.md` | `skills/shot/agents/shot.md`, `skills/shot/scripts/capture.py` |
| `commands/skill-craft.md` | `skills/skill-craft/SKILL.md` | `skills/skill-craft/agents/`, `skills/skill-craft/references/`, `skills/skill-craft/scripts/` |
| `commands/web-research.md` | `skills/web-research/SKILL.md` | None (self-contained) |
| `commands/write.md` | `skills/write/SKILL.md` | `skills/write/elements-of-style.md`, `skills/write/references/ai-writing-patterns.md` |

---

## Key Technical Decisions

- **Keep existing `skills/` subdirectory structure:** The current `skills/<name>/` layout already matches opencode conventions. Only need to add `SKILL.md` files and update internal references.
- **Remove version display:** Opencode skills do not follow the Claude Code pattern of reading a manifest for version display. Remove all "On load: Read plugin.json... Display v{version}" boilerplate.
- **Relative path resolution:** Replace `${CLAUDE_PLUGIN_ROOT}/skills/<name>/` with relative paths (e.g., `scripts/capture.py`, `references/review-skill.md`). The skill executor resolves these relative to the skill's directory.
- **Name field in frontmatter:** Add `name:` matching the skill directory name (agent, prompt, shot, skill-craft, web-research, write).
- **Install manifest format:** Use compound-engineering's `install-manifest.json` as the reference format.

---

## Open Questions

### Resolved During Planning

- **Q: Should we maintain backward compatibility with Claude Code?**
  - Resolution: No — the user asked to convert for opencode use. Full migration.

- **Q: What happens to the existing `commands/` directory?**
  - Resolution: Delete after migration. Opencode uses `skills/` directly.

- **Q: Should `.claude-plugin/plugin.json` be kept?**
  - Resolution: Remove. Replace with `install-manifest.json`.

### Deferred to Implementation

- **Q: Exact opencode installation command** — verify `/plugin install` vs marketplace syntax when implementing README changes.

---

## Implementation Units

### U1. Create opencode plugin manifest and configuration

**Goal:** Establish the opencode plugin entry point and manifest.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Create: `install-manifest.json`
- Create: `.opencode/opencode.json`
- Delete: `.claude-plugin/plugin.json`
- Delete: `.claude-plugin/` directory (after removing plugin.json)

**Approach:**
- Create `install-manifest.json` with `version: 1`, `pluginName: oberskills`, and `groups.skills` listing all 6 skill names
- Create `.opencode/opencode.json` with standard schema reference
- Remove legacy `.claude-plugin/` directory

**Patterns to follow:**
- Reference: `/Users/johnm/.config/opencode/compound-engineering/install-manifest.json`

**Test scenarios:**
- Test expectation: none — pure scaffolding/config change

**Verification:**
- `install-manifest.json` exists at repo root and validates as JSON
- `.opencode/opencode.json` exists
- `.claude-plugin/` no longer exists

---

### U2. Convert agent command to opencode skill

**Goal:** Migrate the agent command to the opencode skill format.

**Requirements:** R1, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/agent/SKILL.md`
- Delete: `commands/agent.md`

**Approach:**
- Create `skills/agent/` directory
- Copy content from `commands/agent.md` to `skills/agent/SKILL.md`
- Add `name: agent` to YAML frontmatter
- Remove version reading boilerplate: delete the "On load: Read `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`..." line
- This skill is self-contained (no supporting files to relocate)

**Patterns to follow:**
- Opencode skill frontmatter format: `name:`, `description:`
- Reference: `/Users/johnm/.config/opencode/skills/ce-strategy/SKILL.md`

**Test scenarios:**
- Test expectation: none — pure structural migration with no behavioral changes

**Verification:**
- `skills/agent/SKILL.md` exists with valid YAML frontmatter containing `name: agent`
- `commands/agent.md` no longer exists
- No `${CLAUDE_PLUGIN_ROOT}` references remain in the skill

---

### U3. Convert prompt command to opencode skill

**Goal:** Migrate the prompt command and update supporting file references.

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/prompt/SKILL.md`
- Delete: `commands/prompt.md`

**Approach:**
- Copy `commands/prompt.md` to `skills/prompt/SKILL.md`
- Add `name: prompt` to YAML frontmatter
- Remove version reading boilerplate
- Update all `${CLAUDE_PLUGIN_ROOT}/skills/prompt/optimization-reference.md` references to `optimization-reference.md` (relative to skill directory)

**Patterns to follow:**
- Relative path convention from `ce-demo-reel/SKILL.md`: `references/tier-browser-reel.md`

**Test scenarios:**
- Test expectation: none — structural migration

**Verification:**
- `skills/prompt/SKILL.md` exists with `name: prompt`
- `commands/prompt.md` deleted
- All paths in `skills/prompt/SKILL.md` are relative (no `${CLAUDE_PLUGIN_ROOT}`)
- `skills/prompt/optimization-reference.md` remains in place

---

### U4. Convert shot command to opencode skill

**Goal:** Migrate the shot command and update agent/script references.

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/shot/SKILL.md`
- Delete: `commands/shot.md`

**Approach:**
- Copy `commands/shot.md` to `skills/shot/SKILL.md`
- Add `name: shot` to YAML frontmatter
- Remove version reading boilerplate
- Update `${CLAUDE_PLUGIN_ROOT}/skills/shot/agents/shot.md` → `agents/shot.md`
- Update `python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py` → `python scripts/capture.py`

**Test scenarios:**
- Test expectation: none — structural migration

**Verification:**
- `skills/shot/SKILL.md` exists with `name: shot`
- `commands/shot.md` deleted
- Agent reference points to `agents/shot.md`
- Script reference points to `scripts/capture.py`
- Supporting files `skills/shot/agents/shot.md` and `skills/shot/scripts/capture.py` remain in place

---

### U5. Convert skill-craft command to opencode skill

**Goal:** Migrate the skill-craft command with multiple supporting file references.

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/skill-craft/SKILL.md`
- Delete: `commands/skill-craft.md`

**Approach:**
- Copy `commands/skill-craft.md` to `skills/skill-craft/SKILL.md`
- Add `name: skill-craft` to YAML frontmatter
- Remove version reading boilerplate
- Update all `${CLAUDE_PLUGIN_ROOT}/skills/skill-craft/` references to relative paths:
  - `references/review-skill.md`
  - `references/review-prompt.md`
  - `references/router-patterns.md`
  - `scripts/optimize_description.py`
  - `scripts/run_trigger_eval.py`
  - `references/testing-protocol.md`

**Test scenarios:**
- Test expectation: none — structural migration

**Verification:**
- `skills/skill-craft/SKILL.md` exists with `name: skill-craft`
- `commands/skill-craft.md` deleted
- All 6 path references are relative
- All supporting files remain in `skills/skill-craft/` subdirectories

---

### U6. Convert web-research command to opencode skill

**Goal:** Migrate the web-research command.

**Requirements:** R1, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/web-research/SKILL.md`
- Delete: `commands/web-research.md`

**Approach:**
- Create `skills/web-research/` directory
- Copy `commands/web-research.md` to `skills/web-research/SKILL.md`
- Add `name: web-research` to YAML frontmatter
- Remove version reading boilerplate
- This skill is self-contained (no supporting files)

**Test scenarios:**
- Test expectation: none — structural migration

**Verification:**
- `skills/web-research/SKILL.md` exists with `name: web-research`
- `commands/web-research.md` deleted
- No `${CLAUDE_PLUGIN_ROOT}` references remain

---

### U7. Convert write command to opencode skill

**Goal:** Migrate the write command and update reference file paths.

**Requirements:** R1, R2, R3, R5

**Dependencies:** U1

**Files:**
- Create: `skills/write/SKILL.md`
- Delete: `commands/write.md`

**Approach:**
- Copy `commands/write.md` to `skills/write/SKILL.md`
- Add `name: write` to YAML frontmatter
- Remove version reading boilerplate
- Update `${CLAUDE_PLUGIN_ROOT}/skills/write/elements-of-style.md` → `elements-of-style.md`
- Update `${CLAUDE_PLUGIN_ROOT}/skills/write/references/ai-writing-patterns.md` → `references/ai-writing-patterns.md`

**Test scenarios:**
- Test expectation: none — structural migration

**Verification:**
- `skills/write/SKILL.md` exists with `name: write`
- `commands/write.md` deleted
- Reference paths are relative
- Supporting files remain in `skills/write/`

---

### U8. Update README and remove legacy structure

**Goal:** Document opencode installation and clean up obsolete artifacts.

**Requirements:** R3, R4

**Dependencies:** U2, U3, U4, U5, U6, U7

**Files:**
- Modify: `README.md`
- Delete: `commands/` directory

**Approach:**
- Update README installation section to reference opencode commands (not `/plugin marketplace add`)
- Remove Claude Code-specific marketplace instructions
- Add opencode plugin installation instructions
- Update skill invocation examples from `/skillname` to opencode syntax if different
- Delete empty `commands/` directory after all commands migrated
- Update version reference section (remove mention of `.claude-plugin/plugin.json`)

**Test scenarios:**
- Test expectation: none — documentation and cleanup

**Verification:**
- README contains opencode installation instructions
- No Claude Code `/plugin` commands in README
- `commands/` directory no longer exists
- Version section references `install-manifest.json` or is removed

---

## System-Wide Impact

- **Interaction graph:** All 6 skills are standalone; no cross-skill dependencies
- **Error propagation:** No runtime behavior changes — structural only
- **State lifecycle risks:** None; no stateful operations
- **API surface parity:** N/A — no programmatic APIs
- **Unchanged invariants:** All skill logic, workflow steps, and decision tables remain identical

---

## Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| Path references missed during bulk update | Global search for `${CLAUDE_PLUGIN_ROOT}` before and after migration |
| Supporting files accidentally moved or deleted | Verify all `skills/<name>/` subdirectories remain intact after migration |
| Install manifest format incorrect | Reference compound-engineering manifest as template |

---

## Documentation / Operational Notes

- Update README with opencode-specific installation
- Consider adding a CHANGELOG entry noting the architecture migration
- The `.claude-plugin/` directory should be removed from version control

---

## Sources & References

- Related code: `.claude-plugin/plugin.json`, `commands/*.md`, `skills/*`
- External reference: `/Users/johnm/.config/opencode/compound-engineering/install-manifest.json`
- External reference: `/Users/johnm/.config/opencode/skills/ce-demo-reel/SKILL.md` (path conventions)
