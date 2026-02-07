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
├── examples/            # Real-world usage examples
│   ├── oberagent-code-review.md
│   ├── oberagent-model-selection.md
│   └── oberweb-ghostty-floating-terminal.md
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
| **obershot** | Context-efficient screenshot capture and analysis |
| **oberweb** | Multi-dimensional web search with parallel haiku subagents |

## Examples

The `examples/` folder contains real-world transcripts showing how skills work together:

| Example | Demonstrates |
|---------|--------------|
| [oberagent-code-review](examples/oberagent-code-review.md) | Checklist validation, skill inheritance |
| [oberagent-model-selection](examples/oberagent-model-selection.md) | Model tier selection with oberprompt |
| [oberweb-ghostty-floating-terminal](examples/oberweb-ghostty-floating-terminal.md) | Parallel search dimensions |
