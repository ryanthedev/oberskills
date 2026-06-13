# Discovery + Design: Phase 5 — DevTools: storage / emulation / capture

## Files Found

- `mcp-browser/src/core/browser-port.ts` — P1–4 use cases; P5 must add storage/emulation/capture
- `mcp-browser/src/core/errors.ts` — BrowserErrorCode union; P5 must add codes
- `mcp-browser/src/types.ts` — all zod schemas; P5 must add StorageStateSchema + P5 input schemas
- `mcp-browser/src/adapters/puppeteer/connection.ts` — implements BrowserPort; P5 extends
- `mcp-browser/src/adapters/puppeteer/network.ts` — pattern reference (adapter-internal)
- `mcp-browser/src/adapters/puppeteer/tracing.ts` — TraceController lifecycle pattern (double-start typed err)
- `mcp-browser/src/lib/payload.ts` — writePayload seam (captures route through here)
- `mcp-browser/src/lib/tool.ts` — ok/err/runPort/ensureAlive/errFromBrowserError
- `mcp-browser/src/core/session.ts` — getPort(); test swap via setPort()/resetSession()
- `mcp-browser/src/register.ts` — TOOLS list; all new tools must be added here
- `mcp-browser/test/fake-port.ts` — FakePort; P5 must extend with storage/emulation/capture stubs
- `mcp-browser/test/perf-network.test.ts` — test pattern reference (DW-4.x tests)

## Assumption Verification

**AV-1: screencast/CDP reliability under puppeteer-core + bun (Confidence: Low)**

CDP `Page.startScreencast` is a real CDP method, but puppeteer-core does not expose it as a first-class API. It must be accessed via `page.createCDPSession()`. The returned event stream (`Page.screencastFrame`) fires base64-encoded JPEG frames asynchronously; assembling them into a video requires an external tool (ffmpeg or similar) or frame archiving logic. Under bun, the CDP session works but the frame assembly loop is unreliable in a headless server context — timing, dropped frames, and no bundled codec make this a high-effort deliverable with low confidence of a clean result.

**Decision: Implement the start/stop typed-error lifecycle (screencast_already_running, no_screencast_running) + the CDP session plumbing, but mark frame assembly as deferrable.** The lifecycle state machine (DW-5.6 typed errs) ships; the video file output is a P5b follow-up. DW-5.6 is EXCLUDED from the phase gate per pre-authorization. The tool will return an err with code `screencast_not_supported` and a clear message explaining the deferral.

**AV-2: storage-state origin-check in attach mode**

`activePageHandle()` returns `{ tabId: string }`. The adapter's `activePage()` resolves the tabId to a puppeteer Page, and `page.url()` is accessible in the adapter. The current page URL's origin is available inside the adapter. The BrowserPort method `activePageHandle()` does not expose the URL, but the adapter's `restoreStorageState` can call `activePage()` internally to get the page URL for origin checking — no need to pass the origin explicitly as a caller parameter.

**Decision: Origin check implemented inside the adapter using `activePage()`. The BrowserPort interface does not change for this AV.**

## Current State

P1–P4 are complete and green (163 passing, 20 skipped). The following P5 hooks are already present but unimplemented:

- `BrowserPort` interface has no storage/emulation/capture methods yet
- `BrowserErrorCode` has no P5 codes yet
- `types.ts` has no StorageStateSchema or P5 input schemas
- `adapters/puppeteer/connection.ts` has no P5 methods
- Tools for storage/storage-state/emulate-device/geolocation/permissions/pdf/screencast/upload/download/wait-for-text do not exist
- `fake-port.ts` has no P5 stubs

## Gaps

