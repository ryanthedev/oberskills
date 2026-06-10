import { describe, expect, test } from "bun:test";
import type { PoolOutcome } from "../src/lib/pool.ts";
import { scoreTriggerSet, type ProbeTaskOutcome } from "../src/lib/trigger-set.ts";
import type { TriggerQuery } from "../src/types.ts";

type Outcome = PoolOutcome<ProbeTaskOutcome>;

function done(queryIndex: number, outcome: ProbeTaskOutcome["outcome"]): Outcome {
  return { status: "done", value: { queryIndex, outcome } };
}

const POS: TriggerQuery = { query: "please do the thing", should_trigger: true };
const NEG: TriggerQuery = { query: "unrelated request", should_trigger: false };

describe("scoreTriggerSet", () => {
  test("threshold edge: positive query passes at trigger_rate EXACTLY the threshold", () => {
    // 1 of 2 scored runs triggered = rate 0.5 at threshold 0.5
    const { results, summary } = scoreTriggerSet({
      queries: [POS],
      outcomes: [done(0, "triggered"), done(0, "not_triggered")],
      taskQueryIndex: [0, 0],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.trigger_rate).toBe(0.5);
    expect(results[0]?.pass).toBe(true);
    expect(summary).toEqual({ total: 1, passed: 1, failed: 0, infra_errors: 0 });
  });

  test("threshold edge: negative query FAILS at trigger_rate exactly the threshold (must stay below)", () => {
    const { results } = scoreTriggerSet({
      queries: [NEG],
      outcomes: [done(0, "triggered"), done(0, "not_triggered")],
      taskQueryIndex: [0, 0],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.trigger_rate).toBe(0.5);
    expect(results[0]?.pass).toBe(false);
  });

  test("negative query passes just below the threshold", () => {
    const { results } = scoreTriggerSet({
      queries: [NEG],
      outcomes: [done(0, "triggered"), done(0, "not_triggered"), done(0, "not_triggered")],
      taskQueryIndex: [0, 0, 0],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.trigger_rate).toBeCloseTo(0.3333, 3);
    expect(results[0]?.pass).toBe(true);
  });

  test("all-infra query gets pass: null and is excluded from passed/failed counts", () => {
    const { results, summary } = scoreTriggerSet({
      queries: [POS, { ...POS, query: "second positive" }],
      outcomes: [done(0, "infra_error"), done(0, "infra_error"), done(1, "triggered"), done(1, "triggered")],
      taskQueryIndex: [0, 0, 1, 1],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.pass).toBeNull();
    expect(results[1]?.pass).toBe(true);
    // total counts all queries; passed+failed only counts scoreable ones
    expect(summary).toEqual({ total: 2, passed: 1, failed: 0, infra_errors: 2 });
  });

  test("budget-skipped slots are not counted as runs; fully skipped query is pass: null", () => {
    const { results, summary } = scoreTriggerSet({
      queries: [POS],
      outcomes: [{ status: "skipped" }, { status: "skipped" }],
      taskQueryIndex: [0, 0],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.runs).toBe(0);
    expect(results[0]?.pass).toBeNull();
    expect(summary.passed + summary.failed).toBe(0);
  });

  test("a thrown task (typed pool failure) is an infra_error run, never 'did not trigger'", () => {
    const { results, summary } = scoreTriggerSet({
      queries: [POS],
      outcomes: [done(0, "triggered"), { status: "failed", error: "spawn ENOENT" }],
      taskQueryIndex: [0, 0],
      triggerThreshold: 0.5,
    });
    expect(results[0]?.infra_errors).toBe(1);
    expect(results[0]?.runs).toBe(2);
    // 1 scored run, 1 trigger -> rate 1.0, passes; the failure didn't dilute the rate
    expect(results[0]?.trigger_rate).toBe(1);
    expect(results[0]?.pass).toBe(true);
    expect(summary.infra_errors).toBe(1);
  });

  test("infra errors never dilute the trigger rate of remaining scored runs", () => {
    const { results } = scoreTriggerSet({
      queries: [POS],
      outcomes: [done(0, "infra_error"), done(0, "triggered")],
      taskQueryIndex: [0, 0],
      triggerThreshold: 1,
    });
    // 1 scored run, 1 trigger -> rate 1.0 even at threshold 1
    expect(results[0]?.pass).toBe(true);
  });
});
