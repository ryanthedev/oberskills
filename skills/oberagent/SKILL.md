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
1. Invoke oberprompt skill (MANDATORY - loads prompt engineering guidance)
      ↓
2. Define Agent Purpose (what outcome, not what actions)
      ↓
3. Select Agent Type (match to purpose)
      ↓
4. Identify Applicable Skills (subagents don't inherit skill awareness)
      ↓
5. Write Prompt (following oberprompt template + skill instructions)
      ↓
6. Validate (checklist)
```

**Step 1 is non-negotiable.** The oberprompt skill provides the constraint budget, progressive disclosure patterns, and validation checklist that make agent prompts effective. Without it, you're guessing.

---

## Step 1: Invoke oberprompt

**Before anything else, invoke the oberprompt skill.**

```
Invoke skill: oberprompt
```

This loads:
- Constraint budget guidelines for your model tier
- Progressive disclosure patterns
- Validation checklist
- Anti-patterns to avoid

**Do NOT skip this step.** Even if you "know" oberprompt principles or invoked it earlier in the conversation, invoke it again. Each agent dispatch is a fresh decision point requiring the full checklist.

---

## Step 2: Define Agent Purpose

Before writing ANY prompt, answer:

| Question | Bad Answer | Good Answer |
|----------|------------|-------------|
| What outcome do I need? | "Search for files" | "Find where user auth is implemented" |
| What will I do with the result? | "Look at it" | "Understand the pattern to add OAuth" |
| How will I know it succeeded? | "It returns something" | "I have file paths + understand the approach" |

**If you can't answer these clearly, you're not ready to dispatch an agent.**

---

## Step 3: Select Agent Type

| Agent Type | Use When | Don't Use When |
|------------|----------|----------------|
| **Explore** | Need to understand codebase structure, find patterns | You know the exact file/function |
| **general-purpose** | Multi-step research, complex questions | Simple file reads |
| **Bash** | Git operations, builds, terminal commands | File content operations |
| **Plan** | Need implementation strategy | Ready to implement |

**Match agent to purpose, not to your first instinct.**

---

## Step 4: Identify Applicable Skills

**Subagents don't inherit skill awareness.** They start fresh without knowing which skills you have access to. You must explicitly pass relevant skills.

### Process

1. **Review your available skills** - Check what skills exist that could apply to the agent's task
2. **Match skills to the agent's work** - What type of work is the agent doing?
3. **Include skill invocation in prompt** - Tell the agent to invoke relevant skills first

### Skill-to-Task Mapping

| If Agent Will Do... | Consider These Skills |
|---------------------|----------------------|
| Write/modify code | code-foundations (or relevant coding skill) |
| Review code/plans | code-foundations (or relevant review skill) |
| Debug issues | oberdebug |
| Design interfaces | (relevant design skill) |
| Build features | oberplan |
| Write prompts | oberprompt |

### Example

**Without skill inheritance (gap):**
```
Review the implementation plan and identify any issues.
```

**With skill inheritance (correct):**
```
First invoke the code-foundations skill. Then review the
implementation plan and identify any issues with the design.
```

### When to Skip

- **Explore agents** doing pure search/navigation - no skills needed
- **Bash agents** running simple commands - no skills needed
- **Agents doing research only** - typically no skills needed

**When in doubt, pass the skill.** Extra skill invocation is cheap; missing it causes failures.

---

## Step 5: Write the Prompt

**Use oberprompt guidance.** Since you invoked oberprompt in Step 1, apply:
- Constraint budget for your model tier
- Progressive disclosure (start simple, add constraints only on failure)
- Outcome-focused framing (what you need, not how to get it)

### Template

```
[SKILLS]: "First invoke [skill-name]" (if applicable - see Step 4)

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

## Step 6: Validation Checklist

**Complete EVERY item before dispatching.**

| # | Check | Done? |
|---|-------|-------|
| 0 | oberprompt skill invoked (Step 1 completed) | [ ] |
| 1 | Purpose is an OUTCOME, not a list of actions | [ ] |
| 2 | Agent type matches the purpose | [ ] |
| 3 | Relevant skills identified and passed to agent | [ ] |
| 4 | Prompt is ≤3 sentences (or justified if longer) | [ ] |
| 5 | No step-by-step instructions telling agent HOW | [ ] |
| 6 | Context included ONLY if agent truly lacks it | [ ] |

**Check 0 is the gatekeeper.** If you didn't invoke oberprompt, checks 1-6 are based on guesswork.

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
| "I know oberprompt, skip Step 1" | You'll miss the checklist and constraint budget | Invoke oberprompt every time |
| "I already invoked oberprompt earlier" | Each dispatch is a fresh decision point | Invoke oberprompt for EACH agent |
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

**oberprompt is invoked at the start of every oberagent workflow (Step 1).**

This ensures you have access to:
- Full constraint budget guidelines for your model tier
- Complete progressive disclosure patterns
- Validation checklist
- Anti-patterns and red flags

oberagent orchestrates the workflow; oberprompt provides the prompt engineering substance.
