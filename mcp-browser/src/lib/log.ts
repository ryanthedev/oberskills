/**
 * stderr-only logger. stdout IS the JSON-RPC transport on a stdio MCP server —
 * console.log anywhere in src/ corrupts it (a static-scan test enforces this).
 */
export function log(...args: unknown[]): void {
  console.error("[browser]", ...args);
}
