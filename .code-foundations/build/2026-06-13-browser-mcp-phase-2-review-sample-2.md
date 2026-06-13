# Review: Phase 2 — snapshot / targeting / interaction / navigation / wait / scroll

## Executed Results (Step 0)

| Command | Result |
|---------|--------|
| `bun install` | clean (no changes, 171 packages) |
| `bunx tsc --noEmit` | exit 0 — zero errors, zero warnings |
| `bun test` | 90 pass, 12 skip, 0 fail (102 tests across 17 files, 299 expect() calls) |
| `RUN_LIVE_EVALS=1 bun test` | not run — Chrome unavailable in this environment; live tests gated and noted as unverified-here |

---

## Requirement Fulfillment

### DW-2.1
PREMISE: `snapshot` returns a compact a11y tree where every interactive node carries a stable `ref`; the returned ref list matches the tree.
EVIDENCE:
- `src/adapters/puppeteer/refs.ts:114–159` — `buildSnapshot` walks the raw AX tree, calls `registry.newEpoch()`, stamps a `ref` (format `r{epoch}-{seq}`) on each node whose role is in `INTERACTIVE_ROLES`, and collects the same refs into the returned `refs` array.
- `src/adapters/puppeteer/connection.ts:182–198` — `snapshot()` calls `buildSnapshot([raw], this.refs)` and returns the result.
- `src/tools/snapshot.ts:32–34` — tool returns `{ tree, refs }` as structuredContent.
- `test/refs.test.ts:55–68` — "the returned ref list exactly matches the refs embedded in the tree" verifies `[...refs].sort()` equals `[...embedded].sort()` and `refs.length === 3`.
- `test/snapshot.test.ts:39–51` — "every interactive node carries a ref; non-interactive nodes do not" confirms interactive kinds have refs, `text` role has none.
- Both tests ran and passed in Step 0.
TRACE: raw AX tree with button/textbox/link/text nodes → `buildSnapshot` → interactive nodes get `ref: "r1-1"` etc., `text` node gets none → `{ tree: [...], refs: ["r1-1","r1-2","r1-3"] }` → returned `refs` matches embedded refs exactly.
VERDICT: PASS

---

### DW-2.2
PREMISE: `resolveTarget` resolves ref (primary), selector, and coordinate targets through one Strategy interface; all interaction tools route through it (no per-tool targeting ladder).
EVIDENCE:
- `src/core/targeting.ts:29–33` — `targetKind()` is the single discriminant.
- `src/adapters/puppeteer/interactions.ts:37–46` — `resolveOnPage` has a single `switch(targetKind(t))` with three cases; no ladder in port methods or tools.
- `src/adapters/puppeteer/connection.ts:207–218` — `interact()` calls `resolveOnPage` then `executeAction`; `fillForm` does the same per field.
- All interaction tools (click, type, hover, select, press-key, drag, fill-form, scroll) call `port.interact(action, target, opts)` or `port.fillForm(fields)` — none contain `if (ref) … else if (selector)` logic.
- `test/interaction-routing.test.ts:35–105` — asserts that click/type/hover/select/scroll/fill_form all route through `port.interact` with the raw target unchanged; `port.interactions[0].target` equals the input target for ref, selector, and coord cases.
- `test/targeting.test.ts:67–76` — "the same resolveTarget signature handles all three (no per-target method)" confirms one call resolves all three kinds.
TRACE: `click.handler({ ref: "r1-1" })` → `toTarget` folds flat fields → `port.interact("click", { ref: "r1-1" }, opts)` → `resolveOnPage` → single switch → ref resolver → ResolvedEl.
VERDICT: PASS

---

