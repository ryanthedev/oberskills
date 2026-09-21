# Deep Mode Extensions

Load this only for deep mode. Adds cross-pollination and verification steps.

Templates are written as Claude Code `Agent(...)` calls. On another host, pass the same prompt text to its delegation tool and map `model` to the equivalent tier (tiers, effort targets, and Claude Code's tool names and wait mechanics: the web-research skill body).

---

## Step 3: Cross-Pollinate

**Gating dispatch, both directions.** Dispatch only after ALL search agents have completed and their files are checked as present and non-empty. Then wait for this agent's result, and check its output file the same way, before dispatching synthesis. Effort target: low to medium.

```
Agent(
  model="sonnet",
  description="web-research: fill gaps across dimensions",
  prompt="OBJECTIVE: Review all research files and identify gaps worth filling.

  RESEARCH FILES: {list paths}
  LOCAL CONTEXT: {grounding}

  TASK:
  1. Read all research files
  2. Identify: what did multiple dimensions reference but none explored?
  3. Identify: where do sources contradict each other?
  4. Run 1-2 targeted searches to resolve contradictions or fill the biggest gap
  5. Write findings to OUTPUT FILE, in the same per-source format as the
     files you read. If the write fails or is denied, return
     WRITE FAILED: {path} and the reason instead of a path.

  OUTPUT FILE: {path}
  RETURN: FILE: {path}"
)
```

---

## Step 5: Verify

After synthesis returns, verify in a separate agent that returns verdicts only. Fetching every cited page inline would land a deep report's worth of full pages in the orchestrator's context — the thing path-only returns exist to prevent — and a producer checking its own citations is the weaker check anyway (verifier dispatch rules: the `oberskills:agent` skill's verification section).

Hand the verifier claims and URLs, not the report: pull each cited URL with the specific claim it supports out of the synthesis, and pass only that list — no query framing, no recommendations. Wait for its verdicts before presenting the report. Effort target: low.

```
Agent(
  model="sonnet",
  description="web-research: verify cited sources",
  prompt="OBJECTIVE: Check whether each URL exists and says what is claimed.
  I will use your verdicts to correct or remove citations in a report.

  CLAIMS:
  1. {URL} — {specific claim attributed to it}
  ...

  TASK:
  For each item, fetch the URL with the host's web fetch tool and compare
  the page against the claim. Judge only what the page says; do not search
  for other sources and do not fix the claim.

  RETURN FORMAT (one line per item, nothing else — no page content):
  {n}. {URL} — CONFIRMED | CONTRADICTED | NOT FOUND ON PAGE | UNREACHABLE
       — {one sentence: the page's actual wording or the HTTP failure}"
)
```

Then, inline:

```
1. Cross-check version numbers against local package.json / configs
2. Correct or remove every claim whose verdict is not CONFIRMED
3. Report verification results to the user, verdict counts included
```

If a URL is UNREACHABLE or the claim is NOT FOUND ON PAGE and it was the sole source for a recommendation, remove that recommendation and note the gap.

No subagent surface on the host: verify inline, but only the sources a recommendation solely depends on, one at a time, keeping the verdict and discarding the page — not every cited URL.
