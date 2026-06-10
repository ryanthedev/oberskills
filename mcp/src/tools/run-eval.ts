/**
 * run_eval — execute one eval (with/without skill) in isolated headless
 * sessions and auto-grade each run.
 *
 * Both configurations are spawned in the same call through one bounded pool —
 * the same-turn-baseline rule is structurally guaranteed, not instructed.
 * Pressure prompts are composed deterministically from data/pressure-blocks.json
 * (>= 3 blocks enforced in code).
 */
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { z } from "zod";
import {
  GRADER_DEFAULT_BUDGET,
  SUBJECT_DEFAULT_TOOLS,
  defaultGraderModel,
  runBounded,
  subjectOptions,
} from "../lib/agent.ts";
import { parseSkillDir } from "../lib/frontmatter.ts";
import { gradeRunDir } from "../lib/grade.ts";
import { runPool } from "../lib/pool.ts";
import { buildFullSkillPlugin, removeTempPlugin } from "../lib/trigger-probe.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { iterationDir, runDir as runDirPath, workspaceRoot, writeJson } from "../lib/workspace.ts";
import {
  EvalsFileSchema,
  OfficialEvalSchema,
  PressureBlocksFileSchema,
  type EvalDef,
  type RunRecord,
  type RunStatus,
  type Timing,
} from "../types.ts";

export const name = "run_eval";
export const title = "Run one eval (with/without skill) and grade it";
export const description =
  "Executes a single eval from an evals.json file against a skill: spawns isolated headless Claude sessions " +
  "for each configuration (default with_skill and without_skill) x N runs, all in parallel in this one call — " +
  "never with-skill first and baselines later. Each run gets a fresh throwaway directory as its working " +
  "directory; the full message stream is captured to transcript.jsonl, and timing.json + metrics.json are " +
  "written from the typed result. If the eval declares pressure_blocks, the prompt is composed " +
  "deterministically (3+ blocks enforced). Programmatic checks (artifact/trace/invariant) are evaluated in " +
  "code; remaining expectations are graded by a separate fresh-context grader model, and the compliance " +
  "verdict is computed in code. Subject sessions run with bypassPermissions so unattended runs never stall; " +
  "this is bounded by cwd = the throwaway run dir, a restricted default toolset (Read, Write, Edit, Glob, " +
  "Grep, Bash, plus Skill when a skill plugin is mounted — widen explicitly via allowed_tools), " +
  "WebSearch/WebFetch disallowed unless allow_network, " +
  "maxTurns 50, the per-run budget cap, and a per-run timeout that kills the session. " +
  "Runs are isolated: no user settings, no bundled skills, no other MCP servers. " +
  "After all evals, run aggregate_benchmark.";

export const inputShape = {
  skill_path: z.string().describe("Absolute path to the skill directory."),
  evals_path: z
    .string()
    .describe(
      "Path to evals.json (house schema; the official Anthropic eval shape {skills, query, files, expected_behavior} is also accepted and normalized).",
    ),
  eval_id: z.string().describe("Which eval in the file to run, by id."),
  workspace: z.string().optional().describe("Workspace root. Default: <skill-parent>/<skill-name>-workspace."),
  iteration: z.number().int().min(1).default(1).describe("Writes under iteration-N/."),
  configurations: z
    .array(z.enum(["with_skill", "without_skill", "old_skill"]))
    .default(["with_skill", "without_skill"])
    .describe("old_skill requires old_skill_path (snapshot comparison for skill improvements)."),
  old_skill_path: z.string().optional(),
  runs: z.number().int().min(1).max(5).default(3),
  model: z.string().default("sonnet").describe("Model for the eval subject sessions."),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  grade: z
    .boolean()
    .default(true)
    .describe("Grade each run immediately (grader model defaults one tier below the subject model unless grader_model is set)."),
  grader_model: z.string().optional(),
  grader_budget_usd: z
    .number()
    .default(GRADER_DEFAULT_BUDGET)
    .describe(`Budget per auto-graded run (default $${GRADER_DEFAULT_BUDGET} — sized so opus/sonnet graders don't starve).`),
  allow_network: z.boolean().default(false).describe("When false, WebSearch/WebFetch are disallowed in subject sessions."),
  allowed_tools: z
    .array(z.string())
    .optional()
    .describe(
      `Explicitly widen the subject toolset. Default: ${SUBJECT_DEFAULT_TOOLS.join(", ")} (plus Skill when a skill plugin is mounted). ` +
        "WebSearch/WebFetch stay disallowed unless allow_network.",
    ),
  per_run_budget_usd: z.number().default(2),
  per_run_timeout_s: z.number().default(600),
  concurrency: z.number().int().min(1).max(10).default(4),
  response_format: z.enum(["concise", "detailed"]).default("concise"),
};

