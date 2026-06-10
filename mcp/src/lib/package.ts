/**
 * .skill packaging (fflate zip). Ports the Python package_skill.py exclusion
 * semantics exactly: __pycache__/node_modules/.git directories and
 * .DS_Store/*.pyc files are excluded everywhere; evals/ is excluded at the
 * skill root only; the archive root is the skill directory name.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { zipSync } from "fflate";

const EXCLUDE_DIRS = new Set(["__pycache__", "node_modules", ".git"]);
const EXCLUDE_FILES = new Set([".DS_Store"]);
const EXCLUDE_EXTENSIONS = new Set([".pyc"]);
const ROOT_EXCLUDE_DIRS = new Set(["evals"]);

export function shouldExclude(relPath: string): boolean {
  const parts = relPath.split("/");
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }
  const name = parts[parts.length - 1] ?? "";
  if (EXCLUDE_FILES.has(name)) return true;
  const dot = name.lastIndexOf(".");
  if (dot !== -1 && EXCLUDE_EXTENSIONS.has(name.slice(dot))) return true;
  if (parts[0] !== undefined && ROOT_EXCLUDE_DIRS.has(parts[0])) return true;
  return false;
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Package a (pre-validated) skill directory into <output_dir>/<name>.skill.
 * Returns the output path and the number of files packaged.
 */
export function packageSkill(skillPath: string, outputDir: string): { path: string; fileCount: number } {
  const root = resolve(skillPath);
  const skillName = basename(root);
  const files: Record<string, Uint8Array> = {};
  let fileCount = 0;
  for (const file of collectFiles(root)) {
    const rel = relative(root, file).split("\\").join("/");
    if (shouldExclude(rel)) continue;
    files[`${skillName}/${rel}`] = readFileSync(file);
    fileCount++;
  }
  const zipped = zipSync(files, { level: 6 });
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(resolve(outputDir), `${skillName}.skill`);
  writeFileSync(outPath, zipped);
  return { path: outPath, fileCount };
}
