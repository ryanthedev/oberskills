/**
 * browser_export_har — snapshot the network capture buffer into a HAR 1.2 file via
 * the injected HarPort. An empty buffer yields a valid-but-empty HAR and the result
 * says so. The adapter maps its buffer → HarEntry[]; the HarPort writes the file
 * (write-then-rename). Only the path returns — entries never enter the result.
 */
import type { z } from "zod";
import { getHarPort, getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ExportHarInputSchema, type HarExportOut } from "../types.ts";

export const name = "browser_export_har";
export const title = "Export captured network traffic as a HAR file";
export const description =
  "Writes the captured network traffic to a HAR 1.2 file and returns { path, entry_count, empty }. An empty " +
  "capture buffer yields a valid-but-empty HAR (empty=true). Read the file path — entries never enter the " +
  "result. Never throws.";

export const inputShape = ExportHarInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const har = getHarPort();
    const res = await port.exportHar(har);
    const out: HarExportOut = { path: res.path, entry_count: res.entryCount, empty: res.empty };
    const note = res.empty ? " (valid-but-empty: no traffic was captured)" : "";
    return ok(`har → ${res.path} (${res.entryCount} entries)${note}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
