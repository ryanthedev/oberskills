/**
 * optimize_description — chunked iterative description tuning against a
 * held-out trigger set. ONE iteration per call: action "start" initializes
 * state (queries, stratified 60/40 split, seed 42) and runs iteration 1;
 * action "continue" resumes from workspace-persisted state. The caller loops
 * until done: true. No 10-minute single calls; a dropped call loses nothing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { CostLedger, runStructured, toOutputSchema, utilityOptions } from "../lib/agent.ts";
import { parseSkillDir } from "../lib/frontmatter.ts";
import { renderPrompt } from "../lib/prompts.ts";
import type { ListingSurface } from "../lib/trigger-probe.ts";
import { generateTriggerQueries, runTriggerSet } from "../lib/trigger-set.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { workspaceRoot, writeJson } from "../lib/workspace.ts";
import {
  OptimizationStateSchema,
  TriggerQuerySetSchema,
  type OptimizationState,
  type TriggerQuery,
} from "../types.ts";

export const name = "optimize_description";
export const title = "Optimize a skill description against a held-out trigger set (one iteration per call)";
export const description =
  "Iteratively improves a skill's description for trigger accuracy, one iteration per call. " +
  "action 'start': generates (or accepts) 20 trigger queries, splits them 60/40 into train/held-out test " +
  "(stratified by should_trigger, seed 42), evaluates the current description, and proposes an improvement " +
  "from the train failures. action 'continue': runs the next iteration from state persisted in the workspace. " +
  "Loop on 'continue' until done: true, then take best_description — selection is by held-out test score, " +
  "which prevents overfitting to the train queries. Use when test_triggers shows failures. " +
  "Only the description is tuned; when_to_use is held constant. Writes nothing into the skill — applying " +
  "the winning description is the caller's decision.";

const MAX_DESCRIPTION_CHARS = 1024;
const STATE_FILE = "description-optimization.json";
const SPLIT_SEED = 42;

const QueryShape = z.object({ query: z.string(), should_trigger: z.boolean() });

export const inputShape = {
  skill_path: z.string().describe("Absolute path to the skill directory."),
  action: z
    .enum(["start", "continue"])
    .describe("'start' initializes (or restarts) the optimization; 'continue' runs the next iteration."),
  queries: z
    .array(QueryShape)
    .min(1)
    .optional()
    .describe("Trigger eval set. Omit to auto-generate 20. Start only — ignored on action:'continue'."),
  queries_path: z
    .string()
    .optional()
    .describe("Path to a JSON query-set file. Start only — ignored on action:'continue'."),
  max_iterations: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Start only — persisted in state and ignored on action:'continue'."),
  holdout: z
    .number()
    .min(0.1)
    .max(0.5)
    .default(0.4)
    .describe(
      "Held-out fraction (default 40%), stratified by should_trigger, seed 42. Start only — the split is fixed in state and ignored on action:'continue'.",
    ),
  runs_per_query: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Start only — persisted in state and ignored on action:'continue'."),
  trigger_threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("Start only — persisted in state and ignored on action:'continue'."),
  probe_model: z
    .string()
    .default("haiku")
    .describe("Model for trigger probes. Start only — persisted in state and ignored on action:'continue'."),
  improve_model: z
    .string()
    .default("sonnet")
    .describe(
      "Model that generates queries and proposes improved descriptions. Start only — persisted in state and ignored on action:'continue'.",
    ),
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Start only — persisted in state and ignored on action:'continue'."),
  budget_usd: z.number().default(5).describe("Per-call cost cap for this iteration (applies to every call, including continue)."),
};

type Input = z.output<z.ZodObject<typeof inputShape>>;

// --- deterministic seeded shuffle (mulberry32) for the stratified split -----

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** Stratified train/test split, seed-deterministic. Exported for tests. */
export function splitEvalSet(
  querySet: TriggerQuery[],
  holdout: number,
): { train: TriggerQuery[]; test: TriggerQuery[] } {
  const rand = mulberry32(SPLIT_SEED);
  const positive = seededShuffle(querySet.filter((q) => q.should_trigger), rand);
  const negative = seededShuffle(querySet.filter((q) => !q.should_trigger), rand);
  const posSplit = Math.floor(positive.length * holdout);
  const negSplit = Math.floor(negative.length * holdout);
  return {
    test: [...positive.slice(0, posSplit), ...negative.slice(0, negSplit)],
    train: [...positive.slice(posSplit), ...negative.slice(negSplit)],
  };
}

// --- improvement call --------------------------------------------------------

const ImprovedSchema = z.object({
  new_description: z.string().max(MAX_DESCRIPTION_CHARS),
});

