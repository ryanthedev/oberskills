# Example: oberweb Ghostty Floating Terminal Research

This example demonstrates how oberweb orchestrates multi-dimensional web research using parallel haiku subagents to troubleshoot a Ghostty floating terminal issue.

## Task Summary

**Request:** Debug Ghostty floating terminal creating new instances instead of reusing the same terminal.

**Skills Used:**
- `oberweb` - Multi-dimensional web search orchestrator
- `oberagent` - Subagent dispatch enforcement
- `oberprompt` - Prompt engineering (invoked by oberagent)

**Outcome:** 5 parallel search agents returned comprehensive results covering config, WM integration, and toggle scripts.

---

## Workflow Phases

### Phase 1: Skill Invocation

```
User: ok, I need help with my ghostty floating terminal. Whenever I got to hit
the hot key a second terminal slides down. it doesn't reuse the same terminal.
I don't know why. I got this working once before, but it has since stopped.
How can I just have a single floating terminal follow my focus around when
I go to different screens?

Claude: I'll research this Ghostty floating terminal issue using multi-dimensional
web search.

→ Skill(oberweb)
```

**Key:** oberweb triggered because this is a troubleshooting query that benefits from multiple search angles.

---

### Phase 2: oberagent Chain for Orchestrator

```
Claude:
→ Skill(oberagent)
→ Skill(oberprompt)

Oberagent Checklist - Orchestrator:
- oberprompt invoked
- Outcome: Plan search dimensions for ghostty floating terminal research
- Agent type: general-purpose
- Model: haiku (fast planning task)
- Skills: none (pure coordination)
- Prompt ≤3 sentences, outcome-focused

→ Task(oberweb: plan search dimensions) Haiku 4.5
  Done (1 tool use · 16.2k tokens · 9s)
```

**Key:** oberagent was invoked first, which invoked oberprompt. The orchestrator runs on haiku for speed.

---

### Phase 3: oberagent Chain for Search Agents

```
Claude: Now I'll invoke oberagent for the search agents, then dispatch them in parallel.

→ Skill(oberagent)

Oberagent Checklist - Search Agents (5 parallel):
- oberprompt already loaded
- Outcome: Find relevant info + URLs for each dimension
- Agent type: general-purpose
- Model: haiku (I/O bound, parallel, cost-sensitive)
- Skills: none (search/fetch only)
- Prompts concise, outcome-focused
```

**Key:** oberagent validates ALL search agent prompts before parallel dispatch. One oberagent invocation can validate multiple similar prompts.

---

### Phase 4: Parallel Search Execution

```
Claude: Dispatching 5 search agents in parallel:

→ Running 5 Task agents…
   ├─ oberweb: search ghostty config · 4 tool uses · 16.7k tokens
   │  Done
   ├─ oberweb: search quake terminal · 4 tool uses · 16.9k tokens
   │  Fetch: https://faq.i3wm.org/question/3790/hotkey-for-ope…
   ├─ oberweb: search WM integration · 4 tool uses · 16.9k tokens
   │  Done
   ├─ oberweb: search instance mgmt · 5 tool uses · 17.6k tokens
   │  Done
   └─ oberweb: search toggle scripts · 6 tool uses · 18.5k tokens
      Fetch: https://blog.meain.io/2020/tmux-flating-scratch-t…
```

**Key Observations:**

| Dimension | Purpose | Tool Uses |
|-----------|---------|-----------|
| ghostty config | Official config options for floating/quake mode | 4 |
| quake terminal | General quake/dropdown terminal patterns | 4 |
| WM integration | Window manager specific (i3, sway, yabai) | 4 |
| instance mgmt | Single instance vs multi-instance control | 5 |
| toggle scripts | Scripts for toggle behavior | 6 |

**Why 5 dimensions:**
- Ghostty-specific config (the obvious search)
- Quake terminal patterns (general concept)
- WM integration (the problem is likely WM-side)
- Instance management (the core issue: reuse vs new)
- Toggle scripts (working solutions from others)

