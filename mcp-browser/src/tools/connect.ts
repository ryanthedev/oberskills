/**
 * browser_connect — driving adapter (tool). Validates external connect input at
 * the barricade BEFORE it reaches the BrowserPort, then delegates to the port.
 *
 * Barricade rules (cc-defensive — external input, structured-error strategy):
 *  - attach + both browser_url & ws_endpoint  -> connect_ambiguous (no silent pick)
 *  - attach + neither                         -> connect_invalid
 *  - launch + executable_path not on disk     -> executable_not_found
 *  - browser_url not a well-formed http(s)    -> invalid_browser_url
 *  - ws_endpoint not a well-formed ws(s)      -> invalid_ws_endpoint
 * Every failure is a BrowserError {code,message,suggestion} surfaced via err();
 * nothing is thrown to the client.
 */
import { existsSync } from "node:fs";
import { z } from "zod";
import { BrowserError, isBrowserError } from "../core/errors.ts";
import type { ConnectOptions } from "../core/browser-port.ts";
import { getPort } from "../core/session.ts";
import { errFromBrowserError, ok, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { ConnectInputSchema, type ConnectionInfoOut } from "../types.ts";

export const name = "browser_connect";
export const title = "Connect to a browser (launch-own or attach-to-running)";
export const description =
  "Establishes the persistent browser connection used by every other browser tool. mode=launch spawns (or " +
  "reuses) a Chrome we own via executable_path or channel; mode=attach connects to a running Chrome via " +
  "exactly one of browser_url (http DevTools discovery) or ws_endpoint. Validates targets at the barricade and " +
  "returns a structured {code,message,suggestion} error (never throws) on bad input or a lost connection.";

export const inputShape = ConnectInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

function validateUrl(value: string, schemes: string[]): boolean {
  try {
    const u = new URL(value);
    return schemes.includes(u.protocol.replace(/:$/, ""));
  } catch {
    return false;
  }
}

/** Apply the barricade. Returns the validated ConnectOptions or a BrowserError. */
function barricade(args: Input): ConnectOptions | BrowserError {
  if (args.mode === "attach") {
    const hasUrl = typeof args.browser_url === "string" && args.browser_url.length > 0;
    const hasWs = typeof args.ws_endpoint === "string" && args.ws_endpoint.length > 0;
    if (hasUrl && hasWs) {
      return new BrowserError(
        "connect_ambiguous",
        "attach was given both browser_url and ws_endpoint",
        "supply exactly one attach target — browser_url OR ws_endpoint, not both",
      );
    }
    if (!hasUrl && !hasWs) {
      return new BrowserError(
        "connect_invalid",
        "attach requires an attach target",
        "supply browser_url (http DevTools discovery URL) or ws_endpoint (ws browser endpoint)",
      );
    }
    if (hasUrl && !validateUrl(args.browser_url as string, ["http", "https"])) {
      return new BrowserError(
        "invalid_browser_url",
        `browser_url is not a well-formed http(s) URL: ${args.browser_url}`,
        "use a URL like http://127.0.0.1:9222",
      );
    }
    if (hasWs && !validateUrl(args.ws_endpoint as string, ["ws", "wss"])) {
      return new BrowserError(
        "invalid_ws_endpoint",
        `ws_endpoint is not a well-formed ws(s) URL: ${args.ws_endpoint}`,
        "use a URL like ws://127.0.0.1:9222/devtools/browser/<id>",
      );
    }
    return {
      mode: "attach",
      ...(hasUrl ? { browserURL: args.browser_url } : {}),
      ...(hasWs ? { wsEndpoint: args.ws_endpoint } : {}),
    };
  }

  // launch
  if (typeof args.executable_path === "string" && args.executable_path.length > 0) {
    if (!existsSync(args.executable_path)) {
      return new BrowserError(
        "executable_not_found",
        `executable_path does not exist: ${args.executable_path}`,
        "point executable_path at an installed Chrome/Chromium binary, or use channel instead",
      );
    }
  }
  return {
    mode: "launch",
    ...(args.executable_path ? { executablePath: args.executable_path } : {}),
    ...(args.channel ? { channel: args.channel } : {}),
    headless: args.headless,
  };
}

export async function handler(args: Input): Promise<ToolResult> {
  const opts = barricade(args);
  if (isBrowserError(opts)) return errFromBrowserError(opts);

  try {
    const info = await getPort().connect(opts);
    const out: ConnectionInfoOut = {
      mode: info.mode,
      ws_endpoint: info.wsEndpoint,
      reused: info.reused,
      tab_count: info.tabCount,
    };
    const text = info.reused
      ? `reused running ${info.mode} Chrome (${info.tabCount} tab(s)) — ${info.wsEndpoint}`
      : `connected (${info.mode}, ${info.tabCount} tab(s)) — ${info.wsEndpoint}`;
    return ok(text, out);
  } catch (e) {
    if (isBrowserError(e)) return errFromBrowserError(e);
    throw e; // genuine bug — the registrar boundary catches it
  }
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
