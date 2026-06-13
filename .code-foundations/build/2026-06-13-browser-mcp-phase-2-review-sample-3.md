# Review: Phase 2 — Snapshot / Targeting / Interaction / Navigation

## Executed Results (Step 0)

| Command | Result |
|---------|--------|
| `bun install` | Clean (no changes) |
| `bunx tsc --noEmit` | Exit 0 — no type errors |
| `bun test` (unit, no live) | **90 pass, 12 skip (live-gated), 0 fail** — 299 expect() calls across 17 files |
| `RUN_LIVE_EVALS=1 bun test` | Not run — Chrome not available in this environment; live suite noted as unverified-here |

---

## Requirement Fulfillment

### DW-2.1
PREMISE:  "`snapshot` returns a compact a11y tree where every interactive node carries a stable `ref`; the returned ref list matches the tree."
EVIDENCE: `src/adapters/puppeteer/refs.ts:114-160` (`buildSnapshot`); `src/core/browser-port.ts:96-99` (`SnapshotResult`); `test/refs.test.ts:43-95`; `test/snapshot.test.ts:39-76`
TRACE:    `buildSnapshot([raw], registry)` → walks `RawAxNode[]`, calls `registry.newEpoch()` to invalidate prior refs, mints `r{epoch}-{seq}` per node whose `elementHandle()` is non-null and whose role is in `INTERACTIVE_ROLES`, appends each minted ref to the `refs[]` accumulator; emits `{ tree: AxNode[], refs: string[] }` where the flat `refs` array contains exactly the `ref` strings embedded in tree nodes. Compact: structural nodes with no ref/name/value/children are pruned (line 149-151).
VERDICT:  PASS — `refs.test.ts` "the returned ref list matches the refs embedded in the tree" (bun test pass #55-68); "stamps a ref on every interactive node and none on others" (pass); `snapshot.test.ts` confirms at the tool level.

---

### DW-2.2
PREMISE:  "`resolveTarget` resolves ref (primary), selector, and coordinate targets through one Strategy interface; all interaction tools route through it (no per-tool targeting ladder)."
EVIDENCE: `src/core/targeting.ts:29-33` (`targetKind` — single discriminant); `src/adapters/puppeteer/interactions.ts:37-46` (`resolveOnPage` — single switch, three arms); `src/adapters/puppeteer/connection.ts:200-210` (`resolveTarget` and `interact` both call `resolveOnPage`); `src/types.ts:111-133` (`toTarget` — single fold from flat MCP fields to `Target` union); `src/tools/click.ts:25-39`, `src/tools/drag.ts:32-46`, `src/tools/scroll.ts:23-40`, `src/tools/press-key.ts:23-36` — all call `port.interact(action, target, opts)` with no per-tool ladder; `test/interaction-routing.test.ts:32-180`
TRACE:    click tool: `toTarget(args)` → `{ ref: "r1-1" }` → `port.interact("click", target, opts)` → `resolveOnPage(page, refs, target)` → `switch(targetKind(t)) { case "ref": … case "selector": … case "coords": … }`. No if/else ladder in any tool or in the port methods; the single switch lives exclusively in `resolveOnPage`.
VERDICT:  PASS — `interaction-routing.test.ts` "the same resolveTarget signature handles all three (no per-target method)" plus per-action routing tests all pass.

---

### DW-2.3
PREMISE:  "A ref used after a page change returns `stale_ref` with a re-snapshot suggestion; an unknown ref returns a distinct `unknown_ref`."
EVIDENCE: `src/adapters/puppeteer/interactions.ts:48-68` (`resolveRef`); `src/adapters/puppeteer/refs.ts:66-106` (`RefRegistry` — `isLive` vs `wasIssued` epoch distinction); `test/targeting.test.ts:78-98`; `test/interaction-routing.test.ts:131-138`, `143-157`
TRACE:    After `newEpoch()`: `registry.live.clear()` removes the old ref handle; `registry.issued` retains it. `resolveRef("r1-1")`: `wasIssued("r1-1")` → true → check `get("r1-1")` → null → throw `BrowserError("stale_ref", …, "re-run browser_snapshot …")`. Independently, `resolveRef("never-issued")`: `wasIssued` → false → throw `BrowserError("unknown_ref", …)`. The two error codes are distinct strings.
VERDICT:  PASS — `targeting.test.ts` stale_ref + unknown_ref tests pass; `interaction-routing.test.ts` confirms at the tool layer (stale click → `stale_ref` err, unknown click → `unknown_ref` err).

---

### DW-2.4
PREMISE:  "A selector matching 0 or >1 elements returns an explicit err (no silent act-on-first)."
EVIDENCE: `src/adapters/puppeteer/interactions.ts:92-107` (`resolveSelector`); `test/targeting.test.ts:100-123`; `test/interaction-routing.test.ts:156-167`
TRACE:    `resolveSelector(page, { selector: ".missing" })`: `page.$$("#.missing")` → `[]`; `handles.length === 0` → throw `BrowserError("no_match", …)`. `resolveSelector(page, { selector: ".row" })` with 3 matches and no `nth`: `handles.length > 1 && sel.nth === undefined` → throw `BrowserError("ambiguous_match", …)`. With `nth: 1` present: `index = 1`, `chosen = handles[1]` → returns `{ kind: "selector", handle: chosen }` — disambiguated successfully.
VERDICT:  PASS — both 0-match and >1-without-nth tests pass; nth disambiguation test also passes.

---

### DW-2.5
PREMISE:  "`navigate` rejects malformed / non-http(s) / `file://` / `chrome://` URLs at the barricade unless explicitly allowed."
EVIDENCE: `src/tools/navigate.ts:27-50` (`barricade` function — allowlist-based); `test/navigate.test.ts:24-88`
TRACE:    `barricade("chrome://settings", false)`: `new URL("chrome://settings")` parses ok; `scheme = "chrome:"` — not `http:` or `https:`, not in `ALWAYS_BLOCKED`, not in `INTERNAL_SCHEMES` → returns `BrowserError("blocked_url", …)`. Returned before `port.navigate` is ever called (`port.navigated` remains `[]`). `barricade("ht!tp://not a url", false)`: `new URL(…)` throws → `BrowserError("invalid_url", …)`. `barricade("javascript:alert(1)", true)`: scheme in `ALWAYS_BLOCKED` → blocked regardless of `allowInternal`. `barricade("file:///tmp/page.html", true)`: scheme in `INTERNAL_SCHEMES` and `allowInternal` → allowed.
VERDICT:  PASS — all six navigate barricade tests pass; port is never reached for blocked URLs.

---

### DW-2.6
PREMISE:  "`wait` (navigation/selector/idle) returns a typed `timeout` err naming the strategy on timeout; `scroll`, `press_key` (modifier bitmask), `drag` act via refs with selector/coord fallback."
EVIDENCE: `src/adapters/puppeteer/connection.ts:232-253` (`wait` — throws `BrowserError("wait_timeout", "${strategy} did not complete within ${timeout}ms", …)`); `src/core/targeting.ts:60-66` (`decodeModifiers`); `src/adapters/puppeteer/interactions.ts:198-207` (`pressOn` — calls `decodeModifiers(opts?.modifiers ?? 0)`); `src/adapters/puppeteer/interactions.ts:209-220` (`dragTo` — resolves both endpoints through `resolveOnPage`); `test/wait.test.ts:23-64`; `test/interaction-routing.test.ts:107-138`; `test/targeting.test.ts:25-35`
TRACE (wait): `port.wait("navigation", { timeoutMs: 100 })` in FakePort → `waitTimeoutFor === "navigation"` → throw `BrowserError("wait_timeout", "navigation did not complete within 100ms", …)` → `runPort` catches it → `errFromBrowserError` → `{ code: "wait_timeout", message: "navigation did not complete within 100ms" }`. The word "navigation" appears in the message.
TRACE (press_key bitmask): `opts.modifiers = 8` → `decodeModifiers(8)` → `(8 & Modifier.Shift) !== 0` → `["Shift"]` → mapped to `"Shift"` key name → `keyboard.down("Shift")`, `keyboard.press(key)`, `keyboard.up("Shift")`.
TRACE (drag stale): `drag.handler({ ref: "r1-1", to_ref: "r1-2" })` where `r1-2` is in `everIssued` but not in `liveRefs` → `port.interact("drag", source, { to: { ref: "r1-2" } })` → FakePort `interact` resolves both → `resolveTarget({ ref: "r1-2" })` → `stale_ref` → structured err propagates.
VERDICT:  PASS — all three wait strategy timeout tests name their strategy; press_key modifier bitmask test passes; drag stale-endpoint test passes.

---

**All requirements met:** YES

---

## Test-DW Coverage

| DW item | Automated test(s) | Coverage |
|---------|-------------------|----------|
| DW-2.1 | `refs.test.ts` (buildSnapshot — 5 tests), `snapshot.test.ts` (tool layer — 4 tests) | Full |
| DW-2.2 | `targeting.test.ts` (resolveTarget single interface), `interaction-routing.test.ts` (all action tools) | Full |
| DW-2.3 | `targeting.test.ts` (stale_ref, unknown_ref), `refs.test.ts` (epoch invalidation), `interaction-routing.test.ts` (tool-level stale/unknown) | Full |
| DW-2.4 | `targeting.test.ts` (0 match, >1 without nth, nth disambiguates), `interaction-routing.test.ts` (ambiguous/no_match at tool level) | Full |
| DW-2.5 | `navigate.test.ts` (7 tests — http/https accept; file, chrome, malformed, javascript, data reject; allow_internal; dead connection) | Full |
| DW-2.6 | `wait.test.ts` (3 strategy timeouts + satisfied + no-selector err), `interaction-routing.test.ts` (press_key bitmask, drag both endpoints, drag stale), `targeting.test.ts` (decodeModifiers) | Full |

- [x] All DW items have corresponding automated tests that ran in Step 0
- [x] Test coverage matches the stated "100% everything" level for unit tests
- [x] Live suite (`interaction.live.test.ts`) is gated behind `RUN_LIVE_EVALS=1` and skipped here (12 skipped tests) — unverified in this run due to Chrome unavailability

---

## Dead Code

None found in the reviewed files. All imports are used. No unreachable code after early returns. No `console.log` in `src/` (only `stderr` via `log()`). No commented-out blocks.

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Concurrency | N/A | No shared mutable state across concurrent requests; `RefRegistry` is per-`PuppeteerConnectionManager` instance; no async races introduced |
| Error Handling | PASS | Every `BrowserError` path returns a structured `err()` envelope to the MCP client; `runPort` centralizes the catch; non-`BrowserError` exceptions rethrow to the error boundary in `register.ts`; no empty catch blocks (the one catch in `RefRegistry.newEpoch` on line 79 is documented and swallows only an already-disposed handle's dispose call, which is correct); `wait` properly re-throws `BrowserError` before wrapping other errors |
| Resources | PASS | `RefRegistry.newEpoch` disposes prior `ElementHandle`s in a try/catch loop before clearing the live set — handles that are already gone don't leak; `disconnect()` closes/disconnects in a `finally` block that clears state |
| Boundaries | PASS | `resolveSelector` guards `handles[index]` explicitly (lines 103-107 throw `no_match` on out-of-range nth); `resolveCoords` guards against negative and >viewport dimensions; `decodeModifiers(0)` returns `[]` (tested) |
| Security | PASS — SM-2 | URL barricade in `navigate.ts` uses an allowlist (not denylist): only `http:` and `https:` pass by default; `javascript:` and `vbscript:` are in `ALWAYS_BLOCKED` and never permitted regardless of `allow_internal`; `file:` and `about:` require explicit opt-in; rejection happens before the port is reached (line 53-54 of `navigate.ts`); 7 navigate tests confirm pre-port rejection |

---

## Notes (non-blocking)

1. **`data:` scheme behavior with `allow_internal=true`**: The barricade blocks `data:` by default (`blocked_url`) but does not add it to `INTERNAL_SCHEMES`, so `allow_internal=true` still blocks it. The test at line 60-69 of `navigate.test.ts` only tests `allow_internal: false`. This is the intended design (the code comment says "also permits file:/about:") but the allowed set diverges from what the zod description says (`"Opt in to file:// / about: schemes"`). No DW item covers this; noting for clarity, not a FAIL.

2. **`resolveCoords` when `page.viewport()` returns null** (lines 111-117 of `interactions.ts`): when the puppeteer viewport is null, `width` and `height` become `+Infinity`, so any finite coordinate passes. This is a permissive fallback — could silently accept out-of-viewport coords in viewportless headless contexts. Not a DW-listed edge case; non-blocking.

3. **Live suite unverified**: `interaction.live.test.ts` tests the stale-ref-after-real-navigation path end-to-end through the puppeteer adapter. Those 12 tests are skipped in this run. The unit coverage for this path is complete (FakePort correctly models the epoch distinction), but the live path remains unverified here.

4. **`selectAllAndDelete` (interactions.ts:184-189)** uses hard-coded `"Control"` for select-all rather than Meta on macOS. This affects the `fill` action (clear-first path) on macOS. Not listed in DW items or edge cases; non-blocking.

---

**Verdict: PASS**
