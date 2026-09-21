/**
 * browser_dom — reads the outer HTML of the active page (full or selector-scoped).
 * Routes through writePayload (the snapshot/evaluate idiom): below threshold the
 * HTML is inlined IN FULL (`inlined`); at/above threshold it spills to /tmp (path +
 * a tool-sliced `preview`). Truncation only ever applies to the spilled branch —
 * a small read is never clipped. A selector matching nothing returns read_failed,
 * not an empty file.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { writePayload } from "../lib/payload.ts";
import { isBrowserError } from "../core/errors.ts";
import { DomInputSchema, type DomOut } from "../types.ts";

export const name = "browser_dom";
export const title = "Read page HTML (full or selector-scoped)";
export const description =
  "Returns the outer HTML of the active page or a CSS-selector-scoped element. " +
  "Large output is written to /tmp and { path, preview } returned; small output is inlined in full " +
  "(written:false, inlined). " +
  "Returns read_failed when the selector matches nothing.";

export const inputShape = DomInputSchema;

/** Chars of the HTML to show in the spilled-branch preview. */
const PREVIEW_CHARS = 512;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let html: string;
    try {
      html = await port.readDom({ selector: args.selector });
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    const written = await writePayload(html, { ext: "html" });
    const out: DomOut = {
      path: written.path,
      bytes: written.bytes,
      written: written.written,
      // Below threshold writePayload carries the FULL content (no inlinePreviewChars
      // passed); above it, the file is the source of truth and we slice a preview.
      ...(written.written ? { preview: html.slice(0, PREVIEW_CHARS) } : { inlined: written.inlinedPreview ?? html }),
    };

    if (written.written) {
      return ok(`dom → ${written.path} (${written.bytes} bytes)`, out);
    }
    // Full content in the text too: some clients surface only content[].text.
    return ok(`dom → inlined (${written.bytes} bytes): ${html}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
