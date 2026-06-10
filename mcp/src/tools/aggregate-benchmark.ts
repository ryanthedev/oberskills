/**
 * aggregate_benchmark — pure TS aggregation of graded runs into benchmark.json
 * + benchmark.md. The delta is numeric and between explicitly NAMED configs
 * (candidate − baseline); shipping gates are computed in code, never self-assessed.
 * Returns notes: string[] only — interpretive pattern analysis belongs to a
 * fresh-context analyzer reading benchmark.json, not to this tool.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { calculateStats, delta } from "../lib/stats.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { walkIterationDir } from "../lib/workspace.ts";
import type { Benchmark, BenchmarkRun, Expectation } from "../types.ts";

export const name = "aggregate_benchmark";
export const title = "Aggregate graded runs into benchmark.json + benchmark.md";
export const description =
  "Walks an iteration directory of graded runs, computes mean / sample-stddev (n-1) / min / max for " +
  "pass_rate, time_seconds, tokens, and cost_usd per configuration, and a numeric delta between two " +
  "explicitly named configurations (candidate minus baseline — never whichever two configs happened to " +
  "come first). Also evaluates the shipping gates in code: pressure_adherence (every pressure-eval " +
  "candidate-config run COMPLIANT — the '100% workflow adherence under 3+ pressure factors' criterion) " +
  "and skill_lift (candidate pass_rate mean above baseline). Writes benchmark.json and benchmark.md into " +
  "the iteration dir. Run after run_eval has covered every eval; dispatch a fresh-context analyzer over " +
  "benchmark.json for pattern findings.";

export const inputShape = {
  iteration_dir: z.string().describe("Path to <skill>-workspace/iteration-N/."),
  skill_name: z.string(),
  skill_path: z.string().optional(),
  baseline_config: z.string().default("without_skill"),
  candidate_config: z.string().default("with_skill"),
  response_format: z.enum(["concise", "detailed"]).default("concise"),
};

type Input = z.output<z.ZodObject<typeof inputShape>>;

function num(o: Record<string, unknown> | undefined, k: string): number {
  return typeof o?.[k] === "number" ? (o[k] as number) : 0;
}

function generateMarkdown(b: Benchmark): string {
  const lines = [
    `# Benchmark: ${b.metadata.skill_name}`,
    "",
    `**Generated:** ${b.metadata.timestamp}`,
    `**Evals:** ${b.metadata.evals_run.join(", ")}`,
    "",
  ];
  for (const [config, stats] of Object.entries(b.run_summary)) {
    lines.push(`## ${config}`, "| Metric | Mean | Stddev | Min | Max |", "|--------|------|--------|-----|-----|");
    for (const metric of ["pass_rate", "time_seconds", "tokens", "cost_usd"] as const) {
      const s = stats[metric];
      lines.push(`| ${metric} | ${s.mean} | ${s.stddev} | ${s.min} | ${s.max} |`);
    }
    lines.push("");
  }
  if (b.delta) {
    lines.push(`## Delta (${b.delta.candidate} − ${b.delta.baseline})`);
    const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
    lines.push(`- pass_rate: ${sign(b.delta.pass_rate)}`);
    lines.push(`- time_seconds: ${sign(b.delta.time_seconds)}`);
    lines.push(`- tokens: ${sign(b.delta.tokens)}`);
    lines.push(`- cost_usd: ${sign(b.delta.cost_usd)}`);
    lines.push("");
  }
  lines.push("## Gates");
  lines.push(`- pressure_adherence: ${b.gates.pressure_adherence === null ? "n/a (no pressure evals)" : b.gates.pressure_adherence}`);
  lines.push(`- skill_lift: ${b.gates.skill_lift === null ? "n/a" : b.gates.skill_lift}`);
  lines.push("");
  if (b.notes.length > 0) {
    lines.push("## Notes");
    for (const note of b.notes) lines.push(`- ${note}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function handler(args: Input): Promise<ToolResult> {
  const iterDir = resolve(args.iteration_dir);
  if (!existsSync(iterDir)) return err(`iteration_dir does not exist: ${iterDir}`);

  const { runs: walked, notes } = walkIterationDir(iterDir);
  if (walked.length === 0) return err(`no graded runs found under ${iterDir}`);

  const runs: BenchmarkRun[] = walked.map((w) => {
    const summary = (w.grading.summary ?? {}) as Record<string, unknown>;
    const metrics = (w.grading.execution_metrics ?? {}) as Record<string, unknown>;
    const pressure = w.grading.pressure_compliance as Record<string, unknown> | undefined;
    const notesSummary = (w.grading.user_notes_summary ?? {}) as Record<string, unknown>;
    const runNotes = [
      ...(Array.isArray(notesSummary.uncertainties) ? (notesSummary.uncertainties as string[]) : []),
      ...(Array.isArray(notesSummary.workarounds) ? (notesSummary.workarounds as string[]) : []),
    ];
    const metricsFile = join(w.run_dir, "metrics.json");
    let costUsd = 0;
    if (existsSync(metricsFile)) {
      try {
        const m: unknown = JSON.parse(readFileSync(metricsFile, "utf8"));
        if (typeof m === "object" && m !== null) costUsd = num(m as Record<string, unknown>, "total_cost_usd");
      } catch {
        // ignore unreadable metrics
      }
    }
    return {
      eval_id: w.eval_id,
      eval_name: w.eval_name,
      configuration: w.configuration,
      run_number: w.run_number,
      result: {
        pass_rate: num(summary, "pass_rate"),
        passed: num(summary, "passed"),
        total: num(summary, "total"),
        time_seconds: w.timing.total_duration_seconds,
        tokens: w.timing.total_tokens,
        cost_usd: costUsd,
        tool_calls: num(metrics, "total_tool_calls"),
        errors: num(metrics, "errors_encountered"),
      },
      expectations: Array.isArray(w.grading.expectations) ? (w.grading.expectations as Expectation[]) : [],
      pressure_verdict: typeof pressure?.verdict === "string" ? (pressure.verdict as string) : null,
      notes: runNotes,
    };
  });

  // Per-config summary stats.
  const byConfig = new Map<string, BenchmarkRun[]>();
  for (const r of runs) {
    const list = byConfig.get(r.configuration) ?? [];
    list.push(r);
    byConfig.set(r.configuration, list);
  }
  const runSummary: Benchmark["run_summary"] = {};
  for (const [config, list] of byConfig) {
    runSummary[config] = {
      pass_rate: calculateStats(list.map((r) => r.result.pass_rate)),
      time_seconds: calculateStats(list.map((r) => r.result.time_seconds)),
      tokens: calculateStats(list.map((r) => r.result.tokens)),
      cost_usd: calculateStats(list.map((r) => r.result.cost_usd)),
    };
  }

  // Numeric delta between NAMED configs.
  const baseline = runSummary[args.baseline_config];
  const candidate = runSummary[args.candidate_config];
  const deltaBlock =
    baseline && candidate
      ? {
          baseline: args.baseline_config,
          candidate: args.candidate_config,
          pass_rate: delta(candidate.pass_rate.mean, baseline.pass_rate.mean),
          time_seconds: delta(candidate.time_seconds.mean, baseline.time_seconds.mean),
          tokens: delta(candidate.tokens.mean, baseline.tokens.mean),
          cost_usd: delta(candidate.cost_usd.mean, baseline.cost_usd.mean),
        }
      : null;
  if (!deltaBlock) {
    notes.push(
      `delta not computed: need both "${args.baseline_config}" and "${args.candidate_config}" configs (found: ${[...byConfig.keys()].join(", ")})`,
    );
  }

  // Gates (code-computed).
  const pressureRuns = runs.filter((r) => r.configuration === args.candidate_config && r.pressure_verdict !== null);
  const pressureAdherence = pressureRuns.length === 0 ? null : pressureRuns.every((r) => r.pressure_verdict === "COMPLIANT");
  const skillLift = baseline && candidate ? candidate.pass_rate.mean > baseline.pass_rate.mean : null;

  const runsPerConfig = Math.max(0, ...[...byConfig.values()].map((l) => l.length));
  const benchmark: Benchmark = {
    metadata: {
      skill_name: args.skill_name,
      skill_path: args.skill_path ?? "",
      timestamp: new Date().toISOString(),
      evals_run: [...new Set(runs.map((r) => r.eval_name))].sort(),
      runs_per_configuration: runsPerConfig,
    },
    runs,
    run_summary: runSummary,
    delta: deltaBlock,
    gates: { pressure_adherence: pressureAdherence, skill_lift: skillLift },
    notes,
  };

  const jsonPath = join(iterDir, "benchmark.json");
  const mdPath = join(iterDir, "benchmark.md");
  writeFileSync(jsonPath, JSON.stringify(benchmark, null, 2));
  writeFileSync(mdPath, generateMarkdown(benchmark));

  const lines: string[] = [
    `aggregated ${runs.length} runs across ${byConfig.size} config(s) and ${benchmark.metadata.evals_run.length} eval(s)`,
  ];
  for (const [config, stats] of Object.entries(runSummary)) {
    lines.push(`${config}: pass_rate mean ${stats.pass_rate.mean} (±${stats.pass_rate.stddev})`);
  }
  if (deltaBlock) {
    lines.push(
      `delta (${deltaBlock.candidate} − ${deltaBlock.baseline}): pass_rate ${deltaBlock.pass_rate >= 0 ? "+" : ""}${deltaBlock.pass_rate}, ` +
        `time ${deltaBlock.time_seconds >= 0 ? "+" : ""}${deltaBlock.time_seconds}s, tokens ${deltaBlock.tokens >= 0 ? "+" : ""}${deltaBlock.tokens}`,
    );
  }
  lines.push(
    `gates: pressure_adherence=${pressureAdherence === null ? "n/a" : pressureAdherence}, skill_lift=${skillLift === null ? "n/a" : skillLift}`,
  );
  for (const note of notes) lines.push(`note: ${note}`);
  lines.push(`wrote ${jsonPath} and ${mdPath}`);
  if (args.response_format === "detailed") {
    lines.push("", "| run | config | pass_rate | pressure | time_s | tokens |", "|---|---|---|---|---|---|");
    for (const r of runs) {
      lines.push(
        `| ${r.eval_id}/run-${r.run_number} | ${r.configuration} | ${r.result.pass_rate} | ${r.pressure_verdict ?? "-"} | ${r.result.time_seconds} | ${r.result.tokens} |`,
      );
    }
  }

  return ok(lines.join("\n"), {
    ...benchmark,
    benchmark_json_path: jsonPath,
    benchmark_md_path: mdPath,
  });
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
