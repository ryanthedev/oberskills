# Edit Levels

How much license the editor has. Load this for any EDIT of text the user supplied. The failure it exists to stop: "just tidy this" comes back as a rewrite, correct in every rule and no longer the author's.

Sources: Editorial Freelancers Association, *Editorial Service Definitions* (the-efa.org/editorial-services-definitions, checked 2026-09-21) for the four levels; *The Chicago Manual of Style*, 17th ed., §2.48–2.50, for the mechanical vs. substantive split; Einsohn & Schwartz, *The Copyeditor's Handbook*, for light / medium / heavy copyediting and the "point out, do not revise" convention.

## The four levels

Restraint can't be self-graded, so each level is defined by what stays fixed. If the fixed thing moved, the edit left its level.

| Level | May touch | Stays fixed | Core rules in force |
|-------|-----------|-------------|---------------------|
| **Proofread** | Typos, spelling, punctuation errors, doubled or dropped words, broken formatting, inconsistent capitalization. Errors only. | Every word choice and every sentence. A kill-list word is a choice, not an error: it stays. | None. No surface rules either. |
| **Copy edit** | Grammar, usage, agreement, tense and term consistency. Word-for-word swaps from the surface rules (the downshift table, the em-dash replacements). Query a factual inconsistency; don't resolve it. | The number of sentences, their order, and their construction. | None. Surface rules at word level only. |
| **Line edit** | Sentences and paragraphs: recast, cut, split, merge, reword. All surface rules. Deep-craft at sentence level. | The paragraphs, their order, and the point each one makes. The opening's strategy. The argument. | Lurch, Shift Register (inside the range the author already shows), Get Specific (using specifics already in the text or supplied; never invented). Spike within a paragraph. Wander is off. |
| **Developmental** | Everything: order, what's included, the opening, the ending, the shape. | The thesis, the facts, and the author's stated intent. | All five, plus the Job, Shape, Style, and Copy axes. |

A proofread does not Lurch anything. A copy edit that improves a sentence's rhythm has become a line edit. A line edit that moves the conclusion to the top has become developmental.

## Inferring the level from the ask

| The ask sounds like | Level |
|---------------------|-------|
| "proofread", "check for typos", "any mistakes?", "final check before I send" | Proofread |
| "tidy", "clean up", "light pass", "polish", "fix the grammar" | Copy edit |
| "tighten", "punchier", "make it flow" | Line edit |
| "humanize", "sounds robotic", "less AI", "reads like ChatGPT wrote it" | Developmental |
| "needs real work", "rewrite", "restructure", "it isn't working", "make this good" | Developmental |
| No depth signal, text the author wrote | Line edit |
| No depth signal, text a model wrote (the user says so, or you drafted it) | Developmental |

The last two rows turn on whose voice is at stake. Text a person wrote carries choices worth protecting, so the default stops short of structure. Machine-drafted text has no author's voice to sand off, and its structural tells are the point of this skill, so the full pass runs. Drafting from a description is always developmental.

"Humanize" asks are developmental because the complaint itself says the text reads machine-made, and discourse order is the most robust tell there is (the core rule *Wander*); a level that switches Wander off can't fix what the user is describing. The mixed case: when the user asks to humanize text they say they wrote themselves, the pass is still developmental on structure, but the author's specifics and word-level voice are held as fixed as the facts are.

When the ask names a level and also names a problem above it ("proofread this, and the intro feels slow"), the named problem extends the license to that problem only.

## Saying the level

EDIT returns text and nothing else. This is one of two exceptions (the other is the intake question in `references/copy.md`), and it is one line.

Open with a single line naming the level when either holds:

- **The level was inferred, the ask was ambiguous, and the piece is one someone cares about**: it's signed, personal, long, or has an evident voice. Example: `Line edit: sentences recast, structure and argument untouched. Say if you want it lighter or deeper.`
- **The pass found a problem above its license.** Point it out, don't fix it. Example: `Proofread only. The change itself doesn't appear until paragraph four; a developmental pass would move it up.`

Skip the line when the ask named the level and nothing above it turned up, when the piece is short and disposable (a chat reply, a two-line blurb), and when drafting from scratch. Never more than the one line; a second problem above the license waits for REVIEW mode.

## With the other axes

- **Style cards and register dials** (`references/style-cards.md`) are line-edit moves. "Punchier" licenses a line edit, not a restructure. At proofread and copy-edit depth a card supplies only its mechanical conventions (spelling, capitalization, numerals).
- **Voice profiles** apply from line edit up. Below that, the text is already the person's.
- **Shape** (`references/shapes.md`) and the lead decisions in `references/copy.md` are developmental. A line edit of copy sharpens the lead it was given.
- **REVIEW mode** has no license problem, since the author makes every change. Use the level to scope which issue groups to raise: don't open a structural discussion when the ask was a final check.
- **Final Edit Pass** in the skill body: pass the level to the lint (`--level`), which suppresses the findings a level doesn't license: all of them at proofread, everything but ban-list words and extra em-dashes at copy edit, none from line edit up. The judgment items run from line edit up, and the structure item only at developmental.
- **The argument lens** (`references/argument.md`) is developmental: its fixes move claims, cut assertions, and change what the title promises.
