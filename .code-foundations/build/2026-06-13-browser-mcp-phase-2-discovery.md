# Discovery + Design: Phase 2 - Snapshot+refs interaction core

## Files Found

Phase 1 shipped the full hexagonal skeleton I extend (all under `mcp-browser/`):

- `src/core/browser-port.ts` — `BrowserPort` (8 connection/tab methods), `ConnectOptions`, `ConnectionInfo`, `TabInfo`, opaque `PageHandle {readonly tabId}`. EXTEND here.
- `src/core/errors.ts` — `BrowserError extends Error {code,message,suggestion}` + `toShape()/toText()`, `isBrowserError()`, `BrowserErrorCode` union (10 codes). EXTEND the union.
- `src/core/session.ts` — `getPort()/setPort()/resetSession()` single long-lived port accessor.
- `src/adapters/puppeteer/connection.ts` — `PuppeteerConnectionManager implements BrowserPort`; the ONLY file importing puppeteer-core. Holds `browser`, `activeTabId`, `idByPage` WeakMap. EXTEND with snapshot/interact/navigate/wait/scroll/resolveTarget.
- `src/lib/tool.ts` — `ok()/err()/errFromBrowserError()`, `ToolModule<Shape>`, `friendlyMessage()`.
- `src/lib/payload.ts` — `writePayload(name,data,ext,write?)→{path,bytes}` stub + `PAYLOAD_THRESHOLD_BYTES`. screenshot writes against this; signature frozen.
- `src/lib/log.ts` — `log()` stderr `[browser]`.
- `src/register.ts` — `defineTool` bridge, `TOOLS[]`, `buildErrorBoundaryHandler` (single error boundary), `startServer`. Register new tools in `TOOLS`.
- `src/types.ts` — all zod input schemas + structuredContent DTOs.
- `test/fake-port.ts` — `FakePort implements BrowserPort`. EXTEND to satisfy the widened interface.
- `test/static.test.ts` — greps `src/core` + `src/tools` for puppeteer imports / `Puppeteer.` namespace (comments stripped first), greps for `console.log`, runs `tsc --noEmit`. The hexagonal invariant guard.

## Current State

A working P1 server: connect + tabs tools over a persistent puppeteer-core connection, structured-error barricade, fake-port unit tests + gated live tests, static gates green. The seam pattern is established: tools call `getPort()`, check liveness, delegate, catch `BrowserError` → `errFromBrowserError`. Puppeteer types are confined to `connection.ts`.

## Gaps (P1 → P2)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | `BrowserPort` has no interaction/snapshot/navigation methods | Extend interface with `snapshot/resolveHandle/navigate/wait/scroll/interact` keyed on the active `PageHandle` |
| 2 | No `Target` type or Strategy resolver | New `src/core/targeting.ts` — `Target` union + `ResolvedHandle` opaque token + resolver contract |
| 3 | No ref registry | New `src/adapters/puppeteer/refs.ts` — adapter-internal `ref → ElementHandle`, invalidated on page change |
| 4 | No interaction implementations | New `src/adapters/puppeteer/interactions.ts` — Strategy resolvers + action executors |
| 5 | `BrowserErrorCode` lacks P2 codes | Add `stale_ref`, `unknown_ref`, `ambiguous_match`, `no_match`, `coord_out_of_viewport`, `wait_timeout`, `page_unstable`, `blocked_url`, `invalid_url`, `nav_failed`, `interaction_failed` |
| 6 | 12 new tools | `snapshot, click, type, hover, select, fill-form, press-key, drag, navigate, wait, scroll, screenshot` |

## Code Standards

No `docs/code-standards.md` in the worktree (checked). Project conventions come from `CLAUDE.md` (root + worktree): Bun + strict TS, `tsc --noEmit` + `bun test` clean, no `console.log` in `src/`, all zod in `types.ts`, `ToolModule` shape with `satisfies`, `defineTool` bridge, single error boundary, structured `{code,message,suggestion}` errors via `BrowserError`, errors-must-be-fixed policy. Followed throughout.

## Test Infrastructure

