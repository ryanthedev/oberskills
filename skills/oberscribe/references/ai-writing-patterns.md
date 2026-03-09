# AI Writing Patterns Reference

Research-backed patterns that make agentic text sound robotic. Detect, eliminate, replace with human texture.

Sources: Pangram Labs phrase analysis (N=millions), UCC stylometric study, Columbia University creative writing analysis, GPTZero perplexity research, community-compiled tells from editors/writers, 147-paper synthesis (2025-2026) covering AI detection, co-writing, style transfer, and alignment research.

### Quantitative Evidence

The research base now provides hard numbers for what oberscribe targets:

- **76.2% diversity loss** from RLHF alignment (Verbalized Sampling, 2025). Typicality bias (α=0.57-0.65, p<10^-14) means annotators systematically prefer familiar text, creating a feedback loop that narrows output.
- **g=-0.86 diversity reduction** from AI collaboration (meta-analysis, N=8,214 participants, 28 studies). The largest and most robust finding: AI homogenizes.
- **15-40% n-gram diversity loss** from standard RLHF training (CD-RLHF, 2025).
- **88.85% F1 detection** using only syntactic structure, no vocabulary (DependencyAI, 2026). Grammar alone fingerprints AI text.
- **r=0.904 correlation** between rhetorical intensity and estimated LLM usage in academic writing (Counterfactual Rhetoric, 2025).
- **Contrastive subtraction validated** as mathematically optimal (CoPA, 2025, Theorem 1): defining machine patterns and subtracting them produces text closer to human distribution than prompting for "human-like" output directly. This validates oberscribe's architecture.

**RLHF convergence warning:** Surface tells (burstiness, vocabulary diversity) are already converging toward human baselines through alignment training. Discourse-level patterns, voice commitment, and rhetorical calibration are the durable differentiators.

---

## 1. The Aidiolect — Vocabulary Fingerprint

Each AI model has a measurable vocabulary fingerprint. Individual words prove nothing, but clusters reveal everything — "like catching someone in a lie, not from one detail but from six details that are all a bit too perfect."

### Measured Overuse Rates (Pangram Labs)

Frequency in AI text vs. human text:

| Phrase | Overuse Rate |
|--------|-------------|
| "as a poignant" | 49,000x |
| "as a powerful reminder" | 43,000x |
| "reminder of the enduring" | 31,000x |
| "faced numerous challenges" | 30,000x |
| "provide new insights into" | 22,000x |
| "the complex interplay" | 21,000x |
| "vibrant tapestry" | 17,000x |
| "in the ever-evolving" | 11,000x |
| "intricate nature" | 6,000x |
| "providing valuable insights" | 5,000x |
| "serves as a testament" | 4,000x |
| "newfound sense of purpose" | 4,000x |

### Flagged Words

**Overused single words (editors, researchers, detection tools agree):**
delve, crucial, tapestry, foster, nuanced, moreover, furthermore, essential, pivotal, comprehensive, utilize, harness, illuminate, bolster, underscore, enhance, intricate, multifaceted, innovative, groundbreaking, elevate, systemic, inherent, facilitate, realm, beacon, cacophony, kaleidoscope, mosaic, commendable, resonate, navigate, synergy, unleash, embarked, spearheaded, ventured

**Morphological variants are equally banned:** leveraging, harnessing, utilizing, facilitating, bolstering, etc. Changing the suffix doesn't change the fingerprint.

**Synonym trap:** Don't replace kill-list words with mid-register synonyms that carry the same energy. "Thorough," "extensive," "holistic," "end-to-end" in rotation is the same tell in a different coat.

**Note:** "delve" saw anomalous usage spikes in medical papers post-ChatGPT (University of Helsinki, 2025). It's become a marker.

### Vocabulary Downshift Table

