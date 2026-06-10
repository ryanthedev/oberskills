/**
 * Shared grading routine for run_eval auto-grading and the grade_run tool.
 *
 * Split of labor: programmatic checks are evaluated in TS; the grader model
 * (fresh context, read-only tools, structured output) grades the string
 * expectations and — for pressure evals — reports raw pattern sightings;
 * TS then computes the summary, stamps severities, computes the verdict, and
 * writes grading.json.
 *
 * Dispatch carries zero intent framing: the grader sees file layout + assertion
 * texts only — never "the skill should pass" narrative.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  GraderOutputSchema,
  type Expectation,
  type Grading,
  type PressureBlockId,
  type ProgrammaticCheck,
  type Timing,
} from "../types.ts";
import { graderOptions, runStructured, toOutputSchema } from "./agent.ts";
import { evaluateChecks } from "./checks.ts";
import { renderPrompt } from "./prompts.ts";
import { loadPatterns, pressureVerdict, stampSeverities } from "./verdict.ts";

const GRADER_TIMEOUT_MS = 180_000;

function graderJsonSchema(): Record<string, unknown> {
  return toOutputSchema(GraderOutputSchema);
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function patternTable(): string {
  return loadPatterns()
    .map((p) => `- ${p.id}: ${p.description} (e.g. "${p.example}")`)
    .join("\n");
}

export type GradeResult = {
  grading: Grading | null;
  gradingPath: string;
  cost: number;
  /** True when the grader call ended without a result — cost is a conservative budget-cap charge. */
  costIncomplete: boolean;
  error: string | null;
};

export async function gradeRunDir(args: {
  runDir: string;
  expectations: string[];
  checks?: ProgrammaticCheck[];
  pressureBlocks?: PressureBlockId[];
  graderModel: string;
  budgetUsd: number;
}): Promise<GradeResult> {
  const runDir = resolve(args.runDir);
  const gradingPath = join(runDir, "grading.json");
  const pressure = (args.pressureBlocks?.length ?? 0) > 0;

  // 1. Deterministic floor.
  const checkExpectations: Expectation[] = args.checks ? evaluateChecks(args.checks, runDir) : [];

  // 2. Model grading of the string expectations.
  const numbered = args.expectations.map((e, i) => `${i + 1}. ${e}`).join("\n");
  const prompt = renderPrompt(
    "grader",
    {
      numbered_expectations: numbered,
      pattern_id_description_example_table: pressure ? patternTable() : "",
    },
    { pressure },
  );

  const options = {
    ...graderOptions(args.graderModel, runDir, graderJsonSchema()),
    maxBudgetUsd: args.budgetUsd,
  };
  const { output, cost, error, costIncomplete } = await runStructured(prompt, options, GraderOutputSchema, GRADER_TIMEOUT_MS);
  if (!output) {
    return { grading: null, gradingPath, cost, costIncomplete, error: error ?? "grader returned nothing" };
  }

  // 3. Merge + compute (TS judgment over LLM perception).
  const expectations: Expectation[] = [...checkExpectations, ...output.expectations];
  const passed = expectations.filter((e) => e.passed).length;
  const total = expectations.length;

  const metrics = readJsonObject(join(runDir, "metrics.json"));
  const timingRaw = readJsonObject(join(runDir, "timing.json"));
  const num = (o: Record<string, unknown>, k: string): number =>
    typeof o[k] === "number" ? (o[k] as number) : 0;
  const timing: Timing = {
    total_tokens: num(timingRaw, "total_tokens"),
    duration_ms: num(timingRaw, "duration_ms"),
    total_duration_seconds: num(timingRaw, "total_duration_seconds"),
  };

  const grading: Grading = {
    expectations,
    summary: {
      passed,
      failed: total - passed,
      total,
      pass_rate: total > 0 ? Math.round((passed / total) * 10000) / 10000 : 0,
    },
    execution_metrics: {
      total_tool_calls: num(metrics, "total_tool_calls"),
      errors_encountered: num(metrics, "errors_encountered"),
    },
    timing,
    claims: output.claims,
    user_notes_summary: output.user_notes_summary,
    eval_feedback: output.eval_feedback,
    ...(pressure
      ? {
          pressure_compliance: pressureVerdict(
            stampSeverities(output.patterns_found ?? []),
            output.steps_skipped ?? [],
          ),
        }
      : {}),
  };

  writeFileSync(gradingPath, JSON.stringify(grading, null, 2));
  return { grading, gradingPath, cost, costIncomplete, error: null };
}
