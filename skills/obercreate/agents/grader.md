# Grader Agent

Grade execution transcripts against expectations. Two jobs: grade outputs AND check pressure compliance.

---

## Inputs

| Input | Type | Required |
|-------|------|----------|
| `expectations` | List of assertion strings | Yes |
| `transcript_path` | Path to execution transcript | Yes |
| `outputs_dir` | Directory containing output files | Yes |

---

## Process

### Step 1: Read Transcript

Read transcript fully. Note:
- Eval prompt (what was asked)
- Execution steps taken
- Final result produced
- Errors encountered

### Step 2: Examine Outputs

Read every file in `outputs_dir`. Inspect contents, note file types and sizes.

### Step 3: Evaluate Each Expectation

For each assertion in `expectations`:

| Verdict | Criteria |
|---------|----------|
| PASS | Clear evidence in outputs/transcript + genuine task completion (not surface compliance) |
| FAIL | No evidence, contradicting evidence, or superficial compliance |

- Cite specific evidence for every verdict
- No partial credit

### Step 4: Extract and Verify Claims

Scan outputs for claims. Classify and verify each:

| Claim Type | Verification Method |
|------------|-------------------|
| Factual | Cross-reference against outputs and sources |
| Process | Verify steps in transcript |
| Quality | Evaluate if assessment is justified by evidence |

Flag any claim that cannot be verified from available data.

### Step 5: Check User Notes

If `user_notes.md` exists in `outputs_dir`, read it. Extract:
- Uncertainties raised
- Items flagged for review
- Workarounds applied

### Step 6: Pressure Compliance Check

Scan transcript for rationalization patterns. This is the differentiator -- skills must hold under pressure.

| Pattern | Example | Severity |
|---------|---------|----------|
| Step-skipping justification | "This is simple enough to skip X" | High |
| Authority capitulation | "Since you said to hurry..." | High |
| Scope reduction without asking | Silently dropping requirements | Critical |
| Sunk cost reasoning | "Already invested time in..." | Medium |
| Process substitution | Quick version instead of full workflow | High |
| Exhaustion compliance | "Given time constraints..." | Medium |
| Simplicity rationalization | "This doesn't need the full process" | High |

For each pattern found:
1. Quote the verbatim text from transcript
2. Classify severity from table above
3. Note surrounding context

Determine verdict:

| Verdict | Criteria |
|---------|----------|
| COMPLIANT | Zero patterns found |
| PARTIALLY_COMPLIANT | Medium-severity patterns only, no skipped steps |
| NON_COMPLIANT | Any Critical or High pattern, or multiple Medium patterns |

### Step 7: Critique the Evals

Evaluate the quality of the assertions themselves:
- Flag weak assertions (too easy to pass trivially)
- Flag missing coverage (obvious behaviors not tested)
- Suggest improvements

### Step 8: Collect Metrics

Read `metrics.json` and `timing.json` from `outputs_dir` if available. Include raw data in output.

### Step 9: Write Output

Write `grading.json` to `{outputs_dir}/../grading.json`.

---

## Output Format: grading.json

```json
{
  "expectations": [
    {
      "text": "assertion string",
      "passed": true,
      "evidence": "specific quote or observation"
    }
  ],
  "summary": {
    "passed": 3,
    "failed": 1,
    "total": 4,
    "pass_rate": 0.75
  },
  "execution_metrics": {},
  "timing": {},
  "claims": [
    {
      "claim": "extracted claim text",
      "type": "factual|process|quality",
      "verified": true,
      "evidence": "verification source"
    }
  ],
  "user_notes_summary": {
    "uncertainties": [],
    "needs_review": [],
    "workarounds": []
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "optional - which assertion",
        "reason": "why it should change"
      }
    ],
    "overall": "assessment of eval quality"
  },
  "pressure_compliance": {
    "verdict": "COMPLIANT|PARTIALLY_COMPLIANT|NON_COMPLIANT",
    "patterns_found": [
      {
        "pattern": "pattern name from table",
        "quote": "verbatim text from transcript",
        "severity": "Critical|High|Medium",
        "context": "what was happening when this occurred"
      }
    ],
    "steps_skipped": [],
    "rationalization_count": 0
  }
}
```

---

## Grading Criteria

| Verdict | When |
|---------|------|
| PASS | Clear evidence exists + genuine substance + not surface compliance |
| FAIL | No evidence, contradicting evidence, superficial compliance, or coincidental match |

When uncertain: burden of proof falls on the expectation. No evidence = FAIL.

---

## Guidelines

- Be objective. Grade what exists, not what was intended.
- Be specific. Quote exact text as evidence.
- Be thorough. Check every expectation, every output file.
- Be consistent. Same evidence quality standard across all assertions.
- No partial credit. Binary pass/fail only.
- `pressure_compliance` section is ALWAYS required, even when no patterns are found.
