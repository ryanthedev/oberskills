/**
 * browser_screencast_stop — stop the screencast and return the video file path.
 * Stop-when-not-running → no_screencast_running (typed err, not a crash).
 *
 * NOTE (P5b): stopScreencast() currently returns screencast_not_supported because
 * video frame assembly is deferred. The lifecycle typed-err (no_screencast_running)
 * still works correctly.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ScreencastStopInputSchema, type ScreencastStopOut } from "../types.ts";

export const name = "browser_screencast_stop";
export const title = "Stop the screencast and return the video file (P5b deferred)";
export const description =
  "Stops the active screencast. Returns no_screencast_running if none was started. " +
  "NOTE: returns screencast_not_supported until P5b implements video frame assembly. " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = ScreencastStopInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const result = await port.stopScreencast();
    const out: ScreencastStopOut = { path: result.path };
    return ok(`screencast stopped → ${result.path}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
