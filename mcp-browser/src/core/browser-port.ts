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

// ---------------------------------------------------------------------------
// Phase 2: snapshot / interaction / navigation use cases.
// `Target`/`ResolvedTarget`/`InteractAction`/`InteractOpts` are the Strategy
// contract in core/targeting.ts. `AxNode` below is a compact CORE DTO — never
// puppeteer's SerializedAXNode; the adapter maps at the boundary.
// ---------------------------------------------------------------------------
import type {
  FillFormField,
  InteractAction,
  InteractOpts,
  ResolvedTarget,
  Target,
} from "./targeting.ts";
import type { HarPort } from "./har-port.ts";

/**
 * Compact accessibility node. Interactive nodes carry a stable `ref` minted by
 * the last snapshot(); non-interactive structural nodes do not. The internal
 * element identity (puppeteer ElementHandle) never appears here.
 */
export type AxNode = {
  role: string;
  name?: string;
  value?: string | number;
  /** Present iff this node is interactive — a token for ref-targeting. */
  ref?: string;
  level?: number;
  checked?: boolean | "mixed";
  disabled?: boolean;
  selected?: boolean;
  children?: AxNode[];
};

export type SnapshotOpts = {
  /** Include only interesting nodes (default true) — keeps the tree compact. */
  interestingOnly?: boolean;
};

/** A11y snapshot result: the compact tree plus the flat ref list it minted. */
export type SnapshotResult = {
  tree: AxNode[];
  /** Every ref present in `tree`, in document order. tree↔refs are consistent. */
  refs: string[];
};

export type NavResult = {
  url: string;
  /** HTTP status of the main document response, if one was produced. */
  status?: number;
};

/** Which condition `wait` blocks on. The strategy name appears in a timeout err. */
export type WaitStrategy = "navigation" | "selector" | "idle";

export type WaitOpts = {
  /** selector strategy: the CSS selector to await. */
  selector?: string;
  /** ms before a wait_timeout err naming the strategy. */
  timeoutMs?: number;
};

