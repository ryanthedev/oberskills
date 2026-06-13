# Discovery + Design: Phase 1 - Foundation & connection

## Files Found
- `mcp/` (skill-eval server) is the architectural mirror. Read in full for the seams:
  - `mcp/src/lib/tool.ts` — `ToolModule<Shape>`, `ok()`, `err()`, `friendlyMessage()`.
  - `mcp/src/register.ts` — `defineTool` compile-time bridge, single try/catch error boundary, manifest version read, `TOOLS[]`.
  - `mcp/src/server.ts` — `#!/usr/bin/env bun`, dynamic-import of register.ts, `console.error` only in this one file.
  - `mcp/src/lib/log.ts` — stderr-only `log()` with `[skill-eval]` prefix.
  - `mcp/src/types.ts` — all zod schemas; "every disk-read type has a zod schema"; named structuredContent types are `type` not `interface`.
  - `mcp/src/tools/grade-run.ts` — representative tool: `name/title/description/inputShape/handler` + closing `satisfies ToolModule`.
  - `mcp/test/static.test.ts` — greps src for `console.log`, runs `tsc --noEmit`.
  - `mcp/package.json`, `mcp/tsconfig.json` — strict TS, bun runtime.
- `.claude-plugin/plugin.json` — single `skill-eval` mcpServers entry + SessionStart dep hook (the pattern to extend for mcp-browser).
- `docs/code-standards.md` — present; weighted to `mcp/`; explicitly says "A second MCP server (`mcp-browser/`) follows the same patterns."

## Current State
- No `mcp-browser/` existed. Created the skeleton (`src/{core,adapters/puppeteer,tools,lib}`, `test/`), `package.json`, `tsconfig.json` (copied strict config), and ran `bun install` — `puppeteer-core@24.43.1`, `@modelcontextprotocol/sdk@1.29.0`, `zod@4.4.3` resolved cleanly under bun 1.3.14.

## Gaps
- None blocking. The plan's `Produces` contract is internally consistent and implementable. One nuance resolved in design: `ConnectionInfo`, `TabInfo`, `ConnectOptions` shapes are under-specified in the plan — defined below.

## Code Standards
Key conventions applied (from `docs/code-standards.md`):
- No `console.log` in `src/` (stderr-only `log()`); `console.error` only in `server.ts`.
- No `any`/unchecked casts; the one sanctioned `as` is the registrar trust boundary.
- Validate external input with zod at the boundary; never trust disk/process input.
- Tool module shape: `name/title/description/inputShape/handler` + `satisfies ToolModule`.
- Handlers return `ok()`/`err()`; throw only for bugs (registrar converts to isError).
- Explicit `.ts` extensions; `node:` builtins; `type` imports separated.
- Dependency direction: `tools/` → `lib/` + `types.ts` + `core/`; `server.ts` static-import-free.
- kebab-case files; snake_case tool names; `PascalCase…Schema` zod; `SCREAMING_SNAKE` env with server prefix (`BROWSER_MCP_*`).
- Version lives only in `plugin.json`; server reads it from the manifest.

## Test Infrastructure
- `bun test` (default suites) + `*.live.test.ts` gated behind `RUN_LIVE_EVALS=1` via `const d = LIVE ? describe : describe.skip`.
- Static suite mirrors `mcp/test/static.test.ts` (console.log grep + tsc --noEmit).
- Fixtures located via `import.meta.url`; tmpdir + cleanup for write tests.

## Assumption Verification (ran before implementing)
| Assumption | Result | Evidence |
|---|---|---|
| bun runs puppeteer-core (install, launch, CDP, page.evaluate) | CONFIRMED | Launched Chrome stable headless under bun; `browser.version()` = Chrome/149; `page.evaluate(1+1)=2`; `createCDPSession()` → `Runtime.evaluate(2+2)=4`. |
| attach-to-running across channels via browserURL/wsEndpoint | CONFIRMED (stable) | `puppeteer.connect({browserWSEndpoint})` and `puppeteer.connect({browserURL:"http://127.0.0.1:9333"})` both attached to a running Chrome stable and listed pages. Beta/Canary not installed on this host — documented as "verified on stable; other channels expected to work via the same `/json/version` discovery, untested here." |

