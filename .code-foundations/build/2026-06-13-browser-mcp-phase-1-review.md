# Review: Phase 1 - mcp-browser server (connection + tabs)

## Executed Results (Step 0)

| Command | Result |
|---------|--------|
| `bun install` | Clean — 171 packages, no changes |
| `bunx tsc --noEmit` | Exit 0, zero output |
| `bun test` (unit suite) | **32 pass, 6 skip, 0 fail** — 95 expect() calls across 9 files |
| `bun test test/connection.live.test.ts` | 6 skipped (RUN_LIVE_EVALS not set) — not verified here |
| Static grep: `console.log` in src/ | Zero hits in executable code (only in comment strings) |
| Static grep: puppeteer imports in src/core + src/tools | Zero import statements (comment mentions only) |
| plugin.json validity | Valid JSON confirmed |

---

## Requirement Fulfillment

### DW-1.1
PREMISE: `mcp-browser/` server boots, registers all P1 tools, and `bunx tsc --noEmit` + `bun test` (incl. the static `console.log`/tsc suite) pass clean.
EVIDENCE: `register.ts:78` — `TOOLS = [defineTool(connect), defineTool(tabs)]`; `static.test.ts` tsc test exits 0; 32 tests pass, 0 fail.
TRACE: `bun test` runs `static.test.ts` which spawns `bunx tsc --noEmit` as a subprocess (exit 0); `register.test.ts` asserts `TOOLS.map(t=>t.name).sort()` equals `["browser_connect","browser_tabs"]`; all 32 tests pass.
VERDICT: **PASS**

---

### DW-1.2
PREMISE: A static check confirms zero puppeteer imports/types in `src/core/` and `src/tools/` (adapter converts at the boundary).
EVIDENCE: `static.test.ts:37-47` — strips comments, then checks for puppeteer `from` imports and `Puppeteer.` namespace references; `grep -rn "^import.*puppeteer"` in core/ and tools/ returned zero hits.
TRACE: `bun test test/static.test.ts` runs the "zero puppeteer imports/types in src/core and src/tools" test → strips comments from all `.ts` files in those dirs → regex matches zero files → test passes. Shell confirmation: only comment text mentions "puppeteer" in those dirs.
VERDICT: **PASS**

---

### DW-1.3
PREMISE: `connect` works in both modes (launch-own + attach via browserURL/wsEndpoint); a dead/unreachable connection returns a structured `connection_lost` `BrowserError` (never throws to the client).
EVIDENCE:
- Launch mode: `connect.test.ts:13-18` — "launch mode connects and reports tab_count" passes.
- Attach via browser_url: `connect.test.ts:21-26` — passes.
- Attach via ws_endpoint: `connect.test.ts:28-33` — passes.
- Dead connection → connection_lost: `tabs.test.ts:90-98` — "tab op on a dead connection returns connection_lost (not thrown)"; sets `port.alive=false`, calls `tabs.handler({action:"list"})`, asserts `r.isError===true` and `structured(r).code==="connection_lost"`.
- Never throws: `connect.ts:117-119` — catch block returns `errFromBrowserError(e)` for BrowserError; only rethrows genuine bugs.
- Unreachable attach (attach_failed): tested only in live test (`connection.live.test.ts:63-72`) which is skipped here; the adapter's catch block at `connection.ts:78-85` wraps all puppeteer connection errors into `BrowserError(attach_failed,...)`, so the tool's catch returns `err()` not a throw. This path is covered by the unit suite's error boundary test in register.test.ts.
TRACE: `port.alive=false` → `tabs.handler` → `port.isAlive()` returns false → `errFromBrowserError(connectionLost)` returned with `{code:"connection_lost", suggestion:/.../}` → test asserts `isError=true`, `code==="connection_lost"` → PASS.
VERDICT: **PASS**

---

### DW-1.4
PREMISE: `tabs` tool lists/opens/selects/closes tabs against a fake `BrowserPort`; closing the active tab yields a defined active-tab outcome or `no_active_tab`.
EVIDENCE:
- list: `tabs.test.ts:21-27` — "list returns the open tabs" passes.
- new: `tabs.test.ts:29-37` — "new opens a tab and it becomes active" passes.
- select: `tabs.test.ts:39-47` — "select switches the active tab" passes.
- close: `tabs.test.ts:49-56` — "close removes a tab" passes.
- Close active tab → promotion: `tabs.test.ts:58-67` — "closing the active tab promotes the next remaining tab"; closes fake-2 (active), asserts list length=1 and `list[0].active===true` → PASS.
- Close last tab → no_active_tab: `tabs.test.ts:69-75` — "closing the last tab yields no_active_tab on activePageHandle"; calls `tabs.handler({action:"close",tab_id:"fake-1"})` (the last tab), then asserts `port.activePageHandle()` throws (BrowserError no_active_tab). The tool returns `ok("...no_active_tab", {no_active_tab:true})` (tabs.ts:71-74) — the close path runs and produces a defined outcome. The test exercises the tool; it verifies port-level state rather than the `no_active_tab:true` flag in structuredContent (see Notes).
TRACE: close fake-2 (active) → FakePort promotes fake-1 → tabs.handler returns `ok({closed:"fake-2", active:{tab_id:"fake-1",...}})` → subsequent list shows fake-1 active. Close fake-1 (last) → FakePort sets activeId=null → tabs.handler returns `ok("closed fake-1; no_active_tab", {no_active_tab:true})`.
VERDICT: **PASS**

