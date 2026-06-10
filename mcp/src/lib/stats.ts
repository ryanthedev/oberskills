/**
 * Summary statistics for benchmark aggregation: mean / sample stddev (n−1) /
 * min / max, rounded to 4 decimal places, plus numeric named-config deltas.
 */
import type { Stats } from "../types.ts";

export function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export function calculateStats(values: number[]): Stats {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let stddev = 0;
  if (values.length > 1) {
    const variance =
      values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (values.length - 1);
    stddev = Math.sqrt(variance);
  }
  return {
    mean: round4(mean),
    stddev: round4(stddev),
    min: round4(Math.min(...values)),
    max: round4(Math.max(...values)),
  };
}

/** candidate − baseline, numeric, 4dp. */
export function delta(candidateMean: number, baselineMean: number): number {
  return round4(candidateMean - baselineMean);
}
