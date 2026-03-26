---
description: Parallel web search across multiple angles.
---

# Skill: web-research

**On load:** Read `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. Display `web-research v{version}` before proceeding.

```
GROUND IN LOCAL CONTEXT. RETURN ONLY RELEVANT RESULTS WITH SOURCE URLS.
```

---

## Depth Modes

If the user specifies a depth, use it. Otherwise, infer from the query or ask:

| Mode | When | Agents | Output |
|------|------|--------|--------|
| **scan** | Quick answer, sanity check, "is this a thing?" | 1 search, no synthesis | 1-pager: top 3 findings + URLs |
| **brief** | Standard research question | 2-3 search + synthesis | Synthesized brief with recommendations |
| **breadth** | Map a space, survey options, "what's out there?" | 5-8 search (shallow) + synthesis | Landscape map: categories, key players, gaps |
| **deep** | Serious research, decision-critical, needs verification | 3-5 search + cross-pollinate + synthesis + verify | Full report with confidence levels and verified sources |

**Inference rules:**
- "Quick" / "is there" / "does X support" / "what's the syntax for" → **scan**
- "Research" / "how to" / "best way to" / no depth cue → **brief**
- "Survey" / "landscape" / "what are the options" / "compare" → **breadth**
- "Deep dive" / "report" / "I need to make a decision about" / "thorough" → **deep**

---

## Step 0: Check Existing Knowledge (brief, breadth, deep only)

Before hitting the web, ground in what's already available.

```
1. Check local files relevant to the query (package.json, configs, code, docs)
2. If a PreSearch hook is configured, run it with the query terms
   (hook can check project-specific memory, knowledge bases, internal docs, etc.)
