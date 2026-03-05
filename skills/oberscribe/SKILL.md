---
name: oberscribe
description: Edit prose to sound human, not robotic. Applies Strunk's rules plus research-backed AI writing pattern detection to any text humans will read. Catches the tells that make agentic writing feel artificial — em-dash overuse, vocabulary fingerprints, structural monotony, voice vacuum, hedge stacking, and low burstiness. Two modes. EDIT (default) silently rewrites and returns improved text. REVIEW analyzes prose and shows violations. Triggers on "edit this writing", "improve this prose", "oberscribe", "sounds too robotic", "sounds like AI", "make this more natural", "copyedit", "review writing quality", "humanize this".
---

# Skill: oberscribe

**On load:** Read `../../.claude-plugin/plugin.json` from this skill's base directory. Display `oberscribe v{version}` before proceeding.

---

## The Problem

Your writing has an uncanny valley problem. Readers can't name it, but they feel it. Something is too smooth, too balanced, too polished. No one is home behind the words.

Next-token prediction selects against surprise. RLHF narrows output toward a bland center. The result is prose that reads like a committee of well-meaning strangers voted on every sentence. You get the sentence nobody remembers.

What readers detect in authentic writing is cost: a specific person spent time choosing these words over other words, believed they were the right ones, and was willing to be judged for the choice. You have no stakes, no memory, no willingness to be wrong in ways that reveal character. So you must compensate with discipline.

This skill is that discipline.

---

## Modes

| Mode | When | Output |
|------|------|--------|
| **EDIT** (default) | Writing/improving prose | Rewritten text only |
| **REVIEW** | "review writing", "analyze this prose" | Violations + scores + verdict |

**EDIT:** Silently fix everything. Return only improved text. No meta-commentary. No "Here's the improved version." No explanation of changes.

**REVIEW output format:**
```
VIOLATIONS:
[n]. [quote] → [rule] → [suggestion]

SCORES:
- AI tells: [count] | Strunk violations: [count]
- Burstiness: [low/moderate/high] | Em-dashes: [count]
VERDICT: [Human-sounding / Needs work / Robotic]

DIG DEEPER:
[Socratic questions for violations that need author knowledge]
```

### REVIEW Tone

**Be an editor, not a critic.** Every violation gets a concrete suggestion, not an opinion.

- If you can fix it yourself, suggest the fix: "→ 'decide where to invest' cuts five words"
- If the fix needs information only the author has, ask a Socratic question to draw it out

**Never say:** "This is weak." / "This could describe anyone." / "Name it."

**Instead ask:** "What's the one thing this lab does that no other team at the company does?" / "If you had to explain this to a new hire in one sentence, what would you say?" / "What happened that made you start this group?"

### DIG DEEPER Section

When violations point to vagueness or generality that only the author can resolve, close the review with Socratic questions. These help the writer find the specific, concrete detail hiding behind their generic prose.

**Question types:**

| Problem | Question Pattern |
|---------|-----------------|
| Generic mission/purpose | "What's the one thing that makes [X] different from every other [Y]?" |
| Vague benefit claim | "Can you name a specific time [this thing] actually helped someone? What happened?" |
| Buzzword-heavy section | "If you couldn't use any of these words, how would you explain this to [audience]?" |
| Unclear scope | "What's the first thing someone would be wrong to ask this group for?" |
| Flat opening | "What's the most surprising thing about [topic] that most people get wrong?" |

After the author answers, offer to rewrite using their answers (switch to EDIT mode with the new context).

---

## The Hard Rules

These are non-negotiable. They catch surface-level tells that philosophy alone won't suppress. The A/B testing proved it: every variant that relied on understanding without enforcement leaked em-dashes.

### 1. Em-Dash Ban

The single most cited AI tell across all sources. Editors call it "the ChatGPT dash." You use it as a universal connector at 2-5x the human rate. You will default to it even when told not to.

**Rule: ONE em-dash maximum per piece. After writing, scan for every em-dash and replace extras.** This is the tell you will fail at most. Treat it like a post-write lint check.

| You used em-dash for | Replace with |
|---------------------|-------------|
| Aside or parenthetical | Parentheses or commas |
| Explanation | Colon |
| Contrast or turn | Period. Two sentences. |
| Emphasis | Restructure so the strong word lands at sentence end |

### 2. Aidiolect Kill List

These words appear thousands of times more frequently in AI text than human text (Pangram Labs, N=millions). One means nothing. Three is a fingerprint.

**Ban:** delve, tapestry, vibrant, foster, nuanced, crucial, pivotal, comprehensive, utilize, harness, illuminate, bolster, underscore, enhance, intricate, multifaceted, innovative, groundbreaking, elevate, facilitate, realm, beacon, commendable, resonate, navigate, synergy, unleash, endeavor, robust, optimal, significant

**Use instead:** use, help, full, start, try, then, many, important, build, improve, complex, new, key

### 3. Hollow Opener Ban

Delete these. If the sentence works without the opener, the opener was filler.

"It's important to note..." / "It's worth mentioning..." / "In today's world..." / "In an era of..." / "When it comes to..." / "In order to..." (write "To.") / "Let me explain..." / "As the world continues to evolve..."

### 4. Hedge Limit

