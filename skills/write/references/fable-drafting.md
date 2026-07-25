# Fable Drafting

> **Claude-specific.** This file describes model-routing mechanics for Claude Code / the Agent tool. It is not portable to other hosts — skip it on any host without Claude subagent dispatch. Nothing else in this skill depends on it; the EDIT and REVIEW passes work on whatever model is running.

Drafting long-form or voiced prose from scratch is a different job than editing existing prose. Editing is mechanical — the core rules and kill-list are a checklist any capable model applies. Drafting rewards the strongest model available, because coherence over length and a held voice are where weaker models fall down first.

## When to route drafting to Fable 5

`claude-fable-5` is Anthropic's most capable widely-released model — positioned for the most demanding reasoning and long-horizon work, at ~2× the Opus tier's price (Opus 5 and Opus 4.8 are both $5/$25 per MTok; Fable is $10/$50). It is **not** a creative-writing-specialized model (no such model exists in the lineup; the name is evocative, the positioning is general). So route to it selectively, not by default.

| Situation | Draft on |
|-----------|----------|
| Short piece, edit-only, or a quick draft | The session model. Don't route. |
| Most creative / long-form / voiced drafting | Opus 5 (`claude-opus-5`) — the current Opus tier, at half Fable's cost. A strong default. Pair it with an explicit length instruction (below). |
| You specifically want the warm, less-hedged prose register | Opus 4.8 (`claude-opus-4-8`) — still active at the same price, and warm expert-level prose is the differentiator its own launch material claimed. Opus 5's material claims no such tuning, so this is not an automatic upgrade for voice work. |
| The genuinely hard, long, high-stakes piece where coherence over length is the bottleneck | `claude-fable-5`. Reserve it for this. |

**Opus 5 drafts long.** Anthropic documents that its default user-facing responses *and* written deliverables run longer than prior models', and that `effort` does not reliably shorten visible output — prompting does. A drafting dispatch to Opus 5 should carry a target length or a "match length to what the piece needs; no filler sections, redundant summaries, or boilerplate" instruction. Without one, expect to cut in the EDIT pass.

Caveats before reaching for Fable: it costs ~2× Opus, requires 30-day data retention (fails under zero-retention orgs), and its safety classifiers can refuse. None of that matters for the EDIT pass — only for a drafting subagent.

## The pattern: draft strong, edit local

Keep drafting and editing on separate models. Draft on the strong model; run the humanizing EDIT pass on the session model (it's a checklist, not a reasoning task).

1. **Draft.** Dispatch a subagent on the chosen model with the brief, the relevant `references/types.md` row for the piece's reader-job, and the voice profile if one applies. Ask for the draft only.
2. **Edit.** Take the returned draft and run this skill's normal EDIT pass on it (core rules → `references/surface-rules.md` → `references/deep-craft.md` for long pieces) on the session model.
3. **Return** the edited text.

For dispatch mechanics — model/effort selection, the delegation contract, when delegation is worth it at all — see the `oberskills:agent` skill. This file only says *which* model and *why*; `agent` says *how* to dispatch.
