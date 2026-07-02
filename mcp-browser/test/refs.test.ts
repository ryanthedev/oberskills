/**
 * Ref-builder (adapter-internal, DW-2.1) — walks an AX tree, stamps a stable ref
 * on each interactive node, registers ref→handle, and bumps the epoch so a new
 * snapshot invalidates the prior set. Pure: a minimal AX-node shape + a fake
 * handle factory stand in for puppeteer (no Chrome, no puppeteer import here —
 * this is a test file, exempt from the boundary grep).
 */
import { describe, expect, test } from "bun:test";
import { RefRegistry, buildSnapshot, isInteractiveRole, type RawAxNode } from "../src/adapters/puppeteer/refs.ts";
import type { AxNode } from "../src/core/browser-port.ts";

/** Each AX node gets a unique fake handle so we can assert registration. */
function fakeNode(role: string, name: string, children: RawAxNode[] = []): RawAxNode {
  const handle = { id: `${role}:${name}` };
  return {
    role,
    name,
    children: children.length ? children : undefined,
    elementHandle: async () => handle as unknown as object,
  };
}

const tree = (): RawAxNode[] => [
  fakeNode("WebArea", "page", [
    fakeNode("button", "Submit"),
    fakeNode("textbox", "Email"),
    fakeNode("text", "label"), // non-interactive
    fakeNode("link", "Home"),
  ]),
];

describe("isInteractiveRole", () => {
  test("button/textbox/link are interactive", () => {
    expect(isInteractiveRole("button")).toBe(true);
    expect(isInteractiveRole("textbox")).toBe(true);
    expect(isInteractiveRole("link")).toBe(true);
  });
  test("WebArea/text are not interactive", () => {
    expect(isInteractiveRole("WebArea")).toBe(false);
    expect(isInteractiveRole("text")).toBe(false);
  });
});

