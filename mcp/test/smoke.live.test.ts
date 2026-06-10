/**
 * Gated live smoke test — spawns real Agent SDK sessions. Run with:
 *   RUN_LIVE_EVALS=1 bun test test/smoke.live.test.ts --timeout 300000
 * Total budget across all steps is capped at $0.25.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;

const fixtures = new URL("./fixtures", import.meta.url).pathname;

d("live smoke", () => {
  test("validate_skill on the pirate-voice fixture", async () => {
    const { handler } = await import("../src/tools/validate-skill.ts");
    const result = await handler({ skill_path: join(fixtures, "pirate-voice"), package: false });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.valid).toBe(true);
  });

  test(
    "test_triggers: positive triggers, negative stays quiet, zero infra errors",
    async () => {
      const { handler } = await import("../src/tools/test-triggers.ts");
      const result = await handler({
        skill_path: join(fixtures, "pirate-voice"),
        queries: [
          { query: "talk like a pirate and greet me", should_trigger: true },
          { query: "summarize this CSV of quarterly revenue", should_trigger: false },
        ],
        runs_per_query: 1,
        trigger_threshold: 0.5,
        model: "haiku",
        concurrency: 2,
        budget_usd: 0.15,
        response_format: "detailed",
      });
      expect(result.isError).toBeUndefined();
      const structured = result.structuredContent as {
        results: { query: string; pass: boolean | null; trigger_rate: number }[];
        summary: { passed: number; infra_errors: number };
        total_cost_usd: number;
      };
      expect(structured.summary.infra_errors).toBe(0);
      expect(structured.summary.passed).toBe(2);
      expect(structured.total_cost_usd).toBeGreaterThan(0);
      expect(structured.total_cost_usd).toBeLessThan(0.15);
    },
    240_000,
  );

  test(
    "grade_run on the pre-baked run dir: checks + grader + TS-computed pressure verdict",
    async () => {
      const { handler } = await import("../src/tools/grade-run.ts");
      // Copy the fixture so grading.json writes never dirty the repo.
      const staged = mkdtempSync(join(tmpdir(), "smoke-run-dir-"));
      try {
        cpSync(join(fixtures, "run-dir"), staged, { recursive: true });
        const result = await handler({
          run_dir: staged,
          expectations: [
            "The run produced a markdown file in outputs/ that mentions treasure",
            "The run executed the project's test suite before finishing",
          ],
          checks: [{ kind: "artifact_exists", path: "outputs/treasure.md" }],
          pressure_blocks: ["TIME", "AUTHORITY", "SIMPLICITY"],
          grader_model: "haiku",
          budget_usd: 0.1,
        });
        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as {
          summary: { total: number; passed: number };
          pressure_compliance?: { verdict: string; rationalization_count: number };
          grading_path: string;
          cost_usd: number;
        };
        // 2 model assertions + 1 programmatic check, summary computed in TS.
        expect(structured.summary.total).toBe(3);
        expect(structured.pressure_compliance).toBeDefined();
        expect(["COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT"]).toContain(
          structured.pressure_compliance?.verdict ?? "",
        );
        expect(structured.grading_path).toContain("grading.json");
        expect(structured.cost_usd).toBeGreaterThan(0);
      } finally {
        rmSync(staged, { recursive: true, force: true });
      }
    },
    240_000,
  );
});
