/**
 * browser_performance_stop_trace — stop the running trace and persist it (step 2).
 * stop with no trace started returns no_trace_running (an err, never an empty
 * result). The trace file is written to /tmp via writePayload inside the adapter;
 * only the path returns — the trace bytes never enter the tool result.
 */
import type { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { PerformanceStopTraceInputSchema, type TraceStopOut } from "../types.ts";

export const name = "browser_performance_stop_trace";
export const title = "Stop the trace and write it to a file";
export const description =
  "Stops the running performance trace and writes it to /tmp, returning { trace_path, bytes } (step 2 of " +
  "start → stop → analyze). The trace bytes never enter the result — read the path. Stop with no trace " +
  "started returns no_trace_running. Never throws.";

export const inputShape = PerformanceStopTraceInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const res = await port.stopTrace();
    const out: TraceStopOut = { trace_path: res.tracePath, bytes: res.bytes };
    return ok(`trace → ${res.tracePath} (${res.bytes} bytes) — analyze with browser_analyze_insight`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
