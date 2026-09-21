# Fable Drafting

> **Claude-specific.** This file describes model-routing mechanics for Claude Code / the Agent tool. It is not portable to other hosts — skip it on any host without Claude subagent dispatch. Nothing else in this skill depends on it; the EDIT and REVIEW passes work on whatever model is running.

Drafting long-form or voiced prose from scratch is a different job than editing existing prose. Editing is mechanical — the core rules and kill-list are a checklist any capable model applies. Drafting rewards the strongest model available, because coherence over length and a held voice are where weaker models fall down first.

Model IDs, per-token prices, cost ratios, and retention requirements are not repeated here. Their one home is the "Model and effort" section of the `oberskills:agent` skill, whose dated lineup snapshot is re-verified at each model release. This file uses tier aliases (`opus`, `fable`), which resolve to the current model in each tier.

## When to route drafting to the top tier

The `fable` tier is Anthropic's most capable generally available model, positioned for demanding reasoning and long-horizon work, at a multiple of the `opus` tier's price. It is **not** a creative-writing-specialized model (no such model exists in the lineup; the name is evocative, the positioning is general). So route to it selectively, not by default. This follows Anthropic's own guidance, quoted in the agent skill: start on the `opus` tier, and move up when the work is demanding long-horizon work or the lower tier has measurably fallen short.

| Situation | Draft on |
|-----------|----------|
| Short piece, edit-only, or a quick draft | The session model. Don't route. |
| Most creative / long-form / voiced drafting | The `opus` tier. A strong default at a fraction of the top tier's cost. Pair it with an explicit length instruction (below). |
| The genuinely hard, long, high-stakes piece where coherence over length is the bottleneck | The `fable` tier. Reserve it for this. |

**The `opus` tier drafts long.** Anthropic documents that the current Opus model writes longer responses and longer files than its predecessors, and that changing effort does not reliably shorten them — prompting does (source and quote: the agent skill's lineup snapshot, Behavior). A drafting dispatch should carry a target length or a "match length to what the piece needs; no filler sections, redundant summaries, or boilerplate" instruction. Without one, expect to cut in the EDIT pass.

Caveats before reaching for the top tier: the price multiple, and a data-retention requirement that fails under zero-retention orgs (both in the agent skill's snapshot). Neither matters for the EDIT pass — only for a drafting subagent. If the session already runs on the top tier, an inherited subagent bills at that tier; pass an explicit lower tier when the piece doesn't need it.

## The pattern: draft strong, edit local

Keep drafting and editing on separate models. Draft on the strong model; run the humanizing EDIT pass on the session model (it's a checklist, not a reasoning task).

1. **Draft.** Dispatch a subagent on the chosen tier with the brief, the relevant `references/types.md` row for the piece's reader-job, and the voice profile if one applies. For copy, add the awareness stage from `references/copy.md`; for a named structure, the row from `references/shapes.md`. Ask for the draft only.
2. **Edit.** Take the returned draft and run this skill's normal EDIT pass on it (core rules → `references/surface-rules.md` → `references/deep-craft.md` for long pieces) on the session model. A model-written draft gets the developmental level (`references/edit-levels.md`).
3. **Return** the edited text.

For dispatch mechanics — model/effort selection, the delegation contract, when delegation is worth it at all — see the `oberskills:agent` skill. This file only says *which* tier and *why*; `agent` says *how* to dispatch.