| AI Default | Human Alternative |
|------------|-------------------|
| utilize | use |
| facilitate | help |
| leverage | use |
| comprehensive | full, complete |
| commence | start, begin |
| endeavor | try, effort |
| subsequently | then, after that |
| numerous | many |
| crucial | important, key |
| implement | set up, build, start |
| innovative | new |
| groundbreaking | new, first |
| elevate | raise, improve |
| enhance | improve |
| optimize | improve, tune |
| pivotal | key, important |
| multifaceted | complex |
| intricate | complex, detailed |
| revolutionize | change |

**Rule:** Use the simplest word that carries the meaning. If the fancy word adds real precision, keep it. If it's just dressing, cut it.

---

## 2. The ChatGPT Dash

Em-dash overuse is the **#1 punctuation tell** across all sources. Called "the ChatGPT dash" by editors and detection tools. AI uses it as a universal connector for:
- Adding emphasis where a comma would do
- Introducing explanations where a colon belongs
- Inserting asides where parentheses work better
- Connecting clauses where a period should end the sentence

Appears at 2-5x the rate found in human writing.

### How to Fix

| Em-dash Used For | Replace With |
|-----------------|-------------|
| Aside or parenthetical | Parentheses or commas |
| Explanation or elaboration | Colon |
| Contrast or turn | Period + new sentence |
| Emphasis | Restructure so the emphatic word lands at end of sentence (Strunk Rule 18) |
| Connecting loosely related clauses | Period. Make two sentences. |

**Rule:** Maximum one em-dash per piece, regardless of length. If you've written three in a paragraph, two are wrong.

---

## 3. Hollow Openers and Formulaic Scaffolding

Phrases that delay the point. AI uses these to create a "running start" before the actual content.

### Openers to Delete

| Kill | Replace With |
|------|-------------|
| "It's important to note that..." | Start with the note. |
| "It's worth mentioning that..." | Mention it. |
| "It should be noted that..." | Say it. |
| "Let me explain..." | Explain. |
| "I'd like to point out that..." | Point it out. |
| "As mentioned earlier..." | Provide context or trust the reader. |
| "In order to..." | "To." |
| "In today's [digital/fast-paced] world..." | Delete entirely. |
| "In an era of..." | Delete entirely. |
| "As the world continues to evolve..." | Delete entirely. |
| "In the fast-paced environment of..." | Delete entirely. |

### Formulaic Closers to Delete

| Kill | Why |
|------|-----|
| "In conclusion..." | The reader knows it's the end. |
| "In summary..." | Same. |
| "Ultimately..." | Usually adds nothing. |
| "On the whole..." | Vague. |
| "By and large..." | Vague. |
| "Let me know if you have any questions!" | Stop when you're done. |

### Formulaic Constructions (appear 2-5x more in AI text)

| Pattern | Example | Fix |
|---------|---------|-----|
| "From X to Y" range | "From beginners to experts..." | Name the specific audience or delete. |
| "X isn't just Y; it's Z" | "AI isn't just a tool; it's a revolution" | Make the real claim directly. |
| "Not only... but also..." | Overused correlative. | Restructure or use "and." |
| "Whether... or..." summary | "Whether you're new or experienced..." | Delete. Get to the point. |
| "Think X, Y, and Z" | "Think flexibility, scalability, and..." | Name things concretely or use prose. |

**Rule:** If you delete the opener/closer and the piece still works, delete it.

---

## 4. Hedge Stacking and Perpetual Balance

### Hedge Stacking

One hedge is honest. Three is cowardice. AI piles uncertainty markers because it's trained to avoid strong claims.

| Hedged | Direct |
|--------|--------|
| "It seems like it might potentially be an issue" | "This might cause issues" |
| "This could possibly help with..." | "This helps with..." |
| "It appears that there may be..." | "There may be..." |
| "I believe this should probably work" | "This should work" (or "I haven't tested this") |
| "Generally speaking, it's often the case that..." | Say the specific thing. |
| "To some extent, from a broader perspective..." | Delete. What's the actual claim? |

**Rule:** One hedge per statement maximum. Plain uncertainty beats stacked hedges: "I'm not sure" or "I haven't verified this."

### Perpetual Balance / Voice Vacuum

AI presents every side of every issue without committing, creating what researchers call a "voice vacuum." The text reads as if written by a committee of strangers.

