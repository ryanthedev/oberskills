/**
 * screenshot tool — writes via the P1 writePayload seam and returns { path, bytes }
 * (the P2 contract; P3 fills the real threshold logic without changing the shape).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { resetSession, setPort } from "../src/core/session.ts";
import type {
  AxNode,
  BrowserPort,
  CollectOpts,
  CollectResult,
  ConnectionInfo,
  ConnectOptions,
  DeviceProfile,
  DismissResult,
  EmulateConditionsOpts,
  ExtractOpts,
  FormFieldState,
  GeolocationOpts,
  HarExportResult,
  InsightMetric,
  InsightResult,
  LighthouseOpts,
  LighthouseResult,
  NavResult,
  PageHandle,
  PdfOpts,
  PermissionsOpts,
  ReadDomOpts,
  RouteRule,
  ScrollOpts,
  SnapshotOpts,
  SnapshotResult,
  StorageOp,
  StorageResult,
  StorageState,
  TabInfo,
  TraceOpts,
  TraceStopResult,
  WaitForTextOpts,
  WaitOpts,
  WaitStrategy,
} from "../src/core/browser-port.ts";
import type { HarPort } from "../src/core/har-port.ts";
import type { FillFormField, InteractAction, InteractOpts, ResolvedTarget, Target } from "../src/core/targeting.ts";
import * as screenshot from "../src/tools/screenshot.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

/** A port whose snapshot/interact are unused; only the capture path matters here. */
class CapturePort implements BrowserPort {
  constructor(private readonly png: Buffer) {}
  async connect(o: ConnectOptions): Promise<ConnectionInfo> {
    return { mode: o.mode, wsEndpoint: "ws://fake", reused: false, tabCount: 1 };
  }
  async disconnect(): Promise<void> {}
  async isAlive(): Promise<boolean> {
    return true;
  }
  async listTabs(): Promise<TabInfo[]> {
    return [];
  }
  async newTab(): Promise<TabInfo> {
    return { tabId: "t", url: "", title: "", active: true };
  }
  async selectTab(): Promise<TabInfo> {
    return { tabId: "t", url: "", title: "", active: true };
  }
  async closeTab(): Promise<void> {}
  activePageHandle(): PageHandle {
    return { tabId: "t" };
  }
  async snapshot(_o?: SnapshotOpts): Promise<SnapshotResult> {
    return { tree: [] as AxNode[], refs: [], nodeCount: 0, truncated: false };
  }
  async resolveTarget(_t: Target): Promise<ResolvedTarget> {
    return { kind: "ref", token: null };
  }
  async interact(_a: InteractAction, _t: Target, _o?: InteractOpts): Promise<void> {}
  async fillForm(_f: FillFormField[]): Promise<void> {}
  async navigate(url: string): Promise<NavResult> {
    return { url };
  }
  async wait(_s: WaitStrategy, _o?: WaitOpts): Promise<void> {}
  async scroll(_o: ScrollOpts): Promise<void> {}
  // capture hook the screenshot tool calls (P2-added port method):
  lastScreenshotOpts?: { fullPage?: boolean; selector?: string };
  async screenshot(opts?: { fullPage?: boolean; selector?: string }): Promise<Buffer> {
    this.lastScreenshotOpts = opts;
    return this.png;
  }
  // P3 stubs — not under test here; CapturePort only tests the screenshot path.
  async readDom(_o?: ReadDomOpts): Promise<string> { return ""; }
  async readAccessibility(): Promise<string> { return "[]"; }
  async extract(_o: ExtractOpts): Promise<unknown[]> { return []; }
  async collect(_o: CollectOpts): Promise<CollectResult> { return { items: [], nothingExpandable: true }; }
  async evaluate(_e: string): Promise<unknown> { return null; }
  async dismiss(): Promise<DismissResult> { return { method: "escape", element: "DIV" }; }
  async readForm(_s: string): Promise<FormFieldState> { return { value: null, checked: null, selectedOptions: null }; }
  // P4 stubs — not under test here.
  async startTrace(_o?: TraceOpts): Promise<void> {}
  async stopTrace(): Promise<TraceStopResult> { return { tracePath: "", bytes: 0 }; }
  async analyzeInsight(m: InsightMetric): Promise<InsightResult> { return { metric: m, found: false, detail: "" }; }
  async lighthouseAudit(_o: LighthouseOpts): Promise<LighthouseResult> { return { scores: {}, reportPath: "" }; }
  async exportHar(_h: HarPort): Promise<HarExportResult> { return { path: "", entryCount: 0, empty: true }; }
  async setRoutes(_r: RouteRule[]): Promise<void> {}
  async clearRoutes(): Promise<void> {}
  async emulateConditions(_o: EmulateConditionsOpts): Promise<void> {}
  // P5 stubs — not under test here.
  async storage(_op: StorageOp): Promise<StorageResult> { return {}; }
  async saveStorageState(): Promise<{ path: string }> { return { path: "" }; }
  async restoreStorageState(_s: StorageState): Promise<{ restored: string[]; skipped: string[] }> { return { restored: [], skipped: [] }; }
  async emulateDevice(_o: DeviceProfile): Promise<void> {}
  async setGeolocation(_o: GeolocationOpts): Promise<void> {}
  async grantPermissions(_o: PermissionsOpts): Promise<void> {}
  async printPdf(_o?: PdfOpts): Promise<{ path: string }> { return { path: "" }; }
  async startScreencast(): Promise<void> {}
  async stopScreencast(): Promise<{ path: string }> { return { path: "" }; }
  async uploadFile(_t: Target, _fp: string): Promise<void> {}
  async captureDownload(_o?: { timeoutMs?: number }): Promise<{ path: string }> { return { path: "" }; }
  async waitForText(_o: WaitForTextOpts): Promise<void> {}
}

