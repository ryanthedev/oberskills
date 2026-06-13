# Discovery + Design: Phase 4 — DevTools: performance + network

## Files Found
Existing seams Phase 4 consumes (read, not rewritten):
- `src/core/browser-port.ts` — `BrowserPort` interface (P1 connect/tabs + P2 snapshot/interact/nav + P3 reads). EXTEND with perf/network.
- `src/core/errors.ts` — `BrowserError {code,message,suggestion}` + `BrowserErrorCode` union. ADD P4 codes.
- `src/core/session.ts` — `getPort()/setPort()/resetSession()` singleton accessor.
- `src/core/targeting.ts` — Strategy types (not needed by P4 directly).
- `src/lib/payload.ts` — `writePayload(data, opts, write?) → {path,bytes,inlinedPreview,written}` + `PAYLOAD_THRESHOLD_BYTES=4096`. Injectable `WriteFn`. ROUTE HAR/trace/bodies here.
- `src/lib/tool.ts` — `ok()/err()/errFromBrowserError`, `ensureAlive(port)`, `runPort(op)`, `ToolModule`.
- `src/register.ts` — `defineTool` + `TOOLS[]` + single error boundary. ADD P4 tools to `TOOLS`.
- `src/types.ts` — zod input schemas + output DTOs (single home).
- `src/adapters/puppeteer/connection.ts` — `PuppeteerConnectionManager implements BrowserPort`; private `activePage(): Promise<Page>`, `requireBrowser()`. The ONLY puppeteer-importing area. EXTEND with perf/network methods + a CDP-backed trace/network/route/throttle implementation.
- `test/fake-port.ts` — `FakePort implements BrowserPort`. EXTEND with P4 method fakes.
- `test/static.test.ts` — greps `src/core` + `src/tools` for puppeteer imports/`Puppeteer.` refs (comments stripped). Will also catch a stray `lighthouse` import if I add that to the grep — see Design.
- `test/read-tools.test.ts` — the P3 unit-test pattern I mirror (FakePort + `setPort` + tool handler + structuredContent assertions).

## Current State
- P1-P3 shipped (commits 808bb7f, d49689e, 78ad059). 135 unit tests green, tsc clean.
- `BrowserPort` has connect/tabs/snapshot/interact/navigate/wait/scroll/screenshot/readDom/readAccessibility/extract/collect/evaluate/dismiss/readForm.
- 21 tools registered in `register.ts`.
- Adapter pattern: every port method does `const page = await this.activePage()` then puppeteer work; throws `BrowserError` for structured failures; the tool barricade (`runPort`) converts to `err()`.

## Assumption Verification (Lighthouse — the gating risk)
Plan assumption: "Lighthouse runs cleanly in-process via puppeteer-core under bun (Confidence Low–Medium)."

**Verified empirically before design:**
| Probe | Result |
|---|---|
| `bun add lighthouse` | installed `lighthouse@13.4.0`, 122 packages, exit 0 |
| `import("lighthouse")` under bun | `LH_IMPORT_OK type=function` |
| Launch Chrome via puppeteer-core + run `lighthouse(url, {port})` in-process under bun | `LH_RUN_OK perfScore=1 audits=49` against https://example.com |
| `page.tracing.start/stop` → buffer | `trace buffer bytes=66883` |
| `page.createCDPSession()`, `emulateNetworkConditions`, `emulateCPUThrottling`, `setRequestInterception` | all `function` |

**DECISION: DW-4.2 is IN the P4 gate, implemented fully.** No fallback (no Node child spawn, no deferral). Lighthouse runs in-process under bun against a puppeteer-core launched Chrome. The debugging port is extracted from `browser.wsEndpoint()` (`new URL(ws).port`). `lighthouse` added as a real dependency in `package.json` (`^13.4.0`).

