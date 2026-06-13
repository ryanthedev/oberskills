# Review: Phase 5 - Storage / Emulation / Capture

## Executed Results (Step 0)

```
Test suite: bun test → 234 pass, 20 skip, 0 fail
Typecheck: bunx tsc --noEmit → 0 errors, 0 warnings
Lint: (static.test.ts) → 0 puppeteer imports in core/tools, 0 console.log in src/
```

All tests executed successfully in `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser`.

## Requirement Fulfillment

### DW-5.1

**PREMISE:** `storage` get/set/delete works across cookies/localStorage/sessionStorage; a cross-domain cookie set is an err or explicit flag (no silent no-op); a no-origin-page op returns an explicit err.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/storage.ts:31–108` (tool barricade)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/adapters/puppeteer/storage.ts:34–177` (adapter dispatch)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:51–151` (tests)

**TRACE:**
1. **Cookies get** (test line 51): handler calls `port.storage({store:"cookies", op:"get", key:"session"})` → adapter's `getCookies()` → returns `{value: cookie.value}` → tool structured result
2. **Cookies set** (line 63): handler receives `cookie_attrs`, validates presence (barricade line 44), transforms to `CookieSetAttrs`, calls `port.storage({op:"set", attrs:...})` → adapter's `setCookie()` at line 53 → cross-domain check at line 64 throws `cross_domain_cookie` when domain mismatch + no flag
3. **localStorage set** (line 91): handler validates `value` present (line 33), calls `port.storage({store:"localStorage", op:"set", key, value})` → adapter's `setLocalStorage()` at line 115 → calls `ensureHasOrigin()` (line 103) which throws `storage_failed` if no-origin (line 402–408)
4. **Test cross-domain (line 130)**: handler receives cross-domain cookie, FakePort.crossDomainCookieError=true → BrowserError("cross_domain_cookie") → tool err() → code="cross_domain_cookie"
5. **Test no-origin (line 143)**: FakePort.noOriginError=true → BrowserError("storage_failed", "no origin") → tool err() → code="storage_failed" with message containing "no origin"

**VERDICT:** PASS — All three stores (cookies/localStorage/sessionStorage) get/set/delete routed through port; cross-domain cookie without flag throws explicit `cross_domain_cookie` error (never silent); no-origin page throws explicit `storage_failed` with "no origin" message.

---

### DW-5.2

**PREMISE:** `storage_state` saves to file (via `writePayload`) and restores it; restore validates with `StorageStateSchema` and reports restored vs skipped (a malformed/wrong-origin file is rejected).

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/storage-state-save.ts:22–32` (save tool)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/storage-state-restore.ts:31–71` (restore tool + barricade)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/types.ts:483–501` (StorageStateSchema)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/adapters/puppeteer/storage.ts:183–231` (captureStorageState) and 238–336 (restoreState)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:159–256` (tests)

**TRACE:**
1. **Save (test line 159)**: tool calls `port.saveStorageState()` → adapter calls `captureStorageState(page)` → returns `StorageState` DTO (origin, cookies, localStorage, sessionStorage) → BrowserPort.saveStorageState() routes through `writePayload()` to /tmp → returns `{path}` 
2. **Restore validation (line 167)**: handler receives `state_json: "{...}"` → JSON.parse at line 35 → `StorageStateSchema.safeParse()` at line 46 → validates all fields → calls `port.restoreStorageState(state)` at line 64 → returns `{restored, skipped}`
3. **Malformed JSON (line 184)**: state_json = "not-json{{{"` → JSON.parse throws → caught at line 36 → returns BrowserError("storage_state_invalid") → tool err()
4. **Schema fails (line 191)**: state missing required "origin" → safeParse fails → error returned with "failed validation" message → code="storage_state_invalid"
5. **Wrong-origin cookies skipped (line 199)**: restore result from port includes `skipped: ["cookie:other (domain mismatch: other.example.com vs example.com)"]` → tool returns both restored and skipped lists separately
6. **StorageStateSchema roundtrip (line 236)**: safeParse(input) → validates all nested fields → data is returned with correct types
7. **No origin field (line 252)**: StorageStateSchema rejects empty origin (min:1) → safeParse fails → FALSE

**VERDICT:** PASS — saveStorageState routes through port; restoreStorageState validates input with StorageStateSchema before restore (barricade line 31–55); malformed JSON rejected; schema validation failures rejected; all-or-nothing restore (clear then restore); restored vs skipped reported separately with per-item diagnostics (line 336).

---

### DW-5.3

**PREMISE:** `emulate_device`, `geolocation`, `permissions` apply; unknown permission names / out-of-range values are rejected at the barricade.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/emulate-device.ts:26–68` (device barricade + apply)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/geolocation.ts:22–39` (geolocation apply)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/permissions.ts:24–51` (permission allowlist barricade)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/types.ts:555–606` (input schemas with validation)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:262–350` (tests)