`bun test` with `bun:test` (`describe/test/expect`, `afterEach(resetSession)`). Unit tests drive tools through a `FakePort` set via `setPort`. Live tests gated behind `RUN_LIVE_EVALS=1` (`const d = LIVE ? describe : describe.skip`) and import the real `PuppeteerConnectionManager`. Static suite enforces the hexagonal boundary. `structured(r)` helper reads `structuredContent`. Pattern: assert `r.isError`, `structuredContent.code`, `.suggestion`.

## Assumption Verification (resolved before design)

**Assumption:** "puppeteer-core's a11y snapshot exposes node identity stable enough to back stable refs" (Confidence: Medium).

**Verified against puppeteer-core 24.43.1 `lib/types.d.ts`:**
- `page.accessibility.snapshot(options?: SnapshotOptions): Promise<SerializedAXNode | null>` exists; `SnapshotOptions {interestingOnly?, includeIframes?}`.
- **`SerializedAXNode.elementHandle(): Promise<ElementHandle | null>`** — each AX node yields its live puppeteer `ElementHandle` directly.

**Resolution — BETTER than the planned fallback.** I do not need the CDP `DOM.backendNodeId` path at all. The ref registry maps `ref → ElementHandle` captured at snapshot time by walking the tree and calling `.elementHandle()` on each interactive node. ElementHandles are page-context live objects; after a navigation/page change they are disposed/detached — exactly the "refs go stale on page change" semantics the contract requires. Staleness is detected by probing the handle (e.g. `handle.evaluate(() => true)` / `isConnected`) and converting a disposed/detached handle into `StaleRefError`. This is entirely adapter-internal; the core seam is unaffected — **no UPDATE_PLAN.**

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-2.1 | `snapshot` returns a compact a11y tree where every interactive node carries a stable `ref`; returned ref list matches the tree | COVERED | `snapshot.test.ts`: `snapshot assigns a ref to every interactive node`, `ref list exactly matches the refs embedded in the tree`, `non-interactive nodes carry no ref`, `tree is compact (drops empty containers)` (fake adapter emits a canned AX tree) |
| DW-2.2 | `resolveTarget` resolves ref (primary), selector, coordinate targets through one Strategy interface; all interaction tools route through it (no per-tool ladder) | COVERED | `targeting.test.ts`: `resolves a ref target`, `resolves a selector target`, `resolves a coordinate target`, `dispatch picks resolver by Target shape (no if-ladder)`; `interaction-routing.test.ts`: every interaction tool (`click/type/hover/select/fill-form/press-key/drag/scroll`) calls `port.interact` with the raw `Target` and never inspects `ref/selector/x` itself (spy FakePort records the Target it received) |
| DW-2.3 | A ref used after a page change returns `stale_ref` with a re-snapshot suggestion; an unknown ref returns a distinct `unknown_ref` | COVERED | `targeting.test.ts`: `a ref invalidated by a page change → stale_ref err with re-snapshot suggestion`, `a ref never issued → unknown_ref (distinct code)`; tool-level `click.test.ts`: `stale ref surfaces stale_ref via err() (not thrown)` |
| DW-2.4 | A selector matching 0 or >1 elements returns an explicit err (no silent act-on-first) | COVERED | `targeting.test.ts`: `selector matching 0 elements → no_match err`, `selector matching >1 elements → ambiguous_match err`, `selector with nth disambiguates >1`; tool-level assertion via `click.test.ts` |
| DW-2.5 | `navigate` rejects malformed / non-http(s) / `file://` / `chrome://` URLs at the barricade unless explicitly allowed | COVERED | `navigate.test.ts`: `rejects file:// (blocked_url)`, `rejects chrome:// (blocked_url)`, `rejects malformed url (invalid_url)`, `rejects javascript: / data: (blocked_url)`, `accepts http/https`, `allow_internal=true permits file://`; all reject at barricade before `port.navigate` is called (spy confirms not called) |
| DW-2.6 | `wait` (navigation/selector/idle) returns a typed `timeout` err naming the strategy on timeout; `scroll`, `press_key` (modifier bitmask), `drag` act via refs with selector/coord fallback | COVERED | `wait.test.ts`: `navigation timeout → wait_timeout naming "navigation"`, `selector timeout → wait_timeout naming "selector"`, `idle timeout → wait_timeout naming "idle"`, `success returns ok`; `press-key.test.ts`: `modifier bitmask decodes to modifier list` + routes via Target; `scroll.test.ts` / `drag.test.ts`: route via Target (ref primary, selector/coord fallback), drag stale source/target → stale_ref |

