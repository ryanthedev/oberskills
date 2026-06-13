/**
 * Payload-to-file helper — defined in Phase 1 as a stable core seam. Phase 3
 * provides the real threshold/inline logic.
 *
 * Contract: data below PAYLOAD_THRESHOLD_BYTES is returned inline (written=false,
 * path=""). Data at or above the threshold is written to /tmp and path+bytes returned
 * (written=true). A failed write throws — the payload is NEVER silently dropped.
 *
 * The write function is injectable (defaults to node:fs/promises writeFile) so the
 * "write fails" dirty test can inject a rejecting promise without touching disk.
 */
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Canonical threshold constant — its single home. All phases import it from here.
 * Data at or above this size goes to /tmp; below stays inline.
 */
export const PAYLOAD_THRESHOLD_BYTES = 4096;

export type WrittenPayload = {
  /** Absolute /tmp path when written=true; empty string when written=false. */
  path: string;
  /** Byte size of the payload. */
  bytes: number;
  /**
   * Present and populated when written=false (data returned inline). Truncated
   * to inlinePreviewChars if that option is supplied; otherwise full content.
   * Absent when written=true.
   */
  inlinedPreview?: string;
  /**
   * true: data was written to disk (path is valid); false: data was inlined
   * (path is ""). The only legitimate reason for written=false is that bytes
   * is below the threshold AND the content fit inline.
   */
  written: boolean;
};

/** Injectable write seam: same contract as node:fs/promises writeFile for our use. */
export type WriteFn = (path: string, data: Buffer | string) => Promise<void>;

const defaultWrite: WriteFn = (path, data) => writeFile(path, data);

/** Options for writePayload. */
export type WritePayloadOpts = {
  /** File extension (without dot). Sanitised internally; default "bin". */
  ext: string;
  /** When present, truncate the inlinedPreview to this many characters. */
  inlinePreviewChars?: number;
};

/**
 * Write a payload to /tmp when at or above the threshold, or return it inline
 * below the threshold. The write function throws on failure — never drop silently.
 *
 * @param data - The payload string or Buffer.
 * @param opts - Extension + optional preview truncation.
 * @param write - Injectable write fn (default: real fs.writeFile).
 */
export async function writePayload(
  data: Buffer | string,
  opts: WritePayloadOpts,
  write: WriteFn = defaultWrite,
): Promise<WrittenPayload> {
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  const safeExt = opts.ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "bin";

  if (bytes < PAYLOAD_THRESHOLD_BYTES) {
    // Return inline — no disk write.
    const raw = typeof data === "string" ? data : data.toString("utf8");
    const inlinedPreview =
      opts.inlinePreviewChars !== undefined ? raw.slice(0, opts.inlinePreviewChars) : raw;
    return { path: "", bytes, inlinedPreview, written: false };
  }

  // At or above threshold: write to /tmp.
  const fileName = `browser-mcp-${Date.now()}.${safeExt}`;
  const path = join(tmpdir(), fileName);
  // Throws on failure — caller (tool barricade) converts to err().
  await write(path, data);
  return { path, bytes, written: true };
}
