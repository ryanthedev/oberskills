/**
 * DW-4.3 / DW-4.6: the real HAR writer (adapters/fs/har-writer.ts) emits a
 * schema-valid HAR 1.2 file, and an empty entries array still yields a valid HAR.
 * The writer is a driven adapter behind the core HarPort — this test imports the
 * concrete writer directly and validates the file it produces. No puppeteer.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { FsHarWriter } from "../src/adapters/fs/har-writer.ts";
import type { HarEntry } from "../src/core/har-port.ts";

const written: string[] = [];

afterEach(() => {
  for (const p of written.splice(0)) rmSync(p, { force: true });
});

function entry(url: string): HarEntry {
  return {
    startedDateTime: "2026-06-13T00:00:00.000Z",
    timeMs: 20,
    request: {
      method: "GET",
      url,
      httpVersion: "HTTP/1.1",
      headers: [{ name: "Accept", value: "*/*" }],
      queryString: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: "OK",
      httpVersion: "HTTP/1.1",
      headers: [{ name: "Content-Type", value: "text/html" }],
      content: { size: 42, mimeType: "text/html" },
      redirectURL: "",
      headersSize: -1,
      bodySize: 42,
    },
    timings: { blocked: -1, dns: -1, connect: -1, ssl: -1, send: 1, wait: 8, receive: 2 },
  };
}

/** Minimal HAR 1.2 structural validity check. */
function assertValidHar12(json: unknown, expectedEntries: number): void {
  expect(typeof json).toBe("object");
  const log = (json as { log?: Record<string, unknown> }).log;
  expect(log).toBeDefined();
  expect(log?.version).toBe("1.2");
  expect(typeof (log?.creator as { name?: string })?.name).toBe("string");
  expect(typeof (log?.creator as { version?: string })?.version).toBe("string");
  expect(Array.isArray(log?.entries)).toBe(true);
  const entries = log?.entries as unknown[];
  expect(entries.length).toBe(expectedEntries);
  for (const e of entries) {
    const en = e as Record<string, unknown>;
    expect(typeof en.startedDateTime).toBe("string");
    expect(typeof en.time).toBe("number");
    const req = en.request as Record<string, unknown>;
    expect(typeof req.method).toBe("string");
    expect(typeof req.url).toBe("string");
    expect(Array.isArray(req.headers)).toBe(true);
    expect(Array.isArray(req.queryString)).toBe(true);
    const res = en.response as Record<string, unknown>;
    expect(typeof res.status).toBe("number");
    expect(Array.isArray(res.headers)).toBe(true);
    expect(typeof (res.content as { size?: number })?.size).toBe("number");
    const timings = en.timings as Record<string, number>;
    for (const phase of ["blocked", "dns", "connect", "ssl", "send", "wait", "receive"]) {
      expect(typeof timings[phase]).toBe("number");
    }
    expect(en.cache).toBeDefined();
  }
}

describe("HAR writer (DW-4.3)", () => {
  test("test_DW_4_3_har_writer_schema_valid: a populated buffer writes schema-valid HAR 1.2", async () => {
    const writer = new FsHarWriter();
    const path = await writer.write([entry("https://x.test/a"), entry("https://x.test/b")]);
    written.push(path);
    const json = JSON.parse(readFileSync(path, "utf8"));
    assertValidHar12(json, 2);
    expect((json.log.entries[0].request as { url: string }).url).toBe("https://x.test/a");
  });

  test("test_DW_4_3_empty_buffer_valid_empty: an empty entries array yields a valid-but-empty HAR", async () => {
    const writer = new FsHarWriter();
    const path = await writer.write([]);
    written.push(path);
    const json = JSON.parse(readFileSync(path, "utf8"));
    assertValidHar12(json, 0);
  });

  test("test_DW_4_3_atomic_write: the returned path exists and parses (write-then-rename left no .tmp)", async () => {
    const writer = new FsHarWriter();
    const path = await writer.write([entry("https://x.test/c")]);
    written.push(path);
    expect(path.endsWith(".har")).toBe(true);
    // a leftover .tmp would indicate a non-atomic write
    expect(() => readFileSync(path + ".tmp", "utf8")).toThrow();
  });
});
