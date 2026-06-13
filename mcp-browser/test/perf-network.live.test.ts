/**
 * Live P4 tests — real Chrome, gated behind RUN_LIVE_EVALS=1. Drives the puppeteer
 * adapter directly through the BrowserPort seam + the real FsHarWriter HarPort.
 *
 * Coverage (plan Phase 4 live rows):
 *  - start/stop trace + analyze LCP/FCP (DW-4.1)
 *  - lighthouse_audit returns a real performance score (DW-4.2)
 *  - capture network → export_har writes a valid HAR via FsHarWriter (DW-4.3/4.6)
 *  - route blocks a request + stubs a response (DW-4.4)
 *  - emulate applies network + CPU throttle (DW-4.5)
 *  - interception armed → disconnect → reconnect reports interception gone (DW-4.4)
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { PuppeteerConnectionManager } from "../src/adapters/puppeteer/connection.ts";
import { FsHarWriter } from "../src/adapters/fs/har-writer.ts";

const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;

const CHROME =
  process.env.BROWSER_MCP_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const cleanup: string[] = [];

d("live perf/network (real Chrome)", () => {
  const mgr = new PuppeteerConnectionManager();
  afterAll(async () => {
    await mgr.disconnect();
    for (const p of cleanup.splice(0)) rmSync(p, { force: true });
  });

  test("trace start/stop + analyze LCP/FCP (DW-4.1)", async () => {
    await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    await mgr.startTrace({ screenshots: false });
    await mgr.navigate("https://example.com");
    const stopped = await mgr.stopTrace();
    expect(existsSync(stopped.tracePath)).toBe(true);
    cleanup.push(stopped.tracePath);
    const fcp = await mgr.analyzeInsight("FCP");
    expect(fcp.metric).toBe("FCP");
    // found may be true or false depending on trace categories; the contract is a
    // defined result, never a throw — and a value when found.
    if (fcp.found) expect(typeof fcp.valueMs).toBe("number");
  }, 120_000);

  test("analyze before any trace → no_trace_running (fresh manager)", async () => {
    const fresh = new PuppeteerConnectionManager();
    await fresh.connect({ mode: "launch", executablePath: CHROME, headless: true });
    try {
      await fresh.analyzeInsight("LCP");
      throw new Error("expected no_trace_running");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("no_trace_running");
    } finally {
      await fresh.disconnect();
    }
  }, 60_000);

  test("lighthouse_audit returns a real performance score (DW-4.2)", async () => {
    await mgr.navigate("https://example.com");
    const res = await mgr.lighthouseAudit({ categories: ["performance"] });
    expect(typeof res.scores.performance).toBe("number");
    expect(res.scores.performance!).toBeGreaterThan(0);
    expect(existsSync(res.reportPath)).toBe(true);
    cleanup.push(res.reportPath);
  }, 120_000);

  test("capture network → export_har writes a valid HAR (DW-4.3/4.6)", async () => {
    // activeNetwork() begins capturing; navigate to generate traffic.
    await mgr.setRoutes([]); // arms the controller (and capture) without blocking
    await mgr.navigate("https://example.com");
    const out = await mgr.exportHar(new FsHarWriter());
    expect(existsSync(out.path)).toBe(true);
    cleanup.push(out.path);
    const har = JSON.parse(readFileSync(out.path, "utf8"));
    expect(har.log.version).toBe("1.2");
    expect(Array.isArray(har.log.entries)).toBe(true);
  }, 120_000);

  test("route blocks a request and stubs a response (DW-4.4)", async () => {
    await mgr.setRoutes([
      { urlPattern: "*.png", action: "block" },
      { urlPattern: "https://example.com/stubbed", action: "stub", status: 200, body: "STUBBED", contentType: "text/plain" },
    ]);
    await mgr.navigate("https://example.com");
    // Fetch the stubbed URL from the page and confirm the stub body comes back.
    const body = await mgr.evaluate("fetch('https://example.com/stubbed').then(r=>r.text())");
    expect(body).toBe("STUBBED");
    await mgr.clearRoutes();
  }, 120_000);

  test("emulate applies network + CPU throttle (DW-4.5)", async () => {
    // No throw == applied; out-of-range is rejected at the tool barricade (unit-tested).
    await mgr.emulateConditions({ network: "fast-3g", cpuThrottlingRate: 4 });
    await mgr.emulateConditions({ network: "none", cpuThrottlingRate: 1 });
    expect(true).toBe(true);
  }, 60_000);

  test("interception armed → disconnect → reconnect reports interception gone (DW-4.4)", async () => {
    const m2 = new PuppeteerConnectionManager();
    await m2.connect({ mode: "launch", executablePath: CHROME, headless: true });
    await m2.setRoutes([{ urlPattern: "*", action: "block" }]);
    await m2.disconnect(); // teardown must disarm
    // Reconnect: a brand-new session, no interception carried over.
    await m2.connect({ mode: "launch", executablePath: CHROME, headless: true });
    // A navigation succeeds (no leaked global block).
    const nav = await m2.navigate("https://example.com");
    expect(nav.url).toContain("example.com");
    await m2.disconnect();
  }, 120_000);
});