## Gaps
| # | Gap | Resolution |
|---|---|---|
| 1 | Lighthouse needs the CDP **debugging port**, which only the puppeteer adapter holds (`browser.wsEndpoint()`). `lib/lighthouse.ts` as a core-neutral runner can't reach it without a port number. | Lighthouse runner is **adapter-internal** (`adapters/puppeteer/lighthouse.ts`), invoked from the adapter's `lighthouseAudit()` port method. `lib/lighthouse.ts` holds only the pure category/flag validation + result-shaping (no puppeteer/lighthouse import) if needed; the lighthouse import lives in the adapter so the static boundary test stays green. Plan's `lib/lighthouse.ts` file hint is honored as the *pure* helper home; the in-process invocation is adapter-side (necessary — the boundary requires it). |
| 2 | `HarPort` is a NEW core port (not part of `BrowserPort`). | New `src/core/har-port.ts` with `interface HarPort { write(entries: HarEntry[]): Promise<string> }` + `HarEntry` DTO. Real adapter `src/adapters/fs/har-writer.ts`; a fake substitutes it in tests (DW-4.6). |
| 3 | Network capture buffer must persist across requests within a session and be queryable/exportable. | Adapter holds an in-memory `NetworkEntry[]` buffer, wired via CDP `Network.*` events on a per-page CDP session. `export_har` maps buffer→`HarEntry[]`→`HarPort.write`. |
| 4 | Interception teardown on disconnect. | `disconnect()` (already in adapter) calls `clearRoutes()` + detaches CDP/interception before closing. RefRegistry's epoch pattern is the model: state cleared on lifecycle change. |
| 5 | RouteRule is data, validated at the barricade. | `RouteRule` zod schema in `types.ts`; the `route` tool validates (URL pattern parseable, status in 100–599, body size-capped) BEFORE `port.setRoutes()`. Adapter applies rules as data in a single `request` handler — no per-tool callbacks. |

## Code Standards
No `docs/code-standards.md` in the worktree root or `mcp-browser/`. Conventions taken from `CLAUDE.md` + the established P1-P3 code: Bun + strict TS, `bunx tsc --noEmit` + `bun test` clean, **no `console.log` in `src/`** (stderr via `lib/log.ts`), all zod in `types.ts`, `satisfies ToolModule`, `ok()/err()`, structured `BrowserError`, payloads to disk via `writePayload`, **no puppeteer types in core/tools** (static-enforced) — and by extension **no lighthouse import in core/tools** (adapter-only).

