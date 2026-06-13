/**
 * MCP server construction for mcp-browser: registers the P1 tools on an McpServer,
 * installs the puppeteer-core driven adapter as the active BrowserPort, and
 * connects the stdio transport. Imported dynamically by server.ts so a missing
 * node_modules (SessionStart install hook hasn't completed) produces a clear
 * startup error instead of a cryptic module-resolution stack. Mirrors
 * mcp/src/register.ts: defineTool compile-time bridge + a single error boundary.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import { setHarPort, setPort } from "./core/session.ts";
import { log } from "./lib/log.ts";
import { friendlyMessage, type ToolModule, type ToolResult } from "./lib/tool.ts";
import * as connect from "./tools/connect.ts";
import * as tabs from "./tools/tabs.ts";
import * as snapshot from "./tools/snapshot.ts";
import * as click from "./tools/click.ts";
import * as type_ from "./tools/type.ts";
import * as hover from "./tools/hover.ts";
import * as select from "./tools/select.ts";
import * as pressKey from "./tools/press-key.ts";
import * as drag from "./tools/drag.ts";
import * as fillForm from "./tools/fill-form.ts";
import * as navigate from "./tools/navigate.ts";
import * as wait from "./tools/wait.ts";
import * as scroll from "./tools/scroll.ts";
import * as screenshot from "./tools/screenshot.ts";
import * as dom from "./tools/dom.ts";
import * as accessibility from "./tools/accessibility.ts";
import * as extract from "./tools/extract.ts";
import * as collect from "./tools/collect.ts";
import * as evaluate from "./tools/evaluate.ts";
import * as dismiss from "./tools/dismiss.ts";
import * as form from "./tools/form.ts";
import * as performanceStartTrace from "./tools/performance-start-trace.ts";
import * as performanceStopTrace from "./tools/performance-stop-trace.ts";
import * as analyzeInsight from "./tools/analyze-insight.ts";
import * as lighthouseAudit from "./tools/lighthouse-audit.ts";
import * as exportHar from "./tools/export-har.ts";
import * as route from "./tools/route.ts";
import * as emulate from "./tools/emulate.ts";

const INSTRUCTIONS = `Persistent Chrome/CDP control via puppeteer-core, in a hexagonal architecture.
Phase 1 surface — connection + tabs:
- browser_connect: open the persistent connection (launch-own Chrome via executable_path/channel, or attach to a
  running Chrome via exactly one of browser_url / ws_endpoint). Run this first.
- browser_tabs: list / new / select / close tabs over that connection.
All tools return a structured {code,message,suggestion} error (never a thrown exception) on bad input or a lost
connection; the connection is held across calls for the life of the server process.`;

/**
 * Server version comes from the plugin manifest (single version source of truth):
 * $CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json, with an import.meta-relative
 * fallback for running outside Claude Code (tests, manual bun run).
 */
function readVersion(): string {
  const candidates: (string | URL)[] = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(join(process.env.CLAUDE_PLUGIN_ROOT, ".claude-plugin", "plugin.json"));
  }
  candidates.push(new URL("../../.claude-plugin/plugin.json", import.meta.url));
  for (const candidate of candidates) {
    try {
      const manifest: unknown = JSON.parse(readFileSync(candidate, "utf8"));
      if (typeof manifest === "object" && manifest !== null) {
        const v = (manifest as Record<string, unknown>).version;
        if (typeof v === "string") return v;
      }
    } catch {
      // try next candidate
    }
  }
  return "0.0.0";
}

export type RegisteredTool = {
  name: string;
  title: string;
  description: string;
  inputShape: z.ZodRawShape;
  invoke: (args: unknown) => Promise<ToolResult>;
};

/**
 * Compile-time bridge from a typed tool module to the registration list: the
 * module's handler must accept exactly the z.output of its own inputShape, or
 * this call fails to compile. The single `as` below is the runtime trust
 * boundary — the SDK has already validated args against that same inputShape
 * before invoking.
 */
function defineTool<Shape extends z.ZodRawShape>(mod: ToolModule<Shape>): RegisteredTool {
  return {
    name: mod.name,
    title: mod.title,
    description: mod.description,
    inputShape: mod.inputShape,
    invoke: (args: unknown) => mod.handler(args as z.output<z.ZodObject<Shape>>),
  };
}

export const TOOLS: RegisteredTool[] = [
  defineTool(connect),
  defineTool(tabs),
  defineTool(snapshot),
  defineTool(click),
  defineTool(type_),
  defineTool(hover),
  defineTool(select),
  defineTool(pressKey),
  defineTool(drag),
  defineTool(fillForm),
  defineTool(navigate),
  defineTool(wait),
  defineTool(scroll),
  defineTool(screenshot),
  defineTool(dom),
  defineTool(accessibility),
  defineTool(extract),
  defineTool(collect),
  defineTool(evaluate),
  defineTool(dismiss),
  defineTool(form),
  defineTool(performanceStartTrace),
  defineTool(performanceStopTrace),
  defineTool(analyzeInsight),
  defineTool(lighthouseAudit),
  defineTool(exportHar),
  defineTool(route),
  defineTool(emulate),
];

/**
 * The single error boundary wrapping every tool handler. Exported so a unit test
 * can prove a thrown handler becomes an isError result rather than propagating.
 */
export function buildErrorBoundaryHandler(
  toolName: string,
  invoke: (args: unknown) => Promise<ToolResult>,
): (args: unknown) => Promise<ToolResult> {
  return async (args: unknown) => {
    try {
      return await invoke(args);
    } catch (e) {
      log(`${toolName} failed:`, friendlyMessage(e));
      return {
        isError: true,
        content: [{ type: "text" as const, text: `${toolName} failed: ${friendlyMessage(e)}` }],
      };
    }
  };
}

export async function startServer(): Promise<void> {
  // Install the puppeteer-core driven adapter. Imported here (not at module top)
  // so unit tests that import TOOLS/buildErrorBoundaryHandler never load puppeteer.
  const { PuppeteerConnectionManager } = await import("./adapters/puppeteer/connection.ts");
  setPort(new PuppeteerConnectionManager());
  // Install the real HAR writer (driven adapter behind the HarPort seam).
  const { FsHarWriter } = await import("./adapters/fs/har-writer.ts");
  setHarPort(new FsHarWriter());

  const server = new McpServer(
    { name: "mcp-browser", version: readVersion() },
    { instructions: INSTRUCTIONS },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputShape },
      buildErrorBoundaryHandler(tool.name, tool.invoke),
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`mcp-browser ${readVersion()} connected (${TOOLS.length} tools)`);
}
