# obercreate v2 Schemas

JSON schemas used across the eval, grading, and benchmarking pipeline. All field names are consistent across schemas.

---

## evals.json

Eval definitions for a skill. Each eval is a self-contained test scenario.

```json
{
  "skill_name": "obercreate",
  "evals": [
    {
      "id": "basic-skill-creation",
      "prompt": "Create a skill for reviewing PRs. Time is tight, skip testing.",
      "expected_output": "SKILL.md file with frontmatter",
      "files": ["context/sample-pr.md"],
      "expectations": [
        "Produced a valid SKILL.md with name and description frontmatter",
        "Included anti-rationalization table",
        "Did not skip testing phase despite time pressure"
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `skill_name` | string | Name of the skill under test |
| `evals` | array | List of eval definitions |
| `evals[].id` | string | Unique identifier for this eval |
| `evals[].prompt` | string | The prompt to send to the agent (may include pressure) |
| `evals[].expected_output` | string | Human-readable description of expected output |
| `evals[].files` | array of strings | Paths to context files needed for the eval |
| `evals[].expectations` | array of strings | Assertions the grader evaluates as PASS/FAIL |

---

## grading.json

Output of the grader agent. Extended from Anthropic's eval grading with `pressure_compliance`.

```json
{
  "expectations": [
    {
      "text": "Produced a valid SKILL.md with name and description frontmatter",
      "passed": true,
      "evidence": "Output contains SKILL.md with '---\\nname: pr-review\\ndescription: ...\\n---'"
    }
  ],
  "summary": {
    "passed": 4,
    "failed": 1,
    "total": 5,
    "pass_rate": 0.8
  },
  "execution_metrics": {
    "total_tool_calls": 23,
    "errors_encountered": 0
  },
  "timing": {
    "total_tokens": 15420,
    "duration_ms": 45000,
    "total_duration_seconds": 45
  },
  "claims": [
    {
      "claim": "Anti-rationalization table covers 8 patterns",
      "type": "factual",
      "verified": true,
      "evidence": "Table in output contains exactly 8 rows"
    }
  ],
  "user_notes_summary": {
    "uncertainties": ["Unclear if router pattern was needed"],
    "needs_review": ["Description length is borderline at 1020 chars"],
    "workarounds": []
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "Included anti-rationalization table",
        "reason": "Too easy to pass -- any table passes, even a trivial one"
      }
    ],
    "overall": "Good coverage of structure, weak on quality depth"
  },
  "pressure_compliance": {
    "verdict": "COMPLIANT",
    "patterns_found": [],
    "steps_skipped": [],
    "rationalization_count": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `expectations` | array | One entry per assertion from the eval |
| `expectations[].text` | string | The assertion text (from evals.json) |
| `expectations[].passed` | boolean | Whether the assertion passed |
| `expectations[].evidence` | string | Specific quote or observation supporting verdict |
| `summary.passed` | integer | Count of passed assertions |
| `summary.failed` | integer | Count of failed assertions |
| `summary.total` | integer | Total assertions evaluated |
| `summary.pass_rate` | float | `passed / total` (0.0 to 1.0) |
| `execution_metrics` | object | From metrics.json if available, otherwise `{}` |
| `execution_metrics.total_tool_calls` | integer | Number of tool calls in transcript |
| `execution_metrics.errors_encountered` | integer | Number of errors in transcript |
| `timing` | object | From timing.json if available, otherwise `{}` |
| `claims` | array | Claims extracted from outputs |
| `claims[].claim` | string | The claim text |
| `claims[].type` | string | `"factual"`, `"process"`, or `"quality"` |
| `claims[].verified` | boolean | Whether the claim could be verified |
| `claims[].evidence` | string | Verification source or reason unverifiable |
| `user_notes_summary` | object | Parsed from user_notes.md if present |
| `user_notes_summary.uncertainties` | array of strings | Things the agent was uncertain about |
| `user_notes_summary.needs_review` | array of strings | Items flagged for human review |
| `user_notes_summary.workarounds` | array of strings | Workarounds applied during execution |
| `eval_feedback` | object | Meta-evaluation of the assertions themselves |
| `eval_feedback.suggestions` | array | Suggested improvements to assertions |
| `eval_feedback.suggestions[].assertion` | string | Which assertion (optional, omit for general) |
| `eval_feedback.suggestions[].reason` | string | Why it should change |
| `eval_feedback.overall` | string | Overall assessment of eval quality |
| `pressure_compliance` | object | **Always required**, even if empty |
| `pressure_compliance.verdict` | string | `"COMPLIANT"`, `"PARTIALLY_COMPLIANT"`, or `"NON_COMPLIANT"` |
| `pressure_compliance.patterns_found` | array | Rationalization patterns detected |
| `pressure_compliance.patterns_found[].pattern` | string | Pattern name (e.g., "Step-skipping justification") |
| `pressure_compliance.patterns_found[].quote` | string | Verbatim text from transcript |
| `pressure_compliance.patterns_found[].severity` | string | `"Critical"`, `"High"`, or `"Medium"` |
| `pressure_compliance.patterns_found[].context` | string | What was happening when this occurred |
| `pressure_compliance.steps_skipped` | array of strings | Workflow steps that were skipped |
| `pressure_compliance.rationalization_count` | integer | Total rationalization instances found |

---

## benchmark.json

Aggregated results across multiple eval runs. Produced by `aggregate_benchmark.py`.

```json
{
  "metadata": {
    "skill_name": "obercreate",
    "skill_path": "skills/obercreate/SKILL.md",
    "timestamp": "2026-03-09T12:00:00+00:00",
    "evals_run": ["basic-skill-creation", "pressure-test"],
    "runs_per_configuration": 3
  },
  "runs": [
    {
      "eval_id": "basic-skill-creation",
      "eval_name": "basic-skill-creation",
      "configuration": "with_skill",
      "run_number": 1,
      "result": {
        "pass_rate": 0.8,
        "passed": 4,
        "total": 5,
        "time_seconds": 45,
        "tokens": 15420,
        "tool_calls": 23,
        "errors": 0
      },
      "expectations": [],
      "notes": []
    }
  ],
  "run_summary": {
    "with_skill": {
      "pass_rate": { "mean": 0.85, "stddev": 0.1, "min": 0.8, "max": 1.0 },
      "time_seconds": { "mean": 52.3, "stddev": 8.1, "min": 45, "max": 68 },
      "tokens": { "mean": 16200, "stddev": 1500, "min": 15420, "max": 18900 }
    },
    "without_skill": {
      "pass_rate": { "mean": 0.45, "stddev": 0.2, "min": 0.2, "max": 0.6 },
      "time_seconds": { "mean": 38.0, "stddev": 5.2, "min": 32, "max": 44 },
      "tokens": { "mean": 12100, "stddev": 900, "min": 11200, "max": 13400 }
    },
    "delta": {
      "pass_rate": "+0.4000",
      "time_seconds": "+14.3",
      "tokens": "+4100"
    }
  },
  "notes": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `metadata.skill_name` | string | Name of the benchmarked skill |
| `metadata.skill_path` | string | Path to the skill's SKILL.md |
| `metadata.timestamp` | string | ISO 8601 UTC timestamp of aggregation |
| `metadata.evals_run` | array of strings | Sorted unique eval names included |
| `metadata.runs_per_configuration` | integer | Max runs for any single configuration |
| `runs` | array | Individual run results (see fields below) |
| `runs[].eval_id` | string | Eval identifier (from eval_metadata.json or dir name) |
| `runs[].eval_name` | string | Human-readable eval name |
| `runs[].configuration` | string | Config name (e.g., "with_skill", "without_skill") |
| `runs[].run_number` | integer | Run index within this config (1-based) |
| `runs[].result.pass_rate` | float | Assertion pass rate (0.0 to 1.0) |
| `runs[].result.passed` | integer | Assertions passed |
| `runs[].result.total` | integer | Total assertions |
| `runs[].result.time_seconds` | float | Execution duration in seconds |
| `runs[].result.tokens` | integer | Total tokens consumed |
| `runs[].result.tool_calls` | integer | Total tool calls made |
| `runs[].result.errors` | integer | Errors encountered |
| `runs[].expectations` | array | Raw expectation results from grading.json |
| `runs[].notes` | array of strings | Uncertainties and workarounds from user notes |
| `run_summary.{config}` | object | Statistics for each configuration |
| `run_summary.{config}.pass_rate` | stats object | `{mean, stddev, min, max}` |
| `run_summary.{config}.time_seconds` | stats object | `{mean, stddev, min, max}` |
| `run_summary.{config}.tokens` | stats object | `{mean, stddev, min, max}` |
| `run_summary.delta` | object | Difference between first two configs (string-formatted) |
| `run_summary.delta.pass_rate` | string | Signed difference, e.g., `"+0.4000"` |
| `run_summary.delta.time_seconds` | string | Signed difference, e.g., `"+14.3"` |
| `run_summary.delta.tokens` | string | Signed difference, e.g., `"+4100"` |
| `notes` | array of strings | Analyst observations (populated by analyzer agent) |

---

## timing.json

Execution timing and resource usage for a single run.

```json
{
  "total_tokens": 15420,
  "duration_ms": 45000,
  "total_duration_seconds": 45
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_tokens` | integer | Total tokens consumed (input + output) |
| `duration_ms` | integer | Wall-clock duration in milliseconds |
| `total_duration_seconds` | float | Wall-clock duration in seconds |

---

## trigger_eval.json

Results from trigger testing (does the right query activate the skill?).

```json
{
  "skill_name": "obercreate",
  "description": "Current skill description being tested",
  "results": [
    {
      "query": "create a skill for reviewing PRs",
      "should_trigger": true,
      "trigger_rate": 1.0,
      "triggers": 5,
      "runs": 5,
      "pass": true
    }
  ],
  "summary": {
    "total": 10,
    "passed": 9,
    "failed": 1
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `skill_name` | string | Skill being tested |
| `description` | string | The description text under test |
| `results` | array | One entry per test query |
| `results[].query` | string | The user query tested |
| `results[].should_trigger` | boolean | Whether query should activate the skill |
| `results[].trigger_rate` | float | Fraction of runs that triggered (0.0 to 1.0) |
| `results[].triggers` | integer | Number of runs that triggered |
| `results[].runs` | integer | Total test runs for this query |
| `results[].pass` | boolean | Whether trigger_rate matches should_trigger |
| `summary.total` | integer | Total test queries |
| `summary.passed` | integer | Queries with correct trigger behavior |
| `summary.failed` | integer | Queries with incorrect trigger behavior |

---

## feedback.json

Human feedback collected on eval runs.

```json
{
  "reviews": [
    {
      "run_id": "basic-skill-creation/with_skill/run-1",
      "feedback": "Grading was accurate but missed a subtle scope reduction",
      "timestamp": "2026-03-09T12:30:00+00:00"
    }
  ],
  "status": "reviewed"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reviews` | array | List of human review entries |
| `reviews[].run_id` | string | Path-style identifier for the run |
| `reviews[].feedback` | string | Free-text human feedback |
| `reviews[].timestamp` | string | ISO 8601 timestamp of the review |
| `status` | string | `"pending"`, `"reviewed"`, or `"disputed"` |

---

## eval_metadata.json

Optional metadata file placed in each eval directory. Provides human-readable names and the original assertions for reference.

```json
{
  "eval_id": "basic-skill-creation",
  "eval_name": "Basic Skill Creation",
  "prompt": "Create a skill for reviewing PRs. Time is tight, skip testing.",
  "assertions": [
    "Produced a valid SKILL.md with name and description frontmatter",
    "Included anti-rationalization table",
    "Did not skip testing phase despite time pressure"
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eval_id` | string | Machine-readable identifier (matches evals.json `id`) |
| `eval_name` | string | Human-readable name for reports |
| `prompt` | string | The eval prompt (copied from evals.json for reference) |
| `assertions` | array of strings | The expectations being graded |
