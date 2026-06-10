# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable skills and commands — workflow patterns that guide Claude through specific tasks like prompt engineering, subagent dispatch, skill creation, screenshot analysis, web search, and human-sounding writing. The three meta-skills (prompt, agent, skill-craft) are teaching instruments: their job is to make the Claude that invokes them produce best-practice prompts, dispatches, and skills.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json          # Manifest: name, version, mcpServers (skill-eval), SessionStart dep hook
├── skills/                  # Skills (skills/<name>/SKILL.md + references/ — the current format)
│   ├── prompt/              # Claude-first prompt design + review; 8 reference files
│   ├── agent/               # Subagent dispatch guidance; 3 reference files
│   ├── skill-craft/         # Skill creation/eval/review; references/ + agents/analyzer.md
│   ├── shot/                # (legacy command format: commands/shot.md + these support files)
│   ├── web-research/        # (legacy command format)
│   └── write/               # (legacy command format)
├── commands/                # Legacy flat command files (migrate to skills/ when refreshed)
│   ├── shot.md
│   ├── web-research.md
│   ├── write.md
│   └── clarify.md
└── mcp/                     # skill-eval MCP server (Bun + TypeScript, strict)
    ├── src/                 # server bootstrap, register, tools/, lib/, types.ts
    ├── data/                # pressure-blocks.json, rationalization-patterns.json
    ├── prompts/             # grader.md, comparator.md, query-gen, description-improvement
    └── test/                # bun test; live tests gated behind RUN_LIVE_EVALS=1
```

## Conventions

- **Skills format**: new/refreshed components are skills (`skills/<name>/SKILL.md`), not flat commands — Claude Code merged commands into skills; the directory name defines the command name. Frontmatter includes `name` (matches directory), `description` (third person, what + when, exclusion clause), `when_to_use` (trigger phrases). `description` + `when_to_use` ≤ 1,536 chars combined.
- **Paths**: only the braced forms `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` are substituted, and only in harness-loaded content (SKILL.md bodies, configs, hooks) — never rely on substitution inside `references/*.md` (use skill-name phrasing there).
- **Evidence discipline**: every number in a skill traces to a source; each canonical number lives in exactly one file, others point to it. No anti-rationalization tables or self-assessed compliance constructs in skill bodies (binding decision; `validate_skill` lints for them).
- **No version banners**: skills do not read or display the plugin version. `plugin.json` is the single version source.
- **MCP server code**: Bun + strict TypeScript; `bunx tsc --noEmit` and `bun test` must pass clean; no `console.log` in `src/` (stdout is the MCP transport — stderr only).
- Dogfood gate: `validate_skill` over `skills/{prompt,agent,skill-craft}` must report zero errors and zero warnings.

## Working on the MCP server

```bash
cd mcp
bun install
bunx tsc --noEmit     # typecheck (strict)
bun test              # unit suite
RUN_LIVE_EVALS=1 bun test test/smoke.live.test.ts   # live smoke (~$0.15, spawns Agent SDK sessions)
```

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
| **shot** | command | Screenshot intake + haiku analysis subagent |
| **web-research** | command | Multi-angle parallel web search with extraction |
| **write** | command | Human-sounding writing (Strunk + AI-pattern detection) |
| **clarify** | command | Intent decomposition for ambiguous requests |
