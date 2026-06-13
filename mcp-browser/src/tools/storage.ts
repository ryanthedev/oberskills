/**
 * browser_storage — multiplexed storage tool: cookies, localStorage, sessionStorage
 * get/set/delete. Communicational cohesion: all ops use the same browser storage
 * substrate.
 *
 * Barricade:
 *  - op=set for localStorage/sessionStorage requires value to be present.
 *  - op=set for cookies: cookie_attrs required; cross-domain requires allow_cross_domain.
 *  - Cross-domain set without flag → cross_domain_cookie (explicit err, not silent no-op).
 *  - localStorage/sessionStorage on no-origin page → storage_failed.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { StorageInputSchema, type StorageOut } from "../types.ts";
import type { CookieSetAttrs, StorageOp } from "../core/browser-port.ts";

export const name = "browser_storage";
export const title = "Get/set/delete cookies, localStorage, or sessionStorage";
export const description =
  "Access browser storage: cookies, localStorage, or sessionStorage — get, set, or delete. " +
  "Cross-domain cookie set requires allow_cross_domain=true (never a silent no-op). " +
  "localStorage/sessionStorage on a no-origin page (about:blank) returns storage_failed. " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = StorageInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: op=set for localStorage/sessionStorage requires value.
  if (args.op === "set" && args.store !== "cookies" && (args.value === undefined || args.value === null)) {
    return errFromBrowserError(
      new BrowserError(
        "storage_failed",
        `op=set for ${args.store} requires value`,
        "pass value= with the string to store",
      ),
    );
  }

  // Barricade: op=set for cookies requires cookie_attrs.
  if (args.op === "set" && args.store === "cookies" && args.cookie_attrs === undefined) {
    return errFromBrowserError(
      new BrowserError(
        "storage_failed",
        "op=set for cookies requires cookie_attrs",
        "pass cookie_attrs with at least { value: '...' }",
      ),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    // Build the typed StorageOp union.
    let op: StorageOp;

    if (args.store === "cookies") {
      if (args.op === "set") {
        const attrs = args.cookie_attrs!;
        const cookieAttrs: CookieSetAttrs = {
          value: attrs.value,
          ...(attrs.domain !== undefined ? { domain: attrs.domain } : {}),
          ...(attrs.path !== undefined ? { path: attrs.path } : {}),
          ...(attrs.expiry !== undefined ? { expiry: attrs.expiry } : {}),
          ...(attrs.httpOnly !== undefined ? { httpOnly: attrs.httpOnly } : {}),
          ...(attrs.secure !== undefined ? { secure: attrs.secure } : {}),
          ...(attrs.same_site !== undefined ? { sameSite: attrs.same_site } : {}),
        };
        op = {
          store: "cookies",
          op: "set",
          key: args.key,
          attrs: cookieAttrs,
          allowCrossDomain: attrs.allow_cross_domain,
        };
      } else {
        op = { store: "cookies", op: args.op, key: args.key };
      }
    } else if (args.store === "localStorage" || args.store === "sessionStorage") {
      if (args.op === "set") {
        op = { store: args.store, op: "set", key: args.key, value: args.value! };
      } else {
        op = { store: args.store, op: args.op as "get" | "delete", key: args.key };
      }
    } else {
      return errFromBrowserError(
        new BrowserError("storage_failed", `unknown store: ${args.store as string}`, "use cookies, localStorage, or sessionStorage"),
      );
    }

    const result = await port.storage(op);
    const out: StorageOut = {
      ...(result.value !== undefined ? { value: result.value } : {}),
      ...(result.entries !== undefined ? { entries: result.entries } : {}),
    };

    const summary =
      args.op === "get"
        ? `${args.store} get "${args.key}" → ${result.value ?? "(not found)"}`
        : `${args.store} ${args.op} "${args.key}"`;
    return ok(summary, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