---

## Search Dimensions Explained

### Dimension 1: Ghostty Config
```
Search: "ghostty floating terminal config quake mode"
```
Covers official Ghostty configuration for dropdown/floating behavior.

### Dimension 2: Quake Terminal Patterns
```
Search: "quake terminal single instance toggle hotkey"
```
Generic patterns for dropdown terminals (not Ghostty-specific).

### Dimension 3: WM Integration
```
Search: "ghostty floating terminal i3 sway yabai focus follows"
```
Window manager-specific configuration for floating windows.

### Dimension 4: Instance Management
```
Search: "ghostty single instance reuse terminal window"
```
How to prevent new instances from spawning.

### Dimension 5: Toggle Scripts
```
Search: "toggle floating terminal script focus workspace"
```
Community scripts for toggle behavior with focus following.

---

## Why This Pattern Works

### Problem: Single Search Misses Angles

A single search like "ghostty floating terminal not reusing" would:
- Only find direct matches
- Miss WM-specific solutions
- Miss general dropdown terminal patterns
- Miss community scripts

### Solution: Multi-Dimensional Coverage

| Single Search | oberweb |
|---------------|---------|
| 1 angle | 5 angles |
| 1-2 results | 10-15 results |
| May miss root cause | Covers WM, config, scripts |
| Sequential | Parallel |

### Context Efficiency

| Approach | Tokens Returned |
|----------|-----------------|
| 5 raw WebFetch calls | ~5000+ |
| oberweb synthesis | ~1000-1500 |

Each search agent filters to 2-3 sentences per URL. Synthesis removes duplicates.

---

## Key Patterns Demonstrated

### 1. oberagent for Every Dispatch

```
Orchestrator: oberagent → oberprompt → dispatch
Search agents: oberagent → dispatch (oberprompt cached)
Synthesis: oberagent → dispatch
```

Total oberagent invocations: 3 (orchestrator, search batch, synthesis)

### 2. Haiku Throughout

All agents use haiku because:
- Web search is I/O bound, not reasoning bound
- Parallel execution benefits from fast response
- Cost scales with dimension count
- Results validated by source URLs

### 3. Parallel Dispatch

```
// Single message with 5 Task calls
Task(haiku, "search ghostty config", ...)
Task(haiku, "search quake terminal", ...)
Task(haiku, "search WM integration", ...)
Task(haiku, "search instance mgmt", ...)
Task(haiku, "search toggle scripts", ...)
```

All 5 searches run simultaneously. Total time = slowest agent, not sum of all.

### 4. Constraint Enforcement

Each search agent constrained to:
- MAX 2-3 sentences per URL
- MAX 5 URLs total
- Only directly relevant results

This prevents context pollution in the main agent.

---

## When to Use oberweb

**Good candidates:**
- Troubleshooting issues (multiple possible causes)
- Learning new concepts (docs, tutorials, discussions)
- Comparing options (multiple perspectives)
- Researching errors (Stack Overflow, GitHub issues, docs)

**Skip oberweb when:**
- Looking for a specific page (use WebFetch directly)
- Simple factual query (use WebSearch once)
- Already know the source (fetch it directly)

---

## Timing Analysis

```
┌─────────────────────────────────────────────────────────────┐
│ Phase                          │ Time    │ Model           │
├────────────────────────────────┼─────────┼─────────────────┤
│ Orchestrator (plan dimensions) │ 9s      │ haiku           │
│ Search agents (5 parallel)     │ ~15s    │ haiku × 5       │
│ Synthesis                      │ ~5s     │ haiku           │
├────────────────────────────────┼─────────┼─────────────────┤
│ Total                          │ ~30s    │                 │
└─────────────────────────────────────────────────────────────┘
```

Compare to sequential approach: 5 × 15s = 75s (2.5x slower)
