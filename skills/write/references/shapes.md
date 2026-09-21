# Shapes

A library of structures. Load this when drafting from scratch, when the ask names a structure or a container ("structure this", "BLUF it", "press release", "changelog"), or on a developmental edit where the order is the problem. Job comes first (`references/types.md`); a shape is how that job gets a skeleton.

Sources: Barbara Minto, *The Pyramid Principle* (pyramid, answer-first); the journalistic inverted pyramid and nut graf (newsroom practice); Daniele Procida, Diátaxis (diataxis.fr, checked 2026-09-21); *Keep a Changelog* 1.1.0 (keepachangelog.com, checked 2026-09-21); *Semantic Versioning* 2.0.0 (semver.org, checked 2026-09-21); David Ogilvy, *Ogilvy on Advertising*, and John Caples, *Tested Advertising Methods*, on headlines. AIDA, PAS, and before–after–bridge are long-standing advertising-trade practice with contested authorship; they are named here as conventions and carry no measured claims.

## Contents

1. [Shape and Wander](#1-shape-and-wander)
2. [The shapes](#2-the-shapes)
3. [Containers](#3-containers)
4. [Openings, titles, endings](#4-openings-titles-endings)

---

## 1. Shape and Wander

A shape library is a template generator, and the core rule *Wander* exists to break templated discourse. Both hold, at different levels.

**Shape is the reader's contract at the skeleton level.** A reader who opens a changelog, a press release, or a memo to a busy executive expects certain things in certain places, and meeting that expectation is a service. Breaking it costs the reader time and buys nothing.

**Wander governs the order of moves inside the skeleton.** The pyramid says the answer comes first. It does not say the three supporting arguments arrive as three parallel paragraphs of equal length, each opening with its claim and closing with its evidence. That inner regularity is the detection signal, and it's where Wander, Lurch, and Spike do their work.

Two consequences:

- Pick a shape only when the reader is served by a contract. Narrative and Expressive pieces usually aren't: they have an arc, not a skeleton, and Wander runs at full strength.
- Every shape below has a break-it clause. When the clause applies, break the shape. A shape followed against its break clause is the template failure Wander warns about.

Never stack shapes. One skeleton per piece; a second one inside a section is fine only when that section has a different reader job.

---

## 2. The shapes

| Shape | Skeleton | Fits | Break it when |
|-------|----------|------|---------------|
| **Pyramid / BLUF** (Minto) | The answer. Then the few arguments that support it, grouped. Then the evidence under each. The reader can stop at any depth and still have the point. | Expository and Persuasive for a reader short on time: memos, status updates, recommendations, incident summaries. | The reader is hostile to the answer. Answer-first hands them the thing to reject before the reasons land; open on the ground you share. Also when the piece is Narrative or Expressive. |
| **Inverted pyramid + nut graf** | Most newsworthy fact first, then detail in descending importance, cuttable from the bottom. Feature variant: open on a scene or a person, then a nut graf that says what this is about and why now. | Announcement / Update, news, press releases. | The piece is meant to be read whole. Descending importance gives an essay a dying fall; it needs an ending, and the pyramid has none. |
| **Problem–solution** | The problem, what it costs, the solution, the evidence it works. | Proposals, design rationale, case studies, Persuasive pieces for a reader who doesn't yet feel the problem. | The reader already lives with the problem. Then the setup is throat-clearing: start at the solution and spend the words on proof. |
| **Before–after–bridge** | The reader's situation now. The situation after. The way across. | Marketing and change proposals, where the "after" is concrete. | The "after" can't be backed by proof (it turns into fantasy), or the reader already knows the product and wants the offer (see awareness in `references/copy.md`). |
| **AIDA** | Attention, interest, desire, action. | Copy with exactly one action at the end. | The reader arrived already wanting the thing. Skip to the action. Also when "attention" would mean a hook unrelated to the offer: that's a bait and the piece pays for it later. |
| **PAS** | Problem, agitate, solve. | Short copy for a problem-aware reader: cold email, ads. | Agitating would manufacture a fear the reader doesn't have (see the claims rider in `references/copy.md`), or the audience is technical and sober enough to read agitation as manipulation. |
| **Diátaxis quadrants** (Procida) | Four kinds of documentation, one per reader need: tutorial (learning), how-to guide (a task), reference (lookup), explanation (understanding). One document, one quadrant. | Instructional and Reference passages; docs sets. | A small project has one page to do all four. Then give each quadrant its own section and keep them unmixed inside a section: no explanation in the middle of the steps. |

Choosing between them is mostly the Job row plus one question: **how much does the reader already agree, know, or want?** A reader who agrees gets the answer first. A reader who doesn't gets the shared ground or the problem first.

---

## 3. Containers

A container is where the piece ships. It gets a row only when it imposes conventions that are easy to get wrong. Every other container is a shape plus a job, and nothing more needs saying. Platform character limits and markup belong to penman, not here.

| Container | Shape | Job (`references/types.md`) | The convention that gets missed |
|-----------|-------|------------------------------|---------------------------------|
| **README** | Diátaxis, sectioned: what it is and who it's for, then a how-to quickstart, then pointers to reference. | Expository opener, Instructional body. | The reader decides on the first screen whether this solves their problem. Say what it does before how it's built. Commands must be real and runnable. Marketing register in a README is a register break. |
| **Changelog entry** | Newest version first. Within a version, changes grouped by kind. | Announcement / Update. | *Keep a Changelog*: written for humans, not a commit-log dump. Group under Added, Changed, Deprecated, Removed, Fixed, Security. Give each version its date in ISO 8601 form, keep an Unreleased section at the top, and say whether the project follows Semantic Versioning. Under semver a breaking change means a major version, and the entry says what breaks and what to do about it. |
| **Press release** | Inverted pyramid. | Announcement / Update. | Headline, dateline, a lede that carries who, what, when, and where. Quotes are the usual failure: a quote is a person saying something a person would say, and it adds what the body can't (a reason, a stake, an opinion). Ends with the boilerplate "about" paragraph and a contact. No invented quotes: leave a placeholder, as in `references/copy.md`. |
| **Newsletter** | One main piece in whatever shape its job needs, then short items. | The main piece's job; often Expository or Expressive. | The reader opted in and has read earlier issues. Don't reintroduce the publication each time. The voice recurs; the structure may vary issue to issue. The subject line promises what the issue delivers. |
| **Cold email** | PAS or before–after–bridge, compressed to a few sentences. | Marketing: load `references/copy.md`. | The reader is a stranger, unaware or barely problem-aware. The first sentence is about them, not the sender. One ask, small enough to answer in a line. |
| **Social post** | The lede is the piece. | Whatever the post is for. | No warm-up and no sign-off summary. One idea. The one-sentence-per-line stack is a template tell of its own; Lurch still applies. |
| **Talk script** | Problem–solution or a narrative arc. | Expository or Persuasive, delivered aloud. | Written for the ear. A listener can't re-read, so signposting and repetition that the surface rules would cut from prose stay in. Sentences a speaker can say in a breath. |

---

## 4. Openings, titles, endings

**Ledes.** The opening makes a promise the piece keeps.

| Lede | What it does | Watch for |
|------|--------------|-----------|
| Summary | States the news or the answer. Default for Announcement, pyramid, inverted pyramid. | Throat-clearing before it. If the first paragraph can be deleted with no loss, the second paragraph was the lede. |
| Anecdotal | Opens on one scene or person, then a nut graf says what it stands for. | A scene with no nut graf. An invented scene: use a real one or a different lede. |
| Contrast | What people assume, against what is true. | The "X isn't just Y; it's Z" construction from the surface rules. State the true thing and let the contrast be implied. |
| Direct address | Names the reader's situation in their words. Default for copy aimed at a problem-aware reader. | A question lede the reader can answer "no" to. |

**Titles and headlines.** Ogilvy's point stands without a number on it: far more people read the headline than the body, so the headline carries the offer or the news by itself. Caples sorted working headlines into three kinds: self-interest, news, and curiosity. Curiosity alone is the weakest, and strongest when tied to one of the other two. Make the title a specific promise the body pays off. Skip the pun-colon-subtitle pattern (see Formatting Tells in `references/deep-craft.md`).

**Endings.** Land on the last concrete thing. The reflection paragraph that restates the piece and gestures at its significance is the default AI ending (see Discourse Flow Templating in `references/deep-craft.md`): delete it and see if the piece already ended one paragraph earlier. It usually did. By job: copy ends on the action, an instructional passage ends on the verified result, an announcement ends on what the reader does next, and an essay ends on an image or a fact rather than a lesson.
