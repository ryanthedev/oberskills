/**
 * browser_screencast_start — start a screencast session.
 * Lifecycle: start must come before stop. Double-start → screencast_already_running.
 *
 * NOTE (P5b): Video frame assembly is deferred. This tool arms the lifecycle
 * state machine. The adapter returns screencast_not_supported until P5b.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ScreencastStartInputSchema, type ScreencastStartOut } from "../types.ts";

export const name = "browser_screencast_start";
export const title = "Start a screencast (P5b: lifecycle only, video deferred)";
export const description =
  "Arms the screencast lifecycle. Double-start returns screencast_already_running. " +
  "NOTE: Actual video capture (browser_screencast_stop → file) is deferred to P5b; " +
  "stop will return screencast_not_supported until then. " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = ScreencastStartInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.startScreencast();
    const out: ScreencastStartOut = {
      status: "deferred",
      message: "screencast lifecycle armed; video assembly deferred to P5b",
    };
    return ok("screencast started (video assembly deferred to P5b)", out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
