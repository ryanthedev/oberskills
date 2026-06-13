import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const srcDir = new URL("../src", import.meta.url).pathname;
const coreDir = join(srcDir, "core");
const toolsDir = join(srcDir, "tools");

/** Remove // line and block comments so prose mentions don't false-positive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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
      if (/console\.log\(/.test(readFileSync(file, "utf8"))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  // DW-1.2 — hexagonal boundary: no puppeteer imports/types in core or tools.
  // The adapter converts at the boundary, so puppeteer must not be IMPORTED or
  // its namespace REFERENCED here. (Prose mentions in comments are not a leak —
  // we strip comments before scanning so the check tracks the real dependency.)
  test("zero puppeteer imports/types in src/core and src/tools", () => {
    const offenders: string[] = [];
    for (const file of [...tsFiles(coreDir), ...tsFiles(toolsDir)]) {
      const code = stripComments(readFileSync(file, "utf8"));
      // an import from any puppeteer package, or a Puppeteer.<Type> namespace use
      if (/\bfrom\s+["'][^"']*puppeteer/i.test(code) || /\bimport\s*\(\s*["'][^"']*puppeteer/i.test(code) || /\bPuppeteer\s*\./.test(code)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  // DW-4.6 — perf/network use cases live in core with NO substrate dependency.
  // Lighthouse needs the CDP debugging port, so its import lives in the puppeteer
  // adapter only — never in core/tools (same boundary discipline as puppeteer).
  test("zero lighthouse imports in src/core and src/tools", () => {
    const offenders: string[] = [];
    for (const file of [...tsFiles(coreDir), ...tsFiles(toolsDir)]) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\bfrom\s+["'][^"']*lighthouse/i.test(code) || /\bimport\s*\(\s*["'][^"']*lighthouse/i.test(code)) {
        offenders.push(file);
      }
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
