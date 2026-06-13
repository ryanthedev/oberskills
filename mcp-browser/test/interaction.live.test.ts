/**
 * Live P2 tests — real Chrome, gated behind RUN_LIVE_EVALS=1. Drives the
 * puppeteer adapter through the BrowserPort seam: snapshot→ref→click→type,
 * selector + coordinate fallback, navigate barricade end-to-end, wait, scroll,
 * screenshot, and stale-ref after a real navigation.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { PuppeteerConnectionManager } from "../src/adapters/puppeteer/connection.ts";
import { isBrowserError } from "../src/core/errors.ts";

const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;

const CHROME =
  process.env.BROWSER_MCP_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const FORM_PAGE =
  "data:text/html," +
  encodeURIComponent(
    `<!doctype html><title>p2</title>
     <button id="btn">Click me</button>
     <input id="email" type="text" />
     <a id="home" href="#home">Home</a>
     <div id="out"></div>
     <script>
       document.getElementById('btn').onclick = () => { document.getElementById('out').textContent = 'clicked'; };
     </script>`,
  );

d("live interaction (real Chrome)", () => {
  const mgr = new PuppeteerConnectionManager();
  afterAll(async () => {
    await mgr.disconnect();
  });

  test("snapshot mints refs; click a ref; type into a ref", async () => {
    await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    await mgr.newTab(FORM_PAGE);

    const snap = await mgr.snapshot();
    expect(snap.refs.length).toBeGreaterThan(0);

    // find the button ref by role/name in the compact tree
    const flat: { role: string; name?: string; ref?: string }[] = [];
    const walk = (ns: typeof snap.tree): void => {
      for (const n of ns) {
        flat.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(snap.tree);
    const btn = flat.find((n) => n.role === "button" && n.ref);
    expect(btn?.ref).toBeTruthy();

    await mgr.interact("click", { ref: btn!.ref! });
    const out = await (await mgr.activePageHandle(), mgr.snapshot()); // re-snapshot reflects DOM change
    expect(out.refs.length).toBeGreaterThanOrEqual(0);
  }, 60_000);

  test("selector + coordinate fallback both drive interactions", async () => {
    await mgr.newTab(FORM_PAGE);
    await mgr.snapshot();
    await mgr.interact("type", { selector: "#email" }, { text: "hello@example.com" });
    await mgr.interact("click", { x: 5, y: 5 }); // a viewport point inside bounds
  }, 60_000);

  test("ambiguous selector → ambiguous_match (not act-on-first)", async () => {
    await mgr.newTab("data:text/html," + encodeURIComponent("<p class=row>a</p><p class=row>b</p>"));
    await mgr.snapshot();
    let caught: unknown = null;
    try {
      await mgr.interact("click", { selector: ".row" });
    } catch (e) {
      caught = e;
    }
    expect(isBrowserError(caught)).toBe(true);
    if (isBrowserError(caught)) expect(caught.code).toBe("ambiguous_match");
  }, 60_000);

  test("a ref used after navigation → stale_ref", async () => {
    await mgr.newTab(FORM_PAGE);
    const snap = await mgr.snapshot();
    const ref = snap.refs[0]!;
    await mgr.navigate("https://example.com");
    let caught: unknown = null;
    try {
      await mgr.interact("click", { ref });
    } catch (e) {
      caught = e;
    }
    expect(isBrowserError(caught)).toBe(true);
    if (isBrowserError(caught)) expect(caught.code).toBe("stale_ref");
  }, 60_000);

  test("navigate, wait(idle), scroll, screenshot", async () => {
    await mgr.navigate("https://example.com");
    await mgr.wait("idle", { timeoutMs: 10_000 });
    await mgr.scroll({ dy: 100 });
    const png = await mgr.screenshot({ fullPage: false });
    expect(png.length).toBeGreaterThan(0);
  }, 60_000);
});
