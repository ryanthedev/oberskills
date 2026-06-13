/**
 * All zod schemas + data types for the mcp-browser server (single normative home,
 * mirrors mcp/src/types.ts). Every value crossing the tool barricade is shaped by
 * a zod schema here; cross-field rules that zod cannot express (e.g. "exactly one
 * of browserURL/wsEndpoint") are enforced in the tool handler against these types.
 *
 * NOTE (MCP SDK gotcha): named types used as structuredContent must be `type`
 * aliases, not `interface` — interfaces lack implicit index signatures.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// connect tool
// ---------------------------------------------------------------------------

export const ConnectModeSchema = z.enum(["launch", "attach"]);
export type ConnectMode = z.infer<typeof ConnectModeSchema>;

/**
 * Raw connect input. zod validates shape + scheme/format of the optional URLs;
 * the handler enforces the mode cross-field rules (the barricade) because zod
 * superRefine error text is less controllable than our BrowserError envelopes.
 */
export const ConnectInputSchema = {
  mode: ConnectModeSchema.describe("launch: spawn/reuse a Chrome we own. attach: connect to a running Chrome."),
  executable_path: z
    .string()
    .optional()
    .describe("launch: absolute path to a Chrome/Chromium binary. Mutually exclusive with channel."),
  channel: z
    .string()
    .optional()
    .describe('launch: a puppeteer browser channel ("chrome", "chrome-beta", "chrome-canary") instead of executable_path.'),
  browser_url: z
    .string()
    .optional()
    .describe("attach: http(s) DevTools discovery URL, e.g. http://127.0.0.1:9222. Mutually exclusive with ws_endpoint."),
  ws_endpoint: z
    .string()
    .optional()
    .describe("attach: ws(s) DevTools browser endpoint. Mutually exclusive with browser_url."),
  headless: z.boolean().default(true).describe("launch: run headless. Ignored in attach mode."),
};

// ---------------------------------------------------------------------------
// tabs tool (multiplexed: one tool, an action arg)
// ---------------------------------------------------------------------------

export const TabActionSchema = z.enum(["list", "new", "select", "close"]);
export type TabAction = z.infer<typeof TabActionSchema>;

export const TabsInputSchema = {
  action: TabActionSchema.describe("list | new | select | close."),
  tab_id: z
    .string()
    .optional()
    .describe("Target tab id (required for select/close; ignored for list/new)."),
  url: z
    .string()
    .optional()
    .describe("Optional URL to open when action is new."),
};

// ---------------------------------------------------------------------------
// Structured result DTOs (also defined as core types; mirrored here as the
// structuredContent shapes the tools return).
// ---------------------------------------------------------------------------

export type ConnectionInfoOut = {
  mode: ConnectMode;
  ws_endpoint: string;
  reused: boolean;
  tab_count: number;
};

