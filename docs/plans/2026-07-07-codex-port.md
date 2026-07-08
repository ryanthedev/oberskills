# Codex Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `oberskills` installable and usable as a Codex plugin while preserving the existing Claude Code plugin behavior.

**Architecture:** Keep one shared source tree. Add Codex packaging beside the existing Claude packaging, introduce host-neutral startup and documentation paths, and make small targeted edits to skill entrypoints. Do not fork or broadly rewrite Claude-specific references; only add Codex compatibility where the Codex-facing skill body would otherwise point at unavailable Claude-only surfaces.

**Tech Stack:** Codex plugin manifest (`.codex-plugin/plugin.json`), Codex marketplace install flow, MCP stdio servers, Bun/TypeScript, Markdown skills, shell wrapper scripts, existing `bun test` suites.

## Constraints

- Preserve `.claude-plugin/plugin.json` and Claude install behavior.
- Do not add Codex plugin hooks; Codex plugin validation rejects unsupported manifest fields such as `hooks`.
- Do not assume a Codex-specific environment variable unless a test or docs in this repo verify it.
- Keep `skills/*/references/*.md` mostly intact. Many are intentionally Claude-specific source material.
- Replace Claude-only path substitutions only in shared `SKILL.md` bodies and validator rules, not by mass-editing all references.
- Treat MCP dependency installation explicitly. Codex will not run Claude SessionStart hooks.
- Keep all tests offline unless explicitly marked live.

## Task 1: Verify Codex Manifest Shape and Add Packaging

**Files:**
- Create: `.codex-plugin/plugin.json`
- Create: `.mcp.json`
- Test: add `mcp/test/codex-plugin-manifest.test.ts`

**Step 1: Verify accepted MCP companion shape**

Before writing tests, use the local Codex plugin spec and validator behavior available in `/Users/r/.codex/skills/.system/plugin-creator/references/plugin-json-spec.md` and `/Users/r/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`.

Decision:

- If the validator accepts `.mcp.json` with a top-level `mcpServers` envelope, use that.
- If it expects direct server keys, use direct server keys.
- Encode the selected shape in tests after validation, not before.

**Step 2: Create `.codex-plugin/plugin.json`**

Add:

```json
{
  "name": "oberskills",
  "version": "2.7.0",
  "description": "Discipline plugins for Codex: prompt engineering, skill authoring, writing, research, and browser control",
  "author": {
    "name": "r"
  },
  "license": "MIT",
  "keywords": [
    "skills",
    "workflow",
    "agents",
    "prompt-engineering",
    "web-search",
    "browser-automation",
    "writing",
    "humanization"
  ],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "oberskills",
    "shortDescription": "Workflow skills for Codex",
    "longDescription": "Skills and MCP tools for prompt design, skill authoring, writing, research workflows, and browser automation in Codex.",
    "developerName": "r",
    "category": "Productivity",
    "capabilities": ["Interactive", "Write"],
    "defaultPrompt": [
      "Review this prompt for failure modes.",
      "Help port this skill to Codex.",
      "Use the browser tools on this app."
    ]
  }
}
```

No `hooks` field.

**Step 3: Create `.mcp.json`**

Use the shape validated in Step 1. The server entries should launch wrapper scripts:

```json
{
  "skill-eval": {
    "command": "bash",
    "args": ["./scripts/start-skill-eval-mcp.sh"]
  },
  "mcp-browser": {
    "command": "bash",
    "args": ["./scripts/start-browser-mcp.sh"]
  }
}
```

If validation proves the envelope is required, wrap the above as `{ "mcpServers": { ... } }` and update tests to match.

**Step 4: Document marketplace installation truthfully**

Do not add `.agents/plugins/marketplace.json` inside this plugin root. Codex marketplace entries resolve from a marketplace root and conventionally point at `./plugins/<plugin-name>`, so a plugin repo cannot also be its own spec-shaped marketplace without a parent layout.

Document the local development flow instead:

```bash
codex plugin marketplace add <path-to-marketplace-root>
codex plugin add oberskills@<marketplace-name>
```

