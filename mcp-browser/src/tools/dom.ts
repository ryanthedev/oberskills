/**
 * browser_dom — reads the outer HTML of the active page (full or selector-scoped).
 * Large payloads are written to /tmp via writePayload; below threshold, the HTML
 * is inlined. A selector matching nothing returns read_failed, not an empty file.
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
  "Large output is written to /tmp and the path returned; small output is inlined. " +
  "Returns read_failed when the selector matches nothing.";

export const inputShape = DomInputSchema;

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

    const written = await writePayload(html, { ext: "html", inlinePreviewChars: 512 });
    const out: DomOut = {
      path: written.path,
      bytes: written.bytes,
      written: written.written,
      ...(written.inlinedPreview !== undefined ? { inlined_preview: written.inlinedPreview } : {}),
    };

    if (written.written) {
      return ok(`dom → ${written.path} (${written.bytes} bytes)`, out);
    }
    return ok(`dom → inlined (${written.bytes} bytes): ${written.inlinedPreview ?? ""}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
