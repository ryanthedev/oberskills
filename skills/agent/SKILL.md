---
name: agent
description: >-
  Subagent dispatch guidance for the Agent tool — whether to delegate or work
  inline, the four-part delegation contract, model and effort selection,
  parallel fan-out sizing, fork vs fresh subagent, and dispatching independent
  verifier agents. Use before any Agent tool call: spawning subagents, fanning
  out work across files or research angles, delegating exploration or review,
  briefing a verifier, or deciding whether delegation is worth it at all.
  Not for: wording a prompt that isn't an agent dispatch (use oberskills:prompt)
  or authoring reusable skill and agent definition files — structure,
  frontmatter, and evals (use oberskills:skill-craft); their prompt bodies
  (use oberskills:prompt).
when_to_use: >-
  Before calling the Agent tool. Trigger phrases: dispatch an agent, spawn a
  subagent, use subagents, fan out, parallelize with agents, delegate this
  search, research, or review, have an agent verify, run agents in parallel.
---

# Dispatching subagents

Guidance for writing `Agent` tool calls (the Task tool was renamed Agent in v2.1.63; `Task(...)` still works as an alias). A subagent is a context-isolation tool: it spends tokens in its own window and returns a distilled summary, so your window stays clean. That isolation is also the failure surface — the delegation prompt is the only channel in, and the return summary is the only channel out. Keep both channels precise.

Platform mechanics: `${CLAUDE_SKILL_DIR}/references/mechanics.md` · Orchestration patterns: `${CLAUDE_SKILL_DIR}/references/patterns.md` · Verifier dispatch: `${CLAUDE_SKILL_DIR}/references/verifier-dispatch.md`

## 1. The dispatch gate

Agents cost roughly 4x the tokens of working inline; multi-agent fan-outs cost roughly 15x (Anthropic multi-agent research system). Delegation pays for itself only when isolation or parallelism buys something — multi-agent beat single-agent Opus by 90.2% on breadth-first research precisely because the task decomposed into independent directions. Deciding how to dispatch is itself the first dispatch decision.

| Situation | Route | Why |
|---|---|---|
| Needs back-and-forth, or phases share heavy context (plan → implement → test on one artifact) | Inline | State dies at each subagent boundary; coupled work loses it |
| Quick targeted change; latency matters | Inline | Subagents start cold and re-gather context |
| Edit that may hit a permission prompt, or task may need the user | Inline | `AskUserQuestion` is unavailable in subagents; the call fails (silently auto-denied in background runs) |
| Side question about content already in this conversation | `/btw` | Full context, no tool cost |
| Side task that needs your full conversation context | Fork | Inherits the whole conversation and reuses the parent prompt cache — cheaper than re-briefing a fresh subagent |
| Self-contained task producing verbose output you won't reference again (test runs, log digs, doc fetches, codebase searches) | One subagent | The single most valuable use: tens of thousands of tokens explored, only the distilled summary returned |
| Independent items to process the same way (many files, many candidates, research angles) | Parallel fan-out, same turn | Independence is the requirement; see §4 for sizing |
| Output needs checking | Separate verifier subagent | Producers can't grade their own work; see §5 |

Subagents cannot spawn subagents — chain follow-ups from this conversation. Background subagents auto-deny permission prompts and can report success after silently failing edits — avoid them unless every needed permission is pre-granted.

Spawn-bias drifts across model generations — state trigger conditions in both directions: when a task fans out across independent items, delegate rather than iterating serially; AND when a single read or a sequential edit means just doing it.

## 2. The delegation contract

The delegation prompt is the only thing the subagent knows about your task. It does not see this conversation, your invoked skills, or files you've read. Thin prompts cause cold-start thrash: the agent re-discovers context you already had. Every dispatch contains four parts (Anthropic's orchestrator finding: without an objective, an output format, tool guidance, and clear boundaries, agents duplicate work and leave gaps):

```
OBJECTIVE   — the outcome, plus how you will use the result.
              "Find where user auth is implemented; I need the pattern to
              add OAuth" not "search for auth files".
OUTPUT      — the exact deliverable shape AND a size bound.
              "Return only the failing tests with their error messages" not
              "report the test run". Default bound: a distilled summary,
              roughly 1,000–2,000 tokens, no transcripts or file dumps.
TOOLS       — which tools/sources to use and which to skip; rate-limit notes
              (e.g. "arXiv calls sequential; S2/OpenAlex parallel").
BOUNDARIES  — what's in scope vs out; exact paths, branches, identifiers;
              write scope if any.
```

