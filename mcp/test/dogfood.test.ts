/**
 * Dogfood gate: every shipped skill must pass validate_skill with zero errors
 * and zero warnings. Pure lint — no model calls.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { validateSkill } from "../src/tools/validate-skill.ts";

const SKILLS_DIR = join(import.meta.dir, "..", "..", "skills");

// `*-workspace` directories are gitignored skill-eval scratch, not skills.
const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.endsWith("-workspace"))
  .map((e) => e.name)
  .sort();

describe("dogfood gate: validate_skill over skills/", () => {
  test("finds the shipped skills", () => {
    expect(skillDirs).toContain("skill-craft");
  });

  for (const skill of skillDirs) {
    test(`${skill}: zero errors, zero warnings`, () => {
      const r = validateSkill(join(SKILLS_DIR, skill));
      // Compare the findings themselves so a failure prints what and where.
      expect({ errors: r.errors, warnings: r.warnings }).toEqual({ errors: [], warnings: [] });
    });
  }
});
