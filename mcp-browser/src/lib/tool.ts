/**
 * Shared tool-handler result helpers (mirrors mcp/src/lib/tool.ts): every handler
 * returns ok()/err() and is wrapped in a single try/catch by the registrar.
 * friendlyMessage whitelists what it echoes — never raw env, never unbounded
 * child stderr.
 */
import type { z } from "zod";
import { isBrowserError, type BrowserError } from "../core/errors.ts";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Typed contract every tool module satisfies: the handler's input is derived from
 * the module's own zod inputShape (z.output applies defaults), so a wrong-shaped
 * handler fails to compile — both at the module's `satisfies` check and at
 * register.ts's defineTool call. No as-unknown/as-never casts.
 */
export type ToolModule<Shape extends z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  inputShape: Shape;
  handler: (args: z.output<z.ZodObject<Shape>>) => Promise<ToolResult>;
};

export function ok(text: string, structured?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function err(text: string, structured?: Record<string, unknown>): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/**
 * Convert a BrowserError to an err() result with its {code,message,suggestion}
 * envelope as structuredContent — the single place a structured browser failure
 * becomes a tool result. Keeps every tool's failure path identical.
 */
export function errFromBrowserError(e: BrowserError): ToolResult {
  return err(e.toText(), e.toShape());
}

export function friendlyMessage(e: unknown): string {
  if (isBrowserError(e)) return e.toText();
  if (e instanceof Error) return e.message.slice(0, 2048);
  return String(e).slice(0, 2048);
}