| # | Gap | Action |
|---|-----|--------|
| 1 | BrowserPort interface missing P5 method signatures | Add to browser-port.ts |
| 2 | BrowserErrorCode missing P5 codes | Add 10 new codes to errors.ts |
| 3 | StorageStateSchema + P5 input schemas missing from types.ts | Add zod schemas + DTOs |
| 4 | PuppeteerConnectionManager missing P5 implementations | Add to connection.ts |
| 5 | New adapter files (storage.ts, emulation.ts, capture.ts) don't exist | Create under adapters/puppeteer/ |
| 6 | 10 new tool files missing | Create under tools/ |
| 7 | register.ts doesn't import P5 tools | Add imports + defineTool() entries |
| 8 | fake-port.ts missing P5 stubs | Extend with P5 canned state |

## Code Standards

From `CLAUDE.md` (project instructions, applying to `mcp-browser/`):
- Bun + strict TypeScript; `bunx tsc --noEmit` and `bun test` must pass clean
- No `console.log` in `src/` (stdout is the MCP transport — stderr only)
- ToolModule shape: `name/title/description/inputShape/handler` + `satisfies ToolModule`
- All zod schemas centralized in `types.ts`
- Captures (PDF, video, storage-state) route through `writePayload`
- Puppeteer types must NOT appear in `src/core/` or `src/tools/`

Defensive programming (cc-defensive-programming):
- Storage-state file is external input: validate at the restore barricade via zod
- Origin check before injecting restored state
- Typed errors (BrowserError) for all failure paths — no silent no-ops
- Barricade: geolocation range check, permission name allowlist, download timeout typed err

Routine design (cc-routine-and-class-design):
- `storage` multiplexed by communicational cohesion (same cookie/localStorage/sessionStorage store, distinct ops) — documented as ACCEPT w/caution
- Parameters: storage set approaches limit → use StorageSetOpts parameter object (≤7 fields)
- Each adapter method single-responsibility; `ScreencastController` mirrors `TraceController`

## Test Infrastructure

- Framework: `bun test` with `describe`/`test`/`expect` from `bun:test`
- Pattern: FakePort injected via `setPort()`, `afterEach(() => resetSession())`
- Dirty tests (barricade edge cases) outnumber clean tests ~5:1
- Static suite (`test/static.test.ts`) enforces no-puppeteer-in-core via grep

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-5.1 | `storage` get/set/delete works across cookies/localStorage/sessionStorage; cross-domain cookie set is err or explicit flag; no-origin-page op returns explicit err | COVERED | test_DW_5_1_cookie_get_set_delete, test_DW_5_1_localstorage_get_set_delete, test_DW_5_1_sessionstorage_get_set_delete, test_DW_5_1_cross_domain_cookie_err, test_DW_5_1_no_origin_page_err |
| DW-5.2 | `storage_state` saves to file (via writePayload) and restores; restore validates with StorageStateSchema; malformed/wrong-origin file rejected; restored vs skipped reported | COVERED | test_DW_5_2_save_routes_through_writepayload, test_DW_5_2_restore_round_trip_ok, test_DW_5_2_malformed_file_rejected, test_DW_5_2_wrong_origin_rejected, test_DW_5_2_restored_vs_skipped_reported |
| DW-5.3 | `emulate_device`, `geolocation`, `permissions` apply; unknown permission / out-of-range geolocation rejected | COVERED | test_DW_5_3_emulate_device_applies, test_DW_5_3_geolocation_applies, test_DW_5_3_permissions_apply, test_DW_5_3_unknown_permission_rejected, test_DW_5_3_geolocation_out_of_range_rejected |
| DW-5.4 | `pdf` → file; `upload` to input[type=file] works (reuses resolveTarget); `download` returns typed timeout err when download never fires | COVERED | test_DW_5_4_pdf_returns_path, test_DW_5_4_upload_resolves_target, test_DW_5_4_upload_non_file_input_err, test_DW_5_4_upload_stale_ref_err, test_DW_5_4_download_timeout_err |
| DW-5.5 | `wait_for_text` appear/disappear returns typed timeout err naming appear vs disappear | COVERED | test_DW_5_5_wait_for_text_appear_ok, test_DW_5_5_wait_for_text_disappear_ok, test_DW_5_5_wait_for_text_appear_timeout, test_DW_5_5_wait_for_text_disappear_timeout |
| DW-5.6 | `screencast` start/stop → file; double-start or stop-when-not-running typed err — DEFERRED per pre-authorization (frame assembly unreliable under bun); lifecycle typed-err tests ship | COVERED (lifecycle only) | test_DW_5_6_screencast_double_start_err, test_DW_5_6_screencast_stop_not_running_err; video file output deferred to P5b |
| DW-5.7 | Storage/emulation/capture use cases added to BrowserPort with no puppeteer types in core; captures route through writePayload | COVERED | test_DW_5_7_no_puppeteer_in_core (static.test.ts), test_DW_5_7_pdf_routes_writePayload, test_DW_5_7_storage_state_routes_writePayload |

