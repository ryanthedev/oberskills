import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);

function readJson(path: string): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync(new URL(path, root), "utf8"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  return raw as Record<string, unknown>;
}

describe("Codex plugin manifest", () => {
  test(".codex-plugin/plugin.json contains required Codex packaging fields", () => {
    const manifest = readJson(".codex-plugin/plugin.json");

    expect(manifest.name).toBe("oberskills");
    // Version is not hardcoded here: the Codex manifest must stay in lockstep
    // with the Claude manifest, which CLAUDE.md designates the single source.
    expect(manifest.version).toBe(readJson(".claude-plugin/plugin.json").version);
    expect(manifest.description).toEqual(expect.any(String));
    expect(manifest.author).toMatchObject({ name: "r" });
    expect(manifest.hooks).toBeUndefined();
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(manifest.interface).toMatchObject({
      displayName: "oberskills",
      shortDescription: "Workflow skills for Codex",
      developerName: "r",
      category: "Productivity",
    });
  });

  test(".mcp.json uses the validator-accepted mcpServers envelope", () => {
    const mcp = readJson(".mcp.json");
    expect(Object.keys(mcp)).toEqual(["mcpServers"]);

    const servers = mcp.mcpServers as Record<string, { command?: string; args?: string[] }>;
    expect(Object.keys(servers).sort()).toEqual(["mcp-browser", "skill-eval"]);
    for (const [name, server] of Object.entries(servers)) {
      expect(server.command).toBe("bash");
      expect(server.args).toHaveLength(1);
      expect(server.args?.[0]).toMatch(/^\.\/scripts\/start-.*-mcp\.sh$/);
      expect(server.args?.[0]).toContain(name === "skill-eval" ? "skill-eval" : "browser");
    }
  });

  test("repo checkout does not ship an invalid repo-local marketplace", () => {
    expect(existsSync(new URL(".agents/plugins/marketplace.json", root))).toBe(false);
  });

  test("README documents the explicit Codex local marketplace layout", () => {
    const readme = readFileSync(new URL("README.md", root), "utf8");

    expect(readme).toContain("codex plugin marketplace add <path-to-marketplace-root>");
    expect(readme).toContain("./plugins/oberskills");
    expect(readme).not.toContain(".agents/plugins/marketplace.json");
  });
});
