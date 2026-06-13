# Plan: Browser skill + chrome-devtools MCP (puppeteer-core)

**Created:** 2026-06-13
**Status:** in-progress
**Started:** 2026-06-13
**Current Phase:** 1
**Complexity:** complex
---
## Context

oberskills has no first-class browser control. The only CDP automation in the ecosystem is shell scripts in a separate Svelte plugin — selector-first, reconnecting to Chrome on every call, with none of the DevTools-grade capabilities (perf, network control, emulation) that a CDP-native server can offer. Build a self-owned **`browser` skill + `mcp-browser/` MCP server** inside the oberskills plugin, on **puppeteer-core** (same engine as Google's chrome-devtools-mcp; drop to raw CDP via `createCDPSession()` for gaps), reorienting the interaction model to **a11y-snapshot → stable ref IDs** (selectors as fallback) and adding the DevTools capabilities (perf/Lighthouse, network HAR + mocking, storage/emulation, capture) in one place the user controls.

Research: `.code-foundations/research/2026-06-13-browser-skill-and-mcp.md`.

## Constraints
- **Hexagonal architecture (ports & adapters).** Dependency-free domain core defines port interfaces (e.g. `BrowserPort` — snapshot/interact/navigate/capture/network/storage/emulation use cases). **Driving adapter:** the MCP tool layer (`register.ts` + `tools/`) calls core use cases. **Driven adapters:** puppeteer-core implements `BrowserPort` (a raw-CDP adapter can replace it for gaps/fallback without touching core); filesystem + HAR writers are separate driven adapters. Puppeteer types never leak into the core or the tool layer — adapters convert at the boundary. Dependency direction points inward (adapters → ports → core).
- New `mcp-browser/` dir — separate Bun project from `mcp/` (skill-eval); second `mcpServers` entry in `plugin.json` + SessionStart dep-install hook (mirror existing).
- Bun + strict TypeScript; `bunx tsc --noEmit` + `bun test` clean; **no `console.log` in `src/`** (stdout is the MCP transport — stderr only, via a `lib/log.ts`-style helper).
- Architecture mirrors `mcp/`: ToolModule shape (`name/title/description/inputShape/handler` + `satisfies ToolModule`), `defineTool` bridge + single error boundary in `register.ts`, `ok()`/`err()` from a `lib/tool.ts`, all zod schemas centralized in `types.ts`, dynamic-import bootstrap in `server.ts`.
- Tools **write large payloads to disk and return file paths** (screenshots, DOM, AX trees, HAR, traces never enter main context); a payload-size threshold writes to `/tmp` and returns the path.
- **snapshot → stable refs** is the primary interaction model; selector/coordinate targeting is the fallback.
- **Persistent CDP/puppeteer connection** held across tool calls; connection manager supports launch-own Chrome AND attach-to-running (browserURL/wsEndpoint).
- Register all tools (rely on ToolSearch deferral — tool count is not a context concern); tool descriptions written for search-matching.
- Skill conventions: `validate_skill` zero errors/warnings (dogfood gate), no version banner, `plugin.json` is the single version source; braced `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_SKILL_DIR}` only in harness-loaded content (SKILL.md/configs/hooks), not in `references/*.md`.

---
## Chosen Approach
**puppeteer-core backed MCP (Approach B), inside a hexagonal (ports & adapters) architecture.** Puppeteer-core is the primary **driven adapter** implementing a dependency-free `BrowserPort`; it hands us a11y snapshot, auto-waiting, network interception, `Page.printToPDF`, tracing, file upload, drag, device emulation, and attach-to-running for free or near-free, while we drop to raw CDP via `page.createCDPSession()` for anything missing. The valuable DOM-level heuristics from svelte's `cdp-browser.js` (shadow-DOM deep query, dialog-dismiss scoring, collect-loop) port as `page.evaluate` helpers within the adapter. **Fallback:** because puppeteer sits behind the port, a raw-CDP adapter (Approach A) can replace it with zero changes to the core or tool layer if the dependency proves unacceptable.

## Rejected Approaches
- **A. Raw CDP (hand-rolled):** zero deps, max control, but hand-building snapshot+refs + all four DevTools groups is a huge surface — pre-mortem flagged scope-too-big → v1 slips (HIGH/HIGH).
- **C. Playwright:** best native snapshot+ref model, but heaviest, manages its own browsers, attach-to-running is second-class, weaker "Chrome DevTools" identity.
- **Adopt Google's chrome-devtools-mcp (no build):** covers ~90%, but attach-mode workflow was fiddly and leaves HAR export + response mocking as gaps; user wants one self-owned server. Kept installed as a reference impl.

---
## Implementation Phases

### Phase 1: Foundation & connection
**Model:** opus
**Skills:** ca-architecture-boundaries, aposd-designing-deep-modules, cc-defensive-programming
**Gate:** Full

**Goal:** Stand up the `mcp-browser/` Bun/TS server mirroring `mcp/` with the hexagonal skeleton — define the `BrowserPort` core interface and wire the puppeteer-core driven adapter behind it, with a persistent connection manager (launch-own + attach-to-running), tab/target management, structured errors, and plugin wiring.

**Scope:**
- IN: `mcp-browser/` Bun project (package.json, tsconfig strict, server.ts/register.ts/types.ts/lib mirror); `BrowserPort` core interface(s) defining connection + tab use cases only; puppeteer-core driven adapter implementing that subset; `ConnectionManager` (launch-own Chrome via executablePath/channel; attach via browserURL/wsEndpoint; liveness check + reconnect); `getPage()`/session accessor; connect/tabs tools as driving adapters; `BrowserError {code,message,suggestion}`; `plugin.json` second mcpServers entry + SessionStart dep hook extension.
- OUT: snapshot/refs (P2), any interaction or read tools, all DevTools groups (P4/P5), the skill (P6). No `page.evaluate` heuristics yet.

**Constraints:** Puppeteer types must not appear in `src/core/` or `src/tools/` — the adapter converts at the boundary. Core has zero third-party imports (node: builtins + own types only). Dependency direction inward: tools → core ports ← puppeteer adapter. Mirror `mcp/`: `satisfies ToolModule`, `defineTool` bridge + single error boundary in register.ts, `ok()`/`err()`, stderr-only `log()` (server prefix `[browser]`), all zod in types.ts, dynamic-import bootstrap in server.ts. Own env prefix (`BROWSER_MCP_*`). Connection held across calls (single long-lived process).

**Edge cases:** attach target unreachable / wrong Chrome channel → structured err with suggestion, never throw to client; Chrome dies mid-session → liveness check detects, next call returns `connection_lost` with reconnect hint (no silent retry that masks failure — RF-12); launch when a managed Chrome already runs → reuse, don't spawn a second; user-supplied `executablePath`/`browserURL` are external input → validate (path exists, URL well-formed, block obviously malformed) at the tool barricade before reaching the adapter; closing the last/active tab → define which tab becomes active or return `no_active_tab`; `wsEndpoint` + `browserURL` both supplied → reject as ambiguous rather than silently picking one.

**File hints:**
- `mcp-browser/src/core/browser-port.ts` — the port interface(s); no puppeteer import
- `mcp-browser/src/core/errors.ts` — `BrowserError`/error-code enum (core-owned)
- `mcp-browser/src/adapters/puppeteer/connection.ts` — `ConnectionManager` + `getPage()`
- `mcp-browser/src/tools/connect.ts`, `tabs.ts` — driving adapters (multiplex tabs per research: one `tabs` tool with an action arg)
- `mcp-browser/src/{server.ts,register.ts,types.ts,lib/{tool.ts,log.ts}}` — mirror `mcp/`
- `mcp-browser/package.json`, `tsconfig.json`; `.claude-plugin/plugin.json`

**Depends on:** nothing — entry phase | **Unlocks:** 2, 3, 4, 5, 6
**Produces:** the hexagonal skeleton consumed by every later phase. **Contract — `BrowserPort` (core seam, no puppeteer types):**
```
interface BrowserPort {
  connect(opts: ConnectOptions): Promise<ConnectionInfo>;   // launch-own | attach
  disconnect(): Promise<void>;
  isAlive(): Promise<boolean>;
  listTabs(): Promise<TabInfo[]>;
  newTab(url?: string): Promise<TabInfo>;
  selectTab(tabId: string): Promise<TabInfo>;
  closeTab(tabId: string): Promise<void>;
  activePageHandle(): PageHandle;   // opaque, adapter-owned; never a Puppeteer.Page in core/tools
}
```
`ConnectOptions = { mode: "launch"|"attach"; executablePath?; channel?; browserURL?; wsEndpoint?; headless? }`. `PageHandle` is an opaque token the adapter resolves internally; P2-6 extend `BrowserPort` with new methods and accept/return `PageHandle`, never bypassing the port. All tools return `ok()`/`err()`; structured failures use `BrowserError`.

**Payload seam (defined here as a core seam so P2 writes against it and P3 does not retrofit):**
```
// lib/payload.ts — stub defined in P1 as a core seam; P3 fills the real implementation:
writePayload(name: string, data: Buffer|string, ext: string): Promise<{ path: string; bytes: number }>
const PAYLOAD_THRESHOLD_BYTES: number   // canonical constant; all phases import from here
```
P2's `screenshot` writes against this signature from the start. P3 provides the real implementation (size threshold, inline-below-threshold logic, `inlinedPreview`) in the same file without changing the signature. *(Chose the P1-seam option: it sets a stable contract before any consumer writes against it, avoiding a two-phase retrofit seam break. The coupling cost is low — the stub is a one-liner that always writes to `/tmp`.)*

**Done when:**
- [ ] DW-1.1: `mcp-browser/` server boots, registers all P1 tools, and `bunx tsc --noEmit` + `bun test` (incl. the static `console.log`/tsc suite) pass clean.
- [ ] DW-1.2: A static check confirms zero puppeteer imports/types in `src/core/` and `src/tools/` (adapter converts at the boundary).
- [ ] DW-1.3: `connect` works in both modes (launch-own + attach via browserURL/wsEndpoint); a dead/unreachable connection returns a structured `connection_lost` `BrowserError` (never throws to the client).
- [ ] DW-1.4: `tabs` tool lists/opens/selects/closes tabs against a fake `BrowserPort`; closing the active tab yields a defined active-tab outcome or `no_active_tab`.
- [ ] DW-1.5: Bad inputs (malformed executablePath/browserURL; both wsEndpoint+browserURL supplied) are rejected at the tool barricade with `{code,message,suggestion}`.
- [ ] DW-1.6: ToolModule shape / `defineTool` bridge / single error boundary / `ok()`/`err()` / stderr `log()` (`[browser]`) all mirror `mcp/`.
- [ ] DW-1.7: `plugin.json` carries a second mcpServers entry and the SessionStart dep hook installs `mcp-browser/` deps (verified after `/reload-plugins`).

**Difficulty:** high
**Uncertainty:** Whether attach-to-running works uniformly across Chrome channels (stable/beta/Canary) and whether bun spawns puppeteer-core's bundled-browser-less flow cleanly — both verified in P1 (see Assumptions).

### Phase 2: Snapshot+refs interaction core
**Model:** opus
**Skills:** aposd-designing-deep-modules, gof-design-patterns, cc-defensive-programming
**Gate:** Full

**Goal:** Primary interaction model — a11y snapshot returning stable ref IDs, with click/type/hover/select/fill/press_key/drag acting on refs (selector + coordinate fallback), plus navigate, wait, scroll, screenshot→file.

**Scope:**
- IN: extend `BrowserPort` with snapshot + interaction use cases; `snapshot` tool returning a compact a11y tree where each interactive node carries a stable `ref` ID; a ref registry mapping ref → element (adapter-internal, invalidated on page change); targeting resolution strategy (ref primary → selector → coordinate fallback) behind one interface; interaction tools `click`, `type`, `hover`, `select`, `fill_form`, `press_key` (modifier bitmask), `drag`; navigation/lifecycle tools `navigate`, `wait` (navigation/selector/idle), `scroll`; `screenshot` → file (writes via the `writePayload` stub defined as a P1 core seam; P3 fills the real implementation without changing the signature).
- OUT: read/extract tools, the generalized payload-to-file helper, `evaluate`/shadow-DOM helpers (all P3); DevTools groups (P4/P5).

**Constraints:** Targeting is a Strategy (gof) — ref/selector/coordinate are interchangeable resolvers behind one `resolveTarget()` signature; no `if (ref) … else if (selector) …` ladder leaking into every tool. Auto-wait/actionability under the hood (deep module — caller passes a target, module handles waiting). Refs are opaque tokens; their internal shape (CDP backendNodeId, puppeteer ElementHandle, etc.) never leaks to core or tools. Re-snapshot required after navigation/DOM mutation — refs from a prior snapshot are stale.

**Edge cases:** stale ref (used after page change) → `stale_ref` structured err with "re-run snapshot" suggestion, never a silent miss (RF-11/RF-12); ref not found in registry → distinct `unknown_ref` (different from stale); selector matches 0 or >1 elements → explicit err (ambiguous-match) rather than acting on the first silently; coordinate outside viewport → err; `wait` timeout → typed `timeout` err carrying the strategy that timed out; navigate to malformed/non-http(s) URL → validate at barricade (external input; SSRF-adjacent — block `file://`/`chrome://` unless explicitly allowed); snapshot of a page mid-navigation → wait for a stable document or return `page_unstable`; drag with stale source/target ref → same stale-ref path.

**File hints:**
- `mcp-browser/src/core/browser-port.ts` — extend with `snapshot()`, `interact()`, `navigate()`, `wait()`, `scroll()`
- `mcp-browser/src/core/targeting.ts` — `Target` type (ref | selector | coords) + `resolveTarget` contract (Strategy)
- `mcp-browser/src/adapters/puppeteer/refs.ts` — ref registry + snapshot→ref builder (adapter-internal)
- `mcp-browser/src/adapters/puppeteer/interactions.ts` — resolver implementations
- `mcp-browser/src/tools/{snapshot,click,type,hover,select,fill-form,press-key,drag,navigate,wait,scroll,screenshot}.ts`
- `mcp-browser/src/types.ts` — zod for the `Target` union + tool inputs

**Depends on:** 1 | **Unlocks:** 3, 5, 6
**Produces:** the snapshot→ref resolution seam consumed by P3/P5/P6. **Contract:**
```
type Target =
  | { ref: string }
  | { selector: string; pierce?: boolean; matchText?: string; visible?: boolean; nth?: number }
  | { x: number; y: number };
// BrowserPort additions:
snapshot(): Promise<{ tree: AxNode[]; refs: string[] }>;   // each interactive AxNode has .ref
resolveTarget(t: Target): Promise<ResolvedElement>;         // throws StaleRefError | UnknownRefError | AmbiguousMatchError -> err()
interact(action: InteractAction, t: Target, opts?): Promise<void>;
```
Refs invalidate on the next page change; `resolveTarget` is the single chokepoint P3/P5 reuse (no tool re-implements targeting). `screenshot` returns `{ path: string; bytes: number }` via the `writePayload` stub (P1 seam); P3 fills the real implementation without changing this shape.

**Security-sensitive:** navigate accepts arbitrary URLs (untrusted target); validate scheme/host at the tool barricade, block `file://`/internal schemes unless explicitly opted in (SSRF-adjacent, SM-2).

**Done when:**
- [ ] DW-2.1: `snapshot` returns a compact a11y tree where every interactive node carries a stable `ref`; the returned ref list matches the tree.
- [ ] DW-2.2: `resolveTarget` resolves ref (primary), selector, and coordinate targets through one Strategy interface; all interaction tools route through it (no per-tool targeting ladder).
- [ ] DW-2.3: A ref used after a page change returns `stale_ref` with a re-snapshot suggestion; an unknown ref returns a distinct `unknown_ref`.
- [ ] DW-2.4: A selector matching 0 or >1 elements returns an explicit err (no silent act-on-first).
- [ ] DW-2.5: `navigate` rejects malformed / non-http(s) / `file://` / `chrome://` URLs at the barricade unless explicitly allowed.
- [ ] DW-2.6: `wait` (navigation/selector/idle) returns a typed `timeout` err naming the strategy on timeout; `scroll`, `press_key` (modifier bitmask), `drag` act via refs with selector/coord fallback.

**Difficulty:** high
**Uncertainty:** Whether puppeteer-core's a11y snapshot exposes node identity stable enough to back refs across minor DOM mutations, or whether refs must be rebuilt from CDP `DOM.backendNodeId` via `createCDPSession()` — resolved early in P2 (see Assumptions); changes the adapter internals only, not the seam.

### Phase 3: Read / extract + parity
**Model:** sonnet
**Skills:** cc-routine-and-class-design, cc-defensive-programming
**Gate:** Standard

**Goal:** Read/extract tools with payload-to-file discipline — dom→file, accessibility→file, extract structured fields, collect (expand-read loop), evaluate JS (shadow-DOM helpers), dismiss-dialog, form read.

**Scope:**
- IN: the shared payload-to-file helper — real implementation of the `writePayload` seam defined in P1 (size threshold → `/tmp` path, returns path + size + truncated-preview; injectable write function; `PAYLOAD_THRESHOLD_BYTES` canonical constant already exported from the stub); extend `BrowserPort` with read use cases; tools `dom` (full or `--selector`), `accessibility` (AX tree), `extract` (structured fields from repeated elements), `collect` (accordion click-read-close loop with diff fallback), `evaluate` (arbitrary JS, auto-injects `querySelectorDeep`/`querySelectorAllDeep`), `dismiss` (topmost-dialog scoring heuristic), `form` read. Port the proven `cdp-browser.js` heuristics (shadow-DOM deep query, dialog scoring, collect diff) as `page.evaluate` helpers inside the puppeteer adapter. P2's `screenshot` already uses the P1 seam — P3 fills in the real logic without changing the signature.
- OUT: network/HAR (P4), storage/PDF/screencast (P5), the skill (P6).

**Constraints:** Every large payload (DOM, AX, extract, collect results) writes to disk and returns a path — never inlines past the threshold (single canonical threshold constant, one home). `evaluate` injects helpers via a single named routine, not duplicated strings. Each tool = one functionally-cohesive routine (cc-routine: name describes everything it does; `extract`/`collect` orchestrate lower-level helpers, ≤7 params). The injected JS helpers live as data/string constants loaded once, mirroring `mcp/`'s "prompts are data" rule. Reuse P2's `resolveTarget` for any element-scoped read (`--selector`) — do not re-implement targeting. Call `BrowserPort.resolveTarget()` through the port handle, not by importing from `adapters/` — dependency direction stays inward (tools → core). `writePayload` takes an injectable write function (not `fs.writeFile` directly) so the "write fails" dirty test can inject a rejected promise without touching the filesystem.

**Edge cases:** payload just under vs over threshold (boundary) — at, below, above; write to `/tmp` fails (disk full / perms) → err with the reason, never drop the payload silently (RF-12); `evaluate` of untrusted/buggy JS that throws → catch in the adapter, return the page-side error message as a structured err (don't crash the connection); `evaluate` that returns a non-serializable/cyclic value → handle (stringify-safe or err); `collect` where expand reveals nothing (no diff) → fall back per the ported diff logic, report "no expandable content" rather than empty success; `dismiss` when no dialog present → explicit "nothing to dismiss" (not a false success); selector matching nothing in `dom`/`form` → err, not empty file.

**Approach notes:** Preserve the svelte script's specific heuristics verbatim in behavior (dialog-detection scoring, collect diff fallback, three wait strategies already in P2) — these are proven, not to be reinvented.

**File hints:**
- `mcp-browser/src/lib/payload.ts` — payload-to-file helper + the threshold constant (canonical home)
- `mcp-browser/src/core/browser-port.ts` — read use cases (`readDom`, `readAccessibility`, `extract`, `collect`, `evaluate`, `dismiss`, `readForm`)
- `mcp-browser/src/adapters/puppeteer/dom-helpers.ts` — ported `querySelectorDeep`, dialog scoring, collect diff (injected JS as constants)
- `mcp-browser/src/tools/{dom,accessibility,extract,collect,evaluate,dismiss,form}.ts`

**Depends on:** 1, 2 | **Unlocks:** 6
**Produces:** read/extract toolset + the shared payload-to-file helper. **Contract:**
```
// lib/payload.ts — reused by P3 reads, P2 screenshot, P4 HAR, P5 captures:
writePayload(data: string|Buffer, opts: { ext: string; inlinePreviewChars?: number }):
  Promise<{ path: string; bytes: number; inlinedPreview?: string; written: boolean }>;
// `written:false` only when below threshold AND fully returned inline.
```
PAYLOAD_THRESHOLD_BYTES is defined once here; all other files import it.

**Security-sensitive:** `evaluate` runs arbitrary JS in the page context (driving-adapter input). It is opt-in by design and runs in the page sandbox, not the server process; bound it (catch page-side throws, cap returned-payload size via the helper), and never `eval` the string in the Node/server process — it is passed to `page.evaluate`, which executes in the browser.

**Done when:**
- [ ] DW-3.1: `writePayload` returns inline below the canonical threshold and writes to `/tmp` (returning path+bytes) at/above it; the boundary trio (below/at/above) is tested; a failed write (injected via the injectable write function) returns an err (payload never silently dropped).
- [ ] DW-3.2: `dom` (full + `--selector`) and `accessibility` write to file; a selector matching nothing returns an err, not an empty file.
- [ ] DW-3.3: `extract` (structured fields) and `collect` (expand-read-close with diff fallback) work; `collect` with nothing to expand reports "no expandable content".
- [ ] DW-3.4: `evaluate` injects the shadow-DOM helpers once via a shared constant; a page-side throw returns a structured err without dropping the connection; non-serializable returns are handled.
- [ ] DW-3.5: `dismiss` (ported dialog-scoring heuristic) dismisses a dialog and reports "nothing to dismiss" when none is present (no false success); `form` read works.
- [ ] DW-3.6: `writePayload` (real implementation) serves `dom`, `accessibility`, `extract`, and `collect` — all large read payloads route through it; P2's `screenshot` already uses the P1-seam stub and requires no retrofit; element-scoped reads reuse `resolveTarget` (no new targeting logic).

**Difficulty:** medium
**Uncertainty:** Whether the ported shadow-DOM/dialog heuristics behave identically under puppeteer's `page.evaluate` vs the raw-CDP `Runtime.evaluate` they were written for — validated against the existing svelte test pages.

### Phase 4: DevTools — performance + network
**Model:** opus  *(6 DW items + 5 file areas: tracing, network, HAR writer, lighthouse, emulate/browser-port — meets DW>=6 + >=4-area threshold)*
**Skills:** aposd-designing-deep-modules, cc-defensive-programming
**Gate:** Full

**Goal:** perf trace start/stop/analyze (Core Web Vitals), Lighthouse audit, network capture → HAR export, request interception/mocking (block/stub/modify), network + CPU throttling.

**Scope:**
- IN: extend `BrowserPort` with perf + network use cases; `performance_start_trace`/`stop_trace`/`analyze_insight` (LCP/INP/CLS — explicit start/stop split from analyze per research); `lighthouse_audit` (perf/a11y/SEO/best-practices — DW-4.2, deferrable per Assumptions; gate-critical DW for P4 are DW-4.1/4.3/4.4/4.5/4.6); network capture buffer + `export_har` (HAR 1.2 writer via the P3 payload helper); request interception/mocking (`route`: block/abort/stub/modify) via `Network.*`/puppeteer request interception; `emulate` (one multiplexed tool for network throttling + CPU throttling per research). HAR writer is a dedicated driven adapter behind a core port (a non-puppeteer test fake must be able to substitute it). Paginated, type-filtered network listing; response bodies fetched on demand by id (kept out of context).
- OUT: storage/cookies/geolocation, PDF/screencast, file upload/download (all P5); the skill (P6).

**Constraints:** HAR writer is a driven adapter behind `HarPort` (deep module — one `write(entries) → path` method; HAR 1.2 schema detail hidden). Trace lifecycle is start/stop/analyze as three operations, not one (long-op split). Interception rules are data (a rule list the adapter applies), not imperative callbacks scattered per tool. Response bodies and traces go through the P3 payload helper → file, never inline. Mocking/interception must be explicitly scoped and tear down cleanly on disconnect/disable (no leaked global interception left armed).

**Edge cases:** `stop_trace`/`analyze_insight` with no trace started → err, not empty result; Lighthouse fails to run in-process / unsupported flags → structured err with the underlying reason (don't report a zeroed audit as success — correctness lean, RF-12); intercepted response from an untrusted origin (external input) — treat bodies as untrusted: size-cap, never execute, content-type aware; a `modify` rule producing malformed response → reject the rule at the barricade rather than corrupting the stream; HAR export with an empty/partial capture buffer → write a valid-but-empty HAR and say so; CPU/network throttle values out of range → clamp or err (defined, not silent); interception armed then Chrome dies → on reconnect, interception is gone — report state honestly, don't assume it persisted; concurrent traces (second start before stop) → reject.

**File hints:**
- `mcp-browser/src/core/browser-port.ts` — perf/network use cases; `mcp-browser/src/core/har-port.ts` — `HarPort`
- `mcp-browser/src/adapters/fs/har-writer.ts` — HAR 1.2 writer (driven adapter)
- `mcp-browser/src/adapters/puppeteer/{tracing.ts,network.ts}` — tracing, interception/mocking, throttling
- `mcp-browser/src/lib/lighthouse.ts` — Lighthouse-in-process runner
- `mcp-browser/src/tools/{performance-start-trace,performance-stop-trace,analyze-insight,lighthouse-audit,export-har,route,emulate}.ts`

**Depends on:** 1 | **Unlocks:** 6
**Produces:** perf/network toolset + HAR writer + interception layer. **Contract:**
```
interface HarPort { write(entries: HarEntry[]): Promise<string>; }  // returns file path; HAR 1.2 hidden
// BrowserPort additions:
startTrace(opts): Promise<void>; stopTrace(): Promise<{ tracePath: string }>;
analyzeInsight(metric: "LCP"|"INP"|"CLS"|...): Promise<InsightResult>;
setRoutes(rules: RouteRule[]): Promise<void>;   // block|abort|stub|modify; data, not callbacks
clearRoutes(): Promise<void>;
emulateConditions(opts: { network?: NetworkProfile; cpuThrottlingRate?: number }): Promise<void>;
```
HAR + trace + response bodies route through P3's `writePayload`. `RouteRule` validated at the tool barricade before reaching the adapter.

**Security-sensitive:** network interception ingests untrusted response bodies and lets the caller stub/modify responses. Treat all captured bodies as external input (size-cap via payload helper, never execute, content-type aware); validate `RouteRule` (URL pattern, status, body) at the barricade; ensure interception tears down on disable/disconnect so it can't silently alter later sessions. (cc-defensive: barricade + correctness lean + RF-12.)

**Done when:**
- [ ] DW-4.1: `performance_start_trace`/`stop_trace`/`analyze_insight` work as three operations; stop/analyze with no trace started, or a second start before stop, return errs (not empty results).
- [ ] DW-4.2: `lighthouse_audit` returns a real audit; a run failure returns a structured err (never a zeroed audit reported as success).
- [ ] DW-4.3: Network capture → `export_har` produces schema-valid HAR 1.2 via `HarPort` + `writePayload`; an empty buffer yields a valid-but-empty HAR that says so.
- [ ] DW-4.4: `route` (block/abort/stub/modify) applies rules as data; malformed `RouteRule` is rejected at the barricade; captured bodies are size-capped and never executed; interception tears down on disconnect.
- [ ] DW-4.5: `emulate` applies network + CPU throttling; out-of-range values clamp or err (defined, not silent).
- [ ] DW-4.6: `HarPort` is a driven adapter a non-puppeteer test fake can substitute; perf/network use cases added to `BrowserPort` with no puppeteer types in core.

**Rollback:** `clearRoutes()` is the interception recovery primitive and must be callable even after a failed `setRoutes()`; HAR writer uses atomic write-then-rename to `/tmp` so no rollback needed for that seam.

**Difficulty:** high
**Uncertainty:** Whether Lighthouse runs cleanly in-process via puppeteer-core under bun (vs needing a separate Node child) — verified before P4 (see Assumptions); fallback is a spawned child or deferring Lighthouse to a follow-up while keeping perf-trace + CWV.

### Phase 5: DevTools — storage / emulation / capture
**Model:** sonnet
**Skills:** cc-routine-and-class-design, cc-defensive-programming
**Gate:** Full

**Goal:** cookies/localStorage/sessionStorage get/set/delete, storage-state save/restore to file, device/viewport emulation, geolocation/permissions, PDF export, screencast, file upload/download.

**Scope:**
- IN: extend `BrowserPort` with storage/emulation/capture use cases; `storage` (multiplexed: cookies + localStorage + sessionStorage get/set/delete); `storage_state` save/restore full state to file (auth reuse across runs — uses P3 payload helper for save, validates on restore); `emulate_device` (device/viewport resize), `geolocation`, `permissions` override; `pdf` export (`Page.printToPDF` → file); `screencast` (video record start/stop → file); `upload` (`<input type=file>`), `download` capture; `wait_for_text` appear/disappear. Element-scoped ops (upload target, download trigger) reuse P2 `resolveTarget`.
- OUT: perf/network (P4); the skill (P6).

**Constraints:** Each multiplexed tool (`storage`, `emulate*`) groups by cohesion, not by "done at the same time" — `storage` is communicational (same store, distinct ops) and acceptable; do not fold unrelated capture ops into it. ≤7 params per routine (storage set with key/value/domain/path/expiry/httpOnly/secure approaches the limit — use a parameter object). Saved storage-state is read back from disk → validate with a zod schema at the restore boundary (never trust a file). All captures (PDF, video, storage-state) go through the P3 payload helper → file. Restore must be all-or-nothing observable (report what was restored vs skipped), not partial-silent.

**Edge cases:** restore a storage-state file that is malformed / from a different origin → zod-validate, reject with a clear err (external input — never trust disk, RF-12); set a cookie for a domain not matching the active page → err or explicit cross-domain flag, not silent no-op; `pdf`/`screencast` on a page that's navigating → wait or err; screencast started twice / stopped when not running → typed err; `upload` to a non-file input or stale ref → resolveTarget err path; `download` that never fires within timeout → typed `timeout` err; geolocation/permission values out of range or unknown permission name → reject at barricade; `wait_for_text` timeout → typed err naming appear vs disappear; localStorage access on `about:blank`/no-origin page → explicit err.

**File hints:**
- `mcp-browser/src/core/browser-port.ts` — storage/emulation/capture use cases
- `mcp-browser/src/adapters/puppeteer/{storage.ts,emulation.ts,capture.ts}`
- `mcp-browser/src/types.ts` — `StorageStateSchema` (zod; validated on restore)
- `mcp-browser/src/tools/{storage,storage-state,emulate-device,geolocation,permissions,pdf,screencast,upload,download,wait-for-text}.ts`

**Depends on:** 1, 2 | **Unlocks:** 6
**Produces:** storage/emulation/capture toolset. **Contract:**
```
// BrowserPort additions:
storage(op: StorageOp): Promise<StorageResult>;           // cookies|local|session get/set/delete
saveStorageState(): Promise<{ path: string }>;            // via writePayload
restoreStorageState(state: StorageState): Promise<{ restored: string[]; skipped: string[] }>;
emulateDevice(opts: DeviceProfile): Promise<void>;
setGeolocation(opts) / grantPermissions(opts): Promise<void>;
printPdf(opts): Promise<{ path }>;  startScreencast()/stopScreencast(): Promise<{ path }>;
```
`StorageState` parsed via `StorageStateSchema` (types.ts) at the restore boundary. Captures use P3 `writePayload`.

**Security-sensitive:** storage-state save/restore persists cookies/tokens (credentials) to disk and reloads them — restored files are external input (zod-validate, origin-check before injecting); saved files contain secrets (write to a path the caller controls, document that they hold credentials, never log contents). cc-defensive: validate-on-restore barricade + RF-12.

**Done when:**
- [ ] DW-5.1: `storage` get/set/delete works across cookies/localStorage/sessionStorage; a cross-domain cookie set is an err or explicit flag (no silent no-op); a no-origin-page op returns an explicit err.
- [ ] DW-5.2: `storage_state` saves to file (via `writePayload`) and restores it, enabling auth reuse across a restart; restore validates with `StorageStateSchema` and reports restored vs skipped (a malformed/wrong-origin file is rejected).
- [ ] DW-5.3: `emulate_device` (viewport/device), `geolocation`, and `permissions` apply; unknown permission names / out-of-range values are rejected at the barricade.
- [ ] DW-5.4: `pdf` → file and `upload` to an `<input type=file>` work (upload reuses `resolveTarget`); `download` capture returns a typed `timeout` err when the download never fires within the timeout.
- [ ] DW-5.5: `wait_for_text` appear/disappear returns a typed timeout err naming appear vs disappear.
- [ ] DW-5.6: `screencast` start/stop → file; double-start or stop-when-not-running returns a typed err. *(Deferrable per Assumptions: if screencast/CDP frame assembly is unreliable under bun, drop DW-5.6 from the P5 gate and track as a P5b follow-up; remaining DW-5.x carry the gate.)*
- [ ] DW-5.7: storage/emulation/capture use cases added to `BrowserPort` with no puppeteer types in core; captures route through `writePayload`.

**Rollback:** `restoreStorageState` must be all-or-nothing — clear-then-restore in the adapter so a mid-restore zod error doesn't leave mixed cookie/storage state; on failure, reconnect clears in-page storage.

**Difficulty:** medium
**Uncertainty:** Whether screencast/video capture is reliable via puppeteer-core under bun (CDP `Page.startScreencast` frame assembly) or needs a follow-up — capture extras are the most droppable group if it slips; storage/emulation are the load-bearing parts.

### Phase 6: Browser skill + evals
**Model:** sonnet
**Skills:** code-clarity-and-docs, cc-quality-practices
**Gate:** Standard

**Goal:** Author `skills/browser/SKILL.md` (snapshot-first; routes screenshots/DOM/AX reads to a subagent), references, and bring `validate_skill` + trigger evals to green.

**Scope:**
- IN: `skills/browser/SKILL.md` + `references/`; frontmatter (`name: browser`, third-person `description` with what+when+exclusion, `when_to_use` trigger phrases; combined ≤1536 chars); body teaches the snapshot→ref→act loop as primary, selector/coords as fallback, payload-to-file discipline, and routes Read-the-file work (screenshots/DOM/AX) to a Haiku subagent so artifacts never enter main context; references document the tool surface by group. Trigger eval query set; `validate_skill` to zero errors/zero warnings; `test_triggers` green.
- OUT: any MCP server code change (P1-5 own it); recording→replay (deferred, see Notes).

**Constraints:** No version banner (do not copy svelte's plugin.json-reading banner — `plugin.json` is the single version source). `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_SKILL_DIR}` only in SKILL.md body, never in `references/*.md` (use skill-name phrasing there). SKILL.md ≤500 lines; every reference linked at depth 1. No self-assessed-compliance constructs ("Rationalization | Reality", "Red Flags — STOP") — `validate_skill` lints these. Each canonical number lives in one file. Comments-first / obviousness rules (code-clarity) applied to the skill prose: names precise, no comment/heading restating the obvious. Description triggers on the right queries and stays quiet on near-misses (test_triggers measures both).

**Edge cases:** description over the combined 1536-char limit → listing truncates (validate_skill flags); description too broad → false triggers on non-browser queries (test_triggers near-miss set catches); references containing a braced path that won't substitute → silent breakage (validate_skill lints); skill that documents a tool that doesn't exist or omits one that does → doc-accuracy drift (code-clarity README/AI-doc audit). Dirty cases for the eval set: queries that should NOT trigger (general web questions, unrelated automation) must stay quiet.

**File hints:**
- `skills/browser/SKILL.md` — the user-facing skill (snapshot-first, subagent routing)
- `skills/browser/references/*.md` — tool-surface docs grouped (interaction / read / perf+network / storage+capture)
- eval query set for `test_triggers` (trigger + near-miss queries)

**Depends on:** 1, 2, 3, 4, 5 | **Unlocks:** —
**Produces:** the user-facing `browser` skill wired to the MCP tool surface; `validate_skill` zero errors/zero warnings and `test_triggers` passing (dogfood gate).

**Done when:**
- [ ] DW-6.1: `skills/browser/SKILL.md` exists with valid frontmatter (`name: browser`, third-person description + when_to_use, combined ≤1536 chars, SKILL.md ≤500 lines, references linked at depth 1); references document every existing tool and document none that don't exist (doc-accuracy audit passes).
- [ ] DW-6.2: `validate_skill` on `skills/browser/` reports zero errors and zero warnings (no version banner; no self-assessed-compliance constructs; braced paths only in SKILL.md body).
- [ ] DW-6.3: `test_triggers` passes — browser-task queries trigger and near-miss/unrelated queries stay quiet.
- [ ] DW-6.4: The skill teaches snapshot→ref→act as primary (selector/coords fallback) and routes screenshot/DOM/AX reads to a Haiku subagent so artifacts never enter main context.

**Difficulty:** medium
**Uncertainty:** Trigger-description tuning may need an `optimize_description` pass if `test_triggers` shows false-positive/false-negative queries; otherwise None.

---
## Test Coverage
**Level:** 100% everything — every code-touching phase ships unit tests (pure logic, fakes at the port boundary) AND live integration tests (browser-driving, gated behind `RUN_LIVE_EVALS=1` but expected to pass). Static suite (`test/static.test.ts`) greps `src/` for `console.log` and runs `bunx tsc --noEmit`, asserting clean — mirrors `mcp/`.

## Test Plan
Grouped by phase; `~5:1` dirty:clean. Unit = pure logic with a fake `BrowserPort`/`HarPort` (no real Chrome). Live = real Chrome, gated. Manual = human spot-check.

**Phase 1 — Foundation & connection**
- [ ] Unit (clean): `defineTool`/registrar wiring compiles; all P1 tools register; static suite passes (no `console.log`, tsc clean). (DW-1.1, DW-1.6)
- [ ] Unit (clean): core has zero puppeteer imports — static grep over `src/core/` and `src/tools/` for `puppeteer`/adapter types asserts empty. (DW-1.2)
- [ ] Unit (clean): a fake `BrowserPort` drives connect/list/new/select/close-tab tools end to end (proves the seam holds without Chrome). (DW-1.3, DW-1.4)
- [ ] Unit (dirty): attach with both `wsEndpoint` and `browserURL` → ambiguous err, not silent pick. (DW-1.5)
- [ ] Unit (dirty): malformed `executablePath`/`browserURL` rejected at the tool barricade. (DW-1.5)
- [ ] Unit (dirty): `connection_lost` returned (not thrown) when `isAlive()` is false; structured `BrowserError {code,message,suggestion}`. (DW-1.3, DW-1.5)
- [ ] Unit (dirty): close the active tab → defined active-tab outcome or `no_active_tab`, never undefined state. (DW-1.4)
- [ ] Live (clean): launch-own Chrome, list tabs, open + select + close a tab. (DW-1.3, DW-1.4)
- [ ] Live (dirty): attach to a running Chrome on the wrong channel / dead URL → structured err with suggestion. (DW-1.3, DW-1.5)
- [ ] Manual: `/reload-plugins`, confirm second mcpServers entry loads and dep hook installs `mcp-browser/` deps. (DW-1.7)

**Phase 2 — Snapshot+refs interaction core**
- [ ] Unit (clean): `resolveTarget` Strategy resolves ref / selector / coords via one interface (fake adapter). (DW-2.2)
- [ ] Unit (clean): snapshot output assigns a stable `ref` to each interactive node; ref list matches tree. (DW-2.1)
- [ ] Unit (dirty): stale ref after a simulated page change → `stale_ref` err with re-snapshot suggestion. (DW-2.3)
- [ ] Unit (dirty): unknown ref (never issued) → `unknown_ref`, distinct from stale. (DW-2.3)
- [ ] Unit (dirty): selector matching 0 and >1 elements → ambiguous/empty err, not act-on-first. (DW-2.4)
- [ ] Unit (dirty): navigate to `file://`/`chrome://`/malformed URL → barricade reject (SSRF-adjacent). (DW-2.5)
- [ ] Unit (dirty): `wait` timeout → typed `timeout` err naming the strategy. (DW-2.6)
- [ ] Live (clean): snapshot → click a ref → type → snapshot reflects change. (DW-2.1, DW-2.2)
- [ ] Live (clean): selector + coordinate fallback paths drive a real interaction. (DW-2.2)
- [ ] Live (dirty): act on a ref after navigation → `stale_ref` against real Chrome. (DW-2.3)

**Phase 3 — Read / extract + parity**
- [ ] Unit (clean): `writePayload` below threshold returns inline (`written:false`); at/above writes to `/tmp` and returns path+bytes. (DW-3.1) — boundary trio (below/at/above).
- [ ] Unit (clean): `evaluate` injects the shadow-DOM helpers exactly once via the shared constant. (DW-3.4)
- [ ] Unit (dirty): `writePayload` when the write is rejected (injected fs error) → err with reason, payload not silently dropped — uses an injectable write function, not `fs.writeFile` directly. (DW-3.1)
- [ ] Unit (dirty): `evaluate` page-side throw → structured err, connection survives. (DW-3.4)
- [ ] Unit (dirty): `evaluate` returns a cyclic/non-serializable value → handled (safe-stringify or err). (DW-3.4)
- [ ] Unit (dirty): `dismiss` with no dialog → "nothing to dismiss", not false success. (DW-3.5)
- [ ] Unit (dirty): `dom`/`form` selector matching nothing → err, not empty file. (DW-3.2)
- [ ] Live (clean): `dom`→file, `accessibility`→file, `extract` structured fields, `collect` expand-read-close against the svelte test pages. (DW-3.2, DW-3.3)
- [ ] Live (dirty): `collect` where expand reveals nothing → diff fallback reports "no expandable content". (DW-3.3)

**Phase 4 — Performance + network**
- [ ] Unit (clean): `HarPort` fake records `write(entries)` → path; real `har-writer` emits schema-valid HAR 1.2. (DW-4.3)
- [ ] Unit (clean): `RouteRule` list applied as data (block/abort/stub/modify) via fake adapter. (DW-4.4)
- [ ] Unit (dirty): `stop_trace`/`analyze_insight` with no trace started → err, not empty result. (DW-4.1)
- [ ] Unit (dirty): second `start_trace` before stop → reject (concurrent trace). (DW-4.1)
- [ ] Unit (dirty): malformed `RouteRule` (bad URL pattern / status / body) → barricade reject. (DW-4.4)
- [ ] Unit (dirty): Lighthouse run failure → structured err, never a zeroed audit reported as success. (DW-4.2)
- [ ] Unit (dirty): throttle value out of range → clamp-or-err (defined, not silent). (DW-4.5)
- [ ] Unit (dirty): captured response body over size cap (untrusted input) → capped via payload helper, never executed. (DW-4.4)
- [ ] Live (clean): start/stop trace, analyze LCP/INP/CLS; capture network → `export_har` writes valid HAR. (DW-4.1, DW-4.3)
- [ ] Live (clean): `route` blocks a request and stubs a response; `emulate` applies network+CPU throttle. (DW-4.4, DW-4.5)
- [ ] Live (dirty): interception armed → simulate disconnect → reconnect reports interception gone (not assumed persisted). (DW-4.4)

**Phase 5 — Storage / emulation / capture**
- [ ] Unit (clean): `storage` get/set/delete across cookies/local/session via fake adapter; `StorageStateSchema` round-trips. (DW-5.1, DW-5.2)
- [ ] Unit (dirty): restore a malformed / wrong-origin storage-state file → zod reject at the boundary (never trust disk). (DW-5.2)
- [ ] Unit (dirty): set cookie for a domain not matching the active page → err or explicit cross-domain flag, no silent no-op. (DW-5.1)
- [ ] Unit (dirty): screencast start-twice / stop-when-not-running → typed err. (DW-5.6)
- [ ] Unit (dirty): `upload` to a stale/non-file-input ref → resolveTarget err path. (DW-5.4)
- [ ] Unit (dirty): `wait_for_text` timeout → typed err naming appear vs disappear. (DW-5.5)
- [ ] Unit (dirty): `download` timeout → typed `timeout` err. (DW-5.4)
- [ ] Unit (dirty): unknown permission name / out-of-range geolocation → barricade reject. (DW-5.3)
- [ ] Live (clean): set+read cookies/localStorage; save storage-state, restart, restore, confirm auth reuse. (DW-5.1, DW-5.2)
- [ ] Live (clean): `emulate_device` resize; `pdf` export → file; `upload` a file to an `<input type=file>`. (DW-5.3, DW-5.4)
- [ ] Live (dirty): localStorage op on `about:blank`/no-origin → explicit err. (DW-5.1)

**Phase 6 — Skill + evals**
- [ ] `validate_skill` on `skills/browser/` → zero errors, zero warnings (dogfood gate). (DW-6.2)
- [ ] `test_triggers` (clean): browser-task queries trigger the skill. (DW-6.3)
- [ ] `test_triggers` (dirty): near-miss queries (general web questions, unrelated automation) stay quiet. (DW-6.3)
- [ ] Unit (dirty): combined `description`+`when_to_use` ≤1536 chars (no listing truncation); SKILL.md ≤500 lines. (DW-6.1)
- [ ] Manual (doc-accuracy): every tool documented in references exists in the server; no documented-but-absent or absent-but-documented tool (code-clarity AI-doc audit). (DW-6.1)
- [ ] Manual: end-to-end — invoke the skill, run a snapshot→ref→act loop through the real MCP tools, confirm artifacts route to files/subagent, not main context. (DW-6.4)

---
## Assumptions
| Assumption | Confidence | Verify Before Phase | Fallback If Wrong |
|---|---|---|---|
| puppeteer-core's a11y snapshot exposes node identity stable enough to back stable refs across minor DOM mutations | Medium | Phase 2 | Build refs from CDP `DOM.backendNodeId` via `page.createCDPSession()`; adapter-internal change only, seam unaffected |
| attach-to-running works uniformly across Chrome channels (stable/beta/Canary) via `browserURL`/`wsEndpoint` | Medium | Phase 1 | Document supported channels; require `wsEndpoint` where `browserURL` discovery fails; keep launch-own as the reliable path |
| Lighthouse runs cleanly in-process via puppeteer-core under bun | Low–Medium | Phase 4 | Spawn a Node child for Lighthouse, or defer Lighthouse to a follow-up and ship perf-trace + Core Web Vitals (the marquee differentiator) without it. If fallback fires, drop DW-4.2 from the P4 gate and track as a P4b follow-up; remaining DW-4.x carry the gate. |
| bun runs puppeteer-core (no bundled browser) cleanly — install, launch, CDP, `page.evaluate` | Medium–High | Phase 1 | Pin a known-good puppeteer-core version; if bun chokes, isolate the adapter so a Node runtime could host just the browser layer |
| screencast/video capture is reliable via CDP `Page.startScreencast` under puppeteer-core+bun | Low | Phase 5 | Drop screencast to a follow-up (most droppable item); keep PDF + screenshot + storage/emulation, which are load-bearing. If fallback fires, drop DW-5.6 from the P5 gate and track as a P5b follow-up; remaining DW-5.x carry the gate. |
| ported svelte `cdp-browser.js` heuristics (shadow-DOM deep query, dialog scoring, collect diff) behave identically under `page.evaluate` | Medium–High | Phase 3 | Adjust the injected helpers; validate against the existing svelte test pages before relying on them |
| Storage-state origin-check under attach mode — `activePageHandle()` exposes the origin needed to validate a restored state file | Medium | Phase 5 | Require caller to pass expected origin explicitly as a restore parameter |

## Decision Log
| Decision | Alternatives Considered | Rationale | Phase |
|---|---|---|---|
| Substrate: **puppeteer-core** | Raw CDP (hand-rolled); Playwright; adopt Google's chrome-devtools-mcp | Same engine Google uses; gives a11y snapshot, auto-wait, interception, printToPDF, tracing, file upload, attach-to-running near-free; drop to raw CDP via `createCDPSession()` for gaps. Raw CDP = too big a surface (scope→slip); Playwright = heaviest, weak attach, weaker "DevTools" identity; adopting Google's leaves HAR + mocking gaps and a fiddly attach workflow | 1 |
| **Hexagonal (ports & adapters)** architecture | Direct puppeteer calls inside tools | Keeps puppeteer types out of core/tool layer; a raw-CDP adapter can replace puppeteer with zero core/tool changes (the named fallback for the substrate risk); makes the whole surface unit-testable with a fake `BrowserPort` | 1 (all) |
| **snapshot → stable refs** as primary interaction model | CSS-selector-first (the svelte script's model) | Whole field (Playwright, Google's, Browser MCP) moved off selector-first; ~200–400 tokens vs ~3–5k for a screenshot, deterministic, survives layout shifts. Ported selector machinery becomes the fallback path | 2 |
| **Payload-to-file** (large outputs → `/tmp` path, never inline) | Inline tool results | Screenshots/DOM/AX/HAR/traces never enter main context; preserves the svelte anti-context rule; single canonical threshold; skill routes Read-the-file work to a Haiku subagent | 3 (helper); 2/4/5 consume |
| **Recording → replay deferred** (not v1) | Build recording in v1 | User: "not central." Revisit once the action tool surface is stable | — (Notes) |

---
## Notes
- **Deferred (not v1):** recording → replay script (user: "not central"). Revisit as a follow-up once the action tool surface is stable.
- Google's `chrome-devtools-mcp` stays installed at user scope (attach mode, inert) as a puppeteer-core reference implementation.

---
## Execution Log

### Phase 1: Foundation & connection (Gate: Full)
- [x] BUILD: Discovery + design + TDD — hexagonal skeleton, 32 unit + 5 live tests, tsc clean
- [x] REVIEW: PASS (all 7 DW + 6 edge cases with execution evidence; 4 non-blocking test-assertion notes)
- [x] Committed
Commit: 808bb7f
Summary: mcp-browser/ Bun+strict-TS server stands; BrowserPort core seam + puppeteer-core adapter (zero puppeteer in core/tools, static-enforced), ConnectionManager (launch+attach, liveness/reuse), tabs tool, BrowserError barricade, writePayload/PAYLOAD_THRESHOLD_BYTES seam, plugin.json 2nd mcpServers entry + dep hook. P2-6 extend BrowserPort and consume getPage()/writePayload — never bypass them.

### Phase 2: Snapshot+refs interaction core (Gate: Full, security-sensitive)
- [x] BUILD: snapshot→stable-ref model + GoF Strategy targeting + 12 interaction/nav tools; 90 unit + 10 live tests, tsc clean
- [x] REVIEW: 3-sample security review, 3/3 PASS (all 6 DW + 8 edge cases with evidence)
- [x] Committed
Commit: d49689e
Summary: BrowserPort extended with snapshot/resolveTarget/interact/navigate/wait/scroll/screenshot. Refs = live ElementHandles via SerializedAXNode.elementHandle() (detached→stale_ref; no CDP fallback). resolveTarget is the single Strategy chokepoint (ref→selector→coords) that P3/P5 reuse for element-scoped ops — do not re-implement targeting. Navigate barricade is allowlist-only, pre-adapter (blocks file://, chrome://, javascript:). screenshot writes via the frozen writePayload seam ({path,bytes}); P3 fills the real threshold logic.