**All items COVERED:** YES (DW-5.6 lifecycle shipped; video output deferred per pre-authorization)

## Design Decisions

### StorageOp design (communicational cohesion — ACCEPT w/caution)
The `storage` use case is communicational: all ops touch the same storage substrate (cookies/localStorage/sessionStorage) but are otherwise independent (get vs set vs delete). This is justified because the coupling is the DATA (a shared storage model), not incidental. A `storage` tool with `store` + `op` + `key` + `value` fields is cleaner than 9 separate tools for each store×op combination. Documented here per ACCEPT w/caution rule.

### StorageSetOpts parameter object
Cookie set has: store, op, key, value, domain, path, expiry, httpOnly, secure — 9 fields, violating the ≤7 rule. Solution: StorageSetOpts = `{ key, value, domain?, path?, expiry?, httpOnly?, secure? }` as a nested zod object, keeping the top-level `storage` input at ≤7 fields (store, op, opts).

### StorageState barricade
`restoreStorageState` receives external input (a file read from disk). The zod schema (`StorageStateSchema`) validates at the restore boundary. Origin check: compare each cookie's domain against `activePage().url()` — cross-origin cookies flagged as skipped with a diagnostic in the result. All-or-nothing: adapter clears existing state before restore; on zod failure, the clear has not yet happened (validate first, clear second).

### ScreencastController lifecycle (mirrors TraceController)
Same pattern as TraceController: a class with `start()/stop()` holding state, typed errors for lifecycle violations. Frame assembly is a stub that returns a typed deferral error. The BrowserPort interface declares `startScreencast()/stopScreencast()` but the implementation documents the deferral clearly.

### PDF capture
`page.createCDPSession()` → `Page.printToPDF` → Buffer → writePayload. No puppeteer-core first-class API for this; CDP direct is the correct approach. The CDP session is short-lived (create, call, close).

### Download capture
Puppeteer-core exposes `page.on('response', ...)` but download interception requires CDP `Browser.setDownloadBehavior` + a download-completed event. We use `page.createCDPSession()` for `Browser.setDownloadBehavior` with `downloadPath` set to a temp dir, then poll for a file to appear within timeout. On timeout, typed `download_timeout` error.

### Upload
`page.$(selector)` → verify `input[type="file"]` → `element.uploadFile(path)`. The selector comes from `resolveTarget` (reuses P2 strategy). Non-file-input → `upload_failed` with clear message.

### wait_for_text
`page.waitForFunction` with a regex/substring check against `document.body.textContent`. On timeout, throw `wait_for_text_timeout` naming appear vs disappear in the message.

### emulate_device
`page.emulate(puppeteer.devices[deviceName])` for named devices, or `page.setViewport(viewport)` for explicit dims. Unknown device name → `emulation_failed`.

### Geolocation + Permissions
`page.setGeolocation({ latitude, longitude, accuracy? })` — lat/lon bounds: -90..90, -180..180. `page.setPermissions(origin, permissions)` — allowlisted permission names from CDP spec.

## Prerequisites

- [x] P1–P4 complete (163 tests green)
- [x] BrowserPort seam, FakePort, tools pattern all established
- [x] writePayload seam available
- [x] resolveTarget strategy available for upload/download element resolution

## Recommendation

BUILD
