/**
 * HarPort — a driven adapter seam for writing a HAR (HTTP Archive) file. A DEEP
 * module: one method hides the entire HAR 1.2 schema, entry ordering, timings
 * math, and the atomic write-then-rename. Core/tools depend only on this
 * interface + the plain HarEntry DTO; the real writer (adapters/fs/har-writer.ts)
 * and a non-puppeteer test fake are interchangeable behind it (DW-4.6).
 *
 * INVARIANT: dependency-free core. No HAR-schema detail, no puppeteer, no fs here
 * — only the plain DTO the network buffer is mapped into and the one-method port.
 */

/** A single captured request/response pair, as plain core data (no puppeteer). */
export type HarEntry = {
  /** ISO-8601 timestamp the request started. */
  startedDateTime: string;
  /** Total elapsed time for the entry in ms (-1 when unknown). */
  timeMs: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: { name: string; value: string }[];
    queryString: { name: string; value: string }[];
    headersSize: number;
    bodySize: number;
    postData?: { mimeType: string; text: string };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: { name: string; value: string }[];
    content: { size: number; mimeType: string };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  /** HAR timing breakdown in ms; -1 for any phase that is unknown. */
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
  };
};

/**
 * Write HAR entries to a file and return its path. The HAR 1.2 envelope, schema,
 * and durable-write strategy are entirely the implementation's concern. An empty
 * entries array MUST still produce a valid HAR file (a valid-but-empty log).
 */
export interface HarPort {
  write(entries: HarEntry[]): Promise<string>;
}
