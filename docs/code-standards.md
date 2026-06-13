<!-- base-commit: bb5a9868d563e09b5d6fdcdda5810517f51cd156 -->
<!-- generated: 2026-06-13 -->

# Code Standards

Conventions for the oberskills plugin, weighted toward the `mcp/` server (Bun + strict TypeScript, stdio MCP). A second MCP server (`mcp-browser/`) follows the same patterns. Extract from `mcp/` — it is the working reference.

## Forbidden Patterns

**Never `console.log` in `src/`** — stdout is the JSON-RPC transport on a stdio MCP server; a stray write corrupts every response. A static test (`test/static.test.ts`) fails the build on any match.
```typescript
// BAD — corrupts the MCP transport, silently breaks the client
console.log("connected");

// GOOD — stderr-only logger (src/lib/log.ts); all diagnostics go through it
import { log } from "./lib/log.ts";
log("skill-eval connected (7 tools)"); // -> console.error("[skill-eval]", ...)
```

**Never use `any` or unchecked casts to bridge types** — strict tsconfig has `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`. The one sanctioned `as` is the registrar's runtime trust boundary (SDK already validated args).
```typescript
// BAD — disables the compiler at the one place type safety matters
const data = JSON.parse(raw) as Benchmark;

// GOOD — narrow unknown, then validate with zod (src/lib/workspace.ts:97)
const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
  return parsed as Record<string, unknown>;
}
```

**Never trust a file read from disk without a zod schema** — workspace/data files are validated at the boundary. `types.ts`: "Every type that is read from disk has a zod schema."
```typescript
// GOOD — schema is the single normative format; .safeParse at the read boundary
const parsed = GraderOutputSchema.safeParse(structured);
if (!parsed.success) return { output: null, error: parsed.error.message };
```

**Never let a model choose a binding value** — verdicts, severities, summaries, and pass/fail are computed in TS, never emitted by the grader model. The model perceives; code decides.
```typescript
// types.ts — GraderOutput (model) omits severity/verdict; Grading (TS) adds them.
// "Verdict is computed deterministically in lib/verdict.ts, not by the grader."
```

## Code Examples

### Tool module shape (every file in `src/tools/`)
```typescript
// DO — from src/tools/validate-skill.ts. Module exports name/title/description/
// inputShape/handler; the satisfies line makes a wrong-shaped handler fail to
// compile, so register.ts can wire it with no casts.
export const name = "validate_skill";
export const title = "Validate (and optionally package) a skill";
export const description = "Lints a skill directory ... Companion to test_triggers.";
export const inputShape = {
  skill_path: z.string().describe("Absolute path to the skill directory."),
  package: z.boolean().default(false).describe("Also produce <dir-name>.skill."),
};
type Input = z.output<z.ZodObject<typeof inputShape>>;
export async function handler(args: Input): Promise<ToolResult> {
  if (!existsSync(resolve(args.skill_path))) return err(`does not exist`);
  return ok(humanText, { ...structured }); // text for the model + structuredContent
}
void ({ name, title, description, inputShape, handler } satisfies ToolModule<typeof inputShape>);

// DON'T — default export, hand-rolled JSON schema, throws on bad input,
// returns a bare string. Breaks the defineTool() contract in register.ts.
export default async function (args) {
  if (!args.skill_path) throw new Error("missing path");
  return JSON.stringify(validate(args.skill_path));
}
```

### Returning results — `ok()` / `err()`, never raw throws to the client
```typescript
// DO — src/lib/tool.ts. Human-readable text + optional structuredContent.
// The registrar try/catch turns any thrown error into an isError result, so
// handlers return err() for expected failures and only throw on bugs.
return ok(lines.join("\n"), { ...result });
return err(`skill_path does not exist: ${root}`);

// DON'T — throwing a raw error leaks the stack to the client; friendlyMessage
// (src/lib/tool.ts) caps echoed text at 2048 chars and never echoes env.
throw new Error(`failed: ${JSON.stringify(process.env)}`);
```

## Error Handling

