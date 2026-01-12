---
name: oberweb
description: Multi-dimensional web search orchestrator. Use when the user needs comprehensive web research that would benefit from parallel searches across different angles. Dispatches multiple fast subagents (haiku) to search in parallel, synthesizes results, and returns only relevant information with source URLs. Preserves main agent context by handling search complexity in subagents. Triggers on "research this", "find information about", "search the web for", "comprehensive search", or when a single search wouldn't capture all relevant aspects.
---

# Skill: oberweb

Web search orchestrator that dispatches parallel subagents for multi-dimensional research while preserving main agent context.

## The Iron Law

```
RETURN ONLY RELEVANT RESULTS WITH SOURCE URLS
```

The main agent's context is precious. Every search result returned must:
- Be directly relevant to the query
- Include the source URL for verification
- Be concise (no full page content)

---

## Why oberweb?

A single web search often misses important angles:
- Different terminology for the same concept
- Multiple perspectives (docs, tutorials, discussions, issues)
- Related concepts that provide context

oberweb breaks a query into dimensions and searches them in parallel with fast, cheap subagents.

---

## Required Workflow

```
1. Analyze Search Request (identify dimensions)
      ↓
2. Invoke oberagent (for orchestrator prompt)
      ↓
3. Dispatch Orchestrator (haiku, plans search dimensions)
      ↓
4. Dispatch Search Agents (parallel haiku agents)
      ↓
5. Dispatch Synthesis Agent (haiku, filters and ranks)
      ↓
6. Return Results (relevant info + URLs only)
```

---

## Step 1: Analyze Search Request

Before searching, identify the search dimensions:

| Dimension Type | Example for "React server components" |
|----------------|---------------------------------------|
| **Official** | React docs, Next.js docs |
| **Tutorial** | "React server components tutorial" |
| **Discussion** | Reddit, HN, Stack Overflow |
| **Comparison** | "server components vs client components" |
| **Issues** | GitHub issues, known problems |
| **Recent** | "React server components 2025" |

**Not every query needs all dimensions.** Select 2-5 based on the request.

### Dimension Selection Heuristics

| Query Type | Recommended Dimensions |
|------------|------------------------|
| API/Library usage | Official docs, tutorials, Stack Overflow |
| Debugging/errors | GitHub issues, Stack Overflow, discussions |
| Comparison/decision | Official docs, comparisons, discussions |
| Learning new concept | Official docs, tutorials, recent articles |
| Current events | News, recent, discussions |

---

## Step 2: Invoke oberagent

**Before dispatching any agent, invoke oberagent.** This ensures:
- Prompts are outcome-focused
- Constraint budget is respected
- oberprompt principles are applied

```
Invoke oberagent for oberweb orchestrator.
Skills identified: (none - orchestrator is pure coordination)
Objective: Plan and execute multi-dimensional web search
```

---

## Step 3: Dispatch Orchestrator Agent

The orchestrator plans the search dimensions and dispatches search agents.

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="oberweb: plan search dimensions",
  prompt="OBJECTIVE: Plan a multi-dimensional web search.

  USER QUERY: [original query]

  TASK:
  1. Identify 2-5 search dimensions that would comprehensively cover this topic
  2. For each dimension, write a specific search query
  3. Return the search plan

  RETURN FORMAT:
  DIMENSIONS:
  - [dimension name]: [search query]
  - [dimension name]: [search query]
  ...

  Keep queries specific and varied to maximize coverage."
)
```

---

## Step 4: Dispatch Search Agents

**Dispatch all search agents in parallel.** Use haiku for speed and cost.

For each dimension from the orchestrator:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="oberweb: search [dimension]",
  prompt="OBJECTIVE: Find relevant information for this search.

  SEARCH QUERY: [query from orchestrator]
  CONTEXT: Part of research on [original user query]

  TASK:
  1. Use WebSearch to find relevant results
  2. Use WebFetch on the top 2-3 most promising URLs
  3. Extract key information relevant to the query

  RETURN FORMAT:
  RESULTS:
  - [URL]: [2-3 sentence summary of relevant content]
  - [URL]: [2-3 sentence summary of relevant content]

  ONLY include results that are directly relevant. Skip generic or tangential content."
)
```

