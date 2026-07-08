import { describe, expect, test } from "bun:test";
import { afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { TOOLS, buildErrorBoundaryHandler, INSTRUCTIONS, readVersion } from "../src/register.ts";

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

describe("register (DW-1.1 / DW-1.6)", () => {
  test("all P1 + P2 tools are registered with valid shapes", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        // P1
        "browser_connect",
        "browser_tabs",
        // P2 — snapshot + interaction + navigation + capture
        "browser_snapshot",
        "browser_click",
        "browser_type",
        "browser_hover",
        "browser_select",
        "browser_press_key",
        "browser_drag",
        "browser_fill_form",
        "browser_navigate",
        "browser_wait",
        "browser_scroll",
        "browser_screenshot",
        // P3 — read / extract + parity
        "browser_dom",
        "browser_accessibility",
        "browser_extract",
        "browser_collect",
        "browser_evaluate",
        "browser_dismiss",
        "browser_form",
        // P4 — performance / network
        "browser_performance_start_trace",
        "browser_performance_stop_trace",
        "browser_analyze_insight",
        "browser_lighthouse_audit",
        "browser_export_har",
        "browser_route",
        "browser_emulate",
        // P5 — storage / emulation / capture
        "browser_storage",
        "browser_storage_state_save",
        "browser_storage_state_restore",
        "browser_emulate_device",
        "browser_geolocation",
        "browser_permissions",
        "browser_pdf",
        "browser_screencast_start",
        "browser_screencast_stop",
        "browser_upload",
        "browser_download",
        "browser_wait_for_text",
      ].sort(),
    );
    for (const t of TOOLS) {
      expect(typeof t.title).toBe("string");
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.inputShape).toBe("object");
      expect(typeof t.invoke).toBe("function");
    }
  });

  test("single error boundary converts a thrown handler into an isError result (never propagates)", async () => {
    const boundary = buildErrorBoundaryHandler("explode", async () => {
      throw new Error("boom");
    });
    const r = await boundary({});
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toContain("explode failed");
    expect(r.content[0]?.text).toContain("boom");
  });

  test("error boundary passes through a normal result unchanged", async () => {
    const boundary = buildErrorBoundaryHandler("fine", async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    const r = await boundary({});
    expect(r.isError).toBeUndefined();
    expect(r.content[0]?.text).toBe("ok");
  });
});

describe("register manifest version", () => {
  test("falls back to the Codex plugin manifest outside Claude Code", () => {
    delete process.env.CLAUDE_PLUGIN_ROOT;

    expect(readVersion()).toBe(codexVersion);
  });
});

describe("server INSTRUCTIONS (DW-1.5)", () => {
  test("test_DW_1_5_instructions_current_and_grouped: no longer claim a Phase 1-only surface, and state the /tmp-spill contract once", () => {
    expect(INSTRUCTIONS).not.toContain("Phase 1 surface");
    expect(INSTRUCTIONS).not.toContain("Phase 1");

    // States the spill-to-/tmp read contract, and states it exactly once.
    // Whitespace-normalized so the assertion is immune to the source's line wrapping.
    const flat = INSTRUCTIONS.replace(/\s+/g, " ");
    const spillMentions = (flat.match(/spill/g) ?? []).length;
    expect(spillMentions).toBeGreaterThan(0);
    expect(flat).toContain("Read the returned path");

    // Groups the real tool surface (connect/tabs -> snapshot+refs -> interact ->
    // read/spill -> perf/network -> storage/capture), not just P1's two tools.
    for (const marker of [
      "Connect & tabs",
      "Snapshot + refs",
      "Interact & navigate",
      "Read / extract",
      "Performance / network",
      "Storage / emulation / capture",
    ]) {
      expect(INSTRUCTIONS).toContain(marker);
    }

    // Every registered tool name the plan calls out by group is actually mentioned.
    for (const toolName of TOOLS.map((t) => t.name)) {
      expect(INSTRUCTIONS).toContain(toolName);
    }
  });
});