The marketplace root should contain a `marketplace.json` entry whose `source.path` points at `./plugins/oberskills`, with this repo checked out or symlinked at that path.

**Step 5: Add manifest tests**

Create `mcp/test/codex-plugin-manifest.test.ts`:

- `.codex-plugin/plugin.json` parses.
- Required fields exist.
- `hooks` is absent.
- `skills === "./skills/"`.
- `mcpServers === "./.mcp.json"`.
- `.mcp.json` parses and contains `skill-eval` and `mcp-browser` in the validated shape.
- Each MCP server uses `bash` and `./scripts/*.sh`.
- No `.agents/plugins/marketplace.json` is shipped in this repo.
- `README.md` documents the external marketplace layout using `./plugins/oberskills`.

**Step 6: Verify**

Run:

```bash
python3 -m json.tool .codex-plugin/plugin.json >/tmp/codex-plugin.json
python3 -m json.tool .mcp.json >/tmp/mcp.json
python3 /Users/r/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
cd mcp && bun test test/codex-plugin-manifest.test.ts
```

Expected: JSON parsing succeeds, plugin validation succeeds or yields only documented warnings, and the targeted test passes.

## Task 2: Add MCP Startup Wrappers and Dual-Manifest Version Lookup

**Files:**
- Create: `scripts/start-skill-eval-mcp.sh`
- Create: `scripts/start-browser-mcp.sh`
- Modify: `mcp/src/register.ts`
- Modify: `mcp-browser/src/register.ts`
- Modify: `mcp/src/server.ts`
- Modify: `mcp-browser/src/server.ts`
- Modify: `mcp-browser/test/plugin-manifest.test.ts`
- Modify or add tests under `mcp/test/`.

**Step 1: Add startup wrappers**

Create executable scripts.

`scripts/start-skill-eval-mcp.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/mcp"
if [ ! -d node_modules ]; then
  echo "Missing mcp/node_modules. Installing dependencies in $ROOT/mcp ..." >&2
  bun install --silent
fi
exec bun run src/server.ts
```

`scripts/start-browser-mcp.sh` uses `mcp-browser`.

Make both executable.

**Step 2: Update dependency error messages**

In `mcp/src/server.ts` and `mcp-browser/src/server.ts`, replace Claude-only `/reload-plugins` guidance with dual-host wording:

- Claude: run `/reload-plugins` after SessionStart dependency install.
- Codex/local: wrappers install dependencies on first start; if that fails, run `bun install` in the printed plugin package directory, then restart/reinstall the plugin session.

**Step 3: Update version lookup**

In both `mcp/src/register.ts` and `mcp-browser/src/register.ts`, change `readVersion()` to check:

1. `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` when `CLAUDE_PLUGIN_ROOT` exists.
2. `../../.codex-plugin/plugin.json` relative to `import.meta.url`.
3. `../../.claude-plugin/plugin.json` relative to `import.meta.url`.

Do not rely on `CODEX_PLUGIN_ROOT` unless a local runtime test proves it exists.

**Step 4: Update manifest tests**

Update `mcp-browser/test/plugin-manifest.test.ts` so it keeps existing Claude assertions and adds Codex assertions:

- `.claude-plugin/plugin.json` still points at `${CLAUDE_PLUGIN_ROOT}/mcp-browser/src/server.ts`.
- `.codex-plugin/plugin.json` has `skills: "./skills/"` and `mcpServers: "./.mcp.json"`.
- `.mcp.json` contains both server entries in the validated shape.

**Step 5: Verify**

Run:

```bash
cd mcp && bunx tsc --noEmit && bun test
cd ../mcp-browser && bunx tsc --noEmit && bun test
```

Expected: all tests pass.

If dependencies are missing, run `bun install` in the relevant package, then repeat.

## Task 3: Update Skill Validator for Shared Codex/Claude Paths

**Files:**
- Modify: `mcp/src/tools/validate-skill.ts`
- Modify: `mcp/test/validate.test.ts`

**Step 1: Adjust bare `references/` rule**

The current validator warns on bare `references/` paths unless `${CLAUDE_SKILL_DIR}` is present. For shared Codex/Claude skills, update the warning text and logic:

