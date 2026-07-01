# Synthesis Prompts

## Contents

1. [Scan](#scan)
2. [Brief](#brief)
3. [Breadth](#breadth)
4. [Deep](#deep)

## Scan

No synthesis agent. Return the search results directly with a 2-3 sentence summary.

---

## Brief

```
Agent(
  description="web-research: synthesize results",
  prompt="OBJECTIVE: Synthesize research into actionable recommendations.

  ORIGINAL QUERY: {query}
  LOCAL CONTEXT: {from planner}
  TIME-SENSITIVE: {yes/no}
  RESEARCH FILES: {list paths}

  TASK:
  1. Read each research file
  2. Cross-reference: what do sources agree on?
  3. Ground against LOCAL CONTEXT
  4. Prioritize by actionability
  5. If any dimension is labeled [COUNTER], integrate its findings as
     caveats or risks — don't bury the counter-evidence
  6. If TIME-SENSITIVE: flag any recommendations based on sources older
     than 2 years. Note the date of each key source.

  RETURN FORMAT:
  ## Findings
  [2-3 paragraphs for THIS user's setup. Cite sources with URLs.]

  ## Caveats and Risks
  [From the [COUNTER] dimension and any conflicting sources.
   What could go wrong? What are the common mistakes?]

  ## Recommendations
  1. [specific action] — [source URL]
  ...

  ## Grounding
  - Verified: [matches local setup]
  - Conflicts: [doesn't apply to local setup, why]
  - Gaps: [what wasn't found]
  - Stale: [recommendations based on old sources, if any]

  ## Sources
  - [URL] ([year]): [what it covers]"
)
```

---

## Breadth

```
Agent(
  description="web-research: synthesize landscape",
  prompt="OBJECTIVE: Synthesize a landscape map from research files.

  ORIGINAL QUERY: {query}
  TIME-SENSITIVE: {yes/no}
  RESEARCH FILES: {list paths}

  TASK:
  1. Read each research file
  2. Organize by category, not by dimension
  3. If a [COUNTER] dimension exists, use it to flag risks per category
  4. If TIME-SENSITIVE: note which options are actively maintained vs stale

  RETURN FORMAT:
  ## Landscape Map
  [Overview: what the space looks like, organized by category]

  ## Categories
  For each category:
  ### [Category Name]
  - [option/tool/approach]: [one-line], [URL] ([year])
  ...

  ## Risks and Gotchas
  [From [COUNTER] dimension: common pitfalls, failed approaches, known issues]

  ## Where to Go Deeper
  [2-3 dimensions worth a deep or brief follow-up, with rationale]

  ## Sources
  - [URL] ([year]): [what it covers]"
)
```

---

## Deep

```
Agent(
  description="web-research: synthesize deep report",
  prompt="OBJECTIVE: Produce a comprehensive research report.

  ORIGINAL QUERY: {query}
  LOCAL CONTEXT: {from planner}
  TIME-SENSITIVE: {yes/no}
  EXISTING KNOWLEDGE: {from step 0 hook/local files, or 'none'}
  RESEARCH FILES: {list paths, including cross-pollination file}

  TASK:
  1. Read all research files
  2. Reorganize by theme, NOT by dimension
  3. The [COUNTER] dimension findings are equal citizens — integrate them
     into the relevant themes, don't quarantine them in a separate section
  4. For each finding, assess confidence based on: number of agreeing sources,
     recency, source authority, consistency with local context
  5. If TIME-SENSITIVE: weight recent sources higher and explicitly flag
     any recommendation that depends on a source older than 2 years

  RETURN FORMAT:
  ## Executive Summary
  [3-5 sentences. The answer, not the journey. Include the strongest caveat.]

  ## Findings
  Per theme (NOT per dimension):
  ### [Theme]
  [Findings with inline citations: source URL + specific detail]
  **Confidence:** high/medium/low — [why]

  ## Conflicts Between Sources
  | Claim | Source A says | Source B says | Resolution |
  |-------|-------------|-------------|------------|

  ## Recommendations
  Ranked by effort-to-value:
  1. [action] — effort: [low/med/high], value: [low/med/high] — [source] ([year])

  ## Gaps
  [What the research didn't answer. What to search next.]

  ## Sources
  - [URL] ([year]): [what it covers]"
)
```
