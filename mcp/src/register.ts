/**
 * MCP server construction: registers the 7 tools on an McpServer and connects
 * the stdio transport. Imported dynamically by server.ts so a missing
 * node_modules (SessionStart install hook hasn't completed yet) produces a
 * clear startup error instead of a cryptic module-resolution stack.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import { log } from "./lib/log.ts";
import { friendlyMessage, type ToolModule, type ToolResult } from "./lib/tool.ts";
import * as validateSkill from "./tools/validate-skill.ts";
import * as testTriggers from "./tools/test-triggers.ts";
import * as optimizeDescription from "./tools/optimize-description.ts";
import * as runEval from "./tools/run-eval.ts";
import * as gradeRun from "./tools/grade-run.ts";
import * as aggregateBenchmark from "./tools/aggregate-benchmark.ts";
import * as compareOutputs from "./tools/compare-outputs.ts";

const INSTRUCTIONS = `Deterministic validation and headless eval harness for Claude Code skills. Backs the
oberskills:skill-craft workflow; usable on any skill directory.

Tools and when to use them:
- validate_skill: lint a skill dir against the agentskills.io spec + house rules; optionally
  package a .skill zip. Run before any testing and before shipping.
- test_triggers: measure whether a skill description triggers on the right queries (and stays
  quiet on near-misses) by spawning real isolated Claude sessions. Run after validate_skill.
- optimize_description: iterative description tuning with a 60/40 train/holdout split, ONE
  iteration per call (action start/continue, state persisted in the workspace); selects best
  by held-out score. Use when test_triggers shows failures.
- run_eval: execute one eval (with_skill vs without_skill, N runs each) in isolated sessions;
  captures transcript/timing/metrics and auto-grades each run. The grader is a separate
  fresh-context model; pass verdicts are computed in code, not by the model under test.
- grade_run: re-grade an existing run directory (after editing assertions).
- aggregate_benchmark: compute mean/stddev/min/max and named-config deltas across graded runs;
  writes benchmark.json + benchmark.md.
- compare_outputs: blind A/B judgment of two output dirs when no ground truth exists.

Conventions: workspaces live at <skill>-workspace/iteration-N/<eval-id>/<config>/run-N/.
Eval runs are isolated (no user settings, no bundled skills, no other MCP servers) and
budget-capped; every result reports total_cost_usd (Agent SDK credit is a hard stop when
exhausted). run_eval and optimize_description calls can take minutes - raise MCP_TOOL_TIMEOUT
if your client enforces a short tool timeout.`;

/**
 * Server version comes from the plugin manifest (single version source of truth):
 * $CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json, with an import.meta-relative
 * fallback for running outside Claude Code (tests, manual bun run).
 */
function readVersion(): string {
  const candidates: (string | URL)[] = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(join(process.env.CLAUDE_PLUGIN_ROOT, ".claude-plugin", "plugin.json"));
  }
  candidates.push(new URL("../../.claude-plugin/plugin.json", import.meta.url));
  for (const candidate of candidates) {
    try {
      const manifest: unknown = JSON.parse(readFileSync(candidate, "utf8"));
      if (typeof manifest === "object" && manifest !== null) {
        const v = (manifest as Record<string, unknown>).version;
        if (typeof v === "string") return v;
      }
    } catch {
      // try next candidate
    }
  }
  return "0.0.0";
}

type RegisteredTool = {
  name: string;
  title: string;
  description: string;
  inputShape: z.ZodRawShape;
  invoke: (args: unknown) => Promise<ToolResult>;
};

/**
 * Compile-time bridge from a typed tool module to the registration list: the
 * module's handler must accept exactly the z.output of its own inputShape, or
 * this call fails to compile. The single `as` below is the runtime trust
 * boundary — the SDK has already validated args against that same inputShape
 * before invoking.
 */
function defineTool<Shape extends z.ZodRawShape>(mod: ToolModule<Shape>): RegisteredTool {
  return {
    name: mod.name,
    title: mod.title,
    description: mod.description,
    inputShape: mod.inputShape,
    invoke: (args: unknown) => mod.handler(args as z.output<z.ZodObject<Shape>>),
  };
}

const TOOLS: RegisteredTool[] = [
  defineTool(validateSkill),
  defineTool(testTriggers),
  defineTool(optimizeDescription),
  defineTool(runEval),
  defineTool(gradeRun),
  defineTool(aggregateBenchmark),
  defineTool(compareOutputs),
];

export async function startServer(): Promise<void> {
  const server = new McpServer(
    { name: "skill-eval", version: readVersion() },
    { instructions: INSTRUCTIONS },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        // 1.29 registerTool accepts a raw zod shape.
        inputSchema: tool.inputShape,
      },
      async (args: unknown) => {
        try {
          return await tool.invoke(args);
        } catch (e) {
          log(`${tool.name} failed:`, friendlyMessage(e));
          return { isError: true, content: [{ type: "text" as const, text: `${tool.name} failed: ${friendlyMessage(e)}` }] };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`skill-eval ${readVersion()} connected (7 tools)`);
}
