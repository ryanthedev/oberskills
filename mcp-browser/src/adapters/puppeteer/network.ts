/**
 * Network capture + interception/mocking (ADAPTER-INTERNAL). Puppeteer types live
 * here. Two concerns, kept distinct:
 *  - CAPTURE (observation): a per-page request/response buffer, mapped to core
 *    HarEntry DTOs on export. Captured response bodies are UNTRUSTED external
 *    input — size-capped, content-type carried as data, never executed.
 *  - INTERCEPTION (mutation): a RouteRule[] applied as DATA in a single request
 *    handler (block/abort/stub/modify) — no per-rule callbacks scattered around.
 *
 * Both arm against a puppeteer Page and tear down cleanly: disable() removes the
 * listeners and request interception so nothing leaks into a later session.
 */
import type { HTTPRequest, HTTPResponse, Page } from "puppeteer-core";
import type { HarEntry } from "../../core/har-port.ts";
import type { RouteRule } from "../../core/browser-port.ts";
import { RESPONSE_BODY_MAX_BYTES } from "../../types.ts";

type CapturedRequest = {
  method: string;
  url: string;
  requestHeaders: { name: string; value: string }[];
  postData?: string;
  startedDateTime: string;
  status?: number;
  statusText?: string;
  responseHeaders?: { name: string; value: string }[];
  mimeType?: string;
  encodedDataLength?: number;
  failed?: boolean;
};

function toHeaderList(h: Record<string, string> | undefined): { name: string; value: string }[] {
  if (!h) return [];
  return Object.entries(h).map(([name, value]) => ({ name, value: String(value) }));
}

function parseQueryString(url: string): { name: string; value: string }[] {
  try {
    const u = new URL(url);
    return Array.from(u.searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

/**
 * Manages capture + interception for a single page. One instance per active page;
 * recreated on tab switch / reconnect (so a dead Chrome leaves no armed state).
 */
export class NetworkController {
  private readonly buffer: CapturedRequest[] = [];
  private rules: RouteRule[] = [];
  private intercepting = false;
  private capturing = false;
  private readonly byReqId = new WeakMap<HTTPRequest, CapturedRequest>();

  /** The bound listeners, retained so disable() can remove exactly them. */
  private onRequest?: (req: HTTPRequest) => void;
  private onResponse?: (res: HTTPResponse) => Promise<void>;
  private onFailed?: (req: HTTPRequest) => void;

  constructor(private readonly page: Page) {}

  /** Begin capturing traffic into the buffer (idempotent). */
  async startCapture(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;

    this.onRequest = (req: HTTPRequest): void => {
      const entry: CapturedRequest = {
        method: req.method(),
        url: req.url(),
        requestHeaders: toHeaderList(req.headers()),
        startedDateTime: new Date().toISOString(),
        ...(req.postData() ? { postData: req.postData() } : {}),
      };
      this.byReqId.set(req, entry);
      this.buffer.push(entry);
      // When interception is armed, every request must be continued/handled.
      if (this.intercepting) void this.applyRules(req);
    };

    this.onResponse = async (res: HTTPResponse): Promise<void> => {
      const entry = this.byReqId.get(res.request());
      if (!entry) return;
      entry.status = res.status();
      entry.statusText = res.statusText();
      entry.responseHeaders = toHeaderList(res.headers());
      const ct = res.headers()["content-type"];
      entry.mimeType = ct ?? "";
      // Body is UNTRUSTED: we only record its (capped) size, never store/execute it.
      try {
        const buf = await res.buffer();
        entry.encodedDataLength = Math.min(buf.length, RESPONSE_BODY_MAX_BYTES);
      } catch {
        entry.encodedDataLength = -1;
      }
    };

    this.onFailed = (req: HTTPRequest): void => {
      const entry = this.byReqId.get(req);
      if (entry) entry.failed = true;
    };

    this.page.on("request", this.onRequest);
    this.page.on("response", this.onResponse);
    this.page.on("requestfailed", this.onFailed);
  }

  /** Arm interception with a rule list (data). Replaces any prior set. */
  async setRoutes(rules: RouteRule[]): Promise<void> {
    this.rules = rules;
    if (!this.intercepting) {
      await this.page.setRequestInterception(true);
      this.intercepting = true;
      // Ensure capture is running so the request handler also continues requests.
      await this.startCapture();
    }
  }

  /** Disarm interception (recovery primitive — safe to call unconditionally). */
  async clearRoutes(): Promise<void> {
    this.rules = [];
    if (this.intercepting) {
      try {
        await this.page.setRequestInterception(false);
      } catch {
        // page may be gone (Chrome died) — state is reset regardless.
      }
      this.intercepting = false;
    }
  }

  /** Apply the rule list as DATA to one intercepted request. */
  private async applyRules(req: HTTPRequest): Promise<void> {
    const rule = this.rules.find((r) => matchUrl(req.url(), r.urlPattern));
    if (!rule) {
      await safeContinue(req);
      return;
    }
    try {
      switch (rule.action) {
        case "block":
        case "abort":
          await req.abort();
          return;
        case "stub":
        case "modify":
          await req.respond({
            status: rule.status ?? 200,
            ...(rule.contentType ? { contentType: rule.contentType } : {}),
            ...(rule.headers ? { headers: rule.headers } : {}),
            // body is a STRING handed to CDP fulfillRequest — never eval'd.
            ...(rule.body !== undefined ? { body: rule.body } : {}),
          });
          return;
      }
    } catch {
      await safeContinue(req);
    }
  }

  /** Snapshot the buffer as core HarEntry DTOs (the mapping core never sees). */
  exportEntries(): HarEntry[] {
    return this.buffer.map((e): HarEntry => {
      const status = e.failed ? 0 : (e.status ?? 0);
      const size = e.encodedDataLength ?? -1;
      return {
        startedDateTime: e.startedDateTime,
        timeMs: -1,
        request: {
          method: e.method,
          url: e.url,
          httpVersion: "HTTP/1.1",
          headers: e.requestHeaders,
          queryString: parseQueryString(e.url),
          headersSize: -1,
          bodySize: e.postData ? Buffer.byteLength(e.postData) : 0,
          ...(e.postData ? { postData: { mimeType: "application/x-www-form-urlencoded", text: e.postData } } : {}),
        },
        response: {
          status,
          statusText: e.statusText ?? (e.failed ? "failed" : ""),
          httpVersion: "HTTP/1.1",
          headers: e.responseHeaders ?? [],
          content: { size, mimeType: e.mimeType ?? "" },
          redirectURL: "",
          headersSize: -1,
          bodySize: size,
        },
        timings: { blocked: -1, dns: -1, connect: -1, ssl: -1, send: -1, wait: -1, receive: -1 },
      };
    });
  }

  get entryCount(): number {
    return this.buffer.length;
  }

  /** Remove all listeners + interception. Called on disconnect / tab teardown. */
  async disable(): Promise<void> {
    await this.clearRoutes();
    if (this.onRequest) this.page.off("request", this.onRequest);
    if (this.onResponse) this.page.off("response", this.onResponse);
    if (this.onFailed) this.page.off("requestfailed", this.onFailed);
    this.capturing = false;
  }
}

/** Glob/substring URL match: `*` is a wildcard; otherwise substring containment. */
function matchUrl(url: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(url) || new RegExp(escaped).test(url);
  }
  return url.includes(pattern);
}

async function safeContinue(req: HTTPRequest): Promise<void> {
  try {
    await req.continue();
  } catch {
    // Already handled or page gone — nothing to recover.
  }
}
