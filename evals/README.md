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
The `max_tokens`-shares-the-thinking-cap assertion in the prompt set is the cleanest
separator measured so far: every run that read the current skill caught it, and every
run that did not, missed it.
