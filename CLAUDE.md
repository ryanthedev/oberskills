# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a collection of personal Claude Code skills - reusable workflow patterns that guide Claude through specific tasks like debugging.

## Structure

```
skills/
  <skill-name>/
    SKILL.md       # Skill definition with frontmatter (name, description) and workflow steps
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

Skills are symlinked to `~/.claude/skills/` for Claude Code to discover them:

```bash
ln -s /path/to/oberskills/skills/* ~/.claude/skills/
```
