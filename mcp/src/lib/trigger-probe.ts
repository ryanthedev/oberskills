/**
 * Trigger-probe mechanics: wrap a candidate skill in a temporary plugin under
 * os.tmpdir(), spawn an isolated headless session, and detect triggering as a
 * typed Skill tool_use — no JSONL regex, no temp command files, and never any
 * write into the user's project .claude/ directory.
 *
 * The probe SKILL.md carries ONLY the listing surface (name + description +
 * when_to_use) — triggering depends on the listing, not the body. Claude Code
 * listing surfaces truncate description + when_to_use past a combined 1,536
 * chars; the builder measures and reports this.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeOptions, runBounded } from "./agent.ts";

export const LISTING_TRUNCATION_CHARS = 1536;

export type ListingSurface = {
  name: string;
  description: string;
  whenToUse: string | null;
};

export function listingChars(surface: ListingSurface): number {
  return surface.description.length + (surface.whenToUse?.length ?? 0);
}

function yamlQuote(s: string): string {
  return JSON.stringify(s); // JSON strings are valid YAML scalars
}

/**
 * Build a temp plugin containing just the listing surface of the candidate.
 * Caller must removeTempPlugin() in a finally block.
 */
export function buildListingPlugin(surface: ListingSurface): string {
  const dir = mkdtempSync(join(tmpdir(), "skill-eval-probe-"));
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "evalprobe", version: "0.0.0" }),
  );
  const skillDir = join(dir, "skills", surface.name);
  mkdirSync(skillDir, { recursive: true });
  const frontmatter = [
    "---",
    `name: ${surface.name}`,
    `description: ${yamlQuote(surface.description)}`,
    ...(surface.whenToUse !== null ? [`when_to_use: ${yamlQuote(surface.whenToUse)}`] : []),
    "---",
    "",
    `# ${surface.name}`,
    "",
    "Probe placeholder body.",
  ].join("\n");
  writeFileSync(join(skillDir, "SKILL.md"), frontmatter);
  return dir;
}

/** Build a temp plugin wrapping the FULL skill directory (for run_eval with_skill configs). */
export function buildFullSkillPlugin(skillPath: string, skillName: string): string {
  const dir = mkdtempSync(join(tmpdir(), "skill-eval-subject-"));
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "evalprobe", version: "0.0.0" }),
  );
  const skillDir = join(dir, "skills", skillName);
  mkdirSync(join(dir, "skills"), { recursive: true });
  cpSync(skillPath, skillDir, { recursive: true });
  return dir;
}

export function removeTempPlugin(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export type ProbeOutcome = "triggered" | "not_triggered" | "infra_error";

export type ProbeRun = {
  outcome: ProbeOutcome;
  cost: number;
  detail: string | null;
};

/** Result-shaped input for the pure classification function (unit-testable). */
export type ProbeResultShape = {
  timedOut: boolean;
  pluginLoaded: boolean;
  hasResult: boolean;
  isError: boolean;
  subtype: string | null;
  triggered: boolean;
  streamError: string | null;
};

/**
 * Classify one probe result. Pure; exported for tests.
 *
 * Rules:
 * - A trigger observed in the stream counts as triggered even if the session
 *   later errored (budget/turn exhaustion after the trigger).
 * - is_error results are infra_error UNLESS the subtype is bound exhaustion
 *   (error_max_turns / error_max_budget_usd) — those sessions ran and simply
 *   never triggered. In particular is_error with subtype "success" (the live
 *   auth-failure signature) is infra_error, never "not_triggered".
 */
export function classifyProbeResult(r: ProbeResultShape): { outcome: ProbeOutcome; detail: string | null } {
  if (r.timedOut) return { outcome: "infra_error", detail: "probe timeout" };
  if (!r.pluginLoaded) {
    return { outcome: "infra_error", detail: "temp plugin missing from init.plugins (malformed candidate?)" };
  }
  if (!r.hasResult) return { outcome: "infra_error", detail: r.streamError ?? "stream ended without result" };
  if (r.triggered) return { outcome: "triggered", detail: null };
  if (r.isError) {
    if (r.subtype === "error_max_turns" || r.subtype === "error_max_budget_usd") {
      return { outcome: "not_triggered", detail: r.subtype };
    }
    return { outcome: "infra_error", detail: `error result (subtype: ${r.subtype ?? "unknown"})` };
  }
  return { outcome: "not_triggered", detail: null };
}

/**
 * Run one trigger probe. Asserts the temp plugin actually loaded (init.plugins)
 * so a malformed candidate is an infra_error, never scored "did not trigger".
 */
export async function runProbe(
  query: string,
  pluginDir: string,
  skillName: string,
  model: string,
  timeoutMs = 90_000,
): Promise<ProbeRun> {
  let pluginLoaded = false;
  let triggered = false;
  const expectedSkill = `evalprobe:${skillName}`;

  const { result, timedOut, streamError, cost } = await runBounded(
    query,
    probeOptions(model, pluginDir),
    timeoutMs,
    (m) => {
      if (m.type === "system" && m.subtype === "init") {
        pluginLoaded = m.plugins.some((p) => p.name === "evalprobe");
      }
      if (m.type === "assistant") {
        for (const block of m.message.content) {
          if (
            block.type === "tool_use" &&
            block.name === "Skill" &&
            typeof block.input === "object" &&
            block.input !== null &&
            (block.input as Record<string, unknown>).skill === expectedSkill
          ) {
            triggered = true;
          }
        }
      }
    },
  );

  // cost from runBounded is conservative (budget cap) when no result message
  // arrived, so the ledger never under-counts a timed-out probe.
  const { outcome, detail } = classifyProbeResult({
    timedOut,
    pluginLoaded,
    hasResult: result !== null,
    isError: result?.is_error ?? false,
    subtype: result?.subtype ?? null,
    triggered,
    streamError,
  });
  return { outcome, cost, detail };
}
