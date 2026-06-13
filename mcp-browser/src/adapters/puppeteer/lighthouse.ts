/**
 * Lighthouse-in-process runner (ADAPTER-INTERNAL). The `lighthouse` import lives
 * here — NOT in core/tools — because lighthouse needs the CDP debugging port,
 * which only the puppeteer adapter holds (extracted from browser.wsEndpoint()).
 * Keeping the import adapter-side preserves the hexagonal boundary (core stays
 * dependency-free; the static boundary test stays green).
 *
 * Verified to run in-process under bun against a puppeteer-core launched Chrome
 * (perfScore returned, full audit set). A run failure throws lighthouse_failed —
 * NEVER a zeroed audit reported as success (correctness lean, RF-12).
 */
import { BrowserError } from "../../core/errors.ts";
import type { LighthouseCategory } from "../../core/browser-port.ts";

/** Map our category names to Lighthouse's category ids. */
const CATEGORY_ID: Record<LighthouseCategory, string> = {
  performance: "performance",
  accessibility: "accessibility",
  seo: "seo",
  "best-practices": "best-practices",
};

export type LighthouseRunResult = {
  scores: Partial<Record<LighthouseCategory, number>>;
  /** The full JSON report as a string (caller persists it via writePayload). */
  reportJson: string;
};

/**
 * Run Lighthouse against a URL via an existing Chrome debugging port.
 * @param url - the page URL to audit.
 * @param debugPort - the CDP debugging port of the live Chrome.
 * @param categories - validated category list (barricade already ran).
 */
export async function runLighthouse(
  url: string,
  debugPort: number,
  categories: LighthouseCategory[],
): Promise<LighthouseRunResult> {
  let lighthouse: (typeof import("lighthouse"))["default"];
  try {
    lighthouse = (await import("lighthouse")).default;
  } catch (e) {
    throw new BrowserError(
      "lighthouse_failed",
      `could not load lighthouse: ${e instanceof Error ? e.message : String(e)}`,
      "ensure lighthouse is installed (it is a server dependency)",
    );
  }

  let runnerResult: Awaited<ReturnType<typeof lighthouse>>;
  try {
    runnerResult = await lighthouse(url, {
      port: debugPort,
      output: "json",
      logLevel: "error",
      onlyCategories: categories.map((c) => CATEGORY_ID[c]),
    });
  } catch (e) {
    throw new BrowserError(
      "lighthouse_failed",
      `lighthouse run failed: ${e instanceof Error ? e.message : String(e)}`,
      "check the page is reachable and Chrome is healthy, then retry",
    );
  }

  if (!runnerResult || !runnerResult.lhr) {
    // A null/empty result is a FAILURE — never reported as a zeroed success.
    throw new BrowserError(
      "lighthouse_failed",
      "lighthouse returned no result",
      "retry the audit; if it persists, the page may have blocked the run",
    );
  }

  const lhr = runnerResult.lhr;
  const scores: Partial<Record<LighthouseCategory, number>> = {};
  for (const cat of categories) {
    const id = CATEGORY_ID[cat];
    const score = lhr.categories?.[id]?.score;
    if (typeof score === "number") scores[cat] = score;
  }
  const reportJson = typeof runnerResult.report === "string" ? runnerResult.report : JSON.stringify(lhr);
  return { scores, reportJson };
}
