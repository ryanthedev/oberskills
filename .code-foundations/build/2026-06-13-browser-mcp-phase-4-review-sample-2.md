# Review: Phase 4 - Performance / Network

## Executed Results (Step 0)

| Command | Result |
|---------|--------|
| `bun install` | OK — 295 packages, no changes |
| `bunx tsc --noEmit` | Exit 0 — clean, zero errors/warnings |
| `bun test` (full suite) | 163 pass, 20 skip, 0 fail — 622 expect() calls, 183 tests across 22 files |
| `bun test test/perf-network.test.ts test/har-writer.test.ts` | 27 pass, 0 fail — 128 expect() calls |
| Live tests (`RUN_LIVE_EVALS=1`) | Not run — Chrome unavailable in sandbox; noted as unverified-here per protocol |

The 20 skipped tests are the live test suite (`describe.skip` when `RUN_LIVE_EVALS` is not set), not failures.

---

## Requirement Fulfillment

### DW-4.1
PREMISE:  `performance_start_trace`/`stop_trace`/`analyze_insight` work as three operations; stop/analyze with no trace started, or a second start before stop, return errs (not empty results).
EVIDENCE: `src/adapters/puppeteer/tracing.ts:40-98`, `src/adapters/puppeteer/connection.ts:594-616`, `test/perf-network.test.ts:46-82`
TRACE:
- Happy path: `startTrace()` sets `running=true`; `stopTrace()` calls `page.tracing.stop()`, sets `capturedBuffer`/`capturedEvents`, returns buffer; `analyzeInsight()` reads `capturedEvents` → returns `InsightResult`. Test `test_DW_4_1_start_stop_analyze_happy` passes.
- `stopTrace()` with no trace: `this.trace === null` in `connection.ts:601` → throws `BrowserError("no_trace_running")`. Test `test_DW_4_1_stop_without_start_errs` passes; `r.isError === true`, `code === "no_trace_running"`.
- `analyzeInsight()` with no trace: `this.trace === null` in `connection.ts:612` → throws `BrowserError("no_trace_running")`. Test `test_DW_4_1_analyze_without_start_errs` passes.
- Double start: `tracing.ts:41-46` checks `this.running` → throws `BrowserError("trace_already_running")`. Test `test_DW_4_1_double_start_rejects` passes.
- Edge case (start called, stop never called, then analyze): `connection.ts:612` checks `this.trace === null` — passes because `trace` is non-null after start; `tracing.ts:78` then checks `capturedEvents === null` → throws `no_trace_running`. Consistent behavior.
VERDICT:  PASS

### DW-4.2
PREMISE:  `lighthouse_audit` returns a real audit; a run failure returns a structured err (never a zeroed audit reported as success).
EVIDENCE: `src/adapters/puppeteer/lighthouse.ts:35-85`, `src/tools/lighthouse-audit.ts:25-62`, `test/perf-network.test.ts:89-118`
TRACE:
- Run failure path: `lighthouse.ts:59-65` catches the lighthouse() call exception → `throw new BrowserError("lighthouse_failed", ...)`. Null/empty result: `lighthouse.ts:67-73` explicitly checks `!runnerResult || !runnerResult.lhr` → `throw BrowserError("lighthouse_failed", "lighthouse returned no result", ...)`. Never returns scores on failure. Test `test_DW_4_2_run_failure_structured_err` passes: `r.isError === true`, `code === "lighthouse_failed"`, `r.structuredContent.scores === undefined`.
- Unsupported category: tool barricade at `lighthouse-audit.ts:30-38` rejects unknown categories before the adapter runs. Test `test_DW_4_2_unsupported_category_barricade` passes.
- Success shape: FakePort returns `cannedLighthouseScores` + `/tmp/fake-lh.json`; tool wraps into `LighthouseOut`; test `test_DW_4_2_success_shape` passes — scores and report_path present.
VERDICT:  PASS

