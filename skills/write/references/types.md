# Types

Pick the type by the **reader's job** — what the reader is trying to *do* with the text — not by the container it ships in. Email, blog, doc, and Slack are containers; the reader's job is what dictates rhythm, structure, and what "good" means. A landing page and a legal brief can share the persuasive job and need the same spine; a tutorial and a reference share the container "docs" and need opposite craft.

Sources: Diátaxis (docs classified by reader job: learn / act / look up / understand); Kinneavy's *aims of discourse* (referential / persuasive / literary / expressive); Aristotle's appeals (ethos / pathos / logos); genre-glitch analysis of AI register drift. The per-type "AI failure" column is the characteristic tell for that job — beyond the surface kill-list, which applies to all types.

## How to use this

1. Name the reader's job first. If a piece does two jobs (a blog post that explains *and* persuades), it has a primary — write to that, and don't let the secondary blur the spine.
2. Load the row. Apply its craft rules on top of the core five and the surface kill-list.
3. Run the register-consistency check (bottom) last — it catches the cross-type failure the per-type rows miss.

## The taxonomy

| Type | Reader's job | Craft rules for this job | Characteristic AI failure |
|------|-------------|--------------------------|---------------------------|
| **Narrative** | Follow / experience a sequence of events | Control scene vs. summary deliberately. Concrete sensory and causal detail. Show, don't tell. | Flattening — cliché density, uniform affect, predictable setup→resolution arc, telling where it should show. |
| **Expository** | Understand *why* something is true or works | Order known → unknown. One governing analogy, not five. Answer "why," not just "what." | Over-explains the obvious; restates instead of clarifying; hedges to avoid being wrong. |
| **Persuasive** | Decide what to *believe* | Claim up front. Calibrate ethos/pathos/logos to how skeptical the audience is. Address the strongest counterargument, not a strawman. | Thin logos — confident tone substitutes for evidence; assertion without proof. |
| **Marketing** | Decide to *act* (buy, click, sign up) — fast | Benefit first. Specificity beats superlative. One emotional hook tied to one concrete proof point. | Buzzword density ("unlock," "seamless," "game-changer") — vague superlatives, zero specifics. |
| **Expressive** | Encounter a specific human interior voice | Hold one voice (or split past/present self deliberately). Idiosyncratic, particular detail. Tolerate unresolved ambiguity. | Institutional voice; over-resolves ambiguity into a tidy "lesson"; moralizes instead of showing. |
| **Announcement / Update** | Know what changed and what it means for them | Lead with the change and its consequence. Concrete specifics (versions, dates, names). Say what to do next; leave a door open. | Corporate throat-clearing before the point; "we're excited to" with no substance; buries the actual change. |
| **Instructional** | *Do* a task and succeed | Imperative mood. One verifiable action per step. Sequential completeness, including the edge cases and error states. | Assumes the happy path; steps not grounded in the reader's actual system or failure mode. |
| **Reference** | Look up a fact fast, not read linearly | Neutral tone. Exhaustive, structurally parallel entries. Zero narrative framing. | Inconsistent terminology across entries; reads complete while silently omitting cases. |

## Scope boundary

The write skill is for prose humans read. It actively edits the first six types (Narrative, Expository, Persuasive, Marketing, Expressive, Announcement/Update). **Instructional** and **Reference** lean into technical documentation — when the piece is code docs, API reference, docstrings, or comments, that's out of scope (leave it, or defer to the doc's own conventions). Their rows stay here because prose pieces sometimes carry an instructional or reference passage; apply the row to that passage, not to a whole API doc.

## Register consistency (cross-type)

A distinct AI failure cuts across every type: the register drifts mid-piece — promotional language bleeding into a memo, marketing hype surfacing in a news paragraph, a casual aside inside a formal argument. Genre-glitch analysis flags this as one of the more reliable AI tells because a human writer holds a register by instinct and a model slips between the ones it has seen most.

After drafting, read the piece for register breaks: does any sentence belong to a different type than the one you chose? If a persuasive piece suddenly reads like marketing, or an expository passage turns into an announcement, pull it back to the piece's job. One register, held, unless a shift is deliberate (see the core rule *Shift Register* — which is about tonal range within a register, not slipping between genres).
