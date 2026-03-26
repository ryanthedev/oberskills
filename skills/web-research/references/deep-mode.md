# Deep Mode Extensions

Load this only for deep mode. Adds cross-pollination and verification steps.

---

## Step 3: Cross-Pollinate

After initial search completes, dispatch one agent to review all findings and fill gaps.

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
  5. Append findings to a new file

  OUTPUT FILE: {path}
  RETURN: FILE: {path}"
)
```

---

## Step 5: Verify

After synthesis returns, spot-check inline. Don't dispatch a separate agent.

```
1. WebFetch each cited URL — confirm it exists and contains what was claimed
2. Cross-check version numbers against local package.json / configs
3. Flag any URL that 404s or contradicts the claimed content
4. Report verification results to user
```

If a URL 404s and it was the sole source for a recommendation, remove that recommendation and note the gap.
