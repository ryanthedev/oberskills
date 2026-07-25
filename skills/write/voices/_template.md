# Voice Template

A voice profile bends humanized prose toward one specific person. The AI-tell removal (this skill's core rules + surface kill-list) is table stakes and runs first; the voice is the point. A piece that's merely "human" but doesn't sound like the target person has failed.

Voice profiles are **personal and private** — they do not live in this repo. Author one from this template, save it to your private voices directory (see the Voice router in the skill body), and the skill loads it on demand.

## How to build a profile

Gather real samples of the person writing — Slack, email, PRs, docs, messages. Extract patterns, not paraphrases. The most useful section is a verbatim sample bank: the model matches cadence far better against real sentences than against descriptions of them.

## Structure

Copy this skeleton and fill each section from the person's actual writing.

```markdown
# Voice: <Name>

Built from <sources> (<dates>). Pattern, not paraphrase — the sample bank at the
bottom is verbatim so you can match cadence directly.

## The one-line summary
<One sentence capturing the through-line of how they think and sound. What
survives from their most casual message all the way up to their most formal?>

## Lexicon
- Softeners / fillers they actually use: <...>
- Abbreviations: <...>
- Slang that's theirs specifically: <...>
- Openers and sign-offs: <...>
- Emoji habits: <...>
Note: how heavily to salt. One or two markers per message, not a pile — over-use
reads as caricature.

## Sentence mechanics
<Fragments? Sentence-initial conjunctions? Trailing "..."? Comma splices in
casual mode? Lowercase starts? Contractions? Give real examples of each.>

## How they reason
<Point-first or setup-first? Concrete (names repos/versions/tickets) or abstract?
Do they propose a next step with a cost? How do they flag uncertainty?>

## Interpersonal tone
<Encouraging? Self-deprecating? How do they own mistakes? Do they leave the other
person a door out? Values they actually voice?>

## Register ladder — worked
<The same voice at 2-3 formality rungs (casual DM / team update / professional).
Show a real example at each rung. Name what carries across all of them and what
only changes at the surface.>

## Structure of a longer message
<Their template for a real work message: opener, the ask, reassurance, close.>

## Anti-voice (never do this)
<Vocabulary, punctuation, and moves that are definitively NOT them. Include the
generic AI tells they'd never produce.>

## Verbatim sample bank
<Grouped by register/mood. Real sentences, quoted exactly. This is the highest-
value section — the model pattern-matches cadence against these directly.>
```

## Checks before you rely on it

1. Read a draft in the person's voice — would they actually send this? If it sounds like a helpful assistant, redo it.
2. Register matches the medium (casual markers absent from a doc; present in a DM).
3. At least one concrete specific, not a generic claim.
4. The through-line from the one-line summary is present.
5. No kill-list vocab, no em-dashes, contractions present, sentence length varies.
