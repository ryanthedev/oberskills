/**
 * Storage operations adapter (ADAPTER-INTERNAL). Puppeteer types live here.
 * Handles cookies, localStorage, and sessionStorage get/set/delete for a page.
 *
 * Security: storage state contains credentials. This module:
 *  - Validates origins before restoring state (barricade).
 *  - Never logs cookie values.
 *  - All-or-nothing restore: validate first, then clear+restore.
 *
 * Cross-domain cookie policy: setting a cookie for a domain not matching the
 * active page origin requires allowCrossDomain=true. Without it, the op is an
 * explicit error (never a silent no-op — RF-11).
 *
 * NOTE on page.evaluate typing: functions passed to page.evaluate run in the
 * browser context. TypeScript cannot resolve browser globals (window, localStorage,
 * etc.) in this file's server-side context, so we use inline arrow functions with
 * serialized params — puppeteer serializes/deserializes the arguments automatically.
 * The TypeScript cast `(globalThis as any)` is the conventional pattern for
 * adapter-layer browser-context code (same approach as the existing connection.ts
 * scroll implementation).
 */
import type { CookieParam, Page } from "puppeteer-core";
import { BrowserError } from "../../core/errors.ts";
import type {
  CookieSetAttrs,
  StorageOp,
  StorageResult,
  StorageState,
} from "../../core/browser-port.ts";

/**
 * Get cookies for the given page, optionally filtered by name.
 */
export async function getCookies(page: Page, key: string): Promise<StorageResult> {
  const cookies = await page.cookies();
  const cookie = cookies.find((c) => c.name === key);
  return { value: cookie?.value ?? null };
}

/**
 * Get all cookies.
 */
export async function getAllCookies(page: Page): Promise<StorageResult> {
  const cookies = await page.cookies();
  return {
    entries: cookies.map((c) => ({ key: c.name, value: c.value })),
  };
}

/**
 * Set a cookie. Rejects cross-domain cookies without an explicit opt-in.
 */
export async function setCookie(
  page: Page,
  key: string,
  attrs: CookieSetAttrs,
  allowCrossDomain: boolean,
): Promise<StorageResult> {
  const pageUrl = page.url();
  const pageOrigin = safeOrigin(pageUrl);

  // Cross-domain check: if a domain is specified and differs from the page origin,
  // require explicit allowCrossDomain opt-in.
  if (attrs.domain !== undefined && pageOrigin !== null) {
    const targetDomain = attrs.domain.startsWith(".") ? attrs.domain.slice(1) : attrs.domain;
    if (!pageOrigin.hostname.endsWith(targetDomain) && pageOrigin.hostname !== targetDomain && !allowCrossDomain) {
      throw new BrowserError(
        "cross_domain_cookie",
        `cookie domain "${attrs.domain}" does not match active page origin "${pageOrigin.hostname}"`,
        'set allow_cross_domain=true to allow cross-domain cookies, or omit domain to use the current page domain',
      );
    }
  }

  const cookieToSet: CookieParam = {
    name: key,
    value: attrs.value,
    url: pageUrl,
    ...(attrs.domain !== undefined ? { domain: attrs.domain } : {}),
    ...(attrs.path !== undefined ? { path: attrs.path } : {}),
    ...(attrs.expiry !== undefined ? { expires: attrs.expiry } : {}),
    ...(attrs.httpOnly !== undefined ? { httpOnly: attrs.httpOnly } : {}),
    ...(attrs.secure !== undefined ? { secure: attrs.secure } : {}),
    ...(attrs.sameSite !== undefined ? { sameSite: attrs.sameSite } : {}),
  };

  await page.setCookie(cookieToSet);
  return {};
}

/**
 * Delete a cookie by name.
 */
export async function deleteCookie(page: Page, key: string): Promise<StorageResult> {
  await page.deleteCookie({ name: key });
  return {};
}

/**
 * Get a localStorage item.
 */
export async function getLocalStorage(page: Page, key: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  const result = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string) => (globalThis as any).localStorage?.getItem(k) as string | null,
    key,
  );
  return { value: result };
}

/**
 * Set a localStorage item.
 */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string, v: string) => { (globalThis as any).localStorage?.setItem(k, v); },
    key,
    value,
  );
  return {};
}

