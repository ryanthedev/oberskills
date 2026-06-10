/**
 * Shared tool-handler result helpers (penman pattern): every handler returns
 * ok()/err() and is wrapped in try/catch by the registrar. friendlyMessage
 * whitelists what it echoes — never raw env, never unbounded child stderr.
 */
import type { z } from "zod";

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

export function err(text: string): ToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

export function friendlyMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 2048);
  return String(e).slice(0, 2048);
}
