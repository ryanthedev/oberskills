/**
 * Performance trace lifecycle + Core Web Vitals extraction (ADAPTER-INTERNAL).
 * Puppeteer types live here. The lifecycle is three operations — start / stop /
 * analyze — held as explicit state so ordering errors (stop/analyze before start,
 * a second start before stop) surface as BrowserError, never an empty result.
 *
 * The captured trace buffer is parsed for CWV-relevant events. We use the
 * Performance Web-Vitals approach: read the metrics the browser exposes (via the
 * trace's `loading`/`largest-contentful-paint`/`layout-shift` events) rather than
 * recomputing from raw timeline samples.
 */
import type { Page } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type { InsightMetric, InsightResult } from "../../core/browser-port.ts";

const CWV_CATEGORIES = [
  "devtools.timeline",
  "loading",
  "blink.user_timing",
  "latencyInfo",
  "v8.execute",
] as const;

type TraceEvent = {
  name?: string;
  cat?: string;
  ts?: number;
  args?: { data?: Record<string, unknown>; [k: string]: unknown };
};

export class TraceController {
  private running = false;
  /** The most recent captured trace (parsed JSON), or null when none captured. */
  private capturedEvents: TraceEvent[] | null = null;
  /** Raw captured trace bytes, retained so the caller can persist them. */
  private capturedBuffer: Buffer | null = null;

  constructor(private readonly page: Page) {}

  async start(screenshots: boolean): Promise<void> {
    if (this.running) {
      throw new BrowserError(
        "trace_already_running",
        "a performance trace is already running",
        "call browser_performance_stop_trace before starting another",
      );
    }
    await this.page.tracing.start({
      screenshots,
      categories: [...CWV_CATEGORIES],
    });
    this.running = true;
  }

  /** Stop the trace, retain the buffer + parsed events, return the raw bytes. */
  async stop(): Promise<Buffer> {
    if (!this.running) {
      throw new BrowserError(
        "no_trace_running",
        "no performance trace is running",
        "call browser_performance_start_trace first",
      );
    }
    const raw = await this.page.tracing.stop();
    this.running = false;
    const buf = raw ? Buffer.from(raw) : Buffer.from("{}");
    this.capturedBuffer = buf;
    try {
      const parsed = JSON.parse(buf.toString("utf8")) as { traceEvents?: TraceEvent[] };
      this.capturedEvents = parsed.traceEvents ?? [];
    } catch {
      this.capturedEvents = [];
    }
    return buf;
  }

  analyze(metric: InsightMetric): InsightResult {
    if (this.capturedEvents === null) {
      throw new BrowserError(
        "no_trace_running",
        "no captured trace to analyze",
        "run browser_performance_start_trace then browser_performance_stop_trace first",
      );
    }
    const events = this.capturedEvents;
    switch (metric) {
      case "LCP":
        return timeMetric("LCP", events, ["largestContentfulPaint::Candidate", "LargestContentfulPaint::Candidate"], "largest-contentful-paint candidate");
      case "FCP":
        return timeMetric("FCP", events, ["firstContentfulPaint", "FirstContentfulPaint"], "first-contentful-paint");
      case "TTFB":
        return timeMetric("TTFB", events, ["ResourceReceiveResponse", "receivedFirstByte"], "time-to-first-byte (first response)");
      case "INP":
        return timeMetric("INP", events, ["EventTiming", "InteractionToNextPaint"], "interaction-to-next-paint (longest event)");
      case "CLS":
        return clsMetric(events);
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get buffer(): Buffer | null {
    return this.capturedBuffer;
  }
}

/** First trace timestamp (the trace clock origin) in microseconds. */
function clockOrigin(events: TraceEvent[]): number {
  let min = Infinity;
  for (const e of events) {
    if (typeof e.ts === "number" && e.ts > 0 && e.ts < min) min = e.ts;
  }
  return min === Infinity ? 0 : min;
}

function timeMetric(metric: InsightMetric, events: TraceEvent[], names: string[], detail: string): InsightResult {
  const origin = clockOrigin(events);
  let latestTs: number | null = null;
  for (const e of events) {
    if (e.name && names.includes(e.name) && typeof e.ts === "number") {
      if (latestTs === null || e.ts > latestTs) latestTs = e.ts;
    }
  }
  if (latestTs === null) {
    return { metric, found: false, detail: `${detail} not found in trace` };
  }
  const valueMs = Math.max(0, Math.round((latestTs - origin) / 1000));
  return { metric, valueMs, found: true, detail };
}

function clsMetric(events: TraceEvent[]): InsightResult {
  let cls = 0;
  let found = false;
  for (const e of events) {
    if (e.name === "LayoutShift" || e.name === "layoutShift") {
      const data = e.args?.data as { score?: number; is_main_frame?: boolean } | undefined;
      const score = typeof data?.score === "number" ? data.score : undefined;
      if (score !== undefined) {
        cls += score;
        found = true;
      }
    }
  }
  if (!found) return { metric: "CLS", found: false, detail: "no layout-shift events in trace" };
  return { metric: "CLS", value: Math.round(cls * 1000) / 1000, found: true, detail: "cumulative-layout-shift (summed)" };
}