async function proposeImprovement(args: {
  state: OptimizationState;
  failedTriggers: string[];
  falsePositives: string[];
  passed: number;
  total: number;
  skillContent: string;
  ledger: CostLedger;
}): Promise<{ description: string | null; error: string | null }> {
  const historyText =
    args.state.history.length > 0
      ? "PAST ATTEMPTS:\n" +
        args.state.history
          .map(
            (h) =>
              `  Iteration ${h.iteration}: train=${Math.round(h.train_score * 100)}%, test=${Math.round(h.test_score * 100)}%\n` +
              `    Description: ${h.description.slice(0, 200)}...`,
          )
          .join("\n")
      : "";
  const prompt = renderPrompt("improve-description", {
    skill_name: args.state.skill_name,
    current_description: args.state.current_description,
    passed: String(args.passed),
    total: String(args.total),
    failed_triggers: args.failedTriggers.length > 0 ? JSON.stringify(args.failedTriggers, null, 2) : "None",
    false_positives: args.falsePositives.length > 0 ? JSON.stringify(args.falsePositives, null, 2) : "None",
    history_text: historyText,
    skill_content: args.skillContent.slice(0, 3000),
    max_chars: String(MAX_DESCRIPTION_CHARS),
  });
  const schema = toOutputSchema(ImprovedSchema);
  const { output, cost, error } = await runStructured(
    prompt,
    utilityOptions({ model: args.state.improve_model, schema, budgetUsd: 1 }),
    ImprovedSchema,
    120_000,
  );
  args.ledger.charge(cost);
  if (!output) return { description: null, error: error ?? "improvement call failed" };
  // Schema maxLength already bounds it; hard truncate is a belt-and-braces parity with the Python.
  return { description: output.new_description.slice(0, MAX_DESCRIPTION_CHARS), error: null };
}

// --- handler -----------------------------------------------------------------

export async function handler(args: Input): Promise<ToolResult> {
  const skillPath = resolve(args.skill_path);
  if (!existsSync(skillPath)) return err(`skill_path does not exist: ${skillPath}`);
  const wsRoot = workspaceRoot(skillPath);
  const statePath = join(wsRoot, STATE_FILE);
  const ledger = new CostLedger(args.budget_usd);

  let state: OptimizationState;
  const startWarnings: string[] = [];

  if (args.action === "start") {
    const fm = parseSkillDir(skillPath);
    const skillName = fm.name ?? skillPath.split("/").filter(Boolean).pop() ?? "skill";
    if (!fm.description) return err("skill has no description to optimize");

    let queries: TriggerQuery[];
    if (args.queries && args.queries.length > 0) {
      queries = args.queries;
    } else if (args.queries_path) {
      const parsed = TriggerQuerySetSchema.safeParse(JSON.parse(readFileSync(resolve(args.queries_path), "utf8")));
      if (!parsed.success) return err(`queries_path is not a valid query set: ${parsed.error.message}`);
      queries = parsed.data;
    } else {
      const generated = await generateTriggerQueries({
        skillName,
        description: fm.description,
        skillContent: fm.content,
        model: args.improve_model,
        ledger,
      });
      if (!generated.queries) return err(`query generation failed: ${generated.error}`);
      queries = generated.queries;
      writeJson(wsRoot, join(wsRoot, "trigger-queries.json"), queries);
    }

    const { train, test } = splitEvalSet(queries, args.holdout);
    if (test.length === 0) {
      return err(
        `holdout test split is empty (${queries.length} queries at holdout ${args.holdout}) — ` +
          "held-out selection is impossible; provide more queries or raise holdout",
      );
    }
    // An empty stratum in the test split blinds held-out selection on one axis.
    if (!test.some((q) => q.should_trigger)) {
      startWarnings.push(
        "WARNING: holdout test split has no should_trigger queries — held-out selection cannot detect missed triggers; add positive queries",
      );
    }
    if (!test.some((q) => !q.should_trigger)) {
      startWarnings.push(
        "WARNING: holdout test split has no negative queries — held-out selection cannot detect false positives; add near-miss queries",
      );
    }
    state = {
      skill_name: skillName,
      skill_path: skillPath,
      original_description: fm.description,
      when_to_use: fm.when_to_use,
      current_description: fm.description,
      train_set: train,
      test_set: test,
      max_iterations: args.max_iterations,
      runs_per_query: args.runs_per_query,
      trigger_threshold: args.trigger_threshold,
      probe_model: args.probe_model,
      improve_model: args.improve_model,
      concurrency: args.concurrency,
      history: [],
      total_cost_usd: 0,
      done: false,
    };
  } else {
    if (!existsSync(statePath)) {
      return err(`no optimization state at ${statePath} — call with action: "start" first`);
    }
    const parsed = OptimizationStateSchema.safeParse(JSON.parse(readFileSync(statePath, "utf8")));
    if (!parsed.success) return err(`optimization state is corrupt: ${parsed.error.message}`);
    state = parsed.data;
  }

  if (state.done) {
    return ok(summaryText(state, statePath), finalStructured(state, statePath));
  }

  // ---- run ONE iteration: evaluate current description on train + test ------
  const iteration = state.history.length + 1;
  const surface: ListingSurface = {
    name: state.skill_name,
    description: state.current_description,
    whenToUse: state.when_to_use,
  };
  const common = {
    surface,
    runsPerQuery: state.runs_per_query,
    triggerThreshold: state.trigger_threshold,
    model: state.probe_model,
    concurrency: state.concurrency,
    ledger,
  };
  const trainResults = await runTriggerSet({ ...common, queries: state.train_set });
  const testResults = await runTriggerSet({ ...common, queries: state.test_set });

  const trainScorable = trainResults.results.filter((r) => r.pass !== null);
  const testScorable = testResults.results.filter((r) => r.pass !== null);
  const trainScore = trainScorable.length > 0 ? trainResults.summary.passed / trainScorable.length : 0;
  const testScore = testScorable.length > 0 ? testResults.summary.passed / testScorable.length : 0;

  state.history.push({
    iteration,
    description: state.current_description,
    train_score: Math.round(trainScore * 10000) / 10000,
    test_score: Math.round(testScore * 10000) / 10000,
    cost_usd: Math.round(ledger.spent * 10000) / 10000,
  });

  // ---- decide: done, or propose the next description -------------------------
  // Budget exhaustion is checked BEFORE trainPerfect: when the ledger ran out
  // mid-evaluation, remaining probes were skipped, so a "perfect" train set may
  // just be an incomplete one — never declare early-stop on partial scores.
  const trainPerfect = trainResults.summary.failed === 0 && trainResults.summary.infra_errors === 0 && trainScorable.length > 0;
  if (ledger.exceeded) {
    state.done = true;
    state.done_reason = "per-call budget exhausted during evaluation";
  } else if (trainPerfect) {
    state.done = true;
    state.done_reason = "train set perfect — stopped early";
  } else if (state.history.length >= state.max_iterations) {
    state.done = true;
    state.done_reason = `reached max_iterations (${state.max_iterations})`;
  } else {
    const fm = parseSkillDir(skillPath);
    const failedTriggers = trainResults.results.filter((r) => r.pass === false && r.should_trigger).map((r) => r.query);
    const falsePositives = trainResults.results.filter((r) => r.pass === false && !r.should_trigger).map((r) => r.query);
    const improved = await proposeImprovement({
      state,
      failedTriggers,
      falsePositives,
      passed: trainResults.summary.passed,
      total: trainResults.summary.total,
      skillContent: fm.content,
      ledger,
    });
    if (improved.description) {
      state.current_description = improved.description;
    } else {
      state.done = true;
      state.done_reason = `improvement call failed: ${improved.error}`;
    }
  }

  state.total_cost_usd = Math.round((state.total_cost_usd + ledger.spent) * 10000) / 10000;
  writeJson(wsRoot, statePath, state);

  return ok(
    [...startWarnings, summaryText(state, statePath)].join("\n"),
    { ...finalStructured(state, statePath), ...(startWarnings.length > 0 ? { warnings: startWarnings } : {}) },
  );
}

