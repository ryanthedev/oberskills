/**
 * Session accessor — the single long-lived BrowserPort the server holds across
 * tool calls (the connection is persistent; the process is one). Tools obtain the
 * active port through getPort(); tests swap it with setPort()/resetSession().
 *
 * This lives in core and is dependency-free: it stores a BrowserPort interface,
 * never a puppeteer object. The production puppeteer adapter is installed by
 * register.ts at startup; unit tests install a fake.
 */
import type { BrowserPort } from "./browser-port.ts";
import type { HarPort } from "./har-port.ts";

let activePort: BrowserPort | null = null;
let activeHarPort: HarPort | null = null;

export function setPort(port: BrowserPort): void {
  activePort = port;
}

export function getPort(): BrowserPort {
  if (activePort === null) {
    // A programmer/bootstrap bug, not a runtime/user error: register.ts must
    // install a port before any tool runs. The registrar error boundary turns
    // this into an isError result rather than crashing the transport.
    throw new Error("no BrowserPort installed — register.ts must call setPort() at startup");
  }
  return activePort;
}

/**
 * The HAR writer (driven adapter) the export_har tool routes entries through.
 * register.ts installs the real FsHarWriter at startup; tests install a fake
 * (proving the HarPort seam substitutes — DW-4.6). Defaults are installed lazily
 * by getHarPort() so a tool can run before register.ts in unit tests.
 */
export function setHarPort(har: HarPort): void {
  activeHarPort = har;
}

export function getHarPort(): HarPort {
  if (activeHarPort === null) {
    throw new Error("no HarPort installed — register.ts must call setHarPort() at startup");
  }
  return activeHarPort;
}

export function resetSession(): void {
  activePort = null;
  activeHarPort = null;
}
