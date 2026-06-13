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
