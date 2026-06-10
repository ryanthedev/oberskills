# Orchestration patterns — multi-agent structure, sizing, and diagnosis

Pattern catalog and the canonical home of the plugin's multi-agent sizing numbers. The SKILL.md dispatch gate and fan-out defaults derive from the evidence here.

## Contents

1. [Pattern catalog](#1-pattern-catalog)
2. [Sizing evidence (canonical numbers)](#2-sizing-evidence-canonical-numbers)
3. [Topology selection](#3-topology-selection)
4. [Long-run harness patterns](#4-long-run-harness-patterns)
5. [Diagnosing an underperforming multi-agent setup](#5-diagnosing-an-underperforming-multi-agent-setup)

## 1. Pattern catalog

| Pattern | When | Structure | The one failure to avoid |
|---|---|---|---|
| Orchestrator–workers | A decomposable task where you (the main conversation) can divide and synthesize | You write one contract per worker, dispatch, then synthesize returns | Vague division of labor — workers duplicate or gap without explicit per-agent boundaries |
| Fan-out / fan-in | Many independent items processed the same way | Same-turn parallel dispatch, one item or angle per agent | Unbounded returns. Fan-in is where value is created — the orchestrator spots connections no single agent saw — but only if each return is distilled |
| Validation chain | Output needs checking before use | Producer agent → fresh-eyes verifier agent (rules in verifier-dispatch.md, this directory) | Letting the producer self-validate, or briefing the verifier with the producer's intent |
| Two-stage review | Implementation against a plan (production-tested in Superpowers 4) | Spec-review subagent (validates against the plan) then code-review subagent (quality), sequential, each looping until pass | Merging the stages — spec conformance and code quality need different framing |
| Specialist routing | Subtasks need different tools, skills, or models | Route each subtask to an agent defined for it (or a tier per §3 of SKILL.md) | Routing by topic when the real difference is capability — most "specialists" are just a model tier + tool set |
| Pipeline | Sequential stages where each consumes the last's output | A → B → C, dispatched one at a time from the main conversation | Letting context decay across handoffs — every stage gets the goal anchor and a compressed state summary |

## 2. Sizing evidence (canonical numbers)

- Multi-agent team performance peaks around **3 agents** and **7 refinement iterations**; more of either is worse (MARBLE 2503.01935). The 3-agent peak is for interacting/refining teams; independent breadth-first fan-outs with non-overlapping scopes tolerate up to ~10 agents (Anthropic research system).
- **Group discussion is the worst coordination strategy** tested; structured protocols and star topologies win (MARBLE 2503.01935).
- Hybrid routing — easy tasks to a single agent, hard tasks to multi-agent — improves accuracy 1–12% while cutting costs **up to 88%** vs always-multi-agent (SAS-vs-MAS 2505.18286).
- Goal anchoring nearly doubles long-horizon task success: 70% vs 38% for unanchored ReAct (ReCAP 2510.23822).
- Failure memory (listing tried-and-failed approaches in the replanning prompt) cuts retry loops by 30–50% (ReCAP 2510.23822).

Start with a single agent; add agents only with a specific structural reason. Multi-agent advantages shrink as models get more capable.

| Condition | Single agent | Multi-agent |
|---|---|---|
| Task fits in one context window | Yes | — |
| Subtasks need different tools or capabilities | — | Yes |
| Context isolation needed (e.g. one document per agent) | — | Yes |
| Independent subtasks benefit from parallelism | — | Yes |
| Adversarial validation needed (checker ≠ doer) | — | Yes |
| Subtasks tightly coupled, need shared state | Yes | — |
| Coordination overhead would exceed the benefit | Yes | — |
| Easy and hard queries mixed in one workload | Hybrid: route easy → single, hard → multi | |

## 3. Topology selection

| Topology | Structure | Best for | Overhead |
|---|---|---|---|
| Pipeline | A → B → C | Sequential processing stages | Low |
| Star | Hub dispatches to and collects from specialists | Independent subtasks needing synthesis | Low |
| Tree | Manager → sub-managers → workers | Deep decomposition with delegation | Medium |
| DAG | Agents along dependency edges | Complex workflows with partial ordering | High |

Default to pipeline or star. Tree and DAG add coordination complexity that pays off only for genuinely complex dependency structures.

For manager-style orchestration, model task dependencies as a DAG, not a flat list: independent tasks run in parallel, dependent tasks wait for prerequisites. The manager decomposes, builds the DAG, matches subtasks to agent capabilities, dispatches, monitors, and merges new information into the existing DAG rather than rebuilding (Manager Agent 2510.02557; optimal span 3–8 agents per manager, hierarchical sub-managers beyond that).

Research directions exist for evolving topology and prompts jointly (HiVA) and routing queries to architectures by difficulty (MaAS); the dispatch-time takeaway is their shared insight — when a multi-agent setup underperforms, ask whether an agent should exist at all, and whether two agents should merge, before tuning any agent's prompt.

## 4. Long-run harness patterns

For work spanning many sessions or context windows (from Anthropic's long-running-agents guidance):

- **Two-agent split.** An initializer agent (first session) creates `init.sh`, a progress file, the feature list, and an initial git commit. A coding agent (every later session) works one feature at a time, leaves a clean state, and updates state files before ending.
- **Feature list as JSON**, with per-feature verification steps and a boolean `passes` flag (initially false). Include the instruction: "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality." Models are less likely to inappropriately rewrite JSON than Markdown.
- **Session-start sequence** in every later dispatch: run `pwd` → read the git logs and progress files → read the feature list and pick the highest-priority unfinished feature → run `init.sh` and a basic end-to-end verification before new work.
- **Git as state.** Commits are checkpoints and the recovery mechanism; progress notes are freeform, structured state is JSON.
- **Prefer fresh context + filesystem state discovery over compaction.** Current models are very effective at discovering state from disk; a fresh session reading `progress.txt`, the feature list, and git logs beats a compacted window carrying degraded history.

## 5. Diagnosing an underperforming multi-agent setup

Three structurally distinct defect levels (SAS-vs-MAS 2505.18286); identify the level before changing anything — upgrading the wrong agent wastes budget.

| Defect level | Symptom | Fix |
|---|---|---|
| Node | One agent bottlenecks the pipeline | Redistribute its subtasks, or upgrade that specific agent (model/effort), not all of them |
| Edge | A downstream agent degrades — overwhelmed by upstream context | Compress at the handoff: 1–2 sentence subtask summaries plus state changes, full goal anchor retained |
| Path | Small errors compound through the chain | Insert verification checkpoints between stages (validation chain, §1) |
