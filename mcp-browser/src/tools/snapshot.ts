/**
 * browser_snapshot — driving adapter. Returns a compact a11y tree where every
 * interactive node carries a stable `ref` (the primary targeting handle for every
 * interaction tool). Re-snapshot after navigation/DOM change: prior refs go stale.
 *
 * Liveness barricade first; a page mid-navigation surfaces page_unstable as a
 * structured err (never a throw, never a silent empty tree).
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { SnapshotInputSchema } from "../types.ts";

export const name = "browser_snapshot";
export const title = "Capture a compact accessibility snapshot with stable refs";
export const description =
  "Returns a compact accessibility tree of the active page. Every interactive node (button, link, textbox, " +
  "checkbox, combobox, …) carries a stable `ref` id you pass to browser_click/type/hover/select/press_key/drag/" +
  "scroll as the primary target. The returned `refs` list matches the tree. Re-run after navigation or DOM changes " +
  "— refs from a prior snapshot become stale. Returns page_unstable if the document is mid-navigation; never throws.";

export const inputShape = SnapshotInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const snap = await port.snapshot({ interestingOnly: args.interesting_only });
    return ok(`snapshot: ${snap.refs.length} interactive node(s)`, { tree: snap.tree, refs: snap.refs });
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
