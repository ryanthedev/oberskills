/**
 * Targeting — the GoF Strategy contract for locating an element to act on. ref,
 * selector, and coordinate targets are interchangeable behind ONE resolver
 * signature (`BrowserPort.resolveTarget` / `interact`), so no tool grows an
 * `if (ref) … else if (selector) …` ladder. The resolver picks a concrete
 * strategy by the Target's shape; adding a strategy is a registry entry, not a
 * new branch in every tool.
 *
 * INVARIANT: lives in the dependency-free core. `ResolvedTarget` is an opaque
 * token (like PageHandle) — core/tools never read a puppeteer object off it; the
 * adapter brands and resolves it internally.
 */

/**
 * Where to act. Exactly the plan's pinned `Target` union:
 *  - ref:      primary path — a stable id minted by the last snapshot()
 *  - selector: fallback — CSS (+ optional pierce/matchText/visible/nth disambiguation)
 *  - coords:   last-resort — a viewport pixel point
 */
export type Target =
  | { ref: string }
  | { selector: string; pierce?: boolean; matchText?: string; visible?: boolean; nth?: number }
  | { x: number; y: number };

/** The three interchangeable strategies, keyed off the Target discriminant. */
export type TargetKind = "ref" | "selector" | "coords";

/** Classify a Target into its strategy. The SINGLE place the discriminant lives. */
export function targetKind(t: Target): TargetKind {
  if ("ref" in t) return "ref";
  if ("selector" in t) return "selector";
  return "coords";
}

/**
 * Opaque resolved handle the adapter hands back from resolveTarget(). Carries the
 * resolver kind for diagnostics; `token` is adapter-owned (a puppeteer
 * ElementHandle or a coordinate pair) and MUST NOT be inspected by core/tools.
 */
export type ResolvedTarget = {
  readonly kind: TargetKind;
  readonly token: unknown;
};

/** What `interact()` can do to a resolved element. */
export type InteractAction =
  | "click"
  | "type"
  | "hover"
  | "select"
  | "fill"
  | "press_key"
  | "drag";

/** Modifier-key bitmask (mirrors CDP/puppeteer: Alt=1, Ctrl=2, Meta/Cmd=4, Shift=8). */
export const Modifier = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 } as const;
export type ModifierName = keyof typeof Modifier;

/** Decode a modifier bitmask into the active modifier names. Pure. */
export function decodeModifiers(mask: number): ModifierName[] {
  const out: ModifierName[] = [];
  for (const name of Object.keys(Modifier) as ModifierName[]) {
    if ((mask & Modifier[name]) !== 0) out.push(name);
  }
  return out;
}

/** Per-action payload. Each field is read only by the relevant action. */
export type InteractOpts = {
  /** type/fill: text to enter. */
  text?: string;
  /** select: option values to choose. */
  values?: string[];
  /** press_key: the key (e.g. "Enter", "a"). */
  key?: string;
  /** press_key: modifier bitmask. */
  modifiers?: number;
  /** drag: the drop target. */
  to?: Target;
  /** click: button / count. */
  button?: "left" | "right" | "middle";
  clickCount?: number;
};

/** fill_form entry: one field Target + the value to set. */
export type FillFormField = { target: Target; value: string };