function best(state: OptimizationState): { description: string; test_score: number; iteration: number } {
  let bestEntry = state.history[0];
  for (const h of state.history) {
    if (!bestEntry || h.test_score > bestEntry.test_score) bestEntry = h;
  }
  return bestEntry
    ? { description: bestEntry.description, test_score: bestEntry.test_score, iteration: bestEntry.iteration }
    : { description: state.original_description, test_score: 0, iteration: 0 };
}

function finalStructured(state: OptimizationState, statePath: string): Record<string, unknown> {
  const b = best(state);
  const last = state.history[state.history.length - 1];
  return {
    done: state.done,
    ...(state.done_reason ? { done_reason: state.done_reason } : {}),
    iteration: last?.iteration ?? 0,
    iterations_run: state.history.length,
    max_iterations: state.max_iterations,
    train_score: last?.train_score ?? 0,
    test_score: last?.test_score ?? 0,
    original_description: state.original_description,
    best_description: b.description,
    best_test_score: b.test_score,
    best_iteration: b.iteration,
    history: state.history,
    total_cost_usd: state.total_cost_usd,
    history_path: statePath,
  };
}

function summaryText(state: OptimizationState, statePath: string): string {
  const b = best(state);
  const last = state.history[state.history.length - 1];
  const lines = [
    state.done
      ? `DONE (${state.done_reason ?? "complete"}) after ${state.history.length} iteration(s).`
      : `Iteration ${last?.iteration ?? 0}/${state.max_iterations} complete — call again with action: "continue".`,
    `last: train=${last?.train_score ?? 0} test=${last?.test_score ?? 0}; best (by held-out test): iteration ${b.iteration} test=${b.test_score}`,
    `best_description: ${b.description}`,
    `total cost so far: $${state.total_cost_usd}; state: ${statePath}`,
  ];
  return lines.join("\n");
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
