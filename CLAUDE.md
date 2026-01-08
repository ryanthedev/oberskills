# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable skills - workflow patterns that guide Claude through specific tasks like debugging, prompt engineering, and agent dispatch.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest (name, version, description)
└── skills/
    ├── oberagent/       # Agent dispatch enforcement
    │   └── SKILL.md
    ├── oberdebug/       # Hypothesis-driven debugging
    │   └── SKILL.md
    └── oberprompt/      # Prompt engineering
        ├── SKILL.md
        └── optimization-reference.md
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

## Installation

Install via the RTD marketplace:

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install oberskills@rtd
```

## Skills

| Skill | Purpose |
|-------|---------|
| **oberdebug** | Hypothesis-driven debugging with evidence-based root cause analysis |
| **oberprompt** | Research-backed prompt engineering for LLM systems |
| **oberagent** | Enforces oberprompt principles before any agent dispatch |
