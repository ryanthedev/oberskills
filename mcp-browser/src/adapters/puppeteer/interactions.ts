/**
 * Targeting Strategy resolvers + action executors (ADAPTER-INTERNAL). The three
 * resolvers (ref / selector / coords) are interchangeable behind resolveOnPage();
 * the dispatch picks one by the Target discriminant (targetKind) in a SINGLE
 * switch — no resolution ladder leaks into the port methods or the tools.
 *
 * Puppeteer types live here (adapter layer). ElementHandles resolved from the ref
 * registry or a selector are acted on with auto-wait; a coordinate target acts via
 * the mouse. A disposed/detached ref handle becomes stale_ref; a never-issued ref
 * becomes unknown_ref — the registry distinguishes the two.
 */
import type { ElementHandle, Page } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import { decodeModifiers, targetKind, type InteractAction, type InteractOpts, type ModifierName, type Target } from "../../core/targeting.ts";
import type { RefRegistry } from "./refs.ts";

/** Map our modifier names to puppeteer/CDP KeyInput names ("Ctrl" → "Control"). */
const MODIFIER_KEY: Record<ModifierName, "Control" | "Alt" | "Meta" | "Shift"> = {
  Ctrl: "Control",
  Alt: "Alt",
  Meta: "Meta",
  Shift: "Shift",
};

/** What a resolved target is, internally: an element handle OR a viewport point. */
export type ResolvedEl =
  | { kind: "ref" | "selector"; handle: ElementHandle }
  | { kind: "coords"; x: number; y: number };

/** Puppeteer KeyInput is a wide string-literal union; we pass keys through as that. */
type KeyInput = Parameters<Page["keyboard"]["press"]>[0];

/**
 * Resolve a Target on a page via the Strategy. The single switch on targetKind is
 * the only place the three strategies branch.
 */
export async function resolveOnPage(page: Page, registry: RefRegistry, t: Target): Promise<ResolvedEl> {
  switch (targetKind(t)) {
    case "ref":
      return resolveRef(registry, (t as { ref: string }).ref);
    case "selector":
      return resolveSelector(page, t as { selector: string; matchText?: string; visible?: boolean; nth?: number });
    case "coords":
      return resolveCoords(page, t as { x: number; y: number });
  }
}

async function resolveRef(registry: RefRegistry, ref: string): Promise<ResolvedEl> {
  if (!registry.wasIssued(ref)) {
    throw new BrowserError("unknown_ref", `no such ref: ${ref}`, "run browser_snapshot to see current refs");
  }
  const handle = registry.get(ref);
  if (!handle) {
    throw new BrowserError("stale_ref", `ref ${ref} is from a previous page`, "re-run browser_snapshot to refresh refs");
  }
  // A live handle can still be detached if the DOM changed without a re-snapshot.
  const el = handle as ElementHandle;
  let connected = false;
  try {
    connected = await el.evaluate((node) => node.isConnected);
  } catch {
    connected = false;
  }
  if (!connected) {
    throw new BrowserError("stale_ref", `ref ${ref} no longer points at a live element`, "re-run browser_snapshot to refresh refs");
  }
  return { kind: "ref", handle: el };
}

async function resolveSelector(
  page: Page,
  sel: { selector: string; matchText?: string; visible?: boolean; nth?: number },
): Promise<ResolvedEl> {
  let handles = await page.$$(sel.selector);
  if (sel.matchText !== undefined) {
    const wanted = sel.matchText;
    const filtered: ElementHandle[] = [];
    for (const h of handles) {
      const text = await h.evaluate((n) => (n.textContent ?? ""));
      if (text.includes(wanted)) filtered.push(h);
    }
    handles = filtered;
  }
  if (sel.visible === true) {
    const filtered: ElementHandle[] = [];
    for (const h of handles) {
      const box = await h.boundingBox();
      if (box) filtered.push(h);
    }
    handles = filtered;
  }
  if (handles.length === 0) {
    throw new BrowserError("no_match", `selector matched nothing: ${sel.selector}`, "check the selector or run browser_snapshot");
  }
  if (handles.length > 1 && sel.nth === undefined) {
    throw new BrowserError(
      "ambiguous_match",
      `selector matched ${handles.length} elements: ${sel.selector}`,
      "add nth to pick one, refine with match_text/visible, or use a ref",
    );
  }
  const index = sel.nth ?? 0;
  const chosen = handles[index];
  if (!chosen) {
    throw new BrowserError("no_match", `selector ${sel.selector} has no element at nth=${index}`, "use a smaller nth or omit it");
  }
  return { kind: "selector", handle: chosen };
}

