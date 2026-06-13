/**
 * browser_select — driving adapter. Routes the raw Target through
 * port.interact("select", target, { values }); the Strategy resolves the target.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { SelectInputSchema, toTarget } from "../types.ts";

export const name = "browser_select";
export const title = "Select option(s) in a <select> by ref, selector, or coordinates";
export const description =
  "Selects one or more option values in a <select> target (ref primary; selector or x/y fallback). Same targeting " +
  "Strategy and error envelope as browser_click. Never throws.";

export const inputShape = SelectInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);
  if (!target) return err("select requires a target: ref, selector, or x/y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.interact("select", target, { values: args.values });
    return ok(`selected ${args.values.length} option(s)`);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
