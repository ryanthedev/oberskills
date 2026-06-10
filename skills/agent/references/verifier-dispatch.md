# Verifier dispatch — debiased verification of subagent output

Canonical home of the plugin's verification-bias evidence. Other oberskills files state these rules qualitatively and point here; the numbers below live only in this file.

## Why verification is a separate dispatch

- Models catch fewer than 50% of their own errors when self-checking (PlanGenLLMs 2502.11221). The verifier must be a different entity from the generator: a fresh-context agent, a differently-framed prompt, or a deterministic checker.
- Verifier quality is the binding constraint on any generate-and-check pipeline: improving the verifier beats increasing the generation budget (TTS survey 2503.24235). Before adding retries or samples, ask whether the checker can actually distinguish good from bad.
- The plan–execution gap is real: agents scored 43.4% on code development but 21% on full replication because they could not verify their outputs actually ran (PaperBench 2504.01848). Executable checks close this gap; prose review does not.
- Fresh-context verifier subagents tend to outperform self-critique (Anthropic Fable 5 scaffolding guidance).
- Don't fix premature stopping with forced-continuation scaffolds: they help o-series models and hurt Claude (numbers in the prompt skill's porting reference). On Claude, require evidence per claim in the producer's OUTPUT contract and verify with a separate dispatch instead.

## Debiasing rules

1. **Deterministic checks run first.** Tests, typecheck, lint, and builds execute before any LLM judgment. Their raw results go into the verifier dispatch verbatim — the verifier interprets them, it does not re-run discovery.
2. **No intent framing.** Conclusion framing collapses defect detection by 16–93 percentage points; in the starkest case, detection fell from 97.2% to 3.6% under a "this code is bug-free" frame (confirmation bias, 2603.18740). The verifier dispatch therefore carries no plan context, no "this implements X", no progress narrative — only the artifact, the deterministic check results, and the acceptance criteria.
3. **Structure each finding** as `PREMISE / EVIDENCE / TRACE / VERDICT` — per-finding evidence tracing adds 10–12pp detection (2603.01896). FAIL only on demonstrated defects, never on suspicion.
4. **No always-on quality checklists.** Attaching rich quality criteria to every review made reviewers reject correct code — false-negative rate rose from 17.7% to 52.4% (overcorrection, 2603.00539). Load quality criteria only when the work under review warrants them.
5. **The verifier may be a weaker model.** Checking is easier than producing (prover-verifier games, 2407.13692). Downgrade one tier: opus producer → sonnet verifier, sonnet producer → haiku verifier for mechanical checks.
6. **Security-sensitive work gets 3 independent review dispatches** with a majority verdict — independence means separate dispatches, none seeing another's findings.
7. **Cap verify → revise at two rounds.** If the second revision still fails, escalate to the user with both verdicts rather than looping.

## Requirement tracing

Subagents silently drop requirements, and a reviewer then verifies against the degraded artifact instead of the source. Requirement-coverage failures of this kind account for 17.3% of multi-agent failures (MAST FM-3.2 + FM-3.3); mechanical cross-checking of structured requirement lists is the proven counter (ChatDev, +15.6%).

For implementation verification: number every requirement with an ID (R1, R2, …) when writing the producer's contract, then inject that same numbered list into the verifier dispatch with the instruction to mark each `SATISFIED / NOT_SATISFIED` with evidence. The verifier checks the artifact against the SOURCE requirements, never against the producer's summary of them.

## Verifier dispatch template

Copy and fill. Everything in brackets is yours to resolve before dispatch; add nothing else — especially no description of what the change was meant to do. The REPORTING text is the verbatim coverage block from `oberskills:prompt`'s snippets reference, entry #18.

```
You are verifying an artifact. You have no other context about it, by design.

ARTIFACT
  [absolute paths to the files / diff under review]

DETERMINISTIC CHECKS (already run — interpret, do not re-run)
  [paste raw test / typecheck / lint / build output verbatim]

ACCEPTANCE CRITERIA
  R1: [requirement]
  R2: [requirement]
  ...

REPORTING
  Report every issue you find, including ones you are uncertain about or
  consider low-severity. Do not filter for importance or confidence — a
  separate step does that. Include confidence and estimated severity per
  finding.

OUTPUT
  findings[]: { requirement_id?, premise, evidence (file:line or check
  output), trace, verdict, confidence, severity }
  requirements[]: { id, SATISFIED | NOT_SATISFIED, evidence }
  Overall: PASS only if no demonstrated defect; FAIL with the defects listed.
```

The same rules apply when verification runs in code instead of a dispatch — the plugin's eval server implements them in its grader pipeline; this file is the reference for any review dispatch you write by hand.
