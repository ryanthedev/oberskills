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
  "Captures a PNG screenshot and writes it to a file, returning { path, bytes, width, height }. The image bytes " +
  "are never inlined into the result — read the file path (route it to a subagent to keep it out of main context). " +
  "Image token cost is dimension-driven (~width×height/750), so prefer selector to capture one element instead of " +
  "full_page when you only need part of the page. full_page captures the whole scrollable page. Returns " +
  "connection_lost if the browser died; never throws.";

export const inputShape = ScreenshotInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

/**
 * Read a PNG's pixel dimensions straight from its IHDR header — zero-dep, never
 * throws. The 8-byte signature is followed by the IHDR chunk whose width/height
 * are big-endian uint32s at byte offsets 16 and 20. Returns null for anything that
 * is not a decodable PNG (e.g. a truncated buffer or a non-PNG payload).
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const png = await port.screenshot({
      fullPage: args.full_page,
      ...(args.selector !== undefined ? { selector: args.selector } : {}),
    });
    const written = await writePayload(png, { ext: "png" });
    const dims = pngDimensions(png);
    const out: ScreenshotOut = {
      path: written.path,
      bytes: written.bytes,
      ...(dims ? { width: dims.width, height: dims.height } : {}),
    };
    const dimText = dims ? `, ${dims.width}×${dims.height}px` : "";
    return ok(`screenshot → ${written.path} (${written.bytes} bytes${dimText})`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
