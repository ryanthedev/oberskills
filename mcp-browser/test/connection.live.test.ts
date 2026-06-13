/**
 * Live tests — real Chrome, gated behind RUN_LIVE_EVALS=1 (mirrors mcp/'s gate).
 * Exercises the puppeteer adapter directly through the BrowserPort seam: launch,
 * tab lifecycle, attach via ws_endpoint, and the connection_lost path after
 * disconnect. Requires Chrome installed at CHROME_PATH (defaults to macOS stable).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { PuppeteerConnectionManager } from "../src/adapters/puppeteer/connection.ts";
import { isBrowserError } from "../src/core/errors.ts";

const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;

const CHROME =
  process.env.BROWSER_MCP_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

d("live connection (real Chrome)", () => {
  const mgr = new PuppeteerConnectionManager();
  afterAll(async () => {
    await mgr.disconnect();
  });

  test("launch-own, list/new/select/close tabs", async () => {
    const info = await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    expect(info.mode).toBe("launch");
    expect(info.reused).toBe(false);

    const initial = await mgr.listTabs();
    expect(initial.length).toBeGreaterThanOrEqual(1);

    const opened = await mgr.newTab("data:text/html,<title>live</title>");
    expect(opened.active).toBe(true);

    const afterOpen = await mgr.listTabs();
    expect(afterOpen.length).toBe(initial.length + 1);

    const firstId = initial[0]!.tabId;
    const selected = await mgr.selectTab(firstId);
    expect(selected.tabId).toBe(firstId);

    await mgr.closeTab(opened.tabId);
    const afterClose = await mgr.listTabs();
    expect(afterClose.length).toBe(initial.length);
  }, 60_000);

  test("launch when already connected reuses, does not spawn a second", async () => {
    const again = await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    expect(again.reused).toBe(true);
  }, 30_000);

  test("attach via ws_endpoint to the running browser", async () => {
    expect(await mgr.isAlive()).toBe(true);
    // Reuse the live browser's endpoint as an attach target via a second manager.
    const attached = new PuppeteerConnectionManager();
    const info = await mgr.connect({ mode: "launch", executablePath: CHROME, headless: true });
    const a = await attached.connect({ mode: "attach", wsEndpoint: info.wsEndpoint });
    expect(a.mode).toBe("attach");
    expect((await attached.listTabs()).length).toBeGreaterThanOrEqual(1);
    await attached.disconnect(); // disconnect() not close() — must not kill the owned browser
    expect(await mgr.isAlive()).toBe(true);
  }, 60_000);

  test("attach to a dead/unreachable url surfaces a BrowserError (never throws raw)", async () => {
    const lonely = new PuppeteerConnectionManager();
    let caught: unknown = null;
    try {
      await lonely.connect({ mode: "attach", browserURL: "http://127.0.0.1:1" });
    } catch (e) {
      caught = e;
    }
    expect(isBrowserError(caught)).toBe(true);
  }, 30_000);

  test("tab op after disconnect reports connection_lost via isAlive=false", async () => {
    const m2 = new PuppeteerConnectionManager();
    await m2.connect({ mode: "launch", executablePath: CHROME, headless: true });
    await m2.disconnect();
    expect(await m2.isAlive()).toBe(false);
  }, 30_000);
});
