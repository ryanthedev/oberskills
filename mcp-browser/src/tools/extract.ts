/**
 * browser_extract — extracts structured fields from repeated container elements.
 * Supports optional named child-selector mapping; default = textContent per container.
 * Large JSON result written to /tmp via writePayload.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { writePayload } from "../lib/payload.ts";
import { isBrowserError } from "../core/errors.ts";
import { ExtractInputSchema, type ExtractOut } from "../types.ts";

export const name = "browser_extract";
export const title = "Extract structured fields from repeated elements";
export const description =
  "Selects container elements and extracts named child fields as structured JSON. " +
  'Pass fields as "name:selector,price:.price" comma-separated pairs. ' +
  "Absent fields = textContent of each container. " +
  "Result written to /tmp when large. Returns read_failed when selector matches nothing.";

export const inputShape = ExtractInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

/** Parse "name:selector,price:.price" into field definitions. */
function parseFields(fieldsStr: string): { name: string; selector: string }[] {
  return fieldsStr.split(",").map((entry) => {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) {
      const trimmed = entry.trim();
      return { name: trimmed, selector: trimmed };
    }
    return {
      name: entry.slice(0, colonIdx).trim(),
      selector: entry.slice(colonIdx + 1).trim(),
    };
  });
}

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const fields = args.fields ? parseFields(args.fields) : undefined;

    let results: unknown[];
    try {
      results = await port.extract({
        selector: args.selector,
        fields,
        pierce: args.pierce,
      });
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    const json = JSON.stringify(results, null, 2);
    const written = await writePayload(json, { ext: "json" });
    const out: ExtractOut = {
      path: written.path,
      bytes: written.bytes,
      written: written.written,
      count: results.length,
    };

    if (written.written) {
      return ok(`extract → ${written.path} (${results.length} items, ${written.bytes} bytes)`, out);
    }
    return ok(`extract → inlined (${results.length} items)`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