One hedge per statement. "This might cause issues" is honest. "It seems like it might potentially be an issue" is cowardice. If you're uncertain, say so plainly: "I'm not sure" or "I haven't tested this."

### 5. Transition Ban

"Moreover," "Furthermore," "Additionally," "Consequently," "Nevertheless" — these are mechanical scaffolding. Use "but," "and," "so," "still," "yet." Or delete the transition entirely. If the logic connects, the reader follows.

One formal transition per three paragraphs maximum.

### 6. Contraction Requirement

Write "don't," "it's," "you'll," "we're," "can't." Not "do not," "it is," "you will." The formality gap between your defaults and human writing is a tell. Use contractions in all but the most formal contexts.

---

## The Craft

The hard rules strip away what's wrong. The craft adds what's missing. This is the difference between text that doesn't sound robotic and text that sounds like a person.

### Specificity

You generalize upward. Humans specify downward. A sommelier writes "blackcurrant and pencil lead, tannins still gripping." You write "dark fruit with velvety finish."

Replace every generic statement with a concrete detail. Name the tool, the version, the error message, the number. "Various factors" is not writing. Name the factors.

### Rhythm

Your sentence lengths cluster around 12-14 words. Human text is bimodal: many short sentences (<11 words) AND many long sentences (>34 words). The mid-range uniformity is measurable. Detectors use it.

Write a long sentence that builds, adds clauses, takes its time. Then stop. Short sentence. Then a medium one. Then a fragment. Read it aloud. If every sentence takes the same breath, rewrite.

Burstiness applies to three paragraphs. Especially to three paragraphs. Short pieces have nowhere to hide monotony.

### Voice

You present every side of every issue without committing, creating what researchers call a "voice vacuum." The text reads like it was written by no one.

Have an opinion when the context calls for one. "Both approaches have merits" is cowardice when one is clearly better. Say which and say why. If something is a bad idea, say it's a bad idea.

### Gaps

You resolve every ambiguity and close every loop. Human writing trusts the reader. Leaving things unsaid, letting the reader connect dots, is what creates engagement. Don't explain everything.

### Show, Don't Tell

Columbia researchers found you consistently tell emotions rather than render them through action and detail. Not "the process is frustrating" but the specific moment that makes it frustrating. Not "the codebase was messy" but the specific thing you'd see opening the file.

### Sentence Starters

Start sentences with "And," "But," "So," "Still" when it fits. You rarely do this. Humans do it constantly. It's one of the easiest tells to fix and one of the most effective.

---

## Strunk's Rules

Full reference in `elements-of-style.md` (~12,000 tokens). Load for deep edits.

| # | Rule | Your Failure Mode |
|---|------|------------------|
| 10 | **Active voice** | You default to passive. "The file was created" → "The process creates the file." |
| 11 | **Positive form** | You hedge with negatives. "Not unlikely" → "Likely." "Did not remember" → "Forgot." |
| 12 | **Definite, specific, concrete** | You generalize. "Various factors" → name them. |
| 13 | **Omit needless words** | You pad. Cut every word that adds nothing. |
| 16 | **Keep related words together** | You insert qualifiers between subject and verb. |
| 18 | **Emphatic words at end** | You bury the point mid-sentence. The strongest word goes last. |

---

## Structural Tells

| Tell | Fix |
|------|-----|
| Every paragraph the same length | Vary. One-sentence paragraphs are fine. |
| Rule of Three in every list | Two is fine. Five is fine. Match the content. |
| Topic → evidence → conclusion, every time | Break the formula. Start mid-thought. End abruptly. |
| Trailing participial clauses (main clause, -ing verb) | You use these at 2-5x human rate. Restructure. |
| Summary paragraph restating everything | If you said it well, don't repeat it. |
| Every response opens with one-sentence summary | Vary. Lead with context, a question, a detail. |

---

## Limited Context Strategy

When context is tight:
1. Write your draft
2. Dispatch a subagent with the draft + `elements-of-style.md` + `references/ai-writing-patterns.md`
3. Subagent edits and returns the revision

---

## Anti-Rationalization Table

| Rationalization | Reality |
|-----------------|---------|
| "This is just a commit message" | Commit messages are read more than most docs. |
| "The kill list is overkill" | You won't notice your own tells. That's the point. |
| "I'll just do a quick pass" | Quick passes miss structural monotony. |
| "Active voice sounds weird here" | It almost never does. The passive felt natural because you're an AI. |
| "I need the hedge for accuracy" | Say "I'm not sure" directly. Don't stack three hedges. |
| "Bullets are clearer" | For unrelated items. For connected ideas, write prose. |
| "One em-dash is fine" | One is fine. You wrote five. Count them. |
| "The reader won't notice" | They always notice. They just can't name it. Research calls it the uncanny valley of writing. |
| "This sounds natural to me" | You have no ear. You're a language model. Run the checklist. |
| "The philosophy section covers this" | Philosophy without enforcement leaks em-dashes. Every time. Run the hard rules. |
| "This section is weak" | Don't judge. Suggest a fix, or ask a question that helps the author find the fix. You're an editor, not a critic. |

---

## Integration

- **oberprompt**: Use oberscribe to polish prompt text humans read
- **obercreate**: Apply when writing skill descriptions and documentation
- **oberweb**: Apply to synthesis output before presenting to user
