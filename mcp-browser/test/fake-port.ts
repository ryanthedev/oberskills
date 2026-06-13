/**
 * In-memory fake BrowserPort for unit tests — no real Chrome. Proves the
 * connect/tabs tools and the barricade hold against the port seam alone.
 */
import { BrowserError } from "../src/core/errors.ts";
import type {
  BrowserPort,
  ConnectionInfo,
  ConnectOptions,
  PageHandle,
  TabInfo,
} from "../src/core/browser-port.ts";

type FakeTab = { tabId: string; url: string; title: string };

export class FakePort implements BrowserPort {
  private connected = false;
  alive = true;
  private tabs: FakeTab[] = [];
  private activeId: string | null = null;
  private seq = 0;
  lastConnect: ConnectOptions | null = null;

  async connect(opts: ConnectOptions): Promise<ConnectionInfo> {
    const reused = this.connected;
    this.lastConnect = opts;
    this.connected = true;
    this.alive = true;
    if (this.tabs.length === 0) {
      const tab = this.makeTab("about:blank");
      this.tabs.push(tab);
      this.activeId = tab.tabId;
    }
    return {
      mode: opts.mode,
      wsEndpoint: opts.wsEndpoint ?? "ws://fake/endpoint",
      reused,
      tabCount: this.tabs.length,
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.tabs = [];
    this.activeId = null;
  }

  async isAlive(): Promise<boolean> {
    return this.connected && this.alive;
  }

  async listTabs(): Promise<TabInfo[]> {
    return this.tabs.map((t) => ({ ...t, active: t.tabId === this.activeId }));
  }

  async newTab(url?: string): Promise<TabInfo> {
    const tab = this.makeTab(url ?? "about:blank");
    this.tabs.push(tab);
    this.activeId = tab.tabId;
    return { ...tab, active: true };
  }

  async selectTab(tabId: string): Promise<TabInfo> {
    const tab = this.tabs.find((t) => t.tabId === tabId);
    if (!tab) {
      throw new BrowserError("unknown_tab", `no tab with id ${tabId}`, "call tabs with action=list to see current ids");
    }
    this.activeId = tabId;
    return { ...tab, active: true };
  }

  async closeTab(tabId: string): Promise<void> {
    const idx = this.tabs.findIndex((t) => t.tabId === tabId);
    if (idx === -1) {
      throw new BrowserError("unknown_tab", `no tab with id ${tabId}`, "call tabs with action=list to see current ids");
    }
    const wasActive = this.activeId === tabId;
    this.tabs.splice(idx, 1);
    if (wasActive) {
      // Active-tab policy: promote the first remaining tab; none left → no active.
      this.activeId = this.tabs[0]?.tabId ?? null;
    }
  }

  activePageHandle(): PageHandle {
    if (this.activeId === null) {
      throw new BrowserError("no_active_tab", "no tab is currently active", "open a tab with tabs action=new");
    }
    return { tabId: this.activeId };
  }

  private makeTab(url: string): FakeTab {
    this.seq += 1;
    return { tabId: `fake-${this.seq}`, url, title: `tab ${this.seq}` };
  }
}
