/**
 * browser_type — driving adapter. Routes the raw Target through
 * port.interact("type", target, { text }); the Strategy resolves the target.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { TypeInputSchema, toTarget } from "../types.ts";

export const name = "browser_type";
export const title = "Type text into an element by ref, selector, or coordinates";
export const description =
  "Types text into a target (ref primary; selector or x/y fallback). Resolves the target through the same " +
  "Strategy as browser_click — stale_ref/unknown_ref/no_match/ambiguous_match surface as structured errors, " +
  "never a silent act-on-first. Never throws.";

export const inputShape = TypeInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);
  if (!target) return err("type requires a target: ref, selector, or x/y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.interact("type", target, { text: args.text });
    return ok("typed");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
