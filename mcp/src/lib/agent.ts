/**
 * Agent SDK call layer. ALL Claude inference in this server goes through
 * query() from @anthropic-ai/claude-agent-sdk — it rides subscription OAuth
 * and the Agent SDK credit, works under Bun, and never touches this process's
 * stdout (the child's stdio is piped internally), so the MCP transport is safe.
 *
 * Binary policy: the DEFAULT is the SDK's bundled per-platform `claude` binary
 * (installed by `bun install`, ~222 MB on disk) because it makes eval results
 * reproducible — they do not drift with the user's CLI upgrades.
 * ESCAPE HATCH: set SKILL_EVAL_USE_SYSTEM_CLI=1 in the server's environment to
 * reuse the already-installed Claude Code CLI instead
 * (pathToClaudeCodeExecutable = $CLAUDE_CODE_EXECPATH, falling back to
 * `claude` on PATH). With the hatch active you may `bun install --omit=optional`
 * to skip the platform binary; note eval results then track CLI upgrades.
 *
 * Failure-taxonomy rules encoded here:
 * - Gate on result.is_error, never subtype (subtype stayed "success" on a live
 *   auth failure).
 * - Never branch on apiKeySource (live value "none" is outside its declared union).
 * - Error results yield AND throw: the iterator yields the SDKResultMessage,
 *   then throws. A captured result message is authoritative; the for-await is
 *   wrapped in try/catch.
 * - env replaces, never merges — always spread process.env.
 * - settingSources: [] is ALWAYS passed explicitly (the default loads all user
 *   settings — hooks, memory, and user MCP servers would leak into runs).
 */
import {
  query,
  type Options,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { log } from "./log.ts";

// ---------------------------------------------------------------------------
// Environment hygiene
// ---------------------------------------------------------------------------

/**
 * Child env: process.env minus the Claude session markers. The SDK works either
 * way (verified live), but stripping is belt-and-braces and required if the CLI
 * escape hatch is active. NEVER log or echo this object — it contains
 * CLAUDE_API_KEY on some machines.
 */
export function cleanEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_SESSION_ID;
  return env;
}

function execOverride(): Pick<Options, "pathToClaudeCodeExecutable"> {
  if (process.env.SKILL_EVAL_USE_SYSTEM_CLI === "1") {
    return { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_EXECPATH ?? "claude" };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Cost ledger (per-tool-call budget across many query() calls)
// ---------------------------------------------------------------------------

export class CostLedger {
  spent = 0;
  constructor(readonly budgetUsd: number) {}
  charge(costUsd: number): void {
    this.spent += costUsd;
  }
  get exceeded(): boolean {
    return this.spent >= this.budgetUsd;
  }
}

// ---------------------------------------------------------------------------
// Bounded query execution
// ---------------------------------------------------------------------------

export type BoundedResult = {
  result: SDKResultMessage | null;
  messages: SDKMessage[];
  cost: number;
  timedOut: boolean;
  /** Set when the stream threw without ever producing a result message. */
  streamError: string | null;
  /**
   * True when the run timed out / errored without a result message, so the real
   * spend is unknown. `cost` is then a conservative charge of the call's
   * maxBudgetUsd, never 0.
   */
  costIncomplete: boolean;
};

export async function runBounded(
  prompt: string,
  options: Options,
  timeoutMs: number,
  onMessage?: (m: SDKMessage) => void,
): Promise<BoundedResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const messages: SDKMessage[] = [];
  let result: SDKResultMessage | null = null;
  let streamError: string | null = null;
  try {
    const q = query({
      prompt,
      options: {
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        ...options,
        ...execOverride(),
        abortController: ac,
        env: cleanEnv(),
      },
    });
    for await (const m of q) {
      messages.push(m);
      onMessage?.(m);
      if (m.type === "result") result = m;
    }
  } catch (e) {
    // Yield-then-throw: if a result message was captured it is authoritative.
    if (result === null) {
      streamError = e instanceof Error ? e.message : String(e);
      if (!ac.signal.aborted) log(`query stream threw without a result: ${streamError}`);
    }
  } finally {
    clearTimeout(timer);
  }
  // No result message means the real spend is unknown (timeout / stream error
  // mid-run). Charge the call's budget cap conservatively so ledgers never
  // under-count, and flag it so tool results can surface the uncertainty.
  const costIncomplete = result === null;
  return {
    result,
    messages,
    cost: result === null ? (options.maxBudgetUsd ?? 0) : result.total_cost_usd,
    timedOut: ac.signal.aborted,
    streamError,
    costIncomplete,
  };
}

// ---------------------------------------------------------------------------
// Call-type option builders (the call matrix)
// ---------------------------------------------------------------------------

/** Trigger probe: full claude_code preset for trigger fidelity, Skill tool only. */
export function probeOptions(model: string, pluginDir: string): Options {
  return {
    model,
    maxTurns: 3,
    maxBudgetUsd: 0.1,
    settings: { disableBundledSkills: true },
    tools: ["Skill"],
    allowedTools: ["Skill"],
    plugins: [{ type: "local", path: pluginDir }],
    systemPrompt: { type: "preset", preset: "claude_code", excludeDynamicSections: true },
  };
}

/**
 * Default toolset for eval subject runs — what skill evals legitimately need.
 * bypassPermissions must never ship the full toolset; widening past this is an
 * explicit per-call decision (run_eval allowed_tools). The Skill tool is added
 * automatically when a plugin is mounted (a with_skill run must be able to
 * invoke the skill under test).
 */
export const SUBJECT_DEFAULT_TOOLS: readonly string[] = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];