### DW-4.3
PREMISE:  Network capture → `export_har` produces schema-valid HAR 1.2 via `HarPort` + `writePayload`; an empty buffer yields a valid-but-empty HAR that says so.
EVIDENCE: `src/adapters/fs/har-writer.ts:19-39`, `src/tools/export-har.ts:28-34`, `test/har-writer.test.ts:77-103`, `test/perf-network.test.ts:124-165`
TRACE:
- Schema validity: `har-writer.ts:21-29` constructs `{ log: { version: "1.2", creator, entries: entries.map(toHarEntry) } }`. Test `test_DW_4_3_har_writer_schema_valid` reads the written file and `assertValidHar12()` verifies: `log.version === "1.2"`, creator has name/version strings, entries array with all required HAR 1.2 fields (startedDateTime, time, request.{method,url,headers,queryString}, response.{status,headers,content.size}, timings.{blocked,dns,connect,ssl,send,wait,receive}, cache). 2 entries verified. Passes.
- Empty buffer: `har-writer.ts:22` `entries.map(toHarEntry)` on empty array produces `[]`; still writes valid HAR. Test `test_DW_4_3_empty_buffer_valid_empty` passes — `assertValidHar12(json, 0)` succeeds.
- Atomic write: `har-writer.ts:32-37` writes to `.tmp` then `rename`. Test `test_DW_4_3_atomic_write` verifies `.tmp` file does not exist after write.
- Export via HarPort seam: `export-har.ts:28-34` calls `port.exportHar(har)` which routes entries through the injected `HarPort.write()`. Test `test_DW_4_3_export_routes_through_harport` passes: `har.writes === 1`, `entry_count === 1`, `empty === false`.
- Empty capture says so: `export-har.ts:33` appends `" (valid-but-empty: no traffic was captured)"` to the text result. Test `test_DW_4_3_empty_buffer_valid_empty` (perf-network) verifies `empty === true`, `entry_count === 0`, `har.writes === 1`.
VERDICT:  PASS

### DW-4.4
PREMISE:  `route` (block/abort/stub/modify) applies rules as data; malformed `RouteRule` is rejected at the barricade; captured bodies are size-capped and never executed; interception tears down on disconnect.
EVIDENCE: `src/tools/route.ts:36-93`, `src/adapters/puppeteer/network.ts:111-161`, `src/adapters/puppeteer/connection.ts:140-160`, `test/perf-network.test.ts:171-267`
TRACE:
- Rules as data: barricade maps raw input objects to `RouteRule` plain-data records at `route.ts:56-64` (no callbacks, no eval). Test `test_DW_4_4_rules_applied_as_data` passes: 4 rules (block/abort/stub/modify) reach `port.routes`, body preserved as string.
- Malformed status (999): `route.ts:43-46` rejects → `invalid_route_rule`. Test `test_DW_4_4_malformed_status_rejected` passes.
- Missing status on stub: `route.ts:41-43` rejects → `invalid_route_rule`. Test `test_DW_4_4_stub_without_status_rejected` passes.
- Body size cap: `route.ts:47-52` `Buffer.byteLength(r.body) > RESPONSE_BODY_MAX_BYTES` → `invalid_route_rule`. Test `test_DW_4_4_body_size_capped` passes.
- Empty pattern: `route.ts:37-39` `.trim().length === 0` → `invalid_route_rule`. Test `test_DW_4_4_empty_pattern_rejected` passes.
- Body never executed: network.ts `applyRules()` passes body as a string to `req.respond({ body: rule.body })` — handed to CDP `fulfillRequest`, never `eval()`-ed.
- Response body from untrusted origin (capture side): `network.ts:93-95` only records `Math.min(buf.length, RESPONSE_BODY_MAX_BYTES)` as `encodedDataLength` (the byte count), never the body content itself. The body is size-capped and not stored as content.
- Teardown on disconnect: `connection.ts:143-150` calls `this.network.disable()` (which calls `clearRoutes()`) in `disconnect()`. Test `test_DW_4_4_teardown_on_disconnect` passes: `clearRoutesCalls` incremented, `routes.length === 0`.
- Recovery after failed setRoutes: test `test_DW_4_4_clearRoutes_after_failed_setRoutes` passes: setRoutes throws, then `clear=true` path still succeeds.
VERDICT:  PASS

