/**
 * browser_lighthouse_audit — run a Lighthouse audit in-process and return the
 * category scores + a report-file path. A run failure (lighthouse threw, or an
 * unsupported category) returns a structured lighthouse_failed err — NEVER a
 * zeroed audit reported as success (correctness lean, RF-12).
 */
import { z } from "zod";
import { BrowserError, isBrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { LighthouseAuditInputSchema, type LighthouseOut } from "../types.ts";
import type { LighthouseCategory } from "../core/browser-port.ts";

export const name = "browser_lighthouse_audit";
export const title = "Run a Lighthouse audit";
export const description =
  "Runs a Lighthouse audit in-process against the active page and returns 0..1 category scores plus a " +
  "report file path. Categories: performance, accessibility, seo, best-practices. A run failure returns " +
  "lighthouse_failed with the reason (never a zeroed audit as success). Never throws.";

export const inputShape = LighthouseAuditInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

/** Allowlist of supported categories (RF-6). Validated before the adapter runs. */
const SUPPORTED: ReadonlySet<string> = new Set(["performance", "accessibility", "seo", "best-practices"]);

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: reject unsupported category flags before spending a Lighthouse run.
  const bad = args.categories.filter((c) => !SUPPORTED.has(c));
  if (bad.length > 0) {
    return errFromBrowserError(
      new BrowserError(
        "lighthouse_failed",
        `unsupported lighthouse categor${bad.length === 1 ? "y" : "ies"}: ${bad.join(", ")}`,
        "use one or more of: performance, accessibility, seo, best-practices",
      ),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let res;
    try {
      res = await port.lighthouseAudit({ categories: args.categories as LighthouseCategory[] });
    } catch (e) {
      if (isBrowserError(e)) return errFromBrowserError(e);
      throw e;
    }
    const out: LighthouseOut = {
      scores: res.scores as Record<string, number>,
      report_path: res.reportPath,
    };
    const summary = Object.entries(res.scores)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    return ok(`lighthouse: ${summary} → ${res.reportPath}`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
