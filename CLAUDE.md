# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Purpose

This is an opencode plugin containing reusable skills and agents — workflow patterns that guide Claude through specific tasks like prompt engineering, agent dispatch, skill creation, screenshot analysis, web search, and human-sounding writing.

## Structure

```
oberskills/
├── .opencode/
│   └── opencode.json        # Plugin configuration
├── assets/                  # Demo screenshots and images
├── install-manifest.json    # Plugin manifest for opencode
├── research/                # Research papers and best practices
│   ├── agentic-orchestration/
│   ├── anthropic-best-practices.md
│   ├── FRAMEWORK-skill-best-practices.md
│   ├── GUIDE-skill-compliance-and-persuasion.md
│   ├── REFERENCE-skill-structure-and-constraints.md
│   └── references/
└── skills/                  # Skills (SKILL.md + supporting files)
    ├── agent/
    │   └── SKILL.md
    ├── prompt/
    │   ├── SKILL.md
    │   └── optimization-reference.md
    ├── shot/
    │   ├── SKILL.md
    │   ├── agents/
    │   │   └── shot.md
    │   └── scripts/
    │       └── capture.py
    ├── skill-craft/
    │   ├── SKILL.md
    │   ├── agents/
    │   ├── references/
    │   └── scripts/
    ├── web-research/
    │   └── SKILL.md
    └── write/
        ├── SKILL.md
        ├── elements-of-style.md
        └── references/
            └── ai-writing-patterns.md
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

The `description` field is critical — it tells Claude when to invoke the skill.

Supporting files (references, scripts, agents) live under each skill directory and are referenced using relative paths from the skill directory.

## Installation

Install via opencode:

```bash
/plugin install oberskills
```

## Skills

| Skill | Purpose |
|-------|---------|
| **agent** | Enforces prompt principles before any agent dispatch |
| **prompt** | Research-backed prompt engineering for LLM systems |
| **shot** | Screenshot intake + dispatches shot agent for context-efficient capture + haiku analysis |
| **skill-craft** | Skill creation and review with checklist-driven quality gates |
| **web-research** | Multi-dimensional web search with parallel sonnet subagents that extract and distill (not summarize) precise information |
| **write** | Human-sounding writing via Strunk's rules + research-backed AI pattern detection (em-dashes, aidiolect, burstiness, voice) |