**Dispatch Pattern:**
```
// Single message with multiple Task calls
Task(haiku, "search dimension 1", ...)
Task(haiku, "search dimension 2", ...)
Task(haiku, "search dimension 3", ...)
```

---

## Step 5: Dispatch Synthesis Agent

After all search agents return, synthesize the results:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="oberweb: synthesize results",
  prompt="OBJECTIVE: Synthesize search results into a coherent summary.

  ORIGINAL QUERY: [user's original query]

  SEARCH RESULTS:
  [aggregated results from all search agents]

  TASK:
  1. Remove duplicates and low-relevance results
  2. Organize by theme or importance
  3. Create a summary that answers the original query
  4. Preserve all source URLs

  RETURN FORMAT:
  SUMMARY:
  [2-4 paragraph synthesis answering the query]

  KEY FINDINGS:
  - [finding 1]
  - [finding 2]
  ...

  SOURCES:
  - [URL 1]: [what it covers]
  - [URL 2]: [what it covers]
  ..."
)
```

---

## Step 6: Return Results

Return the synthesis to the main agent. The main agent receives:
- A concise summary answering their query
- Key findings as bullet points
- Source URLs for verification or deeper reading

**Do NOT return:**
- Full page contents
- Raw search results
- Duplicate information
- Tangential findings

---

## Model Selection

| Agent | Model | Rationale |
|-------|-------|-----------|
| Orchestrator | haiku | Fast, simple planning task |
| Search agents | haiku | Parallel, many instances, cost-sensitive |
| Synthesis agent | haiku | Filtering/organizing, not complex reasoning |

**Why haiku throughout:**
- Web search is I/O bound, not reasoning bound
- Parallel execution benefits from fast response
- Cost scales with number of dimensions
- Results are validated by source URLs, not model reasoning

---

## Context Budget

| Component | Approximate Tokens |
|-----------|-------------------|
| Orchestrator response | ~200 |
| Per search agent | ~500 |
| Synthesis response | ~800 |
| **Total returned to main** | ~1000-1500 |

Compare to naive approach: 5 WebFetch calls = 5000+ tokens of raw content.

---

## Example Execution

**User query:** "How do I implement authentication in Next.js 14 App Router?"

### Orchestrator Output:
```
DIMENSIONS:
- official: "Next.js 14 App Router authentication docs"
- tutorial: "Next.js 14 authentication tutorial NextAuth"
- patterns: "Next.js App Router auth middleware patterns"
- issues: "Next.js 14 authentication common issues site:github.com"
```

### Search Agents (parallel):
Each returns 2-3 relevant URLs with summaries.

### Synthesis Output:
```
SUMMARY:
Next.js 14 App Router authentication is typically implemented using NextAuth.js
(now Auth.js) with the new App Router patterns. The key changes from Pages Router
include using route handlers in app/api/auth/[...nextauth]/route.ts and middleware
for protecting routes...

KEY FINDINGS:
- NextAuth.js v5 (Auth.js) has native App Router support
- Middleware-based protection is recommended over page-level checks
- Server Components can access session via auth() helper
- Client Components use useSession() hook

SOURCES:
- https://nextjs.org/docs/app/building-your-application/authentication: Official docs
- https://authjs.dev/getting-started/introduction: Auth.js setup guide
- https://github.com/nextauthjs/next-auth/issues/...: Known migration issues
```

---

## Red Flags - STOP

| If You're Thinking | Reality | Action |
|--------------------|---------|--------|
| "One search is enough" | Single searches miss angles | Use 2-5 dimensions |
| "Return all results" | Context pollution | Filter aggressively |
| "Use sonnet for better quality" | Adds latency, cost; haiku is sufficient | Stick with haiku |
| "Skip synthesis, just aggregate" | Raw results overwhelm main agent | Always synthesize |
| "Skip oberagent, it's just search" | Still dispatching agents | Invoke oberagent |

---

## Integration

### With oberagent
Invoke oberagent before dispatching the orchestrator. oberagent ensures prompt quality even for simple coordination tasks.

### With oberprompt
Invoked transitively through oberagent. Ensures search agent prompts are outcome-focused.

### With main agent
oberweb returns a context-efficient summary. Main agent can use source URLs to dive deeper if needed.
