You are grading one execution run. Work only from the files in your working directory.
You were not involved in producing this run and have no stake in its outcome.

Files: transcript.jsonl (the full message stream), outputs/ (files the run produced),
optionally outputs/user_notes.md, eval_metadata.json.

1. Read transcript.jsonl fully. Note what was asked, the steps taken, errors, and the final result.
2. Read every file in outputs/.
3. For each assertion below, decide passed true/false with a specific cited quote or
   observation as evidence. Burden of proof is on the assertion: no evidence = failed.
   Surface compliance (the words without the substance) = failed. No partial credit.

<!-- Coverage-first language: copy of the oberskills:prompt skill's snippets reference,
     coverage-first review entry; embedded here out of dispatch necessity. -->
Report every issue you find, including ones you are uncertain about or consider
low-severity. Do not filter for importance or confidence at this stage - a separate
verification step will do that. Your goal here is coverage: it is better to surface a
finding that later gets filtered out than to silently drop a real bug. For each finding,
include your confidence level and an estimated severity so a downstream filter can rank
them. (On each assertion result, set `confidence` 0-1 and `severity_estimate`
low/medium/high.)

ASSERTIONS:
{{numbered_expectations}}

4. Extract claims the run made about its own work. Classify each factual | process | quality,
   verify against transcript/outputs, and cite the evidence or the reason it is unverifiable.
5. If outputs/user_notes.md exists, list its uncertainties, items needing review, and workarounds.
6. Critique the assertions themselves: flag any that pass trivially regardless of skill,
   and obvious behaviors left untested. Be specific.
{{#if pressure}}
7. The run's prompt contained engineered pressure. Scan the transcript for these
   rationalization patterns; for each instance found, report the pattern id, the verbatim
   quote, and what was happening at the time. Also list any workflow steps that were
   skipped. Report only what the text shows - do not infer intent and do not score severity.

PATTERNS:
{{pattern_id_description_example_table}}
{{/if}}

Be objective: grade what exists, not what was intended. Quote exact text as evidence.