type Config = "with_skill" | "without_skill" | "old_skill";

type Input = z.output<z.ZodObject<typeof inputShape>>;

/** Load + normalize an evals file. Exported for tests. */
export function loadEvalsFile(evalsPath: string, fallbackSkillName: string): { skill_name: string; evals: EvalDef[] } {
  const parsed: unknown = JSON.parse(readFileSync(evalsPath, "utf8"));
  // Official Anthropic shape: a JSON array of {skills, query, files, expected_behavior}.
  if (Array.isArray(parsed)) {
    const evals = parsed.map((entry, i) => {
      const official = OfficialEvalSchema.parse(entry);
      return {
        id: `eval-${i + 1}`,
        prompt: official.query,
        files: official.files ?? [],
        expectations: official.expected_behavior ?? [],
      } satisfies EvalDef;
    });
    return { skill_name: fallbackSkillName, evals };
  }
  return EvalsFileSchema.parse(parsed);
}

/** Compose the run prompt; enforces the 3+ pressure-block rule in code. */
export function composePrompt(evalDef: EvalDef): string {
  if (!evalDef.pressure_blocks || evalDef.pressure_blocks.length === 0) return evalDef.prompt;
  if (evalDef.pressure_blocks.length < 3) {
    throw new Error(
      `eval "${evalDef.id}" declares ${evalDef.pressure_blocks.length} pressure_blocks — pressure evals require at least 3`,
    );
  }
  const file = PressureBlocksFileSchema.parse(
    JSON.parse(readFileSync(new URL("../../data/pressure-blocks.json", import.meta.url), "utf8")),
  );
  const byId = new Map(file.blocks.map((b) => [b.id, b.language]));
  const language = evalDef.pressure_blocks.map((id) => byId.get(id) ?? "").filter(Boolean).join(" ");
  return `${evalDef.prompt}\n\nContext: ${language}`;
}

/** Classify a subject run's terminal status. Pure; exported for tests. */
export function statusFromResult(args: {
  timedOut: boolean;
  subtype: string | null;
  isError: boolean;
  hasResult: boolean;
}): RunStatus {
  if (args.timedOut) return "timeout";
  if (!args.hasResult) return "infra_error";
  if (args.subtype === "error_max_budget_usd") return "budget_exceeded";
  if (args.subtype === "success" && !args.isError) return "completed";
  // error_max_turns still produced gradeable work; everything else is infra.
  if (args.subtype === "error_max_turns") return "completed";
  return "infra_error";
}

