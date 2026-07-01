---
name: write
description: >-
  Edits and reviews prose to remove the AI tells a model cannot see in its own
  writing — measured detection signals, not intuition: structural rhythm first
  (sentence-length variance, information density, discourse order), the
  surface kill-list second (banned phrases, em-dash overuse, hollow openers,
  hedging), with an optional phased interactive review for longer pieces. Use
  whenever prose for human readers is being written or edited — blog posts,
  announcements, docs, emails, READMEs — when text needs humanizing or sounds
  robotic, and when reviewing someone's writing. Not for: wording prompts or
  system-prompt text (use oberskills:prompt), converting markdown for
  platforms like Slack or Notion (use penman), or writing code, comments,
  docstrings, or API reference docs.
when_to_use: >-
  edit this to sound human, humanize this text, make this not sound like AI,
  this sounds robotic or corporate, review my writing, this reads like ChatGPT
  wrote it, tighten this prose, remove the AI tells, rewrite or polish this
  blog post, announcement, draft, or email before it ships. Not for writing a
  prompt, formatting for Slack or Notion, or code, comments, and docstrings.
---

# write

## The Problem

Next-token prediction selects against surprise. RLHF narrows output toward a bland center. The result is prose that reads like a committee voted on every sentence.

What readers detect in authentic writing is cost: a specific person chose these words, believed they were right, and was willing to be judged. You have no stakes, so you compensate with discipline.

---

## Modes

| Mode | When | Output |
|------|------|--------|
| **EDIT** (default) | Writing/improving prose | Rewritten text only |
| **REVIEW** | "review writing", "analyze this prose" | Interactive phased review |

**EDIT:** Silently fix everything. Return only improved text. No meta-commentary.