/**
 * Eval subject run. bypassPermissions is required for unattended runs (no human
 * to approve writes/Bash); the risk is bounded by cwd = a throwaway run dir,
 * a restricted default toolset (SUBJECT_DEFAULT_TOOLS), network tools
 * disallowed by default, and triple bounding (maxTurns + budget +
 * AbortController timeout).
 */
export function subjectOptions(args: {
  model: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  cwd: string;
  budgetUsd: number;
  pluginDir?: string;
  allowNetwork: boolean;
  /** Explicit widening of the restricted default toolset. */
  allowedTools?: string[];
}): Options {
  const tools =
    args.allowedTools && args.allowedTools.length > 0
      ? [...args.allowedTools]
      : [...SUBJECT_DEFAULT_TOOLS, ...(args.pluginDir ? ["Skill"] : [])];
  return {
    model: args.model,
    ...(args.effort ? { effort: args.effort } : {}),
    maxTurns: 50,
    maxBudgetUsd: args.budgetUsd,
    settings: { disableBundledSkills: true },
    systemPrompt: { type: "preset", preset: "claude_code" },
    cwd: args.cwd,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools,
    allowedTools: tools,
    ...(args.pluginDir ? { plugins: [{ type: "local", path: args.pluginDir }] } : {}),
    // WebSearch/WebFetch stay disallowed unless allow_network, even when
    // allowed_tools widened the set.
    ...(args.allowNetwork ? {} : { disallowedTools: ["WebSearch", "WebFetch"] }),
  };
}

/**
 * Single home of the default grading budget (USD per graded run). 0.5 keeps
 * opus/sonnet graders from starving mid-grade; callers may override per call.
 * Used by graderOptions, run_eval auto-grading, and grade_run.
 */
export const GRADER_DEFAULT_BUDGET = 0.5;

/**
 * Grader: minimal system prompt (~35–80x cheaper than the claude_code preset —
 * grading needs no Claude Code fidelity), read-only tools, structured output.
 * maxTurns >= 3 floor because outputFormat consumes a turn.
 */
export function graderOptions(model: string, cwd: string, schema: Record<string, unknown>, maxTurns = 16): Options {
  return {
    model,
    maxTurns,
    maxBudgetUsd: GRADER_DEFAULT_BUDGET,
    tools: ["Read", "Grep", "Glob"],
    allowedTools: ["Read", "Grep", "Glob"],
    cwd,
    outputFormat: { type: "json_schema", schema },
  };
}

/** LLM utility (query generation, description improvement, comparator). */
export function utilityOptions(args: {
  model: string;
  schema: Record<string, unknown>;
  budgetUsd?: number;
  maxTurns?: number;
  cwd?: string;
  readTools?: boolean;
}): Options {
  return {
    model: args.model,
    maxTurns: args.maxTurns ?? 3,
    maxBudgetUsd: args.budgetUsd ?? 0.5,
    tools: args.readTools ? ["Read", "Grep", "Glob"] : [],
    ...(args.readTools ? { allowedTools: ["Read", "Grep", "Glob"] } : {}),
    ...(args.cwd ? { cwd: args.cwd } : {}),
    outputFormat: { type: "json_schema", schema: args.schema },
  };
}

// ---------------------------------------------------------------------------
// Structured-output helper with the one-retry rule
// ---------------------------------------------------------------------------

/**
 * Convert a zod schema to the outputFormat JSON schema. The `$schema` meta key
 * that z.toJSONSchema emits must be stripped: with it present the SDK returns
 * a success result with structured_output silently undefined (verified live).
 */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export type StructuredCallResult<T> = {
  output: T | null;
  cost: number;
  error: string | null;
  /** True when any attempt ended without a result message — `cost` then includes a conservative budget-cap charge. */
  costIncomplete: boolean;
};

/**
 * Run a structured-output call and validate against `schema`. On a success
 * result with undefined structured_output: one retry with maxTurns + 4, then
 * a typed error.
 */
export async function runStructured<T>(
  prompt: string,
  options: Options,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<StructuredCallResult<T>> {
  let totalCost = 0;
  let anyCostIncomplete = false;
  let attemptOptions = options;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { result, timedOut, streamError, cost, costIncomplete } = await runBounded(prompt, attemptOptions, timeoutMs);
    totalCost += cost;
    anyCostIncomplete ||= costIncomplete;
    if (timedOut) return { output: null, cost: totalCost, error: "timeout", costIncomplete: anyCostIncomplete };
    if (!result) {
      return { output: null, cost: totalCost, error: streamError ?? "no result message", costIncomplete: anyCostIncomplete };
    }
    if (result.is_error) {
      return { output: null, cost: totalCost, error: `agent error result (${result.subtype})`, costIncomplete: anyCostIncomplete };
    }
    const structured = result.subtype === "success" ? result.structured_output : undefined;
    if (structured !== undefined) {
      const parsed = schema.safeParse(structured);
      if (parsed.success) return { output: parsed.data, cost: totalCost, error: null, costIncomplete: anyCostIncomplete };
      return {
        output: null,
        cost: totalCost,
        error: `structured output failed validation: ${parsed.error.message}`,
        costIncomplete: anyCostIncomplete,
      };
    }
    // success without structured output — one retry with more turns
    attemptOptions = { ...attemptOptions, maxTurns: (attemptOptions.maxTurns ?? 3) + 4 };
  }
  return { output: null, cost: totalCost, error: "no structured_output after retry", costIncomplete: anyCostIncomplete };
}

/** Grader-model default: one tier below the subject model. */
export function defaultGraderModel(subjectModel: string): string {
  const tierDown: Record<string, string> = {
    fable: "opus",
    opus: "sonnet",
    sonnet: "haiku",
    haiku: "haiku",
  };
  for (const [alias, lower] of Object.entries(tierDown)) {
    if (subjectModel.includes(alias)) return lower;
  }
  return "haiku";
}
