/**
 * Ref-builder (adapter-internal, DW-2.1) — walks an AX tree, stamps a stable ref
 * on each interactive node, registers ref→handle, and bumps the epoch so a new
 * snapshot invalidates the prior set. Pure: a minimal AX-node shape + a fake
 * handle factory stand in for puppeteer (no Chrome, no puppeteer import here —
 * this is a test file, exempt from the boundary grep).
 */
import { describe, expect, test } from "bun:test";
import { RefRegistry, buildSnapshot, isInteractiveRole, type RawAxNode } from "../src/adapters/puppeteer/refs.ts";

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
});
