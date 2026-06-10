/**
 * Loader for mcp/prompts/*.md — LLM prompts kept as data, not code.
 *
 * Supports {{var}} substitution and a single conditional construct:
 * {{#if flag}}...{{/if}} blocks are kept (with the markers stripped) when the
 * flag is truthy and removed entirely when it is not.
 */
import { readFileSync } from "node:fs";

const promptCache = new Map<string, string>();

export function loadPrompt(name: string): string {
  let cached = promptCache.get(name);
  if (cached === undefined) {
    cached = readFileSync(new URL(`../../prompts/${name}.md`, import.meta.url), "utf8");
    promptCache.set(name, cached);
  }
  return cached;
}

export function renderPrompt(
  name: string,
  vars: Record<string, string>,
  flags: Record<string, boolean> = {},
): string {
  let text = loadPrompt(name);
  // Conditional blocks first.
  text = text.replace(
    /\{\{#if ([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, flag: string, body: string) => (flags[flag] ? body : ""),
  );
  // Simple variables.
  text = text.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`prompt ${name}: no value provided for {{${key}}}`);
    }
    return value;
  });
  return text;
}
