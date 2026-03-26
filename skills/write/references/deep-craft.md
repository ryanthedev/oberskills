# Deep Craft

Load this for long-form writing, deep edits, or when surface + core rules aren't enough. These patterns address the structural and statistical signals that survive surface cleanup.

Sources: DependencyAI (2026), QUDsim (2025), Counterfactual Rhetoric (2025), GPTZero perplexity research, 147-paper synthesis (2025-2026).

**Key numbers:**
- 88.85% F1 detection from grammar alone (no vocabulary, no content)
- r=0.904 correlation between rhetorical intensity and estimated LLM usage
- Discourse-level features = 34% of detection signal (largest single category)
- 76.2% diversity loss from RLHF alignment

---

## Syntactic Variety

AI defaults to Subject-Verb-Object with mid-depth parse trees. Humans oscillate between simple declaratives and deeply nested complex sentences. The uniformity is detectable in dependency label bigrams.

| AI Default | Varied Alternative |
|------------|-------------------|
| "The team built the prototype." (SVO) | "Built in three weeks, the prototype..." (participial lead) |
| "The results show improvement." (SVO) | "Improvement shows in every metric." (OVS inversion) |
| "We tested the system." (SVO) | "Testing happened overnight." (nominalization) |
| Statement. Statement. Statement. | Statement. Question? Fragment. Statement. |

**Check:** If three consecutive sentences share the same SVO skeleton, restructure at least one. Use inversions, fragments, questions, imperatives, cleft sentences, or fronted adverbials.

Vary parse tree depth: mix very simple sentences (one clause) with genuinely complex ones (subordinate clauses, relative clauses, stacked prepositional phrases). The mid-depth plateau is measurably AI.

---

## Discourse Flow Templating

LLMs reuse the same narrative progression even when vocabulary varies. Discourse features = 34% of detection signal, ahead of syntax (28%), lexical (24%), morphological (14%).

Default AI progression: setup → complication → resolution → reflection. Every piece.

QUDsim (2025): LLMs reuse discourse structures far more than humans. GPT-4o is the most formulaic. Varying temperature doesn't help.

Cross-model convergence: GPT-4o, Claude, and Gemini produce documents more structurally similar to each other than to human writing.

| Default AI Flow | Human Alternative |
|-----------------|-------------------|
| Setup first, then complication | Start with the complication. |
| Evidence marshaled in order | Interleave evidence with argument. |
| Resolution fully stated | Leave it partly implicit. |
| Reflection paragraph at end | End on the last concrete point. |
| Each section self-contained | Reference something from paragraphs ago. |

**Rule:** Map the implicit questions your piece answers. If predictable, shuffle them.

---

## Rhetoric Calibration

Two-thirds of AI outputs are rhetorically stronger than human originals. r=0.904 correlation between rhetoric scores and estimated LLM usage.

| AI Default | Evidence-Matched |
|------------|-----------------|
| "revolutionizes" | "improves by 12%" |
| "groundbreaking discovery" | "first report of X in Y context" |
| "transformative impact" | "measurable change in Z" |
| "unprecedented" | "the first since [date]" |

**Related:** Superlative creep ("the most important," "absolutely critical") and significance inflation in conclusions ("opens new avenues...").

**Rule:** Match claim strength to evidence. Understatement reads as confidence. Overstatement reads as AI.

---

## Vocabulary Register Range

AI clusters in a narrow mid-register band. Human writing spans plain to precise.

| Metric | Human | AI |
|--------|-------|----|
| Lexical diversity | 0.2-0.8 | 0.4-0.6 |

| Mid-Register Default | Varied |
|---------------------|--------|
| "experienced degradation" | "got slow" (plain) or "latency spiked to 340ms at p99" (precise) |
| "has limitations" | "breaks" (plain) or "FPR exceeds 12% on out-of-domain" (precise) |
| "implemented improvements" | "fixed it" (plain) or "rewrote the connection pool" (precise) |

**Rule:** Go simpler OR more specific, not to the same middle.

---

## False Certainty

| Vague | Fix |
|-------|-----|
| "Best practices suggest..." | Which practice? Who says? |
| "Industry standard" | Which standard? |
| "Various factors" | Name them. |
| "Significant improvement" | Give the number. |

**Rule:** If you can't name the specific thing, you don't know it well enough to write about it.

---

## Cowardly Passives

| Cowardly | Direct |
|----------|--------|
| "It can be seen that..." | "[Subject] shows..." |
| "The decision was made to..." | "[Who] decided..." |
| "Mistakes were made" | "We made mistakes." |

Legitimate passive: "The server was deployed at 3 AM" (actor irrelevant). Keep those.

**Rule:** If you can name the actor, name the actor.

---

## List Addiction

**Use bullets when:** items are parallel, independent, reader needs to scan.
**Use prose when:** items build on each other, cause and effect matter, narrative aids understanding.

**Rule:** If your bullets tell a story, write the story.

---

## Emotional Range

AI text is neutral or mildly positive. Humans express frustration, surprise, humor, sarcasm. Relentless optimism is a tell.

**Rule:** If something is frustrating, say so. If an approach is bad, say it's bad.

---

## Self-Correction

Human writing shows revision traces: parenthetical asides, restated points, visible thinking. AI produces polished first-draft prose.

**Rule:** Leave room for "actually, wait" moments. Genuine uncertainty reads as more human than stacked hedges.

---

## Name Selection

AI defaults to Emily/Sarah (63-70% of AI articles) and overuses "Dr." titles.

**Rule:** Pick names that fit era, region, class. Use first name or nickname after introduction.

---

## Cliche Metaphors

| Cliche Frame | Why It Fails |
|---|---|
| "foundation" / "building blocks" | Construction metaphor for everything. |
| "landscape" / "ecosystem" | Nature metaphor for any domain. |
| "journey" / "roadmap" | Travel metaphor for any process. |
| "double-edged sword" | Balance metaphor for any tradeoff. |
| "deep dive" / "scratching the surface" | Depth metaphor for any analysis. |

**Rule:** If the metaphor could apply to any topic in any field, replace it with literal language or a domain-specific comparison.

---

## Clause-Level Parallelism

AI produces parallel clauses ("X enables Y, Z facilitates W, A drives B") at rates humans don't.

| AI Pattern | Human Alternative |
|---|---|
| "It reduces costs, improves efficiency, and increases reliability" | "Costs dropped. The team got faster. And nothing broke for six weeks." |

**Rule:** Three parallel clauses in a row? Break at least one into a different grammatical shape.

---

## Over-Explanation

AI defines obvious things and adds context nobody asked for.

**Rule:** Trust the reader's intelligence. Write for your audience, not the least knowledgeable possible reader.

---

## Formatting Tells

| Tell | Fix |
|------|-----|
| Erratic bolding of key terms | Bold consistently or not at all. |
| Emoji as section markers | Remove unless the medium calls for it. |
| "Bolded phrase:" in every list item | Vary formatting. |
| Punny headlines with colons | Write straightforward headings. |
| British/American switching | Pick one. |

---

## Resumptive Filler

| Filler | Direct |
|--------|--------|
| "In terms of..." | Name the subject directly. |
| "When it comes to..." | Delete. |
| "At the end of the day..." | Delete. |

**Rule:** Name the subject and get on with it.
