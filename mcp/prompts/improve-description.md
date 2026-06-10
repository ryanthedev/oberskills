Improve this skill description for better trigger accuracy.

SKILL NAME: {{skill_name}}
CURRENT DESCRIPTION: {{current_description}}

CURRENT SCORES:
- Passed: {{passed}}/{{total}} on the training queries

FAILED TO TRIGGER (should have matched but didn't):
{{failed_triggers}}

FALSE POSITIVES (should NOT have matched but did):
{{false_positives}}

{{history_text}}

SKILL CONTENT (for reference):
{{skill_content}}

GUIDELINES:
- Maximum {{max_chars}} characters
- Write in third person, stating what the skill does and when to use it
- Generalize from failures — don't overfit to specific query wordings
- Include key differentiators that separate this skill from similar ones
- Mention core capabilities and domains the skill handles
- Only the description is being tuned; any when_to_use field is held constant
  and must not be restated inside the description

Return the improved description as the new_description field.
