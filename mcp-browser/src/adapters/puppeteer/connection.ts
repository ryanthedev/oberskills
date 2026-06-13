/**
 * Puppeteer-core driven adapter — the ONLY place puppeteer types live. Implements
 * the core BrowserPort by holding all Browser/Page/Target state internally and
 * converting to the core's plain DTOs (ConnectionInfo/TabInfo) and opaque
 * PageHandle tokens at the boundary. A raw-CDP adapter could replace this file
 * with zero changes to core or tools (the substrate-risk fallback).
 *
 * Adapter-internal policy (hidden behind the 8-method port):
 *  - launch-own reuse: connect(launch) while a managed live browser exists reuses it.
 *  - liveness: isAlive() reflects puppeteer's connection state.
 *  - active-tab: closing the active tab promotes the first remaining page; the
 *    last tab leaving clears active (activePageHandle then throws no_active_tab).
 *  - stable tab ids: derived from each page's target id (CDP-stable within a session).
 *
 * Failures surface as core BrowserError so the tool barricade converts them to
 * structured err() envelopes — never a raw puppeteer stack to the client.
 */
import puppeteer, { type Browser, type ChromeReleaseChannel, type Page } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type {
  BrowserPort,
  ConnectionInfo,
  ConnectOptions,
  PageHandle,
  TabInfo,
} from "../../core/browser-port.ts";

const ENV_EXECUTABLE = process.env.BROWSER_MCP_EXECUTABLE_PATH;
const ENV_CHANNEL = process.env.BROWSER_MCP_CHANNEL;

const CHANNELS: readonly ChromeReleaseChannel[] = ["chrome", "chrome-beta", "chrome-canary", "chrome-dev"];

/** Narrow a free-form channel string to a known ChromeReleaseChannel, else undefined. */
function toChannel(value: string | undefined): ChromeReleaseChannel | undefined {
  return CHANNELS.find((c) => c === value);
}

export class PuppeteerConnectionManager implements BrowserPort {
  private browser: Browser | null = null;
  /** True only when we spawned the browser (so we close it on disconnect). */
  private owned = false;
  private activeTabId: string | null = null;
  /**
   * Adapter-owned stable tab ids. Puppeteer's public Target API exposes no
   * stable id, so we mint our own and key it off the Page object identity. The
   * id stays constant for a page's lifetime within the session; that is exactly
   * the opacity contract PageHandle promises core/tools.
   */
  private readonly idByPage = new WeakMap<Page, string>();
  private idSeq = 0;

  async connect(opts: ConnectOptions): Promise<ConnectionInfo> {
    if (opts.mode === "launch" && this.browser !== null && this.browser.connected) {
      // Reuse the already-running managed Chrome rather than spawning a second.
      const tabs = await this.collectTabs();
      this.ensureActive(tabs);
      return { mode: "launch", wsEndpoint: this.browser.wsEndpoint(), reused: true, tabCount: tabs.length };
    }

    try {
      if (opts.mode === "launch") {
        const executablePath = opts.executablePath ?? ENV_EXECUTABLE;
        const channel = toChannel(opts.channel ?? ENV_CHANNEL);
        this.browser = await puppeteer.launch({
          headless: opts.headless ?? true,
          ...(executablePath ? { executablePath } : {}),
          ...(channel && !executablePath ? { channel } : {}),
          args: ["--no-first-run", "--no-default-browser-check"],
        });
        this.owned = true;
      } else {
        this.browser = await puppeteer.connect({
          ...(opts.browserURL ? { browserURL: opts.browserURL } : {}),
          ...(opts.wsEndpoint ? { browserWSEndpoint: opts.wsEndpoint } : {}),
        });
        this.owned = false;
      }
    } catch (e) {
      const code = opts.mode === "launch" ? "launch_failed" : "attach_failed";
      const suggestion =
        opts.mode === "launch"
          ? "check executable_path/channel points at an installed Chrome"
          : "check the target Chrome is running with --remote-debugging-port and the url/endpoint is reachable";
      throw new BrowserError(code, `${opts.mode} failed: ${e instanceof Error ? e.message : String(e)}`, suggestion);
    }

    const tabs = await this.collectTabs();
    this.ensureActive(tabs);
    return { mode: opts.mode, wsEndpoint: this.browser.wsEndpoint(), reused: false, tabCount: tabs.length };
  }

