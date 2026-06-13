/**
 * browser_click — driving adapter. Hands the RAW Target (ref | selector | coords)
 * to port.interact("click", …); the port's Strategy resolves it. No per-tool
 * ref/selector/coord ladder — the only branch here is "was a target supplied".
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ClickInputSchema, toTarget } from "../types.ts";
import type { InteractOpts } from "../core/targeting.ts";

export const name = "browser_click";
export const title = "Click an element by ref, selector, or coordinates";
export const description =
  "Clicks a target. Primary: pass a `ref` from browser_snapshot. Fallback: a CSS `selector` (with optional nth/" +
  "match_text/visible/pierce) or viewport `x`/`y` coordinates. A stale ref returns stale_ref; an unknown ref " +
  "unknown_ref; a selector matching 0 returns no_match and >1 (without nth) ambiguous_match — never a silent " +
  "act-on-first. Returns connection_lost if the browser died. Never throws.";

export const inputShape = ClickInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const target = toTarget(args);
  if (!target) return err("click requires a target: ref, selector, or x/y", { code: "no_match" });

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  const opts: InteractOpts = {
    ...(args.button ? { button: args.button } : {}),
    ...(args.click_count ? { clickCount: args.click_count } : {}),
  };
  return runPort(async () => {
    await port.interact("click", target, opts);
    return ok("clicked");
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