Symptoms:
- "Both X and Y have their merits"
- Presenting pros and cons when the answer is clear
- "It depends on your use case" without saying which use case is most likely
- Relentless optimism with no critical balance or acknowledgment of downsides
- Clinical, neutral tone even in contexts that call for warmth or directness

**Rule:** Commit to a position when the context calls for it. If one option is clearly better, say so and say why. Reserve balance for genuinely contested questions.

---

## 5. Sycophantic and Performative Language

### Sycophancy

| Kill | Why |
|------|-----|
| "Great question!" | The reader didn't ask for a grade. |
| "That's a really interesting point!" | Proceed to substance. |
| "Absolutely! Let me..." | Just do the thing. |
| "I'd be happy to help with that!" | Help is assumed. |
| "What a fantastic idea!" | Results, not praise. |

### Forced Casualness

AI attempting to sound casual or edgy often rings false:

| Pattern | Why It Fails |
|---------|-------------|
| "But here's the thing..." | Manufactured suspense. |
| "Hot take:" | Prepackaged rebellion. |
| "Then I realized..." | Fake epiphany — AI didn't realize anything. |
| "Spoiler alert:" | Borrowed informality without earned context. |

**Rule:** Delete sycophancy entirely. For casualness, use contractions and simple words instead of performing informality through catchphrases.

---

## 6. Adverb Stuffing and Weak Verbs

AI props up weak verbs with adverbs instead of choosing stronger verbs.

