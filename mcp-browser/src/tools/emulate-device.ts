/**
 * browser_emulate_device — apply device / viewport emulation. Either a named preset
 * (from puppeteer's device catalog) or explicit {width, height, ...} dims.
 *
 * Barricade: at least one of preset or width+height must be supplied.
 * Unknown preset names propagate as emulation_failed from the adapter.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { EmulateDeviceInputSchema, type EmulateDeviceOut } from "../types.ts";
import type { DeviceProfile } from "../core/browser-port.ts";

export const name = "browser_emulate_device";
export const title = "Emulate a device or set an explicit viewport";
export const description =
  'Emulate a named device (e.g. "iPhone 12", "Pixel 5") or set an explicit viewport size. ' +
  "Use preset= for named devices; use width+height for explicit dimensions. " +
  "Unknown device names return emulation_failed. Returns connection_lost if the browser died. Never throws.";

export const inputShape = EmulateDeviceInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: must supply either preset or explicit width+height.
  if (args.preset === undefined && (args.width === undefined || args.height === undefined)) {
    return errFromBrowserError(
      new BrowserError(
        "emulation_failed",
        "supply either preset= or both width= and height=",
        "use preset= for a named device (e.g. \"iPhone 12\"), or width/height for explicit dimensions",
      ),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    let opts: DeviceProfile;
    if (args.preset !== undefined) {
      opts = { preset: args.preset };
    } else {
      opts = {
        width: args.width!,
        height: args.height!,
        ...(args.device_scale_factor !== undefined ? { deviceScaleFactor: args.device_scale_factor } : {}),
        ...(args.is_mobile !== undefined ? { isMobile: args.is_mobile } : {}),
      };
    }

    await port.emulateDevice(opts);

    const out: EmulateDeviceOut = {
      ...(args.preset !== undefined ? { preset: args.preset } : {}),
      ...(args.width !== undefined ? { width: args.width } : {}),
      ...(args.height !== undefined ? { height: args.height } : {}),
    };
    return ok(
      args.preset !== undefined
        ? `emulated device: ${args.preset}`
        : `viewport set to ${args.width}×${args.height}`,
      out,
    );
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