/**
 * Delete a localStorage item.
 */
export async function deleteLocalStorage(page: Page, key: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string) => { (globalThis as any).localStorage?.removeItem(k); },
    key,
  );
  return {};
}

/**
 * Get a sessionStorage item.
 */
export async function getSessionStorage(page: Page, key: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  const result = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string) => (globalThis as any).sessionStorage?.getItem(k) as string | null,
    key,
  );
  return { value: result };
}

/**
 * Set a sessionStorage item.
 */
export async function setSessionStorage(page: Page, key: string, value: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string, v: string) => { (globalThis as any).sessionStorage?.setItem(k, v); },
    key,
    value,
  );
  return {};
}

/**
 * Delete a sessionStorage item.
 */
export async function deleteSessionStorage(page: Page, key: string): Promise<StorageResult> {
  ensureHasOrigin(page);
  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (k: string) => { (globalThis as any).sessionStorage?.removeItem(k); },
    key,
  );
  return {};
}

/**
 * Capture all cookies + localStorage + sessionStorage for the active page.
 * Returns a StorageState DTO (core type, no puppeteer types).
 */
export async function captureStorageState(page: Page): Promise<StorageState> {
  const origin = page.url();
  const cookies = await page.cookies();
  let local: { key: string; value: string }[] = [];
  let session: { key: string; value: string }[] = [];

  const hasOrigin = safeOrigin(origin) !== null;
  if (hasOrigin) {
    local = await page.evaluate((): { key: string; value: string }[] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ls = (globalThis as any).localStorage;
      const out: { key: string; value: string }[] = [];
      if (!ls) return out;
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i) as string | null;
        if (k !== null) out.push({ key: k, value: (ls.getItem(k) as string | null) ?? "" });
      }
      return out;
    });

    session = await page.evaluate((): { key: string; value: string }[] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ss = (globalThis as any).sessionStorage;
      const out: { key: string; value: string }[] = [];
      if (!ss) return out;
      for (let i = 0; i < ss.length; i++) {
        const k = ss.key(i) as string | null;
        if (k !== null) out.push({ key: k, value: (ss.getItem(k) as string | null) ?? "" });
      }
      return out;
    });
  }

  return {
    origin,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      ...(c.domain ? { domain: c.domain } : {}),
      ...(c.path ? { path: c.path } : {}),
      ...(c.expires && c.expires > 0 ? { expires: c.expires } : {}),
      ...(c.httpOnly ? { httpOnly: c.httpOnly } : {}),
      ...(c.secure ? { secure: c.secure } : {}),
      ...(c.sameSite ? { sameSite: c.sameSite } : {}),
    })),
    localStorage: local,
    sessionStorage: session,
  };
}

/**
 * Restore a StorageState to the active page.
 * All-or-nothing: validate first, clear existing state, then restore.
 * Origin check: cross-origin cookies are skipped with a diagnostic.
 */