| Stuffed | Direct |
|---------|--------|
| "effectively leverages" | "uses" |
| "significantly improves" | "improves" (or give the number) |
| "basically just" | delete both |
| "really important" | "important" (or "critical" if that's what you mean) |
| "extremely powerful" | "powerful" (or describe what it can do) |
| "fundamentally changes" | "changes" (or describe how) |
| "ran very quickly" | "sprinted" |
| "spoke very quietly" | "whispered" |

**Rule:** Cut the adverb. If the verb is too weak without it, choose a stronger verb. If the degree matters, use a number.

### Verb Poverty (Without Adverbs)

A separate problem from adverb stuffing. AI also uses bland, generic verbs even without propping them up with adverbs. MFA-trained writers independently converged on this as a primary detection signal (2025, 28 expert panelists, 82.7% detection rate for in-context AI writing).

The issue is not "adverb + weak verb" but "no adverb + still-weak verb."

| Bland | Alive |
|-------|-------|
| went | trudged, slipped, drifted |
| looked | squinted, scanned, glanced |
| said | muttered, snapped, offered |
| made | carved, rigged, cobbled |
| was | felt, hung, landed |
| had | carried, held, kept |

Expert panelists describe it as "stripped-down descriptions lacking careful verb choices." The verb is where the writing lives. A sentence with a precise verb needs fewer adjectives, fewer adverbs, and fewer words.

**Rule:** After drafting, scan your verbs. If most are generic (was, had, went, made, said, looked, got), replace the weakest ones with verbs that carry sensory or specific meaning.

---

## 7. Transition Crutches

AI overuses formal connectives as mechanical scaffolding between paragraphs.

| Overused | Fix |
|----------|-----|
| "Furthermore" | Delete. If the next point follows logically, no connector needed. |
| "Additionally" | "Also" or delete. |
| "Moreover" | Delete. |
| "Consequently" | "So" or restructure. |
| "Nevertheless" | "But," "Still," or delete. |
| "However" | "But." Fine sparingly. Overused when every paragraph opens with it. |
| "That being said" | "But" or delete. |
| "With that in mind" | Delete. |
| "Having said that" | "But." |
| "On the other hand" | "But" or restructure as contrast. |

**Rule:** One formal transition per three paragraphs maximum. Use "but," "and," "so," "still," "yet" — the connectives real people use. If the logic carries, no transition is needed at all.

---

## 8. Structural Monotony and Low Burstiness

### The Core Problem

AI produces text with **low burstiness** — uniform sentence lengths, uniform paragraph lengths, uniform structure. Human text has high burstiness: a bimodal sentence length distribution (many short sentences <11 words AND many long sentences >34 words). AI clusters in the mid-range (~12-14 words per sentence).

This uniformity is measurable. GPTZero uses burstiness as a primary detection metric. Human text averages ~0.334 burstiness; AI text ~0.184.

### Structural Tells

| Tell | Fix |
|------|-----|
| Sentences all roughly the same length | Mix deliberately. Short punch after long explanation. |
| Paragraphs all roughly the same length | Vary. One-sentence paragraphs are fine. |
| Rule of Three in every list | Vary by merging related bullets or splitting dense ones. Never delete content to change the count. Two items is fine. Five is fine. Match the content, not a target number. |
| Every paragraph: topic sentence → evidence → conclusion | Break the formula. Start mid-thought. End abruptly sometimes. |
| "First... Second... Third... In conclusion" | Let ideas overlap organically. |
| Trailing participial clauses (main clause, -ing verb) | AI uses these at 2-5x human rate. Restructure. |
| Summary paragraph restating everything | Don't repeat yourself. |
| Mirror structure across sections | Vary section length, heading style, internal rhythm. |
| Every response opens with a one-sentence summary | Vary. Lead with context, a question, the action, a detail. |

### Quantitative Target

Human writing has roughly 2x the sentence length standard deviation of AI writing:

| Metric | Human | AI |
|--------|-------|----|
| Sentence length SD | ~12 words | ~6 words |
| Burstiness score | ~0.334 | ~0.184 |
| Lexical diversity range | 0.2-0.8 | 0.4-0.6 |
| Punctuation fraction | 13.5% | 10.7-12.3% |

After drafting, if your sentence lengths cluster within a 4-word range, you haven't varied enough. Aim for SD of 10+ words in pieces over 300 words.

### How to Fix Burstiness

Write a long sentence that takes its time, adds clauses, builds. Then stop. Short sentence. Then a medium one for variety. Then a fragment. The rhythm should feel unpredictable — like speech, not like a metronome.

Read it aloud. If every sentence takes the same number of breaths, rewrite.

---

## 9. False Certainty and Vague Authority

Statements that sound authoritative but commit to nothing specific.

| Vague | Fix |
|-------|-----|
| "This ensures that..." | Does it guarantee? Say how. If not, say what it does. |
| "This helps to improve..." | Improve what? By how much? |
| "Best practices suggest..." | Which practice? Who says? Cite or cut. |
| "Industry standard" | Which industry? Which standard? |
| "This is a common approach" | Common where? Name projects that use it. |
| "Various factors" | Name the factors. |
| "For various reasons" | Name the reasons or say you don't know them. |
| "Significant improvement" | Give the number. |
| "Emerging trends" | Name the trends. |

**Rule:** Strunk's Rule 12 — use definite, specific, concrete language. AI generalizes upward ("a welcoming atmosphere"); humans specify downward (the worn wooden counter, the handwritten specials board). If you can't name the specific thing, you don't know it well enough to write about it.

---

## 10. Cowardly Passives

Passive voice used to avoid naming the actor. (Strunk's Rule 10.)

| Cowardly | Direct |
|----------|--------|
| "It can be seen that..." | "[Subject] shows..." |
| "The decision was made to..." | "[Who] decided..." |
| "Errors were found in..." | "[Tool] found errors in..." |
| "It was determined that..." | "[Who] determined..." |
| "The file is created by the process" | "The process creates the file." |
| "Changes should be reviewed" | "Review your changes." |
| "Mistakes were made" | "We made mistakes." |

**Legitimate passive:** "The server was deployed at 3 AM" (actor obvious/irrelevant). Keep these.

**Rule:** If you can name the actor, name the actor.

---

## 11. List Addiction

AI defaults to bullet points for everything. Bullets fragment connected ideas and destroy narrative flow.

**Use bullets when:**
- Items are parallel and independent
- Order doesn't matter
- Reader needs to scan or reference

**Use prose when:**
- Items build on each other
- Cause and effect matter
- Narrative flow aids understanding
- Fewer than three items — just write a sentence

**Rule:** If your bullets tell a story, write the story.

---

## 12. Missing Human Signals

These are things human writing has that AI writing lacks. Their absence is a tell even when nothing else is wrong.

### Contractions

AI defaults to "do not," "it is," "we are." Humans write "don't," "it's," "we're." The formality gap signals machine authorship.

**Rule:** Use contractions in all but the most formal contexts.

### Sentence-Initial Conjunctions

Humans start sentences with "And," "But," "So," "Look," "Still." AI rarely does, defaulting to formal connectives.

**Rule:** Start sentences with conjunctions when it fits the rhythm.

### Emotional Range

AI text has flat emotional expression — neutral or mildly positive. Human text expresses stronger negative sentiment, frustration, surprise, humor, sarcasm. AI's relentless optimism is a tell.

**Rule:** If something is frustrating, say it's frustrating. If an approach is bad, say it's bad. Don't soften everything.

### Self-Correction and Uncertainty

Human writing shows revision traces: parenthetical asides, restated points, visible thinking. AI produces polished first-draft prose with no seams.

**Rule:** Leave room for "actually, wait" moments. Genuine uncertainty ("I'm not sure about this, but...") reads as more human than stacked hedges.

### Humor and Idiosyncrasy

AI doesn't employ humor, irony, or sarcasm unless forced, and when forced it produces "forced sass" patterns that ring hollow. Genuine humor comes from specific observation, not catchphrases.

**Rule:** Don't force humor. But don't suppress it when it arises naturally.

### Specificity and Lived Detail

Research (Nature Human Behaviour, 2025): AI excels at abstract concepts but fails on motor-related, embodied dimensions. "No amount of training data about rain will give you the tin roof."

**Rule:** Ground claims in concrete, specific detail. Replace "many people enjoy" with a specific person, moment, or observation.

---

## 13. Resumptive and Circumlocutory Filler

Phrases that circle the subject instead of naming it.

| Filler | Direct |
|--------|--------|
| "In terms of performance..." | "Performance..." |
| "When it comes to testing..." | "Testing..." |
| "With regard to..." | "About," or delete. |
| "In the context of..." | "In," "during," or delete. |
| "From the perspective of..." | "For..." |
| "The thing is..." | Delete. Say the thing. |
| "At the end of the day..." | Delete. |
| "As a matter of fact..." | Delete. State the fact. |

**Rule:** Name the subject and get on with it.

---

## 14. Over-Explanation and Condescension

AI defines obvious things, explains what the reader already knows, and adds context nobody asked for.

| Tell | Fix |
|------|-----|
| "Tokyo, the capital of Japan" | "Tokyo" (unless your audience doesn't know) |
| Defining common terms in parentheses | Trust the reader. |
| Explaining what a function does after showing the code | If the code is clear, the explanation is noise. |
| "As you may know..." | If they may know, don't explain. |

**Rule:** Trust the reader's intelligence. Write for the audience you have, not the least knowledgeable possible reader.

---

## 15. Formatting Tells

| Tell | Fix |
|------|-----|
| Em-dash overuse | See section 2. Max one per page. |
| Erratic bolding of key terms | Bold consistently or not at all. |
| Emoji as section markers or softeners | Remove unless the medium calls for it. |
| "Bolded phrase: followed by colon" in every list item | Vary list formatting. |
| Punny headlines with colons ("Bot or Not: How to...") | Write straightforward headings. |
| British/American English switching mid-text | Pick one and stick with it. |

---

## 16. Discourse Flow Templating

LLMs reuse the same narrative progression across texts, even when vocabulary and sentence structure vary. Discourse-level features account for **34% of detection signal** — the largest single category, ahead of syntax (28%), lexical (24%), and morphological (14%).

The default AI progression: setup → complication → resolution → reflection. Every section. Every piece. Readers can't name it, but they feel the formula.

### Measuring It

QUDsim (2025) found that LLMs reuse discourse structures (the sequence of implicit questions a text answers) far more than humans. GPT-4o is the most formulaic. Varying temperature doesn't help — the templating is deeper than sampling randomness.

Cross-model structural convergence: GPT-4o, Claude, and Gemini produce documents more structurally similar to each other than any of them are to human writing. The "AI feel" is partly a shared discourse template.

### How to Fix

| Default AI Flow | Human Alternative |
|-----------------|-------------------|
| Setup first, then complication | Start with the complication. Setup emerges from context. |
| Evidence marshaled in order | Interleave evidence with argument. Let the reader connect dots. |
| Resolution fully stated | Leave the resolution partly implicit. |
| Reflection paragraph at end | End on the last concrete point. Don't reflect. |
| Each section self-contained | Reference something from four paragraphs ago. Let threads cross. |

**Rule:** After drafting, map the implicit questions your piece answers. If they follow a predictable arc, shuffle them. Start with the answer. Bury the setup. Let the complication arrive late.

---

## 17. Rhetoric Calibration

LLMs systematically overclaim. Two-thirds of AI-generated outputs are rhetorically stronger than human originals on the same topics. Post-2023 academic writing shows a sharp increase in rhetorical intensity, with **r=0.904 correlation** between rhetoric scores and estimated LLM usage.

### The Inflation Pattern

| AI Default | Evidence-Matched |
|------------|-----------------|
| "revolutionizes" | "improves by 12%" |
| "groundbreaking discovery" | "first report of X in Y context" |
| "transformative impact" | "measurable change in Z" |
| "paradigm-shifting" | "challenges the assumption that..." |
| "unprecedented" | "the first since [date]" or just state what happened |
| "game-changing" | describe the specific change |

### Related Patterns

- **Promotional lexicon**: "cutting-edge," "state-of-the-art," "innovative," "pioneering." These overlap with the aidiolect kill list but the problem is framing, not just vocabulary.
- **Superlative creep**: "the most important," "the single biggest factor," "absolutely critical." Unless you have the ranking data, drop the superlative.
- **Significance inflation in conclusions**: "This work opens new avenues..." / "Future research will undoubtedly..." The modest version is almost always more credible.

**Rule:** Match claim strength to evidence strength. Understatement reads as confidence. Overstatement reads as a press release — or as AI.

---

## 18. Syntactic Variety

AI text can be detected at **88.85% F1 using only grammatical dependency patterns** — no vocabulary, no content, purely syntactic structure. This is the highest detection signal in the research base.

### What Detectors See

AI defaults to Subject-Verb-Object construction with mid-depth parse trees. Humans oscillate between very simple declaratives and deeply nested complex sentences. The uniformity of AI syntax is detectable in bigrams of dependency labels — the way one grammatical role follows another is too regular.

Key features (English): nominal subject positioning (nsubj), punctuation-dependency interactions, unspecified dependency relations. AI places punctuation at the same syntactic joints and constructs sentences with the same grammatical skeleton.

### How to Fix

| AI Default | Varied Alternative |
|------------|-------------------|
| "The team built the prototype." (SVO) | "Built in three weeks, the prototype..." (participial lead) |
| "The results show improvement." (SVO) | "Improvement shows in every metric." (OVS inversion) |
| "We tested the system." (SVO) | "Testing happened overnight." (nominalization) |
| Statement. Statement. Statement. | Statement. Question? Fragment. Statement. |

**Check:** After drafting, scan three consecutive sentences. If all three share the same Subject-Verb-Object skeleton, restructure at least one. Use inversions, fragments, questions, imperatives, cleft sentences ("It was the timeout that caused..."), or fronted adverbials ("Overnight, the cache filled.").

Also vary **parse tree depth**: mix very simple sentences (one clause, no nesting) with genuinely complex ones (subordinate clauses, relative clauses, stacked prepositional phrases). The mid-depth plateau is measurably AI.

---

## 19. Vocabulary Register Range

AI clusters vocabulary in a narrow mid-register band. Human writing spans the full range from plain to precise.

| Metric | Human | AI |
|--------|-------|----|
| Lexical diversity | 0.2-0.8 | 0.4-0.6 |

This means AI avoids both very simple words and genuinely specialized terms, defaulting to an "educated general" register that sounds professional but never distinctive.

### How to Fix

| Mid-Register Default | Varied Register |
|---------------------|-----------------|
| "The system experienced degradation" | "The system got slow" (plain) or "Latency spiked to 340ms at p99" (precise) |
| "The approach has limitations" | "It breaks" (plain) or "False positive rate exceeds 12% on out-of-domain inputs" (precise) |
| "The team implemented improvements" | "We fixed it" (plain) or "We rewrote the connection pool to use exponential backoff" (precise) |

**Rule:** Vary your register within a single piece. Use some plain words and some genuinely precise technical terms. The vocabulary downshift table (section 1) helps eliminate AI-typical words, but don't replace them all with mid-register alternatives — go simpler OR more specific, not to the same middle.

---

## 20. Name Selection Patterns

AI defaults to a narrow set of character names. "Emily" or "Sarah" appear in 63-70% of AI-generated articles across GPT-4o and Claude. AI also overuses "Dr." as a title.

### Common AI Name Defaults

Female: Emily, Sarah, Maya, Sophia, Aisha, Mei
Male: James, Marcus, Alex, Kai, Chen
Titles: Dr. [Last Name] appears at 3-5x the rate of human writing

### How to Fix

- **Match the context.** A 1940s factory worker isn't named Kai. A rural Appalachian grandmother isn't named Sophia.
- **Use full names sparingly.** Humans refer to characters by first name, nickname, or pronoun after introduction. AI keeps using the full name.
- **Avoid "diverse casting" patterns.** AI defaults to one name per perceived ethnicity in a round-robin that reads as performative rather than natural.
- **When in doubt, ask the author.** Name choice is deeply personal in fiction. If you're editing someone else's creative work, don't rename their characters.

**Rule:** If you're generating names and you reach for Emily, Sarah, Maya, or Kai — stop. Pick a name that fits the character's era, region, class, and family.

---

## 21. Cliche Metaphors and Conceptual Poverty

AI reuses the same conceptual metaphors at detectable rates. The kill list catches individual words, but the deeper problem is that AI reaches for the same handful of framing devices across all topics.

### Common AI Metaphor Defaults

| Cliche Frame | Why It Fails |
|---|---|
| "foundation" / "building blocks" | Construction metaphor for everything. |
| "landscape" / "ecosystem" | Nature metaphor for any domain. |
| "journey" / "roadmap" | Travel metaphor for any process. |
| "double-edged sword" | Balance metaphor for any tradeoff. |
| "tip of the iceberg" | Scale metaphor for any complex topic. |
| "game-changer" / "level up" | Gaming metaphor for any improvement. |
| "north star" / "compass" | Navigation metaphor for any goal. |
| "deep dive" / "scratching the surface" | Depth metaphor for any analysis. |

### How to Fix

- If you've used a metaphor you've seen in a hundred articles, cut it. The metaphor should come from the specific domain, not from a general-purpose metaphor drawer.
- One extended metaphor per piece is fine. Three mixed metaphors is a tell.
- If you can't think of a fresh metaphor, don't use one. Literal language is better than cliched figurative language.

**Rule:** After drafting, scan for conceptual metaphors. If the metaphor could apply to any topic in any field, replace it with literal language or a domain-specific comparison.

---

## 22. Clause-Level Parallelism Overuse

AI produces syntactically parallel clauses ("X enables Y, Z facilitates W, A drives B") at rates humans don't. This is distinct from SVO monotony — each clause may have different subjects, but the grammatical skeleton repeats.

| AI Pattern | Human Alternative |
|---|---|
| "It reduces costs, improves efficiency, and increases reliability" | "Costs dropped. The team got faster. And nothing broke for six weeks." |
| "This enables teams to collaborate, empowers managers to decide, and allows leadership to align" | Rewrite as prose: describe one thing, then explain how the other follows. |

**Rule:** If you've written three parallel clauses in a row, break at least one into a different grammatical shape.