**TRACE:**
1. **Device preset apply (test line 263)**: handler receives preset="iPhone 12" → calls `port.emulateDevice({preset})` at line 55 → adapter's emulateDevice() at src/adapters/puppeteer/emulation.ts:21 → KnownDevices lookup → calls page.emulate(device) → test records port.lastDeviceProfile=preset
2. **Device explicit dims (line 270)**: handler width=1024, height=768 → barricade checks both present (line 28) → calls port.emulateDevice({width, height}) → recorded in port.lastDeviceProfile
3. **Unknown preset (line 286)**: port.emulateDeviceError set → adapter throws BrowserError("emulation_failed", 'unknown device preset "WarpDrive 9000"') → tool err()
4. **Geolocation apply (line 296)**: handler receives lat=37.7749, lon=-122.4194 → calls `port.setGeolocation({latitude, longitude, accuracy})` → recorded in port.lastGeolocation
5. **Geolocation accuracy default (line 304)**: handler passes accuracy undefined → tool defaults to 1 (line 33) → port receives accuracy=1
6. **Geolocation out-of-range (line 313)**: schema defines `z.number().min(-90).max(90)` for latitude → zod validates at parse time → schema.safeParse({latitude: 91}) → success=false (no handler invoked)
7. **Permission allowlist barricade (line 329)**: handler receives ["geolocation", "hack-the-planet"] → barricade checks against KNOWN_PERMISSIONS at line 26 → finds unknown → returns BrowserError("permission_unknown") with list of unknown names at line 32
8. **All permissions in allowlist (line 338)**: for each permission in KNOWN_PERMISSIONS (types.ts line 580–595: geolocation, camera, microphone, notifications, etc.) → handler passes barricade → calls port.grantPermissions() → recorded in port.lastPermissions

**VERDICT:** PASS — emulate_device applies both presets and explicit dimensions; unknown preset throws `emulation_failed`; geolocation applies with accuracy defaulting to 1m; lat/lon bounds validated by zod schema; permissions barricade rejects unknown names with `permission_unknown` error; all 15 known permissions pass barricade.

---

### DW-5.4

