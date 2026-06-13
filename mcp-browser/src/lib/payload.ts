/**
 * Payload seam — defined in Phase 1 as a stable core seam so P2's screenshot
 * writes against this signature from day one and P3 fills the real threshold /
 * inline-below-threshold logic WITHOUT changing the signature.
 *
 * P1 behavior: always writes to /tmp and returns { path, bytes }. The write
 * function is injectable (defaults to node:fs/promises writeFile) so P3's
 * "write fails" dirty test can inject a rejecting promise without touching disk.
 */
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Canonical threshold constant — its single home. All phases import it from here;
 * P3 gives it its real value/role (inline below, write above). The P1 stub writes
 * unconditionally, so the value is not yet consulted.
 */
export const PAYLOAD_THRESHOLD_BYTES = 4096;

export type WrittenPayload = { path: string; bytes: number };

/** Injectable write seam: same contract as node:fs/promises writeFile for our use. */
export type WriteFn = (path: string, data: Buffer | string) => Promise<void>;

const defaultWrite: WriteFn = (path, data) => writeFile(path, data);

function sanitize(name: string): string {
  // Keep file names to a safe charset so a tool-supplied name can never traverse
  // out of /tmp or inject shell-significant characters into the path.
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "payload";
}

/**
 * Write a payload to /tmp and return its path + byte size. P3 will add the
 * threshold/inline branch in this same function without changing the signature.
 */
export async function writePayload(
  name: string,
  data: Buffer | string,
  ext: string,
  write: WriteFn = defaultWrite,
): Promise<WrittenPayload> {
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "bin";
  const fileName = `browser-mcp-${sanitize(name)}-${Date.now()}.${safeExt}`;
  const path = join(tmpdir(), fileName);
  await write(path, data);
  return { path, bytes };
}