### DW-4.5
PREMISE:  `emulate` applies network + CPU throttling; out-of-range values clamp or err (defined, not silent).
EVIDENCE: `src/tools/emulate.ts:29-85`, `src/types.ts:326-328 (CPU_THROTTLE_MIN=1, CPU_THROTTLE_MAX=20)`, `test/perf-network.test.ts:274-319`
TRACE:
- Applies preset + CPU: `emulate.ts:74-78` builds `EmulateConditionsOpts` and calls `port.emulateConditions()`. Test `test_DW_4_5_applies_network_and_cpu` passes: `lastEmulate.network === "slow-3g"`, `cpuThrottlingRate === 4`.
- Explicit kbps/latency: `emulate.ts:30-43` folds into `{ downloadKbps, uploadKbps, latencyMs }` object. Test `test_DW_4_5_explicit_network` passes.
- CPU > 20: `emulate.ts:49-58` → `throttle_out_of_range`. Test `test_DW_4_5_cpu_out_of_range_errs` passes: `code === "throttle_out_of_range"`, `lastEmulate === null`.
- CPU < 1 (= 0): same check catches `rate < CPU_THROTTLE_MIN`. Test `test_DW_4_5_cpu_below_min_errs` passes.
- Negative throughput: `emulate.ts:36-41` checks `download < 0 || upload < 0 || latency < 0` → `throttle_out_of_range`. Test `test_DW_4_5_negative_throughput_errs` passes.
- The DW says "clamp or err (defined, not silent)" — implementation chose err over clamp, which satisfies the requirement (it is defined, not silent). No clamp occurs; out-of-range is a hard rejection.
VERDICT:  PASS

### DW-4.6
PREMISE:  `HarPort` is a driven adapter a non-puppeteer test fake can substitute; perf/network use cases added to `BrowserPort` with no puppeteer types in core.
EVIDENCE: `src/core/har-port.ts:55-57`, `test/fake-har-port.ts:8-21`, `test/static.test.ts:37-61`, `test/perf-network.test.ts:155-165`
TRACE:
- `HarPort` interface has one method `write(entries: HarEntry[]): Promise<string>`. `HarEntry` is a plain DTO in `core/har-port.ts` with no puppeteer imports. `FakeHarPort` implements the interface with no puppeteer dependency.
- Test `test_DW_4_6_fake_harport_substitutes` installs `FakeHarPort` via `setHarPort(har)`, runs `export_har`, confirms returned path is `"/tmp/substituted.har"` and `entry_count === 2`. The fake fully substitutes the filesystem writer.
- Static gate `zero puppeteer imports/types in src/core and src/tools` passes (part of 163 passing tests) — verifies no puppeteer leakage into core or tools.
- Static gate `zero lighthouse imports in src/core and src/tools` passes — lighthouse types are adapter-only.
- `BrowserPort` in `browser-port.ts` imports only `HarPort` from `core/har-port.ts` and `targeting.ts` from core — no puppeteer.
VERDICT:  PASS

**All requirements met: YES**

---

## Test-DW Coverage

| DW Item | Automated Tests | Location |
|---------|----------------|----------|
| DW-4.1 | test_DW_4_1_start_stop_analyze_happy, test_DW_4_1_stop_without_start_errs, test_DW_4_1_analyze_without_start_errs, test_DW_4_1_double_start_rejects | perf-network.test.ts:46-82 |
| DW-4.2 | test_DW_4_2_success_shape, test_DW_4_2_run_failure_structured_err, test_DW_4_2_unsupported_category_barricade | perf-network.test.ts:89-118 |
| DW-4.3 | test_DW_4_3_export_routes_through_harport, test_DW_4_3_empty_buffer_valid_empty, test_DW_4_6_fake_harport_substitutes, test_DW_4_3_har_writer_schema_valid, test_DW_4_3_empty_buffer_valid_empty (har-writer), test_DW_4_3_atomic_write | perf-network.test.ts:124-165, har-writer.test.ts:78-103 |
| DW-4.4 | test_DW_4_4_rules_applied_as_data, test_DW_4_4_malformed_status_rejected, test_DW_4_4_stub_without_status_rejected, test_DW_4_4_body_size_capped, test_DW_4_4_empty_pattern_rejected, test_DW_4_4_clear_disarms, test_DW_4_4_teardown_on_disconnect, test_DW_4_4_clearRoutes_after_failed_setRoutes | perf-network.test.ts:171-267 |
| DW-4.5 | test_DW_4_5_applies_network_and_cpu, test_DW_4_5_explicit_network, test_DW_4_5_cpu_out_of_range_errs, test_DW_4_5_cpu_below_min_errs, test_DW_4_5_negative_throughput_errs, test_DW_4_5_clear_throttle | perf-network.test.ts:274-319 |
| DW-4.6 | test_DW_4_6_fake_harport_substitutes (plus two static gate tests) | perf-network.test.ts:155-165, static.test.ts:37-61 |

