import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readVersion } from "../src/register.ts";

// Read from the manifest rather than hardcoding, so a release bump doesn't
// require touching this test.
const codexVersion = JSON.parse(
  readFileSync(new URL("../../.codex-plugin/plugin.json", import.meta.url), "utf8"),
).version as string;

const originalClaudePluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

afterEach(() => {
  if (originalClaudePluginRoot === undefined) {
    delete process.env.CLAUDE_PLUGIN_ROOT;
  } else {
    process.env.CLAUDE_PLUGIN_ROOT = originalClaudePluginRoot;
  }
});

describe("register manifest version", () => {
  test("falls back to the Codex plugin manifest outside Claude Code", () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;

    expect(readVersion()).toBe(codexVersion);
  });
});
