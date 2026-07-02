/**
 * browser_snapshot — driving adapter. Returns a compact a11y tree where every
 * interactive node carries a stable `ref` (the primary targeting handle for every
 * interaction tool). Re-snapshot after navigation/DOM change: prior refs go stale.
 *
 * Liveness barricade first; a page mid-navigation surfaces page_unstable as a
 * structured err (never a throw, never a silent empty tree).
 *
 * Large trees spill to /tmp via writePayload (the dom.ts idiom): below threshold
 * the parsed tree is inlined; at/above threshold a path + tool-sliced preview
 * are returned instead. `refs` and `node_count` are ALWAYS inline — refs are the
 * interaction surface and must never be withheld.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { writePayload } from "../lib/payload.ts";
import { SnapshotInputSchema, type SnapshotOut } from "../types.ts";

/** Chars of the serialized tree JSON to show in the spilled-branch preview. */
const PREVIEW_CHARS = 512;

export const name = "browser_snapshot";
export const title = "Capture a compact accessibility snapshot with stable refs";
export const description =
  "Returns a compact accessibility tree of the active page. Every interactive node (button, link, textbox, " +
  "checkbox, combobox, …) carries a stable `ref` id you pass to browser_click/type/hover/select/press_key/drag/" +
  "scroll as the primary target. The returned `refs` list matches the tree. Re-run after navigation or DOM changes " +
  "— refs from a prior snapshot become stale. Optional max_depth/max_nodes clip a huge tree (truncated:true); a " +
  "large tree spills to /tmp regardless (tree_path + tree_preview). Returns page_unstable if the document is " +
  "mid-navigation; never throws.";

export const inputShape = SnapshotInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const snap = await port.snapshot({
      interestingOnly: args.interesting_only,
      ...(args.max_depth !== undefined ? { maxDepth: args.max_depth } : {}),
      ...(args.max_nodes !== undefined ? { maxNodes: args.max_nodes } : {}),
    });

    const json = JSON.stringify(snap.tree);
    const written = await writePayload(json, { ext: "json" });

    const out: SnapshotOut = {
      refs: snap.refs,
      node_count: snap.nodeCount,
      bytes: written.bytes,
      written: written.written,
      truncated: snap.truncated,
      ...(written.written
        ? { tree_path: written.path, tree_preview: json.slice(0, PREVIEW_CHARS) }
        : { tree: snap.tree }),
    };

    return ok(`snapshot: ${snap.refs.length} interactive node(s)`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