### DW-2.3
PREMISE: A ref used after a page change returns `stale_ref` with a re-snapshot suggestion; an unknown ref returns a distinct `unknown_ref`.
EVIDENCE:
- `src/adapters/puppeteer/interactions.ts:48–67` — `resolveRef`: if `!registry.wasIssued(ref)` → throws `unknown_ref`; if `registry.get(ref)` is null (live set cleared by new epoch) → throws `stale_ref` with suggestion "re-run browser_snapshot to refresh refs"; if element `!connected` (DOM detached without re-snapshot) → throws `stale_ref` same suggestion.
- `test/targeting.test.ts:78–98` — "a ref invalidated by a page change → stale_ref with a re-snapshot suggestion" confirms `e.code === "stale_ref"` and `e.suggestion` matches `/snapshot/i`; "a ref never issued → unknown_ref, a code distinct from stale_ref" confirms `e.code === "unknown_ref"`.
- `test/refs.test.ts:79–87` — "a new snapshot bumps the epoch and invalidates prior refs (stale, not unknown)" confirms `isLive(oldRef) === false` and `wasIssued(oldRef) === true`.
- `test/interaction-routing.test.ts:141–155` — click on stale ref → `stale_ref` err; click on unknown ref → `unknown_ref` err; both surface as structured err, not a throw.
TRACE: epoch 1 snapshot mints "r1-1"; new epoch called (page change); `resolveRef("r1-1")`: `wasIssued("r1-1") === true` (passes first gate), `get("r1-1") === null` (live set cleared) → throws `BrowserError("stale_ref", ..., "re-run browser_snapshot to refresh refs")`.
VERDICT: PASS

---

### DW-2.4
PREMISE: A selector matching 0 or >1 elements returns an explicit err (no silent act-on-first).
EVIDENCE:
- `src/adapters/puppeteer/interactions.ts:92–107` — after optional matchText/visible filtering: `handles.length === 0` → throws `no_match`; `handles.length > 1 && sel.nth === undefined` → throws `ambiguous_match`; only if exactly 1 or nth is provided does it proceed.
- `test/targeting.test.ts:100–122` — "0 matches → no_match"; ">1 matches without nth → ambiguous_match"; ">1 WITH nth disambiguates".
- `test/interaction-routing.test.ts:158–168` — click on `.row` (4 matches) → `ambiguous_match`; click on `.gone` (0 matches) → `no_match`.
TRACE: `resolveSelector(page, { selector: ".row" })` with `selectorCounts.get(".row") === 4`, `nth === undefined` → `handles.length > 1 && nth === undefined` → throws `BrowserError("ambiguous_match", "selector matched 4 elements: .row", ...)`.
VERDICT: PASS

---

### DW-2.5
PREMISE: `navigate` rejects malformed / non-http(s) / `file://` / `chrome://` URLs at the barricade unless explicitly allowed.
EVIDENCE:
- `src/tools/navigate.ts:32–50` — `barricade()` function: tries `new URL(rawUrl)` — on failure returns `invalid_url`; checks `scheme === "http:" || "https:"` → allow; checks `ALWAYS_BLOCKED` (`javascript:`, `vbscript:`) → returns `blocked_url`; checks `INTERNAL_SCHEMES` (`file:`, `about:`) → allowed only when `allowInternal === true`; all other schemes (including `chrome:`) → returns `blocked_url`.
- `src/tools/navigate.ts:52–54` — `handler` calls `barricade` first, before `getPort()` or `ensureAlive()` — the rejection is pre-port.
- `test/navigate.test.ts:36–43` — file:// → `blocked_url`, port not reached (`navigated === []`).
- `test/navigate.test.ts:44–50` — chrome:// → `blocked_url`, port not reached.
- `test/navigate.test.ts:51–57` — malformed URL → `invalid_url`, port not reached.
- `test/navigate.test.ts:59–69` — javascript: and data: → `blocked_url`, port not reached.
- `test/navigate.test.ts:70–79` — `allow_internal=true` permits file:// but still blocks javascript:.
TRACE: `navigate.handler({ url: "chrome://settings", allow_internal: false })` → `barricade("chrome://settings", false)` → `new URL(...)` succeeds, `scheme === "chrome:"`, not http/https, not ALWAYS_BLOCKED, not INTERNAL_SCHEMES → returns `BrowserError("blocked_url", ...)` → `isBrowserError(validated)` true → `errFromBrowserError(...)` returned before port is touched.
VERDICT: PASS

---

