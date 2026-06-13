/**
 * browser_upload — upload a file to an <input type=file> element, resolved via
 * the P2 resolveTarget Strategy. Reuses TargetInputFields (ref/selector/coords).
 *
 * Barricade:
 *  - At least one target field (ref or selector) must be supplied.
 *  - file_path must be non-empty.
 *  - Coordinate targets are rejected (upload needs an ElementHandle).
 *  - Non-file-input elements → upload_failed.
 *  - Stale/unknown refs propagate through resolveTarget as-is.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { TargetInputFields, toTarget, type UploadOut } from "../types.ts";

const inputShape = {
  ...TargetInputFields,
  file_path: z.string().min(1).describe("Absolute path to the file to upload."),
};

export { inputShape };
export const name = "browser_upload";
export const title = "Upload a file to an <input type=file> element";
export const description =
  "Uploads a file to a file-input element located by ref (primary) or selector (fallback). " +
  "Coordinate targets are not supported for upload — use a ref or selector. " +
  "Returns upload_failed if the element is not a file input or is stale. " +
  "Returns connection_lost if the browser died. Never throws.";

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: require ref or selector (not coords — upload needs an element handle).
  const target = toTarget(args);
  if (target === null) {
    return errFromBrowserError(
      new BrowserError(
        "upload_failed",
        "no target provided — ref or selector required for upload",
        "supply ref= (from browser_snapshot) or selector= for the <input type=file>",
      ),
    );
  }

  // Reject coordinate targets early: upload requires an element handle.
  if ("x" in target && "y" in target) {
    return errFromBrowserError(
      new BrowserError(
        "upload_failed",
        "coordinate targets are not supported for file upload",
        "use ref= or selector= to target the <input type=file> element",
      ),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.uploadFile(target, args.file_path);
    const out: UploadOut = { uploaded: true };
    return ok(`file uploaded: ${args.file_path}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
