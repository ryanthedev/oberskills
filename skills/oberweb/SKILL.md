---
name: oberweb
description: Multi-dimensional web search orchestrator. Use when the user needs comprehensive web research that would benefit from parallel searches across different angles. Dispatches multiple fast subagents (haiku) to search in parallel, synthesizes results, and returns only relevant information with source URLs. Preserves main agent context by handling search complexity in subagents. Triggers on "research this", "find information about", "search the web for", "comprehensive search", or when a single search wouldn't capture all relevant aspects.
---

# Skill: oberweb

Web search orchestrator that dispatches parallel subagents for multi-dimensional research while preserving main agent context.

## The Iron Law

```
GROUND IN LOCAL CONTEXT. RETURN ONLY RELEVANT RESULTS WITH SOURCE URLS.
```

**Grounding is mandatory.** Web results without local context are generic advice that may not apply.

The main agent's context is precious. Every search result returned must:
- Be grounded against local config/code
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
0. Ground in Local Context (check config/code FIRST)
      ↓
1. Analyze Search Request (identify dimensions)
      ↓
2. Invoke oberagent → Dispatch Orchestrator (haiku)
      ↓
3. Invoke oberagent → Dispatch Search Agents (parallel haiku)
      ↓
4. Invoke oberagent → Dispatch Synthesis Agent (haiku)
      ↓
5. Ground Results (validate against local context)
      ↓
6. Return Results (relevant info + URLs only)
```

**Every agent dispatch goes through oberagent.** oberagent invokes oberprompt, validates the prompt, and completes the checklist. This is not optional.

**The chain:** oberweb → oberagent → oberprompt → agent prompt

---

## Step 0: Ground in Local Context

**CRITICAL: Before ANY web search, check local context.**

Web search results are useless if they don't apply to the user's actual setup. Check relevant local files FIRST.

### What to Check

| Query Type | Local Context to Check |
|------------|------------------------|
| Config troubleshooting | The config file itself |
| Library/framework issues | package.json, lock files, installed versions |
| Build/tooling problems | Build configs, toolchain versions |
| Code behavior | The actual code in question |
| Environment issues | .env files, system info |

### Grounding Pattern

```
BEFORE searching, read the relevant local file(s):
- Read(~/.config/ghostty/config) for Ghostty issues
- Read(package.json) for Node.js library issues
- Read(tsconfig.json) for TypeScript issues
- etc.

Extract key facts:
- Current settings/versions
- What's already configured
- What's NOT configured (gaps)
```

### Pass Context to Orchestrator

Include local context in the orchestrator prompt so search dimensions are grounded:

```
LOCAL CONTEXT:
- Ghostty config shows: toggle_visibility bound to cmd+backtick
- No quick_terminal setting found
- Version: 1.0.1

