# Synthesis Prompts

## Scan

No synthesis agent. Return the search results directly with a 2-3 sentence summary.

---

## Brief

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

---

## Breadth

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

---

## Deep

```
Agent(
  description="web-research: synthesize deep report",
  prompt="OBJECTIVE: Produce a comprehensive research report.

  ORIGINAL QUERY: {query}
  LOCAL CONTEXT: {from orchestrator}
  EXISTING KNOWLEDGE: {from step 0 hook/local files, or 'none'}
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
