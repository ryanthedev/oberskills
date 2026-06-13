/**
 * Core-owned structured error. Lives in the domain core (no third-party imports)
 * so both the tool layer (driving adapter) and the puppeteer adapter (driven
 * adapter) depend inward on it. A BrowserError is a *failure* surfaced to the
 * client as an err() envelope — never thrown to the MCP client, never swallowed.
 */

export type BrowserErrorCode =
  | "connect_ambiguous" // attach given both browserURL and wsEndpoint
  | "connect_invalid" // attach given neither target
  | "executable_not_found" // launch executablePath missing / not a file
  | "invalid_browser_url" // browserURL not a well-formed http(s) URL
  | "invalid_ws_endpoint" // wsEndpoint not a well-formed ws(s) URL
  | "connection_lost" // liveness probe failed mid-session
  | "no_active_tab" // no tab is currently active (e.g. last tab closed)
  | "unknown_tab" // tabId not in the live tab set
  | "launch_failed" // adapter could not launch Chrome
  | "attach_failed"; // adapter could not attach to the target

export type BrowserErrorShape = {
  code: BrowserErrorCode;
  message: string;
  /** A concrete next step for the caller — always populated, never empty. */
  suggestion: string;
};

/**
 * A BrowserError is the single structured-failure type. It extends Error so the
 * adapter can throw it internally and the tool barricade can catch-and-convert,
 * but the public contract is the {code,message,suggestion} envelope reachable via
 * `.toShape()` — that is what reaches the client, never a stack trace.
 */
export class BrowserError extends Error {
  readonly code: BrowserErrorCode;
  readonly suggestion: string;

  constructor(code: BrowserErrorCode, message: string, suggestion: string) {
    super(message);
    this.name = "BrowserError";
    this.code = code;
    this.suggestion = suggestion;
  }

  toShape(): BrowserErrorShape {
    return { code: this.code, message: this.message, suggestion: this.suggestion };
  }

  /** One-line human text for the err() result body. */
  toText(): string {
    return `${this.code}: ${this.message} — ${this.suggestion}`;
  }
}

export function isBrowserError(e: unknown): e is BrowserError {
  return e instanceof BrowserError;
}