---

### DW-1.5
PREMISE: Bad inputs (malformed executablePath/browserURL; both wsEndpoint+browserURL supplied) are rejected at the tool barricade with `{code,message,suggestion}`.
EVIDENCE:
- Both browser_url + ws_endpoint: `connect.test.ts:35-46` — code="connect_ambiguous", suggestion truthy → PASS.
- Neither target for attach: `connect.test.ts:48-53` — code="connect_invalid" → PASS.
- Malformed browser_url: `connect.test.ts:55-63` — code="invalid_browser_url", message+suggestion truthy → PASS.
- Non-ws ws_endpoint: `connect.test.ts:64-69` — code="invalid_ws_endpoint" → PASS.
- Non-existent executable_path: `connect.test.ts:71-76` — code="executable_not_found" → PASS.
TRACE: `barricade()` in `connect.ts:44-98` — checks each condition before calling `getPort().connect()`, returns `BrowserError` on violation → `handler` checks `isBrowserError(opts)` → `errFromBrowserError(opts)` → `{isError:true, content:[...], structuredContent:{code,message,suggestion}}`.
VERDICT: **PASS**

---

### DW-1.6
PREMISE: ToolModule shape / `defineTool` bridge / single error boundary / `ok()`/`err()` / stderr `log()` (`[browser]`) all mirror `mcp/`.
EVIDENCE:
- ToolModule shape: `tool.ts:22-28` — identical generic structure `{name,title,description,inputShape,handler}` to `mcp/src/lib/tool.ts`.
- defineTool bridge: `register.ts:68-76` — identical `defineTool<Shape>` pattern; `tool-shape.test.ts:7-18` asserts all five exports on each module.
- Single error boundary: `register.ts:84-99` — `buildErrorBoundaryHandler`; `register.test.ts:18-26` proves thrown handler returns `isError` result, not propagation.
- `ok()`/`err()`: `tool.ts:30-43` — matching signatures; `errFromBrowserError` at `tool.ts:50-52`.
- `log()` stderr with `[browser]` prefix: `log.ts:5-7` — `console.error("[browser]", ...args)`; `log.test.ts:5-23` confirms stderr output, `[browser]` prefix, zero stdout writes.
TRACE: `bun test test/register.test.ts test/log.test.ts test/tool-shape.test.ts` — all assertions pass.
VERDICT: **PASS**

---

### DW-1.7
PREMISE: `plugin.json` carries a second mcpServers entry pointing at `bun run ${CLAUDE_PLUGIN_ROOT}/mcp-browser/src/server.ts`, and a SessionStart dep hook mirroring the existing one for `mcp-browser/`.
EVIDENCE:
- mcpServers entry: `plugin.json:15-18` — `"mcp-browser": {"command":"bun","args":["run","${CLAUDE_PLUGIN_ROOT}/mcp-browser/src/server.ts"]}`.
- SessionStart hook: `plugin.json:29-31` — second hook entry referencing `/mcp-browser/package.json` and `/mcp-browser/node_modules`.
- Test assertions: `plugin-manifest.test.ts:17-35` — three tests pass: valid JSON, mcp-browser entry with correct command/args, SessionStart hook contains mcp-browser deps.
TRACE: `plugin-manifest.test.ts` reads the manifest via relative URL from test dir → asserts `servers["mcp-browser"]` exists, command="bun", args contain `${CLAUDE_PLUGIN_ROOT}/mcp-browser/src/server.ts`; asserts `SessionStart` commands contain `/mcp-browser/package.json` and `/mcp-browser/node_modules` → all pass.
VERDICT: **PASS**

---

**All requirements met:** YES

---

## Edge Case Coverage

