# browser skill — Performance and network reference

Tools for performance tracing, Lighthouse audits, HAR capture, request interception, and network/CPU throttling.

---

## Performance traces (3-step workflow)

Capture Core Web Vitals by tracing across a navigation.

| Tool | Step | What it does |
|---|---|---|
| `browser_performance_start_trace` | 1 | Starts the Chrome performance trace. A second start before stop returns `trace_already_running`. |
| `browser_performance_stop_trace` | 2 | Stops the trace and writes to `/tmp`, returning `{ trace_path, bytes }`. Never inlines trace bytes — route the path to `browser_analyze_insight`. |
| `browser_analyze_insight` | 3 | Extracts a Core Web Vital from the most recent captured trace: `LCP`, `INP`, `CLS`, `TTFB`, or `FCP`. Returns the metric value; no captured trace → `no_trace_running`. |

**Typical flow:** start trace → navigate → stop trace → analyze_insight for each metric.

---

## Lighthouse audit

| Tool | What it does |
|---|---|
| `browser_lighthouse_audit` | Runs a Lighthouse audit against the active page and returns 0–1 category scores plus a report file path. Categories: `performance`, `accessibility`, `seo`, `best-practices`. A run failure returns a typed error, not a score of 0. |

---

## HAR capture and network routing

HAR capture is always active while the server is running — the buffer accumulates all requests. Export when needed.

| Tool | What it does |
|---|---|
| `browser_export_har` | Writes the captured network traffic to a HAR 1.2 file, returns `{ path, entry_count, empty }`. An empty buffer yields a valid but empty HAR (`empty=true`). Route the path to a subagent — HAR files are large. |
| `browser_route` | Arms request interception from a rule list: `block`, `abort`, `stub`, or `modify` matched requests. Pass `clear=true` (or an empty rules list) to disarm all interception. Malformed rules are rejected at the barricade, not silently ignored. |

---

## Network and CPU throttling

| Tool | What it does |
|---|---|
| `browser_emulate` | Applies network throttling (`none`, `offline`, `slow-3g`, `fast-3g`, or explicit `download_kbps`/`upload_kbps`/`latency_ms`) and/or CPU throttling (`cpu_throttling_rate`, 1–20 slowdown factor). Use before measuring performance to simulate realistic conditions. |
