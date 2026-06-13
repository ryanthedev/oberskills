/**
 * browser_geolocation — set geolocation for the active page.
 * Lat/lon bounds: -90..90, -180..180 (validated by the zod schema).
 * Accuracy defaults to 1m.
 */
import { z } from "zod";
import { getPort } from "../core/session.ts";
import { ensureAlive, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { GeolocationInputSchema, type GeolocationOut } from "../types.ts";

export const name = "browser_geolocation";
export const title = "Set geolocation for the active page";
export const description =
  "Sets the browser's geolocation (latitude/longitude/accuracy) for the active page. " +
  "Latitude must be -90..90, longitude -180..180. Accuracy in meters (default 1). " +
  "Returns connection_lost if the browser died. Never throws.";

export const inputShape = GeolocationInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    await port.setGeolocation({
      latitude: args.latitude,
      longitude: args.longitude,
      ...(args.accuracy !== undefined ? { accuracy: args.accuracy } : {}),
    });
    const accuracy = args.accuracy ?? 1;
    const out: GeolocationOut = { latitude: args.latitude, longitude: args.longitude, accuracy };
    return ok(`geolocation set: ${args.latitude}, ${args.longitude} (accuracy ${accuracy}m)`, out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
