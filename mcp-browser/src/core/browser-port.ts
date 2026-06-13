/**
 * BrowserPort — the domain-core seam between the MCP tool layer (driving adapter)
 * and a browser substrate (driven adapter). Phase 1 defines the connection + tab
 * use cases only; P2-6 extend this interface with snapshot/interaction/read/
 * perf/network/storage methods that accept and return PageHandle.
 *
 * INVARIANTS (enforced by the architecture, checked by a static grep):
 *  - Zero third-party imports here. node: builtins + own core types only.
 *  - No puppeteer types ever appear in this file or in src/tools/. The driven
 *    adapter converts puppeteer Browser/Page/Target to these plain DTOs at the
 *    boundary, and hands out opaque PageHandle tokens.
 */

/** How to obtain a browser connection. Cross-field rules are enforced at the tool barricade. */
export type ConnectOptions = {
  mode: "launch" | "attach";
  /** launch: absolute path to a Chrome/Chromium binary. */
  executablePath?: string;
  /** launch: a puppeteer browser channel ("chrome", "chrome-beta", ...) as an alternative to executablePath. */
  channel?: string;
  /** attach: http(s) DevTools discovery URL, e.g. http://127.0.0.1:9222. */
  browserURL?: string;
  /** attach: ws(s) DevTools browser endpoint. */
  wsEndpoint?: string;
  /** launch: run headless (default true). */
  headless?: boolean;
};

/** Result of a successful connect — plain data, no puppeteer handle. */
export type ConnectionInfo = {
  mode: "launch" | "attach";
  /** The browser-level websocket endpoint of the live connection. */
  wsEndpoint: string;
  /** True when connect(launch) reused an already-running managed Chrome instead of spawning. */
  reused: boolean;
  /** Number of open tabs at connect time. */
  tabCount: number;
};

/** A tab/target, identified by an adapter-stable id. */
export type TabInfo = {
  tabId: string;
  url: string;
  title: string;
  active: boolean;
};

/**
 * Opaque token for the active page. The adapter resolves `tabId` to its internal
 * puppeteer Page; core and tools MUST treat this as opaque and never read a
 * puppeteer object off it. (P2+ pass it back into the port, never around it.)
 */
export type PageHandle = {
  readonly tabId: string;
};

export interface BrowserPort {
  connect(opts: ConnectOptions): Promise<ConnectionInfo>;
  disconnect(): Promise<void>;
  isAlive(): Promise<boolean>;
  listTabs(): Promise<TabInfo[]>;
  newTab(url?: string): Promise<TabInfo>;
  selectTab(tabId: string): Promise<TabInfo>;
  closeTab(tabId: string): Promise<void>;
  /** The currently active page handle. Throws BrowserError(no_active_tab) when none is active. */
  activePageHandle(): PageHandle;
}
