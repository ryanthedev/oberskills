# Search Prompts

## Contents

1. [Planner Prompt](#planner-prompt)
2. [Search Agent: Standard (scan, brief, deep)](#search-agent-standard-scan-brief-deep)
3. [Search Agent: Breadth (landscape scanning)](#search-agent-breadth-landscape-scanning)

## Planner Prompt

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
  Note the current date and any version numbers — these matter for search.

  PHASE 2 - TEMPORAL CHECK:
  Is this query version-sensitive or time-sensitive?
  (frameworks, libraries, APIs, deployment tools, language features = yes)
  If yes: append current year or version to search queries. Flag for recency.

  PHASE 3 - DIMENSIONS:
  Plan search dimensions based on mode:
  - scan: 1 focused dimension
  - brief: 2-3 dimensions targeting different angles
  - breadth: 5-8 dimensions covering the landscape (shallow)
  - deep: 3-5 high-value dimensions, prioritized by likelihood of quality sources

  ADVERSARIAL DIMENSION (brief, breadth, deep only):
  Always include one dimension that searches for the counter-argument.
  If the query is 'how to do X': add 'problems with X' or 'X alternatives'
  If the query is 'should I use X': add 'X vs alternatives' or 'why not X'
  If the query is 'best way to Y': add 'common mistakes with Y'
  Label this dimension as [COUNTER] so synthesis knows its role.

  For each dimension, provide:
  - search query (grounded in local context, with version/year if time-sensitive)
  - what you expect to find
  - priority (deep mode: which to search first)

  RETURN FORMAT:
  LOCAL CONTEXT:
  - [key fact]
  ...
  TIME-SENSITIVE: [yes/no] — [relevant versions/dates]

  DIMENSIONS:
  1. [dimension]: [search query] — [expected value]
  ...
  N. [COUNTER] [dimension]: [search query] — [expected counter-evidence]"
)
```

---

## Search Agent: Standard (scan, brief, deep)

```
Agent(
  model="sonnet",
  description="web-research: search {dimension}",
  prompt="OBJECTIVE: Extract precise information for this search dimension.
  Do NOT summarize. Pull exact details, quote sources, preserve specificity.

  SEARCH QUERY: {query from planner}
  LOCAL CONTEXT: {grounding}
  TIME-SENSITIVE: {yes/no from planner}
  OUTPUT FILE: {path}

  TASK:
  1. WebSearch the query
  2. SCAN phase: Read the search result snippets. Pick the 1-2 URLs most
     likely to contain novel, specific, authoritative information.
     Skip: results that repeat what other snippets already say,
     results older than 2 years if TIME-SENSITIVE is yes,
     results that are clearly listicles or thin wrappers.
  3. FETCH phase: WebFetch only the 1-2 selected URLs.
  4. EXTRACT phase: Pull verbatim — exact numbers, version strings,
     config snippets, CLI commands, concrete steps, caveats.
     For each extracted item, note the publication date if visible.
  5. Flag conflicts with LOCAL CONTEXT
  6. Write to file, return path only

  IF SEARCH RETURNS NO USEFUL RESULTS:
  Reformulate the query — try different terms, broaden or narrow scope,
  add/remove version numbers. Try once more with the reformulated query.
  If still nothing, report the gap and what you tried.

  IF TIME-SENSITIVE AND RESULTS ARE OLD:
  Append current year to query and search again before giving up.

  EXAMPLE OUTPUT:
  # Research: Bun SQLite WAL mode configuration

  ## Extracted Details

  ### https://bun.sh/docs/api/sqlite (2026)
  - WAL mode: set via PRAGMA journal_mode=WAL, must be called before any reads
  - Default journal mode is delete, not WAL
  - Code: const db = new Database('mydb.sqlite'); db.run('PRAGMA journal_mode=WAL');
  - Caveat: WAL mode persists across connections — set once, not per-open

  ### https://github.com/oven-sh/bun/issues/4521 (2025)
  - Known issue: WAL + ATTACH fails silently on Bun 1.1.x, fixed in 1.2.0
  - Workaround: open attached databases separately

  ## Cross-Source Patterns
  Both sources confirm WAL must be set before reads. Docs and issue agree on persistence.

  ## Conflicts with Local Context
  Local package.json shows bun 1.3.2 — the ATTACH bug is fixed in this version.

  ## Stale Content Flags
  None — both sources are current.

  FILE FORMAT:
  # Research: {dimension}

  ## Extracted Details
  Per source — quote or reproduce exactly. No paraphrasing.

  ### [URL] ([year or 'undated'])
  - Exact finding: [verbatim quote or precise detail]
  - Code/config: [literal snippet if applicable]
  - Caveats: [specific limitations, version requirements]

  ## Cross-Source Patterns
  [What multiple sources agree on — cite which]

  ## Conflicts with Local Context
  [Specific contradictions — cite source]

  ## Stale Content Flags
  [Any results that reference outdated versions or deprecated APIs]

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
  TIME-SENSITIVE: {yes/no}
  OUTPUT FILE: {path}

  TASK:
  1. WebSearch the query
  2. Scan top 5-8 results (titles, snippets, first paragraphs)
  3. Extract: what exists, who the key players are, rough categories
  4. Don't deep-fetch every page — headlines and snippets are enough
  5. If TIME-SENSITIVE, note which results look current vs dated
  6. Write to file, return path only

  FILE FORMAT:
  # Landscape: {dimension}

  ## Key Players / Tools / Approaches
  - [name]: [one-line description] — [URL] ([year])

  ## Categories
  - [category]: [what falls here]

  ## Notable Gaps
  [What you expected to find but didn't]

  ## Freshness
  [Which entries look current, which look dated]

  RETURN: FILE: {path}"
)
```
