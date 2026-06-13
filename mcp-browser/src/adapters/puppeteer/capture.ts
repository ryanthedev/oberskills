/**
 * Capture operations: PDF export, file upload, download capture, screencast
 * lifecycle (ADAPTER-INTERNAL). Puppeteer types live here.
 *
 * Screencast (P5b deferred): The ScreencastController holds the lifecycle state
 * machine with typed errors (screencast_already_running, no_screencast_running).
 * Actual video frame assembly from CDP Page.screencastFrame is deferred to P5b
 * due to reliability concerns under headless bun. stopScreencast() returns
 * screencast_not_supported until P5b lands.
 *
 * Upload: resolves the element via page.$(selector) and calls element.uploadFile().
 * Non-file-input → upload_failed (not a silent no-op).
 *
 * Download: arms CDP Browser.setDownloadBehavior, waits for a file to appear in
 * a temp dir within timeoutMs. Throws download_timeout on expiry.
 *
 * PDF: uses CDP Page.printToPDF via createCDPSession(). Returns the raw bytes
 * (caller routes through writePayload).
 */
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type { PdfOpts } from "../../core/browser-port.ts";
import type { ResolvedEl } from "./interactions.ts";

/**
 * Screencast lifecycle controller. Mirrors TraceController's start/stop pattern.
 * Video assembly is deferred (P5b); this ships the typed-err lifecycle only.
 */
export class ScreencastController {
  private running = false;

  start(): void {
    if (this.running) {
      throw new BrowserError(
        "screencast_already_running",
        "a screencast is already running",
        "call browser_screencast_stop before starting another",
      );
    }
    this.running = true;
    // P5b: start CDP Page.startScreencast + frame accumulation here.
  }

  stop(): { path: string } {
    if (!this.running) {
      throw new BrowserError(
        "no_screencast_running",
        "no screencast is currently running",
        "call browser_screencast_start before stopping",
      );
    }
    this.running = false;
    // P5b: flush frames, assemble video file, return real path.
    throw new BrowserError(
      "screencast_not_supported",
      "screencast video assembly is deferred to P5b (CDP frame assembly unreliable under bun)",
      "use browser_screenshot or browser_pdf for now; screencast video will be available in P5b",
    );
  }

  get isRunning(): boolean {
    return this.running;
  }
}

/**
 * Export the active page as a PDF via CDP Page.printToPDF.
 * Returns raw PDF bytes (caller must route through writePayload).
 */
export async function printPdf(page: Page, opts?: PdfOpts): Promise<Buffer> {
  const cdp = await page.createCDPSession();
  try {
    const result = await cdp.send("Page.printToPDF", {
      ...(opts?.format !== undefined ? { paperWidth: undefined, paperHeight: undefined } : {}),
      printBackground: opts?.printBackground ?? true,
      landscape: opts?.landscape ?? false,
      ...(opts?.format !== undefined ? { format: opts.format } : {}),
    });
    // CDP returns data as base64-encoded string.
    const data = (result as { data: string }).data;
    return Buffer.from(data, "base64");
  } catch (e) {
    throw new BrowserError(
      "pdf_failed",
      `Page.printToPDF failed: ${e instanceof Error ? e.message : String(e)}`,
      "ensure the page is loaded and not navigating before exporting PDF",
    );
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * Upload a file to a resolved <input type="file"> element.
 * The element must already be resolved via resolveTarget (type ResolvedInternals).
 * Throws upload_failed for non-file inputs.
 */
export async function uploadFile(
  page: Page,
  resolved: ResolvedEl,
  filePath: string,
): Promise<void> {
  if (resolved.kind === "coords") {
    throw new BrowserError(
      "upload_failed",
      "coordinate targets are not supported for file upload — use a ref or selector for the <input type=file> element",
      "run browser_snapshot to find the file input ref, then use upload with ref=",
    );
  }

  const handle = resolved.handle;

  // Verify this is actually a file input.
  const isFileInput = await page.evaluate((el) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = el as any;
    return input.tagName === "INPUT" && input.type === "file";
  }, handle);

  if (!isFileInput) {
    throw new BrowserError(
      "upload_failed",
      "the target element is not an <input type=file>",
      "make sure the target is a file input element; use browser_snapshot to verify",
    );
  }

  await handle.uploadFile(filePath);
}

/**
 * Arm download capture and wait for a file to appear in a temp download dir.
 * Uses CDP Browser.setDownloadBehavior to redirect downloads to a temp dir,
 * then polls for a file to appear within timeoutMs.
 * Throws download_timeout when no file appears within the timeout.
 */
export async function captureDownload(
  page: Page,
  timeoutMs: number,
): Promise<{ path: string }> {
  const downloadDir = join(tmpdir(), `browser-mcp-download-${Date.now()}`);

  // CDP: redirect downloads to our temp dir.
  const cdp = await page.createCDPSession();
  try {
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });
  } catch {
    // Older CDP protocol may not support this — fall back to browser-level.
    try {
      const browser = page.browser();
      await (browser as unknown as { _connection?: { send: (method: string, params: unknown) => Promise<unknown> } })._connection?.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadDir,
      });
    } catch {
      // best effort
    }
  }

  // Poll for a completed download file in the download dir.
  const deadline = Date.now() + timeoutMs;
  let filePath: string | null = null;

  while (Date.now() < deadline) {
    if (existsSync(downloadDir)) {
      const files = readdirSync(downloadDir).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (files.length > 0 && files[0]) {
        filePath = join(downloadDir, files[0]);
        break;
      }
    }
    await new Promise<void>((r) => setTimeout(r, 250));
  }

  await cdp.detach().catch(() => {});

  if (filePath === null) {
    throw new BrowserError(
      "download_timeout",
      `no download completed within ${timeoutMs}ms`,
      "trigger the download action first (click a download link/button), then call browser_download",
    );
  }

  return { path: filePath };
}

/**
 * Wait for text to appear or disappear in the page body.
 * Throws wait_for_text_timeout naming the condition on expiry.
 */
export async function waitForText(
  page: Page,
  text: string,
  appear: boolean,
  timeoutMs: number,
): Promise<void> {
  const condition = appear ? "appear" : "disappear";
  try {
    await page.waitForFunction(
      (t: string, shouldAppear: boolean) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyText = (globalThis as any).document?.body?.textContent ?? "";
        const contains = (bodyText as string).includes(t);
        return shouldAppear ? contains : !contains;
      },
      { timeout: timeoutMs },
      text,
      appear,
    );
  } catch {
    throw new BrowserError(
      "wait_for_text_timeout",
      `wait_for_text timed out waiting for text to ${condition}: "${text}"`,
      `increase timeout_ms or check that the text will ${condition} on this page`,
    );
  }
}

// Re-export the internal resolved type for use within the adapter layer.
export type { ResolvedEl };
