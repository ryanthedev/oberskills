---
name: web-research
description: >-
  Runs parallel multi-angle web research at four depth modes (scan, brief,
  breadth, deep): a planner grounds the query in local context and plans search
  dimensions, parallel search agents pull verbatim extracts with source URLs,
  one dimension always hunts counter-evidence, and synthesis is grounded back
  in the local project. Use when researching a topic, library, or tool on the
  web, comparing options or products, surveying a landscape of approaches, or
  checking current, version-sensitive, or time-sensitive information. Not for:
  driving or automating a live browser session (use oberskills:browser),
  academic literature search across arXiv or Semantic Scholar, or questions
  about the current repo, project, or files already on disk — read those
  directly.
when_to_use: >-
  research this on the web, look up how to do X, find the best tool or library
  for Y, compare these options, what are the alternatives to X, survey the
  landscape of Z, is this still the recommended approach, what is the current
  or latest way to do this, check whether X supports Y, a version-sensitive
  lookup. Not for browser automation, arXiv or Semantic Scholar paper search,
  or anything about this repo or this project — summarizing a README, finding
  where code lives, reading local files.
---

# web-research

Parallel, multi-angle web search. Ground results in local context and return only the relevant findings, each one carrying a source URL.

---

## Depth Modes

If the user specifies a depth, use it. Otherwise, infer from the query or ask:

| Mode | When | Output |
|------|------|--------|
| **scan** | Quick answer, sanity check, "is this a thing?" | 1-pager: top 3 findings + URLs |
| **brief** | Standard research question | Synthesized brief with recommendations |
| **breadth** | Map a space, survey options, "what's out there?" | Landscape map: categories, key players, gaps |
| **deep** | Decision-critical, needs verification | Full report with confidence levels and verified sources |

**Inference rules:**
- "Quick" / "is there" / "does X support" / "what's the syntax for" → **scan**
- "Research" / "how to" / "best way to" / no depth cue → **brief**
- "Survey" / "landscape" / "what are the options" / "compare" → **breadth**
- "Deep dive" / "report" / "I need to make a decision about" / "thorough" → **deep**

**After selecting mode, load the mode's prompts:**
- scan/brief: `${CLAUDE_SKILL_DIR}/references/search-prompts.md` + `${CLAUDE_SKILL_DIR}/references/synthesis-prompts.md`
- breadth: same two files (breadth-specific sections)
- deep: same two files + `${CLAUDE_SKILL_DIR}/references/deep-mode.md`

---

## Pipeline

### Step 0: Check Existing Knowledge (skip for scan)

Before hitting the web, ground in what's already available.

1. Check local files relevant to the query (package.json, configs, code, docs).
2. Use what you find to skip dimensions already covered and focus the search on gaps.

**If existing knowledge covers the query:** Present it. Ask whether they want fresh web results.

### Step 1: Plan

Dispatch planner (sonnet). Grounds in local context, plans dimensions based on mode:
- scan: 1 focused dimension
- brief: 2-3 dimensions targeting different angles
- breadth: 5-8 dimensions covering the landscape
- deep: 3-5 high-value dimensions, prioritized by quality likelihood

Show the user the plan before dispatching search agents.

See search-prompts.md for the planner prompt template.

### Step 2: Search

Dispatch search agents in parallel. Each writes to `~/.local/state/web-research/{timestamp}-{query-slug}-{dimension}.md`

If a search returns nothing, reformulate the query and retry once. If still nothing, report the gap.

See search-prompts.md for per-mode agent prompt templates.

### Step 3: Cross-Pollinate (deep mode only)

Agents review each other's findings and fill gaps. See deep-mode.md.

### Step 4: Synthesize

See synthesis-prompts.md for per-mode templates. Scan mode skips this (return search results directly).

Synthesis agent inherits the user's model. Never override it.

### Step 5: Verify (deep mode only)

Spot-check URLs and version numbers after synthesis. See deep-mode.md.

---

## Handling Failures

| Situation | Action |
|-----------|--------|
| Search agent returns nothing | Reformulate and retry once. Report the gap if still nothing. |
| Search agent fails | Continue with others. Note the failed dimension. |
| All agents fail | Report failure with attempted queries. Suggest alternatives. |
| URL 404s during verification | Flag it. Remove from recommendations if sole source. |

---

## Model Selection

| Agent | Model | Why |
|-------|-------|-----|
| Planner | sonnet | Planning doesn't need the strongest model |
| Search agents | sonnet | Extraction quality needs reasoning depth |
| Cross-pollination | sonnet | Gap-filling is search, not synthesis |
| Synthesis | (inherit) | Never override the user's model |

Search agents return file paths only, not full page content.
