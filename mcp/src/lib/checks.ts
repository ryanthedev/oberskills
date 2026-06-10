/**
 * Programmatic check engine — the judge-free deterministic floor.
 *
 * Artifact checks run against files in the run directory; trace checks run
 * against tool_use blocks parsed from transcript.jsonl. Results are emitted as
 * uniform Expectation entries with machine-written evidence so downstream
 * consumers (aggregation, analyzers) see one expectations array.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";
import type { Expectation, ProgrammaticCheck, TranscriptToolUse } from "../types.ts";

/** Extract tool_use blocks, in order, from a transcript.jsonl file. */
export function readToolUses(transcriptPath: string): TranscriptToolUse[] {
  if (!existsSync(transcriptPath)) return [];
  const uses: TranscriptToolUse[] = [];
  const lines = readFileSync(transcriptPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      continue; // tolerate partial/corrupt lines
    }
    if (typeof msg !== "object" || msg === null) continue;
    const m = msg as Record<string, unknown>;
    if (m.type !== "assistant") continue;
    const message = m.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as Record<string, unknown>).type === "tool_use" &&
        typeof (block as Record<string, unknown>).name === "string"
      ) {
        const b = block as Record<string, unknown>;
        uses.push({ name: b.name as string, input: b.input });
      }
    }
  }
  return uses;
}

export function describeCheck(check: ProgrammaticCheck): string {
  switch (check.kind) {
    case "artifact_exists":
      return `check artifact_exists: ${check.path}`;
    case "artifact_matches":
      return `check artifact_matches: ${check.path} ~ /${check.pattern}/`;
    case "trace_includes":
      return `check trace_includes: ${check.tool}${check.input_pattern ? ` ~ /${check.input_pattern}/` : ""}`;
    case "trace_order":
      return `check trace_order: ${check.tools.join(" -> ")}`;
    case "trace_never":
      return `check trace_never: ${check.tool ?? "*"}${check.input_pattern ? ` ~ /${check.input_pattern}/` : ""}`;
  }
}

/** Artifact paths must stay inside the run directory — absolute or ../-escaping paths fail the check. */
function unsafeArtifactPath(p: string): boolean {
  return isAbsolute(p) || normalize(p).startsWith("..");
}

/** Compile a check's RegExp; an invalid pattern fails that one check instead of aborting the grade. */
function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "m");
  } catch {
    return null;
  }
}

function matchesInput(use: TranscriptToolUse, re: RegExp | undefined): boolean {
  if (re === undefined) return true;
  const serialized = JSON.stringify(use.input ?? null);
  return re.test(serialized);
}

function evaluateOne(
  check: ProgrammaticCheck,
  runDir: string,
  toolUses: TranscriptToolUse[],
): Expectation {
  const text = describeCheck(check);
  switch (check.kind) {
    case "artifact_exists": {
      if (unsafeArtifactPath(check.path)) {
        return { text, passed: false, evidence: `unsafe artifact path "${check.path}" — must stay relative to the run directory` };
      }
      const p = resolve(runDir, check.path);
      const passed = existsSync(p);
      return { text, passed, evidence: passed ? `${check.path} present` : `${check.path} missing` };
    }
    case "artifact_matches": {
      if (unsafeArtifactPath(check.path)) {
        return { text, passed: false, evidence: `unsafe artifact path "${check.path}" — must stay relative to the run directory` };
      }
      const re = safeRegExp(check.pattern);
      if (re === null) {
        return { text, passed: false, evidence: `invalid pattern /${check.pattern}/` };
      }
      const p = resolve(runDir, check.path);
      if (!existsSync(p)) {
        return { text, passed: false, evidence: `${check.path} missing` };
      }
      const content = readFileSync(p, "utf8");
      const match = re.exec(content);
      return {
        text,
        passed: match !== null,
        evidence: match
          ? `matched ${JSON.stringify(match[0].slice(0, 120))} in ${check.path}`
          : `no match for /${check.pattern}/ in ${check.path}`,
      };
    }
    case "trace_includes": {
      const re = check.input_pattern !== undefined ? safeRegExp(check.input_pattern) : undefined;
      if (re === null) {
        return { text, passed: false, evidence: `invalid pattern /${check.input_pattern}/` };
      }
      const hit = toolUses.find((u) => u.name === check.tool && matchesInput(u, re));
      return {
        text,
        passed: hit !== undefined,
        evidence: hit
          ? `tool_use ${check.tool} found with input ${JSON.stringify(hit.input ?? null).slice(0, 120)}`
          : `no tool_use of ${check.tool}${check.input_pattern ? ` matching /${check.input_pattern}/` : ""} in transcript`,
      };
    }
    case "trace_order": {
      let idx = 0;
      for (const u of toolUses) {
        if (u.name === check.tools[idx]) idx++;
        if (idx === check.tools.length) break;
      }
      const passed = idx === check.tools.length;
      return {
        text,
        passed,
        evidence: passed
          ? `subsequence ${check.tools.join(" -> ")} present in trace`
          : `subsequence broke at ${check.tools[idx] ?? "?"} (matched ${idx}/${check.tools.length})`,
      };
    }
    case "trace_never": {
      const re = check.input_pattern !== undefined ? safeRegExp(check.input_pattern) : undefined;
      if (re === null) {
        return { text, passed: false, evidence: `invalid pattern /${check.input_pattern}/` };
      }
      const hit = toolUses.find(
        (u) =>
          (check.tool === undefined || u.name === check.tool) &&
          matchesInput(u, re),
      );
      // A bare trace_never with neither tool nor input_pattern would forbid all
      // tool use; treat that literally (any tool_use fails it).
      return {
        text,
        passed: hit === undefined,
        evidence: hit
          ? `forbidden tool_use ${hit.name} with input ${JSON.stringify(hit.input ?? null).slice(0, 120)}`
          : "no forbidden tool_use in transcript",
      };
    }
  }
}

/** Evaluate all checks against a run directory (expects transcript.jsonl + outputs/). */
export function evaluateChecks(checks: ProgrammaticCheck[], runDir: string): Expectation[] {
  const toolUses = readToolUses(resolve(runDir, "transcript.jsonl"));
  return checks.map((c) => evaluateOne(c, runDir, toolUses));
}
