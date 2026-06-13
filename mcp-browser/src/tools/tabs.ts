/**
 * browser_tabs — driving adapter (tool). One multiplexed tool with an action arg
 * (list | new | select | close), per the research's tab-multiplex decision.
 *
 * Liveness barricade (cc-defensive, RF-12): every action first checks the port's
 * liveness. A dead connection returns a structured connection_lost error with a
 * reconnect hint — never a silent retry that masks the failure, never a throw.
 * select/close require a tab_id; a missing id is a validation error, not a throw.
 */
import { z } from "zod";
import { BrowserError, isBrowserError } from "../core/errors.ts";
import type { TabInfo } from "../core/browser-port.ts";
import { getPort } from "../core/session.ts";
import { errFromBrowserError, err, ok, type ToolModule, type ToolResult } from "../lib/tool.ts";
import { TabsInputSchema, type TabInfoOut } from "../types.ts";

export const name = "browser_tabs";
export const title = "List, open, select, or close browser tabs";
export const description =
  "Manages browser tabs over the persistent connection. action=list returns every open tab (id, url, title, " +
  "active); action=new opens a tab (optional url) and makes it active; action=select switches the active tab by " +
  "tab_id; action=close closes a tab by tab_id, promoting the next remaining tab to active (or reporting " +
  "no_active_tab when none remain). Returns connection_lost if the browser has died; never throws to the client.";

export const inputShape = TabsInputSchema;

type Input = z.output<z.ZodObject<typeof inputShape>>;

function toOut(t: TabInfo): TabInfoOut {
  return { tab_id: t.tabId, url: t.url, title: t.title, active: t.active };
}

const connectionLost = new BrowserError(
  "connection_lost",
  "the browser connection is no longer alive",
  "reconnect with browser_connect before retrying tab operations",
);

export async function handler(args: Input): Promise<ToolResult> {
  const port = getPort();

  // Liveness barricade — do not proceed against a dead connection.
  let alive: boolean;
  try {
    alive = await port.isAlive();
  } catch {
    alive = false;
  }
  if (!alive) return errFromBrowserError(connectionLost);

  try {
    switch (args.action) {
      case "list": {
        const tabs = (await port.listTabs()).map(toOut);
        return ok(`${tabs.length} tab(s)`, { tabs });
      }
      case "new": {
        const tab = toOut(await port.newTab(args.url));
        return ok(`opened tab ${tab.tab_id}${tab.url ? ` (${tab.url})` : ""}`, { tab });
      }
      case "select": {
        if (!args.tab_id) return err("select requires tab_id", { code: "unknown_tab" });
        const tab = toOut(await port.selectTab(args.tab_id));
        return ok(`selected tab ${tab.tab_id}`, { tab });
      }
      case "close": {
        if (!args.tab_id) return err("close requires tab_id", { code: "unknown_tab" });
        await port.closeTab(args.tab_id);
        const remaining = (await port.listTabs()).map(toOut);
        const active = remaining.find((t) => t.active) ?? null;
        return ok(
          active ? `closed ${args.tab_id}; active tab is now ${active.tab_id}` : `closed ${args.tab_id}; no_active_tab`,
          { closed: args.tab_id, active, no_active_tab: active === null },
        );
      }
    }
  } catch (e) {
    if (isBrowserError(e)) return errFromBrowserError(e);
    throw e;
  }
}

void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);
