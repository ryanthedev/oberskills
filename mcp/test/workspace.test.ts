import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  guardInside,
  iterationDir,
  runDir,
  walkIterationDir,
  workspaceRoot,
  writeJson,
} from "../src/lib/workspace.ts";

const base = mkdtempSync(join(tmpdir(), "workspace-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("layout helpers", () => {
  test("workspaceRoot derives <parent>/<name>-workspace", () => {
    expect(workspaceRoot("/a/b/my-skill")).toBe("/a/b/my-skill-workspace");
    expect(workspaceRoot("/a/b/my-skill", "/custom/ws")).toBe("/custom/ws");
  });

  test("runDir builds the canonical path", () => {
    expect(runDir("/ws", 2, "pressure-test", "with_skill", 3)).toBe(
      "/ws/iteration-2/pressure-test/with_skill/run-3",
    );
    expect(iterationDir("/ws", 1)).toBe("/ws/iteration-1");
  });

  test("path-escape refusal", () => {
    expect(() => guardInside("/ws", "/ws/inside/file.json")).not.toThrow();
    expect(() => guardInside("/ws", "/ws/../etc/passwd")).toThrow(/outside workspace/);
    expect(() => guardInside("/ws", "/wsneighbor/file")).toThrow(/outside workspace/);
  });

  test("symlink escape refusal: a link inside the workspace pointing outside is rejected", () => {
    const ws = join(base, "symlink-ws");
    const outside = join(base, "symlink-outside");
    mkdirSync(ws, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(ws, "sneaky"));
    expect(() => guardInside(ws, join(ws, "sneaky", "file.json"))).toThrow(/outside workspace/);
    // Honest paths under the workspace still pass, even through tmpdir's own /var -> /private/var symlink.
    expect(() => guardInside(ws, join(ws, "honest", "file.json"))).not.toThrow();
  });

  test("root behind a symlink still accepts its own children (root is realpathed too)", () => {
    const realRoot = join(base, "real-root");
    mkdirSync(realRoot, { recursive: true });
    const linkRoot = join(base, "link-root");
    symlinkSync(realRoot, linkRoot);
    // Target addressed via the real path, root via the symlink: same directory.
    expect(() => guardInside(linkRoot, join(realRoot, "child.json"))).not.toThrow();
    expect(() => guardInside(realRoot, join(linkRoot, "child.json"))).not.toThrow();
  });

  test("writeJson creates parents and round-trips", () => {
    const p = writeJson(base, join(base, "deep", "nested", "x.json"), { a: 1 });
    expect(p).toContain("deep/nested/x.json");
  });
});

describe("walkIterationDir (Python reader parity)", () => {
  const iter = join(base, "iteration-1");

  // eval with run-N layout + timing in run dir
  const r1 = join(iter, "eval-a", "with_skill", "run-1");
  mkdirSync(r1, { recursive: true });
  writeFileSync(join(r1, "grading.json"), JSON.stringify({ summary: { pass_rate: 1, passed: 2, total: 2 } }));
  writeFileSync(join(r1, "timing.json"), JSON.stringify({ total_tokens: 10, duration_ms: 1000, total_duration_seconds: 1 }));

  // config dir as single run (no run-N), timing embedded in grading.json
  const cfg = join(iter, "eval-a", "without_skill");
  mkdirSync(cfg, { recursive: true });
  writeFileSync(
    join(cfg, "grading.json"),
    JSON.stringify({
      summary: { pass_rate: 0.5, passed: 1, total: 2 },
      timing: { total_tokens: 99, duration_ms: 5000, total_duration_seconds: 5 },
    }),
  );

  // run dir without grading.json -> skipped with a note
  const r3 = join(iter, "eval-b", "with_skill", "run-1");
  mkdirSync(r3, { recursive: true });

  test("run-N fallback + timing fallback chain + skip notes", () => {
    const { runs, notes } = walkIterationDir(iter);
    expect(runs).toHaveLength(2);

    const withSkill = runs.find((r) => r.configuration === "with_skill");
    expect(withSkill?.timing.total_tokens).toBe(10);

    const withoutSkill = runs.find((r) => r.configuration === "without_skill");
    expect(withoutSkill?.run_number).toBe(1);
    expect(withoutSkill?.timing.total_tokens).toBe(99); // embedded fallback

    expect(notes.some((n) => n.includes("eval-b") && n.includes("no grading.json"))).toBe(true);
  });
});