export type ScrollOpts = {
  /** Element to scroll to / within; absent = scroll the page. */
  target?: Target;
  /** Page-scroll deltas (px) when no target is given. */
  dx?: number;
  dy?: number;
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

  // --- Phase 2 -------------------------------------------------------------
  /**
   * A11y snapshot of the active page. Mints a fresh ref per interactive node
   * (invalidating refs from the previous snapshot). Throws page_unstable if the
   * document is mid-navigation.
   */
  snapshot(opts?: SnapshotOpts): Promise<SnapshotResult>;
  /**
   * Resolve a Target to an opaque handle via the Strategy. Throws
   * stale_ref / unknown_ref / ambiguous_match / no_match / coord_out_of_viewport.
   * The single chokepoint P3/P5 reuse for element-scoped work.
   */
  resolveTarget(t: Target): Promise<ResolvedTarget>;
  /**
   * Act on a Target. Auto-wait/actionability is handled internally (deep module).
   * Routes through resolveTarget, so the Strategy applies to every action.
   */
  interact(action: InteractAction, t: Target, opts?: InteractOpts): Promise<void>;
  /** Fill several fields in one call; each entry resolves through the Strategy. */
  fillForm(fields: FillFormField[]): Promise<void>;
  /** Navigate the active page. The URL is barricade-validated by the tool first. */
  navigate(url: string): Promise<NavResult>;
  /** Block until a condition holds; throws wait_timeout naming the strategy on timeout. */
  wait(strategy: WaitStrategy, opts?: WaitOpts): Promise<void>;
  /** Scroll the page or scroll an element into view / within it. */
  scroll(opts: ScrollOpts): Promise<void>;
  /**
   * Capture a PNG screenshot of the active page. Returns raw bytes; the tool
   * writes them to disk via the writePayload seam (P3 fills threshold logic).
   */
  screenshot(opts?: { fullPage?: boolean }): Promise<Buffer>;

  // --- Phase 3: read / extract --------------------------------------------

  /**
   * Return the outer HTML of the active page (full document) or a scoped element.
   * Throws read_failed when selector matches nothing; no_active_tab when no tab.
   */
  readDom(opts?: ReadDomOpts): Promise<string>;

  /**
   * Return the raw accessibility tree as a JSON string. Uses puppeteer's
   * accessibility.snapshot with interestingOnly=false for the full tree.
   */
  readAccessibility(): Promise<string>;

  /**
   * Extract structured fields from repeated container elements.
   * Throws read_failed when the selector matches nothing.
   */
  extract(opts: ExtractOpts): Promise<unknown[]>;

  /**
   * Accordion expand-read-close loop. Clicks each element matching selector,
   * reads content from readSelector, optionally closes. Falls back to
   * body-text diff when readSelector matches nothing. Returns array of
   * per-item results (null where nothing new appeared = "no expandable content").
   */
  collect(opts: CollectOpts): Promise<CollectResult>;

  /**
   * Execute arbitrary JS in the page context. Auto-injects querySelectorDeep /
   * querySelectorAllDeep helpers via a single named constant. Throws evaluate_failed
   * on page-side exceptions or non-serializable return values; NEVER evals in the
   * Node/server process.
   */
  evaluate(expression: string): Promise<unknown>;

  /**
   * Find and dismiss the topmost open dialog/overlay using the scored close-button
   * heuristic. Throws no_dialog when none is found. Returns info about the dismissed
   * element.
   */
  dismiss(): Promise<DismissResult>;

  /**
   * Read the current value, checked state, and selectedOptions of a form element
   * located by selector. Throws read_failed when selector matches nothing.
   */
  readForm(selector: string): Promise<FormFieldState>;

  // --- Phase 4: performance / network -------------------------------------

  /**
   * Start a performance trace. Throws trace_already_running if one is in flight
   * (concurrent traces are rejected — the lifecycle is start → stop → analyze).
   */
  startTrace(opts?: TraceOpts): Promise<void>;
  /**
   * Stop the running trace and persist it. Throws no_trace_running when none was
   * started. Returns the /tmp path of the trace file (routed through writePayload).
   */
  stopTrace(): Promise<TraceStopResult>;
  /**
   * Analyze a captured trace for a Core Web Vital (or related insight). Throws
   * no_trace_running when no trace has been captured (analyze before start/stop).
   */
  analyzeInsight(metric: InsightMetric): Promise<InsightResult>;
  /**
   * Run a Lighthouse audit in-process. Throws lighthouse_failed with the
   * underlying reason on a run failure — NEVER returns a zeroed audit as success.
   * The full report is written to disk; only the category scores + path return.
   */
  lighthouseAudit(opts: LighthouseOpts): Promise<LighthouseResult>;
  /**
   * Snapshot the network capture buffer into HAR entries and write them via the
   * injected HarPort. An empty buffer yields a valid-but-empty HAR. Returns the
   * file path plus whether the capture was empty.
   */
  exportHar(har: HarPort): Promise<HarExportResult>;
  /**
   * Arm request interception/mocking from a rule LIST (data, not callbacks). The
   * rules are pre-validated at the tool barricade. Replaces any prior rule set.
   */
  setRoutes(rules: RouteRule[]): Promise<void>;
  /**
   * Disarm all interception. The recovery primitive: callable even after a failed
   * setRoutes(), and called on disconnect so no interception leaks into a later
   * session.
   */
  clearRoutes(): Promise<void>;
  /**
   * Apply network and/or CPU throttling. Out-of-range values are rejected at the
   * tool barricade (throttle_out_of_range) before reaching the adapter.
   */
  emulateConditions(opts: EmulateConditionsOpts): Promise<void>;

  // --- Phase 5: storage / emulation / capture --------------------------------

  /**
   * Multiplexed storage access: cookies, localStorage, sessionStorage — get/set/delete.
   * Communicational cohesion: all ops touch the same storage substrate.
   * Throws storage_failed, cross_domain_cookie (set without opt-in), storage_state_invalid.
   */
  storage(op: StorageOp): Promise<StorageResult>;

  /**
   * Serialize all cookies + localStorage + sessionStorage to a file via writePayload.
   * Returns the file path. Saved state contains session credentials — write to a
   * caller-controlled path; never log contents.
   */
  saveStorageState(): Promise<{ path: string }>;

  /**
   * Restore cookies + localStorage + sessionStorage from a previously-saved state.
   * BARRICADE: validates with StorageStateSchema; checks origin match.
   * All-or-nothing: clear existing state first, then restore. On validation failure,
   * the existing state is NOT cleared. Returns { restored, skipped } counts with
   * per-item diagnostics (skipped = origin mismatch or unknown store).
   */
  restoreStorageState(state: StorageState): Promise<{ restored: string[]; skipped: string[] }>;

  /**
   * Emulate a device (named preset) or set an explicit viewport.
   * Throws emulation_failed for unknown device names.
   */
  emulateDevice(opts: DeviceProfile): Promise<void>;

  /**
   * Set geolocation. Throws geolocation_out_of_range for invalid lat/lon.
   */
  setGeolocation(opts: GeolocationOpts): Promise<void>;

  /**
   * Grant (or revoke) browser permissions for the active page origin.
   * Throws permission_unknown for unrecognized names.
   */
  grantPermissions(opts: PermissionsOpts): Promise<void>;

  /**
   * Export the active page as a PDF file via CDP Page.printToPDF.
   * Throws pdf_failed on CDP error. Returns the file path.
   */
  printPdf(opts?: PdfOpts): Promise<{ path: string }>;

  /**
   * Start a screencast. Throws screencast_already_running if one is in progress.
   * NOTE (P5b): Video assembly from CDP frames is deferred. This call arms the
   * lifecycle state machine; actual video capture is a P5b follow-up.
   */
  startScreencast(): Promise<void>;

  /**
   * Stop the screencast and return the video file path.
   * Throws no_screencast_running when none was started.
   * Throws screencast_not_supported until P5b is implemented.
   */
  stopScreencast(): Promise<{ path: string }>;

  /**
   * Upload a file to an <input type="file"> element. The element is resolved via
   * resolveTarget (reusing P2 Strategy). Throws upload_failed for non-file inputs.
   */
  uploadFile(target: Target, filePath: string): Promise<void>;

  /**
   * Arm download capture for the next download and wait up to timeoutMs.
   * Throws download_timeout when no download fires within the timeout.
   * Returns the path to the downloaded file.
   */
  captureDownload(opts?: { timeoutMs?: number }): Promise<{ path: string }>;

  /**
   * Wait for text to appear or disappear in the page body.
   * Throws wait_for_text_timeout naming appear vs disappear on timeout.
   */
  waitForText(opts: WaitForTextOpts): Promise<void>;
}

