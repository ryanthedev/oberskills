import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { packageSkill, shouldExclude } from "../src/lib/package.ts";
import { handler as validateHandler } from "../src/tools/validate-skill.ts";

const base = mkdtempSync(join(tmpdir(), "package-test-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("shouldExclude", () => {
  test("global dir exclusions at any depth", () => {
    expect(shouldExclude("scripts/__pycache__/x.pyc")).toBe(true);
    expect(shouldExclude("node_modules/dep/index.js")).toBe(true);
    expect(shouldExclude(".git/HEAD")).toBe(true);
  });
  test("global file/extension exclusions", () => {
    expect(shouldExclude("references/.DS_Store")).toBe(true);
    expect(shouldExclude("scripts/util.pyc")).toBe(true);
  });
  test("evals/ excluded at root only", () => {
    expect(shouldExclude("evals/evals.json")).toBe(true);
    expect(shouldExclude("references/evals/sample.json")).toBe(false);
  });
  test("normal content kept", () => {
    expect(shouldExclude("SKILL.md")).toBe(false);
    expect(shouldExclude("references/deep.md")).toBe(false);
  });
});

describe("packageSkill", () => {
  test("archive root is the skill dir name; exclusions applied", () => {
    const skill = join(base, "zip-skill");
    mkdirSync(join(skill, "references"), { recursive: true });
    mkdirSync(join(skill, "evals"), { recursive: true });
    mkdirSync(join(skill, "__pycache__"), { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "---\nname: zip-skill\ndescription: Zips.\n---\nbody\n");
    writeFileSync(join(skill, "references", "a.md"), "ref\n");
    writeFileSync(join(skill, "evals", "evals.json"), "{}");
    writeFileSync(join(skill, "__pycache__", "junk.pyc"), "x");
    writeFileSync(join(skill, ".DS_Store"), "x");

    const { path, fileCount } = packageSkill(skill, base);
    expect(path.endsWith("zip-skill.skill")).toBe(true);
    expect(fileCount).toBe(2);

    const entries = Object.keys(unzipSync(readFileSync(path)));
    expect(entries.sort()).toEqual(["zip-skill/SKILL.md", "zip-skill/references/a.md"]);
  });

  test("validate_skill --package refuses on validation errors", async () => {
    const skill = join(base, "broken-skill");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "# no frontmatter\n");
    const result = await validateHandler({ skill_path: skill, package: true });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("refusing to package");
  });

  test("validate_skill --package produces a .skill on a valid skill", async () => {
    const skill = join(base, "ok-skill");
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      join(skill, "SKILL.md"),
      "---\nname: ok-skill\ndescription: Packages cleanly. Use when packaging.\n---\nbody\n",
    );
    const result = await validateHandler({ skill_path: skill, package: true, output_dir: base });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.packaged_path).toContain("ok-skill.skill");
  });
});
