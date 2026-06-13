import { describe, expect, test } from "bun:test";
import { log } from "../src/lib/log.ts";

describe("log (DW-1.6)", () => {
  test("writes to stderr with the [browser] prefix and never to stdout", () => {
    const errChunks: string[] = [];
    const outChunks: string[] = [];
    const origErr = console.error;
    const origOut = console.log;
    console.error = (...a: unknown[]) => void errChunks.push(a.join(" "));
    console.log = (...a: unknown[]) => void outChunks.push(a.join(" "));
    try {
      log("hello", "world");
    } finally {
      console.error = origErr;
      console.log = origOut;
    }
    expect(outChunks).toEqual([]);
    expect(errChunks.length).toBe(1);
    expect(errChunks[0]).toContain("[browser]");
    expect(errChunks[0]).toContain("hello world");
  });
});