export type TabInfoOut = {
  tab_id: string;
  url: string;
  title: string;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Phase 2: Target union + interaction / navigation / wait / scroll inputs.
//
// The Target union is the plan's pinned contract. Tools accept a FLAT target
// (ref | selector | x/y) as separate optional input fields — MCP tool inputs are
// a flat object, not a discriminated union — and `toTarget()` folds them into the
// core Target. The fold is the single place flat→Target happens; tools never read
// ref/selector/x individually (no per-tool targeting ladder).
// ---------------------------------------------------------------------------
import type { Target } from "./core/targeting.ts";

/** Flat target fields shared by every element-targeting tool's inputShape. */
export const TargetInputFields = {
  ref: z.string().optional().describe("Primary: a stable ref id from the most recent browser_snapshot."),
  selector: z.string().optional().describe("Fallback: a CSS selector. Use nth when it matches more than one element."),
  match_text: z.string().optional().describe("Selector refinement: require the element's text to contain this."),
  visible: z.boolean().optional().describe("Selector refinement: require the element to be visible."),
  pierce: z.boolean().optional().describe("Selector refinement: pierce shadow DOM when matching."),
  nth: z.number().int().min(0).optional().describe("Selector refinement: pick the nth (0-based) match when several match."),
  x: z.number().optional().describe("Last-resort: viewport x coordinate (use with y). Mutually exclusive with ref/selector."),
  y: z.number().optional().describe("Last-resort: viewport y coordinate (use with x)."),
};

/**
 * Fold flat target fields into the core Target union. Returns null when no target
 * field is present (the tool turns that into a validation err — never a throw).
 * Precedence ref > selector > coords keeps a single deterministic resolution.
 */
export function toTarget(args: {
  ref?: string;
  selector?: string;
  match_text?: string;
  visible?: boolean;
  pierce?: boolean;
  nth?: number;
  x?: number;
  y?: number;
}): Target | null {
  if (typeof args.ref === "string" && args.ref.length > 0) return { ref: args.ref };
  if (typeof args.selector === "string" && args.selector.length > 0) {
    return {
      selector: args.selector,
      ...(args.pierce !== undefined ? { pierce: args.pierce } : {}),
      ...(args.match_text !== undefined ? { matchText: args.match_text } : {}),
      ...(args.visible !== undefined ? { visible: args.visible } : {}),
      ...(args.nth !== undefined ? { nth: args.nth } : {}),
    };
  }
  if (typeof args.x === "number" && typeof args.y === "number") return { x: args.x, y: args.y };
  return null;
}

export const SnapshotInputSchema = {
  interesting_only: z.boolean().default(true).describe("Prune uninteresting nodes for a compact tree (default true)."),
};

export const ClickInputSchema = {
  ...TargetInputFields,
  button: z.enum(["left", "right", "middle"]).optional().describe("Mouse button (default left)."),
  click_count: z.number().int().min(1).optional().describe("Number of clicks (e.g. 2 for double-click)."),
};

export const TypeInputSchema = {
  ...TargetInputFields,
  text: z.string().describe("Text to type into the targeted element."),
};

export const HoverInputSchema = { ...TargetInputFields };

export const SelectInputSchema = {
  ...TargetInputFields,
  values: z.array(z.string()).min(1).describe("Option value(s) to select in the targeted <select>."),
};

export const PressKeyInputSchema = {
  ...TargetInputFields,
  key: z.string().describe('Key to press (e.g. "Enter", "Tab", "a").'),
  modifiers: z.number().int().min(0).default(0).describe("Modifier bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8 (sum them)."),
};

export const DragInputSchema = {
  ...TargetInputFields,
  to_ref: z.string().optional().describe("Drop target: a ref id."),
  to_selector: z.string().optional().describe("Drop target: a CSS selector."),
  to_x: z.number().optional().describe("Drop target: viewport x (with to_y)."),
  to_y: z.number().optional().describe("Drop target: viewport y (with to_x)."),
};

export const FillFormInputSchema = {
  fields: z
    .array(
      z.object({
        ref: z.string().optional(),
        selector: z.string().optional(),
        match_text: z.string().optional(),
        visible: z.boolean().optional(),
        pierce: z.boolean().optional(),
        nth: z.number().int().min(0).optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        value: z.string(),
      }),
    )
    .min(1)
    .describe("Fields to fill: each is a target (ref/selector/coords) plus the value to set."),
};

export const NavigateInputSchema = {
  url: z.string().describe("http(s) URL to navigate the active page to. Validated at the barricade."),
  allow_internal: z
    .boolean()
    .default(false)
    .describe("Opt in to file:// / about: schemes (SSRF-sensitive). javascript: stays blocked regardless."),
};

export const WaitInputSchema = {
  strategy: z.enum(["navigation", "selector", "idle"]).describe("What to wait for."),
  selector: z.string().optional().describe("Required when strategy=selector: the CSS selector to await."),
  timeout_ms: z.number().int().min(0).default(30000).describe("Milliseconds before a wait_timeout err naming the strategy."),
};

export const ScrollInputSchema = {
  ...TargetInputFields,
  dx: z.number().optional().describe("Page scroll delta x (px) when no target is given."),
  dy: z.number().optional().describe("Page scroll delta y (px) when no target is given."),
};

export const ScreenshotInputSchema = {
  full_page: z.boolean().default(false).describe("Capture the full scrollable page rather than the viewport."),
};

// --- structured result DTOs ------------------------------------------------

export type NavResultOut = {
  url: string;
  status?: number;
};

export type ScreenshotOut = {
  path: string;
  bytes: number;
};
