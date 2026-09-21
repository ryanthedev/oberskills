# Subagent platform mechanics — Claude Code

Platform facts for dispatching subagents and writing reusable agent definition files. Condensed from the code.claude.com subagent and interactive-mode docs (fetched 2026-09-21) and first-hand checks on Claude Code v2.1.278 that day. Version floors are quoted from the docs so a reader on an older build can tell what applies. This file is the plugin-canonical home for harness facts — nesting, model resolution, the frontmatter field table, `/btw` — other oberskills files point here.

## Contents

1. [The Agent tool](#1-the-agent-tool)
2. [Built-in subagents](#2-built-in-subagents)
3. [Subagent frontmatter fields (canonical table)](#3-subagent-frontmatter-fields-canonical-table)
4. [Enforce boundaries at the schema level](#4-enforce-boundaries-at-the-schema-level)
5. [What loads into a subagent at startup](#5-what-loads-into-a-subagent-at-startup)
6. [Forks and `/btw`](#6-forks-and-btw)
7. [Background, resume, transcripts, compaction](#7-background-resume-transcripts-compaction)
8. [Gotchas](#8-gotchas)

## 1. The Agent tool

- In v2.1.63 the Task tool was renamed **Agent**. Existing `Task(...)` references in settings and agent definitions still work as aliases.
- **Call parameters** in an interactive session (tool schema, v2.1.278): `description`, `prompt`, `subagent_type`, `model`, `isolation`. There is no per-call `effort` — effort binds through a definition's frontmatter (§3) or the session — and no `run_in_background` while fork mode is on (§7).
- `model` takes an alias (`sonnet`/`opus`/`haiku`/`fable`); omit it to inherit. It also sticks when the subagent is resumed (v2.1.211+).
- **Model resolution order** (v2.1.251+): 1) per-invocation `model` parameter → 2) the definition's `model` frontmatter, where `inherit` selects the main conversation's model → 3) `CLAUDE_CODE_SUBAGENT_MODEL` env var → 4) the main conversation's model. Before v2.1.251 the env var came first and overrode the other two. Setting `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` alongside it (v2.1.257+) puts every subagent on that model and stops Claude passing `model` at all. A blocked value under an org `availableModels` allowlist is substituted, with a warning.
- **Fork exception.** A fork (`subagent_type: "fork"`) always runs on the main conversation's model: a per-call `model` is ignored, and forks stay on the inherited model even under `_FORCE`.
- `isolation` per call: `"worktree"` (documented — a temp git worktree branched from the default branch, not the parent's `HEAD`; auto-cleaned if unchanged) and `"remote"` (in the v2.1.278 tool schema — cloud environment, always background, availability gated — but not in the subagent docs as of this fetch). This is a different surface from the frontmatter `isolation` field (§3).
- `Agent(agent_type)` allowlist syntax in a `tools:` list restricts which subagent types can be spawned.
- **Nesting is on by default.** A subagent can spawn subagents of its own, up to three layers below the main conversation (default since v2.1.219; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes it, `1` turns nesting off; v2.1.172–2.1.216 allowed five layers, fixed). At the limit the harness withholds the `Agent` tool rather than erroring — except in a fork, which keeps the tool and gets an error. Confirmed by dispatch on v2.1.278: a depth-1 subagent spawned a depth-2 subagent that itself still had `Agent`. In an interactive session a subagent waits for its own background children, so only the top-level summary returns; under `-p` and the Agent SDK it doesn't wait, and a late child reports to the main conversation instead. To keep one agent from spawning, omit `Agent` from its `tools` or list it in `disallowedTools`.
- **Concurrency cap:** 20 running subagents per session (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, v2.1.217+; not enforced under ultracode); the error tells Claude not to retry. There is no cap on the total spawned over a session. These are ceilings, not targets — §4 of the skill body sizes fan-outs far below them.
- Disable specific agent types session-wide with `"permissions": {"deny": ["Agent(Explore)", "Agent(my-custom-agent)"]}` or `--disallowedTools "Agent(Explore)"`.

## 2. Built-in subagents

| Agent | Model | Tools | Notes |
|---|---|---|---|
| Explore | Inherits, capped at Opus on the Claude API (v2.1.198+; always Haiku before that) | Read-only | Thoroughness levels: quick / medium / very thorough. Skips CLAUDE.md and git status. One-shot — returns no agent ID, not resumable |
| Plan | Inherits | Read-only | Plan-mode research. Skips CLAUDE.md and git status. One-shot |
| general-purpose | Resolution order (§1) | All | Resumable; what you get when no type is requested; default agent type for `context: fork` skills |
| claude | Resolution order (§1) | All | Catch-all when no specialized agent fits; also the default for dispatched background sessions |
| statusline-setup | Sonnet | — | `/statusline` helper |
| claude-code-guide | Haiku | — | Claude Code Q&A |

Explore is no longer a cheap-by-construction search: on a top-tier session it runs on Opus. `CLAUDE_CODE_SUBAGENT_MODEL` alone doesn't move Explore or Plan. To keep exploration cheap, define a user or project subagent named `Explore` with `model: haiku` (it overrides the built-in), or dispatch general-purpose with `model: "haiku"`.

Because Explore and Plan skip CLAUDE.md and git status, restate any CLAUDE.md rule the delegated task depends on directly in the delegation prompt. Nothing makes those two load it; the reverse — a definition that skips CLAUDE.md on purpose — is the `omitClaudeMd` field (§3).

## 3. Subagent frontmatter fields (canonical table)

This is the plugin-canonical copy of the field list — other oberskills files point here instead of duplicating it. Only `name` and `description` are required.

| Field | Notes |
|---|---|
| `name` | Lowercase letters + hyphens, no `:` (reserved for plugin scoping; enforced from v2.1.218); hooks receive it as `agent_type` |
| `description` | When Claude should delegate to this subagent. Include "use proactively" to encourage automatic delegation |
| `tools` | Allowlist. **Trap: omitting `tools` inherits ALL tools available to subagents, not none.** To preload skills, use the `skills` field rather than listing `Skill` here |
| `disallowedTools` | Denylist. If both are set, `disallowedTools` is applied first, then `tools` is resolved against the remaining pool. A specifier entry such as `Bash(git push *)` still removes the whole tool |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full model ID (e.g. `claude-opus-5`), or `inherit`. Omitted → the resolution order in §1. Aliases track the latest model per tier, so pin a full ID when a definition must not follow a tier upgrade |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max` (available levels depend on the model); overrides the session effort for this subagent. Default: inherits from the session. This field is the only per-agent effort binding — the Agent call has no effort parameter |
| `permissionMode` | `default` (alias `manual`, v2.1.200+), `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. **Ignored for plugin subagents** |
| `maxTurns` | Maximum agentic turns. At the limit the output returns marked partial and the agent can be resumed (v2.1.246+) |
| `skills` | Skills preloaded at startup — FULL content injected, not just the description. Cannot preload skills with `disable-model-invocation: true`. The subagent can still invoke unlisted skills via the Skill tool |
| `mcpServers` | Name references to configured servers, or inline definitions scoped to this subagent only. **Ignored for plugin subagents** |
| `hooks` | Lifecycle hooks scoped to the subagent (`Stop` auto-converts to `SubagentStop`). **Ignored for plugin subagents** |
| `memory` | `user` (`~/.claude/agent-memory/<name>/`), `project` (`.claude/agent-memory/<name>/`), `local` (`.claude/agent-memory-local/<name>/`). Injects the first 200 lines or 25KB of MEMORY.md, whichever comes first |
| `background` | `true` = stay in the background even when Claude asks for the foreground. Only matters where fork mode is off (§7); with it on, everything is already background |
| `omitClaudeMd` | `true` = launch without user, project, and local CLAUDE.md (managed policy still loads). For agents that take everything from the delegation prompt. v2.1.271+ |
| `isolation` | `worktree` = run in a temp git worktree off the default branch; auto-cleanup if no changes. The only documented frontmatter value — the per-call `isolation` parameter (§1) is a separate surface |
| `color` | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | Auto-submitted first user turn when the agent runs as the main session agent (`--agent` / `agent` setting) |
| `experimental` | Map; `cacheTtl: 5m \| 1h` picks the prompt-cache lifetime for this subagent's requests. v2.1.248+ |

Two traps worth restating:

1. **Tools default trap.** An agent definition without a `tools` line gets everything, including write tools. Role-limited agents must enumerate.
2. **Plugin-agent restrictions.** For security, plugin subagents ignore `hooks`, `mcpServers`, and `permissionMode`; copy the file into `.claude/agents/` if you need them.

## 4. Enforce boundaries at the schema level

Enforce role limits with `tools`/`disallowedTools`, not prompt instructions. A reviewer that has no write tools in its schema cannot write — the violation is impossible rather than merely discouraged.

| Agent role | Schema enforcement |
|---|---|
| Planner / researcher | Read-only tools (`Read, Grep, Glob`). No file writes, no shell |
| Reviewer / verifier | Read + analysis tools; `Bash` only if it must run tests. No Edit/Write |
| Executor | Full tool access, but BOUNDARIES in the delegation prompt scope it to approved paths |
| Validator | Read + test execution. No source modification |

## 5. What loads into a subagent at startup

A non-fork subagent receives:

1. Its own system prompt (the agent definition body) plus basic environment details — not the full Claude Code system prompt.
2. The delegation message you wrote.
3. The full CLAUDE.md memory hierarchy — except Explore, Plan, and definitions with `omitClaudeMd`.
4. A git-status snapshot from parent session start — except Explore and Plan.
5. Preloaded `skills` content (full text).
6. A roster of the session's other named agents, as `SendMessage` targets (v2.1.206+, when it has that tool).

It does NOT receive: your conversation history, skills you invoked, files you've read, your output style, or auto memory. Its context window is sized by its own model, not the parent's. The delegation prompt is the only channel in.

Tools are inherited from the main conversation and narrowed by two filters; forks skip both.

- **Every subagent loses** `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode` (unless its `permissionMode` is `plan`), `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`, `Workflow`, `EndConversation` — and `Agent` once it sits at the depth limit (§1). Listing them in `tools` doesn't bring them back.
- **Background subagents** — the default — keep every MCP tool but only these built-ins: `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`, `ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, plus `SubagentHandback`.

So a subagent has no way to ask the user a question mid-task: `AskUserQuestion` is stripped, not merely unreliable. Keep any task that needs mid-task user input in the parent.

## 6. Forks and `/btw`

- A fork inherits the *entire* conversation, with the same system prompt, tools, output style, and model. The model is not overridable (§1).
- Its first request reuses the parent's prompt cache, which makes forking cheaper than spawning a fresh subagent for tasks that need the same context.
- Choose a fork when a named subagent would need too much background to be useful; choose a fresh subagent when isolation is the point (verbose work, tool restrictions, fresh-eyes verification).
- A fork can take `isolation: "worktree"`, cannot spawn further forks, and its permission prompts surface in your terminal.
- Versions: users fork with `/subtask` (v2.1.212+; `/fork` on v2.1.161–2.1.211). Fork *mode* — Claude being able to request the `fork` type — is on by default in interactive sessions from v2.1.232 and off under `-p` and the Agent SDK; `CLAUDE_CODE_FORK_SUBAGENT=1|0` overrides. Deny `Agent(fork)` to keep fork mode's background behavior without forks.
- **`/btw`** is the no-tools sibling: a side question that sees the full conversation but has no tool access — it can't read files, run commands, or search — and stays out of the conversation history. It costs little beyond the answer while the prompt cache is warm. Pressing `f` on an answer forks it into a background subagent with full tools. Use `/btw` for what the session already knows, a subagent to find out something new.

## 7. Background, resume, transcripts, compaction

- **With fork mode on — the interactive default — every subagent Claude spawns runs in the background**, forks included, and Claude can't ask for the foreground: the harness removes `run_in_background` from the Agent tool. Results arrive as a completion notification in a later turn. When a result gates your next step, the gate is waiting for that notification — and not predicting the result before it lands — rather than a parameter.
- **With fork mode off** (`-p`, Agent SDK), Claude runs a subagent in the background by default and in the foreground when it needs the result before continuing. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` forces the foreground everywhere. Subagents spawned by an in-process agent-team teammate run in the foreground, and the harness refuses a teammate's `run_in_background: true` or a `background: true` definition.
- **Background does not mean prompts are auto-denied** (that was pre-v2.1.186). A background subagent's permission prompt surfaces in the main session, naming the subagent; Esc denies that one call without stopping the agent. A lasting answer — a grant for the rest of the session — applies to the whole session, main conversation included, so answer subagent prompts as narrowly as the task allows.
- Auto-deny still applies where nobody can answer: `dontAsk` mode (documented), and headless `-p`/SDK runs with no permission handler configured, plus workflow agents (read from the 2.1.220 binary in 2026-07; the subagent docs don't restate it). In those contexts, pre-grant every permission the task needs.
- **Resume.** Completed general-purpose and custom subagents return an agent ID; `SendMessage` with that ID or name as `to` resumes them with full history, under the same ID. It does not need agent teams enabled — only team-protocol messages do. Checked on v2.1.278: a message to a finished subagent's ID resumed it. Explore and Plan are one-shot and can't be resumed. A subagent you stopped yourself refuses messages, and a resume takes a concurrency slot without checking the cap.
- Transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`, kept for `cleanupPeriodDays` (30 by default), unaffected by main-conversation compaction.
- Subagents auto-compact by the same logic as the main conversation (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` applies). Don't rely on it: an oversized delegated job degrades before it compacts — scope the task to fit. Instruction-following also degrades non-linearly with raw context length well before compaction, so scope compositional sub-tasks (citation, re-ranking, synthesis) to short windows by design (numbers: the prompt skill's context reference).

## 8. Gotchas

- **Opus-endpoint hang.** During capacity incidents (529s), a dispatch with explicit `model: "opus"` can hang forever at "Initializing…": the alias resolves to the standard current-Opus endpoint, a different capacity pool from the session's variant, and the client silently retries indefinitely. Fix: omit the `model` param so the subagent inherits the parent's pool. Diagnosis: the subagent transcript contains zero `"type":"assistant"` records. (Observed on 2.1.220, 2026-07; not re-triggered since.)
- **Cache rule.** Switching the MAIN conversation's model invalidates the prompt cache. Subagents are the cache-safe way to mix models: keep the main loop on one model and route cheap subtasks to a cheaper model via dispatch.
- **Definition reload.** Claude Code watches `.claude/agents/` and `~/.claude/agents/`; an edited definition applies to the next delegation within seconds. A restart is still needed when the `agents` directory didn't exist at session start, or for `--add-dir` directories; for plugin agents, `/reload-plugins`.
- **Spawn-bias drift across models.** Recent model generations have oscillated between over-delegating (spawning a subagent where a direct grep suffices) and under-delegating (iterating serially over a fan-out-shaped task). State trigger conditions in both directions when writing orchestration prompts: when to spawn AND when to work directly.
- **URL-embedded injection.** Claude models follow URL-embedded injections in untrusted tool output at markedly higher rates than plain-text ones — and are more exposed than GPT-4o on this vector. Strip URL fragments/anchors from untrusted output before navigation, treat untrusted URLs as tool-call arguments behind the schema gate, and log navigated URLs (numbers: the prompt skill's safety reference).