async function resolveCoords(page: Page, c: { x: number; y: number }): Promise<ResolvedEl> {
  const vp = page.viewport();
  const width = vp?.width ?? Number.POSITIVE_INFINITY;
  const height = vp?.height ?? Number.POSITIVE_INFINITY;
  if (c.x < 0 || c.y < 0 || c.x > width || c.y > height) {
    throw new BrowserError("coord_out_of_viewport", `(${c.x},${c.y}) is outside the viewport`, "scroll the target into view or use a ref");
  }
  return { kind: "coords", x: c.x, y: c.y };
}

/** Execute an action on an already-resolved target. Auto-wait is handled by puppeteer. */
export async function executeAction(
  page: Page,
  registry: RefRegistry,
  action: InteractAction,
  resolved: ResolvedEl,
  opts: InteractOpts | undefined,
): Promise<void> {
  try {
    switch (action) {
      case "click":
        return await clickAt(page, resolved, opts);
      case "hover":
        return await hoverAt(page, resolved);
      case "type":
      case "fill":
        return await typeInto(page, resolved, opts?.text ?? "", action === "fill");
      case "select":
        return await selectIn(resolved, opts?.values ?? []);
      case "press_key":
        return await pressOn(page, resolved, opts);
      case "drag":
        return await dragTo(page, registry, resolved, opts);
    }
  } catch (e) {
    if (e instanceof BrowserError) throw e;
    throw new BrowserError("interaction_failed", `${action} failed: ${e instanceof Error ? e.message : String(e)}`, "re-run browser_snapshot and retry, or try a different target");
  }
}

async function clickAt(page: Page, r: ResolvedEl, opts: InteractOpts | undefined): Promise<void> {
  const clickOpts = {
    ...(opts?.button ? { button: opts.button } : {}),
    ...(opts?.clickCount ? { count: opts.clickCount } : {}),
  };
  if (r.kind === "coords") {
    await page.mouse.click(r.x, r.y, clickOpts);
    return;
  }
  await r.handle.click(clickOpts);
}

async function hoverAt(page: Page, r: ResolvedEl): Promise<void> {
  if (r.kind === "coords") {
    await page.mouse.move(r.x, r.y);
    return;
  }
  await r.handle.hover();
}

async function typeInto(page: Page, r: ResolvedEl, text: string, clearFirst: boolean): Promise<void> {
  if (r.kind === "coords") {
    await page.mouse.click(r.x, r.y);
    if (clearFirst) await selectAllAndDelete(page);
    await page.keyboard.type(text);
    return;
  }
  if (clearFirst) {
    await r.handle.click({ count: 3 });
    await page.keyboard.press("Backspace");
  }
  await r.handle.type(text);
}

async function selectAllAndDelete(page: Page): Promise<void> {
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
}

async function selectIn(r: ResolvedEl, values: string[]): Promise<void> {
  if (r.kind === "coords") {
    throw new BrowserError("interaction_failed", "select needs an element target, not coordinates", "target the <select> by ref or selector");
  }
  await r.handle.select(...values);
}

async function pressOn(page: Page, r: ResolvedEl, opts: InteractOpts | undefined): Promise<void> {
  if (r.kind !== "coords") await r.handle.focus();
  const mods = decodeModifiers(opts?.modifiers ?? 0).map((m) => MODIFIER_KEY[m]);
  for (const m of mods) await page.keyboard.down(m);
  try {
    await page.keyboard.press((opts?.key ?? "Enter") as KeyInput);
  } finally {
    for (const m of [...mods].reverse()) await page.keyboard.up(m);
  }
}

async function dragTo(page: Page, registry: RefRegistry, source: ResolvedEl, opts: InteractOpts | undefined): Promise<void> {
  if (!opts?.to) {
    throw new BrowserError("interaction_failed", "drag needs a drop target", "supply to_ref/to_selector/to_x-to_y");
  }
  const dest = await resolveOnPage(page, registry, opts.to); // honors the Strategy → stale/unknown/ambiguous
  const from = await pointOf(source);
  const to = await pointOf(dest);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

async function pointOf(r: ResolvedEl): Promise<{ x: number; y: number }> {
  if (r.kind === "coords") return { x: r.x, y: r.y };
  const box = await r.handle.boundingBox();
  if (!box) {
    throw new BrowserError("interaction_failed", "element has no layout box (not visible)", "ensure the element is visible, or use coordinates");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
