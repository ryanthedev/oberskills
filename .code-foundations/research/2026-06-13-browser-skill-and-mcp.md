# Browser skill + chrome-devtools MCP (oberskills)

> **STATUS (2026-06-13): BUILD — custom puppeteer-core MCP.** Briefly detoured to adopting Google's `chrome-devtools-mcp`, but reverted: the attach-mode workflow was fiddly and the user wants one self-owned MCP that handles connection lifecycle, HAR, network mocking, recording, and snapshot+refs together. **Chosen substrate: puppeteer-core (Approach B)** — same engine Google's server uses; drop to raw CDP via `createCDPSession()` for gaps. Google's `chrome-devtools-mcp` remains installed (attach mode, inert) as a reference implementation. The plan lives at `.code-foundations/plans/`.

> **Summary:** Build a `browser` skill plus a CDP-native "Chrome DevTools" MCP server (`mcp-browser/`) inside the oberskills plugin. Port the proven svelte `cdp-browser.js` CDP logic to a long-lived Bun/TypeScript MCP server, but reorient the interaction model to **a11y-snapshot → stable ref IDs** (selectors as fallback) and add the DevTools-grade capabilities (perf/Lighthouse, network control, storage/emulation, capture) that only a CDP-native server can offer.
>
> **Date:** 2026-06-13 · **Status:** confirmed
>
> **Still open (defer to `/plan`):** phase ordering for a large v1; whether to gate advanced tool groups behind capability flags (Playwright `--caps` style) to control tool-menu bloat; exact Chrome lifecycle ownership (server-managed vs attach-to-running); connection/tab state model details.

---

