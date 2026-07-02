/**
 * browser_evaluate — execute arbitrary JS in the page context.
 * Auto-injects querySelectorDeep / querySelectorAllDeep via buildEvaluateExpression.
 * Page-side throws surface as evaluate_failed (structured err, not a crash).
 * The expression is NEVER eval'd in the Node process — it's passed to page.evaluate.
 *
 * The result routes through writePayload (the dom.ts idiom): below threshold the
 * result is inlined; at/above threshold it spills to /tmp (path + tool-sliced
 * preview). A non-serializable/cyclic result NEVER leaks the raw object — the
 * "[non-serializable value]" descriptor string is inlined instead.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { isBrowserError } from "../core/errors.ts";
import { buildEvaluateExpression } from "../lib/dom-helpers.ts";
import { writePayload } from "../lib/payload.ts";
import { EvaluateInputSchema, type EvaluateOut } from "../types.ts";

/** Chars of the serialized result to show in the spilled-branch preview. */
const PREVIEW_CHARS = 512;

export const name = "browser_evaluate";
export const title = "Execute JavaScript in the page context";
export const description =
  "Runs arbitrary JavaScript in the active page's browser context (NOT in the server process). " +
  "querySelectorDeep and querySelectorAllDeep are auto-injected for shadow DOM access. " +
  "Page-side throws return evaluate_failed; cyclic/non-serializable values are handled. " +
  "Use for computed values, DOM queries, or shadow DOM traversal the snapshot model can't reach.";

export const inputShape = EvaluateInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    // Inject helpers once via the shared constant — never duplicate the strings.
    const wrapped = buildEvaluateExpression(args.expression);

    let result: unknown;
    try {
      result = await port.evaluate(wrapped);
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }

    // Handle non-serializable or undefined return values gracefully.
    let serialized: string;
    let resultForOutput: unknown;
    if (result === undefined || result === null) {
      serialized = "null";
      resultForOutput = null;
    } else {
      try {
        serialized = JSON.stringify(result);
        resultForOutput = result;
      } catch {
        // Cyclic or otherwise non-serializable — surface as a safe descriptor,
        // NEVER the raw object (it would also fail JSON serialization at the
        // MCP transport).
        serialized = "[non-serializable value]";
        resultForOutput = serialized;
      }
    }

    const written = await writePayload(serialized, { ext: "json" });
    const out: EvaluateOut = {
      bytes: written.bytes,
      written: written.written,
      ...(written.written
        ? { result_path: written.path, preview: serialized.slice(0, PREVIEW_CHARS) }
        : { result: resultForOutput }),
    };
    return ok(`evaluate → ${serialized.slice(0, 256)}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
