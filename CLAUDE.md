# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable skills - workflow patterns that guide Claude through specific tasks like prompt engineering, agent dispatch, skill creation, screenshot analysis, and web search.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest (name, version, description)
├── assets/              # Demo screenshots and images
├── research/            # Research papers and best practices
│   ├── agentic-orchestration/
│   ├── anthropic-best-practices.md
│   ├── FRAMEWORK-skill-best-practices.md
│   ├── GUIDE-skill-compliance-and-persuasion.md
│   ├── REFERENCE-skill-structure-and-constraints.md
│   └── references/
└── skills/
    ├── oberagent/       # Agent dispatch enforcement
    │   └── SKILL.md
    ├── obercreate/      # Skill creation and review
    │   ├── SKILL.md
    │   └── references/
    │       ├── review-prompt.md
    │       ├── review-skill.md
    │       ├── router-patterns.md
    │       └── testing-protocol.md
    ├── oberprompt/      # Prompt engineering
    │   ├── SKILL.md
    │   └── optimization-reference.md
    ├── obershot/        # Screenshot capture and analysis
    │   └── SKILL.md
    └── oberweb/         # Multi-dimensional web search
        └── SKILL.md
```

## Skill File Format

Each skill is a Markdown file with YAML frontmatter:

```markdown
---
name: skillname
description: When to use this skill - triggers skill selection
---

# Skill Title

[Workflow steps, phases, decision tables, output formats]
```

The `description` field is critical - it tells Claude when to invoke the skill.

All skills display their version at runtime by reading from `.claude-plugin/plugin.json`, which serves as the single source of truth for the plugin version.

## Installation

Install via the RTD marketplace:

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
```

## Skills

| Skill | Purpose |
|-------|---------|
| **oberagent** | Enforces oberprompt principles before any agent dispatch |
| **obercreate** | Skill creation and review with checklist-driven quality gates |
| **oberprompt** | Research-backed prompt engineering for LLM systems |
| **obershot** | Context-efficient screenshot capture and analysis; supports full screen, active window, or named window capture (`--mode window --name "Name"`) via thegrid integration |
| **oberweb** | Multi-dimensional web search with parallel sonnet subagents that extract and distill (not summarize) precise information |