### DW-2.6
PREMISE: `wait` (navigation/selector/idle) returns a typed `timeout` err naming the strategy on timeout; `scroll`, `press_key` (modifier bitmask), `drag` act via refs with selector/coord fallback.
EVIDENCE:
- **wait timeout naming strategy**: `src/adapters/puppeteer/connection.ts:252` — throws `BrowserError("wait_timeout", `${strategy} did not complete within ${timeout}ms`, ...)` — the strategy name is embedded in the message. `test/wait.test.ts:26–51` — navigation/selector/idle timeouts each return `wait_timeout` with `message` matching the strategy name pattern.
- **press_key modifier bitmask**: `src/core/targeting.ts:56–66` — `Modifier` const (Alt=1, Ctrl=2, Meta=4, Shift=8); `decodeModifiers` reads the bitmask. `src/adapters/puppeteer/interactions.ts:198–207` — `pressOn` calls `decodeModifiers(opts?.modifiers ?? 0)`. `src/tools/press-key.ts:31–33` — passes `{ key, modifiers }` unchanged to `port.interact("press_key", target, ...)`. `test/targeting.test.ts:25–35` — bitmask decode verified. `test/interaction-routing.test.ts:110–116` — press_key routes with key + modifier mask.
- **drag via refs with strategy fallback**: `src/tools/drag.ts:33–45` — calls `port.interact("drag", source, { to })`. `src/adapters/puppeteer/interactions.ts:209–220` — `dragTo` calls `resolveOnPage` for both source and dest (honoring the Strategy). `test/interaction-routing.test.ts:122–137` — drag routes both endpoints; stale target ref → `stale_ref` err.
- **scroll via refs**: `src/tools/scroll.ts:24–38` — calls `port.scroll({ target, dx, dy })`; `src/adapters/puppeteer/connection.ts:256–275` — `scroll` calls `resolveOnPage(page, this.refs, opts.target)` when a target is present. `test/interaction-routing.test.ts:80–91` — scroll with ref routes through resolveTarget; scroll without target scrolls page.
TRACE (wait timeout): `wait.handler({ strategy: "navigation", timeout_ms: 100 })` → `port.wait("navigation", { timeoutMs: 100 })` → puppeteer `waitForNavigation` times out → catch block → throws `BrowserError("wait_timeout", "navigation did not complete within 100ms", ...)` → `runPort` catches → `errFromBrowserError` → `isError: true, structuredContent.code: "wait_timeout", message includes "navigation"`.
VERDICT: PASS

---

## Test-DW Coverage

| DW Item | Test file(s) | Coverage |
|---------|-------------|---------|
| DW-2.1 | `test/refs.test.ts`, `test/snapshot.test.ts` | Full automated — ref stamping, list matching, epoch invalidation, page_unstable |
| DW-2.2 | `test/targeting.test.ts`, `test/interaction-routing.test.ts` | Full automated — all 3 resolvers, all interaction tools routed |
| DW-2.3 | `test/targeting.test.ts`, `test/refs.test.ts`, `test/interaction-routing.test.ts` | Full automated — stale vs unknown, both via FakePort and tool level |
| DW-2.4 | `test/targeting.test.ts`, `test/interaction-routing.test.ts` | Full automated — 0 match, >1 match, nth disambiguator |
| DW-2.5 | `test/navigate.test.ts` | Full automated — http(s), file://, chrome://, malformed, javascript:, data:, allow_internal |
| DW-2.6 | `test/wait.test.ts`, `test/targeting.test.ts`, `test/interaction-routing.test.ts` | Full automated — all 3 wait strategies timeout, bitmask decode, drag/scroll/press_key routing |

All DW items have automated tests that ran and passed in Step 0. Coverage level matches the stated "100% everything (unit with a fake BrowserPort)" for the non-live suite.

Live tests (`test/interaction.live.test.ts`, `test/connection.live.test.ts`) are gated behind `RUN_LIVE_EVALS=1` — not run here due to unavailable Chrome; noted as unverified-here per the instructions.

---

## Dead Code

None found. No unreachable code after early returns, no unused imports, no debug `console.log` in `src/` (only in `test/` via `log.test.ts`).

