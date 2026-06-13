/**
 * browser_screenshot — driving adapter. Captures a PNG and writes it to disk via
 * the P1 writePayload seam, returning { path, bytes } (the P2 contract; P3 fills
 * the real threshold/inline logic without changing this shape). The image bytes
 * never enter the tool result — only the file path does (anti-context discipline).
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { writePayload } from "../lib/payload.ts";
import { ScreenshotInputSchema, type ScreenshotOut } from "../types.ts";

export const name = "browser_screenshot";
export const title = "Screenshot the active page to a file";
export const description =
  "Captures a PNG screenshot of the active page and writes it to a file, returning { path, bytes }. The image " +
  "bytes are never inlined into the result — read the file path (route it to a subagent to keep it out of main " +
  "context). full_page captures the whole scrollable page. Returns connection_lost if the browser died; never throws.";

export const inputShape = ScreenshotInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const png = await port.screenshot({ fullPage: args.full_page });
    const written = await writePayload(png, { ext: "png" });
    const out: ScreenshotOut = { path: written.path, bytes: written.bytes };
    return ok(`screenshot → ${written.path} (${written.bytes} bytes)`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
