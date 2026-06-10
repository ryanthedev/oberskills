/**
 * Trigger-set execution shared by test_triggers and optimize_description:
 * run a query set against a listing surface (N probe runs per query, bounded
 * pool, budget ledger) and score per-query pass/fail. Also hosts the
 * 20-query generator (10 positive / 10 near-miss negative).
 */
import { z } from "zod";
import { CostLedger, runStructured, toOutputSchema, utilityOptions } from "./agent.ts";
import { runPool, type PoolOutcome } from "./pool.ts";
import {
  buildListingPlugin,
  removeTempPlugin,
  runProbe,
  type ListingSurface,
  type ProbeOutcome,
} from "./trigger-probe.ts";
import { TriggerQuerySchema, type TriggerQuery, type TriggerQueryResult } from "../types.ts";

const GeneratedQueriesSchema = z.object({
  queries: z.array(TriggerQuerySchema).min(10).max(30),
});

export async function generateTriggerQueries(args: {
  skillName: string;
  description: string;
  skillContent: string;
  model: string;
  ledger: CostLedger;
}): Promise<{ queries: TriggerQuery[] | null; error: string | null }> {
  const { renderPrompt } = await import("./prompts.ts");
  const prompt = renderPrompt("generate-queries", {
    skill_name: args.skillName,
    description: args.description,
    skill_content: args.skillContent.slice(0, 12_000),
  });
  const schema = toOutputSchema(GeneratedQueriesSchema);
  const { output, cost, error } = await runStructured(
    prompt,
    utilityOptions({ model: args.model, schema, budgetUsd: 1 }),
    GeneratedQueriesSchema,
    120_000,
  );
  args.ledger.charge(cost);
  if (!output) return { queries: null, error: error ?? "query generation failed" };
  return { queries: output.queries, error: null };
}

export type TriggerSetResult = {
  results: TriggerQueryResult[];
  summary: { total: number; passed: number; failed: number; infra_errors: number };
  budget_exhausted: boolean;
};

export type ProbeTaskOutcome = { queryIndex: number; outcome: ProbeOutcome };

/**
 * Pure scoring over pool outcomes. Exported for tests.
 *
 * - skipped slots (budget aborts) are not scheduled, not counted.
 * - failed slots (a task threw) are infra_error runs for that query — never
 *   folded into "did not trigger".
 * - a query with zero scoreable runs gets pass: null and is excluded from
 *   passed/failed counts.
 * - threshold edges: a positive query passes at trigger_rate >= threshold; a
 *   negative passes at trigger_rate < threshold (rate exactly at the threshold
 *   fails a negative).
 */
export function scoreTriggerSet(args: {
  queries: TriggerQuery[];
  outcomes: PoolOutcome<ProbeTaskOutcome>[];
  /** queryIndex per task slot (parallel to outcomes) — needed for failed slots. */
  taskQueryIndex: number[];
  triggerThreshold: number;
}): { results: TriggerQueryResult[]; summary: TriggerSetResult["summary"] } {
  const results: TriggerQueryResult[] = args.queries.map((q) => ({
    query: q.query,
    should_trigger: q.should_trigger,
    trigger_rate: 0,
    triggers: 0,
    runs: 0,
    infra_errors: 0,
    pass: null,
  }));

  args.outcomes.forEach((o, i) => {
    if (o.status === "skipped") return; // budget-skipped — not scheduled, not counted
    const queryIndex = o.status === "done" ? o.value.queryIndex : args.taskQueryIndex[i];
    const entry = queryIndex !== undefined ? results[queryIndex] : undefined;
    if (!entry) return;
    entry.runs += 1;
    if (o.status === "failed") entry.infra_errors += 1; // thrown task = infra, never "did not trigger"
    else if (o.value.outcome === "triggered") entry.triggers += 1;
    else if (o.value.outcome === "infra_error") entry.infra_errors += 1;
  });

  let passed = 0;
  let failed = 0;
  let infraTotal = 0;
  for (const entry of results) {
    infraTotal += entry.infra_errors;
    const scoredRuns = entry.runs - entry.infra_errors;
    if (scoredRuns <= 0) {
      entry.pass = null; // all runs infra-errored or budget-skipped
      continue;
    }
    entry.trigger_rate = Math.round((entry.triggers / scoredRuns) * 10000) / 10000;
    entry.pass = entry.should_trigger
      ? entry.trigger_rate >= args.triggerThreshold
      : entry.trigger_rate < args.triggerThreshold;
    if (entry.pass) passed += 1;
    else failed += 1;
  }

  return {
    results,
    summary: { total: args.queries.length, passed, failed, infra_errors: infraTotal },
  };
}

export async function runTriggerSet(args: {
  surface: ListingSurface;
  queries: TriggerQuery[];
  runsPerQuery: number;
  triggerThreshold: number;
  model: string;
  concurrency: number;
  ledger: CostLedger;
}): Promise<TriggerSetResult> {
  const pluginDir = buildListingPlugin(args.surface);
  try {
    // Flatten query × run into one task list for the pool.
    const tasks: (() => Promise<ProbeTaskOutcome>)[] = [];
    const taskQueryIndex: number[] = [];
    for (let qi = 0; qi < args.queries.length; qi++) {
      for (let r = 0; r < args.runsPerQuery; r++) {
        const queryIndex = qi;
        const queryText = args.queries[qi]?.query ?? "";
        taskQueryIndex.push(queryIndex);
        tasks.push(async () => {
          const probe = await runProbe(queryText, pluginDir, args.surface.name, args.model);
          args.ledger.charge(probe.cost);
          return { queryIndex, outcome: probe.outcome };
        });
      }
    }

    const outcomes = await runPool(tasks, args.concurrency, () => args.ledger.exceeded);
    const { results, summary } = scoreTriggerSet({
      queries: args.queries,
      outcomes,
      taskQueryIndex,
      triggerThreshold: args.triggerThreshold,
    });

    return { results, summary, budget_exhausted: args.ledger.exceeded };
  } finally {
    removeTempPlugin(pluginDir);
  }
}
