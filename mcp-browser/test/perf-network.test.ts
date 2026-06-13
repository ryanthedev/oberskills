/**
 * Phase 4 — performance / network unit tests (FakePort / FakeHarPort; no Chrome).
 * Tests are the verification gate. ~5:1 dirty:clean.
 *
 * DW-4.1: start/stop/analyze 3 ops; stop/analyze-without-start & double-start → errs
 * DW-4.2: lighthouse run-failure → structured err; unsupported category → barricade reject
 * DW-4.3: export_har via HarPort+writePayload; empty buffer → valid-but-empty HAR
 * DW-4.4: route block/abort/stub/modify as data; malformed RouteRule barricade reject;
 *         body size-cap; teardown on disconnect; clearRoutes after failed setRoutes
 * DW-4.5: emulate network+CPU; out-of-range clamp/err (defined)
 * DW-4.6: HarPort fake substitutes; (no-puppeteer-in-core enforced by static.test.ts)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { resetSession, setPort } from "../src/core/session.ts";
import { FakePort } from "./fake-port.ts";
import { FakeHarPort } from "./fake-har-port.ts";
import { setHarPort } from "../src/core/session.ts";
import { RESPONSE_BODY_MAX_BYTES } from "../src/types.ts";
import * as startTrace from "../src/tools/performance-start-trace.ts";
import * as stopTrace from "../src/tools/performance-stop-trace.ts";
import * as analyzeInsight from "../src/tools/analyze-insight.ts";
import * as lighthouseAudit from "../src/tools/lighthouse-audit.ts";
import * as exportHar from "../src/tools/export-har.ts";
import * as route from "../src/tools/route.ts";
import * as emulate from "../src/tools/emulate.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await port.connect({ mode: "launch" });
  return port;
}

afterEach(() => resetSession());

// ---------------------------------------------------------------------------
// DW-4.1: trace lifecycle (start / stop / analyze)
// ---------------------------------------------------------------------------

describe("trace lifecycle (DW-4.1)", () => {
  test("test_DW_4_1_start_stop_analyze_happy: three operations in order succeed", async () => {
    await fresh();
    const s = await startTrace.handler({ screenshots: false });
    expect(s.isError).toBeUndefined();

    const st = await stopTrace.handler({});
    expect(st.isError).toBeUndefined();
    expect(typeof structured(st).trace_path).toBe("string");

    const a = await analyzeInsight.handler({ metric: "LCP" });
    expect(a.isError).toBeUndefined();
    expect(structured(a).metric).toBe("LCP");
    expect(structured(a).found).toBe(true);
  });

  test("test_DW_4_1_stop_without_start_errs: stop with no trace → no_trace_running (not empty)", async () => {
    await fresh();
    const r = await stopTrace.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("no_trace_running");
  });

  test("test_DW_4_1_analyze_without_start_errs: analyze with no captured trace → no_trace_running", async () => {
    await fresh();
    const r = await analyzeInsight.handler({ metric: "CLS" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("no_trace_running");
  });

  test("test_DW_4_1_double_start_rejects: second start before stop → trace_already_running", async () => {
    await fresh();
    await startTrace.handler({ screenshots: false });
    const r = await startTrace.handler({ screenshots: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("trace_already_running");
  });
});

// ---------------------------------------------------------------------------
// DW-4.2: lighthouse audit
// ---------------------------------------------------------------------------

describe("lighthouse audit (DW-4.2)", () => {
  test("test_DW_4_2_success_shape: returns category scores + a report path", async () => {
    const port = await fresh();
    port.cannedLighthouseScores = { performance: 0.92, seo: 0.8 };
    const r = await lighthouseAudit.handler({ categories: ["performance", "seo"] });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect((s.scores as Record<string, number>).performance).toBe(0.92);
    expect(typeof s.report_path).toBe("string");
  });

  test("test_DW_4_2_run_failure_structured_err: a run failure → lighthouse_failed, never a zeroed audit as success", async () => {
    const port = await fresh();
    port.lighthouseError = "Chrome interstitial blocked the run";
    const r = await lighthouseAudit.handler({ categories: ["performance"] });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("lighthouse_failed");
    // never reports scores on failure
    expect(structured(r).scores).toBeUndefined();
  });

  test("test_DW_4_2_unsupported_category_barricade: an unknown category is rejected before the adapter", async () => {
    await fresh();
    // bypass zod by calling with an unsupported category string
    const r = await lighthouseAudit.handler({
      categories: ["telepathy"] as unknown as ("performance")[],
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("lighthouse_failed");
  });
});

// ---------------------------------------------------------------------------
// DW-4.3 / DW-4.6: export_har via HarPort + writePayload
// ---------------------------------------------------------------------------

describe("export_har (DW-4.3, DW-4.6)", () => {
  test("test_DW_4_3_export_routes_through_harport: a populated buffer writes entries via the injected HarPort", async () => {
    const port = await fresh();
    const har = new FakeHarPort();
    setHarPort(har);
    port.harEntries = [sampleEntry("https://a.test/x")];
    const r = await exportHar.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.entry_count).toBe(1);
    expect(s.empty).toBe(false);
    expect(s.path).toBe(har.returnPath);
    expect(har.writes).toBe(1);
    expect(har.lastEntries?.length).toBe(1);
  });

  test("test_DW_4_3_empty_buffer_valid_empty: an empty buffer yields a valid-but-empty HAR that says so", async () => {
    const port = await fresh();
    const har = new FakeHarPort();
    setHarPort(har);
    port.harEntries = [];
    const r = await exportHar.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.empty).toBe(true);
    expect(s.entry_count).toBe(0);
    // still wrote a (valid-but-empty) HAR
    expect(har.writes).toBe(1);
    expect(har.lastEntries).toEqual([]);
  });

  test("test_DW_4_6_fake_harport_substitutes: a non-puppeteer HarPort fully substitutes the writer", async () => {
    const port = await fresh();
    const har = new FakeHarPort();
    har.returnPath = "/tmp/substituted.har";
    setHarPort(har);
    port.harEntries = [sampleEntry("https://b.test/y"), sampleEntry("https://b.test/z")];
    const r = await exportHar.handler({});
    expect(structured(r).path).toBe("/tmp/substituted.har");
    expect(structured(r).entry_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// DW-4.4: route (block/abort/stub/modify) as data + barricade
// ---------------------------------------------------------------------------

describe("route interception (DW-4.4)", () => {
  test("test_DW_4_4_rules_applied_as_data: block/abort/stub/modify rules reach setRoutes as a data list", async () => {
    const port = await fresh();
    const r = await route.handler({
      rules: [
        { url_pattern: "*.png", action: "block" },
        { url_pattern: "/api/abort", action: "abort" },
        { url_pattern: "/api/users", action: "stub", status: 200, body: '{"ok":true}', content_type: "application/json" },
        { url_pattern: "/api/mod", action: "modify", status: 503, body: "down", content_type: "text/plain" },
      ],
      clear: false,
    });
    expect(r.isError).toBeUndefined();
    expect(structured(r).armed).toBe(true);
    expect(structured(r).rule_count).toBe(4);
    expect(port.routes.length).toBe(4);
    expect(port.routes.map((x) => x.action)).toEqual(["block", "abort", "stub", "modify"]);
    // body preserved as data, never executed
    expect(port.routes[2]?.body).toBe('{"ok":true}');
  });

  test("test_DW_4_4_malformed_status_rejected: stub status out of 100..599 → invalid_route_rule (barricade)", async () => {
    const port = await fresh();
    const r = await route.handler({
      rules: [{ url_pattern: "/x", action: "stub", status: 999, body: "x" }],
      clear: false,
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_route_rule");
    expect(port.routes.length).toBe(0); // never reached the adapter
  });

  test("test_DW_4_4_stub_without_status_rejected: stub/modify with no status → invalid_route_rule", async () => {
    const port = await fresh();
    const r = await route.handler({
      rules: [{ url_pattern: "/x", action: "stub", body: "x" }],
      clear: false,
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_route_rule");
    expect(port.routes.length).toBe(0);
  });

  test("test_DW_4_4_body_size_capped: a stub body over the cap → invalid_route_rule (untrusted, never streamed)", async () => {
    const port = await fresh();
    const big = "z".repeat(RESPONSE_BODY_MAX_BYTES + 1);
    const r = await route.handler({
      rules: [{ url_pattern: "/x", action: "stub", status: 200, body: big }],
      clear: false,
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_route_rule");
    expect(port.routes.length).toBe(0);
  });

  test("test_DW_4_4_empty_pattern_rejected: an empty url_pattern → invalid_route_rule", async () => {
    const port = await fresh();
    const r = await route.handler({
      rules: [{ url_pattern: "", action: "block" }],
      clear: false,
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_route_rule");
    expect(port.routes.length).toBe(0);
  });

  test("test_DW_4_4_clear_disarms: clear=true disarms all interception via clearRoutes", async () => {
    const port = await fresh();
    await route.handler({ rules: [{ url_pattern: "*", action: "block" }], clear: false });
    expect(port.routes.length).toBe(1);
    const r = await route.handler({ rules: [], clear: true });
    expect(r.isError).toBeUndefined();
    expect(structured(r).armed).toBe(false);
    expect(port.routes.length).toBe(0);
    expect(port.clearRoutesCalls).toBeGreaterThanOrEqual(1);
  });

  test("test_DW_4_4_teardown_on_disconnect: disconnect clears armed interception (no leak)", async () => {
    const port = await fresh();
    await route.handler({ rules: [{ url_pattern: "*", action: "block" }], clear: false });
    const before = port.clearRoutesCalls;
    await port.disconnect();
    expect(port.clearRoutesCalls).toBe(before + 1);
    expect(port.routes.length).toBe(0);
  });

  test("test_DW_4_4_clearRoutes_after_failed_setRoutes: clear is callable even after setRoutes fails", async () => {
    const port = await fresh();
    port.setRoutesError = "interception failed to arm";
    const failed = await route.handler({ rules: [{ url_pattern: "*", action: "block" }], clear: false });
    expect(failed.isError).toBe(true);
    // recovery: clear must still work
    const cleared = await route.handler({ rules: [], clear: true });
    expect(cleared.isError).toBeUndefined();
    expect(port.routes.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DW-4.5: emulate (network + CPU throttle), out-of-range defined
// ---------------------------------------------------------------------------

describe("emulate throttling (DW-4.5)", () => {
  test("test_DW_4_5_applies_network_and_cpu: a preset + CPU rate reach emulateConditions", async () => {
    const port = await fresh();
    const r = await emulate.handler({ network: "slow-3g", cpu_throttling_rate: 4 });
    expect(r.isError).toBeUndefined();
    expect(port.lastEmulate?.network).toBe("slow-3g");
    expect(port.lastEmulate?.cpuThrottlingRate).toBe(4);
  });

  test("test_DW_4_5_explicit_network: explicit kbps/latency folds into a NetworkProfile object", async () => {
    const port = await fresh();
    const r = await emulate.handler({ download_kbps: 1000, upload_kbps: 500, latency_ms: 40 });
    expect(r.isError).toBeUndefined();
    expect(port.lastEmulate?.network).toEqual({ downloadKbps: 1000, uploadKbps: 500, latencyMs: 40 });
  });

  test("test_DW_4_5_cpu_out_of_range_errs: CPU rate > max → throttle_out_of_range (defined, not silent)", async () => {
    const port = await fresh();
    const r = await emulate.handler({ cpu_throttling_rate: 99 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("throttle_out_of_range");
    expect(port.lastEmulate).toBeNull();
  });

  test("test_DW_4_5_cpu_below_min_errs: CPU rate < 1 → throttle_out_of_range", async () => {
    const port = await fresh();
    const r = await emulate.handler({ cpu_throttling_rate: 0 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("throttle_out_of_range");
    expect(port.lastEmulate).toBeNull();
  });

  test("test_DW_4_5_negative_throughput_errs: a negative download_kbps → throttle_out_of_range", async () => {
    const port = await fresh();
    const r = await emulate.handler({ download_kbps: -1, upload_kbps: 100, latency_ms: 0 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("throttle_out_of_range");
    expect(port.lastEmulate).toBeNull();
  });

  test("test_DW_4_5_clear_throttle: network=none clears throttling", async () => {
    const port = await fresh();
    const r = await emulate.handler({ network: "none" });
    expect(r.isError).toBeUndefined();
    expect(port.lastEmulate?.network).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sampleEntry(url: string) {
  return {
    startedDateTime: new Date().toISOString(),
    timeMs: 12,
    request: {
      method: "GET",
      url,
      httpVersion: "HTTP/1.1",
      headers: [],
      queryString: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: "OK",
      httpVersion: "HTTP/1.1",
      headers: [],
      content: { size: 10, mimeType: "text/html" },
      redirectURL: "",
      headersSize: -1,
      bodySize: 10,
    },
    timings: { blocked: -1, dns: -1, connect: -1, ssl: -1, send: -1, wait: 5, receive: 0 },
  };
}

// Keep existsSync/rmSync referenced (used by HAR writer test below if extended).
void existsSync;
void rmSync;
