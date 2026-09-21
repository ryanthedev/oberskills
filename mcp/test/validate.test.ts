import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSkill } from "../src/tools/validate-skill.ts";
import type { ValidationResult } from "../src/types.ts";

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

function makeSkill(name: string, skillMd: string, extra: Record<string, string> = {}): string {
  const parent = mkdtempSync(join(tmpdir(), "validate-test-"));
  tempDirs.push(parent);
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMd);
  for (const [rel, content] of Object.entries(extra)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const GOOD = `---
name: good-skill
description: Validates things for the user. Use when the user asks to validate a skill directory.
---

# Good Skill

Do the thing.
`;

function rules(findings: { rule: string }[]): string[] {
  return findings.map((f) => f.rule);
}

function run(dir: string): ValidationResult {
  return validateSkill(dir);
}

describe("validate_skill rules", () => {
  test("minimal valid skill passes with no findings", () => {
    const r = run(makeSkill("good-skill", GOOD));
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
    expect(r.info).toHaveLength(0);
  });

  test("missing SKILL.md is an error", () => {
    const parent = mkdtempSync(join(tmpdir(), "validate-test-"));
    tempDirs.push(parent);
    const dir = join(parent, "empty-skill");
    mkdirSync(dir);
    const r = run(dir);
    expect(rules(r.errors)).toContain("skill-md-missing");
  });

  test("missing frontmatter is an error", () => {
    const r = run(makeSkill("no-fm", "# No frontmatter\n"));
    expect(rules(r.errors)).toContain("frontmatter-missing");
  });

  test("unclosed frontmatter is an error", () => {
    const r = run(makeSkill("bad-fm", "---\nname: bad-fm\n"));
    expect(rules(r.errors)).toContain("frontmatter-unclosed");
  });

  test("consecutive hyphens in name are rejected (old regex allowed a--b)", () => {
    const md = GOOD.replace("name: good-skill", "name: a--b");
    const r = run(makeSkill("a--b", md));
    expect(rules(r.errors)).toContain("name-format");
  });

  test("name-dir mismatch is an ERROR when name is present", () => {
    const r = run(makeSkill("other-dir", GOOD));
    expect(rules(r.errors)).toContain("name-dir-mismatch");
  });

  test("missing name is a WARN (CC-optional, spec-required), not an error", () => {
    const md = "---\ndescription: Does things. Use when asked.\n---\nbody\n";
    const r = run(makeSkill("nameless", md));
    expect(rules(r.warnings)).toContain("name-missing");
    expect(r.valid).toBe(true);
  });

  test("reserved words in name are an error", () => {
    const md = GOOD.replace(/name: good-skill/, "name: fancy-anthropic-tool");
    const r = run(makeSkill("fancy-anthropic-tool", md));
    expect(rules(r.errors)).toContain("name-reserved");
  });

  test("XML tags in description are an error with their own rule id", () => {
    const md = GOOD.replace(/description: .*/, "description: Use <tool> to do things.");
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.errors)).toContain("description-xml-tags");
    expect(rules(r.errors)).not.toContain("name-reserved");
  });

  test("description over 1024 chars is an error", () => {
    const md = GOOD.replace(/description: .*/, `description: ${"x".repeat(1030)}`);
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.errors)).toContain("description-length");
  });

  test("first-person description is a WARN", () => {
    const md = GOOD.replace(/description: .*/, "description: I validate skills for you.");
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).toContain("description-person");
  });

  test("description + when_to_use over 1536 chars warns listing-truncation", () => {
    const md = GOOD.replace(
      "---\n\n# Good Skill",
      `when_to_use: ${"w".repeat(1500)}\n---\n\n# Good Skill`,
    );
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).toContain("listing-truncation");
  });

  test("spec `license` key is accepted silently (Python regression)", () => {
    const md = GOOD.replace("---\n\n# Good Skill", "license: MIT\n---\n\n# Good Skill");
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).not.toContain("unknown-frontmatter-key");
    expect(r.valid).toBe(true);
  });

  test("CC extension keys are INFO, not WARN, and do not gate", () => {
    const md = GOOD.replace("---\n\n# Good Skill", "when_to_use: When validating.\n---\n\n# Good Skill");
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.info)).toContain("cc-extension-key");
    expect(rules(r.warnings)).not.toContain("cc-extension-key");
    expect(r.valid).toBe(true);
  });

  test("truly unknown frontmatter keys are WARN", () => {
    const md = GOOD.replace("---\n\n# Good Skill", "totally_made_up: yes\n---\n\n# Good Skill");
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).toContain("unknown-frontmatter-key");
  });

  test("SKILL.md over 500 lines is an error", () => {
    const md = GOOD + "filler\n".repeat(500);
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.errors)).toContain("skill-md-lines");
  });

  test("README.md in skill root is an error", () => {
    const r = run(makeSkill("good-skill", GOOD, { "README.md": "# nope" }));
    expect(rules(r.errors)).toContain("forbidden-files");
  });

  test("compatibility over 500 chars is an error", () => {
    const md = GOOD.replace("---\n\n# Good Skill", `compatibility: ${"c".repeat(501)}\n---\n\n# Good Skill`);
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.errors)).toContain("compatibility-length");
  });

  test("reference >100 lines without ToC warns; with ToC does not", () => {
    const long = "line\n".repeat(120);
    const longWithToc = "## Contents\n- [a](#a)\n" + long;
    const body = GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/no-toc.md and ${CLAUDE_SKILL_DIR}/references/with-toc.md\n";
    const r = run(
      makeSkill("good-skill", body, {
        "references/no-toc.md": long,
        "references/with-toc.md": longWithToc,
      }),
    );
    const tocWarnings = r.warnings.filter((w) => w.rule === "reference-toc");
    expect(tocWarnings).toHaveLength(1);
    expect(tocWarnings[0]?.file).toContain("no-toc.md");
  });

  test("reference subdirectories alone are fine; unlinked references warn on LINK depth", () => {
    const body = GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/sub/linked.md\n";
    const r = run(
      makeSkill("good-skill", body, {
        "references/sub/linked.md": "short\n",
        "references/orphan.md": "never mentioned anywhere\n",
        "references/chained.md": "only mentioned below\n",
      }),
    );
    // linked.md lives in a subdirectory and is linked from SKILL.md — no warning.
    const depthWarnings = r.warnings.filter((w) => w.rule === "reference-link-depth");
    expect(depthWarnings.map((w) => w.file).join(",")).not.toContain("linked.md");
    expect(depthWarnings.some((w) => w.file.includes("orphan.md"))).toBe(true);
    expect(r.errors.filter((e) => e.rule === "references-nesting")).toHaveLength(0);
  });

  test("reference-to-reference chains are flagged as link depth > 1", () => {
    const body = GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/a.md\n";
    const r = run(
      makeSkill("good-skill", body, {
        "references/a.md": "see also b.md for details\n",
        "references/b.md": "deep content\n",
      }),
    );
    const chain = r.warnings.find((w) => w.rule === "reference-link-depth" && w.file.includes("b.md"));
    expect(chain).toBeDefined();
    expect(chain?.message).toContain("link depth > 1");
  });

  test("self-assessment constructs warn (brief decision 3)", () => {
    const md = GOOD + "\n## If You're Thinking About Skipping This\n\n| Rationalization | Reality |\n|---|---|\n";
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).toContain("self-assessment-construct");
  });

  describe("self-ticked compliance checklists", () => {
    const FENCE = "```";
    const selfTicked = (r: ValidationResult) =>
      r.warnings.filter((w) => w.rule === "self-assessment-construct" && w.message.includes("self-ticked"));

    // The template skill-craft's build.md used to recommend, verbatim — fenced, so
    // the fence-stripping mention filter must not hide it.
    const OLD_BUILD_MD =
      "Progress-checklist pattern (adherence aid for multi-step workflows — Claude copies it and checks items off, making skips visible):\n\n" +
      FENCE + "markdown\n" +
      "Copy this checklist and check off each item as it completes:\n" +
      "- [ ] Baseline run documented\n" +
      "- [ ] Validation passes with zero errors\n" +
      "- [ ] All evals re-run after the last edit\n" +
      FENCE + "\n";

    test("fires on the old build.md pattern verbatim, in a reference and in SKILL.md, with a line number", () => {
      const body = GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/build.md\n";
      const inRef = selfTicked(run(makeSkill("good-skill", body, { "references/build.md": OLD_BUILD_MD })));
      expect(inRef).toHaveLength(1);
      expect(inRef[0]?.file).toBe("references/build.md");
      expect(inRef[0]?.line).toBe(4);

      const inBody = selfTicked(run(makeSkill("good-skill", GOOD + "\n" + OLD_BUILD_MD)));
      expect(inBody).toHaveLength(1);
      // GOOD is 8 lines + 1 blank; the fenced instruction is OLD_BUILD_MD line 4.
      expect(inBody[0]?.line).toBe(13);
    });

    test("fires on realistic variants (unfenced, instruction after the list, numbered boxes)", () => {
      const variants = [
        "Before responding, tick each box as you complete it:\n\n- [ ] Tests run\n- [ ] Docs updated\n",
        "- [ ] Read the spec\n- [ ] Ran the linter\n\nMark each item as done before moving to the next phase.\n",
        "Confirm you have:\n1. [ ] Loaded the reference\n2. [ ] Followed every step\n",
        "## Completion\n\nCopy the following checklist into your reply.\n\n* [x] Workflow followed\n* [ ] Output validated\n",
      ];
      for (const v of variants) {
        expect(selfTicked(run(makeSkill("good-skill", GOOD + "\n" + v)))).toHaveLength(1);
      }
    });

    test("an instruction between two checkbox runs is reported once", () => {
      const md = GOOD + "\n- [ ] First\n\nCheck off each item as it completes.\n\n- [ ] Second\n";
      expect(selfTicked(run(makeSkill("good-skill", md)))).toHaveLength(1);
    });

    test("does not fire on task lists, mentions, other tickers, or artifact-based progress", () => {
      const clean = [
        // Plain user-facing task list / GitHub task-list syntax, fenced or not.
        "PR description template:\n\n" + FENCE + "markdown\n## TODO\n- [ ] Add tests\n- [ ] Update changelog\n" + FENCE + "\n",
        "Implementation checklist:\n\n- [ ] Every tool call passes a policy check\n- [ ] Exceptions are redacted\n",
        // Prose that merely mentions checklists, with no checkbox items.
        "A checklist is no substitute for a gate. Never copy this checklist habit from older skills.\n",
        // Quoted wording is a mention, even next to checkbox syntax.
        'Flag skills that say "copy this checklist and check off each item":\n\n- [ ] example item\n',
        // Someone else ticks the boxes — a hand-off template, not self-attestation.
        "Give the user this list to check off each item as they verify it:\n\n- [ ] Staging looks right\n",
        // The instruction is too far from the list to be about it.
        "Check off each item.\n\nOne.\n\nTwo.\n\nThree.\n\n- [ ] Unrelated task\n",
        // Progress-artifact pattern: evidence files, no self-ticked boxes.
        "Each step writes its evidence; start a step only when the prior step's evidence exists:\n" +
          "1. Baseline run → `grading.json` in the baseline run directory (written by the grader)\n" +
          "2. Validation → validator output reporting zero errors\n",
      ];
      for (const c of clean) {
        expect(selfTicked(run(makeSkill("good-skill", GOOD + "\n" + c)))).toHaveLength(0);
      }
    });
  });

  test("substitution vars inside references warn", () => {
    const body = GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/uses-var.md\n";
    const r = run(
      makeSkill("good-skill", body, {
        "references/uses-var.md": "Read ${CLAUDE_PLUGIN_ROOT}/mcp/data/pressure-blocks.json\n",
      }),
    );
    expect(rules(r.warnings)).toContain("substitution-vars-in-references");
  });

  test("mention vs use: quoted/code-span constructs and bare var mentions don't warn", () => {
    // A reviewer rubric QUOTING banned constructs is a mention, not a use.
    const rubric =
      GOOD +
      '\nFlag reviewed skills containing "Rationalization | Reality" tables or `Red Flags — STOP` sections.\n' +
      "\nSee ${CLAUDE_SKILL_DIR}/references/teach.md\n";
    const r = run(
      makeSkill("good-skill", rubric, {
        // Bare variable mention (teaching content), no path use.
        "references/teach.md": "Skill bodies may use `${CLAUDE_SKILL_DIR}` for intra-skill links.\n",
      }),
    );
    expect(rules(r.warnings)).not.toContain("self-assessment-construct");
    expect(rules(r.warnings)).not.toContain("substitution-vars-in-references");

    // But a real path USE in a reference still warns.
    const r2 = run(
      makeSkill("good-skill", GOOD + "\nSee ${CLAUDE_SKILL_DIR}/references/teach.md\n", {
        "references/teach.md": "Load ${CLAUDE_SKILL_DIR}/references/other.md now.\n",
        "references/other.md": "x\n",
      }),
    );
    expect(rules(r2.warnings)).toContain("substitution-vars-in-references");
  });

  test("bare relative references/ path in SKILL.md warns unless resolution basis is explicit", () => {
    const bare = GOOD + "\nRead references/deep.md for more.\n";
    const r1 = run(makeSkill("good-skill", bare, { "references/deep.md": "x\n" }));
    expect(rules(r1.warnings)).toContain("bare-relative-path");

    const explicit = GOOD + "\nLoad references/design.md in this skill directory.\n";
    const r2 = run(makeSkill("good-skill", explicit, { "references/design.md": "x\n" }));
    expect(rules(r2.warnings)).not.toContain("bare-relative-path");

    const braced = GOOD + "\nRead ${CLAUDE_SKILL_DIR}/references/deep.md for more.\n";
    const r3 = run(makeSkill("good-skill", braced, { "references/deep.md": "x\n" }));
    expect(rules(r3.warnings)).not.toContain("bare-relative-path");
  });

  test("time-sensitive phrasing warns, but citation-context dates are exempt", () => {
    const md = GOOD + "\nAs of 2026 this is the newest approach.\n";
    const r1 = run(makeSkill("good-skill", md));
    expect(rules(r1.warnings)).toContain("time-sensitive");

    const cited = GOOD + "\nAs of 2026 per https://example.com/spec this holds.\n";
    const r2 = run(makeSkill("good-skill", cited));
    expect(rules(r2.warnings)).not.toContain("time-sensitive");
  });

  test("windows path separators warn", () => {
    const md = GOOD + "\nOpen scripts\\helpers\\run.py to start.\n";
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).toContain("windows-paths");
  });

  test("stats are reported", () => {
    const r = run(makeSkill("good-skill", GOOD));
    expect(r.stats.skill_md_lines).toBeGreaterThan(0);
    expect(r.stats.description_chars).toBeGreaterThan(0);
    expect(r.stats.reference_files).toBe(0);
  });

  test("line count: trailing newline is a terminator, not an extra line (no off-by-one at 500)", () => {
    // GOOD is 8 content lines + trailing newline. Pad to exactly 500 lines, newline-terminated.
    const exactly500 = GOOD + "filler\n".repeat(492);
    const r = run(makeSkill("good-skill", exactly500));
    expect(r.stats.skill_md_lines).toBe(500);
    expect(rules(r.errors)).not.toContain("skill-md-lines");

    const over = run(makeSkill("good-skill", exactly500 + "one more\n"));
    expect(over.stats.skill_md_lines).toBe(501);
    expect(rules(over.errors)).toContain("skill-md-lines");
  });

  test("line lints run over the body only — frontmatter is exempt", () => {
    // A windows-path-looking value and time-sensitive phrasing in FRONTMATTER must not lint.
    const md = GOOD.replace(
      "---\n\n# Good Skill",
      'metadata: { note: "as of 2026 stored at scripts\\\\helpers\\\\run.py" }\n---\n\n# Good Skill',
    );
    const r = run(makeSkill("good-skill", md));
    expect(rules(r.warnings)).not.toContain("windows-paths");
    expect(rules(r.warnings)).not.toContain("time-sensitive");
  });

  test("line lints skip fenced code blocks and inline code spans, preserving line numbers", () => {
    const md =
      GOOD +
      "\n```\nOpen scripts\\helpers\\run.py — fenced, exempt.\nRead references/fenced.md\n```\n" +
      "\nUse `references/span.md` in a code span — exempt.\n" +
      "\nRead references/real.md for more.\n";
    const r = run(makeSkill("good-skill", md, { "references/real.md": "x\n" }));
    expect(rules(r.warnings)).not.toContain("windows-paths");
    const bare = r.warnings.filter((w) => w.rule === "bare-relative-path");
    expect(bare).toHaveLength(1);
    // Original line number preserved: GOOD is 8 newline-terminated lines; the
    // flagged "Read references/real.md" line lands on file line 17.
    expect(bare[0]?.line).toBe(17);
  });
});
