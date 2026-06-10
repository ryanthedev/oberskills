import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateChecks, readToolUses } from "../src/lib/checks.ts";

const runDir = mkdtempSync(join(tmpdir(), "checks-test-"));
afterAll(() => rmSync(runDir, { recursive: true, force: true }));

mkdirSync(join(runDir, "outputs"), { recursive: true });
writeFileSync(join(runDir, "outputs", "result.md"), "# Result\n\nAll twelve tests passed.\n");
const transcript = [
  JSON.stringify({ type: "system", subtype: "init" }),
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/spec.md" } }] },
  }),
  "not json — tolerated",
  JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "writing now" },
        { type: "tool_use", name: "Write", input: { file_path: "outputs/result.md" } },
      ],
    },
  }),
  JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Bash", input: { command: "bun test" } }] },
  }),
  JSON.stringify({ type: "result", subtype: "success" }),
].join("\n");
writeFileSync(join(runDir, "transcript.jsonl"), transcript);

describe("readToolUses", () => {
  test("extracts ordered tool_use blocks, tolerating corrupt lines", () => {
    const uses = readToolUses(join(runDir, "transcript.jsonl"));
    expect(uses.map((u) => u.name)).toEqual(["Read", "Write", "Bash"]);
  });
});

describe("evaluateChecks", () => {
  test("artifact_exists pass + fail", () => {
    const [hit, miss] = evaluateChecks(
      [
        { kind: "artifact_exists", path: "outputs/result.md" },
        { kind: "artifact_exists", path: "outputs/absent.md" },
      ],
      runDir,
    );
    expect(hit?.passed).toBe(true);
    expect(miss?.passed).toBe(false);
    expect(miss?.evidence).toContain("missing");
  });

  test("artifact_matches against file contents", () => {
    const [hit, miss] = evaluateChecks(
      [
        { kind: "artifact_matches", path: "outputs/result.md", pattern: "twelve tests passed" },
        { kind: "artifact_matches", path: "outputs/result.md", pattern: "zero tests" },
      ],
      runDir,
    );
    expect(hit?.passed).toBe(true);
    expect(miss?.passed).toBe(false);
  });

  test("trace_includes with and without input_pattern", () => {
    const [plain, withInput, wrongInput] = evaluateChecks(
      [
        { kind: "trace_includes", tool: "Bash" },
        { kind: "trace_includes", tool: "Bash", input_pattern: "bun test" },
        { kind: "trace_includes", tool: "Bash", input_pattern: "rm -rf" },
      ],
      runDir,
    );
    expect(plain?.passed).toBe(true);
    expect(withInput?.passed).toBe(true);
    expect(wrongInput?.passed).toBe(false);
  });

  test("trace_order is subsequence semantics (gaps allowed, order enforced)", () => {
    const [good, bad] = evaluateChecks(
      [
        { kind: "trace_order", tools: ["Read", "Bash"] },
        { kind: "trace_order", tools: ["Bash", "Read"] },
      ],
      runDir,
    );
    expect(good?.passed).toBe(true);
    expect(bad?.passed).toBe(false);
    expect(bad?.evidence).toContain("subsequence broke");
  });

  test("trace_never invariant: hit fails, absence passes", () => {
    const [violated, clean, inputOnly] = evaluateChecks(
      [
        { kind: "trace_never", tool: "Bash" },
        { kind: "trace_never", tool: "WebFetch" },
        { kind: "trace_never", input_pattern: "spec\\.md" },
      ],
      runDir,
    );
    expect(violated?.passed).toBe(false);
    expect(violated?.evidence).toContain("forbidden tool_use Bash");
    expect(clean?.passed).toBe(true);
    expect(inputOnly?.passed).toBe(false); // Read touched /spec.md
  });

  test("absolute and ../-escaping artifact paths fail the check (never read outside the run dir)", () => {
    const [abs, escape, escapeMatch] = evaluateChecks(
      [
        { kind: "artifact_exists", path: "/etc/passwd" },
        { kind: "artifact_exists", path: "../outside.md" },
        { kind: "artifact_matches", path: "../../etc/passwd", pattern: "root" },
      ],
      runDir,
    );
    expect(abs?.passed).toBe(false);
    expect(abs?.evidence).toContain("unsafe artifact path");
    expect(escape?.passed).toBe(false);
    expect(escape?.evidence).toContain("unsafe artifact path");
    expect(escapeMatch?.passed).toBe(false);
    expect(escapeMatch?.evidence).toContain("unsafe artifact path");
  });

  test("an invalid RegExp fails that one check with 'invalid pattern' evidence; siblings still run", () => {
    const [bad, badTrace, badNever, good] = evaluateChecks(
      [
        { kind: "artifact_matches", path: "outputs/result.md", pattern: "([unclosed" },
        { kind: "trace_includes", tool: "Bash", input_pattern: "([unclosed" },
        { kind: "trace_never", tool: "Bash", input_pattern: "([unclosed" },
        { kind: "artifact_matches", path: "outputs/result.md", pattern: "twelve tests passed" },
      ],
      runDir,
    );
    expect(bad?.passed).toBe(false);
    expect(bad?.evidence).toContain("invalid pattern");
    expect(badTrace?.passed).toBe(false);
    expect(badTrace?.evidence).toContain("invalid pattern");
    expect(badNever?.passed).toBe(false);
    expect(badNever?.evidence).toContain("invalid pattern");
    expect(good?.passed).toBe(true); // the invalid pattern did not abort grading
  });

  test("missing transcript means no trace evidence (includes fail, never passes)", () => {
    const empty = mkdtempSync(join(tmpdir(), "checks-empty-"));
    try {
      const [inc, nev] = evaluateChecks(
        [
          { kind: "trace_includes", tool: "Read" },
          { kind: "trace_never", tool: "Read" },
        ],
        empty,
      );
      expect(inc?.passed).toBe(false);
      expect(nev?.passed).toBe(true);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
