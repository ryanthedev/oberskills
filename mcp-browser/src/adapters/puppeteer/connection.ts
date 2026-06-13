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
import puppeteer, {
  type Browser,
  type ChromeReleaseChannel,
  type Page,
  type PuppeteerLifeCycleEvent,
} from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type {
  BrowserPort,
  CollectOpts,
  CollectResult,
  ConnectionInfo,
  ConnectOptions,
  DismissResult,
  EmulateConditionsOpts,
  ExtractOpts,
  FormFieldState,
  HarExportResult,
  InsightMetric,
  InsightResult,
  LighthouseOpts,
  LighthouseResult,
  NavResult,
  NetworkProfile,
  PageHandle,
  ReadDomOpts,
  RouteRule,
  ScrollOpts,
  SnapshotOpts,
  SnapshotResult,
  TabInfo,
  TraceOpts,
  TraceStopResult,
  WaitOpts,
  WaitStrategy,
} from "../../core/browser-port.ts";
import type { HarPort } from "../../core/har-port.ts";
import { writePayload } from "../../lib/payload.ts";
import { TraceController } from "./tracing.ts";
import { NetworkController } from "./network.ts";
import { runLighthouse } from "./lighthouse.ts";
import {
  FIND_DIALOG_JS,
  QUERY_SELECTOR_ALL_DEEP_JS,
  QUERY_SELECTOR_DEEP_JS,
  QUERY_SELECTOR_SCOPED_JS,
  TEXT_CONTENT_DEEP_JS,
} from "./dom-helpers.ts";
import type {
  FillFormField,
  InteractAction,
  InteractOpts,
  ResolvedTarget,
  Target,
} from "../../core/targeting.ts";
import { buildSnapshot, RefRegistry, type RawAxNode } from "./refs.ts";
import { executeAction, resolveOnPage } from "./interactions.ts";

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
    // P4 teardown: disarm interception + listeners so nothing leaks into a later
    // session (DW-4.4). Best-effort — the page may already be gone.
    try {
      if (this.network) await this.network.disable();
    } catch {
      // page/connection gone — state is reset below regardless.
    }
    this.network = null;
    this.networkPage = null;
    this.trace = null;
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

  // --- Phase 2: snapshot / interaction / navigation ------------------------

  /** ref → ElementHandle registry, invalidated (epoch-bumped) on each snapshot. */
  private readonly refs = new RefRegistry();

  async snapshot(opts?: SnapshotOpts): Promise<SnapshotResult> {
    const page = await this.activePage();
    // A page mid-navigation has no stable document — surface page_unstable rather
    // than snapshotting a tearing tree.
    let raw: RawAxNode | null;
    try {
      raw = (await page.accessibility.snapshot({
        interestingOnly: opts?.interestingOnly ?? true,
      })) as RawAxNode | null;
    } catch (e) {
      throw new BrowserError("page_unstable", `snapshot failed: ${e instanceof Error ? e.message : String(e)}`, "retry browser_snapshot once the page settles");
    }
    if (raw === null) {
      throw new BrowserError("page_unstable", "no accessibility tree (document is empty or mid-navigation)", "navigate to a page, or retry once it settles");
    }
    return buildSnapshot([raw], this.refs);
  }

  async resolveTarget(t: Target): Promise<ResolvedTarget> {
    const page = await this.activePage();
    const resolved = await resolveOnPage(page, this.refs, t);
    // Hand back an OPAQUE token — core/tools never read the handle off it.
    return { kind: resolved.kind, token: resolved };
  }

  async interact(action: InteractAction, t: Target, opts?: InteractOpts): Promise<void> {
    const page = await this.activePage();
    const resolved = await resolveOnPage(page, this.refs, t);
    await executeAction(page, this.refs, action, resolved, opts);
  }

  async fillForm(fields: FillFormField[]): Promise<void> {
    const page = await this.activePage();
    for (const f of fields) {
      const resolved = await resolveOnPage(page, this.refs, f.target);
      await executeAction(page, this.refs, "fill", resolved, { text: f.value });
    }
  }

  async navigate(url: string): Promise<NavResult> {
    const page = await this.activePage();
    try {
      const resp = await page.goto(url, { waitUntil: "load" });
      const status = resp?.status();
      return { url: page.url(), ...(status !== undefined ? { status } : {}) };
    } catch (e) {
      throw new BrowserError("nav_failed", `navigation to ${url} failed: ${e instanceof Error ? e.message : String(e)}`, "check the URL is reachable and the page loads");
    }
  }

  async wait(strategy: WaitStrategy, opts?: WaitOpts): Promise<void> {
    const page = await this.activePage();
    const timeout = opts?.timeoutMs ?? 30000;
    try {
      if (strategy === "navigation") {
        await page.waitForNavigation({ timeout, waitUntil: "load" });
      } else if (strategy === "selector") {
        if (!opts?.selector) {
          throw new BrowserError("wait_timeout", "selector strategy requires a selector", "pass selector for strategy=selector");
        }
        await page.waitForSelector(opts.selector, { timeout });
      } else {
        const idle: PuppeteerLifeCycleEvent = "networkidle0";
        await page.waitForNavigation({ timeout, waitUntil: idle }).catch(async () => {
          // No navigation in flight — fall back to a network-idle poll on the live page.
          await page.waitForNetworkIdle({ timeout });
        });
      }
    } catch (e) {
      if (e instanceof BrowserError) throw e;
      throw new BrowserError("wait_timeout", `${strategy} did not complete within ${timeout}ms`, `increase timeout_ms or check the ${strategy} condition`);
    }
  }

  async scroll(opts: ScrollOpts): Promise<void> {
    const page = await this.activePage();
    if (opts.target) {
      const resolved = await resolveOnPage(page, this.refs, opts.target);
      if (resolved.kind === "coords") {
        await page.mouse.move(resolved.x, resolved.y);
        return;
      }
      await resolved.handle.scrollIntoView();
      return;
    }
    const dx = opts.dx ?? 0;
    const dy = opts.dy ?? 0;
    await page.evaluate(
      (x: number, y: number) => {
        (globalThis as { scrollBy?: (x: number, y: number) => void }).scrollBy?.(x, y);
      },
      dx,
      dy,
    );
  }

  async screenshot(opts?: { fullPage?: boolean }): Promise<Buffer> {
    const page = await this.activePage();
    const data = await page.screenshot({ fullPage: opts?.fullPage ?? false, type: "png" });
    return Buffer.from(data);
  }

  // --- Phase 3: read / extract --------------------------------------------

  async readDom(opts?: ReadDomOpts): Promise<string> {
    const page = await this.activePage();
    if (opts?.selector) {
      const el = await page.$(opts.selector);
      if (!el) {
        throw new BrowserError(
          "read_failed",
          `selector matched nothing: ${opts.selector}`,
          "check the selector or run browser_snapshot to verify the element exists",
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return page.evaluate((node) => (node as any).outerHTML as string, el);
    }
    return page.content();
  }

  async readAccessibility(): Promise<string> {
    const page = await this.activePage();
    try {
      const tree = await page.accessibility.snapshot({ interestingOnly: false });
      return JSON.stringify(tree, null, 2);
    } catch (e) {
      throw new BrowserError(
        "read_failed",
        `accessibility snapshot failed: ${e instanceof Error ? e.message : String(e)}`,
        "retry once the page settles",
      );
    }
  }

  async extract(opts: ExtractOpts): Promise<unknown[]> {
    const page = await this.activePage();

    const queryFn = opts.pierce
      ? `${QUERY_SELECTOR_ALL_DEEP_JS}(${JSON.stringify(opts.selector)})`
      : `Array.from(document.querySelectorAll(${JSON.stringify(opts.selector)}))`;

    if (opts.fields && opts.fields.length > 0) {
      const fieldEntries = opts.fields
        .map((f) => `{ name: ${JSON.stringify(f.name)}, selector: ${JSON.stringify(f.selector)} }`)
        .join(", ");
      const pierceFlag = opts.pierce ? "true" : "false";
      const extractBody = `(function() {
        ${TEXT_CONTENT_DEEP_JS}
        ${QUERY_SELECTOR_SCOPED_JS}
        var containers = ${queryFn};
        if (containers.length === 0) return null;
        var fieldDefs = [${fieldEntries}];
        var usePierce = ${pierceFlag};
        var results = [];
        for (var i = 0; i < containers.length; i++) {
          var row = {};
          for (var j = 0; j < fieldDefs.length; j++) {
            var child = containers[i].querySelector(fieldDefs[j].selector);
            if (!child && usePierce) {
              child = querySelectorScoped(containers[i], fieldDefs[j].selector);
            }
            row[fieldDefs[j].name] = child ? deepText(child) : null;
          }
          results.push(row);
        }
        return results;
      })()`;
      const result = await page.evaluate(extractBody);
      if (result === null) {
        throw new BrowserError(
          "read_failed",
          `selector matched nothing: ${opts.selector}`,
          "check the selector",
        );
      }
      return result as unknown[];
    } else {
      const extractBody = `(function() {
        ${TEXT_CONTENT_DEEP_JS}
        var containers = ${queryFn};
        if (containers.length === 0) return null;
        var results = [];
        for (var i = 0; i < containers.length; i++) {
          results.push(deepText(containers[i]));
        }
        return results;
      })()`;
      const result = await page.evaluate(extractBody);
      if (result === null) {
        throw new BrowserError(
          "read_failed",
          `selector matched nothing: ${opts.selector}`,
          "check the selector",
        );
      }
      return result as unknown[];
    }
  }

  async collect(opts: CollectOpts): Promise<CollectResult> {
    const page = await this.activePage();
    const delay = opts.delayMs ?? 300;
    const collectExpr = opts.pierce
      ? `${QUERY_SELECTOR_ALL_DEEP_JS}(${JSON.stringify(opts.selector)})`
      : `Array.from(document.querySelectorAll(${JSON.stringify(opts.selector)}))`;

    // Collect center coordinates for all toggle elements
    const filterFn = `(function() {
      var elements = ${collectExpr};
      var coords = [];
      for (var i = 0; i < elements.length; i++) {
        var rect = elements[i].getBoundingClientRect();
        coords.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      }
      return coords;
    })()`;
    const coords = (await page.evaluate(filterFn)) as { x: number; y: number }[];

    if (coords.length === 0) {
      return { items: [], nothingExpandable: true };
    }

    const readExprTemplate = opts.pierce
      ? `(function() {
          ${TEXT_CONTENT_DEEP_JS}
          var el = ${QUERY_SELECTOR_DEEP_JS}(${JSON.stringify(opts.readSelector)});
          return el ? deepText(el) : null;
        })()`
      : `(function() {
          ${TEXT_CONTENT_DEEP_JS}
          var el = document.querySelector(${JSON.stringify(opts.readSelector)});
          return el ? deepText(el) : null;
        })()`;

    const items: (string | null)[] = [];
    for (const coord of coords) {
      // Capture body text before click for diff fallback
      const beforeText = (await page.evaluate("document.body.innerText")) as string;

      // Click the toggle
      await page.mouse.click(coord.x, coord.y);
      await new Promise<void>((r) => setTimeout(r, delay));

      // Read from readSelector
      let text = (await page.evaluate(readExprTemplate)) as string | null;

      // Diff fallback: readSelector matched nothing → compare body text
      if (text === null || (typeof text === "string" && text.trim() === "")) {
        const afterText = (await page.evaluate("document.body.innerText")) as string;
        if (afterText.length > beforeText.length) {
          const beforeLines = new Set(beforeText.split("\n"));
          const newLines = afterText
            .split("\n")
            .filter((line) => !beforeLines.has(line) && line.trim() !== "");
          if (newLines.length > 0) {
            text = newLines.join("\n");
          } else {
            text = null;
          }
        } else {
          text = null;
        }
      }

      items.push(text);

      // Close if requested
      if (opts.closeAfterRead) {
        await page.mouse.click(coord.x, coord.y);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }

    const nothingExpandable = items.every((i) => i === null);
    return { items, nothingExpandable };
  }

  async evaluate(expression: string): Promise<unknown> {
    const page = await this.activePage();
    // expression has already been wrapped by buildEvaluateExpression in the tool layer
    try {
      const result = await page.evaluate(expression);
      // Verify serializability (page.evaluate already serializes, but be explicit)
      if (result !== undefined && result !== null) {
        try {
          JSON.stringify(result);
        } catch {
          throw new BrowserError(
            "evaluate_failed",
            "expression returned a non-serializable value (cyclic reference or Symbol)",
            "return a JSON-serializable value (plain objects, arrays, primitives)",
          );
        }
      }
      return result;
    } catch (e) {
      if (e instanceof BrowserError) throw e;
      // Page-side throw — convert to structured error, do NOT crash the connection
      throw new BrowserError(
        "evaluate_failed",
        `page-side error: ${e instanceof Error ? e.message : String(e)}`,
        "fix the expression and retry — the connection is still alive",
      );
    }
  }

  async dismiss(): Promise<DismissResult> {
    const page = await this.activePage();
    const info = (await page.evaluate(FIND_DIALOG_JS)) as {
      dismissed: boolean;
      method: "click" | "escape";
      element: string;
      coords: { x: number; y: number } | null;
    } | null;

    if (info === null) {
      throw new BrowserError(
        "no_dialog",
        "no open dialog or overlay found",
        "ensure a dialog is open before calling browser_dismiss",
      );
    }

    if (info.method === "click" && info.coords) {
      await page.mouse.click(info.coords.x, info.coords.y);
      return { method: "click", element: info.element, coords: info.coords };
    }

    // Escape fallback
    await page.keyboard.press("Escape");
    return { method: "escape", element: info.element };
  }

  async readForm(selector: string): Promise<FormFieldState> {
    const page = await this.activePage();
    const el = await page.$(selector);
    if (!el) {
      throw new BrowserError(
        "read_failed",
        `selector matched nothing: ${selector}`,
        "check the selector or run browser_snapshot",
      );
    }
    const state = await page.evaluate((node) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const el = node as any;
      const value: string | null = typeof el.value !== "undefined" ? el.value : null;
      const checked: boolean | null = typeof el.checked !== "undefined" ? el.checked : null;
      let selectedOptions: string[] | null = null;
      if (el.selectedOptions) {
        selectedOptions = Array.from(el.selectedOptions as ArrayLike<any>).map(
          (o: any) => (o.textContent ?? "").trim() as string,
        );
      }
      return { value, checked, selectedOptions };
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }, el);
    return {
      value: state.value,
      checked: state.checked,
      selectedOptions: state.selectedOptions,
    };
  }

  // --- Phase 4: performance / network -------------------------------------

  /** Trace lifecycle controller, bound to the active page (lazily created). */
  private trace: TraceController | null = null;
  /** Network capture + interception controller, bound to the active page. */
  private network: NetworkController | null = null;
  /** The page the network controller is bound to (rebind on tab switch). */
  private networkPage: Page | null = null;

  async startTrace(opts?: TraceOpts): Promise<void> {
    const page = await this.activePage();
    if (this.trace === null) this.trace = new TraceController(page);
    await this.trace.start(opts?.screenshots ?? false);
  }

  async stopTrace(): Promise<TraceStopResult> {
    if (this.trace === null) {
      throw new BrowserError("no_trace_running", "no performance trace is running", "call browser_performance_start_trace first");
    }
    const buf = await this.trace.stop();
    const written = await writePayload(buf, { ext: "json" });
    // Trace is always above threshold in practice, but force a path for the contract.
    const path = written.written ? written.path : await forceWrite(buf);
    return { tracePath: path, bytes: written.bytes };
  }

  async analyzeInsight(metric: InsightMetric): Promise<InsightResult> {
    if (this.trace === null) {
      throw new BrowserError("no_trace_running", "no captured trace to analyze", "run start_trace then stop_trace first");
    }
    return this.trace.analyze(metric);
  }

  async lighthouseAudit(opts: LighthouseOpts): Promise<LighthouseResult> {
    const browser = this.requireBrowser();
    const page = await this.activePage();
    const url = page.url();
    // Lighthouse needs the CDP debugging port — extract it from the ws endpoint.
    const debugPort = wsEndpointPort(browser.wsEndpoint());
    if (debugPort === null) {
      throw new BrowserError("lighthouse_failed", "could not determine the Chrome debugging port", "launch Chrome with a debugging port, or attach via browser_url");
    }
    const res = await runLighthouse(url, debugPort, opts.categories);
    const written = await writePayload(res.reportJson, { ext: "json" });
    const reportPath = written.written ? written.path : await forceWrite(res.reportJson);
    return { scores: res.scores, reportPath };
  }

  async exportHar(har: HarPort): Promise<HarExportResult> {
    const net = await this.activeNetwork();
    const entries = net.exportEntries();
    const path = await har.write(entries);
    return { path, entryCount: entries.length, empty: entries.length === 0 };
  }

  async setRoutes(rules: RouteRule[]): Promise<void> {
    const net = await this.activeNetwork();
    await net.setRoutes(rules);
  }

  async clearRoutes(): Promise<void> {
    // Recovery primitive: safe even if no network controller exists yet.
    if (this.network) await this.network.clearRoutes();
  }

  async emulateConditions(opts: EmulateConditionsOpts): Promise<void> {
    const page = await this.activePage();
    if (opts.network !== undefined) {
      await page.emulateNetworkConditions(toNetworkConditions(opts.network));
    }
    if (opts.cpuThrottlingRate !== undefined) {
      await page.emulateCPUThrottling(opts.cpuThrottlingRate);
    }
  }

  /** Get (or create + start capturing on) the network controller for the active page. */
  private async activeNetwork(): Promise<NetworkController> {
    const page = await this.activePage();
    if (this.network === null || this.networkPage !== page) {
      // Tab switched or first use — tear down the old controller, bind a new one.
      if (this.network) await this.network.disable().catch(() => {});
      this.network = new NetworkController(page);
      this.networkPage = page;
      await this.network.startCapture();
    }
    return this.network;
  }

  // --- internals -----------------------------------------------------------

  /** Resolve the active tab to its puppeteer Page (or a structured error). */
  private async activePage(): Promise<Page> {
    if (this.activeTabId === null) {
      throw new BrowserError("no_active_tab", "no tab is currently active", "open a tab with browser_tabs action=new");
    }
    return this.findPage(this.activeTabId);
  }

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

/**
 * Force a payload to disk even when below the writePayload threshold. Traces and
 * Lighthouse reports must always be a FILE (never inlined into a tool result) per
 * the anti-context discipline — so we write directly when writePayload inlined.
 */
async function forceWrite(data: Buffer | string): Promise<string> {
  const { writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const path = join(tmpdir(), `browser-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  await writeFile(path, data);
  return path;
}

/** Extract the numeric port from a ws://host:port/... endpoint, or null. */
function wsEndpointPort(wsEndpoint: string): number | null {
  try {
    const port = Number(new URL(wsEndpoint).port);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/** Map a core NetworkProfile to puppeteer's NetworkConditions. */
function toNetworkConditions(profile: NetworkProfile): {
  offline: boolean;
  download: number;
  upload: number;
  latency: number;
} {
  if (typeof profile === "object") {
    return {
      offline: false,
      download: (profile.downloadKbps * 1000) / 8,
      upload: (profile.uploadKbps * 1000) / 8,
      latency: profile.latencyMs,
    };
  }
  switch (profile) {
    case "none":
      return { offline: false, download: -1, upload: -1, latency: 0 };
    case "offline":
      return { offline: true, download: 0, upload: 0, latency: 0 };
    case "slow-3g":
      return { offline: false, download: (500 * 1000) / 8, upload: (500 * 1000) / 8, latency: 400 };
    case "fast-3g":
      return { offline: false, download: (1.6 * 1000 * 1000) / 8, upload: (750 * 1000) / 8, latency: 150 };
  }
}