## Confirmed decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| **Where it lives** | Inside the **oberskills** plugin | Ignore the empty `~/repos/browser-foundations/` placeholder. |
| **Skill name** | `browser` (`skills/browser/SKILL.md`) | What the user types after the slash. |
| **MCP location** | New top-level `mcp-browser/` dir | Separate Bun project from the existing `mcp/` (skill-eval). Add a second entry to `mcpServers` in `plugin.json`. |
| **Why MCP (not scripts)** | User wants native tool calls | "MCP tool, dump information and return location." |
| **Payload discipline** | Tools **write large payloads to disk and return the file path** | Preserves the svelte rule: screenshots/DOM/AX trees never enter main context. Skill body still routes Read-the-file work to a subagent (Haiku) for screenshots etc. |
| **Port source** | Port `cdp-browser.js` (2,633 lines) + `browser.sh` | At `~/repos/svelte-foundations.skill/skills/browser/scripts/`. Logic is proven; rewrap as MCP tools in strict TS. |
| **Parity** | **Full parity** with the existing command surface | Baseline below. |
| **Persistent connection** | **Baked in** (not optional) | MCP is a long-lived process — hold the CDP WebSocket open across calls. The script reconnects every invocation; this is free latency + enables event subscriptions. |
| **Interaction model** | **a11y-snapshot → stable `ref` IDs as primary; selector/coord as fallback** | The whole field (Playwright, Google's chrome-devtools-mcp, Browser MCP) moved off CSS-selector-first. ~200–400 tokens vs ~3–5k for a screenshot, deterministic, survives layout shifts. The ported selector machinery becomes the fallback path. |
| **Tab management** | In v1 | `list_tabs` / `open_tab` / select-target instead of hardcoding "first non-chrome:// tab." |
| **Chrome lifecycle** | In server (v1) | Server launches/tracks Chrome, replaces `browser.sh ensure`. (Attach-to-running-Chrome is a possible extension — see open questions.) |
| **Structured errors** | In v1 | `{ code, message, suggestion }` (e.g. "try `pierce` for shadow DOM"). Tool results are machine-read. |
| **Hover + keyboard modifiers** | In v1 | Hover states, ctrl/cmd/shift/alt, Tab, Enter, shortcuts. Script only has insertText + click. |
| **DevTools-identity caps** | **All four groups in v1** | Perf+Lighthouse · Network control · Storage+emulation · Capture extras (detailed below). |

---

## Tool surface

### Parity baseline (port of cdp-browser.js)
`navigate` · `screenshot` (jpeg/png, quality, →file) · `dom` (full or `--selector`, →file >60KB) · `accessibility` (AX tree, →file) · `click` (selector/coords/`--all`, shadow-DOM `--pierce`, `--match-text`/`--visible`/`--nth`, `--delay`) · `type` · `form` (fill/select/submit/read) · `wait` (navigation/selector/idle) · `scroll` (to-selector/by/to-bottom/to-top) · `dismiss` (topmost dialog/overlay heuristic) · `extract` (structured fields from repeated elements, →file) · `collect` (accordion click-read-close loop, →file) · `evaluate` (JS, auto-injects `querySelectorDeep`/`querySelectorAllDeep`) · `diagnostics` (console+network → HAR 1.2 / JSONL, snapshot/live/stop/dump).

**Preserve from the script:** shadow-DOM deep query helpers, the sophisticated dialog-detection/scoring in `dismiss`, combobox/select handling, the click-read-close diff fallback in `collect`, and the three wait strategies (navigation/selector/idle via MutationObserver + fetch interception).

### Reorientation (primary model)
- `snapshot` → returns a compact a11y tree where every interactive element has a **stable ref ID**. Refs valid until the next page change; re-snapshot after navigation/DOM mutation.
- `click` / `type` / `hover` / `select` / `fill_form` act on a **ref** by default; selector/coords remain as fallback args.

### v1 improvements beyond parity
1. **Persistent CDP connection** (pool/reuse across tool calls; enable Page/Network domains once).
2. **Tab management** — `list_tabs`, `open_tab`, select target.
3. **Chrome lifecycle in server** — launch/track/validate-liveness; replaces `browser.sh ensure`.
4. **Structured errors** — `{ code, message, suggestion }`.
5. **Hover + keyboard modifiers** — hover, modifier bitmask, `press_key`.

### v1 DevTools-identity capabilities (all four groups)
| Group | Tools / capability |
|-------|--------------------|
| **Perf + Lighthouse** | `performance_start_trace` / `stop_trace` / `analyze_insight` (LCP/INP/CLS), Lighthouse audit (a11y/perf/SEO/best-practices). The marquee differentiator — CDP-native (`Tracing`), unmatched by Playwright/Puppeteer. |
| **Network control** | Request interception / mocking / abort / modify (`browser_route`-style) + network & CPU throttling (`Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate`). Google's official server omits mocking — this beats it. |
| **Storage + emulation** | Cookies + localStorage + sessionStorage get/set/delete; **save/restore full storage-state to file** (auth reuse across runs); device/viewport resize; geolocation + permissions override (`Emulation.setGeolocationOverride`, `Browser.grantPermissions`). |
| **Capture extras** | PDF export (`Page.printToPDF`), screencast/video recording, drag-and-drop (element→element + file-drop), file upload (`<input type=file>`) / download capture, wait-for-text appear/disappear. |

---

## Design patterns to adopt (from competitive scan)

- **Snapshot → ref → act** is the default loop; auto-wait/actionability under the hood; re-snapshot after page change.
- **Keep payloads small / out of context** — return structured text trees, not images; write large artifacts (response bodies, traces, HAR) to files and return references. Paginated + type-filtered network listing; fetch bodies on demand by id.
- **Consolidate related ops into one multiplexed tool** — one `tabs` tool with an action arg; one `emulate` for CPU+network. Fewer entries in the model's menu.
- **Explicit lifecycle split for long ops** — separate start/stop from analyze (traces) so the model runs then drills into specific insights.
- **Possible capability gating** — Playwright keeps a small always-on core (~20 tools) and gates vision/pdf/storage/network/testing behind `--caps`. Worth considering to control tool-menu bloat given v1's breadth. *(Open — decide in plan.)*

---

## Conventions to honor (oberskills)

- Skills format: `skills/browser/SKILL.md` + `references/`. Frontmatter `name`/`description`/`when_to_use`; `description`+`when_to_use` ≤ 1,536 chars combined. Third-person description with what+when+exclusion clause.
- MCP code: **Bun + strict TypeScript**; `bunx tsc --noEmit` and `bun test` clean; **no `console.log` in `src/`** (stdout is the MCP transport — stderr only).
- Plugin paths: braced `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` only in harness-loaded content (SKILL.md, configs, hooks) — not in `references/*.md`.
- No version banners in skills; `plugin.json` is the single version source. (NB: the svelte `browser.md` reads plugin.json to print a version banner — do **not** copy that into oberskills.)
- SessionStart dep-install hook pattern: oberskills installs MCP deps into `${CLAUDE_PLUGIN_DATA}` and symlinks `node_modules`. `mcp-browser/` will need the same treatment (extend the existing hook or add a parallel one). `plugin.json` mcpServers/hooks changes need `/reload-plugins` or restart.
- Dogfood gate: `validate_skill` over the `browser` skill must report zero errors/zero warnings.

---

## Reference material (located)

| Item | Path / URL |
|------|-----------|
| Svelte browser command (subagent routing, anti-context rules) | `~/repos/svelte-foundations.skill/commands/browser.md` |
| CDP script to port | `~/repos/svelte-foundations.skill/skills/browser/scripts/cdp-browser.js` (2,633 lines) |
| Chrome launcher | `~/repos/svelte-foundations.skill/skills/browser/scripts/browser.sh` |
| CDP interaction recipes | `~/repos/svelte-foundations.skill/skills/browser/references/interaction-patterns.md` |
| oberskills MCP pattern (Bun, plugin.json, dep hook) | `~/repos/oberskills/.claude-plugin/plugin.json`, `~/repos/oberskills/mcp/` |
| Google chrome-devtools-mcp (48 tools) | github.com/ChromeDevTools/chrome-devtools-mcp |
| Playwright MCP (snapshot+refs, `--caps`) | github.com/microsoft/playwright-mcp · playwright.dev/mcp/snapshots |

---

## Suggested phasing (for `/plan` — not binding)

1. **Foundation** — Bun/TS MCP scaffold in `mcp-browser/`, persistent CDP connection + pool, Chrome lifecycle in-server, tab management, structured errors, plugin.json wiring + dep hook.
2. **Parity port** — the 14 command surfaces from `cdp-browser.js`, payload-to-file discipline, shadow-DOM helpers preserved.
3. **Snapshot+refs model** — a11y snapshot with stable refs; reorient click/type/hover/select/fill to ref-first with selector fallback; hover + keyboard modifiers.
4. **DevTools caps** — perf/Lighthouse, network control, storage/emulation, capture extras (likely behind capability flags).
5. **Skill + evals** — `skills/browser/SKILL.md` (subagent routing for screenshots/DOM/AX), references, `validate_skill` + trigger evals to green.

---

## Next step

```
/code-foundations:plan .code-foundations/research/2026-06-13-browser-skill-and-mcp.md
```
