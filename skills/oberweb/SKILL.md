---
name: oberweb
description: Multi-dimensional web search orchestrator. Use when the user needs comprehensive web research that would benefit from parallel searches across different angles. Orchestrator grounds in local context, parallel sonnet agents extract quality information to files, then synthesis agent (user's model) produces grounded recommendations. Triggers on "research this", "find information about", "search the web for", "comprehensive search", "oberweb", or when a single search wouldn't capture all relevant aspects.
---

# Skill: oberweb

**On load:** Read `../../.claude-plugin/plugin.json` from this skill's base directory. Display `oberweb v{version}` before proceeding.

```
GROUND IN LOCAL CONTEXT. RETURN ONLY RELEVANT RESULTS WITH SOURCE URLS.
```

---

## Workflow

```
1. Invoke oberagent → Dispatch Orchestrator (sonnet)
   - Grounds in local context
   - Plans 2-5 search dimensions
      ↓
2. Invoke oberagent → Dispatch Search Agents (parallel sonnet)
   - oberagent handles oberprompt
   - Deep extraction to files
      ↓
3. Invoke oberagent → Dispatch Synthesis Agent (user's model)
   - Cross-references research files
   - Grounds against local context
      ↓
4. Return Results (relevant info + URLs only)
```

---

## Step 1: Dispatch Orchestrator

```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  description="oberweb: ground and plan search",
  prompt="OBJECTIVE: Ground this query in local context, then plan search dimensions.

  USER QUERY: [original query]

  PHASE 1 - GROUNDING:
  Check local files relevant to this query (package.json, configs, code).
  Extract: versions, settings, gaps.

  PHASE 2 - DIMENSIONS:
  Based on grounding, identify 2-5 search dimensions targeting different angles.

  RETURN FORMAT:
  LOCAL CONTEXT:
  - [key fact]
  ...

  DIMENSIONS:
  - [dimension]: [search query grounded in context]
  ..."
)
```

---

## Step 2: Dispatch Search Agents

Show user the search plan, then dispatch all in parallel.

Each agent writes to `~/.local/state/oberweb/{timestamp}-{query-slug}-{dimension}.md`

```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  description="oberweb: search [dimension]",
  prompt="OBJECTIVE: Extract and distill precise information for this search dimension.
  Do NOT summarize. Pull exact details, quote sources, preserve specificity.

  SEARCH QUERY: [query from orchestrator]
  LOCAL CONTEXT: [grounding from orchestrator]
  OUTPUT FILE: [path]

  TASK:
  1. WebSearch the query
  2. WebFetch top 3-4 URLs
  3. Extract verbatim: exact numbers, version strings, config snippets, CLI commands, concrete steps, caveats
  4. Flag conflicts with LOCAL CONTEXT
  5. Write to file, return path only

  FILE FORMAT:
  # Research: [dimension]

  ## Extracted Details
  Per source — quote or reproduce exactly. No paraphrasing.

  ### [URL]
  - Exact finding: [verbatim quote or precise detail with numbers/versions]
  - Code/config: [literal snippet if applicable]
  - Caveats: [specific limitations, version requirements, known issues]

  ## Cross-Source Patterns
  [What multiple sources agree on — cite which]

  ## Conflicts with Local Context
  [Specific contradictions — cite source]

  RETURN: FILE: [path]"
)
```

---

## Step 3: Dispatch Synthesis Agent

No `model` parameter - inherits user's current model.

```
Task(
  subagent_type="general-purpose",
  description="oberweb: synthesize results",
  prompt="OBJECTIVE: Synthesize research into actionable recommendations.

  ORIGINAL QUERY: [query]
  LOCAL CONTEXT: [from orchestrator]
  RESEARCH FILES: [list paths]

  TASK:
  1. Read each research file
  2. Cross-reference - what do sources agree on?
  3. Ground against LOCAL CONTEXT
  4. Prioritize by actionability

  RETURN FORMAT:
  SUMMARY:
  [2-3 paragraphs for THIS user's setup]

  RECOMMENDATIONS:
  1. [specific action]
  ...

  GROUNDING:
  - Verified: [matches setup]
  - Conflicts: [doesn't apply]
  - Missing: [needs adding]

  SOURCES:
  - [URL]: [what it covers]
  ..."
)
```

---

## Handling Failures

| Situation | Action |
|-----------|--------|
| Search agent returns nothing | Exclude from synthesis, note gap |
| Search agent fails | Continue with others |
| All fail | Report failure with attempted queries |

---

## Model Selection

| Agent | Model |
|-------|-------|
| Orchestrator | sonnet |
| Search agents | sonnet |
| Synthesis | (inherit) |

---

## Red Flags

| Thinking | Reality |
|----------|---------|
| "Skip grounding" | Generic results won't apply |
| "Use haiku for search" | Shallow extraction - use sonnet |
| "Skip oberagent for search agents" | oberagent validates ALL prompts including search |
| "Override user's model for synthesis" | Inherit, don't override |
| "Skip oberagent" | Invoke oberagent for EVERY dispatch |
| "Return full page content" | Return file paths only |
