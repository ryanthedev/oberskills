import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { writePayload, PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";

describe("payload (P3 real implementation)", () => {
  test("writes to /tmp and returns path + byte size when above threshold", async () => {
    const bigData = "x".repeat(PAYLOAD_THRESHOLD_BYTES + 1);
    const r = await writePayload(bigData, { ext: "txt" });
    expect(r.written).toBe(true);
    expect(r.bytes).toBe(PAYLOAD_THRESHOLD_BYTES + 1);
    expect(existsSync(r.path)).toBe(true);
    expect(r.path).toContain("browser-mcp-");
    rmSync(r.path, { force: true });
  });

  test("threshold constant is exported and positive", () => {
    expect(typeof PAYLOAD_THRESHOLD_BYTES).toBe("number");
    expect(PAYLOAD_THRESHOLD_BYTES).toBeGreaterThan(0);
  });

  test("uses the injectable write fn (dirty-write seam) without touching disk", async () => {
    let seen: { path: string; data: Buffer | string } | null = null;
    const bigData = "x".repeat(PAYLOAD_THRESHOLD_BYTES + 1);
    const r = await writePayload(bigData, { ext: "txt" }, async (path, data) => {
      seen = { path, data };
    });
    expect(seen).not.toBeNull();
    expect(r.bytes).toBe(PAYLOAD_THRESHOLD_BYTES + 1);
    expect(existsSync(r.path)).toBe(false); // injected fn did not actually write
  });
});
