# Evals

Hand-authored eval sets for the meta-skills, run through the `skill-eval` MCP server.
Schema and assertion-design rules: `skills/skill-craft/references/eval.md`.

```
evals/<skill>/evals.json      # eval definitions (house schema)
evals/<skill>/fixtures/       # files copied into each run's workspace
```

## Running one

```
run_eval
  skill_path:      /abs/path/to/skills/<skill>
  evals_path:      /abs/path/to/evals/<skill>/evals.json
  eval_id:         <id from evals.json>
  configurations:  ["with_skill", "old_skill", "without_skill"]
  old_skill_path:  <a snapshot to compare against>
```

Results land in `skills/<skill>-workspace/iteration-N/` (gitignored). Follow with
`aggregate_benchmark` over the iteration dir.

## Cost policy

A regression run should cost **under $2 per eval**. The first full session on these
sets cost about $19, and most of it bought nothing — a third went to a
`without_skill` config that only re-measured what the base model already does, and
the rest went to LLM graders that timed out and returned no verdict at all.

Defaults for a regression run:

| Lever | Setting | Why |
|---|---|---|
| `configurations` | `["with_skill", "old_skill"]` | `without_skill` measures the base model, not the change. Add it only when establishing a first baseline. |
| `runs` | 2 | Enough to catch a flip. Three runs bought no extra signal here. |
| `expectations` | 3 or fewer | Graders fail past roughly four assertions across two artifacts. |
| `checks` | as many as possible | Free, deterministic, and they cannot time out. |
| `grader_model` | `haiku` at 3 assertions | Only fails when the assertion count is high. |

The rule that keeps it cheap: **anything provable by a regex or a tool trace belongs
in `checks`, not `expectations`.** Both separators these sets have found — `max_tokens`
raised in the prompt set, Fable absent in the agent set — are regex checks. They were
originally paid LLM assertions, which is exactly the mistake to avoid. Reserve the
grader for genuine judgment: whether a stated *rationale* is the right one, whether a
near-miss negative was respected.

Checks can also be replayed offline against artifacts from previous runs, which costs
nothing and verifies a new assertion discriminates before spending on a live run.

## Gotcha: negative assertions and the multiline flag

Patterns are compiled multiline, so `^` matches at every line start. A whole-file
negative written as `^(?![\s\S]*Fable)` therefore passes trivially — it succeeds at
any line after the last occurrence. Pin position 0 with a lookbehind instead:

```
(?<![\s\S])(?![\s\S]*[Ff]able)
```

The broken form reported 6/6 passing on files that plainly contained the word; the
fixed form correctly separates 3 from 3. JS regex has no `\A`, and there is no
`artifact_not_matches` check kind, so this is the way to express "file must not
contain X".

To measure a *change* rather than the skill's existence, snapshot the pre-change
skill and pass it as `old_skill`:

```sh
git archive HEAD skills/prompt | tar -x -C skills/prompt-workspace/skill-snapshot
```

## Gotcha: the grader

The default grader model is one tier below the subject. On these eval sets — six or
more assertions across two artifacts — a Haiku grader runs out of turns and the run
comes back with `grading_error: agent error result (error_max_turns)` even though the
subject run completed and wrote every output. Pass `grader_model: "sonnet"`, or
re-grade the run directory afterwards with `grade_run`; no re-spawning is needed.

## What these target

Both sets are regression tests for the 2026-07-24 Opus 5 guidance sweep, written so
that assertions discriminate between the current skill and its pre-sweep snapshot.

Two clean separators measured so far, both current-skill 3/3 (or 2/2) against
pre-sweep 0/0:

- prompt — `max_tokens` shares the thinking cap on Opus 5. Every run that read the
  current skill caught the truncation risk; runs that did not, missed it, and one
  recommended *lowering* `max_tokens`.
- agent — the orchestrator tier. Every pre-sweep run reaches for Fable 5, which the
  old tier table called "the orchestrator itself"; no current-skill run mentions it.

Known non-discriminating assertions, kept as regression coverage rather than as
evidence of lift: deterministic-checks-first, no-intent-framing, no self-verify in
worker briefs, and low/medium effort for mechanical workers. That guidance predates
the sweep, so both configurations pass.

Known gap: no eval yet demonstrates the Opus 5 delegation cap changing behavior. In
`opus5-fanout-dispatch-plan` every run lands on 4-8 workers unaided, so the cap is
never the binding constraint and its rationale never surfaces. Testing it needs a
scenario that actively pulls toward over-spawning.
