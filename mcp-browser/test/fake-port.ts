/**
 * In-memory fake BrowserPort for unit tests — no real Chrome. Proves the
 * connect/tabs tools and the barricade hold against the port seam alone.
 */
import { BrowserError } from "../src/core/errors.ts";
import type {
  AxNode,
  BrowserPort,
  ConnectionInfo,
  ConnectOptions,
  NavResult,
  PageHandle,
  ScrollOpts,
  SnapshotOpts,
  SnapshotResult,
  TabInfo,
  WaitOpts,
  WaitStrategy,
} from "../src/core/browser-port.ts";
import type {
  FillFormField,
  InteractAction,
  InteractOpts,
  ResolvedTarget,
  Target,
} from "../src/core/targeting.ts";
import { targetKind } from "../src/core/targeting.ts";

type FakeTab = { tabId: string; url: string; title: string };

/** One interaction the FakePort recorded — proves tools route raw Targets through interact(). */
export type RecordedInteraction = {
  action: InteractAction;
  target: Target;
  opts?: InteractOpts;
};

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

  // --- Phase 2 -------------------------------------------------------------

  /** Refs minted by the latest snapshot (the "live" set). */
  liveRefs: Set<string> = new Set();
  /** Selector → element count the SelectorResolver should report. */
  selectorCounts: Map<string, number> = new Map();
  /** Layout viewport bounds for the CoordResolver. */
  viewport = { width: 1280, height: 720 };
  /** Recorded interactions (proves tools pass raw Targets through interact). */
  interactions: RecordedInteraction[] = [];
  /** When set, snapshot() throws page_unstable once. */
  unstableOnce = false;
  /** Canned AX tree snapshot() returns (with refs already stamped on interactive nodes). */
  cannedTree: AxNode[] | null = null;
  /** Strategy → wait() should reject with wait_timeout. */
  waitTimeoutFor: WaitStrategy | null = null;
  navigated: string[] = [];
  scrolls: ScrollOpts[] = [];

  async snapshot(_opts?: SnapshotOpts): Promise<SnapshotResult> {
    if (this.unstableOnce) {
      this.unstableOnce = false;
      throw new BrowserError("page_unstable", "document is mid-navigation", "retry browser_snapshot once the page settles");
    }
    const tree = this.cannedTree ?? defaultCannedTree();
    const refs = collectRefs(tree);
    this.liveRefs = new Set(refs);
    return { tree, refs };
  }

  async resolveTarget(t: Target): Promise<ResolvedTarget> {
    const kind = targetKind(t);
    if (kind === "ref") {
      const ref = (t as { ref: string }).ref;
      if (!this.everIssued.has(ref)) {
        throw new BrowserError("unknown_ref", `no such ref: ${ref}`, "run browser_snapshot to see current refs");
      }
      if (!this.liveRefs.has(ref)) {
        throw new BrowserError("stale_ref", `ref ${ref} is from a previous page`, "re-run browser_snapshot to refresh refs");
      }
      return { kind, token: ref };
    }
    if (kind === "selector") {
      const sel = t as { selector: string; nth?: number };
      const count = this.selectorCounts.get(sel.selector) ?? 0;
      if (count === 0) {
        throw new BrowserError("no_match", `selector matched nothing: ${sel.selector}`, "check the selector or run browser_snapshot");
      }
      if (count > 1 && sel.nth === undefined) {
        throw new BrowserError("ambiguous_match", `selector matched ${count} elements: ${sel.selector}`, "add nth to pick one, or use a ref");
      }
      return { kind, token: { selector: sel.selector, nth: sel.nth ?? 0 } };
    }
    const c = t as { x: number; y: number };
    if (c.x < 0 || c.y < 0 || c.x > this.viewport.width || c.y > this.viewport.height) {
      throw new BrowserError("coord_out_of_viewport", `(${c.x},${c.y}) is outside the viewport`, "scroll the target into view or use a ref");
    }
    return { kind, token: { x: c.x, y: c.y } };
  }

  async interact(action: InteractAction, t: Target, opts?: InteractOpts): Promise<void> {
    await this.resolveTarget(t); // honor the Strategy (stale/unknown/ambiguous propagate)
    if (action === "drag" && opts?.to) await this.resolveTarget(opts.to);
    this.interactions.push({ action, target: t, ...(opts ? { opts } : {}) });
  }

  async fillForm(fields: FillFormField[]): Promise<void> {
    for (const f of fields) await this.interact("fill", f.target, { text: f.value });
  }

  async navigate(url: string): Promise<NavResult> {
    this.navigated.push(url);
    return { url, status: 200 };
  }

  async wait(strategy: WaitStrategy, opts?: WaitOpts): Promise<void> {
    if (this.waitTimeoutFor === strategy) {
      const ms = opts?.timeoutMs ?? 0;
      throw new BrowserError("wait_timeout", `${strategy} did not complete within ${ms}ms`, `increase timeout_ms or check the ${strategy} condition`);
    }
  }

  async scroll(opts: ScrollOpts): Promise<void> {
    if (opts.target) await this.resolveTarget(opts.target);
    this.scrolls.push(opts);
  }

  async screenshot(_opts?: { fullPage?: boolean }): Promise<Buffer> {
    return Buffer.from("fake-png");
  }

  /** Every ref ever minted — distinguishes unknown_ref (never seen) from stale_ref (seen, now dead). */
  everIssued: Set<string> = new Set();

  /** Test helper: mark a ref set as the live snapshot (and record them as issued). */
  setLiveRefs(refs: string[]): void {
    this.liveRefs = new Set(refs);
    for (const r of refs) this.everIssued.add(r);
  }
}

const INTERACTIVE_ROLES = new Set(["button", "link", "textbox", "checkbox", "combobox", "menuitem"]);

function defaultCannedTree(): AxNode[] {
  return [
    {
      role: "WebArea",
      name: "page",
      children: [
        { role: "button", name: "Submit", ref: "r1-1" },
        { role: "textbox", name: "Email", ref: "r1-2" },
        { role: "text", name: "static label" }, // non-interactive: no ref
        { role: "link", name: "Home", ref: "r1-3" },
      ],
    },
  ];
}

function collectRefs(nodes: AxNode[]): string[] {
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

export { INTERACTIVE_ROLES };
