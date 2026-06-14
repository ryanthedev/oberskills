# Discovery + Design: Phase 6 — Browser skill + evals

## Files Found

- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/register.ts` — tool registrations (40 tools)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/*.ts` — 40 tool modules with real `name` + `description` exports
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/skills/` — existing skills: `agent`, `prompt`, `shot`, `skill-craft`, `web-research`, `write`
- No `skills/browser/` directory exists — must be created

## Current State

The MCP server is complete (Phases 1-5). 40 tools are registered with these real names:

**Connection/tabs (2):** `browser_connect`, `browser_tabs`

**Snapshot + refs interaction (9):** `browser_snapshot`, `browser_click`, `browser_type`, `browser_hover`, `browser_select`, `browser_fill_form`, `browser_press_key`, `browser_drag`, `browser_form`

**Navigation/lifecycle (4):** `browser_navigate`, `browser_wait`, `browser_scroll`, `browser_screenshot`

**Read/extract (7):** `browser_dom`, `browser_accessibility`, `browser_extract`, `browser_collect`, `browser_evaluate`, `browser_dismiss`, `browser_wait_for_text`

**Perf+network (6):** `browser_performance_start_trace`, `browser_performance_stop_trace`, `browser_analyze_insight`, `browser_lighthouse_audit`, `browser_export_har`, `browser_route`, `browser_emulate`

**Storage/emulation/capture (11):** `browser_storage`, `browser_storage_state_save`, `browser_storage_state_restore`, `browser_emulate_device`, `browser_geolocation`, `browser_permissions`, `browser_pdf`, `browser_screencast_start`, `browser_screencast_stop`, `browser_upload`, `browser_download`

Total: 40 tools (2+9+4+7+7+11 = 40).

Note: `browser_emulate` counted in perf+network (network/CPU throttling) not storage group.

## Gaps

None — all 40 tools exist. The skill directory is the only missing artifact.

## Code Standards

From `code-clarity-and-docs` skill:
- Names must be precise and consistent; comments (headings) must use different words than what they label
- No heading/comment that restates the obvious
- Interface descriptions state externally visible behavior, not internals

From `cc-quality-practices`: combined defect-detection approach; validate_skill is the deterministic gate.

No `docs/code-standards.md` found in the project root.

## Test Infrastructure

"Tests" for this phase are deterministic tool calls:
- `validate_skill` — lint against agentskills.io spec + house rules; zero errors/warnings required
- `test_triggers` — spawns real isolated Claude sessions; measures activation rate on should/shouldn't queries

No traditional test framework applies for skill authoring. validate_skill is the red-green gate.

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-6.1 | `skills/browser/SKILL.md` exists with valid frontmatter (`name: browser`, third-person description + when_to_use, combined ≤1536 chars, SKILL.md ≤500 lines, references linked at depth 1); references document every existing tool and document none that don't exist (doc-accuracy audit passes). | COVERED | validate_skill enforces frontmatter + line-count; doc-accuracy verified by enumerating all 40 registered names and cross-checking references |
| DW-6.2 | `validate_skill` on `skills/browser/` reports zero errors and zero warnings (no version banner; no self-assessed-compliance constructs; braced paths only in SKILL.md body). | COVERED | validate_skill run directly; fix all flags iteratively |
| DW-6.3 | `test_triggers` passes — browser-task queries trigger and near-miss/unrelated queries stay quiet. | COVERED | test_triggers with curated should/shouldn't query sets; iterate description if any fail |
| DW-6.4 | The skill teaches snapshot→ref→act as primary (selector/coords fallback) and routes screenshot/DOM/AX reads to a Haiku subagent so artifacts never enter main context. | COVERED | SKILL.md body reviewed for snapshot→ref→act primary loop; subagent routing section checked for Haiku dispatch pattern |

**All items COVERED:** YES

## Design Decisions

**SKILL.md structure:** Keep body ≤200 lines of always-relevant core (per SkillsBench guidance: focused 2-3 module skills outperform comprehensive ones by +18.8pp). Push tool-surface detail into four reference files grouped by phase concern.

**References grouping:**
- `references/interaction.md` — snapshot+refs (primary) + navigation/lifecycle + read/extract
- `references/perf-network.md` — performance traces, Lighthouse, HAR, routing, throttling
- `references/storage-capture.md` — storage, emulation, capture (PDF, screencast, upload, download)

**Subagent routing pattern:** Adapted from svelte-foundations `commands/browser.md` Haiku dispatch. Screenshots/DOM/AX always dispatched to a `haiku` subagent with the file path — artifacts never enter main context. No anti-rationalization table (validate_skill lints that construct).

**Description formula:** Third-person, verb-first capabilities + "Use when" triggers + "Not for" near-misses. Combined with `when_to_use` ≤1536 chars.

**No version banner:** plugin.json is the single version source; no `read plugin.json` step in SKILL.md.

**No braced paths in references/*.md:** Use skill-name phrasing ("the browser skill's references/") not `${CLAUDE_PLUGIN_ROOT}` substitutions.

## Prerequisites

- [x] 40 tool modules exist with real registered names (verified by grep)
- [x] Skills directory structure understood (agent/SKILL.md is the format model)
- [x] validate_skill + test_triggers MCP tools available
- [x] Subagent routing pattern understood from svelte-foundations browser.md
- [x] Build directory exists

## Recommendation

BUILD — all prerequisites met, no gaps, all DW items coverable.
