import { describe, expect, test } from "bun:test";
import { calculateStats, delta, round4 } from "../src/lib/stats.ts";

describe("calculateStats", () => {
  test("known values: sample stddev uses n-1", () => {
    const s = calculateStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.mean).toBe(5);
    // sample variance = 32/7 ≈ 4.5714 → stddev ≈ 2.1381
    expect(s.stddev).toBe(2.1381);
    expect(s.min).toBe(2);
    expect(s.max).toBe(9);
  });

  test("single value: stddev 0", () => {
    expect(calculateStats([3.14159])).toEqual({ mean: 3.1416, stddev: 0, min: 3.1416, max: 3.1416 });
  });

  test("empty input: zeros", () => {
    expect(calculateStats([])).toEqual({ mean: 0, stddev: 0, min: 0, max: 0 });
  });

  test("4dp rounding", () => {
    expect(round4(0.123456)).toBe(0.1235);
    expect(round4(1 / 3)).toBe(0.3333);
  });
});

describe("delta", () => {
  test("numeric candidate minus baseline (sign preserved)", () => {
    expect(delta(0.9, 0.6)).toBe(0.3);
    expect(delta(0.4, 0.75)).toBe(-0.35);
    expect(typeof delta(1, 0)).toBe("number");
  });
});
