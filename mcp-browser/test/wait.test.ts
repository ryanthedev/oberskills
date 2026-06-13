/**
 * wait tool (DW-2.6) — navigation/selector/idle; a timeout returns a typed
 * wait_timeout err that NAMES the strategy that timed out (never a silent empty
 * result, never a throw).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import * as wait from "../src/tools/wait.ts";
import { FakePort } from "./fake-port.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await connect.handler({ mode: "launch", headless: true });
  return port;
}

describe("wait tool (DW-2.6)", () => {
  afterEach(() => resetSession());

  test("navigation timeout → wait_timeout naming 'navigation'", async () => {
    const port = await fresh();
    port.waitTimeoutFor = "navigation";
    const r = await wait.handler({ strategy: "navigation", timeout_ms: 100 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("wait_timeout");
    expect(String(structured(r).message)).toMatch(/navigation/);
  });

  test("selector timeout → wait_timeout naming 'selector'", async () => {
    const port = await fresh();
    port.waitTimeoutFor = "selector";
    const r = await wait.handler({ strategy: "selector", selector: "#x", timeout_ms: 100 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("wait_timeout");
    expect(String(structured(r).message)).toMatch(/selector/);
  });

  test("idle timeout → wait_timeout naming 'idle'", async () => {
    const port = await fresh();
    port.waitTimeoutFor = "idle";
    const r = await wait.handler({ strategy: "idle", timeout_ms: 100 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("wait_timeout");
    expect(String(structured(r).message)).toMatch(/idle/);
  });

  test("a satisfied wait returns ok", async () => {
    await fresh();
    const r = await wait.handler({ strategy: "idle", timeout_ms: 1000 });
    expect(r.isError).toBeUndefined();
  });

  test("selector strategy without a selector is a validation err", async () => {
    await fresh();
    const r = await wait.handler({ strategy: "selector", timeout_ms: 1000 });
    expect(r.isError).toBe(true);
  });
});