**PREMISE:** `pdf` → file and `upload` to an `<input type=file>` work (upload reuses `resolveTarget`); `download` capture returns a typed `timeout` err when the download never fires.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/pdf.ts:25–39` (pdf tool + routing)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/upload.ts:34–67` (upload barricade + resolveTarget)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/download.ts:26–36` (download capture)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/adapters/puppeteer/capture.ts:73–94` (printPdf), 101–132 (uploadFile), 140–192 (captureDownload)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:357–447` (tests)

**TRACE:**
1. **PDF export (test line 357)**: handler calls `port.printPdf({format, landscape, printBackground})` → adapter's printPdf() (capture.ts:73) → creates CDP session → calls `cdp.send("Page.printToPDF", {...})` → returns base64-encoded data → Buffer.from(data, "base64") → writePayload routes bytes to /tmp → returns {path} to tool → tool structured result
2. **PDF failed (line 365)**: adapter throws CDP error → BrowserError("pdf_failed", "CDP call failed") → tool err() with code="pdf_failed"
3. **Upload with selector (line 383)**: handler toTarget({selector:"input[type=file]"}) → resolveTarget(selector) at upload.ts:63 → port.resolveTarget() (fake) → returns ResolvedTarget → calls port.uploadFile(target, filePath) → adapter resolveOnPage() finds element → calls element.uploadFile(filePath)
4. **Upload non-file input (line 392)**: selector="button#submit" (non-file) → port throws BrowserError("upload_failed", "element is not <input type=file>") at capture.ts:124 → tool err() with code="upload_failed"
5. **Upload no target (line 401)**: handler calls toTarget({file_path:...}) with no ref/selector/coords → toTarget returns null at types.ts:132 → handler barricade (upload.ts:37) → returns BrowserError("upload_failed")
6. **Upload coordinate target (line 408)**: handler receives x=100, y=200 → toTarget returns {x,y} → barricade check at upload.ts:48 → "x" in target && "y" in target → returns BrowserError("upload_failed", "coordinate targets not supported")
7. **Upload stale ref (line 417)**: port.everIssued.add("old-ref") but liveRefs does NOT contain it → resolveTarget checks liveRefs at fake-port.ts:184 → throws BrowserError("stale_ref")
8. **Download success (test line 429)**: handler calls port.captureDownload({timeoutMs}) → adapter sets Browser.setDownloadBehavior → polls tmpdir for completed file → returns {path} → tool returns download path
9. **Download timeout (line 437)**: downloadTimeout=true → adapter throws BrowserError("download_timeout", "no download completed within 1000ms") → tool err() with code="download_timeout" and message naming the timeout value

**VERDICT:** PASS — pdf routes through port.printPdf() and writePayload; upload resolves target via Strategy (reusing P2 resolveTarget); upload rejects non-file inputs with `upload_failed`; upload rejects coordinate targets with explicit message; upload errors (stale_ref, no_match, etc.) propagate; download captures file and returns path; download timeout throws typed `download_timeout` error naming the timeout value.

---

### DW-5.5

**PREMISE:** `wait_for_text` appear/disappear returns a typed timeout err naming appear vs disappear.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/wait-for-text.ts:22–37` (tool)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/adapters/puppeteer/capture.ts:198–224` (waitForText adapter)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:454–502` (tests)

**TRACE:**
1. **Appear success (test line 454)**: handler receives {text:"Welcome", appear:true, timeout_ms:5000} → calls port.waitForText() → adapter page.waitForFunction() succeeds → tool returns ok() with condition="appear"
2. **Disappear success (line 463)**: handler {text:"Loading", appear:false} → port.waitForText() → adapter condition evaluates !bodyText.includes(text) → tool condition="disappear"
3. **Appear timeout (line 471)**: port.waitForTextTimeout=true → adapter throws BrowserError("wait_for_text_timeout", "timed out waiting for text to appear: \"Success\"") at capture.ts:219 → tool err() → message contains "appear" + "Success"
4. **Disappear timeout (line 483)**: appear=false → port error → BrowserError message says "disappear" → tool err() → message contains "disappear" + "Spinner"
5. **Tool passes opts (line 495)**: handler calls port.waitForText({text:"Done", appear:false, timeoutMs:7000}) → port records call → text="Done", appear=false, timeoutMs=7000 all match

**VERDICT:** PASS — wait_for_text calls port.waitForText() with appear/text/timeout; timeout error throws `wait_for_text_timeout` with message explicitly naming "appear" or "disappear" condition (not generic timeout); tool returns structured condition field matching the input.

---

### DW-5.6

**PREMISE:** `screencast` start/stop lifecycle returns typed errs (double-start, stop-when-not-running). NOTE: actual video-frame-to-file is DEFERRED to a P5b follow-up (documented `screencast_not_supported` under bun) and is OUT of this gate — verify only the lifecycle typed-err state machine, not real video output.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/screencast-start.ts:25–37` (start tool)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/tools/screencast-stop.ts:25–35` (stop tool)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/adapters/puppeteer/capture.ts:32–67` (ScreencastController)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:509–544` (tests)

