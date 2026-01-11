# Anthropic Best Practices Research

**Date:** 2026-01-11
**Research Method:** Multi-agent parallel search with 4 specialized subagents

## Sources Consulted

### Official Anthropic Documentation
- [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Prompt Engineering Overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview)
- [Claude 4 Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)

### Anthropic Engineering Blog
- [Equipping Agents for the Real World with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Official Repositories
- [anthropics/skills](https://github.com/anthropics/skills) - Official skills repository
- [anthropics/claude-code](https://github.com/anthropics/claude-code) - Plugins directory
- [Agent Skills Specification](https://agentskills.io/specification)

---

## 1. SKILL.md Structure Requirements

### YAML Frontmatter Schema

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | Max 64 chars. Lowercase letters, numbers, hyphens only. Must match directory name. |
| `description` | **Yes** | Max 1024 chars. Primary trigger mechanism - must include when to use. |
| `license` | No | License name or reference |
| `compatibility` | No | Max 500 chars |
| `metadata` | No | Key-value mapping |
| `allowed-tools` | No | Space-delimited pre-approved tools |

### Name Validation Rules

**Valid:** `pdf-processing`, `code-review`, `data-analysis`
**Invalid:** `PDF-Processing` (uppercase), `-pdf` (leading hyphen), `pdf--review` (consecutive hyphens)

### Size Constraints

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| SKILL.md lines | < 500 | Context efficiency |
| Description | < 1024 chars | Frontmatter parsing |
| Instructions | < 5000 tokens | Level 2 context budget |

---

## 2. Progressive Disclosure (Three-Level Context)

| Level | Content | Load Time | Token Budget |
|-------|---------|-----------|--------------|
| 1. Metadata | name + description | Always loaded | ~100 tokens |
| 2. Instructions | SKILL.md body | When skill triggers | <5000 tokens |
| 3. Resources | scripts/, references/, assets/ | On-demand | As needed |

**Key Principles:**
- Keep SKILL.md lean, defer details to reference files
- Avoid deeply nested references (one level deep max)
- Use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin paths

---

## 3. Description Writing Best Practices

### The Golden Rule

> The `description` field is the **primary triggering mechanism**. Claude uses semantic matching on descriptions to decide when to apply skills.

### Structure

```
[What it does] + [When to use it with specific triggers]
```

### Example Patterns

**Good:**
```yaml
description: Use when encountering ANY bug, error, unexpected behavior, test failure, crash, wrong output. Triggers on "debug", "fix", "broken", "failing", "investigate", "figure out why", "not working".
```

**Bad:**
```yaml
description: A debugging skill for Claude Code.
```

### Checklist

- [ ] Leads with trigger conditions ("Use when...")
- [ ] Includes specific symptom keywords
- [ ] Uses imperative language
- [ ] Explains motivation (why it matters)
- [ ] Under 1024 characters

---

## 4. Prompt Engineering for Skills

### Core Principles from Anthropic

| Principle | Application |
|-----------|-------------|
| **Be explicit** | State exact triggers and outcomes |
| **Provide context** | Explain *why*, not just *what* |
| **Right altitude** | Specific enough to guide, flexible enough to adapt |
| **Positive framing** | Tell what to do, not just what to avoid |
| **Token efficiency** | Front-load critical info |

### Claude 4.x Specific Guidance

1. **Steerable intensity** - Claude Opus 4.5 is MORE responsive to prompts. Replace aggressive language:
   - Before: "CRITICAL: You MUST use this tool when..."
   - After: "Use this tool when..."

2. **Action vs suggestion** - Be explicit about expected behavior:
   - Before: "Can you suggest changes?"
   - After: "Make these changes."

3. **Thinking sensitivity** - When extended thinking disabled, avoid "think". Use "consider", "evaluate".

---

## 5. Agent Orchestration Patterns

### Orchestrator-Workers Pattern

From Anthropic's multi-agent research system:

```
Lead Agent (Opus 4)
    ├── Subagent 1 (Sonnet 4)
    ├── Subagent 2 (Sonnet 4)
    └── Subagent 3 (Sonnet 4)
```

**Performance:** Opus lead + Sonnet subagents outperformed single Opus by 90.2%.

### Subagent Dispatch Requirements

Each subagent needs explicit:
- **Objective** - What to accomplish
- **Output format** - Expected structure
- **Tool guidance** - Which tools and how
- **Task boundaries** - In/out of scope
- **Effort scaling** - Expected tool call count

### Effort Scaling Rules

| Query Type | Subagents | Tool Calls/Agent |
|------------|-----------|------------------|
| Simple fact-finding | 1 | 3-10 |
| Direct comparisons | 2-4 | 10-15 |
| Complex queries | 3-5 | 3+ in parallel |

### Checkpoint Implementation

1. Save state to external memory before 200K tokens
2. Commit progress to git incrementally
3. Write to progress files
4. Store completed phases externally

### Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Insufficient task clarity | Duplication, misinterpretation | Detailed objectives |
| Too many subagents | Token waste | Embed scaling rules |
| Endless searching | Never terminates | Max iterations, stopping conditions |
| Premature completion | Incomplete work | Explicit feature checklists |
| Context exhaustion | Lost state mid-task | External memory before truncation |

---

## 6. Token Economics

| Interaction Type | Token Multiplier |
|------------------|------------------|
| Chat | 1x (baseline) |
| Single agent | 4x |
| Multi-agent | ~15x |

> "For economic viability, multi-agent systems require tasks where the value is high enough to pay for increased performance"

---

## 7. Real-World Patterns from GitHub

### Directory Structure (Consensus)

```
skill-name/
├── SKILL.md              # Required
├── scripts/              # Executable code
├── references/           # Extended documentation
└── assets/               # Templates, static resources
```

### Content Organization

**Pattern 1: High-level guide + references**
```markdown
## Advanced features
- **Form filling**: See [FORMS.md](references/FORMS.md)
```

**Pattern 2: Hierarchical numbering (complex workflows)**
- 0XX - Shared workers
- 1XX - Documentation
- 2XX - Planning
- 3XX - Task management
- 4XX - Execution
- 5XX - Quality gates

### Template Ownership

Each skill owns its templates in `references/` (Single Source of Truth) rather than copying templates project-wide.

---

## 8. Validation Checklist for oberskills

Based on this research, validate:

### Frontmatter
- [ ] `name` lowercase, hyphens only, matches directory
- [ ] `name` ≤ 64 characters
- [ ] `description` ≤ 1024 characters
- [ ] `description` includes trigger keywords

### Content
- [ ] SKILL.md < 500 lines
- [ ] No deeply nested references
- [ ] Uses positive framing (do X, not don't do Y)
- [ ] Right altitude (not over-constrained)

### Agent Dispatch (for oberexec)
- [ ] Subagents have explicit objectives
- [ ] Output format specified
- [ ] Effort scaling embedded
- [ ] Checkpoints use external memory
- [ ] Max iterations defined

### Description Quality
- [ ] Leads with trigger conditions
- [ ] Includes symptom keywords
- [ ] Uses imperative language
- [ ] Explains motivation
