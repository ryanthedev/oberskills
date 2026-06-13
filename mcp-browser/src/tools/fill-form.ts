/**
 * browser_fill_form — driving adapter. Folds each flat field into a core Target
 * + value and routes the batch through port.fillForm. Each field resolves through
 * the same Strategy; a bad field surfaces its structured error.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, err, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { FillFormInputSchema, toTarget } from "../types.ts";
import type { FillFormField } from "../core/targeting.ts";

export const name = "browser_fill_form";
export const title = "Fill several form fields in one call";
export const description =
  "Fills multiple form fields in one call. Each field is a target (ref primary; selector or x/y fallback) plus the " +
  "value to set, resolved through the same targeting Strategy as browser_type. A stale/unknown/ambiguous field " +
  "surfaces its structured error. Never throws.";

export const inputShape = FillFormInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const fields: FillFormField[] = [];
  for (const f of args.fields) {
    const target = toTarget(f);
    if (!target) return err("each fill_form field needs a target: ref, selector, or x/y", { code: "no_match" });
    fields.push({ target, value: f.value });
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.fillForm(fields);
    return ok(`filled ${fields.length} field(s)`);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
