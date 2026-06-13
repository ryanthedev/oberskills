/**
 * browser_permissions — grant browser permissions for the active page origin.
 *
 * Barricade: permission names are validated against the KNOWN_PERMISSIONS allowlist.
 * Unknown names → permission_unknown (never silently granted). Allowlist from types.ts.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { KNOWN_PERMISSIONS, PermissionsInputSchema, type PermissionsOut } from "../types.ts";

export const name = "browser_permissions";
export const title = "Grant browser permissions for the active page";
export const description =
  "Grant browser permissions (e.g. geolocation, camera, microphone, notifications) for the active " +
  "page's origin. Unknown permission names return permission_unknown. " +
  "Returns connection_lost if the browser died. Never throws.";

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