describe("buildSnapshot (DW-2.1)", () => {
  test("stamps a ref on every interactive node and none on others", async () => {
    const reg = new RefRegistry();
    const { tree: out } = await buildSnapshot(tree(), reg);
    const kids = out[0]?.children ?? [];
    const byRole = (role: string) => kids.find((k) => k.role === role);
    expect(byRole("button")?.ref).toBeTruthy();
    expect(byRole("textbox")?.ref).toBeTruthy();
    expect(byRole("link")?.ref).toBeTruthy();
    expect(byRole("text")?.ref).toBeUndefined();
  });

  test("the returned ref list matches the refs embedded in the tree", async () => {
    const reg = new RefRegistry();
    const { tree: out, refs } = await buildSnapshot(tree(), reg);
    const embedded: string[] = [];
    const walk = (ns: { ref?: string; children?: { ref?: string; children?: unknown }[] }[]): void => {
      for (const n of ns) {
        if (n.ref) embedded.push(n.ref);
        if (n.children) walk(n.children as never);
      }
    };
    walk(out);
    expect([...refs].sort()).toEqual([...embedded].sort());
    expect(refs.length).toBe(3);
  });

  test("each ref resolves to its registered handle", async () => {
    const reg = new RefRegistry();
    const { refs } = await buildSnapshot(tree(), reg);
    for (const ref of refs) {
      expect(reg.isLive(ref)).toBe(true);
      expect(reg.get(ref)).not.toBeNull();
    }
  });

  test("a new snapshot bumps the epoch and invalidates prior refs (stale, not unknown)", async () => {
    const reg = new RefRegistry();
    const first = await buildSnapshot(tree(), reg);
    const oldRef = first.refs[0]!;
    expect(reg.isLive(oldRef)).toBe(true);

    await buildSnapshot(tree(), reg); // page changed → re-snapshot
    expect(reg.isLive(oldRef)).toBe(false); // prior epoch → stale
    expect(reg.wasIssued(oldRef)).toBe(true); // but it WAS issued → stale, not unknown
  });

  test("registry classifies never-issued refs as unknown", () => {
    const reg = new RefRegistry();
    expect(reg.wasIssued("r9-9")).toBe(false);
    expect(reg.isLive("r9-9")).toBe(false);
  });

  test("nodeCount/truncated default to the full count / false when no opts are given (regression: unchanged current behavior)", async () => {
    const reg = new RefRegistry();
    const { tree: out, nodeCount, truncated } = await buildSnapshot(tree(), reg);
    expect(truncated).toBe(false);
    // WebArea + 4 children = 5 nodes total.
    expect(nodeCount).toBe(5);
    expect(out.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DW-1.2: max_depth / max_nodes caps on buildSnapshot
// ---------------------------------------------------------------------------

/** A flat list of `count` interactive buttons (each top-level, depth 1) — every node is meaningful. */
function flatInteractiveTree(count: number): RawAxNode[] {
  const nodes: RawAxNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      role: "button",
      name: `btn-${i}`,
      elementHandle: async () => ({ id: `button:${i}` }) as unknown as object,
    });
  }
  return nodes;
}

/** A 3-level-deep tree: WebArea (depth 1) -> group (depth 2) -> button (depth 3). */
function nestedTree(): RawAxNode[] {
  return [
    {
      role: "WebArea",
      name: "page",
      elementHandle: async () => null,
      children: [
        {
          role: "generic",
          name: "group",
          elementHandle: async () => null,
          children: [
            {
              role: "button",
              name: "Deep Submit",
              elementHandle: async () => ({ id: "deep-button" }) as unknown as object,
            },
          ],
        },
      ],
    },
  ];
}

describe("buildSnapshot max_nodes/max_depth caps (DW-1.2)", () => {
  test("test_DW_1_2_max_nodes_clips_and_truncates: max_nodes below the node count clips the tree and sets truncated:true", async () => {
    const reg = new RefRegistry();
    const raw = flatInteractiveTree(5);
    const { tree: out, refs, nodeCount, truncated } = await buildSnapshot(raw, reg, { maxNodes: 3 });
    expect(truncated).toBe(true);
    expect(nodeCount).toBe(3);
    expect(out.length).toBe(3);
    expect(refs.length).toBe(3);
  });

  test("test_DW_1_2_max_nodes_refs_match_emitted_nodes_exactly: refs list matches only the emitted interactive nodes", async () => {
    const reg = new RefRegistry();
    const raw = flatInteractiveTree(5);
    const { tree: out, refs } = await buildSnapshot(raw, reg, { maxNodes: 3 });
    const embedded: string[] = [];
    const walk = (ns: AxNode[]): void => {
      for (const n of ns) {
        if (n.ref) embedded.push(n.ref);
        if (n.children) walk(n.children);
      }
    };
    walk(out);
    expect([...refs].sort()).toEqual([...embedded].sort());
    // The two dropped nodes' refs must NOT be live in the registry — no orphaned
    // refs minted for nodes that never made it into the returned tree.
    expect(reg.isLive("r1-4")).toBe(false);
    expect(reg.isLive("r1-5")).toBe(false);
  });

  test("max_nodes at/above the actual node count does not truncate (regression: unlimited-equivalent)", async () => {
    const reg = new RefRegistry();
    const raw = flatInteractiveTree(3);
    const { truncated, nodeCount } = await buildSnapshot(raw, reg, { maxNodes: 10 });
    expect(truncated).toBe(false);
    expect(nodeCount).toBe(3);
  });

  test("test_DW_1_2_max_depth_stops_descent: max_depth prunes nodes beyond the cutoff depth", async () => {
    const reg = new RefRegistry();
    const raw = nestedTree();
    const { tree: out, refs, truncated } = await buildSnapshot(raw, reg, { maxDepth: 2 });
    expect(truncated).toBe(true);
    // WebArea (depth 1) and group (depth 2) survive; the button (depth 3) is pruned.
    const webArea = out[0]!;
    expect(webArea.role).toBe("WebArea");
    const group = webArea.children?.[0];
    expect(group?.role).toBe("generic");
    expect(group?.children).toBeUndefined(); // deep button pruned, no dangling empty array
    expect(refs.length).toBe(0); // the only interactive node was beyond max_depth
  });

  test("max_depth deep enough to include everything does not truncate (regression: unlimited-equivalent)", async () => {
    const reg = new RefRegistry();
    const raw = nestedTree();
    const { refs, truncated } = await buildSnapshot(raw, reg, { maxDepth: 5 });
    expect(truncated).toBe(false);
    expect(refs.length).toBe(1);
  });
});
