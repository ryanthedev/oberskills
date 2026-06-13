/**
 * browser_route — arm request interception/mocking from a rule LIST applied as
 * DATA (block/abort/stub/modify), or disarm all interception (clear=true).
 *
 * SECURITY BARRICADE (this tool is security-sensitive): every RouteRule is
 * validated here BEFORE it reaches the adapter:
 *  - url_pattern non-empty, length-capped (zod) — re-checked here for the clear path
 *  - stub/modify require a status in 100..599                  → invalid_route_rule
 *  - stub/modify body is size-capped (RESPONSE_BODY_MAX_BYTES) → invalid_route_rule
 *  - bodies are DATA — never executed; handed to the adapter as strings, never eval'd
 * A malformed rule is rejected at the barricade rather than corrupting the stream.
 * clear=true (and the empty-rules path) calls clearRoutes — the recovery primitive,
 * callable even after a failed setRoutes().
 */
import { z } from "zod";
import { BrowserError, isBrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { RESPONSE_BODY_MAX_BYTES, RouteInputSchema, type RouteOut } from "../types.ts";
import type { RouteRule } from "../core/browser-port.ts";

export const name = "browser_route";
export const title = "Intercept / mock network requests (block, abort, stub, modify)";
export const description =
  "Arms request interception from a rule list applied as data: block, abort, stub, or modify matched requests. " +
  "Pass clear=true (or an empty rules array) to disarm all interception. Malformed rules (bad status, oversized " +
  "body, empty pattern) are rejected at the barricade. Interception tears down on disconnect. Never throws.";

export const inputShape = RouteInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

type RawRule = Input["rules"][number];

/** Validate one rule at the barricade. Returns a core RouteRule or a BrowserError. */
function validateRule(r: RawRule): RouteRule | BrowserError {
  if (r.url_pattern.trim().length === 0) {
    return new BrowserError("invalid_route_rule", "url_pattern must not be empty", "give a URL glob/substring to match");
  }
  if (r.action === "stub" || r.action === "modify") {
    if (r.status === undefined) {
      return new BrowserError("invalid_route_rule", `${r.action} requires a status`, "add status (100..599) for stub/modify");
    }
    if (!Number.isInteger(r.status) || r.status < 100 || r.status > 599) {
      return new BrowserError("invalid_route_rule", `status ${r.status} is out of range`, "use an HTTP status in 100..599");
    }
    if (r.body !== undefined && Buffer.byteLength(r.body) > RESPONSE_BODY_MAX_BYTES) {
      return new BrowserError(
        "invalid_route_rule",
        `body exceeds the ${RESPONSE_BODY_MAX_BYTES}-byte cap`,
        "shrink the stub/modify body — large bodies are rejected, never streamed",
      );
    }
  }
  // bodies are DATA: copied through as a string, never executed.
  return {
    urlPattern: r.url_pattern,
    action: r.action,
    ...(r.status !== undefined ? { status: r.status } : {}),
    ...(r.body !== undefined ? { body: r.body } : {}),
    ...(r.content_type !== undefined ? { contentType: r.content_type } : {}),
    ...(r.headers !== undefined ? { headers: r.headers } : {}),
  };
}

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  // Disarm path — the recovery primitive; valid even after a prior failed setRoutes.
  if (args.clear || args.rules.length === 0) {
    return runPort(async () => {
      await port.clearRoutes();
      const out: RouteOut = { armed: false, rule_count: 0 };
      return ok("interception cleared", out);
    });
  }

  // Barricade: validate every rule before the adapter sees any of them.
  const validated: RouteRule[] = [];
  for (const raw of args.rules) {
    const v = validateRule(raw);
    if (isBrowserError(v)) return errFromBrowserError(v);
    validated.push(v);
  }

  return runPort(async () => {
    await port.setRoutes(validated);
    const out: RouteOut = { armed: true, rule_count: validated.length };
    return ok(`interception armed: ${validated.length} rule(s)`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
