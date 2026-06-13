/**
 * DW-3.1: writePayload real implementation — threshold, inline, write-failure.
 * All tests use the injectable write function; no real fs writes except the
 * "actually writes to /tmp" sanity check.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { writePayload, PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";

// A write fn that captures what it received (for assertions).
function capturingWrite(): {
  fn: (path: string, data: Buffer | string) => Promise<void>;
  calls: { path: string; data: Buffer | string }[];
} {
  const calls: { path: string; data: Buffer | string }[] = [];
  return {
    fn: async (path, data) => { calls.push({ path, data }); },
    calls,
  };
}

describe("writePayload (DW-3.1) — inline below threshold", () => {
  test("test_DW_3_1_below_threshold_inlines: data below threshold is inlined, written=false", async () => {
    const small = "hello";
    const cap = capturingWrite();
    const r = await writePayload(small, { ext: "txt" }, cap.fn);
    expect(r.written).toBe(false);
    expect(r.bytes).toBe(Buffer.byteLength(small));
    // No disk write happened
    expect(cap.calls).toHaveLength(0);
    // inlinedPreview present
    expect(r.inlinedPreview).toBe(small);
    // path is empty string when not written
    expect(r.path).toBe("");
  });

  test("preview truncated to inlinePreviewChars", async () => {
    const content = "abcdefghij";
    const cap = capturingWrite();
    const r = await writePayload(content, { ext: "txt", inlinePreviewChars: 4 }, cap.fn);
    expect(r.inlinedPreview).toBe("abcd");
    expect(r.written).toBe(false);
  });

  test("test_DW_3_1_at_threshold_writes: data AT threshold writes to /tmp, written=true", async () => {
    // Exactly PAYLOAD_THRESHOLD_BYTES bytes
    const exactData = "x".repeat(PAYLOAD_THRESHOLD_BYTES);
    const cap = capturingWrite();
    const r = await writePayload(exactData, { ext: "txt" }, cap.fn);
    expect(r.written).toBe(true);
    expect(r.bytes).toBe(PAYLOAD_THRESHOLD_BYTES);
    expect(cap.calls).toHaveLength(1);
    expect(r.path).toContain("browser-mcp-");
    expect(r.path).toContain(".txt");
    // No inlinedPreview when written to disk
    expect(r.inlinedPreview).toBeUndefined();
  });

  test("test_DW_3_1_above_threshold_writes: data above threshold writes to /tmp, written=true", async () => {
    const bigData = "y".repeat(PAYLOAD_THRESHOLD_BYTES + 1);
    const cap = capturingWrite();
    const r = await writePayload(bigData, { ext: "html" }, cap.fn);
    expect(r.written).toBe(true);
    expect(r.bytes).toBe(PAYLOAD_THRESHOLD_BYTES + 1);
    expect(cap.calls).toHaveLength(1);
    expect(r.path).toContain(".html");
  });

  test("Buffer data is measured by .length (byte size)", async () => {
    const buf = Buffer.alloc(PAYLOAD_THRESHOLD_BYTES + 10, 0xff);
    const cap = capturingWrite();
    const r = await writePayload(buf, { ext: "bin" }, cap.fn);
    expect(r.written).toBe(true);
    expect(r.bytes).toBe(PAYLOAD_THRESHOLD_BYTES + 10);
  });

  test("test_DW_3_1_write_failure_returns_err: injected write fn that rejects → throw propagates (payload never dropped)", async () => {
    const bigData = "z".repeat(PAYLOAD_THRESHOLD_BYTES + 1);
    const failWrite = async (_path: string, _data: Buffer | string): Promise<void> => {
      throw new Error("ENOSPC: no space left on device");
    };
    // Must throw (not silently drop) — the tool layer converts to err()
    await expect(writePayload(bigData, { ext: "txt" }, failWrite)).rejects.toThrow("ENOSPC");
  });

  test("below-threshold does NOT call the write fn at all (no spurious write)", async () => {
    let called = false;
    const writeNeverCalled = async () => { called = true; };
    const small = "tiny";
    await writePayload(small, { ext: "txt" }, writeNeverCalled);
    expect(called).toBe(false);
  });
});

describe("writePayload — real /tmp write (integration sanity)", () => {
  test("above threshold actually lands on disk (default write fn)", async () => {
    const bigData = "a".repeat(PAYLOAD_THRESHOLD_BYTES + 1);
    const r = await writePayload(bigData, { ext: "txt" });
    expect(r.written).toBe(true);
    expect(existsSync(r.path)).toBe(true);
    rmSync(r.path, { force: true });
  });
});
