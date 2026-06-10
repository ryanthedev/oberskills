import { describe, expect, test } from "bun:test";
import { runPool, type PoolOutcome } from "../src/lib/pool.ts";

function values<T>(outcomes: PoolOutcome<T>[]): (T | null)[] {
  return outcomes.map((o) => (o.status === "done" ? o.value : null));
}

describe("runPool", () => {
  test("results come back in submission order regardless of completion order", async () => {
    const tasks = [
      async () => {
        await Bun.sleep(30);
        return "slow";
      },
      async () => "fast",
      async () => {
        await Bun.sleep(10);
        return "medium";
      },
    ];
    const out = await runPool(tasks, 3);
    expect(values(out)).toEqual(["slow", "fast", "medium"]);
  });

  test("never exceeds the concurrency bound", async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, (_, i) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Bun.sleep(5);
      inFlight -= 1;
      return i;
    });
    const out = await runPool(tasks, 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(values(out)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  test("shouldStop skips remaining tasks as typed skipped outcomes", async () => {
    let stop = false;
    let launched = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      launched += 1;
      if (i === 1) stop = true;
      return i;
    });
    const out = await runPool(tasks, 1, () => stop);
    expect(launched).toBe(2);
    expect(out[0]).toEqual({ status: "done", value: 0 });
    expect(out[1]).toEqual({ status: "done", value: 1 });
    for (const o of out.slice(2)) expect(o).toEqual({ status: "skipped" });
  });

  test("a thrown task becomes a typed failure for that slot — pool never rejects", async () => {
    const tasks = [
      async () => "ok-1",
      async () => {
        throw new Error("boom");
      },
      async () => "ok-2",
    ];
    const out = await runPool(tasks, 2);
    expect(out[0]).toEqual({ status: "done", value: "ok-1" });
    expect(out[1]).toEqual({ status: "failed", error: "boom" });
    expect(out[2]).toEqual({ status: "done", value: "ok-2" });
  });

  test("siblings run to completion even when an earlier task throws (no cleanup race)", async () => {
    let lateFinished = false;
    const tasks = [
      async () => {
        throw new Error("early failure");
      },
      async () => {
        await Bun.sleep(25);
        lateFinished = true;
        return "late";
      },
    ];
    const out = await runPool(tasks, 2);
    expect(out[0]?.status).toBe("failed");
    expect(out[1]).toEqual({ status: "done", value: "late" });
    expect(lateFinished).toBe(true);
  });

  test("non-Error throws are stringified", async () => {
    const out = await runPool([async () => Promise.reject("plain string")], 1);
    expect(out[0]).toEqual({ status: "failed", error: "plain string" });
  });
});
