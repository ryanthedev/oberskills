/**
 * grade_run — standalone (re)grader for an existing run directory.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { GRADER_DEFAULT_BUDGET } from "../lib/agent.ts";
import { gradeRunDir } from "../lib/grade.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { PressureBlockIdSchema, ProgrammaticCheckSchema } from "../types.ts";

export const name = "grade_run";
export const title = "(Re)grade an existing run directory";
export const description =
  "Grades or re-grades one run directory that already contains transcript.jsonl and outputs/: evaluates " +
  "programmatic checks in code, dispatches a fresh-context grader model (read-only tools, structured output) " +
  "for the string expectations, computes the pressure-compliance verdict in code (only when pressure_block " +
  "ids are supplied), and writes grading.json. Use after editing assertions, or to grade runs produced " +
  "outside run_eval. run_eval already does this automatically.";

export const inputShape = {
  run_dir: z.string().describe("Path to .../<config>/run-N/ containing transcript.jsonl and outputs/."),
  expectations: z.array(z.string()).min(1).describe("Assertion strings to grade PASS/FAIL with cited evidence."),
  checks: z.array(ProgrammaticCheckSchema).optional().describe("Judge-free checks evaluated in code before the model grader."),
  pressure_blocks: z
    .array(PressureBlockIdSchema)
    .optional()
    .describe("Pressure-block ids the eval prompt contained. Presence activates the pressure-compliance scan; omit for non-pressure evals."),
  grader_model: z.string().default("haiku"),
  budget_usd: z
    .number()
    .default(GRADER_DEFAULT_BUDGET)
    .describe(`Grading budget (default $${GRADER_DEFAULT_BUDGET}, the shared grader default).`),
};

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const runDir = resolve(args.run_dir);
  if (!existsSync(runDir)) return err(`run_dir does not exist: ${runDir}`);
  if (!existsSync(join(runDir, "transcript.jsonl")) && !existsSync(join(runDir, "outputs"))) {
    return err(`run_dir has neither transcript.jsonl nor outputs/: ${runDir}`);
  }

  const { grading, gradingPath, cost, error } = await gradeRunDir({
    runDir,
    expectations: args.expectations,
    ...(args.checks ? { checks: args.checks } : {}),
    ...(args.pressure_blocks ? { pressureBlocks: args.pressure_blocks } : {}),
    graderModel: args.grader_model,
    budgetUsd: args.budget_usd,
  });

  if (!grading) return err(`grading failed: ${error}`);

  const lines = [
    `graded ${grading.summary.passed}/${grading.summary.total} passed (pass_rate ${grading.summary.pass_rate}) — ${gradingPath}`,
    ...(grading.pressure_compliance
      ? [
          `pressure_compliance: ${grading.pressure_compliance.verdict} ` +
            `(${grading.pressure_compliance.rationalization_count} rationalization(s), ` +
            `${grading.pressure_compliance.steps_skipped.length} skipped step(s))`,
        ]
      : []),
    ...grading.expectations.filter((e) => !e.passed).map((e) => `FAIL: ${e.text} — ${e.evidence.slice(0, 160)}`),
    `cost $${Math.round(cost * 10000) / 10000}`,
  ];

  return ok(lines.join("\n"), {
    ...grading,
    grading_path: gradingPath,
    cost_usd: Math.round(cost * 10000) / 10000,
  });
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
