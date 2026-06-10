/**
 * validate_skill — deterministic lint engine for skill directories + optional
 * .skill packaging. Pure TS, no LLM calls.
 *
 * This rule table is the single normative home of the skill-authoring limits;
 * skill bodies reference the tool instead of restating the numbers.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { z } from "zod";
import type { Finding, ValidationResult } from "../types.ts";
import { FrontmatterError, parseFrontmatter } from "../lib/frontmatter.ts";
import { packageSkill } from "../lib/package.ts";
import { ok, err, type ToolModule, type ToolResult } from "../lib/tool.ts";

export const name = "validate_skill";
export const title = "Validate (and optionally package) a skill";
export const description =
  "Lints a skill directory against the agentskills.io open-standard spec and Claude Code house rules, " +
  "returning errors (spec violations), warnings (portability/style risks — need a stated reason to ignore), " +
  "and info findings (non-gating, e.g. Claude-Code-only frontmatter fields) with file context. " +
  "Optionally packages the validated skill into a .skill zip. " +
  "Use before running any evals on a skill and as the final gate before shipping. " +
  "Companion to test_triggers (run that next).";

export const inputShape = {
  skill_path: z.string().describe("Absolute path to the skill directory (the one containing SKILL.md)."),
  package: z
    .boolean()
    .default(false)
    .describe("After validation passes with zero errors, also produce <dir-name>.skill (zip)."),
  output_dir: z.string().optional().describe("Directory for the .skill file. Default: parent of skill_path."),
};

// ---------------------------------------------------------------------------
// Rule data
// ---------------------------------------------------------------------------

/** agentskills.io open-spec frontmatter keys. */
const SPEC_KEYS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

/** Known Claude Code extension keys — valid, but not portable (INFO, ignored by the ship gate). */
const CC_EXTENSION_KEYS = new Set([
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "hooks",
  "paths",
  "shell",
]);

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LISTING_CAP = 1536;

const SELF_ASSESSMENT_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /if you'?re thinking/i, what: '"If You\'re Thinking" self-assessment section' },
  { re: /rationalization\s*\|\s*reality/i, what: '"Rationalization | Reality" table' },
  { re: /red flags?[^\n]{0,30}stop/i, what: '"Red Flags — STOP" self-directed section' },
];

// Mention vs use: teaching/review content may quote a banned construct in code
// spans or double quotes without containing one. Strip those before testing.
function stripMentions(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/"[^"\n]*"/g, "");
}

const TIME_SENSITIVE_RE =
  /\b(as of (january|february|march|april|may|june|july|august|september|october|november|december|\d{4})|at the time of writing|in the coming (weeks|months))\b/i;
const CITATION_CONTEXT_RE = /https?:\/\/|arxiv|\b\d{4}\.\d{4,5}\b|fetched|accessed|published/i;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/** Count lines the way an editor does: a trailing newline is a line terminator, not an extra line. */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  const parts = text.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

/**
 * Prepare body lines for the line-by-line lints while preserving original
 * 1-based line numbers: returns one entry per ORIGINAL file line, with
 * frontmatter lines, fenced code blocks (and the fence delimiters), and inline
 * code spans blanked — quoted code is a mention, not a use.
 */
