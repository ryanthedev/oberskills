/**
 * browser_storage_state_save — capture all cookies + localStorage + sessionStorage
 * to a file (via writePayload). The file contains credentials — it is written to
 * /tmp and the path returned; contents are never logged.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { StorageSaveInputSchema, type StorageSaveOut } from "../types.ts";

export const name = "browser_storage_state_save";
export const title = "Save browser cookies + storage to a file (auth reuse)";
export const description =
  "Serializes all cookies, localStorage, and sessionStorage for the active page to a JSON file. " +
  "The saved state can be restored with browser_storage_state_restore to reuse auth across restarts. " +
  "WARNING: the file contains credentials — treat it as a secret. Returns { path }. Never throws.";

export const inputShape = StorageSaveInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(_args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const result = await port.saveStorageState();
    const out: StorageSaveOut = { path: result.path };
    return ok(`storage state saved → ${result.path}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
