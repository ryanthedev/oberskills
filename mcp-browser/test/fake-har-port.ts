/**
 * FakeHarPort — a non-puppeteer HarPort substitute (DW-4.6). Records the entries
 * handed to write() and returns a deterministic path without touching disk or
 * puppeteer. Proves the HarPort seam is a clean driven adapter a fake can replace.
 */
import type { HarEntry, HarPort } from "../src/core/har-port.ts";

export class FakeHarPort implements HarPort {
  /** Entries captured by the last write() call. */
  lastEntries: HarEntry[] | null = null;
  /** Count of write() calls. */
  writes = 0;
  /** Path write() returns. */
  returnPath = "/tmp/fake.har";

  async write(entries: HarEntry[]): Promise<string> {
    this.writes += 1;
    this.lastEntries = entries;
    return this.returnPath;
  }
}
