import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { writePayload, PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";

describe("payload seam (P1 stub)", () => {
  test("writes to /tmp and returns path + byte size", async () => {
    const r = await writePayload("seam-test", "hello payload", "txt");
    expect(r.bytes).toBe(Buffer.byteLength("hello payload"));
    expect(existsSync(r.path)).toBe(true);
    expect(r.path).toContain("browser-mcp-");
    rmSync(r.path, { force: true });
  });

  test("threshold constant is exported and positive", () => {
    expect(typeof PAYLOAD_THRESHOLD_BYTES).toBe("number");
    expect(PAYLOAD_THRESHOLD_BYTES).toBeGreaterThan(0);
  });

  test("uses the injectable write fn (P3 dirty-write seam) without touching disk", async () => {
    let seen: { path: string; data: Buffer | string } | null = null;
    const r = await writePayload("inject", "abc", "txt", async (path, data) => {
      seen = { path, data };
    });
    expect(seen).not.toBeNull();
    expect(r.bytes).toBe(3);
    expect(existsSync(r.path)).toBe(false); // injected fn did not actually write
  });
});