**TRACE:**
1. **Start OK (test line 510)**: handler calls port.startScreencast() → adapter ScreencastController.start() (capture.ts:35) → checks if running (line 36) → sets running=true (line 43) → tool returns ok() with status="deferred"
2. **Double start (line 518)**: first start sets running=true → second call to start() → checks running (line 36) → throws BrowserError("screencast_already_running") → tool err() with code="screencast_already_running"
3. **Stop not running (line 527)**: port.screencastRunning=false → handler calls port.stopScreencast() → adapter ScreencastController.stop() (line 47) → checks running (line 48) → throws BrowserError("no_screencast_running") → tool err() with code="no_screencast_running"
4. **Stop after start (line 534)**: start sets running=true → stop() checks running (line 48) → passes → sets running=false (line 55) → throws BrowserError("screencast_not_supported") at line 57 (P5b deferral) → tool err() with code="screencast_not_supported" → port state shows screencast_running=false (reset)

**VERDICT:** PASS — start/stop lifecycle state machine correctly typed: double-start throws `screencast_already_running`; stop-when-not-running throws `no_screencast_running`; stop after start throws `screencast_not_supported` (video assembly deferred P5b); lifecycle state resets correctly.

---

### DW-5.7

**PREMISE:** storage/emulation/capture use cases added to `BrowserPort` with no puppeteer types in core; captures route through `writePayload`.

**EVIDENCE:**
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/src/core/browser-port.ts:264–344` (P5 interface extensions: storage, saveStorageState, restoreStorageState, emulateDevice, setGeolocation, grantPermissions, printPdf, startScreencast, stopScreencast, uploadFile, captureDownload, waitForText)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/static.test.ts:37–47` (static gate: no puppeteer imports in src/core or src/tools)
- `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/mcp-browser/test/storage-emulation-capture.test.ts:552–586` (tests verifying methods exist + routing)

**TRACE:**
1. **BrowserPort additions (test line 552)**: typeof port.storage == "function" ✓, typeof port.saveStorageState ✓, typeof port.restoreStorageState ✓, typeof port.emulateDevice ✓, typeof port.setGeolocation ✓, typeof port.grantPermissions ✓, typeof port.printPdf ✓, typeof port.startScreencast ✓, typeof port.stopScreencast ✓, typeof port.uploadFile ✓, typeof port.captureDownload ✓, typeof port.waitForText ✓ (all 12 present)
2. **No puppeteer types in core (static.test.ts line 37)**: tsFiles(coreDir) + tsFiles(toolsDir) → stripComments() → regex `/\bfrom\s+["'][^"']*puppeteer/` → offenders=[] ✓
3. **PDF routes through writePayload (test line 569)**: tool calls port.printPdf() → adapter returns Buffer → tool passes result through lib/payload.ts writePayload() → port.lastPdfOpts recorded
4. **Storage state routes through port (line 579)**: tool calls port.saveStorageState() → adapter calls writePayload() → returns path from /tmp

**VERDICT:** PASS — All 12 P5 methods added to BrowserPort interface (storage/saveStorageState/restoreStorageState/emulateDevice/setGeolocation/grantPermissions/printPdf/startScreencast/stopScreencast/uploadFile/captureDownload/waitForText); static gate confirms zero puppeteer imports in src/core/ and src/tools/; PDF and storage state capture operations route through writePayload to /tmp (not inlined).

---

## Test-DW Coverage

- [x] **DW-5.1**: test_DW_5_1_cookie_get_ok, test_DW_5_1_cookie_set_ok, test_DW_5_1_cookie_delete_ok, test_DW_5_1_localstorage_get_ok, test_DW_5_1_localstorage_set_ok, test_DW_5_1_localstorage_delete_ok, test_DW_5_1_sessionstorage_get_set_delete, test_DW_5_1_set_without_value_rejected, test_DW_5_1_set_cookie_without_attrs_rejected, test_DW_5_1_cross_domain_cookie_err, test_DW_5_1_no_origin_page_err — 11 unit tests (FakePort, no Chrome) ✓

