/**
 * browser_performance_start_trace — start a performance trace (step 1 of the
 * start → stop → analyze lifecycle). A second start before stop is rejected by
 * the adapter (trace_already_running) — concurrent traces corrupt a measurement.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { PerformanceStartTraceInputSchema } from "../types.ts";

export const name = "browser_performance_start_trace";
export const title = "Start a performance trace";
export const description =
  "Starts a Chrome performance trace (step 1 of start → stop → analyze). Capture Core Web Vitals by " +
  "tracing across a navigation, then stop_trace and analyze_insight. A second start before stop returns " +
  "trace_already_running. Never throws.";

export const inputShape = PerformanceStartTraceInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.startTrace({ screenshots: args.screenshots });
    return ok("performance trace started — navigate, then browser_performance_stop_trace");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
