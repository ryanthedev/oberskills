/**
 * Device / geolocation / permissions emulation (ADAPTER-INTERNAL).
 * Puppeteer types live here.
 *
 * Barricade:
 *  - emulateDevice: unknown preset → emulation_failed (never silently ignored)
 *  - setGeolocation: lat/lon range already validated by the tool barricade;
 *    accuracy defaults to 1m when absent
 *  - grantPermissions: unknown permission names validated at tool barricade;
 *    this module trusts the names are from the allowlist
 */
import type { Page } from "puppeteer-core";
import { KnownDevices } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type { DeviceProfile, GeolocationOpts, PermissionsOpts } from "../../core/browser-port.ts";

/**
 * Apply device emulation: either a named preset (from puppeteer's device catalog)
 * or explicit viewport dimensions.
 */
export async function emulateDevice(page: Page, opts: DeviceProfile): Promise<void> {
  if ("preset" in opts) {
    // Named device from puppeteer's KnownDevices catalog.
    const device = KnownDevices[opts.preset as keyof typeof KnownDevices];
    if (device === undefined) {
      throw new BrowserError(
        "emulation_failed",
        `unknown device preset "${opts.preset}"`,
        `use a name from puppeteer's device catalog (e.g. "iPhone 12", "Pixel 5")`,
      );
    }
    await page.emulate(device);
  } else {
    // Explicit viewport dimensions.
    await page.setViewport({
      width: opts.width,
      height: opts.height,
      deviceScaleFactor: opts.deviceScaleFactor ?? 1,
      isMobile: opts.isMobile ?? false,
    });
  }
}

/**
 * Set geolocation for the page. Lat/lon validation happens at the tool barricade;
 * here we pass through to puppeteer. Accuracy defaults to 1m.
 */
export async function setGeolocation(page: Page, opts: GeolocationOpts): Promise<void> {
  await page.setGeolocation({
    latitude: opts.latitude,
    longitude: opts.longitude,
    accuracy: opts.accuracy ?? 1,
  });
}

/**
 * Grant browser permissions for the page's origin (or a supplied origin).
 * Permission names have already been validated against the allowlist at the
 * tool barricade before this is called.
 */
export async function grantPermissions(page: Page, opts: PermissionsOpts): Promise<void> {
  const context = page.browserContext();
  const origin = opts.origin ?? page.url();
  // Puppeteer's BrowserContext.overridePermissions takes a list of permissions.
  // We pass them as-is since barricade validation has already run.
  await context.overridePermissions(origin, opts.permissions as Parameters<typeof context.overridePermissions>[1]);
}
