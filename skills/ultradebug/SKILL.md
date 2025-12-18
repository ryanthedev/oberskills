---
name: ultradebug
description: Use when debugging any bug or error - guides a hypothesis-driven debugging session with instrumentation loops until root cause is confirmed with evidence
---

# Ultradebug

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

### Step 3: Check Existing Logs

| Situation | Action |
|-----------|--------|
| Logs in prompt | Parse for timestamps, errors, stack traces |
| Know log paths | Check CLAUDE.md, README, common locations |
| Need to discover | Ask user or check framework conventions |
| Can infer | Use stack traces, error messages as starting point |

### Step 4: Check Git History

Dispatch subagent with:
```
Issue: [description from Step 1]
Look for: commits touching [relevant files/keywords from logs]
Return: Summary of potentially related changes
```

**Output:** Initial hypothesis about root cause.

## Instrumentation Loop

### Step 5: Propose Debug Logs

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

**Format:** `[ULTRADEBUG-001] func=X var=Y value=Z`

**Include expected outcome:**
> "If hypothesis is correct, you should see X. If wrong, you'll see Y instead."

### Step 6: User Executes

User options:
- Adds the proposed debug logs
- Runs the reproduction steps
- Reports back: pastes output OR says "check logs at [path]"

### Step 7: Analyze Evidence

| Result | Action |
|--------|--------|
| Confirmed | Exit loop → Step 8 |
| Refuted | Refine hypothesis → Back to Step 5 |
| Inconclusive | Add more instrumentation → Back to Step 5 |

## Exit

### Step 8: Output Confirmed Root Cause

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

- Proposing fixes before evidence confirms hypothesis
- Skipping instrumentation: "I'm pretty sure it's X"
- Exiting loop without confirmed evidence
- Fixing at symptom location instead of tracing to source

**All of these mean:** Stay in the loop. Get proof first.
