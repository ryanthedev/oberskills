# Surface Rules

Kill the obvious tells. These are the words, phrases, and punctuation patterns that flag AI text at the surface level. Load this for every EDIT pass.

Sources: Pangram Labs phrase analysis (N=millions), UCC stylometric study, Columbia University creative writing analysis, community-compiled tells from editors/writers, 147-paper synthesis (2025-2026).

---

## 1. The Aidiolect

Each model has a vocabulary fingerprint. Individual words prove nothing, but clusters reveal everything.

### Measured Overuse Rates (Pangram Labs)

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

### Kill List

**Ban:** delve, crucial, tapestry, foster, nuanced, moreover, furthermore, essential, pivotal, comprehensive, utilize, harness, illuminate, bolster, underscore, enhance, intricate, multifaceted, innovative, groundbreaking, elevate, systemic, inherent, facilitate, realm, beacon, cacophony, kaleidoscope, mosaic, commendable, resonate, navigate, synergy, unleash, embarked, spearheaded, ventured

**Morphological variants equally banned:** leveraging, harnessing, utilizing, facilitating, bolstering, etc.

**Synonym trap:** Don't replace kill-list words with mid-register synonyms. "Thorough," "extensive," "holistic," "end-to-end" in rotation is the same tell in a different coat.

### Downshift Table

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
| elevate | raise, improve |
| enhance | improve |
| optimize | improve, tune |
| pivotal | key, important |
| multifaceted | complex |
| intricate | complex, detailed |
| revolutionize | change |

**Rule:** Use the simplest word that carries the meaning. If the fancy word adds real precision, keep it.

---

## 2. The ChatGPT Dash

Em-dash overuse is the #1 punctuation tell. AI uses it at 2-5x the human rate.

| Em-dash Used For | Replace With |
|-----------------|-------------|
| Aside or parenthetical | Parentheses or commas |
| Explanation | Colon |
| Contrast or turn | Period. Two sentences. |
| Emphasis | Restructure so the strong word lands at sentence end |

**Rule:** ONE em-dash maximum per piece. Post-write lint check: scan and replace extras.

---

## 3. Hollow Openers

| Kill | Replace With |
|------|-------------|
| "It's important to note that..." | Start with the note. |
| "It's worth mentioning that..." | Mention it. |
| "It should be noted that..." | Say it. |
| "Let me explain..." | Explain. |
| "In order to..." | "To." |
| "In today's [digital/fast-paced] world..." | Delete. |
| "In an era of..." | Delete. |
| "In conclusion..." / "In summary..." | The reader knows it's the end. |

### Formulaic Constructions (2-5x more in AI text)

| Pattern | Fix |
|---------|-----|
| "From X to Y" range | Name the specific audience or delete. |
| "X isn't just Y; it's Z" | Make the real claim directly. |
| "Not only... but also..." | Restructure or use "and." |
| "Whether... or..." | Delete. Get to the point. |

**Rule:** If you delete the opener and the piece still works, delete it.

---

## 4. Hedge Limit

One hedge per statement. "This might cause issues" is honest. "It seems like it might potentially be an issue" is cowardice.

**Rule:** One hedge maximum. Plain uncertainty beats stacked hedges: "I'm not sure" or "I haven't tested this."

### Voice Vacuum

Commit to a position when the context calls for one. "Both approaches have merits" is a cop-out when one is clearly better. Say which and say why.

---

## 5. Sycophancy

| Kill | Why |
|------|-----|
| "Great question!" | The reader didn't ask for a grade. |
| "Absolutely! Let me..." | Just do the thing. |
| "I'd be happy to help!" | Help is assumed. |
| "But here's the thing..." | Manufactured suspense. |
| "Hot take:" | Prepackaged rebellion. |

**Rule:** Delete sycophancy entirely. Use contractions and simple words for casualness, not catchphrases.

---

## 6. Adverb Stuffing and Verb Poverty

| Stuffed | Direct |
|---------|--------|
| "effectively leverages" | "uses" |
| "significantly improves" | "improves" (or give the number) |
| "fundamentally changes" | "changes" (or describe how) |

AI also uses bland verbs even without adverbs. MFA panelists (82.7% detection rate) call it "stripped-down descriptions lacking careful verb choices."

| Bland | Alive |
|-------|-------|
| went | trudged, slipped, drifted |
| looked | squinted, scanned, glanced |
| said | muttered, snapped, offered |
| made | carved, rigged, cobbled |

**Rule:** Cut adverbs. Replace weak verbs with verbs that carry sensory or specific meaning.

---

## 7. Transition Crutches

| Overused | Fix |
|----------|-----|
| "Furthermore" / "Moreover" / "Additionally" | Delete or use "also." |
| "Consequently" | "So" or restructure. |
| "Nevertheless" / "However" | "But," "Still," or delete. |
| "That being said" / "Having said that" | "But." |

**Rule:** One formal transition per three paragraphs maximum. Use "but," "and," "so," "still," "yet."

---

## 8. Contractions

AI defaults to "do not," "it is," "we are." Humans write "don't," "it's," "we're."

**Rule:** Use contractions in all but the most formal contexts.

---

## 9. Sentence-Initial Conjunctions

Humans start sentences with "And," "But," "So," "Still." AI rarely does.

**Rule:** Start sentences with conjunctions when it fits the rhythm.
