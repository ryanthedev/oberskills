/**
 * Canonical workspace layout helpers.
 *
 *   <skill-parent>/<skill-name>-workspace/
 *   ├── trigger-queries.json
 *   ├── description-optimization.json
 *   └── iteration-N/<eval-id>/<config>/run-N/{outputs/, transcript.jsonl,
 *       timing.json, metrics.json, grading.json}
 *
 * All workspace writes go through this module, which refuses paths outside the
 * workspace root. Readers tolerate legacy layouts (config dir as a single run;
 * timing fallback run dir -> config dir -> grading.json embedded timing).
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { Timing } from "../types.ts";

export function workspaceRoot(skillPath: string, override?: string): string {
  if (override) return resolve(override);
  const abs = resolve(skillPath);
  return join(dirname(abs), `${basename(abs)}-workspace`);
}

/**
 * Realpath an absolute path that may not fully exist yet: resolve symlinks on
 * the deepest existing ancestor and re-append the not-yet-created tail. Keeps
 * the prefix check below honest against symlinks (a link inside the workspace
 * pointing outside must not pass).
 */
function realpathDeepestAncestor(absPath: string): string {
  let current = absPath;
  const tail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync(current);
      return tail.length > 0 ? join(real, ...tail) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return tail.length > 0 ? join(current, ...tail) : current;
      tail.unshift(basename(current));
      current = parent;
    }
  }
}

/** Throws if target escapes root (symlink-aware). Returns the resolved target. */
export function guardInside(root: string, target: string): string {
  const absRoot = realpathDeepestAncestor(resolve(root));
  const absTarget = realpathDeepestAncestor(resolve(target));
  if (absTarget !== absRoot && !absTarget.startsWith(absRoot + sep)) {
    throw new Error(`refusing to write outside workspace: ${absTarget} is not under ${absRoot}`);
  }
  return absTarget;
}

export function ensureDir(root: string, dir: string): string {
  const target = guardInside(root, dir);
  mkdirSync(target, { recursive: true });
  return target;
}

export function writeJson(root: string, file: string, data: unknown): string {
  const target = guardInside(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(data, null, 2));
  return target;
}

export function appendJsonl(root: string, file: string, record: unknown): void {
  const target = guardInside(root, file);
  mkdirSync(dirname(target), { recursive: true });
  appendFileSync(target, JSON.stringify(record) + "\n");
}

export function iterationDir(root: string, iteration: number): string {
  return join(root, `iteration-${iteration}`);
}

export function runDir(root: string, iteration: number, evalId: string, config: string, run: number): string {
  return join(iterationDir(root, iteration), evalId, config, `run-${run}`);
}

// ---------------------------------------------------------------------------
// Benchmark walking (parity with the Python aggregate_benchmark.py reader)
// ---------------------------------------------------------------------------

export type WalkedRun = {
  eval_id: string;
  eval_name: string;
  configuration: string;
  run_number: number;
  run_dir: string;
  grading: Record<string, unknown>;
  timing: Timing;
};

function readJsonIf(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asTiming(value: unknown): Timing {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const num = (k: string): number => (typeof v[k] === "number" ? (v[k] as number) : 0);
  return {
    total_tokens: num("total_tokens"),
    duration_ms: num("duration_ms"),
    total_duration_seconds: num("total_duration_seconds"),
  };
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

/**
 * Walk an iteration directory of graded runs. Returns runs plus reader notes
 * (e.g. run dirs missing grading.json, which are warned and skipped).
 */
export function walkIterationDir(iterDir: string): { runs: WalkedRun[]; notes: string[] } {
  const runs: WalkedRun[] = [];
  const notes: string[] = [];

  for (const evalName of listDirs(iterDir)) {
    const evalDir = join(iterDir, evalName);
    const meta = readJsonIf(join(evalDir, "eval_metadata.json"));
    const evalId = typeof meta?.eval_id === "string" ? (meta.eval_id as string) : evalName;
    const displayName = typeof meta?.eval_name === "string" ? (meta.eval_name as string) : evalName;

    for (const configuration of listDirs(evalDir)) {
      const configDir = join(evalDir, configuration);
      // run-N fallback: when no run-N subdirs exist, the config dir IS the run.
      let runDirs = listDirs(configDir)
        .filter((d) => d.startsWith("run"))
        .map((d) => join(configDir, d));
      if (runDirs.length === 0) runDirs = [configDir];

      runDirs.forEach((rd, i) => {
        let grading = readJsonIf(join(rd, "grading.json"));
        if (!grading) grading = readJsonIf(join(configDir, "grading.json"));
        if (!grading) {
          notes.push(`no grading.json in ${rd} — skipped`);
          return;
        }
        // timing fallback chain: run dir -> config dir -> grading.json embedded
        let timing = readJsonIf(join(rd, "timing.json"));
        if (!timing) timing = readJsonIf(join(configDir, "timing.json"));
        const resolvedTiming = asTiming(timing ?? grading.timing);

        runs.push({
          eval_id: evalId,
          eval_name: displayName,
          configuration,
          run_number: i + 1,
          run_dir: rd,
          grading,
          timing: resolvedTiming,
        });
      });
    }
  }
  return { runs, notes };
}
