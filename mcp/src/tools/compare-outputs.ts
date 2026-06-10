/**
 * compare_outputs — blind A/B comparison. The server shuffles which side is
 * presented as "first" vs "second" BEFORE the judge call and de-shuffles in the
 * result, so the judge cannot learn a position bias and never knows which
 * configuration produced which side.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import { runStructured, toOutputSchema, utilityOptions } from "../lib/agent.ts";
import { renderPrompt } from "../lib/prompts.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ComparisonJudgeOutputSchema, type Comparison, type ComparisonJudgeOutput } from "../types.ts";

export const name = "compare_outputs";
export const title = "Blind A/B comparison of two outputs";
export const description =
  "Dispatches a fresh-context model to judge two output directories without knowing which configuration " +
  "produced them: it generates 4-6 task-derived rubric criteria, scores both sides 1-5 with cited evidence, " +
  "checks optional assertions as a tiebreaker, and must pick a winner (ties rare). Sides are shuffled before " +
  "dispatch and de-shuffled in the result, so the judge cannot learn a position bias. Use for subjective " +
  "skills where assertions would be forced (writing style, design quality) — prefer run_eval with assertions " +
  "when behavior is checkable.";

export const inputShape = {
  output_a_path: z.string().describe("Directory or file for side A (e.g. a with_skill outputs dir)."),
  output_b_path: z.string().describe("Directory or file for side B."),
  task_description: z.string().describe("The original eval prompt, verbatim."),
  assertions: z.array(z.string()).optional(),
  judge_model: z.string().default("sonnet"),
  budget_usd: z.number().default(1),
  write_to: z.string().optional().describe("If set, comparison.json is written here."),
};

type Input = z.output<z.ZodObject<typeof inputShape>>;

function stageSide(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  if (statSync(src).isDirectory()) {
    cpSync(src, dest, { recursive: true });
  } else {
    cpSync(src, join(dest, basename(src)));
  }
}

/**
 * De-shuffle the judge output back to a/b and recompute the verdict in TS.
 * Pure; exported for tests.
 *
 * - totals are recomputed from per-criterion scores (the judge's arithmetic is
 *   advisory only); a mismatch is flagged in notes.
 * - winner is derived from the recomputed totals; the judge's pick is the
 *   tiebreaker (it saw the assertion results). A judge pick that contradicts
 *   the recomputed totals is overridden and flagged in notes.
 */
export function resolveComparison(output: ComparisonJudgeOutput, positionsSwapped: boolean): Comparison {
  const aKey = positionsSwapped ? "second" : "first";
  const bKey = positionsSwapped ? "first" : "second";
  const notes: string[] = [];

  const sum = (scores: { score: number }[]): number => scores.reduce((acc, s) => acc + s.score, 0);
  const totals = { output_a: sum(output.scores[aKey]), output_b: sum(output.scores[bKey]) };
  const judgeTotals = { output_a: output.totals[aKey], output_b: output.totals[bKey] };
  if (judgeTotals.output_a !== totals.output_a || judgeTotals.output_b !== totals.output_b) {
    notes.push(
      `judge-reported totals (A=${judgeTotals.output_a}, B=${judgeTotals.output_b}) differ from recomputed ` +
        `criterion sums (A=${totals.output_a}, B=${totals.output_b}); recomputed totals are authoritative`,
    );
  }

  const judgeWinner: Comparison["winner"] =
    output.winner === "tie" ? "tie" : output.winner === aKey ? "output_a" : "output_b";
  let winner: Comparison["winner"];
  if (totals.output_a > totals.output_b) winner = "output_a";
  else if (totals.output_b > totals.output_a) winner = "output_b";
  else winner = judgeWinner; // totals tied — the judge's pick (assertion tiebreaker) decides
  if (winner !== judgeWinner) {
    notes.push(`judge picked ${judgeWinner} but recomputed totals favor ${winner}; winner follows the recomputed totals`);
  }

  return {
    rubric: output.rubric,
    scores: { output_a: output.scores[aKey], output_b: output.scores[bKey] },
    assertions: output.assertions.map((as) => ({
      text: as.text,
      a_pass: positionsSwapped ? as.second_pass : as.first_pass,
      b_pass: positionsSwapped ? as.first_pass : as.second_pass,
    })),
    totals,
    winner,
    margin: output.margin,
    reasoning: output.reasoning,
    positions_swapped: positionsSwapped,
    notes,
  };
}

export async function handler(args: Input): Promise<ToolResult> {
  const aPath = resolve(args.output_a_path);
  const bPath = resolve(args.output_b_path);
  if (!existsSync(aPath)) return err(`output_a_path does not exist: ${aPath}`);
  if (!existsSync(bPath)) return err(`output_b_path does not exist: ${bPath}`);

  const positionsSwapped = Math.random() < 0.5;
  const stage = mkdtempSync(join(tmpdir(), "skill-eval-compare-"));
  try {
    stageSide(positionsSwapped ? bPath : aPath, join(stage, "first"));
    stageSide(positionsSwapped ? aPath : bPath, join(stage, "second"));

    const assertions = args.assertions ?? [];
    const prompt = renderPrompt(
      "comparator",
      {
        task_description: args.task_description,
        numbered_assertions: assertions.map((a, i) => `${i + 1}. ${a}`).join("\n"),
      },
      { has_assertions: assertions.length > 0 },
    );

    const schema = toOutputSchema(ComparisonJudgeOutputSchema);
    const { output, cost, error } = await runStructured(
      prompt,
      utilityOptions({
        model: args.judge_model,
        schema,
        budgetUsd: args.budget_usd,
        maxTurns: 16,
        cwd: stage,
        readTools: true,
      }),
      ComparisonJudgeOutputSchema,
      180_000,
    );
    if (!output) return err(`comparison judge failed: ${error}`);

    // De-shuffle + recompute totals/winner in TS.
    const comparison = resolveComparison(output, positionsSwapped);

    let writtenTo: string | undefined;
    if (args.write_to) {
      const target = resolve(args.write_to);
      const file = target.endsWith(".json") ? target : join(target, "comparison.json");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(comparison, null, 2));
      writtenTo = file;
    }

    const lines = [
      `winner: ${comparison.winner} (${comparison.margin}) — totals A=${comparison.totals.output_a} B=${comparison.totals.output_b}`,
      comparison.reasoning,
      ...comparison.notes.map((n) => `NOTE: ${n}`),
      `positions_swapped: ${positionsSwapped}; cost $${Math.round(cost * 10000) / 10000}`,
      ...(writtenTo ? [`wrote ${writtenTo}`] : []),
    ];
    return ok(lines.join("\n"), { ...comparison, cost_usd: Math.round(cost * 10000) / 10000 });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
