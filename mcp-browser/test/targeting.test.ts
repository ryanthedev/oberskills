/**
 * Targeting Strategy (DW-2.2/2.3/2.4) — exercised at two levels:
 *  - core/targeting.ts pure helpers (targetKind, decodeModifiers): the single
 *    discriminant + bitmask decode, no adapter needed.
 *  - the resolver Strategy via a FakePort that models ref/selector/coord
 *    resolution + stale/unknown/ambiguous/no-match/out-of-viewport errors.
 */
import { describe, expect, test } from "bun:test";
import { decodeModifiers, Modifier, targetKind, type Target } from "../src/core/targeting.ts";
import { isBrowserError } from "../src/core/errors.ts";
import { FakePort } from "./fake-port.ts";

describe("targetKind — the single Strategy discriminant", () => {
  test("classifies a ref target", () => {
    expect(targetKind({ ref: "r1-1" })).toBe("ref");
  });
  test("classifies a selector target", () => {
    expect(targetKind({ selector: "#go" })).toBe("selector");
  });
  test("classifies a coordinate target", () => {
    expect(targetKind({ x: 10, y: 20 })).toBe("coords");
  });
});

describe("decodeModifiers — press_key bitmask (DW-2.6)", () => {
  test("decodes a single modifier", () => {
    expect(decodeModifiers(Modifier.Shift)).toEqual(["Shift"]);
  });
  test("decodes a combined bitmask", () => {
    expect(decodeModifiers(Modifier.Ctrl | Modifier.Shift)).toEqual(["Ctrl", "Shift"]);
  });
  test("empty mask decodes to no modifiers", () => {
    expect(decodeModifiers(0)).toEqual([]);
  });
});

async function caught(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

describe("resolveTarget Strategy (one interface, three resolvers — DW-2.2)", () => {
  test("resolves a ref target via the ref resolver", async () => {
    const port = new FakePort();
    port.setLiveRefs(["r1-1"]);
    const r = await port.resolveTarget({ ref: "r1-1" });
    expect(r.kind).toBe("ref");
  });

  test("resolves a selector target via the selector resolver", async () => {
    const port = new FakePort();
    port.selectorCounts.set("#go", 1);
    const r = await port.resolveTarget({ selector: "#go" });
    expect(r.kind).toBe("selector");
  });

  test("resolves a coordinate target via the coord resolver", async () => {
    const port = new FakePort();
    const r = await port.resolveTarget({ x: 100, y: 100 });
    expect(r.kind).toBe("coords");
  });

  test("the same resolveTarget signature handles all three (no per-target method)", async () => {
    const port = new FakePort();
    port.setLiveRefs(["r1-1"]);
    port.selectorCounts.set("#go", 1);
    const targets: Target[] = [{ ref: "r1-1" }, { selector: "#go" }, { x: 5, y: 5 }];
    const kinds = [];
    for (const t of targets) kinds.push((await port.resolveTarget(t)).kind);
    expect(kinds).toEqual(["ref", "selector", "coords"]);
  });
});

describe("stale vs unknown ref (DW-2.3)", () => {
  test("a ref invalidated by a page change → stale_ref with a re-snapshot suggestion", async () => {
    const port = new FakePort();
    port.setLiveRefs(["r1-1"]); // issued + live
    port.setLiveRefs([]); // page changed: issued history kept, live set cleared
    const e = await caught(() => port.resolveTarget({ ref: "r1-1" }));
    expect(isBrowserError(e)).toBe(true);
    if (isBrowserError(e)) {
      expect(e.code).toBe("stale_ref");
      expect(e.suggestion).toMatch(/snapshot/i);
    }
  });

  test("a ref never issued → unknown_ref, a code distinct from stale_ref", async () => {
    const port = new FakePort();
    port.setLiveRefs(["r1-1"]);
    const e = await caught(() => port.resolveTarget({ ref: "never-issued" }));
    expect(isBrowserError(e)).toBe(true);
    if (isBrowserError(e)) expect(e.code).toBe("unknown_ref");
  });
});

describe("selector 0 / >1 matches (DW-2.4)", () => {
  test("0 matches → no_match (not act-on-first)", async () => {
    const port = new FakePort();
    port.selectorCounts.set(".missing", 0);
    const e = await caught(() => port.resolveTarget({ selector: ".missing" }));
    expect(isBrowserError(e)).toBe(true);
    if (isBrowserError(e)) expect(e.code).toBe("no_match");
  });

  test(">1 matches without nth → ambiguous_match (not act-on-first)", async () => {
    const port = new FakePort();
    port.selectorCounts.set(".row", 3);
    const e = await caught(() => port.resolveTarget({ selector: ".row" }));
    expect(isBrowserError(e)).toBe(true);
    if (isBrowserError(e)) expect(e.code).toBe("ambiguous_match");
  });

  test(">1 matches WITH nth disambiguates", async () => {
    const port = new FakePort();
    port.selectorCounts.set(".row", 3);
    const r = await port.resolveTarget({ selector: ".row", nth: 1 });
    expect(r.kind).toBe("selector");
  });
});

describe("coordinate bounds", () => {
  test("a point outside the viewport → coord_out_of_viewport", async () => {
    const port = new FakePort();
    const e = await caught(() => port.resolveTarget({ x: 99999, y: 5 }));
    expect(isBrowserError(e)).toBe(true);
    if (isBrowserError(e)) expect(e.code).toBe("coord_out_of_viewport");
  });
});
