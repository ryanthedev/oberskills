# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is a Claude Code plugin containing reusable skills - workflow patterns that guide Claude through specific tasks like debugging, prompt engineering, and agent dispatch.

## Structure

```
oberskills/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest (name, version, description)
├── assets/              # Demo screenshots and images
├── examples/            # Real-world usage examples
│   ├── oberplan-multi-line-picker.md
│   └── oberweb-ghostty-floating-terminal.md
├── research/            # Research papers and best practices
│   └── anthropic-best-practices.md
└── skills/
    ├── oberagent/       # Agent dispatch enforcement
    │   └── SKILL.md
    ├── oberdebug/       # Hypothesis-driven debugging
    │   └── SKILL.md
    ├── oberexec/        # Subagent plan execution
    │   └── SKILL.md
    ├── oberhack/        # Quick hack mode
    │   └── SKILL.md
    ├── oberplan/        # Meta-planning orchestration
    │   └── SKILL.md
    ├── oberprompt/      # Prompt engineering
    │   ├── SKILL.md
    │   └── optimization-reference.md
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
| **oberplan** | Meta-planning orchestration with lens skills and final review |
| **oberexec** | Checklist-driven plan executor with persistent execution file |
| **oberweb** | Multi-dimensional web search with parallel haiku subagents |
| **oberhack** | Quick hack mode - mini planning in-memory, direct subagent dispatch, no files |

## Examples

The `examples/` folder contains real-world transcripts showing how skills work together:

| Example | Demonstrates |
|---------|--------------|
| [oberplan-multi-line-picker](examples/oberplan-multi-line-picker.md) | oberplan + code-foundations + oberagent orchestrating a feature with review checkpoints |
| [oberweb-ghostty-floating-terminal](examples/oberweb-ghostty-floating-terminal.md) | oberweb + oberagent parallel search for troubleshooting research |
