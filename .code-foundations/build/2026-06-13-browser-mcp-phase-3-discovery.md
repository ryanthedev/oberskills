# Discovery + Design: Phase 3 — Read / extract + parity

## Files Found

- `mcp-browser/src/lib/payload.ts` — P1 stub: `writePayload(name, data, ext, write?)` — always writes to /tmp, returns `{path, bytes}`. P3 signature change: `(data, opts:{ext;inlinePreviewChars?})` → also returns `written:boolean` + `inlinedPreview?`.
- `mcp-browser/src/core/browser-port.ts` — P1+P2 port. P3 must add: `readDom`, `readAccessibility`, `extract`, `collect`, `evaluate`, `dismiss`, `readForm` methods.
- `mcp-browser/src/adapters/puppeteer/connection.ts` — P2 implementation of BrowserPort; P3 extends it.
- `mcp-browser/src/adapters/puppeteer/interactions.ts` — P2 targeting + action executors.
- `mcp-browser/src/tools/screenshot.ts` — P2 consumer of writePayload: `writePayload("screenshot", png, "png")`. Needs signature update to `(png, {ext:"png"})`.
- `mcp-browser/test/payload.test.ts` — P1 payload tests: `writePayload("seam-test", "hello", "txt")` and `writePayload("inject", "abc", "txt", fn)` — need updating.
- `mcp-browser/test/screenshot.test.ts` — no direct writePayload call (routes through tool), stays green after signature change.

## Current State

P1 + P2 complete. BrowserPort covers connect/tabs/snapshot/interact/navigate/wait/scroll/screenshot. `writePayload` stub always writes to /tmp regardless of size. The P1 stub signature is `(name, data, ext, write?)` — the plan's P3 contract uses `(data, opts)`. Three callers to reconcile:
1. `screenshot.ts` — `writePayload("screenshot", png, "png")` → becomes `writePayload(png, {ext:"png"})`
2. `payload.test.ts` — `writePayload("seam-test", "hello", "txt")` → `writePayload("hello", {ext:"txt"})`; `writePayload("inject", "abc", "txt", fn)` → `writePayload("abc", {ext:"txt"}, fn)`
3. All new P3 read tools use the new signature.

## Gaps

| Gap | Detail |
|-----|--------|
| `writePayload` signature mismatch | P1 stub = `(name, data, ext, write?)`. Plan P3 contract = `(data, opts:{ext;inlinePreviewChars?})`. Must reconcile. New `WrittenPayload` adds `written:boolean` + `inlinedPreview?`. |
| dom-helpers.ts missing | New file needed: `src/adapters/puppeteer/dom-helpers.ts` — QUERY_SELECTOR_DEEP_JS, QUERY_SELECTOR_ALL_DEEP_JS, TEXT_CONTENT_DEEP_JS, FIND_DIALOG_JS, COLLECT_DIALOG_SCORING_JS as typed string constants. |
| BrowserPort missing read methods | `readDom`, `readAccessibility`, `extract`, `collect`, `evaluate`, `dismiss`, `readForm` not yet in interface or implementation. |
| 7 new tool files | dom.ts, accessibility.ts, extract.ts, collect.ts, evaluate.ts, dismiss.ts, form.ts |
| New BrowserError codes | `evaluate_failed`, `dialog_dismissed` (success sentinel), `no_dialog`, `read_failed` |
| `types.ts` new schemas | Input schemas + output DTOs for all 7 new tools. |
| register.ts needs new tools | 7 new imports + TOOLS array additions. |
| FakePort needs new methods | P3 BrowserPort methods stubbed on FakePort for test use. |

## Code Standards

From CLAUDE.md and mcp/ conventions:
- No `console.log` in `src/` (stdout is MCP transport; use `log()` from `lib/log.ts`)
- Bun + strict TypeScript; `bunx tsc --noEmit` must pass clean
- Puppeteer types must NOT appear in `src/core/` or `src/tools/`
- `satisfies ToolModule<typeof inputShape>` on every tool module
- All zod schemas + output DTOs centralized in `types.ts`
- Tool result: always `ok()` or `err()` or `errFromBrowserError()`, never throws to client
- Functional cohesion: one operation per routine (CC APPLIER pattern)
- ≤7 parameters per function (use param object for P3 tools near the limit)
- `writePayload` injectable write fn (default `writeFile`) — dirty test injects rejecting fn

## Test Infrastructure

