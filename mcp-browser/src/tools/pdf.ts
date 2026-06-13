/**
 * browser_pdf — export the active page as a PDF file.
 * Uses CDP Page.printToPDF via the adapter. The raw bytes are routed through
 * writePayload → /tmp; only the file path is returned (anti-context discipline).
 *
 * Throws pdf_failed if the CDP call fails (e.g. page is navigating).
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { PdfInputSchema, type PdfOut } from "../types.ts";

export const name = "browser_pdf";
export const title = "Export the active page as a PDF file";
export const description =
  "Exports the current page to a PDF file using CDP Page.printToPDF. " +
  "The PDF bytes are never inlined — the /tmp path is returned. " +
  "format= sets paper size (default Letter). Returns pdf_failed if the page is navigating. " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = PdfInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const result = await port.printPdf({
      ...(args.format !== undefined ? { format: args.format } : {}),
      printBackground: args.print_background,
      landscape: args.landscape,
    });
    const out: PdfOut = { path: result.path };
    return ok(`PDF exported → ${result.path}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
