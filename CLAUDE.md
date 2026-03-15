# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable commands and agents — workflow patterns that guide Claude through specific tasks like prompt engineering, agent dispatch, skill creation, screenshot analysis, web search, and human-sounding writing.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest (name, version, description)
├── commands/                # Plugin commands (flat .md files)
│   ├── agent.md
│   ├── prompt.md
│   ├── shot.md
│   ├── skill-craft.md
│   ├── web-research.md
│   └── write.md
└── skills/                  # Supporting files for commands (references, scripts, agents)
    ├── prompt/
    │   └── optimization-reference.md
    ├── shot/
    │   ├── agents/
    │   │   └── shot.md
    │   └── scripts/
    │       └── capture.py
    ├── skill-craft/
    │   ├── agents/
    │   │   ├── analyzer.md
    │   │   ├── comparator.md
    │   │   └── grader.md
    │   ├── references/
    │   │   ├── review-prompt.md
    │   │   ├── review-skill.md
    │   │   ├── router-patterns.md
    │   │   ├── schemas.md
    │   │   └── testing-protocol.md
    │   └── scripts/
    │       ├── aggregate_benchmark.py
    │       ├── generate_review.py
    │       ├── optimize_description.py
    │       ├── package_skill.py
    │       ├── quick_validate.py
    │       ├── run_trigger_eval.py
    │       └── utils.py
    └── write/
        ├── elements-of-style.md
        └── references/
            └── ai-writing-patterns.md
```

## Command File Format

Each command is a Markdown file with YAML frontmatter:

```markdown
---
name: commandname
description: When to use this command - triggers command selection
---

# Command Title

[Workflow steps, phases, decision tables, output formats]
```

The `description` field is critical — it tells Claude when to invoke the command.

All commands display their version at runtime by reading from `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`, which serves as the single source of truth for the plugin version.

Supporting files (references, scripts, agents) live under `skills/` and are referenced using `${CLAUDE_PLUGIN_ROOT}` paths.

## Installation

Install via the RTD marketplace:

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
```

## Commands

| Command | Purpose |
|---------|---------|
| **agent** | Enforces prompt principles before any agent dispatch |
| **prompt** | Research-backed prompt engineering for LLM systems |
| **shot** | Screenshot intake + dispatches shot agent for context-efficient capture + haiku analysis |
| **skill-craft** | Skill creation and review with checklist-driven quality gates |
| **web-research** | Multi-dimensional web search with parallel sonnet subagents that extract and distill (not summarize) precise information |
| **write** | Human-sounding writing via Strunk's rules + research-backed AI pattern detection (em-dashes, aidiolect, burstiness, voice) |
