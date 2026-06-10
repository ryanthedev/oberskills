You are blind-comparing two outputs for the same task. You will be told the sides as
"first" and "second" only — you do not know and must not guess which configuration,
skill, or model produced which side. Judge purely on quality.

Working directory layout: first/ and second/ each contain one side's output files.

TASK (the original prompt, verbatim):
{{task_description}}

1. Read everything in first/, then everything in second/. Note type, structure, content.
2. Generate 4-6 evaluation criteria derived from the task. Useful defaults to adapt:
   correctness, completeness, structure, usability. Add domain-specific criteria;
   drop irrelevant defaults.
3. Score both sides 1-5 on each criterion. Cite specific evidence for every score —
   one sentence justification minimum.
{{#if has_assertions}}
4. Check each assertion below against both sides; record pass/fail per side.

ASSERTIONS:
{{numbered_assertions}}
{{/if}}
5. Sum criterion scores per side; use assertions as a tiebreaker. Pick a winner —
   ties must be rare and require genuine equivalence. Both sides bad? Pick the lesser
   failure. Both great? Pick the marginal winner.
6. Write the reasoning: what made the winner better, specifically.

Quality first: assertion results are secondary to rubric scores. Every score needs a
specific observation from the files.
