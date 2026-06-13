/**
 * browser_dismiss — finds and dismisses the topmost open dialog/overlay using the
 * scored close-button heuristic (ported from cdp-browser.js). Returns no_dialog
 * when none is present — never a false success.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { isBrowserError } from "../core/errors.ts";
import { DismissInputSchema, type DismissOut } from "../types.ts";

export const name = "browser_dismiss";
export const title = "Dismiss the topmost open dialog or overlay";
export const description =
  "Finds and dismisses the topmost open dialog, modal, or overlay using a scored " +
  "close-button heuristic (aria-label, text, class, position). Falls back to Escape key. " +
  "Returns no_dialog (nothing to dismiss) when no dialog is present — not a silent success.";

export const inputShape = DismissInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let result: import("../core/browser-port.ts").DismissResult;
    try {
      result = await port.dismiss();
    } catch (e) {
      if (isBrowserError(e)) {
        if (e.code === "no_dialog") {
          // Explicit "nothing to dismiss" — not a false success.
          return err(`nothing to dismiss: ${e.message} — ${e.suggestion}`, e.toShape());
        }
        return errFromBrowserError(e);
      }
      throw e;
    }

    const out: DismissOut = {
      method: result.method,
      element: result.element,
      ...(result.coords ? { coords: result.coords } : {}),
    };
    const coordDesc = result.coords ? ` at (${result.coords.x}, ${result.coords.y})` : "";
    return ok(`dismissed ${result.element} via ${result.method}${coordDesc}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
