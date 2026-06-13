/**
 * browser_wait_for_text — wait for a text substring to appear or disappear in
 * the page body. Times out with wait_for_text_timeout naming appear vs disappear
 * (not a generic timeout — the message explicitly says which condition failed).
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { WaitForTextInputSchema, type WaitForTextOut } from "../types.ts";

export const name = "browser_wait_for_text";
export const title = "Wait for text to appear or disappear in the page";
export const description =
  "Waits until a text substring appears (default) or disappears in the page body. " +
  "On timeout, returns wait_for_text_timeout naming the condition (appear vs disappear). " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = WaitForTextInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.waitForText({
      text: args.text,
      appear: args.appear,
      timeoutMs: args.timeout_ms,
    });
    const condition = args.appear ? "appear" : "disappear";
    const out: WaitForTextOut = { found: true, condition };
    return ok(`text "${args.text}" did ${condition}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