- [x] All DW items have corresponding automated tests that ran in Step 0
- [x] Test coverage matches the stated level: 27 unit tests (no Chrome required) + 20 skipped live tests (Chrome-gated), with explicit DW-ID naming

Live test coverage (skipped, unverified-here): `test/perf-network.live.test.ts` covers DW-4.1 through DW-4.4 against a real Chrome + FsHarWriter. The skipped count (20) matches the live describe block. Not a FAIL per protocol — noted as unverified in this environment.

---

## Dead Code

None found in the reviewed Phase 4 files. All exported symbols are wired into `register.ts`. The `void existsSync; void rmSync;` at `perf-network.test.ts:353-354` is an explicit reference-retention comment, not dead code.

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Concurrency | PASS | The `trace_already_running` guard at `tracing.ts:41-46` is the only shared state concern. Since MCP tool calls are sequential (one at a time per server process), the flag is not accessed concurrently in production. The guard handles the user-visible "two start calls in sequence" case correctly. |
| Error Handling | PASS | All three lighthouse failure paths (import failure, run exception, null result) throw `BrowserError("lighthouse_failed")`. `network.ts:onResponse` catches `res.buffer()` failure and sets `encodedDataLength = -1` rather than crashing. `clearRoutes()` in `network.ts:122-130` silently swallows CDP exceptions when the page is gone — correct since state is reset regardless. No empty catch blocks that hide bugs. |
| Resources | PASS | `FsHarWriter.write()` uses write-then-rename; the `.tmp` file is always renamed or the rename throws (no leak). `NetworkController.disable()` removes all three listeners (request/response/requestfailed) precisely via stored references. `disconnect()` has a finally block ensuring `this.browser = null` even if close/disconnect throws. |
| Boundaries | PASS | `RESPONSE_BODY_MAX_BYTES = 256 * 1024` is enforced at both the tool barricade (stub/modify body) and the capture side (`network.ts:94`). HTTP status range `100..599` is enforced. CPU throttle range `1..20` is enforced. Negative network values are rejected. |
| Security | PASS | Bodies are strings passed to CDP `fulfillRequest` — they are data to the browser, not executed server-side. Captured response bodies store only the size (`encodedDataLength`), not the content — no untrusted content is stored. The barricade at `route.ts` uses an allowlist (`SUPPORTED` set) for Lighthouse categories (RF-6). URL patterns are length-capped via zod schema (`max(ROUTE_URL_PATTERN_MAX)`). |

---

## Notes (non-blocking)

1. **`analyze_insight` with `trace` non-null but `capturedEvents` null**: when `startTrace()` is called and then `analyzeInsight()` is called without ever calling `stopTrace()`, the `connection.ts:612` check (`this.trace === null`) passes (trace is non-null), and execution falls through to `tracing.ts:78` which checks `capturedEvents === null` and throws `no_trace_running`. The error code is correct but the guard is split across two layers. A unit test for this "started but not stopped → analyze" path is not present (all tests use FakePort, which tracks `traceCaptured` as a boolean). This is not a DW failure — the behavior is correct and the edge case is semantically covered by `test_DW_4_1_analyze_without_start_errs` (which tests the `trace === null` path). The deeper path is exercised in the live test. Noted for completeness.

2. **Live tests unverified in this environment**: `perf-network.live.test.ts` is correctly gated and skipped (20 tests). Chrome is unavailable in the review sandbox. The live suite covers all DW items against the real puppeteer adapter; this is by design.

3. **`network.ts` capture: body content not stored**: the implementation records only `encodedDataLength` (the size), setting it to `Math.min(buf.length, RESPONSE_BODY_MAX_BYTES)`. This is correct per the security requirement ("never stored/executed"), but it means the HAR export produces entries with `content.size` as the capped byte count without the actual body text. HAR consumers that expect `content.text` will see it absent. This is a deliberate design choice (security over completeness), not a bug.

4. **`emulate.ts` rejects "no throttle specified"** (both network and cpu absent) with `throttle_out_of_range`. This reuse of the `throttle_out_of_range` error code for a "nothing specified" case is a minor semantic mismatch — the code suggests a range error but the real issue is missing input. Not a DW failure; the behavior is defined and not silent.

---

**Verdict: PASS**