Tool handlers return `err()` for expected failures; the registrar wraps every handler in try/catch and converts a thrown error into an `isError` result via `friendlyMessage`. Throw only for bugs.
```typescript
// src/register.ts:122 — single error boundary for all tools
async (args: unknown) => {
  try { return await tool.invoke(args); }
  catch (e) {
    log(`${tool.name} failed:`, friendlyMessage(e)); // stderr
    return { isError: true, content: [{ type: "text", text: `${tool.name} failed: ${friendlyMessage(e)}` }] };
  }
}
```

Async/streaming failures use a typed result, not exceptions — the Agent SDK's iterator can yield a result *then* throw, so a captured result is authoritative.
```typescript
// src/lib/agent.ts — runBounded never throws on a stream error; it reports it.
type BoundedResult = { result: SDKResultMessage | null; streamError: string | null;
                       timedOut: boolean; costIncomplete: boolean; /* ... */ };
// Gate on result.is_error, never on subtype (subtype stayed "success" on a live auth failure).
```

Bound every external call three ways: `maxTurns` + `maxBudgetUsd` + an `AbortController` timeout. On timeout with no result message, charge the budget cap conservatively (`costIncomplete: true`) — never report cost 0.

## Imports & Dependency Direction

Use explicit `.ts` extensions on every relative import (tsconfig `allowImportingTsExtensions` + `verbatimModuleSyntax`). Prefix Node builtins with `node:`. Import `type` separately where the symbol is type-only.
```typescript
// src/register.ts — node: builtins, external pkg, then internal .ts with type imports
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./lib/log.ts";
import { friendlyMessage, type ToolModule, type ToolResult } from "./lib/tool.ts";
```

Dependency direction: `tools/` → `lib/` + `types.ts`; `lib/` → `types.ts` (+ `log.ts`); `register.ts` imports tools; `server.ts` imports nothing static (it dynamically imports `register.ts` so a half-installed plugin fails with a clear stderr message, not a module-resolution stack).
```typescript
// src/server.ts — dynamic import keeps the entry point dependency-free
let registrar: typeof import("./register.ts");
try { registrar = await import("./register.ts"); }
catch (e) { console.error("[skill-eval] dependencies not installed yet — ..."); process.exit(1); }
```
Note: `server.ts` is the *only* place `console.error` is called directly — everywhere else uses `log()`.

## Testing Patterns

Framework: `bun test` (`bun test --timeout 60000`). Pure-logic suites run by default; live suites that spawn Agent SDK sessions are gated behind `RUN_LIVE_EVALS=1` and given long timeouts.
```typescript
// test/smoke.live.test.ts — gate pattern: describe vs describe.skip
const LIVE = process.env.RUN_LIVE_EVALS === "1";
const d = LIVE ? describe : describe.skip;
d("live smoke", () => { /* spawns real sessions, budget-capped */ });
```

Locate fixtures relative to the test file via `import.meta.url`. Copy a fixture into a tmpdir before any test that writes, so runs never dirty the repo.
```typescript
// test/checks.test.ts — write tests use a tmpdir + afterAll cleanup
const runDir = mkdtempSync(join(tmpdir(), "checks-test-"));
afterAll(() => rmSync(runDir, { recursive: true, force: true }));
```

The static suite IS a test: `test/static.test.ts` greps `src/` for `console.log` and runs `tsc --noEmit`, asserting empty stdout + exit 0. Treat typecheck failures as test failures.

## Naming Conventions

Files: `kebab-case.ts` everywhere (`run-eval.ts`, `trigger-set.ts`, `validate-skill.ts`). Tool filenames are the kebab form of the snake_case tool name (`grade_run` tool → `grade-run.ts`).

Tool identity vs file: tool `name` is `snake_case` (`validate_skill`), exported as a `const name`. zod schemas are `PascalCase` + `Schema` suffix (`GraderOutputSchema`); the inferred type drops the suffix (`type GraderOutput = z.infer<typeof GraderOutputSchema>`).
```typescript
// types.ts — schema/type naming pair, used throughout
export const EvalDefSchema = z.object({ /* ... */ });
export type EvalDef = z.infer<typeof EvalDefSchema>;
```

