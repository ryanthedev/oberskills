/**
 * DW-2.2 (routing) + DW-2.3/2.4/2.6 at the tool level — every interaction tool
 * hands the RAW Target to the port (no per-tool ref/selector/coord ladder), and
 * a resolver error (stale/unknown/ambiguous/no_match) surfaces as a structured
 * err(), never a throw.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import * as click from "../src/tools/click.ts";
import * as type_ from "../src/tools/type.ts";
import * as hover from "../src/tools/hover.ts";
import * as select from "../src/tools/select.ts";
import * as pressKey from "../src/tools/press-key.ts";
import * as drag from "../src/tools/drag.ts";
import * as scroll from "../src/tools/scroll.ts";
import * as fillForm from "../src/tools/fill-form.ts";
import { FakePort } from "./fake-port.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(refs: string[] = ["r1-1", "r1-2"]): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await connect.handler({ mode: "launch", headless: true });
  port.setLiveRefs(refs);
  return port;
}

describe("interaction tools route raw Targets through interact (DW-2.2)", () => {
  afterEach(() => resetSession());

  test("click on a ref records action=click with the raw ref target", async () => {
    const port = await fresh();
    const r = await click.handler({ ref: "r1-1" });
    expect(r.isError).toBeUndefined();
    expect(port.interactions).toHaveLength(1);
    expect(port.interactions[0]?.action).toBe("click");
    expect(port.interactions[0]?.target).toEqual({ ref: "r1-1" });
  });

  test("click on a selector passes the selector target untouched", async () => {
    const port = await fresh();
    port.selectorCounts.set("#go", 1);
    const r = await click.handler({ selector: "#go" });
    expect(r.isError).toBeUndefined();
    expect(port.interactions[0]?.target).toEqual({ selector: "#go" });
  });

  test("click on coords passes the coordinate target untouched", async () => {
    const port = await fresh();
    const r = await click.handler({ x: 12, y: 34 });
    expect(r.isError).toBeUndefined();
    expect(port.interactions[0]?.target).toEqual({ x: 12, y: 34 });
  });

  test("type routes action=type with text", async () => {
    const port = await fresh();
    await type_.handler({ ref: "r1-2", text: "hello" });
    expect(port.interactions[0]?.action).toBe("type");
    expect(port.interactions[0]?.opts?.text).toBe("hello");
    expect(port.interactions[0]?.target).toEqual({ ref: "r1-2" });
  });

  test("hover routes action=hover", async () => {
    const port = await fresh();
    await hover.handler({ ref: "r1-1" });
    expect(port.interactions[0]?.action).toBe("hover");
  });

  test("select routes action=select with values", async () => {
    const port = await fresh();
    await select.handler({ ref: "r1-1", values: ["a", "b"] });
    expect(port.interactions[0]?.action).toBe("select");
    expect(port.interactions[0]?.opts?.values).toEqual(["a", "b"]);
  });

  test("scroll with a target routes through resolveTarget", async () => {
    const port = await fresh();
    await scroll.handler({ ref: "r1-1" });
    expect(port.scrolls[0]?.target).toEqual({ ref: "r1-1" });
  });

  test("scroll without a target scrolls the page (deltas, no target)", async () => {
    const port = await fresh();
    await scroll.handler({ dy: 500 });
    expect(port.scrolls[0]?.target).toBeUndefined();
    expect(port.scrolls[0]?.dy).toBe(500);
  });

  test("fill_form routes each field through the port", async () => {
    const port = await fresh(["r1-1", "r1-2"]);
    const r = await fillForm.handler({
      fields: [
        { ref: "r1-1", value: "x" },
        { ref: "r1-2", value: "y" },
      ],
    });
    expect(r.isError).toBeUndefined();
    expect(port.interactions).toHaveLength(2);
    expect(port.interactions.every((i) => i.action === "fill")).toBe(true);
  });
});

describe("press_key modifier bitmask + routing (DW-2.6)", () => {
  afterEach(() => resetSession());

  test("press_key routes action=press_key with key + modifier mask", async () => {
    const port = await fresh();
    await pressKey.handler({ ref: "r1-1", key: "Enter", modifiers: 8 });
    expect(port.interactions[0]?.action).toBe("press_key");
    expect(port.interactions[0]?.opts?.key).toBe("Enter");
    expect(port.interactions[0]?.opts?.modifiers).toBe(8);
  });
});

describe("drag routes both endpoints; stale endpoint → stale_ref (DW-2.6/2.3)", () => {
  afterEach(() => resetSession());

  test("drag routes action=drag with source target and `to`", async () => {
    const port = await fresh(["r1-1", "r1-2"]);
    const r = await drag.handler({ ref: "r1-1", to_ref: "r1-2" });
    expect(r.isError).toBeUndefined();
    expect(port.interactions[0]?.action).toBe("drag");
    expect(port.interactions[0]?.target).toEqual({ ref: "r1-1" });
    expect(port.interactions[0]?.opts?.to).toEqual({ ref: "r1-2" });
  });

  test("drag with a stale target ref → stale_ref err (not a silent miss)", async () => {
    const port = await fresh(["r1-1"]); // r1-2 not live
    port.everIssued.add("r1-2"); // issued previously, now stale
    const r = await drag.handler({ ref: "r1-1", to_ref: "r1-2" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("stale_ref");
  });
});

describe("resolver errors surface as structured err at the tool (DW-2.3/2.4)", () => {
  afterEach(() => resetSession());

  test("click on a stale ref → stale_ref err (not thrown)", async () => {
    const port = await fresh(["r1-1"]);
    port.everIssued.add("gone");
    const r = await click.handler({ ref: "gone" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("stale_ref");
  });

  test("click on an unknown ref → unknown_ref err", async () => {
    await fresh(["r1-1"]);
    const r = await click.handler({ ref: "never" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("unknown_ref");
  });

  test("click on an ambiguous selector → ambiguous_match err", async () => {
    const port = await fresh();
    port.selectorCounts.set(".row", 4);
    const r = await click.handler({ selector: ".row" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("ambiguous_match");
  });

  test("click on a 0-match selector → no_match err", async () => {
    const port = await fresh();
    port.selectorCounts.set(".gone", 0);
    const r = await click.handler({ selector: ".gone" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("no_match");
  });

  test("click with no target at all → validation err (not a throw)", async () => {
    await fresh();
    const r = await click.handler({});
    expect(r.isError).toBe(true);
  });
});
