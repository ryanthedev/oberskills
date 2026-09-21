# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable skills and commands — workflow patterns that guide Claude through specific tasks like prompt engineering, subagent dispatch, skill creation, web research, live browser control, and human-sounding writing. The three meta-skills (prompt, agent, skill-craft) are teaching instruments: their job is to make the Claude that invokes them produce best-practice prompts, dispatches, and skills.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json          # Manifest: name, version, mcpServers (skill-eval, mcp-browser), SessionStart dep hooks (one per server)
├── .codex-plugin/
│   └── plugin.json          # Codex manifest: shared skills + .mcp.json companion
├── .mcp.json                # Codex MCP wrapper launch config (uses scripts/)
├── scripts/                 # start-skill-eval-mcp.sh, start-browser-mcp.sh — Codex MCP launchers
├── skills/                  # Skills (skills/<name>/SKILL.md + references/ — the current format)
│   ├── prompt/              # Claude-first prompt design + review; 8 reference files
│   ├── agent/               # Subagent dispatch guidance; 3 reference files
│   ├── skill-craft/         # Skill creation/eval/review; references/ + agents/analyzer.md
│   ├── write/               # Prose: AI-tell removal + six axes (job, depth, shape, style, copy, voice) + argument lens; 9 reference files, voices/_template.md, scripts/prose-lint.mjs (zero-dep, bun or node)
│   ├── web-research/        # Multi-angle web research; 3 reference files
│   ├── browser/             # Live Chrome control via the mcp-browser server; 3 reference files
│   └── clarify/             # Intent decomposition; 2 reference files
├── evals/                   # Hand-authored eval sets (evals/<skill>/) — see evals/README.md
├── mcp/                     # skill-eval MCP server (Bun + TypeScript, strict)
│   ├── src/                 # server bootstrap, register, tools/, lib/, types.ts
│   ├── data/                # pressure-blocks.json, rationalization-patterns.json
│   ├── prompts/             # grader.md, comparator.md, query-gen, description-improvement
│   └── test/                # bun test; live tests gated behind RUN_LIVE_EVALS=1
└── mcp-browser/             # browser MCP server (Bun + TypeScript, puppeteer-core, hexagonal)
    ├── src/                 # server, register, tools/, core/, adapters/, lib/, types.ts
    └── test/
```

`*-workspace/` directories (skill-eval run output, refresh briefs) are gitignored scratch — never commit them, and note that `skills/<name>-workspace/` snapshots contain full `SKILL.md` copies.

## Conventions

- **Skills format**: new/refreshed components are skills (`skills/<name>/SKILL.md`), not flat commands — Claude Code merged commands into skills; the directory name defines the command name. Frontmatter includes `name` (matches directory), `description` (third person, what + when, exclusion clause), `when_to_use` (trigger phrases). `description` + `when_to_use` ≤ 1,536 chars combined.
- **Paths**: shared `SKILL.md` bodies should use host-neutral wording such as `references/design.md` in this skill directory. Keep `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` only in Claude-specific manifests, hooks, commands, or explicitly labeled Claude-only sections. Never rely on substitution inside `references/*.md` (use skill-name phrasing there).
- **Evidence discipline**: every number in a skill traces to a source; each canonical number lives in exactly one file, others point to it. No anti-rationalization tables or self-assessed compliance constructs in skill bodies (binding decision; `validate_skill` lints for them).
- **No version banners**: skills do not read or display the plugin version. `plugin.json` is the single version source.
- **MCP server code**: Bun + strict TypeScript; `bunx tsc --noEmit` and `bun test` must pass clean; no `console.log` in `src/` (stdout is the MCP transport — stderr only).
- Dogfood gate: `validate_skill` over **every** skill in `skills/` must report zero errors and zero warnings. Enforced by `bun test` in `mcp/` (the dogfood test walks `skills/`, skipping gitignored `*-workspace/`), so a drifted skill fails the suite instead of waiting for someone to notice.

## Dual-host support

- Preserve both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`; do not add Codex hooks.
- Keep Claude-specific model/mechanics references labeled, and keep shared `SKILL.md` bodies portable.
- Do not introduce Claude-only substitutions into shared skill bodies unless the section is explicitly Claude-only.
- Run both MCP package suites after manifest or server changes: `cd mcp && bunx tsc --noEmit && bun test`, then `cd ../mcp-browser && bunx tsc --noEmit && bun test`.

## Working on the MCP server

```bash
cd mcp
bun install
bunx tsc --noEmit     # typecheck (strict)
bun test              # unit suite
RUN_LIVE_EVALS=1 bun test test/smoke.live.test.ts   # live smoke (~$0.15, spawns Agent SDK sessions)
```

The write skill's prose lint has its own tests, outside both MCP packages: `bun test skills/write/scripts` (or `node --test skills/write/scripts/prose-lint.test.mjs`). Two of them are sync tests — they fail if a threshold or phrase the lint matches stops being stated in the skill's prose, which is what keeps `prose-lint.data.json` from drifting.

Changes to `plugin.json` (mcpServers/hooks) need `/reload-plugins` or a restart to take effect.

## Installation

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
```

## Components

| Component | Form | Purpose |
|-----------|------|---------|
| **prompt** | skill | Claude-first prompt design + adversarial review (owns all prompt review, incl. agent prompts) |
| **agent** | skill | Subagent dispatch: delegate-vs-inline, delegation contract, model/effort, verifier dispatch |
| **skill-craft** | skill | Skill creation/eval/review, orchestrating the skill-eval MCP tools |
| **skill-eval** | MCP server | validate_skill, test_triggers, optimize_description, run_eval, grade_run, aggregate_benchmark, compare_outputs |
| **web-research** | skill | Multi-angle parallel web search with extraction |
| **write** | skill | Prose drafting/editing/review: measured AI-tell removal, routed by six axes — reader's job, edit depth, shape, style cards, copy, voice — with a deterministic prose lint and an argument-integrity review lens |
| **clarify** | skill | Intent decomposition for ambiguous requests |
| **browser** | skill | Drives a live Chrome session through the mcp-browser tools |
| **mcp-browser** | MCP server | 40 puppeteer-core browser tools (snapshot/refs, interaction, extraction, perf/network, storage/capture) |
