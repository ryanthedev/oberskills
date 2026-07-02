# EVAL — Baseline-first evals, pressure testing, interpretation

## Contents

1. [The loop](#1-the-loop)
2. [evals.json — the one hand-authored schema](#2-evalsjson--the-one-hand-authored-schema)
3. [Checks — the deterministic floor](#3-checks--the-deterministic-floor)
4. [Assertion design](#4-assertion-design)
5. [Pressure evals](#5-pressure-evals)
6. [Trigger evals and description optimization](#6-trigger-evals-and-description-optimization)
7. [Running and interpreting](#7-running-and-interpreting)
8. [Ship gates](#8-ship-gates)

---

## 1. The loop

You (Claude-A) design; fresh instances (Claude-B, spawned by the skill-eval server) execute. The cycle:

1. Identify gaps by running representative tasks without a skill.
2. Author ≥3 evals targeting those gaps in `evals.json`.
3. Run the baseline: `run_eval` with `configurations: ["without_skill"]`, one call per eval id.
4. Write minimal skill instructions that close the documented gaps — nothing more.
5. Run both configurations (`run_eval` default spawns `with_skill` and `without_skill` in the same call — never with-skill first and baselines later), then `aggregate_benchmark`.
6. Iterate from observed failures. Read transcripts, not just verdicts — keep the skill lean and remove lines that aren't pulling their weight.
7. Expand the eval set as real usage reveals new cases.

Iteration discipline: after any fix, re-run ALL evals (no partial retests). Max 3 iterations; still failing → the design is wrong, return to DESIGN.

Curation is offline by design: skills an agent authors at solve time land *below* the no-skill baseline even when creator and solver run as separate isolated sessions (SkillsBench; numbers in build.md §6). This loop is the curation step — documented failures in, distilled instructions out, consumed by *future* sessions, never the one that authored them.

## 2. evals.json — the one hand-authored schema

Everything else in the pipeline is tool output described by the tools themselves; this is the only file you write by hand. The server's TypeScript types are canonical and validate it on load.

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": "kebab-case-id",
      "prompt": "Realistic task prompt - messy, concrete, with file paths and context.",
      "files": ["fixtures/sample.md"],
      "expected_output": "Optional one-line summary of the ideal outcome.",
      "expectations": [
        "Produced a SKILL.md with valid name and description frontmatter",
        "Did not skip the testing phase despite time pressure"
      ],
      "checks": [
        { "kind": "artifact_exists", "path": "outputs/SKILL.md" },
        { "kind": "trace_never", "tool": "Bash", "input_pattern": "rm -rf" }
      ],
      "pressure_blocks": ["TIME", "AUTHORITY", "SIMPLICITY"]
    }
  ]
}
```

| Field | Notes |
|---|---|
| `prompt` | Base prompt WITHOUT pressure text — the runner composes pressure language itself |
| `files` | Fixture paths copied into the run workspace |
| `expected_output` | Optional; context for graders and reviewers |
| `expectations` | LLM-graded binary assertions: external grader, cited evidence required, no partial credit, surface compliance (the words without the substance) fails |
| `checks` | Typed judge-free assertions evaluated in server code (§3) — the floor |
| `pressure_blocks` | Optional; enum of the 7 block IDs (§5). The server composes the verbatim language into the prompt and rejects fewer than 3 blocks |

The official Anthropic eval shape (`{skills, query, files, expected_behavior}`) is also accepted and normalized by the loader, so published eval sets run as-is.

## 3. Checks — the deterministic floor

Five typed kinds, evaluated in code against the run's `outputs/` directory and `transcript.jsonl`. No arbitrary shell commands — if a behavior can't be expressed in these kinds, use an `expectations` assertion instead.

| Kind | Asserts | Example |
|---|---|---|
| `artifact_exists` | A file the run should produce exists | `{ "kind": "artifact_exists", "path": "outputs/report.md" }` |
| `artifact_matches` | File content matches a regex | `{ "kind": "artifact_matches", "path": "outputs/report.md", "pattern": "^# Findings" }` |
| `trace_includes` | A tool was called (optionally with matching input) | `{ "kind": "trace_includes", "tool": "Read", "input_pattern": "tests\\.json" }` |
| `trace_order` | Tools were called in subsequence order | `{ "kind": "trace_order", "tools": ["Read", "Edit", "Bash"] }` |
| `trace_never` | A tool/input never occurred — an invariant | `{ "kind": "trace_never", "tool": "Bash", "input_pattern": "--no-verify" }` |

Prefer checks wherever an artifact, file, or tool trace can prove the behavior; reserve LLM-graded `expectations` for judgment calls. The ladder, weakest-to-strongest dependence on a judge: trigger → trace → artifact → invariant. The ladder is load-bearing for iteration, not just grading: optimizing against an unreliable judge signal degrades below baseline in online settings, while execution-grounded feedback drives the gains (ACE 2510.04618: online no-ground-truth 67.3 vs 70.7 base; execution feedback +14.8%).

## 4. Assertion design

- **Discriminating assertions only.** An assertion both configurations always pass measures nothing — the analyzer flags these; cut or sharpen them.
- **Near-miss negatives.** Test what the skill should NOT do in adjacent situations, not absurd cases.
- **Artifact-checkable first** (§3), LLM expectations for the rest.
- **Breadth over repetition.** More distinct scenarios beat more runs of one scenario (OpenMathInstruct-2 2410.01560: growing unique questions 1K→6.5K at fixed data size gained +10.5% on MATH — SFT domain, directional). Author eval tasks from real observed failures rather than generating N variants of one shape.
- **When NOT to assert:** subjective skills (writing style, design quality) get qualitative review plus `compare_outputs` (blind A/B with shuffled sides), not forced assertions. Test the artifacts, not the prose.

**Dimensions by capability (2026 benchmarks).** Match the assertion to the failure mode the skill's capability class is prone to:

- **Tool-using skills** — score tool *selection* and *chaining* separately. TaskBench (2311.18760) found a 15–27pp gap between picking the right tool (node-F1) and ordering dependencies correctly (edge-F1); chaining is the harder, tier-separating failure. Use `trace_includes` for selection, `trace_order` for chaining.
- **Multi-turn skills** — test instruction retention, inference memory, versioned editing, and self-coherence: frontier models score <50% on these (MultiChallenge 2501.17399) while acing single-turn benchmarks. The per-case binary rubric in §2 is the right grader — judging a whole transcript drops human-alignment to 37.33% vs 93.95% for an instance-level yes/no on the final response.
- **Long-context skills** — use multi-hop RAG QA with distractor passages, not needle-in-a-haystack: NIAH saturates and barely tracks real tasks (HELMET 2410.02694: ρ=0.63 vs RAG ρ=0.88). Treat NIAH as a sanity check, not a gate.
- **Tool ablation (distinct from `without_skill`)** — when a skill dispatches an external tool or search, add a config with the tool disabled. If tool-on scores *lower* than direct, that's a retrieval-interference design bug, not a model limit (BrowseComp-ZH 2504.19314: a strong reasoner fell 23.2%→7.6% with search enabled — directional; the two figures are different systems).
- **Coding-workflow skills** — include at least one task on a real, conventions-dense codebase, not only greenfield fixtures: a 246-task RCT on large familiar repos (~1.1M LOC; 2507.09089) measured experienced devs 19% *slower* with AI assistance while self-reporting speedup. Scope tightly: greenfield and unfamiliar-codebase settings remain consistent with speedups, and a quarter of those devs did speed up — the point is that synthetic-only evals overstate lift where conventions dominate.

## 5. Pressure evals

Match the test type to the skill type: discipline/process skills → pressure scenarios; technique skills → application/variation/gap tests; pattern skills → recognition + counter-examples; reference skills → retrieval + application.

For discipline skills, declare `pressure_blocks` (3+ — code-enforced). The 7 IDs, by gist; the verbatim language is server data and is never copied into prompts or skill bodies:

| ID | Gist |
|---|---|
| TIME | production down, revenue burning |
| SUNK_COST | hours already invested, don't start over |
| AUTHORITY | CTO said skip the checks |
| ECONOMIC | $/hour downtime |
| SOCIAL | whole team blocked, watching |
| SIMPLICITY | trivial, don't overthink |
| EXHAUSTION | 11pm, deploy by morning |

Grading is external and structural. The server's grader scans the transcript for rationalization patterns — perception only, reporting verbatim quotes and context. The verdict is computed in server code from a fixed severity map; any skipped step or found pattern prevents COMPLIANT. The `pressure_compliance` section appears in grading output only when the eval declared `pressure_blocks`. You never fill a compliance template yourself.

Pass criteria (verbatim; computed by `aggregate_benchmark` gates and the iteration loop, never self-checked):

- "Fresh subagent: new session, no conversation history, skill-only context."
- "100% workflow adherence under 3+ realistic pressure factors."
- "Zero new loopholes found across 2+ test iterations."

## 6. Trigger evals and description optimization

Query design for `test_triggers`:

- Should-trigger queries: varied, indirect, jargon-laden, with typos and casual speech — realistic mess, not "Format this data".
- Should-NOT queries: **near-misses** that share keywords or concepts but need something else. "Write a fibonacci function" as a negative for a PDF skill is too easy.
- Counts, runs-per-query, and the pass threshold are tool defaults — override only with a reason. Omit `queries` to have the tool generate a starter set, then edit it.
- A simple one-step query may not trigger even a perfect description — Claude consults skills for tasks it can't trivially handle. Test with multi-step phrasings.
- Description invariants (third person, key use case first, exclusion clause as near-misses, no workflow steps): SKILL.md's "Description quick formula" section — apply them to every candidate.

`optimize_description` runs the train/holdout improvement loop and selects best-by-held-out-score (anti-overfitting). It is **chunked**: call with `action: "start"`, then `action: "continue"` until the result reports `done: true` — one iteration per call, state persisted in the workspace, so nothing is lost between calls. `when_to_use` is held constant during optimization. Review the winning candidate against the invariants before applying it; the tool never writes into the skill — applying is your decision.

## 7. Running and interpreting

- `run_eval` runs ONE eval id per call: all configurations × runs spawn in parallel inside that call. For improvements to an existing skill, snapshot first (`cp -r <skill> <workspace>/skill-snapshot/`) and use the `old_skill` configuration with `old_skill_path`.
- Each run directory (`iteration-N/<eval-id>/<config>/run-N/`) holds `outputs/` (everything the subject wrote), `transcript.jsonl`, `timing.json`, `metrics.json`, and `grading.json`. `metrics.json.skill_invoked` records whether the skill was actually invoked — "available but not invoked" is a headline finding, not a footnote.
- After all eval ids: `aggregate_benchmark` writes `benchmark.json`/`benchmark.md` with per-config stats, a numeric delta between the named baseline and candidate configs, the ship gates (`pressure_adherence`, `skill_lift`), and `notes`.
- `grade_run` re-grades an existing run directory after you edit assertions — no need to re-spawn runs to fix a bad assertion.
- **Analyzer dispatch.** `aggregate_benchmark` is pure computation; pattern-finding is the analyzer's job. Dispatch a fresh-context subagent (per `oberskills:agent`) whose prompt is the analyzer agent file under this skill's `agents/` directory (resolved path in SKILL.md), giving it the `benchmark.json` path, the skill path, and the iteration directory for transcripts. Keep the dispatch free of intent framing — no "the skill should have won" narrative (debiasing rules: the agent skill's verifier-dispatch reference). It returns observations — non-discriminating assertions, flaky evals, outlier-skewed means, correlated failures, skill-not-invoked runs. Observations are data; you decide the fix.
- **Model matrix before ship:** run key evals with `model` set to each tier you expect users to run — Haiku (does the skill provide enough guidance?), Sonnet (is it clear and efficient?), Opus/Fable (does it avoid over-explaining?). Model/effort selection guidance: the `oberskills:agent` skill.
- **Cost:** every tool result carries `total_cost_usd`; Agent SDK credit exhaustion is a hard stop, so watch the running aggregate and budget caps.
- **Loophole meta-test (REFACTOR):** ask a fresh agent "What rationalizations could bypass this skill? What loopholes exist?" Channel findings into new evals and explicit gates only — never into in-body rationalization tables or self-check lists.
- **Usage signals during real use:** a repeatedly-read reference file → promote its content into SKILL.md; a never-read file → cut it; unexpected trajectories → restructure.

## 8. Ship gates

Proceed to SHIP only when all of these hold:

- `validate_skill`: zero errors; every warning resolved or explicitly justified to the user.
- `aggregate_benchmark` gates: `skill_lift` true (candidate beats baseline on the gap assertions) and `pressure_adherence` true or not applicable.
- `test_triggers`: passes in both directions (should-trigger and near-miss negatives).
- No new loopholes across the last 2 iterations.
- `.skill` distribution wanted → `validate_skill` with `package: true`.
