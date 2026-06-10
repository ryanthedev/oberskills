import { describe, expect, test } from "bun:test";
import { classifyProbeResult, type ProbeResultShape } from "../src/lib/trigger-probe.ts";
import { statusFromResult } from "../src/tools/run-eval.ts";
import { defaultGraderModel } from "../src/lib/agent.ts";

function shape(overrides: Partial<ProbeResultShape>): ProbeResultShape {
  return {
    timedOut: false,
    pluginLoaded: true,
    hasResult: true,
    isError: false,
    subtype: "success",
    triggered: false,
    streamError: null,
    ...overrides,
  };
}

describe("classifyProbeResult", () => {
  test("clean run with trigger -> triggered", () => {
    expect(classifyProbeResult(shape({ triggered: true })).outcome).toBe("triggered");
  });

  test("clean run without trigger -> not_triggered", () => {
    expect(classifyProbeResult(shape({})).outcome).toBe("not_triggered");
  });

  test("timeout -> infra_error", () => {
    const r = classifyProbeResult(shape({ timedOut: true }));
    expect(r.outcome).toBe("infra_error");
    expect(r.detail).toBe("probe timeout");
  });

  test("plugin missing from init -> infra_error", () => {
    expect(classifyProbeResult(shape({ pluginLoaded: false })).outcome).toBe("infra_error");
  });

  test("stream ended without result -> infra_error with stream detail", () => {
    const r = classifyProbeResult(shape({ hasResult: false, streamError: "socket closed" }));
    expect(r.outcome).toBe("infra_error");
    expect(r.detail).toBe("socket closed");
  });

  test("is_error with subtype success (live auth-failure signature) -> infra_error, never not_triggered", () => {
    const r = classifyProbeResult(shape({ isError: true, subtype: "success" }));
    expect(r.outcome).toBe("infra_error");
    expect(r.detail).toContain("success");
  });

  test("is_error with error_during_execution -> infra_error", () => {
    expect(classifyProbeResult(shape({ isError: true, subtype: "error_during_execution" })).outcome).toBe("infra_error");
  });

  test("bound exhaustion (max_turns / max_budget) ran but did not trigger -> not_triggered", () => {
    expect(classifyProbeResult(shape({ isError: true, subtype: "error_max_turns" })).outcome).toBe("not_triggered");
    expect(classifyProbeResult(shape({ isError: true, subtype: "error_max_budget_usd" })).outcome).toBe("not_triggered");
  });

  test("trigger observed before a later error still counts as triggered", () => {
    expect(classifyProbeResult(shape({ isError: true, subtype: "error_max_turns", triggered: true })).outcome).toBe(
      "triggered",
    );
    expect(classifyProbeResult(shape({ isError: true, subtype: "error_during_execution", triggered: true })).outcome).toBe(
      "triggered",
    );
  });
});

describe("statusFromResult (run_eval subject classification)", () => {
  test("timeout wins over everything", () => {
    expect(statusFromResult({ timedOut: true, subtype: "success", isError: false, hasResult: true })).toBe("timeout");
  });

  test("no result message -> infra_error", () => {
    expect(statusFromResult({ timedOut: false, subtype: null, isError: false, hasResult: false })).toBe("infra_error");
  });

  test("budget exhaustion -> budget_exceeded", () => {
    expect(statusFromResult({ timedOut: false, subtype: "error_max_budget_usd", isError: true, hasResult: true })).toBe(
      "budget_exceeded",
    );
  });

  test("clean success -> completed; error_max_turns still gradeable -> completed", () => {
    expect(statusFromResult({ timedOut: false, subtype: "success", isError: false, hasResult: true })).toBe("completed");
    expect(statusFromResult({ timedOut: false, subtype: "error_max_turns", isError: true, hasResult: true })).toBe("completed");
  });

  test("is_error with subtype success (auth-failure signature) -> infra_error, not completed", () => {
    expect(statusFromResult({ timedOut: false, subtype: "success", isError: true, hasResult: true })).toBe("infra_error");
  });

  test("error_during_execution -> infra_error", () => {
    expect(statusFromResult({ timedOut: false, subtype: "error_during_execution", isError: true, hasResult: true })).toBe(
      "infra_error",
    );
  });
});

describe("defaultGraderModel tiering (one tier below the subject)", () => {
  test("alias tiers", () => {
    expect(defaultGraderModel("fable")).toBe("opus");
    expect(defaultGraderModel("opus")).toBe("sonnet");
    expect(defaultGraderModel("sonnet")).toBe("haiku");
    expect(defaultGraderModel("haiku")).toBe("haiku");
  });

  test("full model ids match by inclusion", () => {
    expect(defaultGraderModel("claude-opus-4-6")).toBe("sonnet");
    expect(defaultGraderModel("claude-sonnet-4-5")).toBe("haiku");
  });

  test("unknown models fall back to haiku", () => {
    expect(defaultGraderModel("some-custom-model")).toBe("haiku");
  });
});
