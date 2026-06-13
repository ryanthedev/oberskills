/**
 * browser_collect — accordion expand-read-close loop.
 * Clicks each element matching selector, reads from readSelector, falls back to
 * body-text diff when nothing matches. Returns nothingExpandable=true when every
 * item yielded null (no new content appeared) — explicit, not false success.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { isBrowserError } from "../core/errors.ts";
import { CollectInputSchema, type CollectOut } from "../types.ts";

export const name = "browser_collect";
export const title = "Expand accordions and collect content (click-read-close loop)";
export const description =
  "Clicks each element matching selector (accordion/expand triggers), reads expanded " +
  "content from read_selector after a delay, optionally closes. Falls back to body-text " +
  "diff when read_selector matches nothing. Returns nothing_expandable=true when no new " +
  "content appeared for any item — not a silent empty success.";

export const inputShape = CollectInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let result: import("../core/browser-port.ts").CollectResult;
    try {
      result = await port.collect({
        selector: args.selector,
        readSelector: args.read_selector,
        pierce: args.pierce,
        closeAfterRead: args.close_after_read,
        delayMs: args.delay_ms,
      });
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    const out: CollectOut = {
      items: result.items,
      nothing_expandable: result.nothingExpandable,
      count: result.items.length,
    };

    if (result.nothingExpandable) {
      return ok(`collect → no expandable content found (${result.items.length} items checked)`, out);
    }
    const expanded = result.items.filter((i) => i !== null).length;
    return ok(`collect → ${expanded}/${result.items.length} items expanded`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
