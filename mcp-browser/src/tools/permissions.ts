/**
 * browser_permissions — grant browser permissions for the active page origin, or
 * (empty list) clear every permission override in the browser context.
 *
 * Barricade: permission names are validated against the KNOWN_PERMISSIONS allowlist.
 * Unknown names → permission_unknown (never silently granted). Allowlist from types.ts.
 *
 * The empty list is the "revoke all" primitive. It resets overrides context-wide —
 * CDP has no per-origin reset — so `origin` is ignored on that branch and the result
 * says so rather than implying an origin-scoped revoke.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { KNOWN_PERMISSIONS, PermissionsInputSchema, type PermissionsOut } from "../types.ts";

export const name = "browser_permissions";
export const title = "Grant or clear browser permissions";
export const description =
  "Grant browser permissions (e.g. geolocation, camera, microphone, notifications) for the active " +
  "page's origin, or for origin when given. An empty permissions list clears every permission override " +
  "in the browser context (all origins — origin is ignored), returning to the browser defaults. " +
  "Unknown permission names return permission_unknown. " +
  "Returns connection_lost if the browser died. Never throws.";

/** PermissionsOut.origin value on the clear-all branch (the reset is not origin-scoped). */
const ALL_ORIGINS = "(all origins)";

export const inputShape = PermissionsInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: validate all permission names against the allowlist.
  const unknown = args.permissions.filter((p) => !KNOWN_PERMISSIONS.has(p));
  if (unknown.length > 0) {
    return errFromBrowserError(
      new BrowserError(
        "permission_unknown",
        `unknown permission name(s): ${unknown.join(", ")}`,
        `use known permissions: ${Array.from(KNOWN_PERMISSIONS).join(", ")}`,
      ),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  if (args.permissions.length === 0) {
    return runPort(async () => {
      // No origin forwarded: the adapter resets overrides for the whole context.
      await port.grantPermissions({ permissions: [] });
      const out: PermissionsOut = { granted: [], origin: ALL_ORIGINS };
      return ok("permission overrides cleared for all origins", out);
    });
  }

  return runPort(async () => {
    await port.grantPermissions({
      permissions: args.permissions,
      ...(args.origin !== undefined ? { origin: args.origin } : {}),
    });
    const out: PermissionsOut = {
      granted: args.permissions,
      origin: args.origin ?? "(active page origin)",
    };
    return ok(`permissions granted: ${args.permissions.join(", ")}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
