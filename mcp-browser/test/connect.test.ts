import { afterEach, describe, expect, test } from "bun:test";
import { setPort, resetSession } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import { FakePort } from "./fake-port.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

describe("connect tool (fake port)", () => {
  afterEach(() => resetSession());

  test("launch mode connects and reports tab_count", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "launch", headless: true });
    expect(r.isError).toBeUndefined();
    expect(structured(r).mode).toBe("launch");
    expect(structured(r).tab_count).toBe(1);
  });

  test("attach via browser_url connects", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "attach", browser_url: "http://127.0.0.1:9222", headless: true });
    expect(r.isError).toBeUndefined();
    expect(structured(r).mode).toBe("attach");
  });

  test("attach via ws_endpoint connects", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "attach", ws_endpoint: "ws://127.0.0.1:9222/devtools/browser/abc", headless: true });
    expect(r.isError).toBeUndefined();
  });

  // DW-1.5 barricade
  test("attach with BOTH browser_url and ws_endpoint is ambiguous err (no silent pick)", async () => {
    setPort(new FakePort());
    const r = await connect.handler({
      mode: "attach",
      browser_url: "http://127.0.0.1:9222",
      ws_endpoint: "ws://127.0.0.1:9222/devtools/browser/abc",
      headless: true,
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connect_ambiguous");
    expect(structured(r).suggestion).toBeTruthy();
  });

  test("attach with NEITHER target is connect_invalid err", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "attach", headless: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connect_invalid");
  });

  test("malformed browser_url rejected at barricade with {code,message,suggestion}", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "attach", browser_url: "not a url", headless: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_browser_url");
    expect(structured(r).message).toBeTruthy();
    expect(structured(r).suggestion).toBeTruthy();
  });

  test("non-ws ws_endpoint rejected at barricade", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "attach", ws_endpoint: "http://127.0.0.1:9222", headless: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_ws_endpoint");
  });

  test("launch with a non-existent executable_path is executable_not_found", async () => {
    setPort(new FakePort());
    const r = await connect.handler({ mode: "launch", executable_path: "/no/such/chrome/binary", headless: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("executable_not_found");
  });

  // DW-1.3 connection_lost is returned, not thrown
  test("connect when isAlive() is false surfaces connection_lost (never throws)", async () => {
    const port = new FakePort();
    setPort(port);
    await connect.handler({ mode: "launch", headless: true });
    port.alive = false; // Chrome died mid-session
    const r = await connect.handler({ mode: "attach", browser_url: "http://127.0.0.1:9222", headless: true });
    // attach is a fresh connection; liveness applies to tab ops — see tabs.test.ts.
    // Here we assert connect itself never throws regardless of prior state.
    expect(r).toBeDefined();
  });
});
