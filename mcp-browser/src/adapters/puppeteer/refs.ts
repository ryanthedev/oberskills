/**
 * Ref registry + snapshot→ref builder (ADAPTER-INTERNAL). Maps each interactive
 * a11y node to a stable opaque `ref` string and the live puppeteer ElementHandle
 * behind it. Refs invalidate on the next snapshot (page change): a new snapshot
 * bumps the epoch and disposes the prior handles, so a ref minted before is
 * detected as stale (issued, not live) — distinct from a never-issued unknown ref.
 *
 * Puppeteer's ElementHandle never escapes this layer; the builder emits the core
 * AxNode DTO (plain data + opaque ref). The only puppeteer surface used is the
 * structural `RawAxNode` shape (a subset of SerializedAXNode) — typed structurally
 * so this file's unit test can stand in a fake without importing puppeteer.
 */
import type { AxNode } from "../../core/browser-port.ts";

/**
 * Structural subset of puppeteer's SerializedAXNode the builder reads. Declared
 * structurally (not imported) so the registry stays unit-testable with a fake and
 * the heavy puppeteer type only appears where the real snapshot is produced.
 */
export type RawAxNode = {
  role: string;
  name?: string;
  value?: string | number;
  level?: number;
  checked?: boolean | "mixed";
  disabled?: boolean;
  selected?: boolean;
  children?: RawAxNode[];
  /** puppeteer SerializedAXNode.elementHandle(); null when the DOM element is gone. */
  elementHandle(): Promise<object | null>;
};

/** Roles whose nodes are actionable and therefore get a ref. */
const INTERACTIVE_ROLES = new Set<string>([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem",
]);

export function isInteractiveRole(role: string): boolean {
  return INTERACTIVE_ROLES.has(role);
}

/** A disposable handle — ElementHandle has dispose(); typed structurally. */
type Disposable = { dispose?: () => Promise<void> };

/**
 * ref → handle map with epoch-based invalidation. `isLive` is true only for refs
 * minted by the current epoch; `wasIssued` stays true forever so the resolver can
 * tell stale (issued, dead) from unknown (never issued).
 */
export class RefRegistry {
  private epoch = 0;
  private live = new Map<string, object>();
  private readonly issued = new Set<string>();

  /** Begin a new snapshot: dispose prior handles, clear the live set, bump epoch. */
  async newEpoch(): Promise<void> {
    for (const handle of this.live.values()) {
      const d = handle as Disposable;
      if (typeof d.dispose === "function") {
        try {
          await d.dispose();
        } catch {
          // a detached handle may already be disposed — nothing to recover.
        }
      }
    }
    this.live.clear();
    this.epoch += 1;
  }

  /** Mint a ref for a handle in the current epoch. */
  add(handle: object, seq: number): string {
    const ref = `r${this.epoch}-${seq}`;
    this.live.set(ref, handle);
    this.issued.add(ref);
    return ref;
  }

  isLive(ref: string): boolean {
    return this.live.has(ref);
  }

  wasIssued(ref: string): boolean {
    return this.issued.has(ref);
  }

  get(ref: string): object | null {
    return this.live.get(ref) ?? null;
  }
}

/**
 * Walk a raw AX tree, mint a ref per interactive node, register its handle, and
 * emit the compact core AxNode tree (plain data, opaque refs only). Bumps the
 * registry epoch first so a re-snapshot invalidates prior refs. Empty structural
 * containers are pruned to keep the tree compact.
 */
export async function buildSnapshot(
  raw: RawAxNode[],
  registry: RefRegistry,
): Promise<{ tree: AxNode[]; refs: string[] }> {
  await registry.newEpoch();
  const refs: string[] = [];
  let seq = 0;

  const convert = async (node: RawAxNode): Promise<AxNode | null> => {
    const children: AxNode[] = [];
    for (const child of node.children ?? []) {
      const c = await convert(child);
      if (c) children.push(c);
    }

    const out: AxNode = { role: node.role };
    if (node.name !== undefined) out.name = node.name;
    if (node.value !== undefined) out.value = node.value;
    if (node.level !== undefined) out.level = node.level;
    if (node.checked !== undefined) out.checked = node.checked;
    if (node.disabled !== undefined) out.disabled = node.disabled;
    if (node.selected !== undefined) out.selected = node.selected;
    if (children.length) out.children = children;

    if (isInteractiveRole(node.role)) {
      const handle = await node.elementHandle();
      if (handle) {
        seq += 1;
        const ref = registry.add(handle, seq);
        out.ref = ref;
        refs.push(ref);
      }
    }

    // Compact: drop a node that is neither interactive, named, nor a parent.
    const meaningful =
      out.ref !== undefined || out.name !== undefined || out.value !== undefined || (out.children?.length ?? 0) > 0;
    return meaningful ? out : null;
  };

  const tree: AxNode[] = [];
  for (const node of raw) {
    const c = await convert(node);
    if (c) tree.push(c);
  }
  return { tree, refs };
}
