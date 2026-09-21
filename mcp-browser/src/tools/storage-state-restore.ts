/**
 * browser_storage_state_restore — restore cookies + localStorage + sessionStorage
 * from a state previously saved by browser_storage_state_save.
 *
 * Input: exactly one of
 *  - `path`       — the file save returned. The SERVER reads it, so the credentials
 *                   never pass through the conversation. Preferred.
 *  - `state_json` — the same state as a JSON string.
 *
 * Barricade:
 *  - neither / both inputs                         → storage_state_invalid
 *  - `path` not absolute, missing, not a regular file, unreadable, or over
 *    STORAGE_STATE_MAX_BYTES                       → storage_state_invalid
 *  - The state is external input either way: validated against StorageStateSchema
 *    (zod) before reaching the adapter. Malformed or schema-failing input →
 *    storage_state_invalid.
 *  - In `path` mode error messages NEVER echo file contents. A JSON.parse message
 *    embeds a snippet of its input, so it is withheld on that branch — otherwise
 *    pointing the tool at any readable file would leak it into the conversation.
 *  - All-or-nothing: the adapter clears existing state before restoring; on validation
 *    failure the existing state is NOT cleared.
 *  - Origin mismatch: cross-origin cookies are skipped with a diagnostic (not silently
 *    injected).
 */
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import {
  STORAGE_STATE_MAX_BYTES,
  StorageRestoreInputSchema,
  StorageStateSchema,
  type StorageRestoreOut,
} from "../types.ts";

export const name = "browser_storage_state_restore";
export const title = "Restore browser cookies + storage from a saved state (auth reuse)";
export const description =
  "Restores cookies, localStorage, and sessionStorage from a state previously saved by " +
  "browser_storage_state_save. Pass exactly one of path (the file path save returned — preferred: the server " +
  "reads the file, so the credentials never enter the conversation) or state_json (the state as a JSON string). " +
  "Validates the state with StorageStateSchema before applying it — malformed or wrong-origin state is rejected " +
  "with storage_state_invalid, as is a missing/unreadable path or passing both/neither input. " +
  "Returns { restored, skipped } lists. All-or-nothing: existing state is cleared before restore. Never throws.";

export const inputShape = StorageRestoreInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

function invalid(message: string, suggestion: string): ToolResult {
  return errFromBrowserError(new BrowserError("storage_state_invalid", message, suggestion));
}

/**
 * Read the state file at the barricade. Returns its text, or a ToolResult err.
 * Messages name the path and the failure kind only — never file contents.
 */
async function readStateFile(path: string): Promise<string | ToolResult> {
  const hint = "pass the path returned by browser_storage_state_save";
  if (!isAbsolute(path)) return invalid(`path must be absolute: ${path}`, hint);
  try {
    const info = await stat(path);
    if (!info.isFile()) return invalid(`path is not a regular file: ${path}`, hint);
    if (info.size > STORAGE_STATE_MAX_BYTES) {
      return invalid(`file is ${info.size} bytes, over the ${STORAGE_STATE_MAX_BYTES}-byte limit: ${path}`, hint);
    }
    return await readFile(path, "utf8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | undefined)?.code;
    const why = code === "ENOENT" ? "file not found" : `file could not be read (${code ?? "unknown error"})`;
    return invalid(`${why}: ${path}`, hint);
  }
}

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: exactly one input. Empty strings count as absent.
  const hasPath = typeof args.path === "string" && args.path.length > 0;
  const hasJson = typeof args.state_json === "string" && args.state_json.length > 0;
  if (hasPath === hasJson) {
    return invalid(
      hasPath ? "pass path or state_json, not both" : "one of path or state_json is required",
      "pass path= (the file browser_storage_state_save returned) or state_json=, exactly one",
    );
  }

  let raw: string;
  if (hasPath) {
    const read = await readStateFile(args.path as string);
    if (typeof read !== "string") return read;
    raw = read;
  } else {
    raw = args.state_json as string;
  }

  // Parse and validate — external input, never trusted.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    if (hasPath) {
      // Withhold e.message: it quotes the input, i.e. the file's contents.
      return invalid(
        `file is not valid JSON: ${args.path as string}`,
        "pass the unmodified file written by browser_storage_state_save",
      );
    }
    return invalid(
      `state_json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      "use the JSON written by browser_storage_state_save",
    );
  }

  const validation = StorageStateSchema.safeParse(parsed);
  if (!validation.success) {
    return errFromBrowserError(
      new BrowserError(
        "storage_state_invalid",
        `storage state failed validation: ${validation.error.issues.map((e) => e.message).join("; ")}`,
        "use the state written by browser_storage_state_save; do not modify the file",
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
