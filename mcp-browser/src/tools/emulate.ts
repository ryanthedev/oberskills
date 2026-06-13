/**
 * browser_emulate — one multiplexed tool for network + CPU throttling. Out-of-range
 * values are rejected at the barricade (throttle_out_of_range) — defined, not
 * silent: a wrong throttle silently applied would corrupt a perf measurement
 * (correctness lean, RF-12).
 *
 * Network is either a named preset (none|offline|slow-3g|fast-3g) OR an explicit
 * {download_kbps, upload_kbps, latency_ms} triple, folded into a NetworkProfile.
 */
import { z } from "zod";
import { BrowserError } from "../core/errors.ts";
import { getPort } from "../core/session.ts";
import { ensureAlive, errFromBrowserError, ok, runPort, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { CPU_THROTTLE_MAX, CPU_THROTTLE_MIN, EmulateInputSchema, type EmulateOut } from "../types.ts";
import type { EmulateConditionsOpts, NetworkProfile } from "../core/browser-port.ts";

export const name = "browser_emulate";
export const title = "Throttle network and/or CPU";
export const description =
  "Applies network and/or CPU throttling for performance testing. network: none | offline | slow-3g | fast-3g, " +
  "or explicit download_kbps/upload_kbps/latency_ms. cpu_throttling_rate is a 1..20 slowdown multiplier (1 = none). " +
  "Out-of-range values return throttle_out_of_range (not a silent clamp). Never throws.";

export const inputShape = EmulateInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

/** Build the network profile from input, validating ranges. Returns profile | undefined | error. */
function buildNetwork(args: Input): NetworkProfile | undefined | BrowserError {
  if (args.network !== undefined) return args.network;
  const explicit = args.download_kbps !== undefined || args.upload_kbps !== undefined || args.latency_ms !== undefined;
  if (!explicit) return undefined;
  const download = args.download_kbps ?? 0;
  const upload = args.upload_kbps ?? 0;
  const latency = args.latency_ms ?? 0;
  if (download < 0 || upload < 0 || latency < 0) {
    return new BrowserError(
      "throttle_out_of_range",
      `negative throttle value (download=${download} upload=${upload} latency=${latency})`,
      "use non-negative kbps/latency, or a named preset",
    );
  }
  return { downloadKbps: download, uploadKbps: upload, latencyMs: latency };
}

export async function handler(args: Input): Promise<ToolResult> {
  // Barricade: CPU range.
  if (args.cpu_throttling_rate !== undefined) {
    const rate = args.cpu_throttling_rate;
    if (!Number.isFinite(rate) || rate < CPU_THROTTLE_MIN || rate > CPU_THROTTLE_MAX) {
      return errFromBrowserError(
        new BrowserError(
          "throttle_out_of_range",
          `cpu_throttling_rate ${rate} is outside ${CPU_THROTTLE_MIN}..${CPU_THROTTLE_MAX}`,
          `use a multiplier in ${CPU_THROTTLE_MIN}..${CPU_THROTTLE_MAX} (1 = no throttle)`,
        ),
      );
    }
  }

  const network = buildNetwork(args);
  if (network instanceof BrowserError) return errFromBrowserError(network);

  if (network === undefined && args.cpu_throttling_rate === undefined) {
    return errFromBrowserError(
      new BrowserError("throttle_out_of_range", "no throttle specified", "set network and/or cpu_throttling_rate"),
    );
  }

  const port = getPort();
  const dead = await ensureAlive(port);
  if (dead) return dead;

  return runPort(async () => {
    const opts: EmulateConditionsOpts = {
      ...(network !== undefined ? { network } : {}),
      ...(args.cpu_throttling_rate !== undefined ? { cpuThrottlingRate: args.cpu_throttling_rate } : {}),
    };
    await port.emulateConditions(opts);
    const out: EmulateOut = {
      network: typeof network === "string" ? network : network !== undefined ? "custom" : null,
      cpu_throttling_rate: args.cpu_throttling_rate ?? null,
    };
    return ok("emulation applied", out);
  });
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