- [x] **DW-5.2**: test_DW_5_2_save_routes_through_port, test_DW_5_2_restore_round_trip_ok, test_DW_5_2_malformed_json_rejected, test_DW_5_2_schema_validation_fails, test_DW_5_2_wrong_origin_skipped_reported, test_DW_5_2_port_restore_error_returned, test_DW_5_2_storagestateschema_roundtrip, test_DW_5_2_storagestateschema_rejects_no_origin — 8 unit tests ✓

- [x] **DW-5.3**: test_DW_5_3_preset_applies, test_DW_5_3_explicit_dims_apply, test_DW_5_3_no_preset_no_dims_rejected, test_DW_5_3_unknown_preset_errs, test_DW_5_3_geolocation_applies, test_DW_5_3_geolocation_accuracy_defaults, test_DW_5_3_geolocation_zod_rejects_out_of_range, test_DW_5_3_permissions_apply, test_DW_5_3_unknown_permission_rejected, test_DW_5_3_all_known_permissions_pass_barricade — 10 unit tests ✓

- [x] **DW-5.4**: test_DW_5_4_pdf_returns_path, test_DW_5_4_pdf_failed_err, test_DW_5_4_pdf_opts_forwarded, test_DW_5_4_upload_resolves_target, test_DW_5_4_upload_non_file_input_err, test_DW_5_4_upload_no_target_rejected, test_DW_5_4_upload_coord_target_rejected, test_DW_5_4_upload_stale_ref_err, test_DW_5_4_download_ok, test_DW_5_4_download_timeout_err — 10 unit tests ✓

- [x] **DW-5.5**: test_DW_5_5_wait_for_text_appear_ok, test_DW_5_5_wait_for_text_disappear_ok, test_DW_5_5_wait_for_text_appear_timeout, test_DW_5_5_wait_for_text_disappear_timeout, test_DW_5_5_calls_forwarded_with_correct_opts — 5 unit tests ✓

- [x] **DW-5.6**: test_DW_5_6_start_ok, test_DW_5_6_screencast_double_start_err, test_DW_5_6_screencast_stop_not_running_err, test_DW_5_6_screencast_stop_after_start_returns_deferred_err — 4 unit tests ✓

- [x] **DW-5.7**: test_DW_5_7_port_has_all_p5_methods, test_DW_5_7_pdf_routes_through_port, test_DW_5_7_storage_state_routes_through_port, + static.test.ts (zero puppeteer in core/tools) — 4 unit tests ✓

**All requirements met:** YES — 52 named unit tests covering all 7 requirements; static gate (no puppeteer imports); all 234 tests passing.

---

## Dead Code

Scanned for unreachable code, unused imports, debug statements:

- No console.log() in src/ (enforced by static.test.ts line 25)
- No unreachable code paths after early returns
- All imports used in their respective files
- No commented-out blocks in newly added P5 code
- BrowserError codes exhaustively matched in tools (no dead cases in types.ts error union)

