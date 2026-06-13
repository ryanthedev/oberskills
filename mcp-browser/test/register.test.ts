import { describe, expect, test } from "bun:test";
import { TOOLS, buildErrorBoundaryHandler } from "../src/register.ts";

describe("register (DW-1.1 / DW-1.6)", () => {
  test("all P1 tools are registered with valid shapes", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(["browser_connect", "browser_tabs"]);
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
