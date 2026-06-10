# Subagent platform mechanics — Claude Code, June 2026

Platform facts for dispatching subagents and writing reusable agent definition files. Condensed from the code.claude.com subagent docs (fetched 2026-06-09) and the bundled claude-api skill.

## Contents

1. [The Agent tool](#1-the-agent-tool)
2. [Built-in subagents](#2-built-in-subagents)
3. [Subagent frontmatter fields (canonical table)](#3-subagent-frontmatter-fields-canonical-table)
4. [Enforce boundaries at the schema level](#4-enforce-boundaries-at-the-schema-level)
5. [What loads into a subagent at startup](#5-what-loads-into-a-subagent-at-startup)
6. [Forks](#6-forks)
7. [Background, resume, transcripts, compaction](#7-background-resume-transcripts-compaction)
8. [Gotchas](#8-gotchas)

## 1. The Agent tool

- In v2.1.63 the Task tool was renamed **Agent**. Existing `Task(...)` references in settings and agent definitions still work as aliases.
- Each Agent call accepts a per-invocation `model` parameter (aliases `sonnet`/`opus`/`haiku`/`fable`, full IDs, or `inherit`).
- Model resolution order: 1) `CLAUDE_CODE_SUBAGENT_MODEL` env var → 2) per-invocation `model` parameter → 3) the definition's `model` frontmatter → 4) the main conversation's model.
- `Agent(agent_type)` allowlist syntax in a `tools:` list restricts which subagent types can be spawned — but only when that agent runs as the main thread via `claude --agent`. Subagents cannot spawn subagents, so the syntax has no effect inside subagent definitions.
- Disable specific agent types session-wide with `"permissions": {"deny": ["Agent(Explore)", "Agent(my-custom-agent)"]}` or `--disallowedTools "Agent(Explore)"`.

## 2. Built-in subagents

| Agent | Model | Tools | Notes |
|---|---|---|---|
| Explore | Haiku | Read-only | Thoroughness levels: quick / medium / very thorough. Skips CLAUDE.md and git status. One-shot — returns no agent ID, not resumable |
| Plan | Inherits | Read-only | Plan-mode research. Skips CLAUDE.md and git status. One-shot |
| general-purpose | Inherits | All | Resumable; default agent type for `context: fork` skills |
| statusline-setup | Sonnet | — | `/statusline` helper |
| claude-code-guide | Haiku | — | Claude Code Q&A |

Because Explore and Plan skip CLAUDE.md and git status, restate any CLAUDE.md rule the delegated task depends on directly in the delegation prompt. There is no frontmatter field or setting to change which agents skip them.

## 3. Subagent frontmatter fields (canonical table)

This is the plugin-canonical copy of the field list — other oberskills files point here instead of duplicating it. Only `name` and `description` are required.

| Field | Notes |
|---|---|
| `name` | Lowercase letters + hyphens; hooks receive it as `agent_type` |
| `description` | When Claude should delegate to this subagent. Include "use proactively" to encourage automatic delegation |
| `tools` | Allowlist. **Trap: omitting `tools` inherits ALL tools, not none.** To preload skills, use the `skills` field rather than listing `Skill` here |
| `disallowedTools` | Denylist. If both are set, `disallowedTools` is applied first, then `tools` is resolved against the remaining pool |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full model ID (e.g. `claude-opus-4-8`), or `inherit`. Defaults to `inherit` |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max`; overrides the session effort per subagent |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. **Ignored for plugin subagents** |
| `maxTurns` | Maximum agentic turns |
| `skills` | Skills preloaded at startup — FULL content injected, not just the description. Cannot preload skills with `disable-model-invocation: true`. The subagent can still invoke unlisted skills via the Skill tool |
| `mcpServers` | Name references to configured servers, or inline definitions scoped to this subagent only. **Ignored for plugin subagents** |
| `hooks` | Lifecycle hooks scoped to the subagent (`Stop` auto-converts to `SubagentStop`). **Ignored for plugin subagents** |
| `memory` | `user` (`~/.claude/agent-memory/<name>/`), `project` (`.claude/agent-memory/<name>/`, recommended), `local`. Injects the first 200 lines / 25KB of MEMORY.md; auto-enables Read/Write/Edit |
| `background` | `true` = always run as a background task (don't use in this setup — see §7) |
| `isolation` | `worktree` = run in a temp git worktree off the default branch; auto-cleanup if no changes. The only valid value |
| `color` | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | Auto-submitted first user turn when the agent runs as the main session agent (`--agent` / `agent` setting) |

Two traps worth restating:

1. **Tools default trap.** An agent definition without a `tools` line gets everything, including write tools. Role-limited agents must enumerate.
2. **Plugin-agent restrictions.** For security, plugin subagents ignore `hooks`, `mcpServers`, and `permissionMode`. Plugin agents support: `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation, color`.

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
3. The full CLAUDE.md memory hierarchy — except Explore and Plan.
4. A git-status snapshot from parent session start — except Explore and Plan.
5. Preloaded `skills` content (full text).

It does NOT receive: your conversation history, skills you invoked, or files you've read. The delegation prompt is the only channel in.

Tools never available inside subagents, even if listed in `tools`: `Agent`, `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode` (unless `permissionMode: plan`), `ScheduleWakeup`, `WaitForMcpServers`. A delegated task that needs mid-task user input will fail — keep it in the parent.

## 6. Forks

- A fork inherits the *entire* conversation, with the same system prompt, tools, and model.
- Its first request reuses the parent's prompt cache, which makes forking cheaper than spawning a fresh subagent for tasks that need the same context.
- Choose a fork when a named subagent would need too much background to be useful; choose a fresh subagent when isolation is the point (verbose work, tool restrictions, fresh-eyes verification).
- Fork mode is default-on from v2.1.161.

## 7. Background, resume, transcripts, compaction

- Background subagents run with the permissions already granted in the session and **auto-deny any tool call that would otherwise prompt** — a delegated edit that would normally prompt silently fails while the subagent reports as if it succeeded. Avoid background subagents unless every permission the task needs is pre-granted; otherwise dispatch foreground.
- Ctrl+B backgrounds a running task; `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` disables backgrounding.
- Completed general-purpose subagents return an agent ID and are resumable via `SendMessage` — but that requires the experimental agent-teams flag and is unavailable in this CLI. To continue a finished subagent's work, re-dispatch fresh and put the resume context (what it found, where it stopped) in the new delegation prompt.
- Transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.
- Subagents auto-compact at ~95% of capacity (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` tunes this). Don't rely on it: an oversized delegated job degrades before it compacts — scope the task to fit.

## 8. Gotchas

- **Opus-endpoint hang.** During capacity incidents (529s), a dispatch with explicit `model: "opus"` can hang forever at "Initializing…": the alias resolves to the standard `claude-opus-4-8` endpoint, a different capacity pool from the session's variant, and the client silently retries indefinitely. Fix: omit the `model` param so the subagent inherits the parent's pool. Diagnosis: the subagent transcript contains zero `"type":"assistant"` records.
- **Cache rule.** Switching the MAIN conversation's model invalidates the prompt cache. Subagents are the cache-safe way to mix models: keep the main loop on one model and route cheap subtasks to a cheaper model via dispatch (this is how built-in Explore uses Haiku).
- **Definition reload.** File-based agent definitions load at session start — editing one on disk requires a restart (`/agents` UI edits apply immediately; for plugins, `/reload-plugins`).
- **Spawn-bias drift across models.** Recent model generations have oscillated between over-delegating (spawning a subagent where a direct grep suffices) and under-delegating (iterating serially over a fan-out-shaped task). State trigger conditions in both directions when writing orchestration prompts: when to spawn AND when to work directly.
