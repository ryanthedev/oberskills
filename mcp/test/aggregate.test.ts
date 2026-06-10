import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handler as aggregateHandler } from "../src/tools/aggregate-benchmark.ts";
import type { Benchmark } from "../src/types.ts";

const base = mkdtempSync(join(tmpdir(), "aggregate-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

function writeRun(
  iterDir: string,
  evalId: string,
  config: string,
  run: number,
  passRate: number,
  pressureVerdict?: string,
): void {
  const rd = join(iterDir, evalId, config, `run-${run}`);
  mkdirSync(rd, { recursive: true });
  writeFileSync(
    join(rd, "grading.json"),
    JSON.stringify({
      expectations: [{ text: "t", passed: passRate === 1, evidence: "e" }],
      summary: { pass_rate: passRate, passed: passRate === 1 ? 1 : 0, total: 1 },
      execution_metrics: { total_tool_calls: 3, errors_encountered: 0 },
      user_notes_summary: { uncertainties: [], needs_review: [], workarounds: [] },
      ...(pressureVerdict
        ? { pressure_compliance: { verdict: pressureVerdict, patterns_found: [], steps_skipped: [], rationalization_count: 0 } }
        : {}),
    }),
  );
  writeFileSync(join(rd, "timing.json"), JSON.stringify({ total_tokens: 100, duration_ms: 2000, total_duration_seconds: 2 }));
  writeFileSync(
    join(rd, "metrics.json"),
    JSON.stringify({ total_tool_calls: 3, errors_encountered: 0, skill_invoked: true, num_turns: 4, total_cost_usd: 0.02, terminal: "success" }),
  );
}

describe("aggregate_benchmark", () => {
  test("numeric named-config delta survives adversarial discovery order; gates computed", async () => {
    const iterDir = join(base, "iteration-1");
    // "a_base" is discovered FIRST alphabetically — an order-dependent delta
    // (the old Python bug) would compute baseline − candidate here.
    writeRun(iterDir, "eval-x", "a_base", 1, 0.5);
    writeRun(iterDir, "eval-x", "a_base", 2, 0.5);
    writeRun(iterDir, "eval-x", "z_cand", 1, 1.0, "COMPLIANT");
    writeRun(iterDir, "eval-x", "z_cand", 2, 1.0, "COMPLIANT");

    const result = await aggregateHandler({
      iteration_dir: iterDir,
      skill_name: "demo",
      baseline_config: "a_base",
      candidate_config: "z_cand",
      response_format: "concise",
    });
    expect(result.isError).toBeUndefined();

    const benchmark = JSON.parse(readFileSync(join(iterDir, "benchmark.json"), "utf8")) as Benchmark;
    expect(benchmark.delta).not.toBeNull();
    expect(benchmark.delta?.baseline).toBe("a_base");
    expect(benchmark.delta?.candidate).toBe("z_cand");
    expect(benchmark.delta?.pass_rate).toBe(0.5); // candidate − baseline, numeric
    expect(typeof benchmark.delta?.pass_rate).toBe("number");
    expect(benchmark.gates.skill_lift).toBe(true);
    expect(benchmark.gates.pressure_adherence).toBe(true);
    expect(existsSync(join(iterDir, "benchmark.md"))).toBe(true);
  });

  test("a single NON_COMPLIANT candidate run fails the pressure gate", async () => {
    const iterDir = join(base, "iteration-2");
    writeRun(iterDir, "eval-p", "without_skill", 1, 0.5);
    writeRun(iterDir, "eval-p", "with_skill", 1, 1.0, "COMPLIANT");
    writeRun(iterDir, "eval-p", "with_skill", 2, 1.0, "NON_COMPLIANT");

    await aggregateHandler({
      iteration_dir: iterDir,
      skill_name: "demo",
      baseline_config: "without_skill",
      candidate_config: "with_skill",
      response_format: "concise",
    });
    const benchmark = JSON.parse(readFileSync(join(iterDir, "benchmark.json"), "utf8")) as Benchmark;
    expect(benchmark.gates.pressure_adherence).toBe(false);
  });

  test("no pressure runs => pressure gate is null (n/a), notes are strings", async () => {
    const iterDir = join(base, "iteration-3");
    writeRun(iterDir, "eval-q", "without_skill", 1, 0.5);
    writeRun(iterDir, "eval-q", "with_skill", 1, 0.75);

    const result = await aggregateHandler({
      iteration_dir: iterDir,
      skill_name: "demo",
      baseline_config: "without_skill",
      candidate_config: "with_skill",
      response_format: "concise",
    });
    const benchmark = JSON.parse(readFileSync(join(iterDir, "benchmark.json"), "utf8")) as Benchmark;
    expect(benchmark.gates.pressure_adherence).toBeNull();
    expect(Array.isArray(benchmark.notes)).toBe(true);
    expect(benchmark.notes.every((n) => typeof n === "string")).toBe(true);
    expect(result.structuredContent?.benchmark_md_path).toBeDefined();
  });
});
