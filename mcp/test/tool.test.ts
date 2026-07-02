/**
 * err()'s optional {code, suggestion} structured envelope (mirrors mcp-browser's
 * BrowserErrorShape). Covers the helper itself (DW-2.1) and the three named
 * failure call sites the plan requires at minimum (DW-2.2): skill-path-missing,
 * unknown-eval-id, query-generation-failed.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { err, ok } from "../src/lib/tool.ts";
// Snapshot the real module BEFORE any mock.module call below so it can be
// restored afterward — trigger-set.test.ts (loaded later, alphabetically)
// imports the real generateTriggerQueries/scoreTriggerSet directly and would
// break if this file's mock leaked past its own tests.
import * as realTriggerSet from "../src/lib/trigger-set.ts";

const fixtureSkillPath = new URL("./fixtures/pirate-voice", import.meta.url).pathname;

afterAll(() => {
  mock.module("../src/lib/trigger-set.ts", () => realTriggerSet);
});

describe("err()", () => {
  test("err(text) alone stays plain: isError true, no structuredContent", () => {
    const result = err("something broke");
    expect(result).toEqual({ isError: true, content: [{ type: "text", text: "something broke" }] });
    expect(result.structuredContent).toBeUndefined();
  });

  test("err(text, {code, suggestion}) attaches structuredContent {code, message, suggestion}", () => {
    const result = err("skill_path does not exist: /nope", {
      code: "skill_path_missing",
      suggestion: "Pass an existing skill directory path in skill_path.",
    });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "skill_path does not exist: /nope" }]);
    expect(result.structuredContent).toEqual({
      code: "skill_path_missing",
      message: "skill_path does not exist: /nope",
      suggestion: "Pass an existing skill directory path in skill_path.",
    });
  });

  test("ok() is unaffected by the err() change: no structuredContent when none is passed", () => {
    const result = ok("done");
    expect(result).toEqual({ content: [{ type: "text", text: "done" }] });
  });
});

describe("named failure paths carry a structured code + suggestion (DW-2.2)", () => {
  test("skill-path-missing: run_eval rejects a nonexistent skill_path", async () => {
    const { handler, inputShape } = await import("../src/tools/run-eval.ts");
    const args = z.object(inputShape).parse({
      skill_path: "/definitely/does/not/exist",
      evals_path: "/also/does/not/exist.json",
      eval_id: "whatever",
    });
    const result = await handler(args);
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.code).toBe("skill_path_missing");
    expect(typeof result.structuredContent?.suggestion).toBe("string");
    expect(result.structuredContent?.suggestion).not.toBe("");
  });

  test("unknown-eval-id: run_eval rejects an eval_id absent from the evals file", async () => {
    const base = mkdtempSync(join(tmpdir(), "tool-test-"));
    const evalsPath = join(base, "evals.json");
    writeFileSync(
      evalsPath,
      JSON.stringify({
        skill_name: "pirate-voice",
        evals: [{ id: "known-eval", prompt: "do the thing", files: [], expectations: ["did the thing"] }],
      }),
    );
    const { handler, inputShape } = await import("../src/tools/run-eval.ts");
    const args = z.object(inputShape).parse({
      skill_path: fixtureSkillPath,
      evals_path: evalsPath,
      eval_id: "no-such-eval",
    });
    const result = await handler(args);
    rmSync(base, { recursive: true, force: true });
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.code).toBe("unknown_eval_id");
    expect(result.structuredContent?.suggestion).not.toBe("");
    // The message names the offending id so the caller can self-correct.
    expect(result.content[0]?.text).toContain("no-such-eval");
  });

  test("query-generation-failed: test_triggers surfaces a structured code when generation fails", async () => {
    // generateTriggerQueries drives a real Agent SDK call; mock it so the
    // failure branch is reachable without a live network call (unit-test
    // budget, matching the RUN_LIVE_EVALS gate on smoke.live.test.ts).
    mock.module("../src/lib/trigger-set.ts", () => ({
      generateTriggerQueries: async () => ({ queries: null, error: "synthetic failure for test" }),
      runTriggerSet: async () => {
        throw new Error("runTriggerSet must not be reached on the query_generation_failed path");
      },
    }));
    const { handler, inputShape } = await import("../src/tools/test-triggers.ts");
    const args = z.object(inputShape).parse({ skill_path: fixtureSkillPath });
    const result = await handler(args);
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.code).toBe("query_generation_failed");
    expect(result.structuredContent?.suggestion).not.toBe("");
    expect(result.content[0]?.text).toContain("synthetic failure for test");
  });
});
