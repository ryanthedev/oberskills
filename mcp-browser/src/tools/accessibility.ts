/**
 * browser_accessibility — reads the full accessibility tree of the active page.
 * Routes through writePayload (the dom.ts idiom): below threshold the JSON is
 * inlined IN FULL (`inlined`); at/above threshold it spills to /tmp (path + a
 * tool-sliced `preview`). A small tree is never clipped.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { writePayload } from "../lib/payload.ts";
import { isBrowserError } from "../core/errors.ts";
import { AccessibilityInputSchema, type AccessibilityOut } from "../types.ts";

export const name = "browser_accessibility";
export const title = "Read the full accessibility tree";
export const description =
  "Returns the full accessibility tree of the active page as JSON. " +
  "Large output is written to /tmp and { path, preview } returned; small output is inlined in full " +
  "(written:false, inlined). " +
  "Prefer browser_snapshot for interaction refs; use this for deep AX audits.";

export const inputShape = AccessibilityInputSchema;

/** Chars of the AX JSON to show in the spilled-branch preview. */
const PREVIEW_CHARS = 256;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let axJson: string;
    try {
      axJson = await port.readAccessibility();
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    const written = await writePayload(axJson, { ext: "json" });
    const out: AccessibilityOut = {
      path: written.path,
      bytes: written.bytes,
      written: written.written,
      ...(written.written ? { preview: axJson.slice(0, PREVIEW_CHARS) } : { inlined: written.inlinedPreview ?? axJson }),
    };

    if (written.written) {
      return ok(`accessibility → ${written.path} (${written.bytes} bytes)`, out);
    }
    // Full content in the text too: some clients surface only content[].text.
    return ok(`accessibility → inlined (${written.bytes} bytes): ${axJson}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
