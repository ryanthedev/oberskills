/**
 * test_triggers — measure skill trigger accuracy with real isolated sessions.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { CostLedger } from "../lib/agent.ts";
import { parseSkillDir } from "../lib/frontmatter.ts";
import { LISTING_TRUNCATION_CHARS, listingChars, type ListingSurface } from "../lib/trigger-probe.ts";
import { generateTriggerQueries, runTriggerSet } from "../lib/trigger-set.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { workspaceRoot, writeJson } from "../lib/workspace.ts";
import { TriggerQuerySetSchema, type TriggerEvalResult, type TriggerQuery } from "../types.ts";

export const name = "test_triggers";
export const title = "Measure skill trigger accuracy";
export const description =
  "Tests whether a skill's description makes Claude invoke it for the right user queries and stay quiet " +
  "for near-miss queries, by spawning isolated headless Claude sessions per query (the candidate skill's " +
  "listing surface — name + description + when_to_use — is wrapped in a temporary plugin; a trigger is a " +
  "typed Skill tool_use, not a regex match). Use after validate_skill passes, and any time the description " +
  "changes. If pass rate is low, follow with optimize_description. Provide a query set, or omit queries to " +
  "have one generated (20 queries: 10 should-trigger with varied/indirect phrasings, 10 near-miss negatives). " +
  "Infrastructure failures are reported separately and never counted as 'did not trigger'. " +
  "Reports when description + when_to_use exceed the 1536-char listing truncation point.";

const QueryShape = z.object({
  query: z.string().describe("Realistic user request - file paths, typos, casual speech welcome."),
  should_trigger: z.boolean(),
});

export const inputShape = {
  skill_path: z.string().describe("Absolute path to the skill directory."),
  description: z
    .string()
    .max(1024)
    .optional()
    .describe("Override description to test instead of the one in SKILL.md (used by optimization loops)."),
  when_to_use: z
    .string()
    .optional()
    .describe("Override when_to_use to test. Defaults to the skill's own when_to_use field."),
  queries: z
    .array(QueryShape)
    .min(1)
    .optional()
    .describe("Trigger eval set. Omit to auto-generate 20 (10 positive / 10 near-miss negative)."),
  queries_path: z.string().optional().describe("Alternative: path to a JSON file with the same array shape."),
  runs_per_query: z.number().int().min(1).max(10).default(3),
  trigger_threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("Fraction of runs that must trigger for a positive query to pass (negatives must stay below it)."),
  model: z
    .string()
    .default("haiku")
    .describe("Model for probe sessions. Trigger realism comes from the claude_code system-prompt preset, which is always applied."),
  concurrency: z.number().int().min(1).max(10).default(5),
  budget_usd: z.number().default(3).describe("Hard total-cost cap; the tool aborts remaining probes when exceeded."),
  response_format: z.enum(["concise", "detailed"]).default("concise"),
};

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const skillPath = resolve(args.skill_path);
  if (!existsSync(skillPath)) return err(`skill_path does not exist: ${skillPath}`);

  const fm = parseSkillDir(skillPath);
  const skillName = fm.name ?? skillPath.split("/").filter(Boolean).pop() ?? "skill";
  const surfaceDescription = args.description ?? fm.description;
  if (!surfaceDescription) return err("skill has no description and none was provided");
  const whenToUse = args.when_to_use ?? fm.when_to_use;

  const surface: ListingSurface = { name: skillName, description: surfaceDescription, whenToUse };
  const ledger = new CostLedger(args.budget_usd);
  const wsRoot = workspaceRoot(skillPath);

  // Resolve query set: inline > file > generated.
  let queries: TriggerQuery[];
  let generatedQueriesPath: string | undefined;
  if (args.queries && args.queries.length > 0) {
    queries = args.queries;
  } else if (args.queries_path) {
    const parsed = TriggerQuerySetSchema.safeParse(JSON.parse(readFileSync(resolve(args.queries_path), "utf8")));
    if (!parsed.success) return err(`queries_path is not a valid query set: ${parsed.error.message}`);
    queries = parsed.data;
  } else {
    const generated = await generateTriggerQueries({
      skillName,
      description: surfaceDescription,
      skillContent: fm.content,
      model: "sonnet",
      ledger,
    });
    if (!generated.queries) return err(`query generation failed: ${generated.error}`);
    queries = generated.queries;
    generatedQueriesPath = writeJson(wsRoot, `${wsRoot}/trigger-queries.json`, queries);
  }

  const set = await runTriggerSet({
    surface,
    queries,
    runsPerQuery: args.runs_per_query,
    triggerThreshold: args.trigger_threshold,
    model: args.model,
    concurrency: args.concurrency,
    ledger,
  });

  const chars = listingChars(surface);
  const result: TriggerEvalResult = {
    skill_name: skillName,
    description: surfaceDescription,
    when_to_use: whenToUse,
    listing_chars: chars,
    listing_truncated: chars > LISTING_TRUNCATION_CHARS,
    results: set.results,
    summary: set.summary,
    total_cost_usd: Math.round(ledger.spent * 10000) / 10000,
    ...(generatedQueriesPath ? { generated_queries_path: generatedQueriesPath } : {}),
  };

  const lines: string[] = [
    `${set.summary.passed}/${set.summary.total} queries passed (${set.summary.failed} failed, ${set.summary.infra_errors} infra errors). cost $${result.total_cost_usd}`,
  ];
  if (result.listing_truncated) {
    lines.push(
      `WARNING: description + when_to_use is ${chars} chars — listing surfaces truncate past ${LISTING_TRUNCATION_CHARS}; trim before trusting these results.`,
    );
  }
  if (set.budget_exhausted) lines.push("NOTE: budget cap hit — remaining probes were skipped.");
  if (generatedQueriesPath) lines.push(`generated query set: ${generatedQueriesPath} (edit and reuse via queries_path)`);
  const failing = set.results.filter((r) => r.pass === false);
  if (args.response_format === "detailed") {
    lines.push("", "| query | should_trigger | rate | runs | infra | pass |", "|---|---|---|---|---|---|");
    for (const r of set.results) {
      lines.push(
        `| ${r.query.slice(0, 80).replace(/\|/g, "\\|")} | ${r.should_trigger} | ${r.trigger_rate} | ${r.runs} | ${r.infra_errors} | ${r.pass} |`,
      );
    }
  } else if (failing.length > 0) {
    lines.push("failing queries:");
    for (const r of failing.slice(0, 10)) {
      lines.push(`- [${r.should_trigger ? "should-trigger" : "near-miss"}] rate=${r.trigger_rate} ${r.query.slice(0, 100)}`);
    }
  }

  return ok(lines.join("\n"), { ...result });
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
