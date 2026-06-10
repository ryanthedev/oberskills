import { describe, expect, test } from "bun:test";
import { resolveComparison } from "../src/tools/compare-outputs.ts";
import type { ComparisonJudgeOutput } from "../src/types.ts";

function judgeOutput(overrides: Partial<ComparisonJudgeOutput> = {}): ComparisonJudgeOutput {
  return {
    rubric: [
      { criterion: "correctness", weight: 1 },
      { criterion: "structure", weight: 1 },
    ],
    scores: {
      first: [
        { criterion: "correctness", score: 5, justification: "first nailed it" },
        { criterion: "structure", score: 4, justification: "clean layout" },
      ],
      second: [
        { criterion: "correctness", score: 3, justification: "two errors" },
        { criterion: "structure", score: 3, justification: "flat" },
      ],
    },
    assertions: [{ text: "has a summary", first_pass: true, second_pass: false }],
    totals: { first: 9, second: 6 },
    winner: "first",
    margin: "clear",
    reasoning: "first was better",
    ...overrides,
  };
}

describe("resolveComparison (de-shuffle + TS-recomputed verdict)", () => {
  test("not swapped: first maps to output_a", () => {
    const c = resolveComparison(judgeOutput(), false);
    expect(c.totals).toEqual({ output_a: 9, output_b: 6 });
    expect(c.winner).toBe("output_a");
    expect(c.scores.output_a[0]?.justification).toBe("first nailed it");
    expect(c.assertions[0]).toEqual({ text: "has a summary", a_pass: true, b_pass: false });
    expect(c.positions_swapped).toBe(false);
    expect(c.notes).toEqual([]);
  });

  test("swapped: first maps to output_b and the winner de-shuffles", () => {
    const c = resolveComparison(judgeOutput(), true);
    expect(c.totals).toEqual({ output_a: 6, output_b: 9 });
    expect(c.winner).toBe("output_b");
    expect(c.scores.output_b[0]?.justification).toBe("first nailed it");
    expect(c.assertions[0]).toEqual({ text: "has a summary", a_pass: false, b_pass: true });
    expect(c.positions_swapped).toBe(true);
  });

  test("totals are recomputed from per-criterion scores; judge arithmetic mismatch is flagged", () => {
    const c = resolveComparison(judgeOutput({ totals: { first: 23, second: 5 } }), false);
    expect(c.totals).toEqual({ output_a: 9, output_b: 6 }); // recomputed, not 23/5
    expect(c.notes.some((n) => n.includes("differ from recomputed"))).toBe(true);
  });

  test("winner follows recomputed totals over the judge's pick, with a note", () => {
    // Judge picked "second" but its own criterion scores favor first.
    const c = resolveComparison(judgeOutput({ winner: "second" }), false);
    expect(c.winner).toBe("output_a");
    expect(c.notes.some((n) => n.includes("judge picked output_b"))).toBe(true);
  });

  test("recomputed tie falls back to the judge's pick (assertion tiebreaker)", () => {
    const tied = judgeOutput({
      scores: {
        first: [
          { criterion: "correctness", score: 4, justification: "good" },
          { criterion: "structure", score: 4, justification: "good" },
        ],
        second: [
          { criterion: "correctness", score: 5, justification: "great" },
          { criterion: "structure", score: 3, justification: "weak" },
        ],
      },
      totals: { first: 8, second: 8 },
      winner: "second",
    });
    const c = resolveComparison(tied, false);
    expect(c.totals).toEqual({ output_a: 8, output_b: 8 });
    expect(c.winner).toBe("output_b");
    expect(c.notes).toEqual([]);
  });

  test("judge tie on tied recomputed totals stays a tie", () => {
    const tied = judgeOutput({
      scores: {
        first: [{ criterion: "correctness", score: 4, justification: "same" }],
        second: [{ criterion: "correctness", score: 4, justification: "same" }],
      },
      totals: { first: 4, second: 4 },
      winner: "tie",
    });
    const c = resolveComparison(tied, true);
    expect(c.winner).toBe("tie");
  });
});
