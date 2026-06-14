/**
 * browser_wait — driving adapter. Blocks on navigation / selector / idle. A
 * timeout returns a typed wait_timeout err that NAMES the strategy that timed out
 * (the adapter builds the message); never a silent empty result, never a throw.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { WaitInputSchema } from "../types.ts";

export const name = "browser_wait";
export const title = "Wait for navigation, a selector, or the page to go idle";
export const description =
  "Waits for a condition: strategy=navigation (a navigation to complete), selector (an element to appear — " +
  "requires selector), or idle (the network/page to settle). On timeout returns a typed wait_timeout error naming " +
  "the strategy that timed out. Never throws.";

export const inputShape = WaitInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  if (args.strategy === "selector" && (!args.selector || args.selector.length === 0)) {
    return err("wait strategy=selector requires a non-empty selector", { code: "missing_selector" });
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.wait(args.strategy, {
      ...(args.selector !== undefined ? { selector: args.selector } : {}),
      timeoutMs: args.timeout_ms,
    });
    return ok(`${args.strategy} satisfied`);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
