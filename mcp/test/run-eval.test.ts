import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composePrompt, loadEvalsFile } from "../src/tools/run-eval.ts";
import { splitEvalSet } from "../src/tools/optimize-description.ts";
import type { TriggerQuery } from "../src/types.ts";

const base = mkdtempSync(join(tmpdir(), "runeval-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("composePrompt", () => {
  test("non-pressure evals pass through unchanged", () => {
    expect(composePrompt({ id: "e", prompt: "Do the task.", files: [], expectations: [] })).toBe("Do the task.");
  });

  test("fewer than 3 pressure blocks is rejected in code", () => {
    expect(() =>
      composePrompt({
        id: "e",
        prompt: "Do it.",
        files: [],
        expectations: [],
        pressure_blocks: ["TIME", "AUTHORITY"],
      }),
    ).toThrow(/at least 3/);
  });

  test("3+ blocks compose deterministically from the data file", () => {
    const p = composePrompt({
      id: "e",
      prompt: "Do it.",
      files: [],
      expectations: [],
      pressure_blocks: ["TIME", "AUTHORITY", "SIMPLICITY"],
    });
    expect(p).toStartWith("Do it.\n\nContext: ");
    expect(p).toContain("Production is down.");
    expect(p).toContain("The CTO reviewed this");
    expect(p).toContain("Don't overthink it.");
  });
});

describe("loadEvalsFile", () => {
  test("house schema loads with optional expected_output", () => {
    const path = join(base, "house.json");
    writeFileSync(
      path,
      JSON.stringify({
        skill_name: "foo",
        evals: [{ id: "one", prompt: "p", files: [], expectations: ["did x"] }],
      }),
    );
    const loaded = loadEvalsFile(path, "fallback");
    expect(loaded.skill_name).toBe("foo");
    expect(loaded.evals[0]?.expected_output).toBeUndefined();
  });

  test("official Anthropic array shape is normalized", () => {
    const path = join(base, "official.json");
    writeFileSync(
      path,
      JSON.stringify([
        { skills: ["foo"], query: "Please do x", files: ["fixture.csv"], expected_behavior: ["x happened"] },
      ]),
    );
    const loaded = loadEvalsFile(path, "foo");
    expect(loaded.skill_name).toBe("foo");
    expect(loaded.evals[0]).toMatchObject({
      id: "eval-1",
      prompt: "Please do x",
      files: ["fixture.csv"],
      expectations: ["x happened"],
    });
  });
});

describe("splitEvalSet (60/40 stratified, seeded)", () => {
  const queries: TriggerQuery[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ query: `pos ${i}`, should_trigger: true })),
    ...Array.from({ length: 10 }, (_, i) => ({ query: `neg ${i}`, should_trigger: false })),
  ];

  test("stratified sizes: 12 train / 8 test at holdout 0.4", () => {
    const { train, test: heldOut } = splitEvalSet(queries, 0.4);
    expect(train).toHaveLength(12);
    expect(heldOut).toHaveLength(8);
    expect(heldOut.filter((q) => q.should_trigger)).toHaveLength(4);
    expect(train.filter((q) => q.should_trigger)).toHaveLength(6);
  });

  test("deterministic across calls (seed 42)", () => {
    const a = splitEvalSet(queries, 0.4);
    const b = splitEvalSet(queries, 0.4);
    expect(a.train.map((q) => q.query)).toEqual(b.train.map((q) => q.query));
    expect(a.test.map((q) => q.query)).toEqual(b.test.map((q) => q.query));
  });
});
