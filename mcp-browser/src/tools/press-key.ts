/**
 * browser_press_key — driving adapter. Routes the raw Target through
 * port.interact("press_key", target, { key, modifiers }). The modifier bitmask
 * (Alt=1, Ctrl=2, Meta=4, Shift=8) is decoded inside the adapter via
 * decodeModifiers — the tool passes the mask through unchanged.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { PressKeyInputSchema, toTarget } from "../types.ts";

export const name = "browser_press_key";
export const title = "Press a key (with modifiers) on an element by ref, selector, or coordinates";
export const description =
  "Presses a key on a target (ref primary; selector or x/y fallback), with an optional modifier bitmask " +
  "(Alt=1, Ctrl=2, Meta=4, Shift=8 — sum them). Same targeting Strategy and error envelope as browser_click. " +
  "Never throws.";

export const inputShape = PressKeyInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);
  if (!target) return err("press_key requires a target: ref, selector, or x/y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.interact("press_key", target, { key: args.key, modifiers: args.modifiers });
    return ok(`pressed ${args.key}`);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