  async disconnect(): Promise<void> {
    if (this.browser === null) return;
    try {
      if (this.owned) await this.browser.close();
      else await this.browser.disconnect();
    } finally {
      this.browser = null;
      this.owned = false;
      this.activeTabId = null;
    }
  }

  async isAlive(): Promise<boolean> {
    return this.browser !== null && this.browser.connected;
  }

  async listTabs(): Promise<TabInfo[]> {
    const browser = this.requireBrowser();
    const pages = await browser.pages();
    const out: TabInfo[] = [];
    for (const page of pages) {
      const id = this.pageId(page);
      out.push({ tabId: id, url: page.url(), title: await safeTitle(page), active: id === this.activeTabId });
    }
    if (this.activeTabId !== null && !out.some((t) => t.active) && out[0]) {
      // Active page vanished externally — repair bookkeeping.
      this.activeTabId = out[0].tabId;
      out[0].active = true;
    }
    return out;
  }

  async newTab(url?: string): Promise<TabInfo> {
    const browser = this.requireBrowser();
    const page = await browser.newPage();
    if (url) await page.goto(url);
    const id = this.pageId(page);
    this.activeTabId = id;
    return { tabId: id, url: page.url(), title: await safeTitle(page), active: true };
  }

  async selectTab(tabId: string): Promise<TabInfo> {
    const page = await this.findPage(tabId);
    await page.bringToFront();
    this.activeTabId = tabId;
    return { tabId, url: page.url(), title: await safeTitle(page), active: true };
  }

  async closeTab(tabId: string): Promise<void> {
    const page = await this.findPage(tabId);
    const wasActive = this.activeTabId === tabId;
    await page.close();
    if (wasActive) {
      const pages = await this.requireBrowser().pages();
      this.activeTabId = pages[0] ? this.pageId(pages[0]) : null;
    }
  }

  activePageHandle(): PageHandle {
    if (this.activeTabId === null) {
      throw new BrowserError("no_active_tab", "no tab is currently active", "open a tab with browser_tabs action=new");
    }
    return { tabId: this.activeTabId };
  }

  // --- internals -----------------------------------------------------------

  private requireBrowser(): Browser {
    if (this.browser === null || !this.browser.connected) {
      throw new BrowserError(
        "connection_lost",
        "the browser connection is no longer alive",
        "reconnect with browser_connect before retrying",
      );
    }
    return this.browser;
  }

  private pageId(page: Page): string {
    let id = this.idByPage.get(page);
    if (id === undefined) {
      this.idSeq += 1;
      id = `tab-${this.idSeq}`;
      this.idByPage.set(page, id);
    }
    return id;
  }

  private async collectTabs(): Promise<TabInfo[]> {
    return this.listTabs();
  }

  private ensureActive(tabs: TabInfo[]): void {
    if (this.activeTabId !== null && tabs.some((t) => t.tabId === this.activeTabId)) return;
    this.activeTabId = tabs[0]?.tabId ?? null;
  }

  private async findPage(tabId: string): Promise<Page> {
    const browser = this.requireBrowser();
    for (const page of await browser.pages()) {
      if (this.pageId(page) === tabId) return page;
    }
    throw new BrowserError("unknown_tab", `no tab with id ${tabId}`, "call browser_tabs action=list to see current ids");
  }
}

async function safeTitle(page: Page): Promise<string> {
  try {
    return await page.title();
  } catch {
    return "";
  }
}