/**
 * Build a byte buffer that is a decodable PNG for the purpose of pngDimensions:
 * valid 8-byte signature + width/height uint32s at offsets 16/20, padded to `size`
 * so it also crosses PAYLOAD_THRESHOLD_BYTES and writes to disk.
 */
function fakePng(width: number, height: number, size: number): Buffer {
  const buf = Buffer.alloc(Math.max(size, 24), 0);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) buf[i] = sig[i]!;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("screenshot tool (writes via the writePayload seam)", () => {
  afterEach(() => resetSession());

  test("returns { path, bytes } and writes a file (PNG data is always above the threshold)", async () => {
    // Real PNG data is always large; use a buffer above PAYLOAD_THRESHOLD_BYTES so the
    // writePayload helper writes to disk and returns a real path. Using a tiny buffer
    // would be unrealistic and would trigger the inline path (written=false, path="").
    const { PAYLOAD_THRESHOLD_BYTES } = await import("../src/lib/payload.ts");
    const png = Buffer.alloc(PAYLOAD_THRESHOLD_BYTES + 1, 0x89); // fake PNG bytes
    setPort(new CapturePort(png));
    const r = await screenshot.handler({ full_page: false });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect((s.path as string).length).toBeGreaterThan(0);
    expect(s.bytes).toBe(png.length);
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
  });

  test("parses width/height from the PNG header into the result and text summary", async () => {
    const { PAYLOAD_THRESHOLD_BYTES } = await import("../src/lib/payload.ts");
    const png = fakePng(1280, 720, PAYLOAD_THRESHOLD_BYTES + 1);
    setPort(new CapturePort(png));
    const r = await screenshot.handler({ full_page: false });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.width).toBe(1280);
    expect(s.height).toBe(720);
    expect(r.content[0]?.text).toContain("1280×720px");
    rmSync(s.path as string, { force: true });
  });

  test("omits width/height when the bytes are not a decodable PNG", async () => {
    const { PAYLOAD_THRESHOLD_BYTES } = await import("../src/lib/payload.ts");
    const notPng = Buffer.alloc(PAYLOAD_THRESHOLD_BYTES + 1, 0x00); // no PNG signature
    setPort(new CapturePort(notPng));
    const r = await screenshot.handler({ full_page: false });
    const s = structured(r);
    expect(s.width).toBeUndefined();
    expect(s.height).toBeUndefined();
    rmSync(s.path as string, { force: true });
  });

  test("forwards selector to the port (element-scoped capture)", async () => {
    const png = fakePng(200, 100, 8);
    const port = new CapturePort(png);
    setPort(port);
    const r = await screenshot.handler({ full_page: true, selector: "#main .card" });
    expect(r.isError).toBeUndefined();
    expect(port.lastScreenshotOpts?.selector).toBe("#main .card");
    // full_page is still forwarded; the adapter decides selector takes precedence.
    expect(port.lastScreenshotOpts?.fullPage).toBe(true);
    const s = structured(r);
    if (typeof s.path === "string" && s.path.length > 0) rmSync(s.path, { force: true });
  });

  test("a dead connection returns connection_lost", async () => {
    const png = Buffer.from("x");
    const port = new CapturePort(png);
    port.isAlive = async () => false;
    setPort(port);
    const r = await screenshot.handler({ full_page: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});
