# Plan: mcp-browser token-bounding + skill-eval structured errors

**Created:** 2026-07-02
**Status:** complete
**Complexity:** simple
**Started:** 2026-07-02
**Completed:** 2026-07-02
**Current Phase:** done (2/2)
---
## Context

**Problem:** An agent-ergonomics audit (AXI principles) of the two MCP servers found four
token-leak / correctness defects in `mcp-browser` and one structured-error gap in `skill-eval`.
Three `mcp-browser` read tools bypass the `writePayload` spill-to-`/tmp` discipline that the rest
of the server uses, delivering unbounded page content straight into the model's context — the exact
browser-token blowout AXI's browser-CLI benchmark beat. A fourth defect silently drops data on
small extracts. `skill-eval` returns plain-string errors while its sibling server already ships a
`{code,message,suggestion}` envelope.

Concrete defects (all file:line-verified against the current tree):
1. `browser_snapshot` returns the full a11y tree **inline** with no depth/node/byte cap — the only
   read tool that never spills (`tools/snapshot.ts:33`; builder `adapters/puppeteer/refs.ts:114`
   has no caps).
2. `browser_evaluate` (`tools/evaluate.ts:56`) and `browser_collect` (`tools/collect.ts:45`)
   truncate only the **text** line; the full payload leaks through `structuredContent`.
3. Correctness bug: `browser_extract` below the spill threshold returns count-only and **drops its
   own data** — `writePayload` computes a full `inlinedPreview` but `ExtractOut` (`types.ts:288`)
   has no field to carry it (`tools/extract.ts:62-72`).
4. `mcp-browser` server `INSTRUCTIONS` still say "Phase 1 surface — connection + tabs" while 40
   tools ship (`register.ts:58-64`).
5. `skill-eval` `err()` returns plain text only — no `code`, no `suggestion`, no `structuredContent`
   (`mcp/src/lib/tool.ts:35-37`).

**Success criteria:** No `mcp-browser` read tool can deliver an unbounded payload into context — every
large result spills to `/tmp` via the existing `writePayload` seam (path + preview + size hint), while
small results stay fully inline (no data loss). `skill-eval` failures carry a structured
`{code,suggestion}` envelope. `bunx tsc --noEmit` and `bun test` pass clean in both `mcp-browser/`
and `mcp/`; no `console.log` in `src/`.

## Constraints
- Hexagonal architecture preserved: tool → `BrowserPort` (`SnapshotOpts`/`SnapshotResult`) → adapter
  `buildSnapshot`. No puppeteer types leak into `core/` or `tools/`. Caps thread through the port seam,
  not around it.
- Reuse the existing `writePayload` / `PAYLOAD_THRESHOLD_BYTES` seam in `mcp-browser/src/lib/payload.ts`
  verbatim — do not add a second threshold or a parallel spill path. Copy the `dom.ts` spill idiom.
- `refs` from a snapshot MUST stay inline unconditionally — they are the interaction surface; only the
  `tree` may spill.
- Bun + strict TS, zero new deps. `structuredContent` DTOs stay `type` aliases (not `interface`) per the
  MCP-SDK index-signature gotcha noted in `types.ts`.
- `skill-eval`'s structured-error shape mirrors `mcp-browser`'s `BrowserErrorShape`
  (`{code,message,suggestion}`) rather than inventing a new one.
- Backward-compatible text lines: the human `content[0].text` summary of each tool keeps its current
  shape/prefix so the browser SKILL.md guidance and existing assertions on the text still hold.
---
## Implementation Phases

