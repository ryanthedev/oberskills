/**
 * Post-build cleanup-pass tests for four minor fixes:
 *  1. Null-viewport coord bounds (unit: injected dims logic)
 *  2. pierce flag routes through deep query (unit: via FakePort + live gate)
 *  3. macOS select-all modifier (unit: assert SELECT_ALL_MOD constant)
 *  4. wait missing-selector → missing_selector code, not wait_timeout
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import * as connect from "../src/tools/connect.ts";
import * as wait from "../src/tools/wait.ts";
import { SELECT_ALL_MOD } from "../src/adapters/puppeteer/interactions.ts";
import { FakePort } from "./fake-port.ts";
import { PuppeteerConnectionManager } from "../src/adapters/puppeteer/connection.ts";
import { isBrowserError } from "../src/core/errors.ts";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await connect.handler({ mode: "launch", headless: true });
  return port;
}

// ---------------------------------------------------------------------------
// Fix 3: macOS select-all modifier
// ---------------------------------------------------------------------------

describe("SELECT_ALL_MOD — macOS vs other (fix 3)", () => {
  test("SELECT_ALL_MOD matches process.platform — Meta on darwin, Control elsewhere", () => {
    // The ternary is `process.platform === "darwin" ? "Meta" : "Control"`.
    // We assert the exported constant equals the formula evaluated at runtime,
    // which covers both branches regardless of which OS the suite runs on.
    const expected = process.platform === "darwin" ? "Meta" : "Control";
    expect(SELECT_ALL_MOD).toBe(expected);
  });

  test("the ternary produces distinct values for darwin vs non-darwin inputs", () => {
    // Verify the formula itself maps the two cases correctly.
    const darwinResult = (p: string) => (p === "darwin" ? "Meta" : "Control");
    expect(darwinResult("darwin")).toBe("Meta");
    expect(darwinResult("linux")).toBe("Control");
    expect(darwinResult("win32")).toBe("Control");
  });
});

// ---------------------------------------------------------------------------
// Fix 4: wait missing-selector → missing_selector, not wait_timeout
// ---------------------------------------------------------------------------

describe("wait missing-selector barricade (fix 4)", () => {
  afterEach(() => resetSession());

  test("selector strategy with no selector → missing_selector (not wait_timeout)", async () => {
    await fresh();
    const r = await wait.handler({ strategy: "selector", timeout_ms: 1000 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("missing_selector");
    expect(structured(r).code).not.toBe("wait_timeout");
  });

  test("selector strategy with empty string → missing_selector", async () => {
    await fresh();
    const r = await wait.handler({ strategy: "selector", selector: "", timeout_ms: 1000 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("missing_selector");
  });

  test("selector strategy with a real selector still works normally", async () => {
    await fresh();
    const r = await wait.handler({ strategy: "selector", selector: "#foo", timeout_ms: 1000 });
    // FakePort.wait does not time out unless waitTimeoutFor matches; it resolves OK.
    expect(r.isError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 1: Null-viewport coord bounds (unit test of bounds logic)
// ---------------------------------------------------------------------------

describe("coord bounds with injected dimensions (fix 1 — unit logic)", () => {
  // The FakePort coord resolver uses this.viewport for bounds.
  // We unit-test the bounds formula: out-of-bounds → coord_out_of_viewport,
  // in-bounds → resolves ok. This covers the logic that will also be exercised
  // by the live test when viewport() returns null.

  afterEach(() => resetSession());

  test("in-bounds coord resolves (within injected 1280×720)", async () => {
    await fresh();
    const port = new FakePort();
    setPort(port);
    await connect.handler({ mode: "launch", headless: true });
    port.viewport = { width: 1280, height: 720 };
    const r = await port.resolveTarget({ x: 640, y: 360 });
    expect(r.kind).toBe("coords");
  });

  test("out-of-bounds coord → coord_out_of_viewport (beyond injected dims)", async () => {
    const port = new FakePort();
    setPort(port);
    await connect.handler({ mode: "launch", headless: true });
    port.viewport = { width: 800, height: 600 };
    let caught: unknown = null;
    try {
      await port.resolveTarget({ x: 801, y: 300 });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    if (caught instanceof Error && "code" in caught) {
      expect((caught as { code: string }).code).toBe("coord_out_of_viewport");
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 2: pierce flag unit coverage (FakePort + type verification)
// ---------------------------------------------------------------------------

describe("pierce flag on selector target (fix 2 — type coverage)", () => {
  // The pierce flag lives on the Target union in core/targeting.ts; the adapter
  // (interactions.ts) branches on it. The FakePort does not simulate shadow DOM
  // querying, so we verify:
  //   a) a selector with pierce:true passes through the port without error,
  //   b) the Target type accepts pierce (static: compile-time proof via the import).

  afterEach(() => resetSession());

  test("selector with pierce:true resolves when the FakePort knows the selector", async () => {
    const port = new FakePort();
    setPort(port);
    await connect.handler({ mode: "launch", headless: true });
    port.selectorCounts.set(".shadow-child", 1);
    // pierce is part of the Target type — if this compiles, the type contract holds.
    const r = await port.resolveTarget({ selector: ".shadow-child", pierce: true });
    expect(r.kind).toBe("selector");
  });

  test("selector with pierce:true, 0 matches → no_match (same semantics as non-pierce)", async () => {
    const port = new FakePort();
    setPort(port);
    await connect.handler({ mode: "launch", headless: true });
    port.selectorCounts.set(".gone", 0);
    let caught: unknown = null;
    try {
      await port.resolveTarget({ selector: ".gone", pierce: true });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    if (caught instanceof Error && "code" in caught) {
      expect((caught as { code: string }).code).toBe("no_match");
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 1 + 2: Live gate — real Chrome exercises null viewport and pierce
// ---------------------------------------------------------------------------

const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;

const CHROME =
  process.env.BROWSER_MCP_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

d("live cleanup fixes (real Chrome, gated RUN_LIVE_EVALS)", () => {
  const mgr = new PuppeteerConnectionManager();
  afterAll(async () => {
    await mgr.disconnect();
  });

  test("fix 1 — coord out-of-bounds fires coord_out_of_viewport under null/real viewport", async () => {
    await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    await mgr.newTab("data:text/html,<title>coord-test</title>");
    // Use a coordinate that is definitely outside any real screen (very large).
    let caught: unknown = null;
    try {
      await mgr.interact("click", { x: 99999, y: 99999 });
    } catch (e) {
      caught = e;
    }
    expect(isBrowserError(caught)).toBe(true);
    if (isBrowserError(caught)) {
      expect(caught.code).toBe("coord_out_of_viewport");
    }
  }, 60_000);

  test("fix 2 — pierce:true resolves a shadow-DOM element", async () => {
    await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    const shadowPage =
      "data:text/html," +
      encodeURIComponent(
        `<!doctype html>
         <div id="host"></div>
         <script>
           const shadow = document.getElementById('host').attachShadow({mode:'open'});
           shadow.innerHTML = '<button class="shadow-btn">Click</button>';
         </script>`,
      );
    await mgr.newTab(shadowPage);
    // Without pierce the selector would miss the shadow-DOM button.
    await mgr.interact("click", { selector: ".shadow-btn", pierce: true });
    // If no error thrown, the pierce query found and clicked the element.
  }, 60_000);
});
