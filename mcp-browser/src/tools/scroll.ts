/**
 * browser_scroll — driving adapter. With a target (ref/selector/coords) it scrolls
 * that element into view (resolved through the Strategy); without one it scrolls
 * the page by dx/dy. A target error surfaces the matching structured error.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ScrollInputSchema, toTarget } from "../types.ts";
import type { ScrollOpts } from "../core/browser-port.ts";

export const name = "browser_scroll";
export const title = "Scroll the page, or scroll an element into view";
export const description =
  "Scrolls the page by dx/dy, or — when given a target (ref primary; selector or x/y fallback) — scrolls that " +
  "element into view through the same targeting Strategy as browser_click. A stale/unknown/ambiguous target " +
  "surfaces its structured error. Never throws.";

export const inputShape = ScrollInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  const opts: ScrollOpts = {
    ...(target ? { target } : {}),
    ...(args.dx !== undefined ? { dx: args.dx } : {}),
    ...(args.dy !== undefined ? { dy: args.dy } : {}),
  };
  return runPort(async () => {
    await port.scroll(opts);
    return ok(target ? "scrolled to target" : "scrolled page");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
