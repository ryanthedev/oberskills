# Plan: mcp-browser screenshot token levers + token-bounding A/B measurement

**Created:** 2026-07-03
**Status:** in review (BUILD done inline, REVIEW gate pending)
**Complexity:** simple
**Current Phase:** 1/1 (review)
---
## Context

**Problem:** The merged `feature/mcp-browser-token-bounding` work spills large *text* read
payloads (snapshot/evaluate/collect/dom/extract) to `/tmp`. Two follow-ups the audit deferred remain:
(a) `browser_screenshot` already keeps PNG bytes out of the result (path only), but image token cost is
**dimension-driven** (~`width×height/750`), and the tool exposes no lever to reduce pixels and returns no
dimensions for a caller to judge the read cost; (b) the token reduction from the spill work was argued
arithmetically but never *measured* against the real handler.

**Success criteria:**
- `browser_screenshot` gains a `selector` option that scopes capture to one element (fewer pixels → fewer
  image tokens), forwarded through the `BrowserPort` seam and implemented in the puppeteer adapter with a
  `read_failed` error on no match (parity with `readDom`'s selector idiom). `selector` takes precedence
  over `full_page`.
- `browser_screenshot` returns `width`/`height` parsed zero-dep from the PNG IHDR header (absent when the
  bytes are not a decodable PNG), and the text summary shows `W×Hpx`.
- A deterministic A/B measurement drives the **real** `browser_snapshot` handler and demonstrates the
  main-context payload reduction (supra-threshold) and the no-change-below-threshold behavior; runs under
  `bun test`, no live Chrome.
- `bunx tsc --noEmit` and `bun test` pass clean in `mcp-browser/`; no `console.log` in `src/`.

## Constraints
- Hexagonal architecture preserved: `selector` threads through `BrowserPort.screenshot(opts)` → adapter;
  no puppeteer types leak into `core/`/`tools/`. PNG-dimension parsing lives in the tool (derives from the
  returned Buffer — no puppeteer).
- **Zero new deps** (Bun + strict TS). This forbids an image library, so a true post-capture pixel
  `max_width`/`scale` downscale is **out of scope** (see Notes) — the dimension lever shipped here is
  element-scoping, which needs no dep.
- Backward compatible: `ScreenshotOut` gains only optional fields; the existing `{path,bytes}` callers and
  the `browser` skill guidance stay valid. `full_page` default unchanged.

## Deliverables (single phase)

### Screenshot token levers
- `ScreenshotInputSchema += selector?: string` (`src/types.ts`).
- `ScreenshotOut += width?: number; height?: number` (`src/types.ts`).
- `BrowserPort.screenshot(opts?: {fullPage?; selector?})` widened (`src/core/browser-port.ts`).
- Puppeteer adapter: `selector` → `page.$` → `el.screenshot`; `read_failed` on no match; precedence over
  `fullPage` (`src/adapters/puppeteer/connection.ts`).
- Tool: zero-dep `pngDimensions()` (IHDR offsets 16/20), forward `selector`, emit `width`/`height` +
  `W×Hpx` text; refreshed description (`src/tools/screenshot.ts`).
- `test/fake-port.ts`: widened signature + records `lastScreenshotOpts`.

### Token-bounding A/B measurement
- `test/token-bounding.bench.test.ts`: builds synthetic a11y trees (2/8/50/200 KB, ~1-in-5 interactive),
  runs the real `snapshot.handler`, compares pre-merge inline bytes vs post-merge actual bytes, prints the
  table, and asserts the invariants below.

## Done when
- [ ] DW-1: `browser_screenshot` accepts `selector` and forwards it to the port; the puppeteer adapter
  scopes to `page.$(selector).screenshot()` and throws `read_failed` on no match; `selector` takes
  precedence over `full_page`. (unit test: forwarding + precedence; adapter parity with `readDom`)
- [ ] DW-2: the result carries `width`/`height` parsed from the PNG IHDR header and the text summary
  includes `W×Hpx`; a non-PNG buffer yields no `width`/`height` (never throws). (unit tests: valid PNG +
  non-PNG)
- [ ] DW-3: `ScreenshotInputSchema`, `ScreenshotOut`, `BrowserPort`, and `fake-port` are widened
  consistently; `bunx tsc --noEmit` clean; full `bun test` green; no `console.log` in `src`. (static + suite)
- [ ] DW-4: `token-bounding.bench.test.ts` drives the real snapshot handler; supra-threshold payloads
  spill (`written:true`, `tree` absent, `tree_path` set) with reduction > 80%; sub-threshold stays inline
  (`written:false`, `tree` present); the measured table is printed. (bench-as-test)

## Notes / deferred (out of scope, by decision)
- **True pixel `max_width`/`scale` downscale:** needs either an image library (violates zero-new-deps) or
  mutating `deviceScaleFactor`/viewport on the persistent connection — fragile on CDP-attached pages where
  `page.viewport()` is null and cannot be cleanly restored. Deferred with the tradeoff documented rather
  than silently added or silently dropped. Element-scoping (`selector`) is the zero-dep dimension lever.
- Follow-up: element-scoped `read_failed` path is adapter-level (real puppeteer Page) and follows the
  existing `readDom` pattern, which likewise has no fake-port unit test; covered by parity, not a new unit.

## Execution Log
### Phase 1 (Gate: Standard)
- [x] BUILD: implemented inline (see Deliverables); tsc clean, mcp-browser 250 pass / 0 fail.
- [x] REVIEW: independent code-foundations post-gate agent — **PASS**, all DW-1..DW-4 CONFIRMED with
  its own execution evidence (tsc 0, 250 pass/0 fail). Non-blocking notes: adapter-level element capture
  is covered by readDom parity not a live-Chrome unit; empty-string selector falls to full-page (harmless,
  matches readDom); bench "before" is a faithful in-test reconstruction of the pre-merge inline shape.
- [ ] Committed: (held — awaiting user; "make it so" authorized the change, not the commit).
