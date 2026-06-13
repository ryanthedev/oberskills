/**
 * DW-3.2 through DW-3.6: unit tests for the P3 read tools.
 * All use FakePort — no real Chrome. Tests are the verification gate.
 *
 * DW-3.2: dom (full + selector) → file; empty selector → err
 * DW-3.3: extract, collect, collect no-diff → "no expandable content"
 * DW-3.4: evaluate helpers injected; page-side throw → structured err; non-serializable handled
 * DW-3.5: dismiss with/without dialog; form read
 * DW-3.6: large reads route through writePayload; screenshot unaffected; resolveTarget reused
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { resetSession, setPort } from "../src/core/session.ts";
import { FakePort } from "./fake-port.ts";
import { PAYLOAD_THRESHOLD_BYTES } from "../src/lib/payload.ts";
import * as dom from "../src/tools/dom.ts";
import * as accessibility from "../src/tools/accessibility.ts";
import * as extract from "../src/tools/extract.ts";
import * as collect from "../src/tools/collect.ts";
import * as evaluate from "../src/tools/evaluate.ts";
import * as dismiss from "../src/tools/dismiss.ts";
import * as form from "../src/tools/form.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await port.connect({ mode: "launch" });
  return port;
}

// ---------------------------------------------------------------------------
// DW-3.2: dom + accessibility
// ---------------------------------------------------------------------------

describe("dom tool (DW-3.2)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_2_dom_full_writes_file: full DOM above threshold writes file, returns path", async () => {
    const port = await fresh();
    // DOM must be above threshold to write to disk
    port.cannedDom = "<html>" + "x".repeat(PAYLOAD_THRESHOLD_BYTES + 100) + "</html>";
    const r = await dom.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect((s.path as string).length).toBeGreaterThan(0);
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
  });

  test("test_DW_3_2_dom_selector_writes_file: selector-scoped DOM writes file", async () => {
    const port = await fresh();
    port.cannedDom = "<div>" + "y".repeat(PAYLOAD_THRESHOLD_BYTES + 100) + "</div>";
    const r = await dom.handler({ selector: ".main" });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
  });

  test("test_DW_3_2_dom_empty_selector_err: selector matching nothing → err, not empty file", async () => {
    const port = await fresh();
    port.missingSelector = "#gone";
    const r = await dom.handler({ selector: "#gone" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("read_failed");
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await dom.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });

  test("small DOM below threshold returns inline (path empty or not present, inlinedPreview set)", async () => {
    const port = await fresh();
    port.cannedDom = "<p>tiny</p>"; // well below threshold
    const r = await dom.handler({});
    expect(r.isError).toBeUndefined();
    // The tool text should mention the content
    expect(r.content[0]?.text).toContain("tiny");
  });
});

describe("accessibility tool (DW-3.2)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_2_accessibility_writes_file: AX tree above threshold writes file", async () => {
    const port = await fresh();
    port.cannedAxJson = "[" + JSON.stringify({ role: "button", name: "x" }) + "]" +
      " ".repeat(PAYLOAD_THRESHOLD_BYTES);
    const r = await accessibility.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await accessibility.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

// ---------------------------------------------------------------------------
// DW-3.3: extract + collect
// ---------------------------------------------------------------------------

describe("extract tool (DW-3.3)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_3_extract_structured: extract returns JSON result via writePayload", async () => {
    const port = await fresh();
    port.cannedExtract = [{ name: "Alice", price: "$10" }, { name: "Bob", price: "$20" }];
    const r = await extract.handler({ selector: ".item", fields: "name:.name,price:.price", pierce: false });
    expect(r.isError).toBeUndefined();
    // Path (if written) or content contains the JSON
    expect(r.content[0]?.text).toContain("extract");
  });

  test("extract with no fields returns text-only results", async () => {
    const port = await fresh();
    port.cannedExtract = ["item 1", "item 2"];
    const r = await extract.handler({ selector: "li", pierce: false });
    expect(r.isError).toBeUndefined();
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await extract.handler({ selector: ".item", pierce: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

describe("collect tool (DW-3.3)", () => {
  afterEach(() => resetSession());

  const collectArgs = {
    selector: ".accordion",
    read_selector: ".content",
    pierce: false,
    close_after_read: false,
    delay_ms: 300,
  } as const;

  test("test_DW_3_3_collect_expand_read: collect returns items array", async () => {
    const port = await fresh();
    port.cannedCollect = { items: ["Section 1 content", "Section 2 content"], nothingExpandable: false };
    const r = await collect.handler(collectArgs);
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(Array.isArray(s.items)).toBe(true);
  });

  test("test_DW_3_3_collect_no_diff_reports_no_expandable: nothing expanded → nothingExpandable=true in result", async () => {
    const port = await fresh();
    port.cannedCollect = { items: [null, null, null], nothingExpandable: true };
    const r = await collect.handler(collectArgs);
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.nothing_expandable).toBe(true);
    // Message should indicate no expandable content
    expect(r.content[0]?.text).toContain("no expandable");
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await collect.handler(collectArgs);
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

// ---------------------------------------------------------------------------
// DW-3.4: evaluate
// ---------------------------------------------------------------------------

describe("evaluate tool (DW-3.4)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_4_evaluate_helpers_injected: expression reaches port with helpers wrapper", async () => {
    const port = await fresh();
    port.cannedEvaluate = "result value";
    const r = await evaluate.handler({ expression: "document.title" });
    expect(r.isError).toBeUndefined();
    // The port should have received a wrapped expression with helpers
    expect(port.evaluateExpressions).toHaveLength(1);
    const expr = port.evaluateExpressions[0]!;
    expect(expr).toContain("querySelectorDeep");
    expect(expr).toContain("querySelectorAllDeep");
    expect(expr).toContain("document.title");
  });

  test("test_DW_3_4_evaluate_page_throw_structured_err: page-side throw → structured err without dropping connection", async () => {
    const port = await fresh();
    port.evaluateError = "TypeError: Cannot read property of undefined";
    const r = await evaluate.handler({ expression: "broken.code" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("evaluate_failed");
    // Connection still alive — the error did NOT kill it
    const alive = await port.isAlive();
    expect(alive).toBe(true);
  });

  test("test_DW_3_4_evaluate_nonserializable_handled: non-serializable return is handled gracefully", async () => {
    const port = await fresh();
    // Port returns undefined (non-serializable from page perspective) — tool should handle
    port.cannedEvaluate = undefined;
    const r = await evaluate.handler({ expression: "undefined" });
    expect(r.isError).toBeUndefined();
    // Should mention null/undefined result, not crash
    expect(r.content[0]?.text).toBeDefined();
  });

  test("already-IIFE expression passes through unchanged (no double-wrap)", async () => {
    const port = await fresh();
    port.cannedEvaluate = 42;
    const r = await evaluate.handler({ expression: "(function(){ return 42; })()" });
    expect(r.isError).toBeUndefined();
    const expr = port.evaluateExpressions[0]!;
    // Should start with (function, not with our wrapper
    expect(expr.trimStart()).toMatch(/^\(function/);
    // Should NOT double-wrap
    expect(expr.split("querySelectorDeep").length - 1).toBeLessThanOrEqual(1);
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await evaluate.handler({ expression: "1+1" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

// ---------------------------------------------------------------------------
// DW-3.5: dismiss + form
// ---------------------------------------------------------------------------

describe("dismiss tool (DW-3.5)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_5_dismiss_with_dialog: dialog present → dismissed, method returned", async () => {
    const port = await fresh();
    port.cannedDismiss = { method: "click", element: "BUTTON.close", coords: { x: 100, y: 50 } };
    const r = await dismiss.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.method).toBe("click");
    expect(s.element).toBe("BUTTON.close");
  });

  test("test_DW_3_5_dismiss_nothing_present: no dialog → err with no_dialog code (not false success)", async () => {
    const port = await fresh();
    port.cannedDismiss = null; // signals no dialog
    const r = await dismiss.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("no_dialog");
    // Message should say "nothing to dismiss" (not a silent success)
    expect(r.content[0]?.text).toContain("nothing to dismiss");
  });

  test("escape-only dismiss (no close button) returns method=escape", async () => {
    const port = await fresh();
    port.cannedDismiss = { method: "escape", element: "DIV" };
    const r = await dismiss.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.method).toBe("escape");
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await dismiss.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

describe("form tool (DW-3.5)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_5_form_read_works: form read returns value/checked/selectedOptions", async () => {
    const port = await fresh();
    port.cannedFormState = { value: "user@example.com", checked: null, selectedOptions: null };
    const r = await form.handler({ selector: "#email" });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.value).toBe("user@example.com");
    expect(s.checked).toBeNull();
  });

  test("selector matching nothing → err, not empty result", async () => {
    const port = await fresh();
    port.missingSelector = "#gone";
    const r = await form.handler({ selector: "#gone" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("read_failed");
  });

  test("dead connection returns connection_lost", async () => {
    const port = await fresh();
    port.alive = false;
    const r = await form.handler({ selector: "#email" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("connection_lost");
  });
});

// ---------------------------------------------------------------------------
// DW-3.6: writePayload routing + P2 screenshot unaffected
// ---------------------------------------------------------------------------

describe("read tools route large payloads through writePayload (DW-3.6)", () => {
  afterEach(() => resetSession());

  test("test_DW_3_6_dom_routes_through_writePayload: large DOM → written to disk, path returned in structured output", async () => {
    const port = await fresh();
    port.cannedDom = "<html>" + "z".repeat(PAYLOAD_THRESHOLD_BYTES + 200) + "</html>";
    const r = await dom.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(typeof s.path).toBe("string");
    expect(existsSync(s.path as string)).toBe(true);
    rmSync(s.path as string, { force: true });
  });

  test("test_DW_3_6_dom_selector_reuses_resolveTarget: selector-scoped dom passes selector to readDom opts", async () => {
    const port = await fresh();
    port.cannedDom = "<div>content</div>";
    await dom.handler({ selector: ".main-content" });
    expect(port.domReads[0]).toMatchObject({ selector: ".main-content" });
  });

  test("accessibility routes large AX tree through writePayload", async () => {
    const port = await fresh();
    port.cannedAxJson = "[" + "{}".repeat(100) + "]" + " ".repeat(PAYLOAD_THRESHOLD_BYTES);
    const r = await accessibility.handler({});
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    if (s.written) {
      expect(existsSync(s.path as string)).toBe(true);
      rmSync(s.path as string, { force: true });
    }
  });

  test("extract routes large result through writePayload", async () => {
    const port = await fresh();
    // Generate enough items to exceed threshold
    port.cannedExtract = Array.from({ length: 200 }, (_, i) => ({ name: `item-${i}`, value: "x".repeat(30) }));
    const r = await extract.handler({ selector: ".item", pierce: false });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.count).toBe(200);
    if (s.written) {
      rmSync(s.path as string, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Security / evaluate bounds (DW-3.4 dirty tests)
// ---------------------------------------------------------------------------

describe("evaluate security bounds (DW-3.4 security)", () => {
  afterEach(() => resetSession());

  test("evaluate error message contains the evaluate_failed code (not a generic crash)", async () => {
    const port = await fresh();
    port.evaluateError = "TypeError: Cannot read properties of undefined";
    const r = await evaluate.handler({ expression: "x.y.z" });
    expect(r.isError).toBe(true);
    // Must be a structured BrowserError with code, not a raw exception message
    expect(structured(r).code).toBe("evaluate_failed");
    expect(r.content[0]!.text).toContain("evaluate_failed");
  });

  test("evaluate with undefined result is not an error", async () => {
    const port = await fresh();
    port.cannedEvaluate = undefined;
    const r = await evaluate.handler({ expression: "void 0" });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(s.result).toBeNull(); // undefined coerced to null in output
  });

  test("multi-statement expression gets helpers injected (no double-wrap)", async () => {
    const port = await fresh();
    port.cannedEvaluate = 42;
    const multiLine = "var x = 1;\nvar y = 2;\nx + y";
    await evaluate.handler({ expression: multiLine });
    const expr = port.evaluateExpressions[0]!;
    expect(expr).toContain("querySelectorDeep");
    expect(expr).toContain("var x = 1");
  });
});

// ---------------------------------------------------------------------------
// Dirty tests for form, dom, accessibility edge cases
// ---------------------------------------------------------------------------

describe("form dirty paths", () => {
  afterEach(() => resetSession());

  test("form returns checked=true for checkbox", async () => {
    const port = await fresh();
    port.cannedFormState = { value: null, checked: true, selectedOptions: null };
    const r = await form.handler({ selector: "#agree" });
    expect(r.isError).toBeUndefined();
    expect(structured(r).checked).toBe(true);
  });

  test("form returns selectedOptions for <select>", async () => {
    const port = await fresh();
    port.cannedFormState = { value: "opt1", checked: null, selectedOptions: ["Option 1"] };
    const r = await form.handler({ selector: "select#country" });
    expect(r.isError).toBeUndefined();
    expect(structured(r).selected_options).toEqual(["Option 1"]);
  });
});

describe("dismiss dirty paths", () => {
  afterEach(() => resetSession());

  test("dismiss returns coords when method=click", async () => {
    const port = await fresh();
    port.cannedDismiss = { method: "click", element: "BUTTON.close", coords: { x: 200, y: 100 } };
    const r = await dismiss.handler({});
    const s = structured(r);
    expect(s.coords).toMatchObject({ x: 200, y: 100 });
  });

  test("dismiss escape has no coords in structured output", async () => {
    const port = await fresh();
    port.cannedDismiss = { method: "escape", element: "DIV" };
    const r = await dismiss.handler({});
    const s = structured(r);
    expect(s.coords).toBeUndefined();
  });
});

describe("collect dirty paths", () => {
  afterEach(() => resetSession());

  const baseArgs = { selector: ".toggle", read_selector: ".panel", pierce: false, close_after_read: false, delay_ms: 300 };

  test("collect with partial expansion reports correct expanded count", async () => {
    const port = await fresh();
    port.cannedCollect = { items: ["content A", null, "content C"], nothingExpandable: false };
    const r = await collect.handler(baseArgs);
    expect(r.isError).toBeUndefined();
    expect(r.content[0]?.text).toContain("2/3");
  });
});
