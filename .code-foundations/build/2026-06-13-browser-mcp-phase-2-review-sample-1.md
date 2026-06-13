# Review: Phase 2 - Snapshot / Targeting / Interaction / Navigation

## Executed Results (Step 0)

| Command | Result |
|---------|--------|
| `bun install` | Clean (171 packages, no changes) |
| `bunx tsc --noEmit` | 0 errors, exit 0 |
| `bun test` | 90 pass, 12 skip (live-gated), 0 fail — 299 expects across 17 files |

Live tests (gated behind `RUN_LIVE_EVALS=1`) were not run; their coverage is noted as **unverified-here** below where relevant.

---

## Requirement Fulfillment

### DW-2.1

PREMISE:  `snapshot` returns a compact a11y tree where every interactive node carries a stable `ref`; the returned ref list matches the tree.

EVIDENCE: `src/adapters/puppeteer/refs.ts:114-159` (`buildSnapshot`); `test/refs.test.ts:43-95`; `test/snapshot.test.ts:39-59`

TRACE:    `buildSnapshot(raw, registry)` → walks the raw AX tree, calls `isInteractiveRole(node.role)` per node, fetches `node.elementHandle()`, mints `r${epoch}-${seq}` via `registry.add(handle, seq)`, pushes the ref into both `out.ref` and the flat `refs[]` array; non-interactive nodes get no ref; pruning drops empty structural containers. The returned `{ tree, refs }` is asserted consistent in `refs.test.ts:55-67` (sorted equality of embedded vs flat refs, length 3) and `snapshot.test.ts:53-60` (same assertion at the tool level).

VERDICT:  PASS

---

### DW-2.2

PREMISE:  `resolveTarget` resolves ref (primary), selector, and coordinate targets through one Strategy interface; all interaction tools route through it (no per-tool targeting ladder).

EVIDENCE: `src/core/targeting.ts:28-33` (`targetKind` — single discriminant); `src/adapters/puppeteer/interactions.ts:37-46` (`resolveOnPage` — single switch); `src/adapters/puppeteer/connection.ts:200-218` (`resolveTarget`, `interact`, `fillForm` — all route through `resolveOnPage`); `src/tools/click.ts`, `type.ts`, `hover.ts`, `select.ts`, `press-key.ts`, `drag.ts`, `fill-form.ts` — all call `port.interact(action, target, opts)` with no inline ref/selector/coord branching; `test/interaction-routing.test.ts:32-105`

TRACE:    Tool receives flat args → `toTarget(args)` folds to a `Target` union → `port.interact(action, target, opts)` → adapter calls `resolveOnPage(page, registry, t)` → single `switch(targetKind(t))` dispatches to one of three private resolvers → `executeAction` acts on the result. No tool has its own ref/selector/coord ladder. Confirmed by `interaction-routing.test.ts` which asserts that click/type/hover/select/press_key/drag all record raw targets in `port.interactions` with no tool-side branching.

VERDICT:  PASS

---

### DW-2.3

PREMISE:  A ref used after a page change returns `stale_ref` with a re-snapshot suggestion; an unknown ref returns a distinct `unknown_ref`.

EVIDENCE: `src/adapters/puppeteer/interactions.ts:48-67` (`resolveRef`); `src/adapters/puppeteer/refs.ts:66-106` (`RefRegistry` — `wasIssued` vs `isLive`); `test/targeting.test.ts:78-98`; `test/interaction-routing.test.ts:130-155`

TRACE:    Stale path: `registry.wasIssued(ref)` true + `registry.isLive(ref)` false (epoch bumped by new snapshot) → `BrowserError("stale_ref", …, "re-run browser_snapshot…")`. Unknown path: `registry.wasIssued(ref)` false → `BrowserError("unknown_ref", …)`. Both are distinct codes. Also a third stale check: even a live-registry ref whose DOM element is detached triggers `stale_ref` via `el.evaluate(node => node.isConnected)`. Tests verify both codes and that `suggestion` matches `/snapshot/i` for stale_ref.

VERDICT:  PASS

---

### DW-2.4

PREMISE:  A selector matching 0 or >1 elements returns an explicit err (no silent act-on-first).

EVIDENCE: `src/adapters/puppeteer/interactions.ts:92-107` (`resolveSelector`); `test/targeting.test.ts:100-122`; `test/interaction-routing.test.ts:156-171`

TRACE:    0 matches: `handles.length === 0` → `BrowserError("no_match", …)`. >1 matches without `nth`: `handles.length > 1 && sel.nth === undefined` → `BrowserError("ambiguous_match", …, "add nth to pick one…")`. With `nth` provided: `handles[index]` is returned (no error). Tests confirm no_match, ambiguous_match, and that nth disambiguates (all pass in Step 0).

VERDICT:  PASS

---

### DW-2.5