// --- Phase 4 option / result types ----------------------------------------

export type TraceOpts = {
  /** Trace category set; the adapter supplies a CWV-capable default. */
  categories?: string[];
  /** Capture screenshots in the trace (heavier). Default false. */
  screenshots?: boolean;
};

export type TraceStopResult = {
  /** Absolute /tmp path of the persisted trace (via writePayload). */
  tracePath: string;
  /** Byte size of the trace. */
  bytes: number;
};

/** Core Web Vitals + related trace insights. */
export type InsightMetric = "LCP" | "INP" | "CLS" | "TTFB" | "FCP";

export type InsightResult = {
  metric: InsightMetric;
  /** Time-based metrics (LCP/INP/TTFB/FCP) in ms; absent for unitless metrics. */
  valueMs?: number;
  /** Unitless metrics (CLS) value; absent for time-based metrics. */
  value?: number;
  /** Whether the metric was found in the captured trace. */
  found: boolean;
  /** Human note (e.g. the event the value came from, or why it was not found). */
  detail: string;
};

/** Lighthouse audit categories (validated at the barricade against this set). */
export type LighthouseCategory = "performance" | "accessibility" | "seo" | "best-practices";

export type LighthouseOpts = {
  /** Categories to audit. At least one; barricade-validated. */
  categories: LighthouseCategory[];
};

export type LighthouseResult = {
  /** 0..1 scores per requested category (only those requested are present). */
  scores: Partial<Record<LighthouseCategory, number>>;
  /** /tmp path of the full JSON report (via writePayload). */
  reportPath: string;
};

export type HarExportResult = {
  /** Absolute path of the written HAR file. */
  path: string;
  /** Number of entries in the HAR. */
  entryCount: number;
  /** True when the capture buffer was empty (a valid-but-empty HAR was written). */
  empty: boolean;
};

/** A request-interception rule, applied as DATA by the adapter. */
export type RouteAction = "block" | "abort" | "stub" | "modify";

export type RouteRule = {
  /** URL glob/substring to match. Barricade-validated (non-empty, length-capped). */
  urlPattern: string;
  action: RouteAction;
  /** stub/modify: HTTP status (100..599, barricade-validated). */
  status?: number;
  /** stub/modify: response body. UNTRUSTED — size-capped, never executed. */
  body?: string;
  /** stub/modify: content-type for the stubbed/modified response. */
  contentType?: string;
  /** stub/modify: extra response headers. */
  headers?: Record<string, string>;
};

/** A named network throttle preset or explicit conditions. */
export type NetworkProfile =
  | "none"
  | "offline"
  | "slow-3g"
  | "fast-3g"
  | { downloadKbps: number; uploadKbps: number; latencyMs: number };

export type EmulateConditionsOpts = {
  /** Network throttle profile/preset. Absent = leave network unchanged. */
  network?: NetworkProfile;
  /** CPU slowdown multiplier (1 = none). Barricade-validated to 1..20. */
  cpuThrottlingRate?: number;
};

