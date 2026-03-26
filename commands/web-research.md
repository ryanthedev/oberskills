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
- scan/brief: `${CLAUDE_PLUGIN_ROOT}/skills/web-research/references/search-prompts.md` + `${CLAUDE_PLUGIN_ROOT}/skills/web-research/references/synthesis-prompts.md`
- breadth: same two files (breadth-specific sections)
- deep: same two files + `${CLAUDE_PLUGIN_ROOT}/skills/web-research/references/deep-mode.md`

---

## Pipeline

### Step 0: Check Existing Knowledge (skip for scan)

Before hitting the web, ground in what's already available.

1. Check local files relevant to the query (package.json, configs, code, docs)
2. If a PreSearch hook is configured, run it with the query terms (hook can check project-specific memory, knowledge bases, internal docs)
3. Use results to skip dimensions already covered and focus search on gaps

**Hook contract:** PreSearch hook receives the query as input, returns existing knowledge as text. If no hook is configured, skip to Step 1.

**If existing knowledge covers the query:** Present it. Ask if they want fresh web results.

### Step 1: Plan

Dispatch orchestrator (sonnet). Grounds in local context, plans dimensions based on mode:
- scan: 1 focused dimension
- brief: 2-3 dimensions targeting different angles
- breadth: 5-8 dimensions covering the landscape
- deep: 3-5 high-value dimensions, prioritized by quality likelihood

Show the user the plan before dispatching search agents.

See search-prompts.md for the orchestrator prompt template.

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
| Orchestrator | sonnet | Planning doesn't need the strongest model |
| Search agents | sonnet | Extraction quality needs reasoning depth |
| Cross-pollination | sonnet | Gap-filling is search, not synthesis |
| Synthesis | (inherit) | Never override the user's model |

Search agents return file paths only, not full page content.
