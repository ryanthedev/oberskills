/**
 * Shared tool-handler result helpers (penman pattern): every handler returns
 * ok()/err() and is wrapped in try/catch by the registrar. friendlyMessage
 * whitelists what it echoes — never raw env, never unbounded child stderr.
 *
 * err()'s optional {code, suggestion} envelope mirrors mcp-browser's
 * BrowserErrorShape ({code, message, suggestion}): when supplied it is emitted
 * as structuredContent alongside the unchanged text, so callers get a
 * machine-readable code and a concrete next step without losing the plain-text
 * message. The type requires suggestion whenever code is given — it is
 * structurally impossible to pass one without the other.
 */
import type { z } from "zod";
import type { ErrorCode } from "../types.ts";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Typed contract every tool module satisfies: the handler's input is derived
 * from the module's own zod inputShape (z.output applies defaults), so a
 * wrong-shaped handler fails to compile — both at the module's `satisfies`
 * check and at register.ts's defineTool call. No as-unknown/as-never casts.
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

/** Concrete next step for the caller — always populated, never empty, whenever a code is given. */
export type ErrorEnvelope = { code: ErrorCode; suggestion: string };

export function err(text: string, envelope?: ErrorEnvelope): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text }],
    ...(envelope ? { structuredContent: { code: envelope.code, message: text, suggestion: envelope.suggestion } } : {}),
  };
}

export function friendlyMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 2048);
  return String(e).slice(0, 2048);
}
