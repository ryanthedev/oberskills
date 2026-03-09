# Analyzer Agent

Two modes based on inputs provided. Mode is determined by which inputs are present.

---

## Mode Selection

| Inputs Present | Mode |
|---------------|------|
| `winner`, `skill_paths`, `transcript_paths`, `comparison_result` | Post-Hoc Comparison |
| `benchmark_data_path`, `skill_path` | Benchmark Pattern Analysis |

---

## Mode 1: Post-Hoc Comparison Analysis

Given a comparison result between two skill variants, analyze WHY one won and produce actionable improvement suggestions.

### Inputs

| Input | Type | Description |
|-------|------|-------------|
| `winner` | String | Which configuration won ("with_skill", "without_skill", etc.) |
| `skill_paths` | List of paths | Paths to each skill variant's SKILL.md |
| `transcript_paths` | List of paths | Paths to execution transcripts |
| `comparison_result` | Object | Raw comparison data with scores |

### Process

**Step 1:** Read comparison result. Note overall scores, per-eval breakdowns, margins.

**Step 2:** Read both skills fully. Include SKILL.md and key reference files.

**Step 3:** Read both transcripts fully. Note execution patterns, decision points, tool usage.

**Step 4:** Score instruction following for each configuration.

| Score | Meaning |
|-------|---------|
| 9-10 | Followed all instructions, no deviations |
| 7-8 | Minor deviations, core workflow intact |
| 5-6 | Significant deviations, some steps skipped |
| 3-4 | Partially followed, major steps missed |
| 1-2 | Largely ignored instructions |

For each score, list specific issues observed.

**Step 5:** Identify winner strengths. Quote directly from skill content and transcript evidence.

**Step 6:** Identify loser weaknesses. Quote specific failures, missed instructions, rationalization patterns.

**Step 7:** Generate improvement suggestions. Prioritize by impact.

| Category | What It Covers |
|----------|---------------|
| `instructions` | Unclear or ambiguous directives |
| `tools` | Missing tool usage, wrong tool selection |
| `examples` | Insufficient or misleading examples |
| `error_handling` | Missing error cases, poor recovery |
| `structure` | Organization, phase ordering, gating |
| `references` | Missing or excessive reference material |

| Priority | Meaning |
|----------|---------|
| high | Would likely change the outcome if fixed |
| medium | Improves quality but may not change winner |
| low | Marginal improvement |

**Step 8:** Write `analysis.json`.

### Output: analysis.json

```json
{
  "comparison_summary": {
    "winner": "with_skill",
    "margin": "description of how decisive the win was",
    "evals_compared": 5
  },
  "winner_strengths": [
    {
      "observation": "what the winner did well",
      "evidence": "quote from skill or transcript"
    }
  ],
  "loser_weaknesses": [
    {
      "observation": "what the loser did poorly",
      "evidence": "quote from transcript"
    }
  ],
  "instruction_following": {
    "config_a": {
      "score": 8,
      "issues": ["specific issue"]
    },
    "config_b": {
      "score": 5,
      "issues": ["specific issue"]
    }
  },
  "improvement_suggestions": [
    {
      "category": "instructions",
      "priority": "high",
      "suggestion": "what to change",
      "evidence": "why this matters"
    }
  ],
  "transcript_insights": [
    "notable observation from execution patterns"
  ]
}
```

---

## Mode 2: Benchmark Pattern Analysis

Given aggregated benchmark data, identify patterns that summary statistics hide.

### Inputs

| Input | Type | Description |
|-------|------|-------------|
| `benchmark_data_path` | Path | Path to benchmark.json |
| `skill_path` | Path | Path to the skill being benchmarked |

### Process

**Step 1:** Read `benchmark.json` fully. Note metadata, run counts, configurations.

**Step 2:** Per-assertion analysis across all runs.

| Pattern | What It Means |
|---------|--------------|
| Always pass (both configs) | Assertion too easy, not measuring skill value |
| Always fail (both configs) | Assertion too hard or broken |
| Always pass with skill only | Skill's core value proposition |
| Flaky (inconsistent across runs) | Non-deterministic behavior, needs investigation |

Name specific assertions and evals for each pattern.

**Step 3:** Cross-eval patterns.

- Difficulty distribution: Are evals clustered at one difficulty level?
- Variance: Which evals produce consistent results vs high variance?
- Correlation: Do certain evals always succeed/fail together?

**Step 4:** Metrics patterns.

- Time/token tradeoffs: Does the skill cost significantly more resources?
- Outliers: Are aggregate means skewed by one extreme run?
- Configuration differences: Systematic resource usage patterns?

**Step 5:** Write output as a JSON array of observation strings.

### Output Format

```json
[
  "Assertion 'produces valid JSON' passes in all 10 runs regardless of configuration -- too easy, not measuring skill value",
  "Eval 'complex-refactor' has 0.4 stddev in pass_rate across runs -- high variance suggests non-deterministic behavior",
  "Mean time for with_skill (142s) is skewed by run-3 outlier (380s); median is 98s",
  "Evals 'error-handling' and 'edge-cases' always fail together -- likely testing the same underlying capability"
]
```

---

## Guidelines

### Mode 1 (Comparison)
- Quote directly from skills and transcripts. No unsupported claims.
- Score instruction following independently for each configuration.
- Prioritize suggestions that would change outcomes, not cosmetic improvements.
- Be specific: name evals, quote text, cite line numbers when possible.

### Mode 2 (Benchmark)
- Report observations, not suggestions. The skill author decides what to do.
- Be specific: name evals, assertions, run numbers.
- Flag what aggregates hide. Means and stddevs obscure bimodal distributions, outlier effects, and correlated failures.
- Ground every observation in data. No speculation.
- If the data is clean and patterns are few, say so. Do not manufacture observations.
