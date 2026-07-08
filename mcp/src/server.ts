#!/usr/bin/env bun
/**
 * skill-eval — stdio MCP server entry point.
 *
 * This file stays dependency-free: it dynamically imports the registrar so
 * that a half-installed plugin fails with a clear, actionable stderr message and a
 * non-zero exit instead of a raw module-resolution stack trace.
 *
 * No console.log anywhere — stdout is the JSON-RPC transport.
 */

async function main(): Promise<void> {
  let registrar: typeof import("./register.ts");
  try {
    registrar = await import("./register.ts");
  } catch (e) {
    console.error(
      "[skill-eval] dependencies not installed yet. Claude Code: run /reload-plugins after the SessionStart hook completes. " +
        "Codex/local: start through scripts/start-skill-eval-mcp.sh to auto-install, or run `bun install` in the plugin's mcp/ directory. Underlying error: " +
        (e instanceof Error ? e.message : String(e)),
    );
    process.exit(1);
  }
  await registrar.startServer();
}

main().catch((e: unknown) => {
  console.error("[skill-eval] fatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
