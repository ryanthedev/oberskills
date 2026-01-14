---
name: oberdebug
description: Use when encountering ANY bug, error, unexpected behavior, test failure, crash, wrong output, missing output, flaky behavior, race condition, regression, "it doesn't work", "something's wrong", "not working as expected", "should do X but does Y", broken functionality, logic error, runtime error, exception, assertion failure, timeout, hang, or any situation where code behavior differs from intent. Triggers on "debug", "fix", "broken", "failing", "investigate", "figure out why", "not working".
---

# Oberdebug

## Overview

**Core principle:** Propose debug instrumentation, user executes, analyze evidence. Loop until confirmed. Never fix without proof.

Agent proposes → User runs → Agent analyzes → Repeat until confirmed

## Setup Phase

### Step 1: Infer the Issue

Parse the prompt and any provided assets:
- What symptom is described? (error, crash, unexpected behavior)
- What component/area is affected?
- Any error messages, stack traces, log snippets provided?

**Output:** Clear statement of what we're debugging.

### Step 2: Reproduction Check

**Ask:** "Can you reproduce this issue?"

- **YES** → Can add instrumentation and generate fresh evidence
- **NO** → Work with provided evidence only; may need more logs from user

### Step 3: Dispatch Discovery Agents (PARALLEL)

**CRITICAL:** Use the `Task` tool to dispatch these as subagents. This keeps discovery OUT of main context - only summaries return.

**MANDATORY: Invoke oberagent before ANY dispatch.**

```
→ Skill(oberagent)
  Agent type: Explore
  Model: haiku (discovery tasks)
  Skills: none (exploration only)
```

oberagent validates the prompt structure and model selection. Only after oberagent approval, dispatch the agents.

**Launch ALL THREE in a single message (parallel execution):**

#### Agent 1: Log Analysis
```
Task(
  subagent_type="Explore",
  model="haiku",
  description="Analyze logs for [issue]",
  prompt="Issue: [description from Step 1]

  Find and analyze relevant logs:
  1. Check CLAUDE.md, README, config files for log locations
  2. Search common paths: logs/, *.log, tmp/, ~/.local/state/
  3. Look for errors, warnings, stack traces related to: [keywords]

  Return: Summary of relevant log entries with timestamps and error patterns"
)
```

#### Agent 2: Git History
```
Task(
  subagent_type="Explore",
  model="haiku",
  description="Check git history for [issue]",
  prompt="Issue: [description from Step 1]

  Analyze git history for related changes:
  1. Check last 20 commits for changes to [relevant files/keywords]
  2. Look for recent refactors that might have introduced the bug
  3. Check staged/unstaged changes

  Return: Summary of potentially related commits with dates and descriptions"
)
```

#### Agent 3: Code Path Analysis
```
Task(
  subagent_type="Explore",
  model="haiku",
  description="Trace code paths for [issue]",
  prompt="Issue: [description from Step 1]

  Trace the code paths involved:
  1. Find entry points for the affected feature
  2. Map the call chain from trigger to symptom
  3. Identify state changes along the path

  Return: Summary of code flow with key files:lines"
)
```

**Wait for all agents to complete, then synthesize findings into initial hypothesis.**

**Output:** Initial hypothesis about root cause based on agent findings.

## Instrumentation Loop

### Step 4: Propose Debug Logs

Based on hypothesis, propose instrumentation:

**Where to add:**
- Entry/exit of suspected functions
- Before/after state changes
- At decision points (if/else branches)
- Around external calls (APIs, DB, file I/O)

**What to log:**
- Variable values, function arguments, return values
- Timestamps (for timing issues)
- Stack traces (for "how did we get here")

**Format:** `[OBERDEBUG-001] func=X var=Y value=Z`

**Include expected outcome:**
> "If hypothesis is correct, you should see X. If wrong, you'll see Y instead."

### Step 5: User Executes

User options:
- Adds the proposed debug logs
- Runs the reproduction steps
- Reports back: pastes output OR says "check logs at [path]"

### Step 6: Analyze Evidence

| Result | Action |
|--------|--------|
| Confirmed | Exit loop → Step 7 |
| Refuted | Refine hypothesis → Back to Step 4 |
| Inconclusive | Add more instrumentation → Back to Step 4 |

## Exit

### Step 7: Output Confirmed Root Cause

When loop exits with confirmation, provide:

```
ROOT CAUSE CONFIRMED:
- Issue: [what's happening]
- Location: [file:line]
- Evidence: [actual log output proving it]
- Cause: [why it happens]

Suggested fix: [proposal based on confirmed understanding]
```

This output goes to main agent or user for fix implementation.

## Red Flags - STOP

- **Dispatching agents without invoking oberagent first**
- **Using wrong model tier** (Explore = haiku, not sonnet/opus)
- Proposing fixes before evidence confirms hypothesis
- Skipping instrumentation: "I'm pretty sure it's X"
- Exiting loop without confirmed evidence
- Fixing at symptom location instead of tracing to source

**All of these mean:** Stay in the loop. Get proof first.
