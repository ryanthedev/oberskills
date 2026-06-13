/**
 * FsHarWriter — the real HarPort driven adapter. A DEEP module: the single
 * write(entries) method hides the entire HAR 1.2 envelope, per-entry shaping, and
 * the durable write. The HAR 1.2 schema detail lives ONLY here; core/tools see
 * just the HarPort interface + the plain HarEntry DTO.
 *
 * Atomic write-then-rename to /tmp (constraint: no rollback needed for this seam):
 * we write to <path>.tmp then rename to <path>, so a reader never sees a partial
 * file. No puppeteer here — this is a filesystem adapter.
 */
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarEntry, HarPort } from "../../core/har-port.ts";

/** HAR 1.2 creator identity (single home). */
const CREATOR = { name: "mcp-browser", version: "1.2" } as const;

export class FsHarWriter implements HarPort {
  async write(entries: HarEntry[]): Promise<string> {
    // An empty entries array is valid: HAR with an empty `entries` log.
    const har = {
      log: {
        version: "1.2",
        creator: CREATOR,
        entries: entries.map(toHarEntry),
      },
    };

    const fileName = `browser-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.har`;
    const path = join(tmpdir(), fileName);
    const tmp = `${path}.tmp`;
    const json = JSON.stringify(har, null, 2);
    // write-then-rename: a reader never observes a partial HAR.
    await writeFile(tmp, json);
    await rename(tmp, path);
    return path;
  }
}

/** Map a core HarEntry into the HAR 1.2 entry shape (the schema detail this hides). */
function toHarEntry(e: HarEntry): Record<string, unknown> {
  return {
    startedDateTime: e.startedDateTime,
    time: e.timeMs,
    request: {
      method: e.request.method,
      url: e.request.url,
      httpVersion: e.request.httpVersion,
      cookies: [],
      headers: e.request.headers,
      queryString: e.request.queryString,
      headersSize: e.request.headersSize,
      bodySize: e.request.bodySize,
      ...(e.request.postData ? { postData: e.request.postData } : {}),
    },
    response: {
      status: e.response.status,
      statusText: e.response.statusText,
      httpVersion: e.response.httpVersion,
      cookies: [],
      headers: e.response.headers,
      content: e.response.content,
      redirectURL: e.response.redirectURL,
      headersSize: e.response.headersSize,
      bodySize: e.response.bodySize,
    },
    cache: {},
    timings: e.timings,
  };
}