PREMISE:  `navigate` rejects malformed / non-http(s) / `file://` / `chrome://` URLs at the barricade unless explicitly allowed.

EVIDENCE: `src/tools/navigate.ts:32-49` (`barricade` function); `test/navigate.test.ts:24-87`

TRACE:    URL input arrives → `barricade(args.url, args.allow_internal)` is called BEFORE `getPort()` / `ensureAlive()` / `port.navigate()`. `new URL(rawUrl)` throws → `invalid_url`. `http:` or `https:` → pass-through. `javascript:` or `vbscript:` → `blocked_url` always. `file:` or `about:` with `allowInternal=false` → `blocked_url`. `chrome:` → falls through to the final `blocked_url` return. Tests verify: http/https accepted; file:// blocked (port.navigated stays []); chrome:// blocked; malformed URL → invalid_url; javascript:/data: → blocked_url; allow_internal=true permits file:// but still blocks javascript:. All 6 tests pass.

VERDICT:  PASS

---

### DW-2.6

PREMISE:  `wait` (navigation/selector/idle) returns a typed `timeout` err naming the strategy on timeout; `scroll`, `press_key` (modifier bitmask), `drag` act via refs with selector/coord fallback.

EVIDENCE: `src/adapters/puppeteer/connection.ts:232-253` (`wait` — catches and throws `BrowserError("wait_timeout", "${strategy} did not complete…")`); `src/adapters/puppeteer/interactions.ts:198-207` (`pressOn` — `decodeModifiers` + `MODIFIER_KEY` map); `src/adapters/puppeteer/interactions.ts:209-219` (`dragTo` — calls `resolveOnPage` for the drop target); `src/tools/scroll.ts` (routes through `port.scroll`); `test/wait.test.ts`; `test/interaction-routing.test.ts:107-138`

TRACE (wait): `wait.handler({strategy:"navigation", timeout_ms:100})` → `port.wait("navigation", {timeoutMs:100})` → FakePort throws `BrowserError("wait_timeout", "navigation did not complete…")` → `runPort` catches it → `errFromBrowserError` → `err()` result with `code:"wait_timeout"` and `message` containing "navigation". Same for selector and idle. All three strategy-naming tests pass.

TRACE (press_key bitmask): `pressKey.handler({ref:"r1-1", key:"Enter", modifiers:8})` → `port.interact("press_key", {ref:"r1-1"}, {key:"Enter", modifiers:8})` → adapter: `decodeModifiers(8)` → `["Shift"]` → `MODIFIER_KEY["Shift"]` → `"Shift"` → `page.keyboard.down("Shift")` / `press("Enter")` / `up("Shift")`. FakePort test records `opts.modifiers === 8`.

TRACE (drag stale ref): `drag.handler({ref:"r1-1", to_ref:"r1-2"})` with r1-2 in `everIssued` but not in `liveRefs` → `resolveTarget({ref:"r1-2"})` inside `interact` → `stale_ref` → `runPort` → `err({code:"stale_ref"})`.

TRACE (scroll): `scroll.handler({ref:"r1-1"})` → `toTarget` → `{ref:"r1-1"}` → `port.scroll({target:{ref:"r1-1"}})` → FakePort calls `resolveTarget(target)` → records in `port.scrolls`. Test confirms `scrolls[0].target === {ref:"r1-1"}`.

VERDICT:  PASS

---

**All requirements met:** YES

---

## Test-DW Coverage

| DW Item | Test(s) | Status |
|---------|---------|--------|
| DW-2.1 | `refs.test.ts` (buildSnapshot suite, 5 tests); `snapshot.test.ts` (4 tests) | COVERED |
| DW-2.2 | `targeting.test.ts` (resolveTarget Strategy, 4 tests); `interaction-routing.test.ts` (all interaction tools, 11 tests) | COVERED |
| DW-2.3 | `targeting.test.ts` (stale_ref/unknown_ref, 2 tests); `interaction-routing.test.ts` (stale click, unknown click, drag stale target, 3 tests) | COVERED |
| DW-2.4 | `targeting.test.ts` (0/&gt;1 match, 3 tests); `interaction-routing.test.ts` (ambiguous, no_match, 2 tests) | COVERED |
| DW-2.5 | `navigate.test.ts` (7 tests covering http/https accept, file/chrome/javascript/data block, malformed, allow_internal) | COVERED |
| DW-2.6 | `wait.test.ts` (5 tests — 3 strategy-naming timeouts, 1 success, 1 missing-selector); `interaction-routing.test.ts` (press_key bitmask, drag routing, drag stale ref) | COVERED |

Test coverage matches the stated "100% everything (unit with a fake BrowserPort)" level for non-live paths. The 12 skipped tests are `RUN_LIVE_EVALS=1`-gated and not verified here.

---

## Edge Cases