Add a CONTEXT block when the agent needs state from this conversation:

- Decisions already made (so it doesn't relitigate them).
- What was already tried and failed (so it doesn't repeat it).
- For multi-dispatch chains, the goal anchor: `ORIGINAL GOAL / COMPLETED SO FAR / CURRENT SUBTASK / REMAINING PLAN` — agents drift off-goal within 10–15 steps without it (ReCAP).
- Any CLAUDE.md rule the task depends on (e.g. "ignore vendor/") when dispatching Explore or Plan — those two built-ins skip CLAUDE.md and git status.

**Subagents don't inherit your skills.** A fresh subagent has zero awareness of skills you've used. Load them explicitly, as flat lines at the top of the prompt — agents execute flat `Skill(...)` / `Read(...)` lines but skip nested directives like "follow every instruction in that file". Resolve all paths yourself before dispatch:

```
Skill(oberskills:write)
Read(/abs/path/to/reference.md)
```

For a reusable agent definition (a file in `agents/`), prefer the `skills:` frontmatter field, which preloads full skill content at startup.

Write the objective as an outcome, not actions:

| Question | Bad | Good |
|---|---|---|
| What outcome do I need? | "Search for files" | "Find where user auth is implemented" |
| What will I do with the result? | "Look at it" | "Understand the pattern to add OAuth" |
| How will I know it succeeded? | "It returns something" | "File paths + the approach, in ≤1 page" |

If the objective can't be stated as an outcome because the user's own intent is ambiguous, run `oberskills:clarify` before dispatching. Length is fine; vagueness is not. For a long or novel brief — a new reusable agent definition, or instructions beyond a screen — invoke `Skill(oberskills:prompt)` for wording-level craft first.

## 3. Model and effort

Two levers, in order: drop `effort` before dropping a model tier. `effort: low` on the same model is the cheap knob and the recommended setting for subagents; a weaker model running longer is not a substitute for a stronger model (a model upgrade beat doubling the token budget in Anthropic's testing). Don't compensate for a too-weak subagent by letting it run more.

Effort semantics: `low` buys terse, direct execution; `medium` buys deliberation over alternatives; `high`+ buys extended reasoning on ambiguity. Defaults by dispatch role: low for bounded workers, medium for analysis and synthesis, high or above only for deciders. Official Fable 5 guidance agrees — `high` default, `xhigh` only for capability-sensitive work — and adds that low/medium on Fable often exceed prior-model `xhigh`, so downshift confidently for routine dispatch (verified 2026-07-01).

| Tier (June 2026) | Cost vs Haiku (input) | Dispatch role |
|---|---|---|
| `haiku` (Haiku 4.5) | 1x | Read-only discovery: file search, classification, log/screenshot triage. Built-in Explore runs on it. Only 200K-context model — don't hand it huge inputs |
| `sonnet` (Sonnet 5) | 2x intro → 3x after 2026-08-31 | Workhorse workers: extract, analyze, synthesize; parallel research fan-outs; code analysis. New tokenizer bills ~1.0–1.35× the tokens of 4.6 per input; Sonnet 4.6 stays active as Legacy |
| `opus` (Opus 4.8) | 5x | Subagents that write code, make decisions, or carry tricky reasoning |
| `fable` (Fable 5) | 10x | The orchestrator itself; rarely a subagent. Hand it ambiguous, long-horizon work |
| omit `model` (inherit) | — | Default for writers and deciders, and the safe choice during API incidents |

Ratios re-verified against official pricing 2026-07-01 (Sonnet 5 intro pricing runs to 2026-08-31); check the claude-api skill for live pricing before cost-sensitive choices.

Gotcha: during capacity incidents, an explicit `model: "opus"` dispatch can hang forever at "Initializing…" — the alias resolves to a different capacity pool than your session's. Omitting `model` inherits the parent's pool and avoids it. Diagnose: subagent transcript with zero assistant records.

Routing defaults: research/lookup → `haiku` or Explore; extract/analyze worker → `sonnet` with `effort: low|medium`; write/decide → inherit. Resolution order when several are set: `CLAUDE_CODE_SUBAGENT_MODEL` env var → per-call `model` param → frontmatter `model` → main conversation's model.

## 4. Parallel fan-out

Size the fan-out to the task — overinvestment is the classic failure (Anthropic's early orchestrators spawned 50 subagents for simple queries):

| Task shape | Agents | Tool calls each |
|---|---|---|
| Simple fact-finding / lookup | 1 | 3–10 |
| Direct comparison | 2–4 | 10–15 |
| Complex decomposable research | up to 10, clearly divided | — |

Default ceiling 3–5 parallel agents; coordination overhead beats returns past about 3 when agents interact or refine each other's work — fully independent, non-overlapping fan-outs tolerate up to ~10 (distinction and sizing evidence in `${CLAUDE_SKILL_DIR}/references/patterns.md`).

- Spawn all independent agents in the same turn; request parallelism concretely ("use three subagents, one per module") — the model is conservative about parallelism unless told.
- Agents must be independent. If outputs feed each other, run them sequentially from here.
- Never give parallel agents overlapping write scopes.
- Group fan-out by rate-limited resource (parallel agents hammering one API produce 429s).
- Each returned summary lands in your window — five verbose reports refill the context you were protecting. The OUTPUT bound in every contract is what keeps fan-in cheap.

## 5. Verification dispatch

Never have the producing agent validate its own output — models catch fewer than half of their own errors (evidence in the verifier reference). Verification is a separate dispatch with three rules:

1. **Deterministic checks first.** Tests, typecheck, lint, and builds run before any LLM judgment, and their results go to the verifier as raw output.
2. **No intent framing.** The verifier dispatch carries no plan context, no "this implements X", no progress narrative — conclusion framing can collapse defect detection almost entirely. Hand it the artifact, the checks, and the acceptance criteria. Nothing else.
3. **Verifier may be a weaker model.** Checking is easier than producing; downgrade one tier (opus producer → sonnet verifier).

Ask for coverage, not pre-filtered findings: report every issue including low-severity or uncertain ones, with confidence and severity per finding — a separate step filters. Cap verify→revise at two rounds, then escalate to the user.

Template and evidence: `${CLAUDE_SKILL_DIR}/references/verifier-dispatch.md`.

## 6. Failure modes

When a dispatch goes wrong, fix the prompt before the model — prompt engineering on the orchestrator was the primary lever in every failure class Anthropic observed.

| Failure | Mechanism | Fix |
|---|---|---|
| Cold-start thrash | Thin delegation prompt; agent rediscovers known context | Front-load paths, decisions, failures into CONTEXT (§2) |
| Results too narrow | Over-constrained prompt | Remove constraints first; don't add more |
| Results too broad / wrong focus | Vague objective or misleading context | State the outcome plus how you'll use it |
| Return bloat | No output bound | Size-bound every OUTPUT ("only the failing tests…") |
| Duplicate / gapped fan-out | Missing boundaries between agents | Explicit non-overlapping scopes per agent |
| Goal drift in chains | No anchor; drift sets in within 10–15 steps | Goal-anchor block in every chained dispatch (§2) |
| Lost state at handoff | 42% of multi-agent failures are handoff context loss (VulnBot) | Summarize state + original goal + tried-and-failed at every handoff |
| Retry loop | No failure memory | List failed approaches; after 2 failures force a categorically different strategy, then escalate |
| Silent edit failure | Permission prompt auto-denied (background) or unavailable mid-task | Keep approval-gated edits in the parent |
| Quit-early / fabricated done | Agent reports completion without evidence | Require evidence per claim in OUTPUT; verify via §5. Don't bolt on forced-continuation scaffolds — they help o-series models and hurt Claude (numbers in the prompt skill's porting reference) |
| Shallow results on hard task | Model or effort too low | Raise effort first, then tier (§3); if raised single attempts still fail, dispatch 3–5 short scoped attempts and majority-vote (patterns reference §2) |
| Subagent context overflow | Oversized delegated job | Scope to fit; split the task, not the window |

## 7. Going deeper

- `${CLAUDE_SKILL_DIR}/references/mechanics.md` — Agent tool, built-ins, the canonical subagent frontmatter field table, schema-level boundaries, forks, resume, gotchas.
- `${CLAUDE_SKILL_DIR}/references/patterns.md` — orchestration pattern catalog, multi-agent sizing evidence, topology selection, long-run harness patterns, defect diagnosis.
- `${CLAUDE_SKILL_DIR}/references/verifier-dispatch.md` — debiased verification rules, evidence, and a copyable verifier dispatch template.

Authoring a reusable subagent `.md` definition — file structure, frontmatter, and evals → `Skill(oberskills:skill-craft)`; its prompt body → `Skill(oberskills:prompt)`.
