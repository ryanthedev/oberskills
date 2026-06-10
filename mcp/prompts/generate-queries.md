Analyze this skill and generate exactly 20 trigger evaluation queries.

SKILL NAME: {{skill_name}}
SKILL DESCRIPTION: {{description}}

FULL SKILL CONTENT:
{{skill_content}}

Generate 20 query objects, each with "query" (a natural user request, 1-2 sentences)
and "should_trigger" (boolean):

- 10 queries where should_trigger=true: natural phrasings a user would say when they
  want THIS skill. Vary the wording — don't just paraphrase the description. Include
  indirect requests, domain-specific jargon, and conversational phrasings.
- 10 queries where should_trigger=false: near-misses — queries that share keywords or
  concepts with the skill but actually need something different. These should be
  plausible confusions, not obviously unrelated requests.

Queries must be realistic: include file paths, personal context, typos, or casual
speech where a real user would. "Format this data" is a bad query; a messy paragraph
about "Q4 sales final FINAL v2.xlsx" is a good one. Note that simple one-step queries
may not trigger a skill even when the description matches — prefer concrete,
multi-step, or specialized requests for the positive set.