Bun test (`bun test`). Pattern: unit tests use FakePort (no real Chrome); live tests gated behind `RUN_LIVE_EVALS=1`. Static suite: console.log check + puppeteer-in-core/tools check + tsc. Existing test files provide the pattern to follow.

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-3.1 | `writePayload` returns inline below threshold, writes to /tmp at/above; boundary trio tested; failed write returns err | COVERED | `test_DW_3_1_below_threshold_inlines`, `test_DW_3_1_at_threshold_writes`, `test_DW_3_1_above_threshold_writes`, `test_DW_3_1_write_failure_returns_err` |
| DW-3.2 | `dom` (full + `--selector`) and `accessibility` write to file; empty selector → err | COVERED | `test_DW_3_2_dom_full_writes_file`, `test_DW_3_2_dom_selector_writes_file`, `test_DW_3_2_dom_empty_selector_err`, `test_DW_3_2_accessibility_writes_file` |
| DW-3.3 | `extract` and `collect` work; collect with nothing to expand reports "no expandable content" | COVERED | `test_DW_3_3_extract_structured`, `test_DW_3_3_collect_expand_read`, `test_DW_3_3_collect_no_diff_reports_no_expandable` |
| DW-3.4 | `evaluate` injects shadow-DOM helpers once; page-side throw → structured err; non-serializable handled | COVERED | `test_DW_3_4_evaluate_helpers_injected`, `test_DW_3_4_evaluate_page_throw_structured_err`, `test_DW_3_4_evaluate_nonserializable_handled` |
| DW-3.5 | `dismiss` (dialog-scoring heuristic) dismisses dialog; "nothing to dismiss" when none present; `form` read works | COVERED | `test_DW_3_5_dismiss_with_dialog`, `test_DW_3_5_dismiss_nothing_present`, `test_DW_3_5_form_read_works` |
| DW-3.6 | `writePayload` serves dom/accessibility/extract/collect; P2 screenshot unaffected by signature reconciliation; element-scoped reads reuse `resolveTarget` | COVERED | `test_DW_3_6_dom_routes_through_writePayload`, `test_DW_3_6_screenshot_still_works`, `test_DW_3_6_dom_selector_reuses_resolveTarget` |

**All items COVERED:** YES

## Design Decisions

### 1. writePayload signature reconciliation

Chosen: `(data, opts: {ext; inlinePreviewChars?}, write?)` — the plan's P3 form. No `name` param (timestamp + ext uniquely identifies the file; the internal name is implementation detail). Returns `{path: string; bytes: number; inlinedPreview?: string; written: boolean}`.

`written:false` only when `bytes < PAYLOAD_THRESHOLD_BYTES` AND data was fully inlined as string (not written to disk). When `written:true`, path is the `/tmp` file.

The three callers (screenshot.ts, payload.test.ts, any existing imports) are updated in the same pass.

### 2. dom-helpers.ts — injected JS as typed string constants

All injected JS lives in `src/adapters/puppeteer/dom-helpers.ts` as `export const QUERY_SELECTOR_DEEP_JS: string` etc. This is the ONLY place these strings live (RP-4: "one home"). The `evaluate` tool injects helpers via a single named routine that concatenates the constants — not duplicated strings.

### 3. BrowserPort read methods — functional cohesion (CC APPLIER)

Each new port method performs exactly one operation at its abstraction level:
- `readDom(opts?)` — read the DOM (full page or scoped element)  
- `readAccessibility()` — read the AX tree
- `extract(opts)` — extract structured fields from repeated elements
- `collect(opts)` — accordion expand-read-close loop
- `evaluate(expression)` — run arbitrary JS with helpers injected
- `dismiss()` — find and dismiss topmost dialog
- `readForm(selector)` — read form element state

### 4. evaluate security boundary

`evaluate` passes the expression to `page.evaluate` — browser sandbox, NOT `eval()` in the Node process. Page-side throws are caught in the adapter and returned as `evaluate_failed` BrowserError. Non-serializable returns (cyclic, Symbol, undefined) handled with a try/catch around JSON.stringify in the adapter; if it fails, return `evaluate_failed`.

### 5. collect diff fallback

Ported verbatim from cdp-browser.js: capture `body.innerText` before click, compute new lines after click. If no diff, result is null → "no expandable content" not silent empty success.

### 6. dialog scoring heuristic

Ported verbatim from cdp-browser.js lines ~719-965 as a single injected JS string constant `FIND_DIALOG_JS`. The scoring algorithm (aria-label/text/class/position bonus) stays faithful. Returns `null` when no dialog found → `dismiss()` throws `no_dialog` BrowserError → tool returns structured "nothing to dismiss" err.

### 7. Parameter object for collect/extract (≤7 params rule)

```typescript
type ExtractOpts = { selector: string; fields?: { name: string; selector: string }[]; pierce?: boolean }
type CollectOpts = { selector: string; readSelector: string; pierce?: boolean; closeAfterRead?: boolean; delayMs?: number }
```

Both use param objects — below the 7-param threshold, maintaining PP-4 compliance.

## Prerequisites

- [x] P1 + P2 seams exist (BrowserPort, writePayload stub, FakePort, tool pattern)
- [x] cdp-browser.js heuristics available to port
- [x] Puppeteer `page.evaluate()` works the same as CDP `Runtime.evaluate` for injected JS strings (confirmed: `page.evaluate(js)` runs in the page context, returns-by-value, throws on page-side exceptions — identical semantics)
- [x] `page.accessibility.snapshot()` (P2) already returns the full AX tree — `readAccessibility` can re-use this or call directly

## Assumption Verification (per dispatch)

**Shadow-DOM heuristics under puppeteer `page.evaluate` vs raw CDP `Runtime.evaluate`:**
Both execute JS strings in the page context and return by value. The core difference is that `page.evaluate` accepts a serialized string and puppeteer wraps the CDP call; the injected JS helpers are pure DOM APIs (querySelector, getBoundingClientRect, getComputedStyle) — no CDP-only APIs. The verbatim heuristics port cleanly. One adaptation: `page.evaluate` can take a function or a string; we use the string form to match the existing pattern exactly.

## Recommendation

BUILD — all prerequisites met, all DW items coverable, no UPDATE_PLAN triggers.
