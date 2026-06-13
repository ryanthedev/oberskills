import { describe, expect, test } from "bun:test";
import * as connect from "../src/tools/connect.ts";
import * as tabs from "../src/tools/tabs.ts";

const MODULES = [connect, tabs];

describe("tool module shape mirrors mcp/ (DW-1.6)", () => {
  test("each module exports name/title/description/inputShape/handler", () => {
    for (const m of MODULES) {
      expect(typeof m.name).toBe("string");
      expect(m.name).toMatch(/^[a-z][a-z_]*$/); // snake_case tool name
      expect(typeof m.title).toBe("string");
      expect(typeof m.description).toBe("string");
      expect(typeof m.inputShape).toBe("object");
      expect(typeof m.handler).toBe("function");
    }
  });
});
