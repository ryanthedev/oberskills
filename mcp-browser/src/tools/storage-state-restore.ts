/**
 * browser_storage_state_restore — restore cookies + localStorage + sessionStorage
 * from a JSON string previously saved by browser_storage_state_save.
 *
 * Barricade:
 *  - state_json is external input: validated against StorageStateSchema (zod) before
 *    reaching the adapter. Malformed or schema-failing input → storage_state_invalid.
 *  - All-or-nothing: the adapter clears existing state before restoring; on validation
 *    failure the existing state is NOT cleared.
 *  - Origin mismatch: cross-origin cookies are skipped with a diagnostic (not silently
 *    injected).
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { StorageRestoreInputSchema, StorageStateSchema, type StorageRestoreOut } from "../types.ts";

export const name = "browser_storage_state_restore";
export const title = "Restore browser cookies + storage from a saved state (auth reuse)";
export const description =
  "Restores cookies, localStorage, and sessionStorage from a JSON state previously saved by " +
  "browser_storage_state_save. Validates the state with StorageStateSchema before applying it — " +
  "malformed or wrong-origin files are rejected. Returns { restored, skipped } lists. " +
  "All-or-nothing: existing state is cleared before restore. Never throws.";

export const inputShape = StorageRestoreInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: parse and validate the JSON — external input from disk, never trusted.
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.state_json);
  } catch (e) {
    return errFromBrowserError(
      new BrowserError(
        "storage_state_invalid",
        `state_json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
        "use the JSON string returned by browser_storage_state_save",
      ),
    );
  }

  const validation = StorageStateSchema.safeParse(parsed);
  if (!validation.success) {
    return errFromBrowserError(
      new BrowserError(
        "storage_state_invalid",
        `storage state failed validation: ${validation.error.issues.map((e) => e.message).join("; ")}`,
        "use the JSON string returned by browser_storage_state_save; do not modify the file",
      ),
    );
  }

  const state = validation.data;

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const result = await port.restoreStorageState(state);
    const out: StorageRestoreOut = { restored: result.restored, skipped: result.skipped };
    return ok(
      `storage state restored: ${result.restored.length} items, ${result.skipped.length} skipped`,
      out,
    );
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
