/**
 * browser_hover — driving adapter. Routes the raw Target through
 * port.interact("hover", target); the Strategy resolves the target.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { HoverInputSchema, toTarget } from "../types.ts";

export const name = "browser_hover";
export const title = "Hover an element by ref, selector, or coordinates";
export const description =
  "Hovers the pointer over a target (ref primary; selector or x/y fallback). Same targeting Strategy and error " +
  "envelope as browser_click. Never throws.";

export const inputShape = HoverInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);
  if (!target) return err("hover requires a target: ref, selector, or x/y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.interact("hover", target);
    return ok("hovered");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
