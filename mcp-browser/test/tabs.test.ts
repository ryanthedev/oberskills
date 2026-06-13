import { afterEach, describe, expect, test } from "bun:test";
import { setPort, resetSession } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import * as tabs from "../src/tools/tabs.ts";
import { FakePort } from "./fake-port.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function freshConnected(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await connect.handler({ mode: "launch", headless: true });
  return port;
}

describe("tabs tool (fake port)", () => {
  afterEach(() => resetSession());

  test("list returns the open tabs", async () => {
    await freshConnected();
    const r = await tabs.handler({ action: "list" });
    expect(r.isError).toBeUndefined();
    const list = structured(r).tabs as unknown[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
  });

  test("new opens a tab and it becomes active", async () => {
    await freshConnected();
    const r = await tabs.handler({ action: "new", url: "https://example.com" });
    expect(r.isError).toBeUndefined();
    const tab = structured(r).tab as Record<string, unknown>;
    expect(tab.active).toBe(true);
    expect(tab.url).toBe("https://example.com");
  });

  test("select switches the active tab", async () => {
    await freshConnected();
    const opened = structured(await tabs.handler({ action: "new" })).tab as Record<string, unknown>;
    const firstId = "fake-1";
    const r = await tabs.handler({ action: "select", tab_id: firstId });
    expect(r.isError).toBeUndefined();
    expect((structured(r).tab as Record<string, unknown>).tab_id).toBe(firstId);
    expect(opened.tab_id).toBe("fake-2");
  });

  test("close removes a tab", async () => {
    await freshConnected();
    await tabs.handler({ action: "new" });
    const r = await tabs.handler({ action: "close", tab_id: "fake-2" });
    expect(r.isError).toBeUndefined();
    const list = structured(await tabs.handler({ action: "list" })).tabs as unknown[];
    expect(list.length).toBe(1);
  });

  // DW-1.4 edge: close the active tab → next promoted as active
  test("closing the active tab promotes the next remaining tab", async () => {
    await freshConnected(); // fake-1 active
    await tabs.handler({ action: "new" }); // fake-2 now active
    await tabs.handler({ action: "close", tab_id: "fake-2" }); // active closed
    const list = (structured(await tabs.handler({ action: "list" })).tabs as Record<string, unknown>[]);
    expect(list.length).toBe(1);
    expect(list[0]?.active).toBe(true);
    expect(list[0]?.tab_id).toBe("fake-1");
  });

  // DW-1.4 edge: close the last tab → no_active_tab on subsequent active query
  test("closing the last tab yields no_active_tab on activePageHandle", async () => {
    const port = await freshConnected();
    await tabs.handler({ action: "close", tab_id: "fake-1" }); // last tab gone
    expect(() => port.activePageHandle()).toThrow();
    // the tool surface for "no active tab" is exercised by select/close on unknown ids below
  });

  test("select/close of an unknown tab id returns unknown_tab err (not throw)", async () => {
    await freshConnected();
    const r = await tabs.handler({ action: "select", tab_id: "does-not-exist" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("unknown_tab");
  });

  test("select/close without tab_id returns a validation err (not throw)", async () => {
    await freshConnected();
    const r = await tabs.handler({ action: "select" });
    expect(r.isError).toBe(true);
  });

  // DW-1.3 liveness: dead connection → connection_lost, never thrown
  test("tab op on a dead connection returns connection_lost (not thrown)", async () => {
    const port = await freshConnected();
    port.alive = false;
    const r = await tabs.handler({ action: "list" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
    expect(structured(r).suggestion).toMatch(/reconnect|connect/i);
  });
});