**All items COVERED:** YES (6 DW-IDs in prompt = 6 rows here)

## Design Decisions

### Design: BrowserPort extension + targeting Strategy

Per `aposd-designing-deep-modules` (design-it-twice) and `gof-design-patterns` (Strategy is the plan-mandated pattern for targeting).

#### Approaches Considered (port surface)

1. **One method per action** — `click(t)`, `type(t,text)`, `hover(t)`, `select(t,vals)`, `pressKey(t,key,mods)`, `drag(from,to)`, `scroll(t,delta)`. Wide port (7+ interaction methods), each tool maps 1:1.
2. **Single `interact(action, target, opts)`** — one verb-dispatched method; action is a discriminated `InteractAction`; opts carry text/keys/values/coords. Narrow port (1 interaction method).
3. **Hybrid** — `interact()` for element actions; `navigate/wait/scroll/snapshot` stay first-class (they are not element-targeted in the same way).

#### Comparison

| Criterion | A (method-per-action) | B (single interact) | C (hybrid) |
|-----------|----------------------|---------------------|------------|
| Interface simplicity | Low (7+ methods) | High (1 method) | High (1 interact + 4 lifecycle) |
| Information hiding | Waiting/actionability duplicated per method | Auto-wait lives in one place | Auto-wait in one place |
| Caller ease of use | Tool calls a named method | Tool builds an action+target | Tool builds action+target; lifecycle named |
| Strategy fit (DW-2.2) | Resolver still needed but ladder risk per method | Single chokepoint | Single chokepoint |
| Plan contract match | — | partial | **exact** (`interact(action,t,opts)` + `snapshot/resolveTarget`/lifecycle) |

#### Choice: C (Hybrid) — matches the plan's `Produces` contract exactly

The plan pins: `snapshot()`, `resolveTarget(t)`, `interact(action, t, opts?)`. Lifecycle ops (`navigate/wait/scroll`) that are NOT element-target actions stay as named methods (scroll can target an element OR the page, so it takes an optional Target). This is the deepest port: ALL element actuation funnels through `interact()`, so auto-wait/actionability is written once inside the adapter (deep module — caller passes a Target, module hides waiting). Sacrifice: `interact`'s `opts` is a small union; acceptable, it is the single place the variety lives.