export async function restoreState(
  page: Page,
  state: StorageState,
): Promise<{ restored: string[]; skipped: string[] }> {
  const restored: string[] = [];
  const skipped: string[] = [];

  const pageOrigin = safeOrigin(page.url());
  const stateOrigin = safeOrigin(state.origin);

  // Clear existing cookies + storage before restore.
  const existingCookies = await page.cookies();
  if (existingCookies.length > 0) {
    await page.deleteCookie(...existingCookies.map((c) => ({ name: c.name })));
  }

  const hasOrigin = pageOrigin !== null;
  if (hasOrigin) {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      if (g.localStorage) g.localStorage.clear();
      if (g.sessionStorage) g.sessionStorage.clear();
    });
  }

  // Restore cookies: cross-origin cookies get skipped with diagnostic.
  for (const cookie of state.cookies) {
    const rawDomain = cookie.domain
      ? (cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain)
      : stateOrigin?.hostname;

    // Origin check: skip if page has an origin and cookie domain doesn't match.
    if (pageOrigin !== null && rawDomain !== undefined) {
      if (!pageOrigin.hostname.endsWith(rawDomain) && rawDomain !== pageOrigin.hostname) {
        skipped.push(`cookie:${cookie.name} (domain mismatch: ${rawDomain} vs ${pageOrigin.hostname})`);
        continue;
      }
    }

    try {
      const cookieToSet: CookieParam = {
        name: cookie.name,
        value: cookie.value,
        url: page.url(),
        ...(cookie.domain !== undefined ? { domain: cookie.domain } : {}),
        ...(cookie.path !== undefined ? { path: cookie.path } : {}),
        ...(cookie.expires !== undefined ? { expires: cookie.expires } : {}),
        ...(cookie.httpOnly !== undefined ? { httpOnly: cookie.httpOnly } : {}),
        ...(cookie.secure !== undefined ? { secure: cookie.secure } : {}),
        ...(cookie.sameSite !== undefined ? { sameSite: cookie.sameSite as CookieParam["sameSite"] } : {}),
      };
      await page.setCookie(cookieToSet);
      restored.push(`cookie:${cookie.name}`);
    } catch {
      skipped.push(`cookie:${cookie.name} (set failed)`);
    }
  }

  // Restore localStorage.
  if (hasOrigin) {
    for (const { key, value } of state.localStorage) {
      try {
        await page.evaluate(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (k: string, v: string) => { (globalThis as any).localStorage?.setItem(k, v); },
          key,
          value,
        );
        restored.push(`localStorage:${key}`);
      } catch {
        skipped.push(`localStorage:${key} (set failed)`);
      }
    }

    for (const { key, value } of state.sessionStorage) {
      try {
        await page.evaluate(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (k: string, v: string) => { (globalThis as any).sessionStorage?.setItem(k, v); },
          key,
          value,
        );
        restored.push(`sessionStorage:${key}`);
      } catch {
        skipped.push(`sessionStorage:${key} (set failed)`);
      }
    }
  } else if (state.localStorage.length > 0 || state.sessionStorage.length > 0) {
    for (const { key } of state.localStorage) {
      skipped.push(`localStorage:${key} (no-origin page)`);
    }
    for (const { key } of state.sessionStorage) {
      skipped.push(`sessionStorage:${key} (no-origin page)`);
    }
  }

  return { restored, skipped };
}

/**
 * Execute a StorageOp dispatch (the single multiplexed entry point).
 */
export async function executeStorageOp(
  page: Page,
  op: StorageOp,
): Promise<StorageResult> {
  switch (op.store) {
    case "cookies":
      switch (op.op) {
        case "get": return getCookies(page, op.key);
        case "delete": return deleteCookie(page, op.key);
        case "set": {
          const setOp = op as { store: "cookies"; op: "set"; key: string; attrs: CookieSetAttrs; allowCrossDomain?: boolean };
          return setCookie(page, setOp.key, setOp.attrs, setOp.allowCrossDomain ?? false);
        }
      }
      break;
    case "localStorage":
      switch (op.op) {
        case "get": return getLocalStorage(page, op.key);
        case "delete": return deleteLocalStorage(page, op.key);
        case "set": {
          const setOp = op as { store: "localStorage"; op: "set"; key: string; value: string };
          return setLocalStorage(page, setOp.key, setOp.value);
        }
      }
      break;
    case "sessionStorage":
      switch (op.op) {
        case "get": return getSessionStorage(page, op.key);
        case "delete": return deleteSessionStorage(page, op.key);
        case "set": {
          const setOp = op as { store: "sessionStorage"; op: "set"; key: string; value: string };
          return setSessionStorage(page, setOp.key, setOp.value);
        }
      }
      break;
  }
  throw new BrowserError("storage_failed", "unrecognized storage op", "use store=cookies|localStorage|sessionStorage, op=get|set|delete");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a URL's origin. Returns null for non-http(s) schemes
 * (about:blank, data:, etc.) where localStorage/sessionStorage are unavailable.
 */
function safeOrigin(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u;
    return null;
  } catch {
    return null;
  }
}

/**
 * Throw a storage_failed error when the page has no origin.
 */
function ensureHasOrigin(page: Page): void {
  if (safeOrigin(page.url()) === null) {
    throw new BrowserError(
      "storage_failed",
      `localStorage/sessionStorage is not available on "${page.url()}" (no origin)`,
      "navigate to an http(s) page before accessing localStorage or sessionStorage",
    );
  }
}
