# Context engineering

How to design, structure, and manage the information payload delivered to an LLM. Context engineering supersedes single-string prompt optimization: you architect a system of typed components that are independently sourced, filtered, formatted, and assembled.

**Headline principle** (Anthropic, verbatim): "find the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."

**Right altitude:** system prompts fail at two extremes — complex brittle hardcoded logic, and vague high-level guidance with no concrete signals. Aim for "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics." Calibration loop: start with the minimal set of information that fully outlines expected behavior; test on the strongest model first; add instructions and examples from observed failure modes; resist the laundry list of edge cases.

## Contents

1. [The six typed components](#1-the-six-typed-components)
2. [Assembly order and long-context placement](#2-assembly-order-and-long-context-placement)
3. [Lexical overlap and re-injection](#3-lexical-overlap-and-re-injection)
4. [Format selection](#4-format-selection-structure-over-prose)
5. [Context collapse](#5-context-collapse-the-silent-failure-mode)
6. [Evolving playbooks](#6-evolving-playbooks-vs-compressed-prompts)
7. [Optimize agents before topologies](#7-optimize-agents-before-topologies)
8. [Long-horizon strategies](#8-long-horizon-strategies)
9. [Decision table](#9-decision-table)
10. [Checklist](#10-checklist)

## 1. The six typed components

Every context payload decomposes into six types (survey 2507.13334). Name them explicitly when designing a system so nothing is accidentally omitted or conflated.

| Component | What it contains | Source |
|---|---|---|
| **Instructions** | System rules, role, behavioral constraints, output format | Static config or skill files |
| **Knowledge** | Retrieved facts, documents, database results | RAG, search APIs, KG queries |
| **Tools** | Function signatures, schemas, usage guidance | Tool registry, MCP definitions |
| **Memory** | Persistent information across turns/sessions, learned lessons | Memory systems, note files |
| **State** | Current world/workflow position, collected data | Runtime environment, orchestrator |
| **Query** | The user's immediate request | User input |

Each component can be optimized independently — that is the point of the decomposition (see §7).

## 2. Assembly order and long-context placement

Default assembly for ordinary prompts: instructions → tools → knowledge → memory → state → query last (recency gives the query strong attention).

**Long-context override (20k+ tokens of data):** put the longform data at the TOP, above instructions and examples, with the query and output format at the END. Anthropic, verbatim: "Queries at the end can improve response quality by up to 30% in tests, especially with complex, multi-document inputs."

Wrap each document:

```xml
<documents>
  <document index="1">
    <source>report-2026-q1.pdf</source>
    <document_content>…</document_content>
  </document>
</documents>
```

**Quote grounding:** for long-document tasks, ask Claude to quote the relevant passages first, before carrying out the task — quotes in `<quotes>` tags, then the answer in `<info>` tags. This cuts through the noise and anchors the answer in the source.

## 3. Lexical overlap and re-injection

NoLiMa (2502.05167) measured long-context retrieval with **zero lexical overlap** between question and answer: models with six-figure nominal windows degraded severely by 32K tokens, and adding literal matches (multiple-choice framing) raised 32K two-hop accuracy from 25.9% to 87.2%. Lexical overlap, not placement alone, is the dominant variable; literal-match *distractors* actively mislead attention.

2025 study snapshot — model rows cited as study artifacts, not current guidance:

| Model (as tested, 2025) | Claimed length | Effective length | Base → 32K score |
|---|---|---|---|
| GPT-4o | 128K | 8K | 99.3% → 69.7% |
| Claude 3.5 Sonnet | 200K | 4K | 87.5% → 29.8% |
| Llama 3.3 70B | 128K | 2K | 97.3% → 42.7% |
| Gemini 1.5 Pro | 2M | 2K | 92.6% → 48.2% |

Current Claude ships a 1M-token window with context awareness, so don't read these rows as a hard "design for 2–8K" ceiling. The surviving rules:

- **Ensure lexical overlap**: repeat key query terms in relevant knowledge sections; use section headers in the vocabulary of likely questions.
- **Re-inject at decision points**: for instructions that must hold across a long session, event-driven reminders at decision points beat one-time placement (OpenDev 2603.05344). Placement helps; re-injection works.
- **Retrieve rather than stuff**: pull relevant chunks near the query instead of trusting raw window size for needle-finding without keyword overlap.

## 4. Format selection: structure over prose

The format of a component changes how reliably it is processed.

| Format | Best for |
|---|---|
| XML tags | Delimiting component boundaries, marking untrusted input |
| Markdown headers + bullets | Instructions, playbooks, evolving contexts |
| JSON / structured data | Tool definitions, state objects, schemas |
| Code blocks | Algorithmic procedures, conditional rules |
| Tables | Decision matrices, lookup references |
| Prose | Role descriptions, nuanced behavioral guidance |

**The rule:** use the most structured format that captures the information without loss. Prose is the fallback, not the default.

Example — a conditional rule as prose vs code:

Prose (worse): "If the user asks about pricing and they are an enterprise customer, show the enterprise tier. If they are not enterprise but have been a customer for more than a year, show the loyalty discount. Otherwise show standard pricing."

Code (better):

```python
if customer.tier == "enterprise":
    show(enterprise_pricing)
elif customer.tenure_months > 12:
    show(loyalty_discount)
else:
    show(standard_pricing)
```

The code version eliminates ambiguity about edge cases, nesting, and precedence.

## 5. Context collapse: the silent failure mode

When an LLM is asked to rewrite or summarize accumulated context, it catastrophically compresses it. ACE (2510.04618): one monolithic LLM rewrite collapsed an 18,282-token context to 122 tokens, and accuracy dropped below the no-adaptation baseline. The accumulated knowledge was destroyed.

Why: models carry a brevity bias into rewriting tasks, and at scale they cannot attend to everything they are compressing — details are dropped silently.

Prevention — incremental delta updates, never monolithic rewrites:

| Rule | Rationale |
|---|---|
| Never ask an LLM to rewrite the entire context in one pass | Guaranteed information loss at scale |
| Represent knowledge as itemized bullets, not paragraphs | Enables localized updates; no coupling between facts |
| Use deterministic logic for merge/dedup, not LLM judgment | Removes the compression bias |
| Track per-item metadata (used / helpful counters) | Evidence-based pruning instead of guessed importance |
| Set a context budget; prune least-useful items when full | Controlled degradation instead of collapse |

## 6. Evolving playbooks vs compressed prompts

Traditional prompt optimization converges toward short generic instructions. Domain-intensive agent tasks need the opposite: detailed playbooks that preserve heuristics, failure modes, and tool patterns. ACE's playbook approach (Generator marks helpful/harmful bullets; Reflector extracts delta insights; Curator merges deterministically) gained +10.6% on agent tasks over the best baseline while cutting adaptation latency.

| Situation | Approach |
|---|---|
| Simple single-turn wrapper | Compressed prompt — playbook overhead unjustified |
| Domain-intensive agent (finance, legal, code) | Evolving playbook; brevity bias drops critical heuristics |
| No reliable execution feedback | Offline-optimized prompt, frozen — online adaptation degrades without a feedback signal |
| Shared system prompt across many users | Optimize offline, freeze for deployment |

The two findings compose, not conflict: compress what enters each *inference* (smallest high-signal set); preserve detail in the *artifact* that accumulates domain knowledge.

## 7. Optimize agents before topologies

The most impactful intervention in multi-agent systems is not adding debate, reflection, or aggregation — it is optimizing each agent's prompt first. MASS (2502.02533):

| Configuration | Average accuracy |
|---|---|
| Base CoT (no optimization) | 65.3% |
| Multi-agent debate (unoptimized) | 70.3% |
| Self-reflection (unoptimized) | 69.7% |
| Prompt-optimized single agent | ~74.2% |
| MASS (prompt opt → topology search → re-opt) | 78.8% |

A prompt-optimized single agent beats naive multi-agent debate at equivalent token budgets; most topology blocks are neutral or harmful. If you haven't optimized individual prompts yet, stop — topology on unoptimized prompts wastes compute. Topology choice itself is the agent skill's domain.

## 8. Long-horizon strategies

Three techniques for work that outlives one context window (Anthropic context-engineering guidance):

1. **Compaction** — summarize near the limit and reinitialize. Danger: "overly aggressive compaction can result in the loss of subtle but critical context." Tune for maximum recall first, then precision. Often better: prefer a fresh context plus filesystem state discovery over compaction — current Claude is highly effective at reconstructing state from progress files, test lists, and git logs, given prescriptive restart steps.
2. **Structured note-taking / agentic memory** — persist notes outside the window and pull them back later. One lesson per file with a one-line summary (snippets.md #16).
3. **Subagent isolation** — specialized subagents handle focused tasks in clean context windows and return only a condensed, distilled summary sized per the agent skill's norm; the detailed search context stays isolated in the subagent.

**State reconstruction (multi-turn template).** For long conversations, reconstruct minimal state each turn instead of replaying history: a compact `<conversation_state>` block holding identity, workflow position, collected fields, and pending actions. Token growth stays linear instead of exponential, and early-turn decisions survive verbatim instead of via lossy recall.

## 9. Decision table

| System type | Component priority | Key risk | Primary technique |
|---|---|---|---|
| Single-turn QA / classification | instructions + query + purpose-matched examples | Over-constraining | Minimal prompt; removal test (review.md) |
| RAG system | knowledge (placed per §2) + instructions + query | No lexical overlap; stuffing instead of retrieving | Retrieve relevant chunks; keyword overlap between query and passages |
| Agentic tool-use | tools + instructions + state | Tool definitions buried; state growing unbounded | Structured state; prune completed actions |
| Multi-turn conversation | state (reconstructed) + memory + query | Exponential history growth | State reconstruction (§8) |
| Domain-intensive agent | memory (playbook) + instructions + state | Context collapse; brevity bias | Evolving playbook; incremental deltas (§5–6) |
| Multi-agent system | optimized per-agent instructions | Topology before prompt quality | MASS order (§7); dispatch design via the agent skill |
| Long-document analysis | knowledge (top) + query (end) | Trusting nominal window without overlap | §2 placement + quote grounding + retrieval |

## 10. Checklist

| Check | Question | If no |
|---|---|---|
| Component decomposition | Are all six component types identified? | Map every input to a type — one is likely conflated or missing |
| Placement | Longform data at top, query and format at the end? | Reorder per §2 |
| Lexical overlap | Do queries share vocabulary with passages they must find? | Add headers, repeat key terms |
| Re-injection | Do long-session constraints recur at decision points? | Add event-driven reminders (§3) |
| Format | Is every component in the most structured lossless format? | Convert prose rules to tables/code |
| Evolution strategy | Does growing context use incremental deltas? | Switch from rewrites to bullet-based deltas (§5) |
| Agent optimization | Are individual prompts optimized before topology? | Optimize prompts first (§7) |