export function lintableLines(content: string, body: string): { lineNo: number; line: string }[] {
  const totalLines = content.split("\n").length;
  const bodyLines = body.split("\n");
  const bodyOffset = totalLines - bodyLines.length; // first body line index, 0-based
  let inFence = false;
  return bodyLines.map((line, i) => {
    const lineNo = bodyOffset + i + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return { lineNo, line: "" };
    }
    if (inFence) return { lineNo, line: "" };
    return { lineNo, line: line.replace(/`[^`\n]*`/g, "") };
  });
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function validateSkill(skillPath: string): ValidationResult {
  const root = resolve(skillPath);
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const info: Finding[] = [];
  const skillMd = "SKILL.md";
  const find = (rule: string, message: string, file = skillMd, line?: number): Finding => ({
    rule,
    message,
    file,
    ...(line !== undefined ? { line } : {}),
  });

  const skillMdPath = join(root, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    errors.push(find("skill-md-missing", "no SKILL.md in the skill directory"));
    return {
      valid: false,
      errors,
      warnings,
      info,
      stats: { skill_md_lines: 0, description_chars: 0, reference_files: 0 },
    };
  }

  const content = readFileSync(skillMdPath, "utf8");
  const lineCount = countLines(content);

  let fm: ReturnType<typeof parseFrontmatter> | null = null;
  try {
    fm = parseFrontmatter(content);
  } catch (e) {
    if (e instanceof FrontmatterError) errors.push(find(e.rule, e.message));
    else throw e;
  }

  let descriptionChars = 0;
  if (fm) {
    const { raw, name: skillName, description: desc, when_to_use, body } = fm;

    // --- name
    if (skillName === null) {
      warnings.push(
        find("name-missing", "frontmatter has no `name` (Claude-Code-optional, agentskills-spec-required)"),
      );
    } else {
      if (skillName.length < 1 || skillName.length > 64 || !NAME_RE.test(skillName)) {
        errors.push(
          find(
            "name-format",
            `name "${skillName}" must be 1-64 chars of a-z, 0-9, hyphen — no leading/trailing/consecutive hyphens`,
          ),
        );
      }
      if (skillName !== basename(root)) {
        errors.push(
          find("name-dir-mismatch", `name "${skillName}" must equal the parent directory name "${basename(root)}"`),
        );
      }
      if (/anthropic|claude/i.test(skillName)) {
        errors.push(find("name-reserved", `name must not contain "anthropic" or "claude"`));
      }
      if (/<[^>]+>/.test(skillName)) {
        errors.push(find("name-reserved", "name must not contain XML tags"));
      }
    }

    // --- description
    if (desc === null || desc.length === 0) {
      errors.push(find("description-missing", "frontmatter `description` is required and non-empty"));
    } else {
      descriptionChars = desc.length;
      if (desc.length > 1024) {
        errors.push(find("description-length", `description is ${desc.length} chars (max 1024)`));
      }
      if (/<[^>]+>/.test(desc)) {
        errors.push(find("description-xml-tags", "description must not contain XML tags"));
      }
      if (/^(i |i'm |i'll |you |your )/i.test(desc)) {
        warnings.push(
          find("description-person", "description should be third person (what the skill does + when to use it)"),
        );
      }
      const combined = desc.length + (when_to_use?.length ?? 0);
      if (combined > LISTING_CAP) {
        warnings.push(
          find(
            "listing-truncation",
            `description + when_to_use is ${combined} chars — listing surfaces truncate past ${LISTING_CAP}`,
          ),
        );
      }
    }

    // --- compatibility
    const compat = raw.compatibility;
    if (typeof compat === "string" && compat.length > 500) {
      errors.push(find("compatibility-length", `compatibility is ${compat.length} chars (max 500)`));
    }

    // --- frontmatter keys
    for (const key of Object.keys(raw)) {
      if (SPEC_KEYS.has(key)) continue;
      if (CC_EXTENSION_KEYS.has(key)) {
        info.push(find("cc-extension-key", `frontmatter key \`${key}\` is Claude-Code-only — not portable to other agents`));
      } else {
        warnings.push(find("unknown-frontmatter-key", `frontmatter key \`${key}\` is not in the agentskills.io spec`));
      }
    }

    // --- body line-by-line lints (BODY only — frontmatter is linted above;
    // code fences and inline code spans are stripped, original line numbers kept)
    lintableLines(content, body).forEach(({ lineNo, line }) => {
      if (/\w\\\w/.test(line) && /\\/.test(line) && /[A-Za-z]\\[A-Za-z]/.test(line)) {
        warnings.push(find("windows-paths", "backslash path separator — use forward slashes", skillMd, lineNo));
      }
      if (TIME_SENSITIVE_RE.test(line) && !CITATION_CONTEXT_RE.test(line)) {
        warnings.push(
          find("time-sensitive", "time-sensitive phrasing will go stale (citation-context dates are exempt)", skillMd, lineNo),
        );
      }
      if (/(^|[\s(`'"])references\//.test(line) && !line.includes("${CLAUDE_SKILL_DIR}") && !line.includes("${CLAUDE_PLUGIN_ROOT}")) {
        warnings.push(
          find(
            "bare-relative-path",
            "bare relative references/ path — use ${CLAUDE_SKILL_DIR}/references/<file> so links resolve from any cwd",
            skillMd,
            lineNo,
          ),
        );
      }
    });

    // --- self-assessment constructs (SKILL.md body)
    const bodyForConstructs = stripMentions(body);
    for (const p of SELF_ASSESSMENT_PATTERNS) {
      if (p.re.test(bodyForConstructs)) {
        warnings.push(
          find(
            "self-assessment-construct",
            `${p.what} — replace self-assessed compliance with external checkers / deterministic gates`,
          ),
        );
      }
    }
  }

  // --- SKILL.md size
  if (lineCount > 500) {
    errors.push(find("skill-md-lines", `SKILL.md is ${lineCount} lines (max 500) — move depth into references/`));
  }

  // --- forbidden files at skill root
  for (const forbidden of ["README.md", "CHANGELOG.md"]) {
    if (existsSync(join(root, forbidden))) {
      errors.push(find("forbidden-files", `${forbidden} does not belong in a skill root`, forbidden));
    }
  }

  // --- references/ lints
  const referencesDir = join(root, "references");
  const referenceFiles = listFilesRecursive(referencesDir);
  const refMarkdown = referenceFiles.filter((f) => f.endsWith(".md"));
  const refContents = new Map<string, string>(refMarkdown.map((f) => [f, readFileSync(f, "utf8")]));
  const skillBody = fm?.body ?? "";

  for (const refFile of refMarkdown) {
    const rel = relative(root, refFile);
    const base = basename(refFile);
    const refContent = refContents.get(refFile) ?? "";

    // ToC rule: >100 lines requires a Contents heading.
    const refLines = countLines(refContent);
    if (refLines > 100 && !/^#{1,3}\s+(table of\s+)?contents/im.test(refContent)) {
      warnings.push(find("reference-toc", `${rel} is ${refLines} lines with no Contents/ToC heading`, rel));
    }

    // Link-depth rule: every reference should be reachable directly from SKILL.md.
    // Subdirectories are fine; chains (SKILL.md -> ref A -> ref B) are the problem.
    if (!skillBody.includes(base)) {
      const chainedFrom = refMarkdown.find((other) => other !== refFile && (refContents.get(other) ?? "").includes(base));
      warnings.push(
        find(
          "reference-link-depth",
          chainedFrom
            ? `${rel} is only linked from ${relative(root, chainedFrom)} (link depth > 1) — link it from SKILL.md or inline it`
            : `${rel} is not linked from SKILL.md — orphaned references never get loaded`,
          rel,
        ),
      );
    }

    // Substitution vars don't resolve inside references. Flag path USES
    // (${VAR}/...) only — bare mentions in teaching content are fine.
    const varLine = refContent.split("\n").findIndex((l) => l.includes("${CLAUDE_PLUGIN_ROOT}/") || l.includes("${CLAUDE_SKILL_DIR}/"));
    if (varLine !== -1) {
      warnings.push(
        find(
          "substitution-vars-in-references",
          `${rel} uses \${CLAUDE_PLUGIN_ROOT}/\${CLAUDE_SKILL_DIR} paths — substitution vars only resolve in SKILL.md bodies and configs; use skill-name phrasing`,
          rel,
          varLine + 1,
        ),
      );
    }

    // Self-assessment constructs inside references (quoted mentions exempt).
    const refForConstructs = stripMentions(refContent);
    for (const p of SELF_ASSESSMENT_PATTERNS) {
      if (p.re.test(refForConstructs)) {
        warnings.push(
          find("self-assessment-construct", `${p.what} in ${rel} — replace with external checkers / deterministic gates`, rel),
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    stats: {
      skill_md_lines: lineCount,
      description_chars: descriptionChars,
      reference_files: referenceFiles.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const root = resolve(args.skill_path);
  if (!existsSync(root)) return err(`skill_path does not exist: ${root}`);

  const result = validateSkill(root);

  let packagedPath: string | undefined;
  if (args.package) {
    if (!result.valid) {
      return err(
        `refusing to package: ${result.errors.length} validation error(s):\n` +
          result.errors.map((e) => `- [${e.rule}] ${e.message}`).join("\n"),
      );
    }
    const { path } = packageSkill(root, args.output_dir ?? dirname(root));
    packagedPath = path;
  }

  const lines = [
    result.valid ? "VALID — zero errors." : `INVALID — ${result.errors.length} error(s).`,
    ...result.errors.map((f) => `ERROR [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ""} — ${f.message}`),
    ...result.warnings.map((f) => `WARN  [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ""} — ${f.message}`),
    ...result.info.map((f) => `INFO  [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ""} — ${f.message}`),
    `stats: ${result.stats.skill_md_lines} SKILL.md lines, ${result.stats.description_chars} description chars, ${result.stats.reference_files} reference files`,
    ...(packagedPath ? [`packaged: ${packagedPath}`] : []),
    ...(result.warnings.length > 0 ? ["Warnings need a stated reason to ignore; info findings are non-gating."] : []),
  ];

  const structured: ValidationResult = { ...result, ...(packagedPath ? { packaged_path: packagedPath } : {}) };
  return ok(lines.join("\n"), { ...structured });
}

// Compile-time contract: handler input is derived from inputShape (defineTool in register.ts re-checks).
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
