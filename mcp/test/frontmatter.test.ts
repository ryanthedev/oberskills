import { describe, expect, test } from "bun:test";
import { FrontmatterError, parseFrontmatter } from "../src/lib/frontmatter.ts";

describe("parseFrontmatter", () => {
  test("single-line values", () => {
    const fm = parseFrontmatter("---\nname: foo\ndescription: Does a thing.\n---\n\nBody here.\n");
    expect(fm.name).toBe("foo");
    expect(fm.description).toBe("Does a thing.");
    expect(fm.when_to_use).toBeNull();
    expect(fm.body).toContain("Body here.");
  });

  test("block scalar | preserves newlines", () => {
    const fm = parseFrontmatter("---\nname: foo\ndescription: |\n  line one\n  line two\n---\nbody");
    expect(fm.description).toBe("line one\nline two\n");
  });

  test("folded scalar > joins lines", () => {
    const fm = parseFrontmatter("---\nname: foo\ndescription: >\n  line one\n  line two\n---\nbody");
    expect(fm.description).toBe("line one line two\n");
  });

  test("quoted values are unquoted", () => {
    const fm = parseFrontmatter('---\nname: foo\ndescription: "Quoted: with colon"\n---\nbody');
    expect(fm.description).toBe("Quoted: with colon");
  });

  test("when_to_use is surfaced", () => {
    const fm = parseFrontmatter("---\nname: foo\ndescription: x\nwhen_to_use: When testing.\n---\nbody");
    expect(fm.when_to_use).toBe("When testing.");
  });

  test("missing frontmatter throws frontmatter-missing", () => {
    expect(() => parseFrontmatter("# Just markdown\n")).toThrow(FrontmatterError);
    try {
      parseFrontmatter("# Just markdown\n");
    } catch (e) {
      expect((e as FrontmatterError).rule).toBe("frontmatter-missing");
    }
  });

  test("unclosed frontmatter throws frontmatter-unclosed", () => {
    try {
      parseFrontmatter("---\nname: foo\n# never closed\n");
      expect.unreachable();
    } catch (e) {
      expect((e as FrontmatterError).rule).toBe("frontmatter-unclosed");
    }
  });

  test("non-mapping frontmatter throws frontmatter-invalid", () => {
    try {
      parseFrontmatter("---\n- a\n- b\n---\nbody");
      expect.unreachable();
    } catch (e) {
      expect((e as FrontmatterError).rule).toBe("frontmatter-invalid");
    }
  });
});
