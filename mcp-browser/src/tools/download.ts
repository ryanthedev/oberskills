/**
 * browser_download — arm download capture and wait for a file to complete.
 * CDP Browser.setDownloadBehavior redirects the download to /tmp; the tool polls
 * for a completed file within timeout_ms.
 *
 * Throws download_timeout (typed err) when no download fires within the window.
 * This is a named, distinguishable failure — not a silent empty result (RF-11).
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { DownloadInputSchema, type DownloadOut } from "../types.ts";

export const name = "browser_download";
export const title = "Capture a file download and return its path";
export const description =
  "Arms download capture (via CDP setDownloadBehavior) and waits up to timeout_ms for a download " +
  "to complete. Trigger the download action (click a link/button) AFTER calling this tool. " +
  "Returns download_timeout if no file lands within the timeout. " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = DownloadInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const result = await port.captureDownload({ timeoutMs: args.timeout_ms });
    const out: DownloadOut = { path: result.path };
    return ok(`download captured → ${result.path}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
