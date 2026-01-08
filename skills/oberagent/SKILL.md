---
name: oberagent
description: CRITICAL - Invoke FIRST before ANY Task tool call. This skill gates all agent dispatch. If you are about to use Task tool, STOP and invoke this skill. Enforces oberprompt principles. Triggers on "Task tool", "launch agent", "spawn agent", "dispatch agent", "parallel agents", "subagent", "background agent", "Explore agent", "general-purpose agent", "Bash agent", "Plan agent".
---

# Skill: oberagent

Meta-skill that enforces prompt engineering best practices before dispatching agents.

## The Iron Law

```
NO AGENT PROMPT SHIPS WITHOUT COMPLETING THE AGENT PROMPT CHECKLIST
```

This applies to:
- "Quick" agent dispatches
- "Simple" Task tool calls
- Agents that "just need to search"
- Your 10th agent after 9 successes

**Skipping this workflow = accepting subagent failures.**

---

## Required Workflow

```
1. Define Agent Purpose (what outcome, not what actions)
      ↓
2. Select Agent Type (match to purpose)
      ↓
3. Apply Oberprompt Principles (constraint budget, progressive disclosure)
      ↓
4. Write Prompt (following template)
      ↓
5. Validate (checklist)
```

---

## Step 1: Define Agent Purpose

Before writing ANY prompt, answer:

| Question | Bad Answer | Good Answer |
|----------|------------|-------------|
| What outcome do I need? | "Search for files" | "Find where user auth is implemented" |
| What will I do with the result? | "Look at it" | "Understand the pattern to add OAuth" |
| How will I know it succeeded? | "It returns something" | "I have file paths + understand the approach" |

**If you can't answer these clearly, you're not ready to dispatch an agent.**

---

## Step 2: Select Agent Type

| Agent Type | Use When | Don't Use When |
|------------|----------|----------------|
| **Explore** | Need to understand codebase structure, find patterns | You know the exact file/function |
| **general-purpose** | Multi-step research, complex questions | Simple file reads |
| **Bash** | Git operations, builds, terminal commands | File content operations |
| **Plan** | Need implementation strategy | Ready to implement |

**Match agent to purpose, not to your first instinct.**

---

## Step 3: Apply Oberprompt Principles

### Constraint Budget for Agent Prompts

| Prompt Length | Assessment |
|---------------|------------|
| 1-3 sentences | Appropriate for focused tasks |
| 4-7 sentences | Review: all necessary? |
| 8+ sentences | Likely over-constrained. Simplify. |

### Progressive Disclosure for Agents

Start simple. Add detail ONLY when agents fail.

| Level | When to Use | Example |
|-------|-------------|---------|
| 1. Outcome only | Always start here | "Find where user authentication is implemented" |
| 2. + Scope hint | Agent searches too broadly | "...focus on src/auth directory" |
| 3. + Format request | Results hard to use | "...return file paths with brief descriptions" |
| 4. + Constraints | Specific failures | "...exclude test files" |

**Do NOT start at level 4.**

### What NOT to Include

| Don't Include | Why |
|---------------|-----|
| Step-by-step instructions | Agents know how to search/explore |
| Tool usage guidance | Agents have their own tool knowledge |
| Exhaustive constraints | Causes over-literal behavior |
| Implementation details | You're delegating the HOW |

---

## Step 4: Write the Prompt

### Template

```
[OUTCOME]: What you need to know/have when agent completes

[CONTEXT]: Only if agent lacks necessary background (usually unnecessary)

[SCOPE]: Optional narrowing (directory, file types, etc.)
```

### Examples

**Bad prompt (over-constrained):**
```
Search the codebase for authentication. Look in src/ directory.
Use Grep to find "auth" and "login". Then use Read to examine
each file. Return a list of all files with line numbers. Make
sure to check both .ts and .js files. Don't include node_modules.
Summarize what each file does.
```

**Good prompt (outcome-focused):**
```
Find where user authentication is implemented and explain the
current approach. I need to understand the pattern to add OAuth.
```

**Bad prompt (vague):**
```
Look at the code
```

**Good prompt (clear outcome):**
```
Find how API errors are handled and surfaced to users. I'm seeing
inconsistent error messages and need to understand the current pattern.
```

---

## Step 5: Validation Checklist

**Complete EVERY item before dispatching.**

| # | Check | Done? |
|---|-------|-------|
| 1 | Purpose is an OUTCOME, not a list of actions | [ ] |
| 2 | Agent type matches the purpose | [ ] |
| 3 | Prompt is ≤3 sentences (or justified if longer) | [ ] |
| 4 | No step-by-step instructions telling agent HOW | [ ] |
| 5 | Context included ONLY if agent truly lacks it | [ ] |

---

## Parallel Agent Dispatch

When dispatching multiple agents:

1. **Each agent gets its own oberagent checklist**
2. **Agents must be independent** - no agent depends on another's output
3. **Combine results after all complete**

### Parallel Dispatch Template

```
Agent 1: [Outcome A - independent]
Agent 2: [Outcome B - independent]
Agent 3: [Outcome C - independent]
```

**If agents depend on each other, run them sequentially.**

---

## Red Flags - STOP and Reconsider

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "I'll just tell it exactly what to do" | You're micromanaging. State the outcome. | Rewrite as outcome |
| "I need to explain the tools" | Agents know their tools | Remove tool guidance |
| "More detail = better results" | Often the opposite | Start with 1-2 sentences |
| "This is too simple" | Simple prompts often work best | Test before adding complexity |
| "I'll dispatch now, fix later" | You're creating rework | Complete checklist first |

---

## Debugging Failed Agents

When an agent returns poor results:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Too narrow results | Over-constrained prompt | Remove constraints, broaden scope |
| Too broad results | Vague outcome | Clarify what you need to KNOW |
| Wrong focus | Misleading context | Remove or rewrite context |
| Incomplete | Unclear success criteria | State how you'll use the result |

**First attempt:** Remove constraints, simplify prompt
**Not:** Add more instructions

---

## Integration with oberprompt

This skill applies oberprompt's core principles to agent prompts:

- **Prompting Inversion**: Agents are capable. Don't over-constrain.
- **Progressive Disclosure**: Start simple, add complexity only on failure.
- **Constraint Budget**: Agent prompts should be SHORT.
- **Outcome Focus**: Describe WHAT you need, not HOW to get it.

For full prompt engineering guidance, invoke the `oberprompt` skill.
