/**
 * browser_drag — driving adapter. Routes BOTH endpoints through the targeting
 * Strategy: port.interact("drag", source, { to }). A stale/unknown source OR drop
 * target surfaces the same stale_ref/unknown_ref path — never a silent miss.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { DragInputSchema, toTarget } from "../types.ts";
import type { Target } from "../core/targeting.ts";

export const name = "browser_drag";
export const title = "Drag from one element to another by ref, selector, or coordinates";
export const description =
  "Drags from a source target to a drop target. Source: ref/selector/x-y. Drop: to_ref/to_selector/to_x-to_y. " +
  "Both endpoints resolve through the same Strategy — a stale or unknown source OR target returns the matching " +
  "structured error, never a silent miss. Never throws.";

export const inputShape = DragInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

function toDropTarget(args: Input): Target | null {
  return toTarget({
    ...(args.to_ref !== undefined ? { ref: args.to_ref } : {}),
    ...(args.to_selector !== undefined ? { selector: args.to_selector } : {}),
    ...(args.to_x !== undefined ? { x: args.to_x } : {}),
    ...(args.to_y !== undefined ? { y: args.to_y } : {}),
  });
}

export async function handler(args: Input): Promise<ToolResult> {
  const source = toTarget(args);
  if (!source) return err("drag requires a source target: ref, selector, or x/y", { code: "no_match" });
  const to = toDropTarget(args);
  if (!to) return err("drag requires a drop target: to_ref, to_selector, or to_x/to_y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.interact("drag", source, { to });
    return ok("dragged");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