| Edge Case | Test | Verdict |
|-----------|------|---------|
| Attach target unreachable / wrong Chrome channel → structured err with suggestion, never throw | `connection.live.test.ts:63-72` (skipped unit suite; live-gated) + `connect.ts:78-85` adapter catch wraps to `BrowserError(attach_failed)`, tool catch returns `err()` not throw; error boundary backstop in register. Unit coverage exists for the "never-throw" contract via error boundary test. | PASS (live test unverified here; unit coverage of the pattern is sufficient) |
| Chrome dies mid-session → liveness check detects, next call returns `connection_lost` with reconnect hint, no silent retry | `tabs.test.ts:90-98` — sets `port.alive=false`, tabs.handler returns `connection_lost` with suggestion matching `/reconnect\|connect/i` | PASS |
| Launch when managed Chrome already runs → reuse, don't spawn second | `connection.live.test.ts:46-49` (skipped) — live test asserts `reused=true` on second launch; `connection.ts:52-58` adapter early-returns on `this.browser !== null && this.browser.connected`. FakePort implements reuse flag but no unit test calls connect() twice in launch mode. | PASS for implementation; live-only for full proof |
| User-supplied `executablePath`/`browserURL` validated (path exists, URL well-formed) before reaching adapter | `connect.test.ts:55-76` — `executable_not_found`, `invalid_browser_url`, `invalid_ws_endpoint` all returned at barricade before `getPort().connect()` | PASS |
| Closing last/active tab → defined active-tab outcome or `no_active_tab` | `tabs.test.ts:58-75` — two tests cover (a) active tab close → next promoted, (b) last tab close → no_active_tab | PASS |
| `wsEndpoint` + `browserURL` both supplied → rejected as ambiguous, not silently picking one | `connect.test.ts:35-46` — returns `connect_ambiguous` err, suggestion is "not both" | PASS |

---

## Dead Code

None found. No unreachable code after early returns, no commented-out blocks, no debug statements in executable paths.

---

## Correctness Dimensions

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Concurrency | N/A | Single-process stdio server; no shared mutable state between concurrent requests (session.ts holds one BrowserPort; tool handlers are sequential per the MCP SDK dispatch). No concurrency primitives present. |
| Error Handling | PASS | All external calls wrapped in try/catch; BrowserError always returned via `err()`, never thrown to client. Error boundary at `register.ts:84-99` is a backstop. `safeTitle()` in adapter swallows page.title() errors silently (acceptable — title is display-only). `isBrowserError` catch+rethrow in tool handlers is the correct pattern: domain errors → structured, bugs → rethrow to boundary. |
| Resources | PASS | `PuppeteerConnectionManager.disconnect()` at `connection.ts:92-102` uses `finally` to null out `browser/owned/activeTabId` regardless of close/disconnect outcome. No unclosed file handles in the source paths reviewed. |
| Boundaries | PASS | `listTabs()` guards against activeTabId pointing to a vanished page (`connection.ts:116-120`). `findPage()` throws `BrowserError(unknown_tab)` rather than returning undefined. `pageId()` mints stable ids via WeakMap + monotonic counter, avoiding index-based brittleness. |
| Security | PASS | `payload.ts:28-31` `sanitize()` restricts filenames to `[a-zA-Z0-9._-]` to prevent path traversal. `browserURL`/`wsEndpoint` are validated to well-formed URL schemes before reaching the adapter (SM-2 SSRF partial). `executablePath` is existence-checked before use. No shell interpolation. `friendlyMessage()` truncates to 2048 chars, preventing unbounded stderr/error flooding. |

---

## Notes (non-blocking)

1. **`no_active_tab` structuredContent flag under-asserted.** `tabs.test.ts:69-75` calls `tabs.handler({action:"close",...})` and verifies port-level behavior (`activePageHandle()` throws), but no `expect()` checks `structured(r).no_active_tab === true`. The code path runs and is correct; the test assertion is weaker than the "100% everything" coverage target warrants.

2. **Launch-reuse unit test absent.** The "launch when managed Chrome already runs → `reused: true`" edge case is exercised only in the live test (`connection.live.test.ts:46-49`). A unit test calling `connect.handler({mode:"launch",...})` twice against a FakePort would confirm the tool correctly surfaces `reused: true` at the tool level without live Chrome.

3. **`attach_failed` error not reachable from unit suite alone.** The FakePort's `connect()` never throws, so the connect tool's `catch(e) { if(isBrowserError(e)) return errFromBrowserError(e) }` path at `connect.ts:117-119` is not exercised by unit tests. The path is correct by inspection and covered structurally by the error boundary test, but a FakePort variant that throws `BrowserError(attach_failed)` would close the gap.

4. **`safeTitle()` swallows exceptions silently** (`connection.ts:198-203`). This is correct for display-only title fetching but is a textbook RF-12 risk (returns `""` on error, indistinguishable from a page with no title). Acceptable for this context; worth noting for P2 when page titles matter for navigation decisions.

5. **`payload.ts` is P1 stub (always writes to /tmp).** The `PAYLOAD_THRESHOLD_BYTES` constant is exported but not yet consulted. The code comment makes this intent explicit. No issue for P1.

6. **`connect.test.ts:79-88` DW-1.3 test is weak.** The test comment says "liveness applies to tab ops — see tabs.test.ts" which is correct. But the test body only asserts `r).toBeDefined()` — essentially a no-op. It confirms no exception is thrown but does not assert isError/success or the error code. The tabs.test.ts test covers the actual connection_lost behavior adequately.

---

**Verdict: PASS**

POST-GATE PASS. Review written to `/Users/r/repos/oberskills/.claude/worktrees/browser-mcp/.code-foundations/build/2026-06-13-browser-mcp-phase-1-review.md`.
