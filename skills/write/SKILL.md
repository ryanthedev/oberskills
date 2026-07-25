---
name: write
description: >-
  Drafts, edits, and reviews prose to remove the AI tells a model cannot see in
  its own writing — measured detection signals, not intuition: structural rhythm
  first (sentence-length variance, information density, discourse order), a
  reader-job type router second (narrative, expository, persuasive, marketing,
  expressive, announcement), the surface kill-list third (banned phrases,
  em-dash overuse, hollow openers, hedging), with optional private voice
  profiles and a phased interactive review for longer pieces. Use whenever prose
  for human readers is written, drafted, edited, or reviewed — blog posts,
  announcements, docs, emails, READMEs — when text needs humanizing, sounds
  robotic, or must match a specific person's voice. Not for: wording prompts or
  system-prompt text (use oberskills:prompt), converting markdown for platforms
  like Slack or Notion (use penman), or writing code, comments, docstrings, or
  API reference docs.
when_to_use: >-
  edit this to sound human, humanize this text, make this not sound like AI,
  this sounds robotic or corporate, review my writing, this reads like ChatGPT
  wrote it, tighten this prose, remove the AI tells, write or polish this blog
  post, announcement, draft, or email, write this in my voice, make this sound
  like me, does this sound like me. Not for writing a prompt, formatting for
  Slack or Notion, or code, comments, and docstrings.
---

# write

## The Problem

Next-token prediction selects against surprise. RLHF narrows output toward a bland center. The result is prose that reads like a committee voted on every sentence.

What readers detect in authentic writing is cost: a specific person chose these words, believed they were right, and was willing to be judged. You have no stakes, so you compensate with discipline.

---

## Modes

| Mode | When | Output |
|------|------|--------|
| **EDIT** (default) | Drafting or improving prose | Rewritten text only |
| **REVIEW** | "review writing", "analyze this prose" | Interactive phased review |

**EDIT:** Editing supplied text, or drafting new text from a description. Silently fix everything. Return only improved text. No meta-commentary.

**REVIEW:** Help the author improve through guided discovery. One issue group at a time. See [Review Protocol](#review-protocol) below.

---

## Type — match the reader's job

Before editing or drafting, name what the reader is trying to *do* with the text: follow a story, understand why, decide what to believe, decide to act, meet a voice, learn what changed. That job — not the container it ships in (email, blog, doc) — sets the spine. Load `references/types.md` in this skill directory for the reader-job taxonomy: per-type craft rules, the characteristic AI failure for each, and the cross-type register-consistency check. Apply the matching row on top of the core rules below.

---

## Voice — match a specific person (optional)

When the ask is "write this in my voice" / "make this sound like me" / "does this sound like me", overlay a voice profile. Humanizing is table stakes; the voice is the point — a piece that's merely "human" but doesn't sound like the target person has failed.

Voice profiles are private and live outside this skill. Resolve one in order:

1. An explicit path or URL given in the request.
2. `$WRITE_VOICES_DIR/<name>.md` if that variable is set.
3. `~/.claude/writing-voices/<name>.md` — the default private dir. "my voice" / "me" resolves to the author's own profile there.

If none resolves, say so and offer to author one from `voices/_template.md` in this skill directory — don't invent a voice. Once resolved, load the profile and apply its register ladder and patterns *after* the core rules and surface pass.

### Drafting long-form (Claude-only)

For drafting long-form or voiced prose from scratch on Claude Code, consider routing the draft to a stronger model and running the EDIT pass locally. See `references/fable-drafting.md` in this skill directory (labeled Claude-specific; skip on other hosts).

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

On EDIT, silently load `references/surface-rules.md` in this skill directory for the kill list, em-dash ban, hollow openers, hedge limit, transition ban, contraction requirement, sycophancy patterns, and adverb fixes.

These catch the obvious tells. The core rules above catch the structural ones.

---

## Deep Craft (load on demand)

For long-form writing, deep edits, or when surface + core isn't enough, load `references/deep-craft.md` in this skill directory. Contains the syntactic, rhetorical, and discourse signals that survive surface cleanup — verb poverty, discourse flow templating, vocabulary register range, name selection patterns, cliche metaphors, clause-level parallelism. Numbers live in the reference.

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
9. Register — does any sentence belong to a different type than the one you chose? Pull it back (see `references/types.md` in this skill directory).

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
2. Dispatch a subagent with the draft + `references/surface-rules.md` in this skill directory
3. Subagent edits and returns revision

For deep edits, also include `references/deep-craft.md` in this skill directory.

---

## Integration

- **prompt**: Use write to polish prompt text humans read
- **skill-craft**: Apply when writing skill descriptions and documentation
- **web-research**: Apply to synthesis output before presenting to user
