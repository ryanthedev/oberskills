import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseFrontmatter } from "../src/lib/frontmatter.ts";

const skillsRoot = new URL("../../skills/", import.meta.url).pathname;

function skillDirs(): string[] {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(skillsRoot, entry.name))
    .sort();
}

describe("skill frontmatter portability", () => {
  test("all top-level skills have portable name and description frontmatter", () => {
    for (const dir of skillDirs()) {
      const content = readFileSync(join(dir, "SKILL.md"), "utf8");
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter.name).toBe(basename(dir));
      expect(frontmatter.description).toEqual(expect.any(String));
      expect(frontmatter.description?.trim().length).toBeGreaterThan(0);
    }
  });

  test("shared SKILL.md bodies avoid unresolved Claude-only and plugin-specific names", () => {
    for (const dir of skillDirs()) {
      const content = readFileSync(join(dir, "SKILL.md"), "utf8");
      const { body } = parseFrontmatter(content);

      expect(body).not.toContain("${CLAUDE_SKILL_DIR}");
      expect(body).not.toContain("${CLAUDE_PLUGIN_ROOT}");
      expect(body).not.toContain("mcp__plugin_oberskills");

      const hasHostPortabilitySection = /\b(Host Mapping|Compatibility)\b/.test(body);
      if (/\bAgent\(/.test(body) || /\bClaude Code\b/.test(body)) {
        expect(hasHostPortabilitySection).toBe(true);
      }
    }
  });
});