### Phase 1: mcp-browser output bounding + extract correctness + INSTRUCTIONS
**Skills:** code-foundations:aposd-verifying-correctness (post-change correctness sweep across the four tool result paths), none for the mechanical INSTRUCTIONS edit
**Model:** sonnet
**Gate:** Standard
**Depends on:** none
**File scope:** mcp-browser/src/tools/snapshot.ts, mcp-browser/src/tools/evaluate.ts, mcp-browser/src/tools/collect.ts, mcp-browser/src/tools/extract.ts, mcp-browser/src/types.ts, mcp-browser/src/core/browser-port.ts, mcp-browser/src/adapters/puppeteer/refs.ts, mcp-browser/src/adapters/puppeteer/**, mcp-browser/src/register.ts, mcp-browser/test/**, skills/browser/**

**Goal:** Route every large `mcp-browser` read result through the existing `writePayload` spill seam,
fix the `browser_extract` small-result data-loss bug, and refresh the stale server INSTRUCTIONS.

**Scope:**
- IN:
  - **PREVIEW MECHANISM (applies to snapshot/evaluate/collect):** `writePayload` returns
    `inlinedPreview` ONLY in the inline branch (`written=false`); the written branch returns no preview
    (`payload.ts:32-33,83`). So the spilled-branch preview is **tool-computed**: the tool slices the
    serialized JSON itself (`preview = json.slice(0, PREVIEW_CHARS)`, ~512 chars) and puts it in the DTO.
    This adds no second threshold and no parallel spill path — the write decision still belongs solely to
    `writePayload`; the preview is just a display string derived from the same serialized JSON.
  - **snapshot** — thread optional `max_depth` / `max_nodes` caps through `SnapshotInputSchema` →
    `SnapshotOpts` → `buildSnapshot` (stop descending past `max_depth`; stop emitting nodes past
    `max_nodes`, set `truncated=true`). Serialize the resulting `tree` to JSON, call
    `writePayload(json, {ext:"json"})` (no `inlinePreviewChars` — unused here): below threshold return the
    parsed `tree` inline; at/above threshold return `tree_path` + a tool-sliced `tree_preview` + `bytes` +
    `written:true`. `refs` and `node_count` always inline. Extend `SnapshotResult` with
    `nodeCount`/`truncated`; add a `SnapshotOut` DTO.
  - **evaluate** — serialize `result` to JSON; below threshold keep `result` inline, at/above threshold
    spill to `/tmp` (`writePayload`) and return `result_path` + a tool-sliced `preview` + `bytes` +
    `written`. Keep the existing 256-char text line. Widen `EvaluateOut`.
  - **collect** — serialize `items` to JSON; below threshold keep `items` inline, at/above threshold spill
    and return `items_path` + a tool-sliced `preview` + `bytes` + `written`; `nothing_expandable`/`count`
    always inline. Widen `CollectOut`.
  - **extract** — add an `inlined` field to `ExtractOut` and populate it from `written.inlinedPreview`
    when `written===false` (the full JSON, since sub-threshold content is < 4096 B). The correctness fix.
  - **INSTRUCTIONS** — rewrite the `register.ts` constant to describe the real tool surface grouped
    (connect/tabs → snapshot+refs → interact → read/spill-to-/tmp → perf/network → storage/capture) and
    state the "large reads spill to /tmp; Read the returned path (ideally in a subagent)" contract once.
  - Update `mcp-browser/test/**` unit tests (port fakes) for every changed result shape + new dirty tests.
  - If any `skills/browser/**` reference asserts the literal old `{tree,refs}` snapshot keys, update it;
    otherwise leave prose guidance untouched.
- OUT: no new spill threshold or helper; no change to tools already spilling correctly
  (`dom`, `accessibility`, `screenshot`, `pdf`, `har`, traces); no TOON/format change; `skill-eval` (Phase 2).

**Edge cases:**
- Snapshot tree exactly at `PAYLOAD_THRESHOLD_BYTES` → spills (writePayload uses `>=`).
- `max_nodes`/`max_depth` absent → unlimited (current behavior) with the spill backstop still applied.
- `max_nodes` clips mid-tree → `truncated:true` and the emitted `refs` list matches only the emitted
  nodes (tree↔refs consistency invariant preserved).
- evaluate returns `undefined`/`null` → inline `result:null`, `written:false` (unchanged).
- evaluate non-serializable/cyclic result → CHANGE from today: currently the raw object leaks into
  `structuredContent.result` and would fail JSON serialization at the MCP transport. New flow computes the
  spill decision off the serialized string, so a value that fails `JSON.stringify` inlines the
  `[non-serializable value]` descriptor string as `result` (never the raw object); the text path is
  unchanged. (DW-1.3 asserts this stays safe.)
- collect all-null items (`nothing_expandable`) → typical case is small → inline, explicit empty state
  preserved; a huge all-null array that crosses the threshold spills `items` while `nothing_expandable:true`
  and `count` stay inline.
- extract below threshold → `inlined` present with full data, `path:""`, `written:false`
  (regression guard for the bug); at/above threshold → `inlined` absent, `path` set.

**Produces:** Four bounded tool-result DTOs in `mcp-browser/src/types.ts`:
- `SnapshotOut = { tree?: AxNode[]; tree_path?: string; tree_preview?: string; refs: string[]; node_count: number; bytes: number; written: boolean; truncated: boolean }`
- `EvaluateOut = { result?: unknown; result_path?: string; preview?: string; bytes: number; written: boolean }`
- `CollectOut = { items?: (string|null)[]; items_path?: string; preview?: string; nothing_expandable: boolean; count: number; bytes: number; written: boolean }`
- `ExtractOut = { path: string; bytes: number; written: boolean; count: number; inlined?: string }`
- Port seam widened: `SnapshotOpts += { maxDepth?: number; maxNodes?: number }`, `SnapshotResult += { nodeCount: number; truncated: boolean }`.
**Security-sensitive:** (omitted — output bounding only; no auth/crypto/secrets/deserialization/new untrusted-input parsing)

**Done when:**
- [ ] DW-1.1: `browser_snapshot` serializes the tree and routes it through `writePayload`; a tree ≥ `PAYLOAD_THRESHOLD_BYTES` returns `tree_path` + `tree_preview` + `written:true` with `tree` absent, and a small tree returns `tree` inline with `written:false`. `refs` and `node_count` are present in both cases. (unit test, port fake with a large and a small tree)
- [ ] DW-1.2: `browser_snapshot` accepts `max_depth` and `max_nodes`; supplying `max_nodes` below the node count clips the tree, sets `truncated:true`, and the returned `refs` match exactly the emitted interactive nodes. (unit test on `buildSnapshot`)
- [ ] DW-1.3: `browser_evaluate` and `browser_collect` spill their structured payload (`result` / `items`) to `/tmp` when ≥ threshold (path + preview returned, raw payload absent) and inline it when below; the existing text summary is unchanged. (unit tests, large + small)
- [ ] DW-1.4: `browser_extract` below threshold returns `inlined` populated with the full extracted JSON (not count-only); at/above threshold returns `path` with `inlined` absent. (regression unit test)
- [ ] DW-1.5: `register.ts` INSTRUCTIONS no longer say "Phase 1 surface"; they group the real tool surface and state the /tmp-spill read contract once. (assertion/grep test)
- [ ] DW-1.6: `cd mcp-browser && bunx tsc --noEmit` clean and `bun test` green; no `console.log` in `mcp-browser/src`. (static + suite)

### Phase 2: skill-eval structured errors
**Skills:** code-foundations:aposd-verifying-correctness -- error-handling correctness sweep over the err() envelope and every updated call site
**Model:** sonnet
**Gate:** Standard
**Depends on:** none
**File scope:** mcp/src/lib/tool.ts, mcp/src/tools/**, mcp/src/types.ts, mcp/test/**

**Goal:** Give `skill-eval`'s `err()` an optional `{code,suggestion}` envelope emitted as
`structuredContent`, mirroring `mcp-browser`'s `BrowserErrorShape`, and pass a code + next-step at the
existing failure call sites.

**Scope:**
- IN: extend `err()` in `mcp/src/lib/tool.ts` to accept an optional `{code, suggestion}` and, when
  present, emit `structuredContent: {code, message, suggestion}` alongside the existing text (text stays
  for backward compatibility); define a small `ErrorCode` string-literal union in `mcp/src/types.ts`;
  update the failure call sites across `mcp/src/tools/**` (e.g. skill-path-missing, unknown-eval-id,
  query-generation-failed) to pass a code + a concrete suggestion. Update `mcp/test/**`.
- OUT: no change to `ok()`; no change to success-path payloads; no new dependency; no server-instruction
  rewrite (skill-eval INSTRUCTIONS are already current).

**Edge cases:**
- `err(text)` called with no envelope → unchanged behavior (plain text, no `structuredContent`), so
  untouched call sites keep compiling and passing.
- `suggestion` is required by the type whenever `code` is given (presence enforced), and non-empty by
  convention mirroring `BrowserErrorShape`'s doc contract — the type enforces presence, not non-emptiness.

**Produces:** `skill-eval` error results carry `structuredContent: {code, message, suggestion}` when a
code is supplied; the `err(text, {code, suggestion})` signature is the shared contract for all failure sites.
**Security-sensitive:** (omitted — error-shape refactor; `err()` already whitelists echoed text via `friendlyMessage`)

**Done when:**
- [ ] DW-2.1: `err(text, {code, suggestion})` returns `isError:true` with `structuredContent:{code,message,suggestion}`; `err(text)` alone returns the current plain-text result with no `structuredContent`. (unit test both forms)
- [ ] DW-2.2: At least the three named failure paths (skill-path-missing, unknown-eval-id, query-generation-failed) pass a structured code + suggestion. (unit/assertion test)
- [ ] DW-2.3: `cd mcp && bunx tsc --noEmit` clean and `bun test` green; no `console.log` in `mcp/src`. (static + suite)
---
## Test Coverage
**Level:** 100% of changed result/error paths (each new/widened DTO branch — inline vs spilled — and each new error envelope has a unit test; at least one dirty/boundary test per tool).

## Test Plan
- [ ] snapshot: large tree → spilled (path+preview, `tree` absent); small tree → inline; `refs`+`node_count` present both ways. (DW-1.1)
- [ ] snapshot caps: `max_nodes` clips → `truncated:true`, refs↔tree consistent; `max_depth` stops descent. (DW-1.2)
- [ ] evaluate: large result spills, small inlines, text line unchanged; `undefined`/non-serializable still safe. (DW-1.3)
- [ ] collect: large `items` spills, small inlines; `nothing_expandable` empty state still inline+explicit. (DW-1.3)
- [ ] boundary: a snapshot/evaluate/collect payload sized exactly at `PAYLOAD_THRESHOLD_BYTES` spills (writePayload uses `bytes < threshold` → inline, so `>=` writes). (DW-1.1/DW-1.3)
- [ ] extract (dirty/regression): below-threshold result returns full `inlined` data; above-threshold returns `path`, `inlined` absent. (DW-1.4)
- [ ] INSTRUCTIONS: grep asserts no "Phase 1 surface" and presence of the /tmp-spill contract line. (DW-1.5)
- [ ] skill-eval err: envelope form emits `structuredContent`; plain form does not. (DW-2.1)
- [ ] skill-eval call sites: the three named failures carry code+suggestion. (DW-2.2)
- [ ] both servers: `bunx tsc --noEmit` + `bun test` green; no `console.log` in `src`. (DW-1.6, DW-2.3)
---
## Notes
- Follow the spill idiom from `tools/dom.ts:38-49` (writePayload → branch on `written` → build DTO with
  optional preview field) so all read tools share one shape of result construction. One deliberate
  difference: `dom` shows a preview only in the INLINE branch (it has nothing large to preview once
  spilled); snapshot/evaluate/collect additionally want a SPILLED-branch preview, which the tool slices
  itself (`json.slice(0, ~512)`) because `writePayload` supplies `inlinedPreview` only when `written=false`.
- `writePayload` already throws (never silently drops) on a failed write; the tool barricade converts
  that to an err() — no new error handling needed for the spill path.
- Phases 1 and 2 touch disjoint file trees (`mcp-browser/**` vs `mcp/**`) and have no data dependency,
  so build may run their BUILD agents in parallel.
- Follow-up (out of scope, noted by the audit): success-side `next:` disclosure lines on `mcp-browser`
  tools, and pagination/slice re-reads of large `/tmp` payloads. Deferred.
---
## Execution Log

### Phase 1: mcp-browser output bounding + extract correctness + INSTRUCTIONS (Gate: Standard)
- [x] BUILD: Discovery + design + implementation (stub → implement → validate) complete
- [x] REVIEW: Verification passed (haiku, single-sample)
- [x] Committed
Commit: 52b915e
Summary: snapshot/evaluate/collect large results now spill to /tmp via the existing writePayload seam (path + tool-sliced ~512-char preview + byte hint) with small results fully inline; snapshot gained optional max_depth/max_nodes caps (truncated flag, refs↔tree consistency preserved, refs always inline); browser_extract's sub-threshold data-loss bug fixed via a new `inlined` field; register.ts INSTRUCTIONS refreshed from the stale "Phase 1 surface" to the real grouped 40-tool surface. 246 mcp-browser tests pass, tsc clean, no console.log in src.

### Phase 2: skill-eval structured errors (Gate: Standard)
- [x] BUILD: Discovery + design + implementation (stub → implement → validate) complete
- [x] REVIEW: Verification passed (haiku, single-sample). NOTE: the first review dispatch resolved its cwd against the unmodified main checkout instead of the phase worktree and wrongly returned FAIL; it was re-dispatched with an absolute-path + commit-sha guard and PASSED against the correct worktree (f33eb92). The code never failed a correctly-scoped review — no code change resulted from the FAIL.
- [x] Committed
Commit: 3b4d637
Summary: err() gained an optional {code,suggestion} envelope emitted as structuredContent (mirroring mcp-browser's BrowserErrorShape); an ErrorCode union was added to types.ts; failure call sites across the skill-eval tools now carry a structured code + concrete suggestion, while err(text) alone is unchanged. 130 mcp tests pass, tsc clean, no console.log in src.

### Build notes
- Phases 1 and 2 ran as a single parallel wave (disjoint file trees mcp-browser/** vs mcp/**), each in its own phase worktree, integrated by cherry-pick in plan order with no conflicts — confirming the File scope declarations were truly disjoint.
- Wave integration (both suites in the build worktree): mcp-browser 246 pass / 0 fail, mcp 130 pass / 0 fail; both `bunx tsc --noEmit` clean.