## Test Infrastructure
- `bun:test` (`describe/test/expect`, `afterEach(resetSession)`).
- Unit: `FakePort` + `setPort()`, call tool `handler()`, assert `structuredContent` + `isError`. Fakes throw `BrowserError` to exercise the barricade.
- Live: gated behind `RUN_LIVE_EVALS=1`, real Chrome (`test/*.live.test.ts`).
- Static: `test/static.test.ts` (console.log grep, puppeteer-boundary grep, tsc).
- A `FakeHarPort` (records `write(entries)` → returns a path) substitutes the real writer (DW-4.6).

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-4.1 | start/stop/analyze as 3 ops; stop/analyze w/o start & double-start → errs (not empty) | COVERED | `test_DW_4_1_stop_without_start_errs`, `test_DW_4_1_analyze_without_start_errs`, `test_DW_4_1_double_start_rejects`, `test_DW_4_1_start_stop_analyze_happy` (fake); live `start/stop/analyze LCP/INP/CLS` |
| DW-4.2 | lighthouse_audit returns a real audit; run failure → structured err (never zeroed-as-success) | COVERED (IN gate — verified runs under bun) | `test_DW_4_2_run_failure_structured_err` (fake throws → err), `test_DW_4_2_unsupported_category_barricade` (bad category rejected pre-adapter), `test_DW_4_2_success_shape` (fake returns scores); live `lighthouse_audit` against example.com |
| DW-4.3 | capture → export_har schema-valid HAR 1.2 via HarPort+writePayload; empty buffer → valid-but-empty HAR that says so | COVERED | `test_DW_4_3_har_writer_schema_valid` (real `har-writer` emits HAR 1.2: log.version="1.2", creator, entries[], each entry request/response/timings), `test_DW_4_3_empty_buffer_valid_empty` (entries=[], `empty:true` flag), `test_DW_4_3_export_routes_through_writePayload` (FakeHarPort + writePayload path); live capture→export |
| DW-4.4 | route block/abort/stub/modify as data; malformed RouteRule barricade-rejected; bodies size-capped & never executed; teardown on disconnect | COVERED | `test_DW_4_4_rules_applied_as_data` (FakePort records `setRoutes(rules)`), `test_DW_4_4_malformed_rule_rejected` (bad url/status/oversized body → err pre-adapter), `test_DW_4_4_body_size_capped` (response body over cap → capped via writePayload, never eval'd), `test_DW_4_4_teardown_on_disconnect` (disconnect → clearRoutes called), `test_DW_4_4_clearRoutes_after_failed_setRoutes` (rollback primitive); live block+stub |
| DW-4.5 | emulate applies network+CPU throttle; out-of-range clamp or err (defined, not silent) | COVERED | `test_DW_4_5_applies_network_and_cpu` (FakePort records emulateConditions), `test_DW_4_5_cpu_out_of_range_errs`, `test_DW_4_5_negative_throughput_errs`, `test_DW_4_5_clear_throttle` (profile=none); live throttle |
| DW-4.6 | HarPort is a driven adapter a non-puppeteer fake substitutes; perf/network use cases in BrowserPort w/ no puppeteer types in core | COVERED | `test_DW_4_6_fake_harport_substitutes` (export_har works with FakeHarPort, zero puppeteer), static `zero puppeteer imports/types in src/core and src/tools` (extended assertion: also covers lighthouse import staying out of core/tools) |

**All items COVERED:** YES (6/6 DW-IDs; prompt lists DW-4.1–4.6 = 6; count matches). DW-4.2 IN the gate.

## Design Decisions

### Design: BrowserPort perf/network extension + HarPort
APOSD design-it-twice on the three sub-modules (trace lifecycle, network/HAR, HarPort seam).

#### Approaches Considered (network capture + HAR)
1. **One `captureNetwork()` returning the full buffer to the tool, tool builds HAR.** Tool layer owns HAR shape.
2. **Adapter holds a network buffer keyed to the CDP session; `exportHar()` on the port maps buffer→HarEntry[] and calls an injected `HarPort.write`; tool only triggers + routes the returned path through writePayload.** HAR 1.2 schema hidden in the `har-writer` adapter; buffer hidden in the puppeteer adapter.
3. **A standalone NetworkRecorder class the tool wires up per call.** Tool orchestrates recorder + writer.

#### Comparison
| Criterion | A | B | C |
|-----------|---|---|---|
| Interface simplicity | Med (tool sees raw entries) | **High (port: setRoutes/clearRoutes/exportHar + buffer hidden)** | Low (tool wires recorder) |
| Information hiding | Low (HAR schema leaks to tool) | **High (schema in har-writer; buffer in adapter)** | Low |
| Caller ease of use | Med | **High (trigger + get a path)** | Low (temporal wiring in tool) |
| HarPort substitutability (DW-4.6) | weak | **strong (injected port)** | weak |
| Puppeteer-in-core risk | high (NetworkEntry shape leaks) | **none (core DTO only)** | high |

**Choice: B.** HAR 1.2 detail lives only in `adapters/fs/har-writer.ts`; the network buffer lives only in the puppeteer adapter; `HarPort` is the injected seam a fake substitutes. Sacrifices: the adapter is heavier (holds buffer + CDP wiring) — acceptable; that is exactly the information it should hide.

#### Depth Check
- `HarPort` interface methods: **1** (`write(entries) → path`) — deep: hides the entire HAR 1.2 schema, ordering, timings math, atomic write-then-rename.
- `BrowserPort` additions: `startTrace/stopTrace/analyzeInsight/lighthouseAudit/captureNetworkStart?/exportHar/setRoutes/clearRoutes/emulateConditions`. Trace is 3 ops by mandate (start/stop/analyze) — not collapsed (the long-op split the plan pins).
- Hidden details: CDP session lifecycle, trace category set, CWV extraction from the trace, lighthouse port extraction, network buffer, interception request-handler, throttle CDP commands, HAR schema.
- Common case complexity: simple (trigger → get a path / a metric).

### Network capture model (decision)
`setRoutes/clearRoutes` arm interception; a **separate network capture buffer** records all requests/responses regardless of routing (capture is observation, routing is mutation — distinct concerns, не folded). Capture is armed lazily when `exportHar` is first wanted OR always-on per page; chosen: **capture buffer wired on connect/newTab via a CDP session**, cleared on disconnect. `exportHar` snapshots the buffer → `HarEntry[]`. Empty buffer → valid HAR with `entries: []` and an `empty: true` signal in the tool result text + structuredContent.

### RouteRule (data, validated at barricade) — security-sensitive
```
type RouteRule = {
  urlPattern: string;          // glob/substring; validated parseable, length-capped
  action: "block" | "abort" | "stub" | "modify";
  status?: number;             // stub/modify: 100..599 (barricade-clamped/rejected)
  body?: string;               // stub/modify: size-capped (REQUEST_BODY_MAX_BYTES); never eval'd
  contentType?: string;        // stub/modify: content-type aware
  headers?: Record<string,string>;
};
```
- Barricade (`route` tool) validates BEFORE `port.setRoutes`: urlPattern non-empty & length-capped; `status` in 100–599 (else err); `body` byte-length ≤ cap (else err) — RF-6 allowlist of actions via zod enum.
- Adapter applies the rule list as **data** in ONE `request` handler (no per-tool callbacks). A `modify` rule producing a malformed response is rejected at the barricade (status/body validated there), never corrupting the stream.
- **Untrusted bodies:** captured response bodies are external input — size-capped via `writePayload` (over threshold → /tmp path, never inlined), never executed (they are strings handed to CDP `fulfillRequest`, never `eval`'d in Node), content-type carried as data.
- **Teardown:** `disconnect()` calls `clearRoutes()` and disables interception/detaches the CDP session — no leaked global interception armed into a later session. `clearRoutes()` is callable even after a failed `setRoutes()` (the rollback/recovery primitive — it resets adapter state unconditionally).
- **Chrome dies mid-interception:** on reconnect the CDP session is gone; `isAlive()` is false and the adapter's route state is reset on the next connect — the tool reports interception is gone honestly (no assume-persisted).

### Trace lifecycle (3 ops, defensive)
- Adapter holds `tracing: "idle" | "running"` + a `tracePath: string | null`.
- `startTrace`: if already running → `BrowserError("trace_already_running")` (concurrent-trace reject). Else `page.tracing.start({categories})`.
- `stopTrace`: if not running → `BrowserError("no_trace_running")`. Else `page.tracing.stop()` → Buffer → `writePayload(buf, {ext:"json"})` → `{tracePath}`.
- `analyzeInsight(metric)`: if no trace captured → `BrowserError("no_trace_running")` (analyze-without-start). Else parse the captured trace for LCP/INP/CLS from `devtools.timeline`/`loading` events and return `InsightResult {metric, valueMs?, value?, details}`.

### Throttle (defensive clamp/err)
- `emulateConditions({network?, cpuThrottlingRate?})`. `cpuThrottlingRate` must be ≥1 (1 = no throttle); `<1` or `>20` → `BrowserError("throttle_out_of_range")` (defined, not silent). Network profiles: named presets (`none|offline|slow-3g|fast-3g|...`) or explicit `{downloadKbps,uploadKbps,latencyMs}` with negative values rejected. Decision: **err** on out-of-range (correctness lean — a wrong throttle silently applied corrupts a perf measurement, RF-12) rather than silent clamp; the plan permits either, err is the safer default for a measurement tool.

### Lighthouse (adapter-internal, DW-4.2 in gate)
- `lighthouseAudit({categories})` on the port. Adapter extracts the debugging port from `browser.wsEndpoint()`, imports `lighthouse` (adapter-only), runs in-process, returns `{categories: {perf?:number, a11y?:number, seo?:number, bestPractices?:number}, reportPath}` (full report routed through `writePayload`).
- Barricade: category names validated against a known set (`performance|accessibility|seo|best-practices`) in the tool BEFORE the adapter — unsupported flag → err.
- Run failure (lighthouse throws or returns null) → `BrowserError("lighthouse_failed", reason, ...)` — **never a zeroed audit reported as success** (RF-12, correctness lean).

### New error codes (errors.ts)
`trace_already_running`, `no_trace_running`, `lighthouse_failed`, `invalid_route_rule`, `har_export_failed`, `throttle_out_of_range`.

## Prerequisites
- [x] P1-P3 seams exist (`BrowserPort`, `writePayload`, `tool.ts`, `register.ts`, `errors.ts`, adapter).
- [x] `lighthouse@^13.4.0` dependency installed and verified runnable under bun in-process.
- [x] puppeteer-core tracing/CDP/emulation/interception APIs verified present.
- [x] FakePort + static-boundary test patterns understood.

## Recommendation
**BUILD.** All capabilities verified; DW-4.2 (Lighthouse) is IN the gate — runs in-process under bun, no fallback needed. No UPDATE_PLAN. Proceed to TDD: extend errors → core ports (`browser-port.ts` perf/network + new `har-port.ts`) → types (zod RouteRule/inputs + DTOs) → FakePort/FakeHarPort → unit tests (red) → adapters (`fs/har-writer.ts`, `puppeteer/tracing.ts`, `puppeteer/network.ts`, `puppeteer/lighthouse.ts`, adapter wiring) + tools → green → live tests → static green.