Minor: The `err` import in `src/tools/wait.ts:8` is used on line 24 for the selector-without-selector validation case — not dead.

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Concurrency | N/A | Single-process, single-browser, sequential tool calls. No shared mutable state between concurrent requests; the `RefRegistry` is accessed only during a single `snapshot()` call (no parallel snapshot possible through the port interface). |
| Error Handling | PASS | All BrowserErrors thrown by the adapter are caught by `runPort` and converted to structured `err()` results. The barricade in `navigate` rejects before the port is touched. The `wait` timeout catch re-throws BrowserError or wraps non-BrowserError into `wait_timeout`. Empty `catch {}` in `refs.ts:79` is documented ("a detached handle may already be disposed — nothing to recover") — justified disposal guard, not a swallowed failure. No RF-11/RF-12 violations found. |
| Resources | PASS | `RefRegistry.newEpoch()` disposes prior ElementHandles on each snapshot, preventing handle accumulation. `disconnect()` in the adapter cleans up browser state. |
| Boundaries | PASS | `resolveCoords` in `interactions.ts:110–117` checks `c.x < 0 || c.y < 0 || c.x > width || c.y > height`; `resolveSelector` checks both `length === 0` and `length > 1` before proceeding; `nth` bounds are checked (`handles[index]` guarded). `test/targeting.test.ts:125–131` exercises coord out-of-viewport. |
| Security | PASS | URL barricade in `navigate.ts` is allowlist-based (RF-6 compliant): http/https explicitly pass, everything else is blocked unless specifically opt-in. `javascript:` and `vbscript:` are in `ALWAYS_BLOCKED` — code-execution schemes never allowed regardless of `allow_internal`. SM-2 (SSRF) addressed per the design intent. The barricade fires **before** `getPort()` is called, confirmed by `port.navigated === []` in the blocking test cases. |

---

## Edge Cases (from prompt list)

| Edge Case | Handled | Evidence |
|-----------|---------|---------|
| stale ref after page change → `stale_ref` with re-snapshot suggestion | YES | `refs.ts:72–85` newEpoch clears live set; `interactions.ts:52–55` checks `registry.get(ref) === null`; suggestion text "re-run browser_snapshot to refresh refs"; tested `test/targeting.test.ts:79–88` |
| ref not in registry → distinct `unknown_ref` | YES | `interactions.ts:49–51` `!registry.wasIssued(ref)` → `unknown_ref`; tested `test/targeting.test.ts:91–97` |
| selector matches 0 or >1 → explicit err, not act-on-first | YES | `interactions.ts:92–100`; tested `test/targeting.test.ts:100–115` |
| coordinate outside viewport → err | YES | `interactions.ts:110–116`; tested `test/targeting.test.ts:125–131` |
| `wait` timeout → typed err naming the strategy | YES | `connection.ts:252`; tested `test/wait.test.ts:26–51` (all 3 strategies) |
| navigate to malformed/non-http(s)/`file://`/`chrome://` → barricade reject before adapter | YES | `navigate.ts:32–54`; `port.navigated === []` in all blocking cases; tested `test/navigate.test.ts:36–79` |
| snapshot mid-navigation → stable-document wait or `page_unstable` | YES | `connection.ts:187–196` catches the puppeteer exception and re-throws `page_unstable`; null raw tree also → `page_unstable`; tested `test/snapshot.test.ts:62–67` |
| drag with stale source/target ref → stale-ref path | YES | `interactions.ts:213` calls `resolveOnPage` for dest target; `fake-port.ts:181` resolves both endpoints; tested `test/interaction-routing.test.ts:131–137` |

All prompt-listed edge cases are handled.

---

## Notes (non-blocking)

- `resolveCoords` treats `c.x === width` or `c.y === height` (exactly at the boundary) as valid (`c.x > width`). A point at exactly `(1280, 720)` on a `1280×720` viewport passes. This is a common inclusive-upper-bound choice for viewports and is not listed as an edge case, so it is a note, not a FAIL.
- `wait` for `selector` strategy: if `opts.selector` is missing the adapter throws `BrowserError("wait_timeout", "selector strategy requires a selector", ...)`. The tool also validates this before calling the port (`wait.ts:23–25`). The tool-level guard returns `err(…, { code: "wait_timeout" })` — not the structured BrowserError shape (no `message`/`suggestion` fields). This is a minor inconsistency in the structured response shape compared to the port-level error envelope; harmless but slightly inconsistent.
- The `pierce` field is accepted by `TargetInputFields` and stored in the `Target` when folded by `toTarget`, but `resolveSelector` in `interactions.ts` does not act on it (no `pierce` option passed to puppeteer `$$`). This is not a stated DW requirement and is not tested, so it is a non-blocking note.

---

**All requirements met: YES**

**Verdict: PASS**
