import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const manifestPath = new URL("../../.claude-plugin/plugin.json", import.meta.url).pathname;
const codexManifestPath = new URL("../../.codex-plugin/plugin.json", import.meta.url).pathname;
const mcpManifestPath = new URL("../../.mcp.json", import.meta.url).pathname;

function manifest(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error("manifest not an object");
  return raw as Record<string, unknown>;
}

function codexManifest(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(codexManifestPath, "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error("Codex manifest not an object");
  return raw as Record<string, unknown>;
}

function mcpManifest(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(mcpManifestPath, "utf8"));
  if (typeof raw !== "object" || raw === null) throw new Error("MCP manifest not an object");
  return raw as Record<string, unknown>;
}

describe("plugin.json wiring (DW-1.7)", () => {
  test("plugin.json is valid JSON", () => {
    expect(() => manifest()).not.toThrow();
  });

  test("a mcp-browser mcpServers entry points at bun run …/mcp-browser/src/server.ts", () => {
    const m = manifest();
    const servers = m.mcpServers as Record<string, { command?: string; args?: string[] }>;
    expect(servers["skill-eval"]).toBeDefined(); // existing server preserved
    const browser = servers["mcp-browser"];
    expect(browser).toBeDefined();
    expect(browser?.command).toBe("bun");
    expect((browser?.args ?? []).join(" ")).toContain("${CLAUDE_PLUGIN_ROOT}/mcp-browser/src/server.ts");
    expect((browser?.args ?? [])[0]).toBe("run");
  });

  test("SessionStart hook installs mcp-browser deps (mirrors the existing one)", () => {
    const m = manifest();
    const hooks = m.hooks as { SessionStart?: { hooks: { command: string }[] }[] };
    const commands = (hooks.SessionStart ?? []).flatMap((g) => g.hooks.map((h) => h.command));
    const joined = commands.join("\n");
    expect(joined).toContain("/mcp-browser/package.json");
    expect(joined).toContain("/mcp-browser/node_modules");
  });

  test("Codex manifest delegates MCP wiring to .mcp.json", () => {
    const m = codexManifest();
    expect(m.skills).toBe("./skills/");
    expect(m.mcpServers).toBe("./.mcp.json");
    expect(m.hooks).toBeUndefined();
  });

  test(".mcp.json contains both wrapper-launched server entries", () => {
    const m = mcpManifest();
    const servers = (m.mcpServers ?? {}) as Record<string, { command?: string; args?: string[] }>;
    expect(Object.keys(servers).sort()).toEqual(["mcp-browser", "skill-eval"]);
    expect(servers["skill-eval"]).toEqual({
      command: "bash",
      args: ["./scripts/start-skill-eval-mcp.sh"],
    });
    expect(servers["mcp-browser"]).toEqual({
      command: "bash",
      args: ["./scripts/start-browser-mcp.sh"],
    });
  });
});
