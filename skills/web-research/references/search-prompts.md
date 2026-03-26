# Search Prompts

## Orchestrator Prompt

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

---

## Search Agent: Standard (scan, brief)

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

---

## Search Agent: Breadth (landscape scanning)

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