// --- Phase 5 option / result types ----------------------------------------

/** Which browser storage to operate on. */
export type StorageStore = "cookies" | "localStorage" | "sessionStorage";

/** Which operation to perform on a storage store. */
export type StorageOperation = "get" | "set" | "delete";

/** Cookie attributes for the set operation (parameter object — keeps top-level ≤7 fields). */
export type CookieSetAttrs = {
  value: string;
  /** Domain the cookie applies to (default: active page's domain). */
  domain?: string;
  /** Path the cookie applies to. */
  path?: string;
  /** Expiry as Unix timestamp seconds. */
  expiry?: number;
  /** HttpOnly flag. */
  httpOnly?: boolean;
  /** Secure flag. */
  secure?: boolean;
  /** SameSite attribute. */
  sameSite?: "Strict" | "Lax" | "None";
};

export type StorageOp =
  | { store: StorageStore; op: "get"; key: string }
  | { store: StorageStore; op: "delete"; key: string }
  | { store: "cookies"; op: "set"; key: string; attrs: CookieSetAttrs; allowCrossDomain?: boolean }
  | { store: "localStorage" | "sessionStorage"; op: "set"; key: string; value: string };

export type StorageResult = {
  /** The stored value (get only). null when key absent. */
  value?: string | null;
  /** All cookies/entries when no key is specified. */
  entries?: { key: string; value: string }[];
};

/** Validated storage state — the type StorageStateSchema produces at the restore boundary. */
export type StorageState = {
  origin: string;
  cookies: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }[];
  localStorage: { key: string; value: string }[];
  sessionStorage: { key: string; value: string }[];
};

/** Device emulation: either a named preset or explicit dimensions. */
export type DeviceProfile =
  | { preset: string }
  | { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean };

export type GeolocationOpts = {
  /** Degrees: -90..90. */
  latitude: number;
  /** Degrees: -180..180. */
  longitude: number;
  /** Accuracy in meters (≥0). */
  accuracy?: number;
};

export type PermissionsOpts = {
  /** Permission names to grant. Unknown names are rejected at the barricade. */
  permissions: string[];
  /** Origin to grant permissions for (default: active page origin). */
  origin?: string;
};

export type PdfOpts = {
  /** Paper format, e.g. "A4", "Letter". */
  format?: string;
  /** Include background graphics. */
  printBackground?: boolean;
  /** Landscape orientation. */
  landscape?: boolean;
};

export type WaitForTextOpts = {
  /** The text/substring to wait for. */
  text: string;
  /** true: wait for the text to appear (default); false: wait for it to disappear. */
  appear?: boolean;
  /** ms before a wait_for_text_timeout err. Default 30000. */
  timeoutMs?: number;
};

// --- Phase 3 option / result types ----------------------------------------

export type ReadDomOpts = {
  /** CSS selector to scope the read. Absent = full document HTML. */
  selector?: string;
};

export type ExtractField = { name: string; selector: string };

export type ExtractOpts = {
  /** Selector for repeated container elements. */
  selector: string;
  /** Named child selectors to extract per container. Absent = textContent. */
  fields?: ExtractField[];
  /** Pierce shadow DOM when matching. */
  pierce?: boolean;
};

export type CollectOpts = {
  /** Selector for the clickable toggle/accordion elements. */
  selector: string;
  /** Selector to read content from after expanding. */
  readSelector: string;
  /** Pierce shadow DOM when matching. */
  pierce?: boolean;
  /** Click the element again after reading to close (default false). */
  closeAfterRead?: boolean;
  /** Milliseconds to wait after each click (default 300). */
  delayMs?: number;
};

export type CollectResult = {
  /** Per-item expanded content (null = nothing new appeared after expand). */
  items: (string | null)[];
  /** True when every item in `items` is null (nothing expanded for any item). */
  nothingExpandable: boolean;
};

export type DismissResult = {
  /** How the dialog was dismissed: click on a close button, or Escape key. */
  method: "click" | "escape";
  /** Best description of the element dismissed. */
  element: string;
  /** Coordinates of the close button click, if method=click. */
  coords?: { x: number; y: number };
};

export type FormFieldState = {
  /** The current input/textarea value (null for non-value elements). */
  value: string | null;
  /** Checkbox/radio checked state (null for non-checkable elements). */
  checked: boolean | null;
  /** Selected option texts for <select> (null for non-select elements). */
  selectedOptions: string[] | null;
};
