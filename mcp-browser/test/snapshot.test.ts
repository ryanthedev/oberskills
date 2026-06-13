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
