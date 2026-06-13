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
}

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
