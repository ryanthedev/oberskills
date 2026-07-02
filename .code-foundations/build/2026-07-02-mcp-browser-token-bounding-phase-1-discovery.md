# Discovery + Design: Phase 1 - mcp-browser output bounding + extract correctness + INSTRUCTIONS

## Files Found
- `mcp-browser/src/tools/snapshot.ts` — returns `{ tree: snap.tree, refs: snap.refs }` inline, unbounded.
- `mcp-browser/src/tools/evaluate.ts` — returns `{ result }` inline unconditionally; only the text line is truncated to 256 chars.
- `mcp-browser/src/tools/collect.ts` — returns `{ items, nothing_expandable, count }` inline unconditionally.
- `mcp-browser/src/tools/extract.ts` — already calls `writePayload`, but `ExtractOut` (types.ts) has no field to carry `written.inlinedPreview`, so sub-threshold results are silently count-only (confirmed bug).
- `mcp-browser/src/types.ts` — DTOs `SnapshotOut` (missing — snapshot.ts doesn't even import one), `EvaluateOut`, `CollectOut`, `ExtractOut` all present but unbounded/incomplete as described above. `SnapshotInputSchema` has only `interesting_only`.
- `mcp-browser/src/core/browser-port.ts` — `SnapshotOpts = { interestingOnly? }`, `SnapshotResult = { tree, refs }` — no depth/node caps, no nodeCount/truncated.
- `mcp-browser/src/adapters/puppeteer/refs.ts` — `buildSnapshot(raw, registry)` walks the full tree, no depth/node budget.
- `mcp-browser/src/adapters/puppeteer/connection.ts:231-247` — real adapter `snapshot()` calls `buildSnapshot([raw], this.refs)`; will need to thread `opts.maxDepth`/`opts.maxNodes` through and return the widened result shape.
- `mcp-browser/src/register.ts:58-64` — `INSTRUCTIONS` says "Phase 1 surface — connection + tabs" while `TOOLS` (register.ts:116-158) lists 40 tools across P1-P5.
- `mcp-browser/src/tools/dom.ts` — the canonical spill idiom to mirror: `writePayload` → branch on `written` → build DTO with optional preview field.
- `mcp-browser/src/lib/payload.ts` — `writePayload`/`PAYLOAD_THRESHOLD_BYTES` (4096) — reused verbatim, not modified.
- `mcp-browser/test/fake-port.ts` — in-memory `FakePort implements BrowserPort`; `snapshot()` returns `{ tree, refs }` (needs widening to `{ tree, refs, nodeCount, truncated }`).
- `mcp-browser/test/snapshot.test.ts`, `test/refs.test.ts`, `test/read-tools.test.ts`, `test/register.test.ts` — existing coverage to extend, not break.
- `skills/browser/SKILL.md`, `skills/browser/references/interaction.md` — checked for literal `{tree,refs}` key assertions; found none (prose only, e.g. "Returns a compact AX tree... every interactive node carries a stable ref id"). Per plan scope, left untouched.

## Current State
All four described defects are present and file:line-verified as summarized in the plan's Context. `dom.ts`/`accessibility.ts` already do this correctly and serve as the idiom to copy. `extract.ts` already calls `writePayload` but drops the inline preview due to a missing DTO field — the one-line-fix defect.

## Gaps
- No `SnapshotOut` DTO exists yet in types.ts (snapshot.ts builds its structuredContent ad hoc).
- `SnapshotInputSchema`/`SnapshotOpts`/`SnapshotResult`/`buildSnapshot` all need widening for `max_depth`/`max_nodes`/`nodeCount`/`truncated`.
- `FakePort.snapshot()` needs to return the widened `SnapshotResult` shape to keep the port contract satisfied at compile time.
- `register.ts` `INSTRUCTIONS` is a local `const`, not exported — needs export (or file-content grep) for a DW-1.5 test to assert against.

## Code Standards
No `docs/code-standards.md` found in the repo. Conventions inferred from existing code: Bun + strict TS, hexagonal layering (tools → BrowserPort → puppeteer adapter), zod schemas as the single input-validation home in `types.ts`, `type` aliases (never `interface`) for structuredContent DTOs, JSDoc block comments at file/function head explaining intent and invariants, `ok()`/`err()`/`runPort()`/`ensureAlive()` as the shared tool-handler seam, no `console.log` in `src/` (log.ts writes to stderr).

## Test Infrastructure
`bun:test` (`describe`/`test`/`expect`/`afterEach`). Tests use `FakePort` (in-memory `BrowserPort`) via `setPort()`/`resetSession()` from `core/session.ts` — no real Chrome anywhere in the unit suite. `structured()` helper reads `r.structuredContent`. Existing tests reference DW-IDs by number in test names/comments (e.g. `test_DW_3_2_dom_full_writes_file`); this phase's new tests follow the same `test_DW_1_x_...` naming convention. `PAYLOAD_THRESHOLD_BYTES` is imported directly in tests to build boundary-sized fixtures.

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-1.1 | browser_snapshot serializes tree through writePayload; large→ tree_path+tree_preview+written:true, tree absent; small→tree inline, written:false; refs+node_count present both ways | COVERED | `test/snapshot.test.ts`: `test_DW_1_1_large_tree_spills_to_tmp`, `test_DW_1_1_small_tree_inlines` |
| DW-1.2 | max_depth/max_nodes accepted; max_nodes below node count clips tree, truncated:true, refs match emitted nodes exactly | COVERED | `test/refs.test.ts`: `test_DW_1_2_max_nodes_clips_and_truncates`, `test_DW_1_2_max_depth_stops_descent` |
| DW-1.3 | evaluate/collect spill result/items to /tmp at/above threshold (path+preview, raw absent), inline below; text summary unchanged | COVERED | `test/read-tools.test.ts`: `test_DW_1_3_evaluate_spills_large_result`, `test_DW_1_3_evaluate_inlines_small_result`, `test_DW_1_3_evaluate_nonserializable_never_leaks_raw_object`, `test_DW_1_3_collect_spills_large_items`, `test_DW_1_3_collect_inlines_small_items` |
| DW-1.4 | extract below threshold returns inlined populated with full JSON; at/above returns path, inlined absent | COVERED | `test/read-tools.test.ts`: `test_DW_1_4_extract_inlined_below_threshold`, `test_DW_1_4_extract_no_inlined_above_threshold` |
| DW-1.5 | INSTRUCTIONS no longer say "Phase 1 surface"; group real tool surface; state /tmp-spill contract once | COVERED | `test/register.test.ts`: `test_DW_1_5_instructions_current_and_grouped` |
| DW-1.6 | tsc --noEmit clean, bun test green, no console.log in src | COVERED | static commands run directly; existing + new suite must pass |

**All items COVERED:** YES

## Design Decisions

**Preview mechanism (snapshot/evaluate/collect):** per plan, the spilled-branch preview is tool-computed (`serialized.slice(0, 512)`), never a second threshold. `writePayload`'s own `inlinedPreview` is used only for `extract` (inline branch, no `inlinePreviewChars` — full JSON since sub-4096-byte content is inherently short).

**Snapshot depth/node caps (`refs.ts: buildSnapshot`):** implemented as a single pre-order pass with a shared mutable budget:
- Depth check: `depth > maxDepth` → prune this node and its entire subtree (no recursion, no ref minted), set `truncated=true`. Root-level raw nodes are depth 1.
- Node-budget check: evaluated *before* recursing into a node's own children — if the shared counter has already reached `maxNodes`, prune this node and its subtree entirely (no recursion, no ref minted), set `truncated=true`. Otherwise increment the counter and proceed.
- This ordering guarantees a ref is *never* minted for a node whose inclusion wasn't already budgeted, so the `tree` ↔ `refs` consistency invariant holds unconditionally — no post-hoc trim-and-reconcile pass is needed, and no registry cleanup for "orphaned" refs is required.
- `nodeCount` is computed by walking the *final* returned tree (independent of the budget mechanism) — it reports what was actually emitted, which may be below `maxNodes` if some visited nodes turned out non-meaningful (structural, no name/value/children/ref) and were dropped after already consuming a budget slot. This is intentional: budget consumption bounds work done, `nodeCount` reports what the caller actually receives.
- Alternative considered and rejected: build the full unbounded tree first, then trim in a second pass to the first N meaningful nodes in document order. Rejected because it requires either disposing "orphaned" registry refs (extra registry API surface) or accepting that refs get minted/left live for nodes never advertised in the output — a correctness smell the single-pass design avoids entirely for the same implementation cost.

**Port seam:** `SnapshotOpts += { maxDepth?, maxNodes? }`, `SnapshotResult += { nodeCount, truncated }` per the plan's pinned contract. The real adapter (`connection.ts`) threads `opts?.maxDepth`/`opts?.maxNodes` into `buildSnapshot`; `FakePort` widened to return `nodeCount`/`truncated` (computed the same way, via a small local node-counting helper) to satisfy the `BrowserPort` interface at compile time.

**INSTRUCTIONS rewrite:** exported the `INSTRUCTIONS` constant from `register.ts` (was file-local) so a unit test can assert on it directly rather than re-parsing the source file. Grouped per the plan's prescribed order (connect/tabs → snapshot+refs → interact → read/spill-to-/tmp → perf/network → storage/capture), stating the /tmp-spill-and-read contract exactly once in the read/extract group.

## Prerequisites
- [x] Required files exist (all in File scope already exist; no new files needed except test additions)
- [x] Dependencies available (Bun, zod, bun:test already in place; no new deps)
- [x] No missing prerequisites

## Recommendation
BUILD. Straightforward mechanical widening of four tool result paths plus one adapter-level algorithm (buildSnapshot depth/node budget) and one INSTRUCTIONS rewrite. No architectural obstacles found; the hexagonal seam (BrowserPort) already anticipates exactly this kind of DTO widening.
