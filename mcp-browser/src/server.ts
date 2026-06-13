#!/usr/bin/env bun
/**
 * mcp-browser — stdio MCP server entry point.
 *
 * This file stays dependency-free: it dynamically imports the registrar so that a
 * half-installed plugin (the SessionStart dependency hook hasn't run or hasn't
 * finished) fails with a clear, actionable stderr message and a non-zero exit
 * instead of a raw module-resolution stack trace.
 *
 * No console.log anywhere — stdout is the JSON-RPC transport. This is the only
 * file that calls console.error directly (the logger isn't loaded yet).
 */

async function main(): Promise<void> {
  let registrar: typeof import("./register.ts");
  try {
    registrar = await import("./register.ts");
  } catch (e) {
    console.error(
      "[browser] dependencies not installed yet — run /reload-plugins after the SessionStart hook completes " +
        "(or run `bun install` in the plugin's mcp-browser/ directory). Underlying error: " +
        (e instanceof Error ? e.message : String(e)),
    );
    process.exit(1);
  }
  await registrar.startServer();
}

main().catch((e: unknown) => {
  console.error("[browser] fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