Neither assumption was wrong → no UPDATE_PLAN on assumptions.

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-1.1 | server boots, registers all P1 tools, `tsc --noEmit` + `bun test` (incl. static suite) clean | COVERED | `register.test.ts::all P1 tools registered` (imports TOOLS, asserts names connect/tabs present, shapes valid); `static.test.ts` (console.log grep + tsc) |
| DW-1.2 | static check: zero puppeteer imports/types in `src/core/` and `src/tools/` | COVERED | `static.test.ts::no puppeteer in core or tools` (grep `puppeteer` over those dirs, assert empty) |
| DW-1.3 | connect works launch + attach; dead/unreachable → structured `connection_lost` BrowserError, never throws | COVERED | `connect.test.ts::launch mode via fake port`, `::attach via browserURL`, `::attach via wsEndpoint`, `::isAlive false yields connection_lost err (not thrown)`; live: `connection.live.test.ts::launch+attach real Chrome` |
| DW-1.4 | tabs lists/opens/selects/closes against fake port; closing active tab → defined outcome or `no_active_tab` | COVERED | `tabs.test.ts::list`, `::new`, `::select`, `::close`, `::close active tab promotes next / returns no_active_tab when none left` |
| DW-1.5 | bad inputs (malformed path/URL; both wsEndpoint+browserURL) rejected at barricade with {code,message,suggestion} | COVERED | `connect.test.ts::malformed executablePath rejected`, `::malformed browserURL rejected`, `::wsEndpoint+browserURL both → ambiguous err`, `::attach with neither → err` |
| DW-1.6 | ToolModule shape / defineTool / single error boundary / ok()/err() / stderr log() (`[browser]`) mirror mcp/ | COVERED | `tool-shape.test.ts::each tool satisfies ToolModule fields`; `register.test.ts::error boundary converts thrown handler to isError`; `log.test.ts::log writes to stderr with [browser] prefix and never stdout` |
| DW-1.7 | plugin.json second mcpServers entry + SessionStart dep hook for mcp-browser (manual reload) | COVERED | `plugin-manifest.test.ts::plugin.json is valid JSON`, `::mcp-browser entry points at bun run …/mcp-browser/src/server.ts`, `::SessionStart hook references mcp-browser`. Live reload = documented manual step. |

**All items COVERED:** YES (7/7 DW-IDs; equals the 7 in the dispatch prompt)

## Design Decisions

### Module-level design (aposd-designing-deep-modules) — BrowserPort + ConnectionManager

**Component:** the connection/tab seam between tools (driving adapter) and puppeteer (driven adapter).

