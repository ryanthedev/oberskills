/**
 * A/B token-bounding measurement (bench-as-test).
 *
 * Confirms — on the REAL merged browser_snapshot handler, not a re-implementation —
 * that spilling a large read to /tmp shrinks the main-context payload, and quantifies
 * by how much. Deterministic: a synthetic a11y tree + the test FakePort, no live Chrome.
 *
 * BEFORE = the pre-merge shape (full tree inlined into structuredContent alongside refs).
 * AFTER  = the actual result the merged handler returns today (path + 512-char preview;
 *          refs and node_count stay inline — they are the interaction surface).
 *
 * Honesty notes this bench makes visible:
 *  - Below PAYLOAD_THRESHOLD_BYTES nothing spills, so there is (correctly) ~no change.
 *  - `refs` stay inline by design, so the win is proportional to how much of the tree
 *    is NON-interactive content (text/structure) rather than ref-bearing nodes.
 *  - The bytes are DEFERRED to /tmp, not deleted — the reduction is only banked if the
 *    spilled file is not then read back into the SAME context (read it in a subagent).
 */
import { describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import * as snapshot from "../src/tools/snapshot.ts";
import * as connect from "../src/tools/connect.ts";
import { FakePort } from "./fake-port.ts";
import { PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";
import type { AxNode } from "../src/core/browser-port.ts";

const CHARS_PER_TOKEN = 3.5; // rough estimate for dense JSON; bytes are the ground truth

/**
 * Build a realistic-ish a11y tree whose serialized JSON is ~targetBytes. ~1 node in 5
 * is interactive (ref-bearing); the rest are non-interactive text/structure — the mix a
 * real page produces, so the measured win reflects refs-stay-inline honestly.
 */
function buildTree(targetBytes: number): AxNode[] {
  const nodes: AxNode[] = [];
  let i = 0;
  while (Buffer.byteLength(JSON.stringify(nodes)) < targetBytes) {
    const interactive = i % 5 === 0;
    nodes.push(
      interactive
        ? { role: "button", name: `Action ${i} — a reasonably descriptive control label`, ref: `e${i}` }
        : { role: "text", name: `Paragraph ${i}: some non-interactive body copy that occupies the tree.` },
    );
    i++;
  }
  return nodes;
}

const serializedBytes = (v: unknown): number => Buffer.byteLength(JSON.stringify(v));

/** The pre-merge result shape: full tree inlined into structuredContent next to refs. */
function beforeResult(tree: AxNode[], refs: string[]) {
  return {
    content: [{ type: "text", text: `snapshot: ${refs.length} interactive node(s)` }],
    structuredContent: { tree, refs },
  };
}

describe("token-bounding A/B (real browser_snapshot handler)", () => {
  test("large reads shrink the main-context payload; small reads are unchanged", async () => {
    const sizes = [2 * 1024, 8 * 1024, 50 * 1024, 200 * 1024];
    const rows: string[] = [];
    const pad = (s: string | number, n: number) => String(s).padStart(n);

    for (const target of sizes) {
      const tree = buildTree(target);
      const refs = tree.filter((n) => n.ref).map((n) => n.ref as string);
      const port = new FakePort();
      port.cannedTree = tree;
      setPort(port);
      await connect.handler({ mode: "launch", headless: true });

      const result = await snapshot.handler({ interesting_only: false });
      const s = (result.structuredContent ?? {}) as { written?: boolean; tree?: unknown; tree_path?: string };

      const before = serializedBytes(beforeResult(tree, refs));
      const after = serializedBytes(result);
      const reduction = (before - after) / before;
      const spilled = s.written === true;

      rows.push(
        `${pad(Math.round(target / 1024) + "KB", 8)}  ${pad(before, 9)}  ${pad(after, 9)}  ${pad(before - after, 9)}  ` +
          `${pad(Math.round(before / CHARS_PER_TOKEN), 9)}  ${pad(Math.round(after / CHARS_PER_TOKEN), 8)}  ` +
          `${pad((reduction * 100).toFixed(1) + "%", 8)}  ${spilled ? "spilled" : "inline"}`,
      );

      if (target < PAYLOAD_THRESHOLD_BYTES) {
        // Below threshold: no spill, tree stays inline — correctly ~no change.
        expect(s.written).toBe(false);
        expect(s.tree).toBeDefined();
      } else {
        // At/above threshold: tree spills, main-context payload is bounded and much smaller.
        expect(s.written).toBe(true);
        expect(s.tree).toBeUndefined();
        expect(typeof s.tree_path).toBe("string");
        expect(after).toBeLessThan(before);
        expect(reduction).toBeGreaterThan(0.8);
      }
      resetSession();
    }

    // Print the measured table (visible in `bun test` output).
    console.log(
      `\ntoken-bounding A/B — threshold ${PAYLOAD_THRESHOLD_BYTES}B, token est. @ ${CHARS_PER_TOKEN} chars/token\n` +
        `payload    before(B)   after(B)    saved(B)  before~tok  after~tok  reduction  mode\n` +
        rows.join("\n") +
        `\n(reduction is banked only if the spilled /tmp file is not read back into the same context)\n`,
    );
  });
});
