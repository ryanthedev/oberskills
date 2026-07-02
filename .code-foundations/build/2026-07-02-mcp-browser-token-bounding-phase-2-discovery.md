# Discovery + Design: Phase 2 - skill-eval structured errors

## Files Found
- `mcp/src/lib/tool.ts` — `ok()`/`err()` helpers, `ToolResult` type. `err(text)` currently returns plain text only, no structured content.
- `mcp/src/types.ts` — single normative home for all skill-eval data shapes (evals, grading, benchmark, etc). No error-code type yet.
- `mcp/src/tools/*.ts` (8 files: optimize-description, validate-skill, run-eval, test-triggers, grade-run, aggregate-benchmark, compare-outputs, register.ts) — 21 `err(...)` call sites across 7 tool files, all passing a single text string.
- `mcp-browser/src/core/errors.ts` — reference shape ONLY (read, not imported/touched): `BrowserErrorCode` string-literal union, `BrowserErrorShape = {code, message, suggestion}`, `BrowserError` class with `.toShape()`/`.toText()`.
- `mcp/test/static.test.ts` — already gates zero `console.log` in `src/` and `tsc --noEmit` exit 0. Reused for DW-2.3, not rewritten.

## Current State
`err()` signature: `err(text: string): ToolResult` → `{ isError: true, content: [{type:"text", text}] }`. No second parameter, no structuredContent ever emitted on the error path (contrast with `ok()`, which already accepts an optional `structured` param).

All 21 err() call sites pass only a message string built from local context (missing path, invalid parse, generation failure, etc). None currently carry a machine-readable code or a suggested next step.

## Gaps
- `err()` needs a second, optional parameter carrying `{code, suggestion}`, emitted as `structuredContent: {code, message, suggestion}` when present — text output must stay unchanged in both branches.
- No `ErrorCode` union exists in `types.ts` — needs to be a plain TS string-literal union (mirroring `BrowserErrorCode`, which is a plain type, not a zod schema, since this is emitted, not parsed off disk).
- The plan's IN-scope line says "Update the failure call sites across `mcp/src/tools/**`" and separately lists three call sites as "at minimum". Read together, the intended scope is: update every failure call site in `mcp/src/tools/**`, with the three named sites treated as the non-negotiable floor (this also matches DW-2.2's "at least the three named"). I will update all 21 call sites so no err() in tools/** is left as a bare, uncoded string — leaving some sites structured and others not would be an inconsistent contract for callers.

## Code Standards
`docs/code-standards.md` does not exist in this repo. Applying `CLAUDE.md` conventions instead: Bun + strict TypeScript; no `console.log` in `mcp/src`; `bunx tsc --noEmit` and `bun test` must pass clean. Existing code style observed: JSDoc block comments at file top explaining the module's contract/pattern; no `as unknown`/`as never` casts; concise single-line early returns for validation failures.

## Test Infrastructure
Bun's built-in test runner (`bun:test`, `describe`/`test`/`expect`). Existing unit tests are colocated in `mcp/test/*.test.ts`, importing directly from `../src/...`. No mocking framework in use — tests call pure functions directly. `static.test.ts` already runs `tsc --noEmit` as a subprocess assertion; reused unmodified for DW-2.3's typecheck requirement.

## DW Verification

| DW-ID | Done-When Item | Status | Test Cases |
|-------|---------------|--------|------------|
| DW-2.1 | err(text, {code, suggestion}) returns isError:true with structuredContent:{code,message,suggestion}; err(text) alone returns the current plain-text result with no structuredContent | COVERED | `mcp/test/tool.test.ts`: `"err(text) returns plain isError result with no structuredContent"`, `"err(text, {code, suggestion}) attaches structuredContent {code, message, suggestion}"` |
| DW-2.2 | At least the three named failure paths (skill-path-missing, unknown-eval-id, query-generation-failed) pass a structured code + suggestion | COVERED | `mcp/test/tool.test.ts`: `"run-eval skill_path-missing call site emits code+suggestion"`, `"run-eval unknown_eval_id call site emits code+suggestion"`, `"run-eval query_generation_failed call site (test-triggers) emits code+suggestion"` — driven by invoking each tool's `handler()` directly against fixtures that trigger the failure, asserting `structuredContent.code`/`.suggestion` are populated. Additionally, every other err() call site across tools/** is updated with a code+suggestion (see Gaps), so this is a strict superset of the DW floor. |
| DW-2.3 | `cd mcp && bunx tsc --noEmit` clean and `bun test` green; no console.log in mcp/src | COVERED | Existing `mcp/test/static.test.ts` (unmodified) plus manual `bunx tsc --noEmit` / `bun test` / `grep console.log` runs before reporting done. |

**All items COVERED:** YES

## Design Decisions

**ErrorCode union placement and shape.** Add `export type ErrorCode = "..." | "..." | ...;` to `mcp/src/types.ts`, directly below the existing type exports, as a plain TS union (not a zod schema) — mirroring `BrowserErrorCode` in mcp-browser, which is also plain since it is only ever emitted by server code, never parsed from untrusted disk/network input. One code per distinct failure *reason* (not one per call site) — e.g. all four "skill_path does not exist" sites across optimize-description/validate-skill/test-triggers/run-eval share `skill_path_missing`, while `unknown_eval_id` and `query_generation_failed` are each single-reason codes. This keeps the union small (~17 codes) and makes codes a meaningful dimension callers can switch on, rather than one code per line number.

**err() signature.** Extend to `err(text: string, envelope?: { code: ErrorCode; suggestion: string }): ToolResult`. When `envelope` is omitted, behavior is byte-for-byte identical to today (no structuredContent key at all — matching how `ok()` already omits `structuredContent` when `structured` is undefined, so the two helpers stay symmetric). When present, `structuredContent: { code: envelope.code, message: text, suggestion: envelope.suggestion }` is added alongside the unchanged `content` text array. This satisfies the edge case "suggestion required whenever code is given, enforced by the type, not by a runtime check" — the second parameter is a single object with both fields required together, so it is structurally impossible to pass `code` without `suggestion`.

**Call-site suggestions.** Each suggestion is a concrete, actionable next step referencing the specific input field or action the caller should take (e.g. "Pass an existing skill directory path in skill_path." / "Call optimize_description with action: \"start\" first."), matching mcp-browser's documented contract ("a concrete next step for the caller — always populated, never empty").

**Alternative considered and rejected:** a `BrowserError`-style thrown class mirroring mcp-browser's `.toShape()`/`.toText()` pattern. Rejected because skill-eval's `err()` call sites are all early-return validation checks inline in handlers (no adapter layer, no catch-and-convert boundary) — introducing a throw/catch class would be a bigger structural change than the plan's scope ("no server-instruction rewrite... mirror, do NOT import") calls for. A plain optional-parameter envelope on the existing `err()` function is the minimal change that produces the same wire shape.

## Prerequisites
- [x] Required files exist (`mcp/src/lib/tool.ts`, `mcp/src/types.ts`, all `mcp/src/tools/*.ts`)
- [x] Dependencies available (bun, zod already installed; no new dependency needed, matching OUT-of-scope)
- [x] No missing prerequisites

## Recommendation
BUILD. Extend `err()` in `tool.ts`, add `ErrorCode` union to `types.ts`, update all 21 `err()` call sites in `mcp/src/tools/**` with a code + concrete suggestion, add `mcp/test/tool.test.ts` covering both `err()` forms and the three named failure paths (plus broader coverage of the other updated sites), then run the full suite + typecheck + console.log gate.