#### Approaches Considered
1. **Thin port = pass-through to puppeteer.** `BrowserPort` mirrors puppeteer's Browser/Page 1:1; tools hold puppeteer objects. (Shallow; leaks types — violates the hexagonal constraint.)
2. **Deep port + adapter-internal state (chosen).** `BrowserPort` exposes the 8 connection/tab use cases from the contract; the puppeteer adapter (`ConnectionManager`) holds all Browser/Page/Target state internally and hands out opaque `PageHandle` tokens + plain `TabInfo`/`ConnectionInfo` DTOs. Liveness, reconnect, single-instance reuse, and active-tab bookkeeping all live behind the port.
3. **Port + separate session-store object.** Split connection lifecycle from tab bookkeeping into two collaborators behind the port. (Classitis for P1's surface — the two are communicationally cohesive: tabs only exist within a connection.)

#### Comparison
| Criterion | A (thin) | B (deep, chosen) | C (split) |
|-----------|----------|------------------|-----------|
| Interface simplicity | low (mirrors puppeteer) | high (8 methods, plain DTOs) | medium |
| Information hiding | none (puppeteer leaks) | high (Browser/Page/Target hidden) | high |
| Caller ease of use | callers juggle puppeteer | callers pass DTOs/handles | extra wiring |
| Hexagonal compliance | FAILS constraint | passes | passes |

#### Choice: B (deep port, adapter-internal state)
Rationale: it is the only option that satisfies the "no puppeteer types in core/tools" constraint while keeping the caller's common case trivial (`connect(opts)` → DTO). Sacrifices: the adapter is a larger module, but that is exactly where depth belongs — hundreds of lines of puppeteer/CDP detail behind 8 methods.

#### Depth Check
- Interface methods: 8 (`connect/disconnect/isAlive/listTabs/newTab/selectTab/closeTab/activePageHandle`).
- Hidden details: puppeteer `Browser`/`Page`/`Target`, wsEndpoint discovery, single-instance reuse, active-tab promotion policy, liveness probing, reconnect hint generation, CDP fallback seam.
- Common case complexity: simple (`connect` + `listTabs` are one call each).

### System-level boundaries (ca-architecture-boundaries)
- Dependency arrows point inward: `tools/` → `core/` ports ← `adapters/puppeteer/`. Core imports only `node:` builtins + own types (zero third-party). Verified by the DW-1.2 static grep.
- Actors: the MCP client (drives tools) vs the browser substrate (puppeteer). The port is the inversion seam — a raw-CDP adapter could replace puppeteer with no core/tool change (the substrate-risk fallback).
- `BrowserError` is core-owned (in `core/errors.ts`) so both tools and adapter depend inward on it.

### Defensive programming (cc-defensive-programming) — barricade at the tool layer
Error strategy chosen and applied consistently: **structured error result (`ok()`/`err()`), correctness-leaning** — connection problems return a typed `BrowserError` envelope, never a silent fallback (RF-12) and never a throw to the client (single boundary catches bugs only).

Barricade placement (DW-1.5): `connect.ts` validates external input BEFORE the adapter:
- `mode: "attach"` with both `browserURL` and `wsEndpoint` → `connect_ambiguous` err (no silent pick).
- `mode: "attach"` with neither → `connect_invalid` err.
- `executablePath` (launch): must be a non-empty string and exist on disk (`existsSync`) → else `executable_not_found`. (Allowlist-style: must point at a real file; no shell, no concatenation — SM-3 N/A since puppeteer spawns argv directly.)
- `browserURL`: must parse as a well-formed `http`/`https` URL via `new URL()` → else `invalid_browser_url`. (SSRF note: P1 only *attaches* to a debugging endpoint the user names; we validate well-formedness and scheme. Navigation-URL SSRF is P2.)
- `wsEndpoint`: must parse as a `ws`/`wss` URL → else `invalid_ws_endpoint`.

Liveness (DW-1.3 edge): `ConnectionManager.isAlive()` probes the live connection; every tab op first checks liveness and, if dead, the tool returns `connection_lost` with a reconnect suggestion — adapter does NOT silently auto-reconnect (would mask failure, RF-12).

Single-instance reuse (edge): `connect(mode:"launch")` while a managed live Chrome already runs returns the existing `ConnectionInfo` with `reused: true` rather than spawning a second.

Active-tab policy (DW-1.4 edge): closing the active tab promotes the next remaining tab (last-focused-wins → first remaining) as active and returns it; closing the last tab clears active and subsequent `activePageHandle()`/tab ops return `no_active_tab`.

`BrowserError` shape: `{ code: BrowserErrorCode; message: string; suggestion: string }`. `code` is a string-enum (zod) covering: `connect_ambiguous`, `connect_invalid`, `executable_not_found`, `invalid_browser_url`, `invalid_ws_endpoint`, `connection_lost`, `no_active_tab`, `unknown_tab`, `launch_failed`, `attach_failed`. Tools convert a `BrowserError` to `err()` with a one-line `code: message — suggestion` text plus the structured object.

### DTO shapes (resolving the plan's under-specification)
- `ConnectOptions = { mode: "launch"|"attach"; executablePath?; channel?; browserURL?; wsEndpoint?; headless? }` — zod in `types.ts`; the barricade enforces the cross-field rules above.
- `ConnectionInfo = { mode; wsEndpoint: string; reused: boolean; tabCount: number }`.
- `TabInfo = { tabId: string; url: string; title: string; active: boolean }`.
- `PageHandle = { readonly tabId: string }` — opaque token; adapter resolves `tabId → puppeteer Page` via an internal map. Core/tools treat it as opaque (never read puppeteer off it).

### Payload seam (lib/payload.ts) — P1 stub
`PAYLOAD_THRESHOLD_BYTES` exported constant + `writePayload(name, data, ext) → { path, bytes }`. P1 stub always writes to `/tmp` (via an injectable write fn defaulting to `node:fs/promises writeFile`, so P3's dirty-write test can inject a rejecting fn without touching disk). Signature is the stable contract; P3 fills threshold/inline logic. A small P1 test asserts the stub writes and returns path+bytes.

## Prerequisites
- [x] Required files exist (skeleton + config created)
- [x] Dependencies available (puppeteer-core, mcp sdk, zod installed under bun)
- [x] Chrome stable present at the standard macOS path (for live tests)
- [x] Assumptions verified (both confirmed)

## Recommendation
BUILD — implement the hexagonal skeleton per design B with the tool-layer barricade and the deep `BrowserPort`/`ConnectionManager`, fake-port unit tests for all DW items, gated live tests, the static suite, and the plugin.json wiring.
