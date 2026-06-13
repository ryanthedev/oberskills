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
  ConnectionInfo,
  ConnectOptions,
  NavResult,
  PageHandle,
  ScrollOpts,
  SnapshotOpts,
  SnapshotResult,
  TabInfo,
  WaitOpts,
  WaitStrategy,
} from "../src/core/browser-port.ts";
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
    return { tree: [] as AxNode[], refs: [] };
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
  async screenshot(): Promise<Buffer> {
    return this.png;
  }
}

describe("screenshot tool (writes via the writePayload seam)", () => {
  afterEach(() => resetSession());

  test("returns { path, bytes } and writes a file", async () => {
    const png = Buffer.from("PNGDATA-pretend");
    setPort(new CapturePort(png));
    const r = await screenshot.handler({ full_page: false });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect(s.bytes).toBe(png.length);
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
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
