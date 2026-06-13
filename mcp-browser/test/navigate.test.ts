/**
 * navigate barricade (DW-2.5) — untrusted URL, SSRF-adjacent. Allowlist http(s);
 * block file://, chrome://, javascript:, data:, about: unless allow_internal opts
 * in (and javascript: stays blocked even then). Rejection happens BEFORE the port
 * is reached (barricade, not a downstream check).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import * as navigate from "../src/tools/navigate.ts";
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

describe("navigate barricade (DW-2.5)", () => {
  afterEach(() => resetSession());

  test("accepts http and https", async () => {
    const port = await fresh();
    const a = await navigate.handler({ url: "http://example.com", allow_internal: false });
    const b = await navigate.handler({ url: "https://example.com/path?q=1", allow_internal: false });
    expect(a.isError).toBeUndefined();
    expect(b.isError).toBeUndefined();
    expect(port.navigated).toEqual(["http://example.com", "https://example.com/path?q=1"]);
  });

  test("rejects file:// with blocked_url and never reaches the port", async () => {
    const port = await fresh();
    const r = await navigate.handler({ url: "file:///etc/passwd", allow_internal: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("blocked_url");
    expect(port.navigated).toEqual([]);
  });

  test("rejects chrome:// with blocked_url", async () => {
    const port = await fresh();
    const r = await navigate.handler({ url: "chrome://settings", allow_internal: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("blocked_url");
    expect(port.navigated).toEqual([]);
  });

  test("rejects a malformed URL with invalid_url", async () => {
    const port = await fresh();
    const r = await navigate.handler({ url: "ht!tp://not a url", allow_internal: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("invalid_url");
    expect(port.navigated).toEqual([]);
  });

  test("rejects javascript: and data: as blocked_url", async () => {
    const port = await fresh();
    const js = await navigate.handler({ url: "javascript:alert(1)", allow_internal: false });
    const data = await navigate.handler({ url: "data:text/html,<h1>x", allow_internal: false });
    expect(js.isError).toBe(true);
    expect(structured(js).code).toBe("blocked_url");
    expect(data.isError).toBe(true);
    expect(structured(data).code).toBe("blocked_url");
    expect(port.navigated).toEqual([]);
  });

  test("allow_internal=true permits file:// but still blocks javascript:", async () => {
    const port = await fresh();
    const f = await navigate.handler({ url: "file:///tmp/page.html", allow_internal: true });
    expect(f.isError).toBeUndefined();
    expect(port.navigated).toEqual(["file:///tmp/page.html"]);
    const js = await navigate.handler({ url: "javascript:alert(1)", allow_internal: true });
    expect(js.isError).toBe(true);
    expect(structured(js).code).toBe("blocked_url");
  });

  test("a dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await navigate.handler({ url: "https://example.com", allow_internal: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});