**Seam additions to `BrowserPort` (no puppeteer types):**
```
snapshot(opts?: SnapshotOpts): Promise<SnapshotResult>;   // { tree: AxNode[]; refs: string[] }
resolveTarget(t: Target): Promise<ResolvedTarget>;          // throws stale_ref|unknown_ref|ambiguous_match|no_match
interact(action: InteractAction, t: Target, opts?: InteractOpts): Promise<void>;
navigate(url: string): Promise<NavResult>;                  // url already barricade-validated by the tool
wait(strategy: WaitStrategy, opts?: WaitOpts): Promise<void>; // throws wait_timeout naming strategy
scroll(opts: ScrollOpts): Promise<void>;                    // target?: Target (page if absent)
```
- `AxNode` = compact core DTO (`role, name?, value?, ref?, level?, checked?, ..., children?`) — NOT puppeteer's `SerializedAXNode`. Adapter maps at the boundary.
- `Target` lives in `core/targeting.ts` (the contract type), exactly as the plan's `Produces` block. `resolveTarget` is the single chokepoint P3/P5 reuse.
- `ResolvedTarget` is an opaque token (like `PageHandle`) — `{ kind: "ref"|"selector"|"coords"; token: unknown }` or simpler an adapter-owned brand; core/tools never read a puppeteer object off it. In practice tools never call `resolveTarget` directly — they pass `Target` into `interact`, which resolves internally. `resolveTarget` is exposed on the port for P3/P5 element-scoped reads (the plan's "single chokepoint").

#### Design: targeting Strategy (gof Strategy)

GoF Strategy: ref/selector/coords are interchangeable resolvers behind one signature. The dispatch picks the resolver by the `Target` shape — a **single** discriminator in one place (`resolveByStrategy`), never an `if (ref) … else if (selector)` ladder leaking into every tool. Tools are ladder-free: they hand the raw `Target` to `interact`.

- `RefResolver` — looks `ref` up in the registry; missing → `unknown_ref`; present-but-disposed/detached → `stale_ref` (re-snapshot suggestion).
- `SelectorResolver` — `page.$$(selector)` (+ optional `matchText`/`visible`/`pierce`); 0 → `no_match`, >1 without `nth` → `ambiguous_match`, `nth` selects the nth.
- `CoordResolver` — validates `{x,y}` inside the layout viewport; outside → `coord_out_of_viewport`.

The resolver map is keyed off the `Target` discriminant; adding a resolver is a map entry, not a new branch in every tool (encapsulate-what-varies).

#### Design: ref registry (adapter-internal)

`src/adapters/puppeteer/refs.ts` — a `RefRegistry` holding `Map<string, ElementHandle>` plus an epoch counter. On each `snapshot()`: bump epoch, dispose+clear the previous handles, walk the `SerializedAXNode` tree, and for every *interactive* node (role in an interactive-role set, or has an actionable property) call `node.elementHandle()`, mint `ref = "r{epoch}-{seq}"`, store the handle, and stamp `ref` onto the compact `AxNode`. Page change (navigation, `framenavigated`, or detected detachment) invalidates: a registry whose epoch < current, or a handle that probes as detached, yields `stale_ref`. Internal shape (ElementHandle, epoch) never leaves the adapter — refs are opaque strings.

This is the deep-module payoff: the whole snapshot→ref→resolve→act lifecycle and all waiting is hidden behind `snapshot/interact`; tools see only `Target` in, `AxNode[]`/`void` out.

### Design: navigate barricade (cc-defensive-programming)

`navigate` accepts an **untrusted URL** (external input, SSRF-adjacent → SM-2). Validation at the **tool barricade** (in `navigate.ts`, before the port call), allowlist-based (RF-6):
- Parse with `new URL()`; unparseable → `invalid_url`.
- Allowed schemes: `http`, `https` only. Anything else (`file:`, `chrome:`, `chrome-extension:`, `javascript:`, `data:`, `about:`, `view-source:`) → `blocked_url` — **unless** the explicit `allow_internal: true` opt-in is set, which additionally permits `file:`/`about:` (never `javascript:`, which is code-exec — stays blocked even with the opt-in).
- Error envelope `{code,message,suggestion}` like every other failure. Spy confirms the port is never reached on a blocked URL (barricade, not defense-in-depth-only).

This follows the existing `connect.ts` barricade pattern (validate → return `BrowserError | Opts` → `errFromBrowserError`).

### Error-code additions (core/errors.ts)

`stale_ref`, `unknown_ref`, `ambiguous_match`, `no_match`, `coord_out_of_viewport`, `wait_timeout`, `page_unstable`, `invalid_url`, `blocked_url`, `nav_failed`, `interaction_failed`. Each carries a concrete suggestion (e.g. `stale_ref` → "re-run browser_snapshot to refresh refs").

### Depth Check

- Interface methods added: 6 (`snapshot, resolveTarget, interact, navigate, wait, scroll`) — all element actuation collapses into `interact`.
- Hidden details: ElementHandle registry, epoch/staleness probing, AX-tree walk + compaction, auto-wait/actionability, resolver Strategy map, CDP fallback (not needed), viewport bounds check.
- Common case complexity: simple — caller does `snapshot()` then `interact("click", {ref})`.

## Prerequisites
- [x] Phase 1 seam present and green (verified: files read, tests pass)
- [x] puppeteer-core a11y `elementHandle()` available (verified in types.d.ts)
- [x] No code-standards.md (conventions from CLAUDE.md applied)
- [x] FakePort extensible to the widened interface

## Recommendation
BUILD. The seam contract holds exactly as the plan pins it (`Target`, `snapshot`, `resolveTarget`, `interact`). The Medium-confidence assumption resolved in favor of the simpler `elementHandle()` path — adapter-internal only, no UPDATE_PLAN.