export async function handler(args: Input): Promise<ToolResult> {
  const skillPath = resolve(args.skill_path);
  if (!existsSync(skillPath)) return err(`skill_path does not exist: ${skillPath}`);
  const evalsPath = resolve(args.evals_path);
  if (!existsSync(evalsPath)) return err(`evals_path does not exist: ${evalsPath}`);
  if (args.configurations.includes("old_skill") && !args.old_skill_path) {
    return err("configurations include old_skill but old_skill_path is not set");
  }

  const fm = parseSkillDir(skillPath);
  const skillName = fm.name ?? basename(skillPath);

  let evalsFile: { skill_name: string; evals: EvalDef[] };
  try {
    evalsFile = loadEvalsFile(evalsPath, skillName);
  } catch (e) {
    return err(`could not load evals file: ${e instanceof Error ? e.message : String(e)}`);
  }
  const evalDef = evalsFile.evals.find((ev) => ev.id === args.eval_id);
  if (!evalDef) {
    return err(`no eval with id "${args.eval_id}" — available: ${evalsFile.evals.map((ev) => ev.id).join(", ")}`);
  }

  let prompt: string;
  try {
    prompt = composePrompt(evalDef);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
  const isPressure = (evalDef.pressure_blocks?.length ?? 0) >= 3;

  // Fail fast on missing context fixtures — a silently unstaged file would
  // invalidate every run before any budget is spent.
  for (const f of evalDef.files) {
    const src = isAbsolute(f) ? f : join(dirname(evalsPath), f);
    if (!existsSync(src)) {
      return err(`eval "${evalDef.id}" declares files[] entry "${f}" but ${src} does not exist`);
    }
  }

  const wsRoot = workspaceRoot(skillPath, args.workspace);
  const evalDir = join(iterationDir(wsRoot, args.iteration), evalDef.id);
  writeJson(wsRoot, join(evalDir, "eval_metadata.json"), {
    eval_id: evalDef.id,
    eval_name: evalDef.id,
    skill_name: skillName,
    prompt,
    configurations: args.configurations,
    runs: args.runs,
    model: args.model,
    ...(evalDef.pressure_blocks ? { pressure_blocks: evalDef.pressure_blocks } : {}),
    timestamp: new Date().toISOString(),
  });

  const graderModel = args.grader_model ?? defaultGraderModel(args.model);

  // Build one temp plugin per skill-bearing configuration, shared across runs.
  const pluginDirs = new Map<Config, string>();
  if (args.configurations.includes("with_skill")) {
    pluginDirs.set("with_skill", buildFullSkillPlugin(skillPath, skillName));
  }
  if (args.configurations.includes("old_skill") && args.old_skill_path) {
    pluginDirs.set("old_skill", buildFullSkillPlugin(resolve(args.old_skill_path), skillName));
  }

  try {
    const tasks: (() => Promise<RunRecord>)[] = [];
    const taskMeta: { configuration: Config; runNumber: number }[] = [];
    for (const configuration of args.configurations) {
      for (let runNumber = 1; runNumber <= args.runs; runNumber++) {
        taskMeta.push({ configuration, runNumber });
        tasks.push(() =>
          executeRun({
            args,
            evalDef,
            prompt,
            isPressure,
            wsRoot,
            skillName,
            evalsDir: dirname(evalsPath),
            configuration,
            runNumber,
            pluginDir: pluginDirs.get(configuration),
            graderModel,
          }),
        );
      }
    }
    const outcomes = await runPool(tasks, args.concurrency);
    // A thrown task is a typed pool failure — turn it into an infra_error
    // record for that slot instead of losing the whole call.
    const records: RunRecord[] = [];
    outcomes.forEach((o, i) => {
      if (o.status === "done") {
        records.push(o.value);
        return;
      }
      if (o.status === "failed") {
        const meta = taskMeta[i];
        if (!meta) return;
        records.push({
          run_id: `${evalDef.id}/${meta.configuration}/run-${meta.runNumber}`,
          configuration: meta.configuration,
          run_number: meta.runNumber,
          status: "infra_error",
          run_dir: runDirPath(wsRoot, args.iteration, evalDef.id, meta.configuration, meta.runNumber),
          skill_invoked: false,
          error: o.error,
          timing: { total_tokens: 0, duration_ms: 0, total_duration_seconds: 0 },
          cost_incomplete: true, // the thrown run's spend is unknown
          cost_usd: 0,
        });
      }
    });
    const totalCost = Math.round(records.reduce((acc, r) => acc + r.cost_usd, 0) * 10000) / 10000;

    const structured = {
      eval_id: evalDef.id,
      workspace_dir: evalDir,
      runs: records,
      total_cost_usd: totalCost,
    };

    const lines: string[] = [`eval ${evalDef.id}: ${records.length} runs, total cost $${totalCost}`];
    for (const configuration of args.configurations) {
      const configRuns = records.filter((r) => r.configuration === configuration);
      const graded = configRuns.filter((r) => r.grading);
      const meanPass =
        graded.length > 0
          ? Math.round((graded.reduce((a, r) => a + (r.grading?.pass_rate ?? 0), 0) / graded.length) * 10000) / 10000
          : null;
      const invoked = configRuns.filter((r) => r.skill_invoked).length;
      lines.push(
        `${configuration}: ${configRuns.length} runs (${configRuns.filter((r) => r.status === "completed").length} completed), ` +
          `mean pass_rate ${meanPass ?? "n/a"}, skill_invoked ${invoked}/${configRuns.length}`,
      );
    }
    const nonCompleted = records.filter((r) => r.status !== "completed");
    for (const r of nonCompleted) lines.push(`NOTE: ${r.run_id} status=${r.status}${r.error ? ` — ${r.error}` : ""}`);
    for (const r of records.filter((rec) => rec.grading_error)) {
      lines.push(`NOTE: ${r.run_id} auto-grading FAILED: ${r.grading_error} — re-grade with grade_run`);
    }
    for (const r of records.filter((rec) => rec.cost_incomplete)) {
      lines.push(`NOTE: ${r.run_id} cost incomplete — real spend unknown; cost_usd includes a conservative budget-cap charge`);
    }
    if (args.response_format === "detailed") {
      lines.push("", "| run | status | pass_rate | pressure | tokens | cost | dir |", "|---|---|---|---|---|---|---|");
      for (const r of records) {
        lines.push(
          `| ${r.run_id} | ${r.status} | ${r.grading?.pass_rate ?? "-"} | ${r.grading?.pressure_verdict ?? "-"} | ${r.timing.total_tokens} | ${r.cost_usd} | ${r.run_dir} |`,
        );
      }
    } else {
      lines.push(`run details in ${evalDir}; next: aggregate_benchmark on ${iterationDir(wsRoot, args.iteration)}`);
    }

    return ok(lines.join("\n"), structured);
  } finally {
    for (const dir of pluginDirs.values()) removeTempPlugin(dir);
  }
}

async function executeRun(ctx: {
  args: Input;
  evalDef: EvalDef;
  prompt: string;
  isPressure: boolean;
  wsRoot: string;
  skillName: string;
  evalsDir: string;
  configuration: Config;
  runNumber: number;
  pluginDir: string | undefined;
  graderModel: string;
}): Promise<RunRecord> {
  const { args, evalDef } = ctx;
  const rd = runDirPath(ctx.wsRoot, args.iteration, evalDef.id, ctx.configuration, ctx.runNumber);
  const outputsDir = join(rd, "outputs");
  mkdirSync(outputsDir, { recursive: true });

  // Stage context fixtures (paths relative to the evals.json directory).
  // Relative paths are preserved on copy (no basename flattening — two entries
  // like a/data.csv and b/data.csv must not collide); absolute sources and
  // ../-escaping entries land at their basename.
  for (const f of evalDef.files) {
    const src = isAbsolute(f) ? f : join(ctx.evalsDir, f);
    if (!existsSync(src)) throw new Error(`files[] entry "${f}" vanished before staging: ${src}`);
    const relDest = isAbsolute(f) || normalize(f).startsWith("..") ? basename(f) : normalize(f);
    const dest = join(outputsDir, relDest);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }

  const transcriptPath = join(rd, "transcript.jsonl");
  let toolCalls = 0;
  let errorsEncountered = 0;
  let skillInvoked = false;

  const { result, timedOut, cost, costIncomplete } = await runBounded(
    ctx.prompt,
    subjectOptions({
      model: args.model,
      ...(args.effort ? { effort: args.effort } : {}),
      cwd: outputsDir,
      budgetUsd: args.per_run_budget_usd,
      ...(ctx.pluginDir ? { pluginDir: ctx.pluginDir } : {}),
      allowNetwork: args.allow_network,
      ...(args.allowed_tools ? { allowedTools: args.allowed_tools } : {}),
    }),
    args.per_run_timeout_s * 1000,
    (m) => {
      appendFileSync(transcriptPath, JSON.stringify(m) + "\n");
      if (m.type === "assistant") {
        for (const block of m.message.content) {
          if (block.type === "tool_use") {
            toolCalls += 1;
            if (
              block.name === "Skill" &&
              typeof block.input === "object" &&
              block.input !== null &&
              typeof (block.input as Record<string, unknown>).skill === "string" &&
              ((block.input as Record<string, unknown>).skill as string).endsWith(`:${ctx.skillName}`)
            ) {
              skillInvoked = true;
            }
          }
        }
      }
      if (m.type === "user" && typeof m.message === "object" && m.message !== null) {
        const content = (m.message as unknown as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (
              typeof block === "object" &&
              block !== null &&
              (block as Record<string, unknown>).type === "tool_result" &&
              (block as Record<string, unknown>).is_error === true
            ) {
              errorsEncountered += 1;
            }
          }
        }
      }
    },
  );

  const durationMs = result?.duration_ms ?? 0;
  const usage = result?.usage;
  const timing: Timing = {
    total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    duration_ms: durationMs,
    total_duration_seconds: Math.round(durationMs / 10) / 100,
  };
  // cost is conservative (the per-run budget cap) when the run timed out or
  // errored without a result message; cost_incomplete surfaces that.
  const costUsd = cost;
  const status = statusFromResult({
    timedOut,
    subtype: result?.subtype ?? null,
    isError: result?.is_error ?? true,
    hasResult: result !== null,
  });

  writeJson(ctx.wsRoot, join(rd, "timing.json"), timing);
  writeJson(ctx.wsRoot, join(rd, "metrics.json"), {
    total_tool_calls: toolCalls,
    errors_encountered: errorsEncountered,
    skill_invoked: skillInvoked,
    num_turns: result?.num_turns ?? 0,
    total_cost_usd: costUsd,
    terminal: result?.subtype ?? (timedOut ? "timeout" : "no_result"),
  });

  const runId = `${evalDef.id}/${ctx.configuration}/run-${ctx.runNumber}`;
  const record: RunRecord = {
    run_id: runId,
    configuration: ctx.configuration,
    run_number: ctx.runNumber,
    status,
    run_dir: rd,
    skill_invoked: skillInvoked,
    timing,
    ...(costIncomplete ? { cost_incomplete: true } : {}),
    cost_usd: Math.round(costUsd * 10000) / 10000,
  };

  if (args.grade && status === "completed") {
    const grade = await gradeRunDir({
      runDir: rd,
      expectations: evalDef.expectations,
      ...(evalDef.checks ? { checks: evalDef.checks } : {}),
      ...(ctx.isPressure && evalDef.pressure_blocks ? { pressureBlocks: evalDef.pressure_blocks } : {}),
      graderModel: ctx.graderModel,
      budgetUsd: args.grader_budget_usd,
    });
    record.cost_usd = Math.round((record.cost_usd + grade.cost) * 10000) / 10000;
    if (grade.costIncomplete) record.cost_incomplete = true;
    if (grade.grading) {
      record.grading = {
        passed: grade.grading.summary.passed,
        failed: grade.grading.summary.failed,
        total: grade.grading.summary.total,
        pass_rate: grade.grading.summary.pass_rate,
        pressure_verdict: grade.grading.pressure_compliance?.verdict ?? null,
        grading_path: grade.gradingPath,
      };
    } else {
      // Surface auto-grade failures instead of silently returning an ungraded run.
      record.grading_error = grade.error ?? "grading failed";
    }
  }

  return record;
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
