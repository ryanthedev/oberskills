---
name: tryhard
description: Deep context mode - infers the ask, then launches targeted agents for git, logs, and code before tackling complex tasks
---

# Tryhard

Use your skills and MCP tools to help with this task.

## Step 1: Infer the Ask

Parse the user's request to understand:
- What feature/component/area is involved?
- What action are they trying to take? (build, fix, understand, refactor)
- What keywords/terms identify the relevant code?

**Output:** Clear statement of what we're doing and the keywords to search for.

## Step 2: Gather Targeted Context (PARALLEL)

**CRITICAL:** Use the `Task` tool to dispatch these as subagents. This keeps discovery OUT of main context - only summaries return.

**Launch ALL THREE in a single message (parallel execution):**

### Agent 1: Git History (targeted)
```
Task(
  subagent_type="Explore",
  description="Git history for [keywords]",
  prompt="Task: [description from Step 1]
  Keywords: [keywords from Step 1]

  Find git history relevant to this task:
  1. Search commits touching files related to [keywords]
  2. Check staged/unstaged changes in relevant areas
  3. Look for recent refactors that might affect this

  Return: Summary of relevant commits and changes"
)
```

### Agent 2: Log Files (targeted)
```
Task(
  subagent_type="Explore",
  description="Logs for [keywords]",
  prompt="Task: [description from Step 1]
  Keywords: [keywords from Step 1]

  Find logs relevant to this task:
  1. Check CLAUDE.md, README for log locations
  2. Search logs for [keywords], errors, warnings
  3. Look for recent entries related to the task

  Return: Summary of relevant log entries"
)
```

### Agent 3: Code Structure (targeted)
```
Task(
  subagent_type="Explore",
  description="Code for [keywords]",
  prompt="Task: [description from Step 1]
  Keywords: [keywords from Step 1]

  Find code relevant to this task:
  1. Search for files/functions matching [keywords]
  2. Trace entry points and call chains
  3. Identify key files and their relationships

  Return: Summary of relevant code structure with key files:lines"
)
```

**Wait for all agents to complete before proceeding.**

## Step 3: Apply Your Skills

Check if any skills are relevant to this task and use them. Consider using the sequential-thinking MCP tool if the problem is complex and would benefit from methodical step-by-step reasoning.

## Step 4: Execute the Task

With context gathered and skills applied, proceed to execute the user's request.