| Edge Case | Handling | Evidence |
|-----------|---------|----------|
| stale ref after page change → `stale_ref` with re-snapshot suggestion | `resolveRef` checks `registry.isLive` after `wasIssued`; also DOM-disconnect path | `interactions.ts:48-67`; `targeting.test.ts:79-88` |
| ref not in registry → distinct `unknown_ref` | `!registry.wasIssued(ref)` branch emits `unknown_ref` | `interactions.ts:49-51`; `targeting.test.ts:91-97` |
| selector matches 0 or >1 → explicit err | `no_match` / `ambiguous_match` with `nth` escape hatch | `interactions.ts:92-107`; `targeting.test.ts:100-122` |
| coordinate outside viewport → err | `resolveCoords` checks against `page.viewport()` bounds | `interactions.ts:110-117`; `targeting.test.ts:125-132` |
| `wait` timeout → typed err naming the strategy | `wait_timeout` message includes strategy name | `connection.ts:252`; `wait.test.ts:26-51` |
| navigate malformed/non-http(s)/file/chrome → barricade reject BEFORE adapter | `barricade()` called before `getPort()` | `navigate.ts:53-54`; `navigate.test.ts` all port.navigated==[] assertions |
| snapshot mid-navigation → `page_unstable` | `snapshot()` catches puppeteer failure + null tree → `page_unstable` | `connection.ts:187-196`; `snapshot.test.ts:62-68` |
| drag with stale source/target ref → stale-ref path | `dragTo` calls `resolveOnPage(…, opts.to)` which routes through the same Strategy | `interactions.ts:209-219`; `interaction-routing.test.ts:131-137` |

All edge cases listed in the prompt are handled. No unhandled cases found.

---

## Dead Code

None found. All imports are used; no commented-out code blocks; no unreachable branches. The `pierce` field on `Target` is accepted in `toTarget` but the adapter's `resolveSelector` does not use it (not listed in the plan's pinned contract and not a DW requirement) — this is a non-blocking note, not dead code.

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Concurrency | N/A | Single-tab serial execution; no shared mutable state between concurrent handlers (RefRegistry is per-instance, sessions are per-server-process) |
| Error Handling | PASS | All async operations wrapped in try/catch; BrowserErrors propagate cleanly; non-BrowserErrors rethrow to the error boundary in `register.ts`; no empty catch blocks (the one in `refs.ts:78-80` is documented: "a detached handle may already be disposed"); `runPort` is the single conversion point |
| Resources | PASS | `RefRegistry.newEpoch()` disposes prior ElementHandles before clearing; dispose errors are silently caught (documented, correct for detached handles); no file handles leaked in screenshot (writePayload handles cleanup) |
| Boundaries | PASS | `resolveSelector`: `handles[index]` is checked for undefined after nth indexing (`interactions.ts:103-105`); `decodeModifiers(0)` returns [] (tested); `viewport()` returning null is guarded with `?? Number.POSITIVE_INFINITY` (permissive fallback — see Notes) |
| Security | PASS | SSRF-adjacent URL validation is allowlist-based (`http:` / `https:` only), checked before the port; `javascript:` is in `ALWAYS_BLOCKED` and cannot be unlocked; `vbscript:` also blocked; no shell command construction; external input (URL, selectors) does not reach shell execution paths |

---

## Notes (non-blocking)

1. **`viewport()` null → permissive fallback** (`interactions.ts:113`): when `page.viewport()` returns null (headless=new mode / Chrome DevTools Protocol without a viewport set), the code substitutes `+Infinity` for both width and height, making `resolveCoords` accept any coordinate. This means the `coord_out_of_viewport` guard is silently disabled in that configuration. Not a DW requirement, but worth flagging: a future viewport-enforcement requirement would need to handle the null case explicitly.

2. **`pierce` field accepted but not forwarded** (`types.ts:98`, `interactions.ts:70-107`): `toTarget` includes `pierce` in the `Target` union but `resolveSelector` in the adapter never passes it to `page.$$(selector)` (Puppeteer's `$$` does not accept a pierce option directly — it would need a different API). The field is inert. No test covers pierce behavior. Not a DW-2 requirement, so not a FAIL.

3. **Live tests unverified** (`test/interaction.live.test.ts`, `test/connection.live.test.ts`): 12 tests skipped. Their behavior at the real Puppeteer/Chrome layer is not verified by this review.

4. **`wait` selector strategy: tool-level guard vs adapter-level guard** (`tools/wait.ts:23-24` and `connection.ts:239-242`): both layers validate `strategy=selector` requires a selector. The tool returns `err({code:"wait_timeout"})` for the missing-selector case, but `wait_timeout` is slightly misleading (the real issue is a missing required argument, not a timeout). This is a minor semantic inconsistency in the error code but does not violate any DW requirement.

---

## Issues

None blocking.

**Verdict: PASS**
