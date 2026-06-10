import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const srcDir = new URL("../src", import.meta.url).pathname;

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("static gates", () => {
  test("zero console.log in src/ (stdout is the JSON-RPC transport)", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(srcDir)) {
      const content = readFileSync(file, "utf8");
      if (/console\.log\(/.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test("tsc --noEmit exits 0 (all errors and warnings fixed)", async () => {
    const proc = Bun.spawn(["bunx", "tsc", "--noEmit"], {
      cwd: new URL("..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exit = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(stdout.trim()).toBe("");
    expect(exit).toBe(0);
  }, 120_000);
});
