/**
 * SKILL.md frontmatter parsing on a real YAML parser (replaces the Python
 * pipeline's hand-rolled regex YAML).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export type Frontmatter = {
  /** All frontmatter keys, raw. */
  raw: Record<string, unknown>;
  name: string | null;
  description: string | null;
  when_to_use: string | null;
  /** Markdown body after the closing delimiter. */
  body: string;
  /** Full file content. */
  content: string;
};

export class FrontmatterError extends Error {
  readonly rule: "frontmatter-missing" | "frontmatter-unclosed" | "frontmatter-invalid";
  constructor(rule: FrontmatterError["rule"], message: string) {
    super(message);
    this.rule = rule;
  }
}

/** Parse frontmatter from raw SKILL.md content. Throws FrontmatterError on structural problems. */
export function parseFrontmatter(content: string): Frontmatter {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new FrontmatterError("frontmatter-missing", "SKILL.md must start with a `---` frontmatter delimiter");
  }
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) {
    throw new FrontmatterError("frontmatter-unclosed", "frontmatter `---` block is never closed");
  }
  const yamlText = lines.slice(1, closeIndex).join("\n");
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (e) {
    throw new FrontmatterError("frontmatter-invalid", `frontmatter is not valid YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (raw === null || raw === undefined) raw = {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new FrontmatterError("frontmatter-invalid", "frontmatter must be a YAML mapping");
  }
  const record = raw as Record<string, unknown>;
  const str = (k: string): string | null => (typeof record[k] === "string" ? (record[k] as string) : null);
  return {
    raw: record,
    name: str("name"),
    description: str("description"),
    when_to_use: str("when_to_use"),
    body: lines.slice(closeIndex + 1).join("\n"),
    content,
  };
}

/** Parse the SKILL.md inside a skill directory. */
export function parseSkillDir(skillPath: string): Frontmatter {
  const content = readFileSync(join(skillPath, "SKILL.md"), "utf8");
  return parseFrontmatter(content);
}
