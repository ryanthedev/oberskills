/**
 * browser_navigate — driving adapter. The URL is UNTRUSTED external input
 * (SSRF-adjacent, SM-2). The barricade validates it BEFORE the port is reached:
 *  - unparseable                       -> invalid_url
 *  - scheme not http/https             -> blocked_url
 *  - allow_internal=true               -> also permits file:/about: (NOT javascript:)
 * Allowlist-based (RF-6), not denylist. javascript: is code-exec — never allowed.
 */
import { z } from "zod";
import { BrowserError, isBrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { NavigateInputSchema, type NavResultOut } from "../types.ts";

export const name = "browser_navigate";
export const title = "Navigate the active page to an http(s) URL";
export const description =
  "Navigates the active page. Accepts http(s) URLs only; file://, chrome://, javascript:, data:, about: and other " +
  "internal schemes are blocked at the barricade (SSRF-sensitive). allow_internal opts in to file:///about: but " +
  "never javascript:. A malformed URL returns invalid_url; a blocked scheme blocked_url. Never throws.";

export const inputShape = NavigateInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

/** Schemes that are code-execution and stay blocked even with allow_internal. */
const ALWAYS_BLOCKED = new Set(["javascript:", "vbscript:"]);
/** Internal schemes permitted only when allow_internal is set. */
const INTERNAL_SCHEMES = new Set(["file:", "about:"]);

/** Validate the URL at the barricade. Returns the URL string or a BrowserError. */
function barricade(rawUrl: string, allowInternal: boolean): string | BrowserError {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new BrowserError("invalid_url", `not a parseable URL: ${rawUrl}`, "pass an absolute http(s) URL like https://example.com");
  }
  const scheme = parsed.protocol.toLowerCase();
  if (scheme === "http:" || scheme === "https:") return rawUrl;
  if (ALWAYS_BLOCKED.has(scheme)) {
    return new BrowserError("blocked_url", `scheme ${scheme} is never allowed (code execution)`, "use an http(s) URL");
  }
  if (allowInternal && INTERNAL_SCHEMES.has(scheme)) return rawUrl;
  return new BrowserError(
    "blocked_url",
    `scheme ${scheme} is blocked`,
    allowInternal ? "only http(s)/file/about are allowed" : "use an http(s) URL, or set allow_internal for file://",
  );
}

export async function handler(args: Input): Promise<ToolResult> {
  const validated = barricade(args.url, args.allow_internal);
  if (isBrowserError(validated)) return errFromBrowserError(validated);

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const res = await port.navigate(validated);
    const out: NavResultOut = { url: res.url, ...(res.status !== undefined ? { status: res.status } : {}) };
    return ok(`navigated to ${res.url}${res.status ? ` (${res.status})` : ""}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