USER QUERY: floating terminal creates new instance instead of reusing
```

### Why This Matters

| Without Grounding | With Grounding |
|-------------------|----------------|
| "Try toggle_quick_terminal" | "You have toggle_visibility, not toggle_quick_terminal. That's the issue." |
| Generic advice | Specific to user's setup |
| May not apply | Guaranteed to apply |
| User must verify | Already verified |

**Skip grounding ONLY if:**
- Query is purely conceptual ("what is X?")
- No local files are relevant
- User explicitly says "don't check my files"

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

## Step 2: Dispatch Orchestrator (via oberagent)

**Invoke oberagent first:**
```
Invoke oberagent for oberweb orchestrator.
Skills identified: (none - pure coordination)
Objective: Plan search dimensions for multi-dimensional web search
```

oberagent will invoke oberprompt, then validate the prompt.

**Then dispatch:**

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

## Step 3: Dispatch Search Agents (via oberagent)

**Invoke oberagent for EACH search agent:**
```
Invoke oberagent for oberweb search agent.
Skills identified: (none - search/fetch only)
Objective: Search [dimension] and extract relevant information
```

**Then dispatch all in parallel.** Use haiku for speed and cost.

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

  CONSTRAINTS:
  - MAX 2-3 sentences per URL
  - NO full page content or long quotes
  - NO more than 5 URLs total

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

## Step 4: Dispatch Synthesis Agent (via oberagent)

**Invoke oberagent:**
```
Invoke oberagent for oberweb synthesis agent.
Skills identified: (none - filtering/organizing only)
Objective: Synthesize search results into concise summary with source URLs
```

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

## Handling Failures

| Situation | Action |
|-----------|--------|
| Search agent returns no results | Exclude from synthesis, note the gap |
| Search agent fails/times out | Continue with other results |
| All search agents fail | Report failure to main agent with attempted queries |
| Synthesis returns empty | Return raw results with warning |

**Don't fail silently.** If searches return nothing useful, tell the main agent what was attempted.

---

## Step 5: Ground Results

**After synthesis, validate results against local context.**

### Validation Checklist

| Check | Action |
|-------|--------|
| Does advice match local config? | Flag conflicts ("web says X, but you have Y") |
| Are recommended versions compatible? | Check against package.json/lock files |
| Does solution require changes? | Specify exactly what to change |
| Are there gaps in local setup? | Highlight missing config/code |

### Grounding Output

Add a `GROUNDING` section to the synthesis:

```
GROUNDING (based on your config):
- Your config uses toggle_visibility, not toggle_quick_terminal
- This is likely the root cause of new window spawning
- Recommendation: Replace toggle_visibility with toggle_quick_terminal

CONFLICTS:
- None found

VERIFIED:
- Version 1.0.1 matches recommended version
```

### When Results Don't Apply

If web results don't match local context:

```
WARNING: Web results may not apply to your setup.
- Web assumes: toggle_quick_terminal
- Your config: toggle_visibility (different keybind)
- Action needed: [specific change]
```

**Never return generic advice when you have specific local context.**

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
| "Skip grounding, just search" | Generic results won't apply | Check local context FIRST |
| "I don't know where the config is" | Ask the user or search for it | Find the file before searching web |
| "Grounding takes too long" | Wrong advice takes longer to fix | 1 file read < debugging mismatch |
| "Web results are universal" | Every setup is different | Ground results against local context |
| "One search is enough" | Single searches miss angles | Use 2-5 dimensions |
| "Return all results" | Context pollution | Filter aggressively |
| "Use sonnet for better quality" | Adds latency, cost; haiku is sufficient | Stick with haiku |
| "Skip synthesis, just aggregate" | Raw results overwhelm main agent | Always synthesize |
| "Skip oberagent, it's just search" | Still dispatching agents | Invoke oberagent for EVERY dispatch |
| "I invoked oberagent for orchestrator" | Each dispatch needs its own oberagent | Invoke oberagent 3+ times total |
| "Search agents are simple, skip oberagent" | Simple ≠ exempt from validation | oberagent validates ALL prompts |
| "oberagent is overhead for parallel agents" | Validation prevents wasted parallel calls | Validate first, then dispatch |
| "Agent returned full page content" | Constraint violation, burning context | Re-dispatch with stricter constraints |
| "I'll let synthesis handle filtering" | Garbage in = garbage out | Each agent must filter |
| "Orchestrator returned 8 dimensions" | Too many = slow, costly, diminishing returns | Cap at 5, pick most relevant |

---

## Integration

### With oberagent
**Invoke oberagent before EVERY dispatch:**
- Once for orchestrator
- Once for each search agent (can be same prompt template)
- Once for synthesis agent

oberagent invokes oberprompt in Step 1, then validates the prompt.

### With oberprompt
Invoked transitively through oberagent. Each dispatch benefits from:
- Constraint budget validation
- Outcome-focused prompt structure
- Checklist completion

### With main agent
oberweb returns a context-efficient summary. Main agent can use source URLs to dive deeper if needed.
