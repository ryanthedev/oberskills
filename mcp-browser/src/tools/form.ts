/**
 * browser_form — reads the current state of a form element (value, checked, selectedOptions).
 * Selector matching nothing returns read_failed, not an empty/null result.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { isBrowserError } from "../core/errors.ts";
import { FormInputSchema, type FormOut } from "../types.ts";

export const name = "browser_form";
export const title = "Read a form element's current state";
export const description =
  "Reads the current value, checked state, and selectedOptions of a form element " +
  "(input, textarea, select, checkbox, radio) located by CSS selector. " +
  "Returns read_failed when the selector matches nothing.";

export const inputShape = FormInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let state: import("../core/browser-port.ts").FormFieldState;
    try {
      state = await port.readForm(args.selector);
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    const out: FormOut = {
      value: state.value,
      checked: state.checked,
      selected_options: state.selectedOptions,
    };
    return ok(`form ${args.selector} → value=${JSON.stringify(state.value)} checked=${JSON.stringify(state.checked)}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
