/**
 * browser_analyze_insight — extract a Core Web Vital (LCP/INP/CLS/TTFB/FCP) from
 * the captured trace (step 3). Analyze with no captured trace returns
 * no_trace_running — an err, never an empty/zeroed result reported as success.
 */
import type { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { AnalyzeInsightInputSchema, type InsightOut } from "../types.ts";

export const name = "browser_analyze_insight";
export const title = "Analyze a Core Web Vital from the captured trace";
export const description =
  "Extracts a Core Web Vital from the most recent captured trace: LCP, INP, CLS, TTFB, or FCP (step 3 of " +
  "start → stop → analyze). Analyze with no captured trace returns no_trace_running (not a zeroed result). " +
  "Never throws.";

export const inputShape = AnalyzeInsightInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const res = await port.analyzeInsight(args.metric);
    const out: InsightOut = {
      metric: res.metric,
      ...(res.valueMs !== undefined ? { value_ms: res.valueMs } : {}),
      ...(res.value !== undefined ? { value: res.value } : {}),
      found: res.found,
      detail: res.detail,
    };
    const shown = res.valueMs !== undefined ? `${res.valueMs}ms` : res.value !== undefined ? `${res.value}` : "not found";
    return ok(`${res.metric}: ${shown} — ${res.detail}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