3. Use results to skip dimensions already covered and focus search on gaps
```

**Hook contract:** The PreSearch hook receives the query as input. It returns any existing knowledge as text. The skill uses this to inform dimension planning — not as a gate. If no hook is configured, skip to Step 1.

**If existing knowledge covers part of the query:** Tell the user what you already have and focus search on the gaps.

**If existing knowledge fully covers the query:** Present it. Ask if they want fresh web results anyway.

---

## Step 1: Plan

Dispatch orchestrator (sonnet):

```
Agent(
  model="sonnet",
  description="web-research: ground and plan search",
  prompt="OBJECTIVE: Ground this query in local context, then plan search dimensions.

  USER QUERY: {query}
  DEPTH MODE: {mode}
  EXISTING KNOWLEDGE: {from step 0 hook/local files, or 'none'}

  PHASE 1 - GROUNDING:
  Check local files relevant to this query (package.json, configs, code).
  Extract: versions, settings, gaps.

  PHASE 2 - DIMENSIONS:
  Plan search dimensions based on mode:
  - scan: 1 focused dimension
  - brief: 2-3 dimensions targeting different angles
  - breadth: 5-8 dimensions covering the landscape (shallow)
  - deep: 3-5 high-value dimensions, prioritized by likelihood of quality sources

  For each dimension, provide:
  - search query (grounded in local context)
  - what you expect to find
  - priority (deep mode: which to search first)

  RETURN FORMAT:
  LOCAL CONTEXT:
  - [key fact]
  ...

  DIMENSIONS:
  1. [dimension]: [search query] — [expected value]
  ..."
)
```

Show the user the plan before dispatching search agents.

---

## Step 2: Search

Dispatch all search agents in parallel. Each writes to `~/.local/state/web-research/{timestamp}-{query-slug}-{dimension}.md`

### For scan and brief:

```
Agent(
  model="sonnet",
  description="web-research: search {dimension}",
  prompt="OBJECTIVE: Extract precise information for this search dimension.
  Do NOT summarize. Pull exact details, quote sources, preserve specificity.

  SEARCH QUERY: {query from orchestrator}
  LOCAL CONTEXT: {grounding}
  OUTPUT FILE: {path}

  TASK:
  1. WebSearch the query
  2. WebFetch top 3-4 URLs
  3. Extract verbatim: exact numbers, version strings, config snippets,
     CLI commands, concrete steps, caveats
  4. Flag conflicts with LOCAL CONTEXT
  5. Write to file, return path only

  IF SEARCH RETURNS NO USEFUL RESULTS:
  Reformulate the query — try different terms, broaden or narrow scope,
  add/remove version numbers. Try once more with the reformulated query.
  If still nothing, report the gap and what you tried.

  FILE FORMAT:
  # Research: {dimension}

  ## Extracted Details
  Per source — quote or reproduce exactly. No paraphrasing.

  ### [URL]
  - Exact finding: [verbatim quote or precise detail]
  - Code/config: [literal snippet if applicable]
  - Caveats: [specific limitations, version requirements]

  ## Cross-Source Patterns
  [What multiple sources agree on — cite which]

  ## Conflicts with Local Context
  [Specific contradictions — cite source]

  RETURN: FILE: {path}"
)
```

### For breadth (lighter extraction):

```
Agent(
  model="sonnet",
  description="web-research: scan {dimension}",
  prompt="OBJECTIVE: Map what exists for this dimension. Breadth over depth.

  SEARCH QUERY: {query}
  OUTPUT FILE: {path}

  TASK:
  1. WebSearch the query
  2. Scan top 5-8 results (titles, snippets, first paragraphs)
  3. Extract: what exists, who the key players are, rough categories
  4. Don't deep-fetch every page — headlines and snippets are enough
  5. Write to file, return path only

  FILE FORMAT:
  # Landscape: {dimension}

  ## Key Players / Tools / Approaches
  - [name]: [one-line description] — [URL]

  ## Categories
  - [category]: [what falls here]

  ## Notable Gaps
  [What you expected to find but didn't]

  RETURN: FILE: {path}"
)
```

---

## Step 3: Cross-Pollinate (deep mode only)

After initial search, agents see each other's findings and fill gaps.

```
Agent(
  model="sonnet",
  description="web-research: fill gaps across dimensions",
  prompt="OBJECTIVE: Review all research files and identify gaps worth filling.

  RESEARCH FILES: {list paths}
  LOCAL CONTEXT: {grounding}

  TASK:
  1. Read all research files
  2. Identify: what did multiple dimensions reference but none explored?
  3. Identify: where do sources contradict each other?
  4. Run 1-2 targeted searches to resolve contradictions or fill the biggest gap
  5. Append findings to a new file

  OUTPUT FILE: {path}
  RETURN: FILE: {path}"
)
```

---

## Step 4: Synthesize

No `model` parameter — inherits user's current model.

### For scan:

No synthesis agent. Return the search results directly with a 2-3 sentence summary.

### For brief:

```
Agent(
  description="web-research: synthesize results",
  prompt="OBJECTIVE: Synthesize research into actionable recommendations.

  ORIGINAL QUERY: {query}
  LOCAL CONTEXT: {from orchestrator}
  RESEARCH FILES: {list paths}

  TASK:
  1. Read each research file
  2. Cross-reference: what do sources agree on?
  3. Ground against LOCAL CONTEXT
  4. Prioritize by actionability

  RETURN FORMAT:
  ## Findings
  [2-3 paragraphs for THIS user's setup. Cite sources with URLs.]

  ## Recommendations
  1. [specific action] — [source URL]
  ...

  ## Grounding
  - Verified: [matches local setup]
  - Conflicts: [doesn't apply to local setup, why]
  - Gaps: [what wasn't found]

  ## Sources
  - [URL]: [what it covers]"
)
```

### For breadth:

```
Agent(
  description="web-research: synthesize landscape",
  prompt="OBJECTIVE: Synthesize a landscape map from research files.

  ORIGINAL QUERY: {query}
  RESEARCH FILES: {list paths}

  RETURN FORMAT:
  ## Landscape Map
  [Overview: what the space looks like, organized by category]

  ## Categories
  For each category:
  ### [Category Name]
  - [option/tool/approach]: [one-line], [URL]
  ...

  ## Where to Go Deeper
  [2-3 dimensions worth a deep or brief follow-up, with rationale]

  ## Sources
  - [URL]: [what it covers]"
)
```

### For deep:

```
Agent(
  description="web-research: synthesize deep report",
  prompt="OBJECTIVE: Produce a comprehensive research report.

  ORIGINAL QUERY: {query}
  LOCAL CONTEXT: {from orchestrator}
  EXISTING KNOWLEDGE: {from step 0}
  RESEARCH FILES: {list paths, including cross-pollination file}

  RETURN FORMAT:
  ## Executive Summary
  [3-5 sentences. The answer, not the journey.]

  ## Findings
  Per theme (NOT per dimension — reorganize by what matters):
  ### [Theme]
  [Findings with inline citations: source URL + specific detail]
  **Confidence:** high/medium/low — [why]

  ## Conflicts Between Sources
  | Claim | Source A says | Source B says | Resolution |
  |-------|-------------|-------------|------------|

  ## Recommendations
  Ranked by effort-to-value:
  1. [action] — effort: [low/medium/high], value: [low/medium/high] — [source]

  ## Gaps
  [What the research didn't answer. What to search next.]

  ## Sources
  - [URL]: [what it covers, when accessed]"
)
```

---

## Step 5: Verify (deep mode only)

After synthesis, spot-check:

```
1. WebFetch each cited URL — confirm it exists and contains what was claimed
2. Cross-check version numbers against local package.json / configs
3. Flag any URL that 404s or contradicts the claimed content
4. Report verification results to user
```

Don't dispatch a separate agent for this. Do it inline after synthesis returns.

---

## Handling Failures

| Situation | Action |
|-----------|--------|
| Search agent returns nothing | Reformulate query and retry once. If still nothing, report the gap. |
| Search agent fails | Continue with others. Note the failed dimension. |
| All agents fail | Report failure with attempted queries. Suggest alternative search terms. |
| URL 404s during verification | Flag it. Remove from recommendations if it was the sole source. |

---

## Model Selection

| Agent | Model | Why |
|-------|-------|-----|
| Orchestrator | sonnet | Planning doesn't need the strongest model |
| Search agents | sonnet | Extraction quality needs reasoning depth |
| Cross-pollination | sonnet | Gap-filling is search, not synthesis |
| Synthesis | (inherit) | Never override the user's model |

Search agents return file paths only, not full page content.