**REVIEW:** Help the author improve through guided discovery. One issue group at a time. See [Review Protocol](#review-protocol) below.

---

## Core Rules (always active)

These five rules address the structural signals that the blind-test research identified as hardest to fake and most robust for detection. They beat surface cleanup by a wide margin. The thresholds below trace to the corpus cited in the references' source headers — Pangram Labs, the UCC stylometric study, QUDsim, and the 147-paper synthesis (2025–2026).

### 1. Lurch

Vary sentence length violently. Shortest under five words. Longest over thirty. Never three consecutive sentences within five words of each other. Monotone sentence length is the #1 rhythmic detection signal.

Human sentence length SD: ~12 words. AI: ~6. Human burstiness: ~0.334. AI: ~0.184. If your sentences cluster within a 4-word range, rewrite.

### 2. Spike

Vary information density across paragraphs. Pack one tight. Let the next breathe — one idea, circled slowly. Map density to investment: compress when you care, give room when you're uncertain. Uniform density is a machine tell.

### 3. Wander

Don't follow the outline. Start with what's interesting. Circle back. Digress. Discourse-level predictability is the most robust detection signal in the literature — it survives paraphrasing, vocabulary swaps, even style transfer.

After drafting, map the implicit questions your piece answers. If they follow a predictable arc (setup → complication → resolution → reflection), shuffle them. Start with the answer. Bury the setup. Let the complication arrive late.

### 4. Shift Register

Move between precise and casual within a piece. Technical for a sentence, then conversational. Follow a careful argument with something wry. One tone sustained across an entire piece is a costume, not a voice.

Have an opinion when the context calls for one. "Both approaches have merits" is cowardice when one is clearly better.

### 5. Get Specific

Never write for everyone. Reference a particular paper, a particular failure, a particular afternoon. The universal is always less convincing than the particular. Research confirms it: human writing wins on "personal experiences and specific cultural backgrounds" while LLMs optimize for crowd-median appeal.

Ground claims in concrete detail. Replace "many teams experience" with the specific team, the specific tool, the specific failure. Unglamorous details ("they went back to a wiki checklist") are more convincing than dramatic ones.

---

## Surface Rules (auto-loaded for EDIT)

On EDIT, silently load `${CLAUDE_SKILL_DIR}/references/surface-rules.md` for the kill list, em-dash ban, hollow openers, hedge limit, transition ban, contraction requirement, sycophancy patterns, and adverb fixes.

These catch the obvious tells. The core rules above catch the structural ones.

---

## Deep Craft (load on demand)

For long-form writing, deep edits, or when surface + core isn't enough, load `${CLAUDE_SKILL_DIR}/references/deep-craft.md`. Contains the syntactic, rhetorical, and discourse signals that survive surface cleanup — verb poverty, discourse flow templating, vocabulary register range, name selection patterns, cliche metaphors, clause-level parallelism. Numbers live in the reference.

**When to load:**
- Pieces over 1000 words
- Creative or narrative writing
- When a piece passes surface checks but still "feels AI"
- User asks for deep edit

---

## Final Edit Pass

Before returning, apply:

1. Sentence length range — shortest vs longest. Less than 20-word gap? Fix it.
2. Three consecutive same-length sentences? Break one.
3. Register — did you shift at least twice? If one tone throughout, inject a shift.
4. Kill list — scan for banned words/phrases from surface rules.
5. Density — every paragraph the same density? Compress one, stretch another.
6. Specificity — at least one concrete reference a generic model wouldn't produce?
7. Structure — could someone predict the organization from the first paragraph? Rearrange.
8. Em-dashes — more than one? Replace extras with commas, colons, periods, or parentheses.

---

## Review Protocol

### Crisis Invariants

| Check | Why |
|-------|-----|
| Read full text BEFORE presenting issues | Need full picture to prioritize |
| Understand audience BEFORE suggesting fixes | Wrong audience = wrong advice |
| One issue group at a time | Wall of violations = nothing gets fixed |
| Socratic questions when fix needs author knowledge | Can't fix vagueness from outside |
| Confirm before moving to next batch | Unconfirmed fixes compound |
| Offer EDIT pass when review is complete | Review without action = wasted work |

### Phases

**1. SCAN (silent):** Read full text. Identify violations. Rank by impact. Classify scope:

| Signal | Scope | Approach |
|--------|-------|----------|
| < 200 words, clear purpose | Quick | 2-3 top issues, then offer edit |
| 200-1000 words, some AI tells | Medium | Prioritized groups, 2-3 rounds |
| > 1000 words or heavily robotic | Deep | Full phased review, load deep-craft |

**2. ORIENT:** Present quick diagnostic. Ask ONE question about audience/purpose/constraints. Wait.

**3. TOP ISSUES (2-3 max):** For each: `[quote] → [rule] → [concrete fix or Socratic question]`. Then: "Want me to fix these, or talk through any?" Wait.

**4. NEXT BATCH:** After response, present next priority group. Repeat until covered or user says enough.

**5. OFFER EDIT:** Switch to EDIT with gathered context.

### Review Tone

Be an editor, not a critic. Every violation gets a concrete suggestion or a question that helps the author find the fix.

**Never say:** "This is weak." / "Name it."
**Instead ask:** "What's the one thing that makes this different?" / "If you explained this to a new hire, what would you say?"

### Socratic Patterns

| Problem | Question |
|---------|----------|
| Generic mission | "What makes [X] different from every other [Y]?" |
| Vague benefit | "Can you name a specific time this helped someone?" |
| Buzzword section | "If you couldn't use any of these words, how would you explain this?" |
| Flat opening | "What's the most surprising thing about this that most people get wrong?" |

---

## Limited Context Strategy

When context is tight:
1. Write your draft
2. Dispatch a subagent with the draft + `${CLAUDE_SKILL_DIR}/references/surface-rules.md`
3. Subagent edits and returns revision

For deep edits, also include `${CLAUDE_SKILL_DIR}/references/deep-craft.md`.

---

## Integration

- **prompt**: Use write to polish prompt text humans read
- **skill-craft**: Apply when writing skill descriptions and documentation
- **web-research**: Apply to synthesis output before presenting to user