Env-var escape hatches are `SCREAMING_SNAKE` with the server prefix: `SKILL_EVAL_USE_SYSTEM_CLI`, `RUN_LIVE_EVALS`. A new server uses its own prefix.

## File Organization

```
mcp/
├── src/
│   ├── server.ts        # entry: #!/usr/bin/env bun, dynamic-imports register.ts
│   ├── register.ts      # builds McpServer, wires TOOLS[], single error boundary
│   ├── types.ts         # ALL zod schemas + types (single normative home of formats)
│   ├── tools/<tool>.ts  # one file per tool: name/title/description/inputShape/handler
│   └── lib/             # leaf helpers: log, tool, agent, workspace, checks, stats...
├── data/*.json          # static data, validated by a schema in types.ts on load
├── prompts/*.md         # LLM prompts kept as data (loaded via lib/prompts.ts), not code
└── test/                # *.test.ts (default) + *.live.test.ts (gated); fixtures/ tree
```
A new tool = a new file in `src/tools/`, added to the `TOOLS[]` array in `register.ts`. New persisted format = a schema in `types.ts`. New LLM prompt = a `.md` in `prompts/`, never an inline string.

## Technology Decisions

- Bun is the runtime and test runner (`engines.bun >= 1.3.0`). Do not add Jest/Vitest/ts-node. tsconfig is `noEmit` — Bun runs `.ts` directly.
- All Claude inference goes through `query()` from `@anthropic-ai/claude-agent-sdk` (rides subscription OAuth, pipes child stdio internally so the MCP transport is safe). Never call the Anthropic HTTP API directly here.
- Eval/probe runs always pass `settingSources: []` — the SDK default loads user settings, hooks, memory, and user MCP servers, which would leak into isolated runs.
- `z.toJSONSchema()` output must have its `$schema` key deleted before use as an SDK `outputFormat` (with it present the SDK silently returns undefined structured output — verified live). See `toOutputSchema` in `src/lib/agent.ts`.
- The plugin version lives only in `.claude-plugin/plugin.json`. Skills and server code never hardcode or display a version; the server reads it from the manifest at startup.

### Skill authoring (`skills/<name>/SKILL.md`)
- Frontmatter: `name` (must equal the directory name, kebab-case, no "claude"/"anthropic"), `description` (third person — what + when, ≤1024 chars), optional `when_to_use`. `description` + `when_to_use` combined ≤ 1536 chars or listing surfaces truncate.
- SKILL.md ≤ 500 lines; push depth into `references/`. Every reference must be linked directly from SKILL.md (link depth 1).
- `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` substitute ONLY in harness-loaded content (SKILL.md bodies, configs, hooks) — never inside `references/*.md`; use skill-name phrasing there.
- No self-assessed-compliance constructs ("If You're Thinking", "Rationalization | Reality", "Red Flags — STOP"). Use external/deterministic checkers. `validate_skill` lints all of the above.

### Evidence discipline (project CLAUDE.md)
Each canonical number lives in exactly one file; others point to it. `validate-skill.ts` owns the authoring limits (1024/1536/500) so skill bodies reference the tool instead of restating numbers.

## Exemplar Files

**`mcp/src/tools/validate-skill.ts`** — the model for a new tool: module-export shape, zod `inputShape` with `.describe()`, `type Input = z.output<...>`, `ok()`/`err()` returns (text + structuredContent), the closing `satisfies ToolModule` contract line, and pure-TS logic kept out of the handler.

**`mcp/src/lib/agent.ts`** — the model for any LLM/subprocess layer: `cleanEnv()` (env replaces, never merges), triple-bounded `runBounded`, the yield-then-throw failure taxonomy, `costIncomplete` accounting, and the structured-output one-retry rule.

**`mcp/src/types.ts`** — the single home of formats: every disk-read type has a paired `*Schema`; inline comments mark which fields are model-perceived vs TS-computed. Add new persisted formats here.

**`mcp/src/register.ts`** — bootstrap reference: `defineTool` compile-time bridge, the single try/catch error boundary, manifest-only version read, stderr-only `log`.