- Allow prose like `` `references/design.md` in this skill directory ``.
- Continue warning on ambiguous bare paths that look like executable filesystem assumptions from arbitrary cwd.
- Continue accepting `${CLAUDE_SKILL_DIR}` in explicitly Claude-only sections.

Implementation option:

- Suppress `bare-relative-path` when the same line contains “skill directory”, “this skill”, or “sibling”.
- Update the warning to recommend “make the resolution basis explicit” rather than requiring `${CLAUDE_SKILL_DIR}`.

**Step 2: Add regression tests**

In `mcp/test/validate.test.ts`, add cases:

- A SKILL.md line `Load \`references/design.md\` in this skill directory.` produces no `bare-relative-path` warning.
- A SKILL.md line `Run references/script.md` still warns.
- A `${CLAUDE_SKILL_DIR}/references/design.md` line remains accepted.

**Step 3: Verify**

Run:

```bash
cd mcp && bun test test/validate.test.ts
```

Expected: all validator tests pass.

## Task 4: Targeted Skill Body Port

**Files:**
- Modify: `skills/agent/SKILL.md`
- Modify: `skills/browser/SKILL.md`
- Modify: `skills/skill-craft/SKILL.md`
- Modify: `skills/web-research/SKILL.md`
- Modify: `skills/prompt/SKILL.md` only for the top-level description/module path wording if needed.
- Do not mass-edit `skills/*/references/*.md`.

**Step 1: Replace substitution-only path wording in SKILL.md files**

In `SKILL.md` bodies only, replace:

```markdown
`${CLAUDE_SKILL_DIR}/references/design.md`
```

with:

```markdown
`references/design.md` in this skill directory
```

Use the same pattern for `agents/analyzer.md`.

**Step 2: Normalize MCP tool names in `skill-craft`**

Replace host-specific MCP names with:

```markdown
`skill-eval:validate_skill` (or the host-exposed `mcp__...validate_skill` name)
```

Keep any exact Claude names in a small compatibility table.

**Step 3: Add host-neutral subagent wording**

In `skills/agent/SKILL.md`, add a compact host mapping that does not name Codex internals:

```markdown
## Host Mapping

Use the host's available subagent or delegation tool when present. If no such tool is available, work inline and state that the host has no subagent surface.

| Concept | Claude Code | Codex/other hosts |
|---|---|---|
| Spawn work | `Agent(...)` / Task tool | Host-provided subagent/delegation tool, when available |
| Wait or follow up | Agent return / resume | Host-provided wait or message operation, when available |
| No delegation surface | Work inline | Work inline |
```

Adjust `browser`, `web-research`, and `skill-craft` so “dispatch a subagent” means “use the host’s subagent tool when available; otherwise summarize inline only when the artifact is small enough or use local deterministic tools.”

**Step 4: Keep Claude-specific references labeled**

Do not rewrite `prompt` into a Codex-first prompt skill. Instead:

- Keep “Claude-first” where it is truly about Claude model behavior.
- Add one sentence in the description/body that it also supports reviewing prompts for non-Claude/Codex targets via `references/porting.md` in this skill directory.

**Step 5: Verify**

Run:

```bash
rg -n '\$\{CLAUDE_SKILL_DIR\}|\$\{CLAUDE_PLUGIN_ROOT\}|mcp__plugin_oberskills' skills/*/SKILL.md
cd mcp && bun test test/validate.test.ts
```

Expected: no unresolved substitution or plugin-specific MCP names in shared `SKILL.md` bodies unless in an explicitly labeled compatibility section, and validator tests pass.

## Task 5: Convert `shot` from Claude Command to Codex Skill

**Files:**
- Create: `skills/shot/SKILL.md`
- Keep: `commands/shot.md`
- Keep: `skills/shot/scripts/capture.py`
- Keep: `skills/shot/agents/shot.md`

**Step 1: Create `skills/shot/SKILL.md`**

Use:

