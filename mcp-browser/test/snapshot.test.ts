/**
 * snapshot tool (DW-2.1) — every interactive node carries a stable ref and the
 * returned ref list matches the tree; non-interactive nodes carry no ref;
 * page_unstable surfaces as a structured err (not a throw).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import type { AxNode } from "../src/core/browser-port.ts";
import * as snapshot from "../src/tools/snapshot.ts";
import * as connect from "../src/tools/connect.ts";
import { FakePort } from "./fake-port.ts";
import { PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

function refsInTree(nodes: AxNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: AxNode[]): void => {
    for (const n of ns) {
      if (n.ref) out.push(n.ref);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await connect.handler({ mode: "launch", headless: true });
  return port;
}

describe("snapshot tool (fake port)", () => {
  afterEach(() => resetSession());

  test("every interactive node carries a ref; non-interactive nodes do not", async () => {
    await fresh();
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBeUndefined();
    const tree = structured(r).tree as AxNode[];
    const wa = tree[0];
    expect(wa?.role).toBe("WebArea");
    const kids = wa?.children ?? [];
    const interactive = kids.filter((k) => ["button", "textbox", "link"].includes(k.role));
    const staticNode = kids.find((k) => k.role === "text");
    expect(interactive.every((k) => typeof k.ref === "string" && k.ref.length > 0)).toBe(true);
    expect(staticNode?.ref).toBeUndefined();
  });

  test("the returned ref list exactly matches the refs embedded in the tree", async () => {
    await fresh();
    const r = await snapshot.handler({ interesting_only: true });
    const tree = structured(r).tree as AxNode[];
    const refs = structured(r).refs as string[];
    expect([...refs].sort()).toEqual([...refsInTree(tree)].sort());
    expect(refs.length).toBeGreaterThan(0);
  });

  test("a page mid-navigation surfaces page_unstable as a structured err (not a throw)", async () => {
    const port = await fresh();
    port.unstableOnce = true;
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("page_unstable");
  });

  test("a dead connection returns connection_lost (not a throw)", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

// ---------------------------------------------------------------------------
// DW-1.1: snapshot routes the serialized tree through writePayload
// ---------------------------------------------------------------------------

/** Build a canned tree with `count` interactive buttons, each padded to `padLen` in its name. */
function bigTree(count: number, padLen: number): AxNode[] {
  const children: AxNode[] = [];
  for (let i = 0; i < count; i++) {
    children.push({ role: "button", name: `btn-${i}-${"x".repeat(padLen)}`, ref: `r1-${i}` });
  }
  return [{ role: "WebArea", name: "page", children }];
}

/** Build a tree whose serialized JSON is exactly `targetBytes` long (ASCII only, 1 char = 1 byte). */
function treeOfExactBytes(targetBytes: number): AxNode[] {
  let name = "";
  let tree: AxNode[] = [{ role: "text", name }];
  while (Buffer.byteLength(JSON.stringify(tree)) < targetBytes) {
    name += "x";
    tree = [{ role: "text", name }];
  }
  return tree;
}

describe("snapshot tool routes through writePayload (DW-1.1)", () => {
  afterEach(() => resetSession());

  test("test_DW_1_1_large_tree_spills_to_tmp: tree >= threshold returns tree_path + tree_preview, written:true, tree absent", async () => {
    const port = await fresh();
    port.cannedTree = bigTree(300, 40); // comfortably exceeds PAYLOAD_THRESHOLD_BYTES when serialized
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.written).toBe(true);
    expect(typeof s.tree_path).toBe("string");
    expect((s.tree_path as string).length).toBeGreaterThan(0);
    expect(typeof s.tree_preview).toBe("string");
    expect((s.tree_preview as string).length).toBeLessThanOrEqual(512);
    expect(s.tree).toBeUndefined();
    // refs + node_count are ALWAYS inline, even when the tree itself spills.
    expect(Array.isArray(s.refs)).toBe(true);
    expect((s.refs as string[]).length).toBe(300);
    expect(s.node_count).toBeGreaterThan(0);
    expect(typeof s.bytes).toBe("number");
  });

  test("test_DW_1_1_small_tree_inlines: tree below threshold returns tree inline, written:false", async () => {
    await fresh();
    // default canned tree is tiny — well below threshold
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.written).toBe(false);
    expect(s.tree).toBeDefined();
    expect(s.tree_path).toBeUndefined();
    expect(s.tree_preview).toBeUndefined();
    expect(Array.isArray(s.refs)).toBe(true);
    expect((s.refs as string[]).length).toBeGreaterThan(0);
    expect(typeof s.node_count).toBe("number");
  });

  test("test_DW_1_1_exact_threshold_spills: a tree serialized to exactly PAYLOAD_THRESHOLD_BYTES writes to disk (>= threshold writes)", async () => {
    const port = await fresh();
    const tree = treeOfExactBytes(PAYLOAD_THRESHOLD_BYTES);
    expect(Buffer.byteLength(JSON.stringify(tree))).toBe(PAYLOAD_THRESHOLD_BYTES);
    port.cannedTree = tree;
    const r = await snapshot.handler({ interesting_only: true });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.written).toBe(true);
    expect(s.tree).toBeUndefined();
    expect(typeof s.tree_path).toBe("string");
  });

  test("max_depth/max_nodes are threaded from the tool into the port's SnapshotOpts", async () => {
    const port = await fresh();
    await snapshot.handler({ interesting_only: true, max_depth: 3, max_nodes: 10 });
    expect(port.lastSnapshotOpts?.maxDepth).toBe(3);
    expect(port.lastSnapshotOpts?.maxNodes).toBe(10);
  });

  test("max_depth/max_nodes absent from input → absent from SnapshotOpts (unlimited, unchanged default behavior)", async () => {
    const port = await fresh();
    await snapshot.handler({ interesting_only: true });
    expect(port.lastSnapshotOpts?.maxDepth).toBeUndefined();
    expect(port.lastSnapshotOpts?.maxNodes).toBeUndefined();
  });

  test("truncated:true threads through from the port to the tool result", async () => {
    const port = await fresh();
    port.cannedTruncated = true;
    const r = await snapshot.handler({ interesting_only: true });
    expect(structured(r).truncated).toBe(true);
  });

  test("truncated:false by default (unchanged current behavior with no caps)", async () => {
    await fresh();
    const r = await snapshot.handler({ interesting_only: true });
    expect(structured(r).truncated).toBe(false);
  });
});