**Finding:** NONE

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| **Concurrency** | N/A | Single-threaded browser control; no shared state, no race conditions. All async calls properly awaited. |
| **Error Handling** | PASS | Barricade validation at tool layer (line 31–55 in storage-state-restore, lines 26–28 in emulate-device, lines 25–26 in permissions). All BrowserError subclasses caught and converted to err() envelopes. No empty catch blocks (test line 292 in storage.ts has explicit re-throw of CDP failure as typed BrowserError). |
| **Resources** | PASS | File handles: PDF and storage state routed through writePayload (routes to /tmp atomically). Download capture uses tmpdir with cleanup implicit (temp directory polled, file read, caller responsible for cleanup via path). Connections: CDP session opened in printPdf (line 74), closed in finally (line 92). Lifecycle: storage state file paths returned to caller for external cleanup. |
| **Boundaries** | PASS | Input validation at barricade: zod schemas for all tool inputs (StorageInputSchema, GeolocationInputSchema, PermissionsInputSchema, etc. in types.ts). StorageStateSchema validates all cookie/localStorage/sessionStorage nested fields. Permission names validated against KNOWN_PERMISSIONS allowlist (15 items, none unknown). Lat/lon bounds enforced by zod min(-90)/max(90), min(-180)/max(180). Out-of-range detected at schema validation time, never reaches handler. |
| **Security** | PASS | Storage state (credentials) never logged: comments at storage.ts:3 and storage-state-save.ts:3 "never logged". Cross-domain cookie requires explicit opt-in flag (not automatic). No path traversal: file paths are opaque tokens from writePayload, not user-controlled. Permission allowlist prevents unknown permissions (barricade line 26 checks against KNOWN_PERMISSIONS). Geolocation/device settings trust adapter to enforce (adapter is controlled code, no untrusted input). |

---

## Notes (non-blocking)

**Design observations:**

1. **Communicational cohesion in storage tool** (storage.ts:1–4): tool handles cookies/localStorage/sessionStorage get/set/delete. All three share the storage substrate; barricade validates all ops at entry; operations are otherwise independent. This is acceptable communicational cohesion for a single storage abstraction — the tool name reflects "get/set/delete storage" at the right level, and barricade prevents silent failures.

2. **Parameter count check** (storage tool): `handler(args: Input)` has 1 parameter; all phase tools follow same pattern via ToolModule<Shape> contract (register.ts:106–113). No violation detected.

3. **Inheritance vs containment**: No new class hierarchies introduced in P5. Storage state validation uses composition (StorageStateSchema applied in restore handler). Adapter is a concrete implementation of BrowserPort interface (standard ports + 12 new methods). No LSP violations.

4. **Defensive programming**: All async calls properly await. No unhandled promise rejections (awaited in test harness). Barricade validation before port calls. BrowserError used consistently for all failures (never null/undefined fallbacks).

5. **P5b deferral documented**: Screencast notes (screencast-start.ts:17, screencast-stop.ts:9, capture.ts:6) clearly state "P5b: Video assembly deferred." Lifecycle state machine correctly typed; callers will see `screencast_not_supported` until P5b ships. No silent partial implementation — explicit error names the deferral.

**Minor observations:**

- emulation.ts line 38 sets `isMobile: opts.isMobile ?? false` — optional field defaults to false (consistent with device profile contract)
- storage.ts uses type assertion for StorageOp discriminated union (lines 351, 361, 371) — necessary because zod doesn't preserve discriminant type at runtime; assertion is sound because barricade has already selected the correct op type
- PDF format handling (capture.ts:76–80) includes a conditional for `opts?.format !== undefined` twice — first checks presence, second passes it; no bug, just slightly redundant pattern but not a readability issue

---

## Issues

**None.** All requirements met with passing tests and no defects demonstrated.

---

## Verdict

**PASS**

All 7 DW items satisfied with execution evidence from 52 unit tests (100% coverage requirement met). No failing tests, no typecheck errors, no linting violations. Barricades correctly validate input at tool layer. Adapters route through established BrowserPort seam with no puppeteer types leaking into core/tools (static gate confirmed). Errors are typed and named explicitly (no silent no-ops, no generic "failed" messages). Storage state file operations route through writePayload. Screencast lifecycle typed-err state machine correctly enforced; P5b deferral documented. All edge cases from dispatch prompt handled: malformed JSON rejected, wrong-origin cookies skipped with diagnostic, unknown permissions rejected at barricade, out-of-range geolocation rejected at schema validation, cross-domain cookies require explicit flag, no-origin page operations throw explicit errors, download timeout named, wait-for-text timeout names appear vs disappear, screencast double-start and stop-not-running typed-err.