```markdown
---
name: shot
description: Captures and summarizes screenshots from the local desktop or a named window using the bundled capture script. Use when the user asks for a screenshot, screen capture, active-window capture, visual inspection of the current screen, or named-window screenshot. Not for browser-page screenshots when browser MCP tools are already controlling a page.
---

# shot

Capture a local screenshot, then summarize the visual result without loading large image data unnecessarily.

## Workflow

1. Choose mode: `full`, `active`, or `window`.
2. From the plugin root, run `python3 skills/shot/scripts/capture.py --mode <mode>`. For a named window, add `--name '<window name>'`.
3. Inspect the returned thumbnail path when the user asks for visual interpretation.
4. Return the relevant summary and the saved screenshot path.

If the host has a subagent tool, pass the screenshot path to a fresh reviewer for visual summary. Otherwise use the host's image-inspection tool directly.

## Dependencies

The capture script requires Python packages `mss` and `Pillow` and may require OS screen-recording permissions.
```

**Step 2: Preserve Claude command behavior**

Leave `commands/shot.md` in place for Claude compatibility.

**Step 3: Verify**

Run:

```bash
test -f skills/shot/SKILL.md
python3 -m py_compile skills/shot/scripts/capture.py
```

Expected: both commands exit 0.

## Task 6: Add Codex Portability Tests

**Files:**
- Add: `mcp/test/skill-frontmatter-portability.test.ts`

**Step 1: Test all top-level skills**

For each `skills/*/SKILL.md`:

- YAML frontmatter contains `name` and `description`.
- `name` matches directory.
- `description` is non-empty.

**Step 2: Test shared body portability**

Check only `SKILL.md` bodies, not reference files:

- No unresolved `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}`.
- No `mcp__plugin_oberskills` strings.
- `Agent(...)` and `Claude Code` are allowed only when the same file contains a host-mapping or compatibility section.

**Step 3: Verify**

Run:

```bash
cd mcp && bun test test/skill-frontmatter-portability.test.ts
```

Expected: test passes.

## Task 7: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README**

Document:

- This repo supports both Claude Code and Codex.
- Claude install path remains unchanged.
- Codex local development path:

```bash
cd mcp && bun install
cd ../mcp-browser && bun install
```

- Codex install/discovery uses `.codex-plugin/plugin.json` through an external marketplace root; do not ship a fake repo-local `.agents/plugins/marketplace.json`.
- MCP dependencies install into the plugin directory Codex launches. For local development, this repo directory is the plugin directory.
- Browser MCP requires Chrome/Chromium availability.
- `skill-eval` still uses the Anthropic Agent SDK unless a Codex-native eval runner is implemented later.

**Step 2: Update repository guidance**

In `CLAUDE.md`, add a short “Dual-host support” note:

- Preserve both manifests.
- Keep Claude-specific model/mechanics references labeled.
- Do not introduce Claude-only substitutions into shared skill bodies unless section-labeled.
- Run both MCP package tests after manifest or server changes.

**Step 3: Final verification**

Run:

```bash
python3 -m json.tool .codex-plugin/plugin.json >/tmp/codex-plugin.json
python3 -m json.tool .mcp.json >/tmp/mcp.json
python3 /Users/r/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
python3 -m py_compile skills/shot/scripts/capture.py
cd mcp && bunx tsc --noEmit && bun test
cd ../mcp-browser && bunx tsc --noEmit && bun test
```

Expected: all commands exit 0, or any Codex validator warning is documented and accepted with the exact warning text.

**Step 4: Optional Codex smoke test**

If a Codex plugin install command is available in the environment, run the external marketplace add/install flow, start a fresh Codex session, and confirm:

- Skills appear in the plugin listing.
- MCP servers start or fail with the new actionable dependency message.
- At least one harmless MCP list/status operation works.

If no non-interactive Codex smoke command is available, document that limitation in the final response.

**Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- .codex-plugin/plugin.json .mcp.json .agents scripts skills mcp mcp-browser README.md CLAUDE.md
```

Check:

- No unrelated files changed.
- Claude plugin manifest still exists.
- Codex manifest has no hooks.
- Shared `SKILL.md` files are not full of duplicated Claude/Codex branches.

**Step 6: Optional commit**

Commit only after user approval or if the current task explicitly includes committing:

```bash
git add -A
git commit -m "feat: add Codex plugin support"
```
