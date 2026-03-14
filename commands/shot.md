---
description: Capture and analyze screenshots without burning context.
---

# Skill: shot

**On load:** Read `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. Display `shot v{version}` before proceeding.

```
UNDERSTAND REQUEST → DISPATCH shot agent → RETURN summary
```

Main agent never loads full-res image. The shot agent handles capture and analysis.

---

## Workflow

### 1. Understand the Request

Determine what the user needs:

| User Says | Capture Mode | Analysis Focus |
|-----------|-------------|----------------|
| "take a screenshot" / "what's on screen" | `--mode full` | General overview |
| "screenshot the current app" / "what am I looking at" | `--mode active` | Active window state |
| "screenshot [App Name]" / "what's in [App]" | `--mode window --name "[App]"` | Specific window |
| "is there an error showing?" | `--mode active` | Error detection |
| "where's the [element]?" | `--mode full` or `--mode active` | Element location |
| "how does [feature] look?" | `--mode active` | Design review |

If the user's intent is ambiguous, ask which window or screen area they want captured.

### 2. Dispatch Shot Agent

Pass the capture mode and any specific analysis question to the shot agent at `${CLAUDE_PLUGIN_ROOT}/skills/shot/agents/shot.md`.

```
Agent(
  subagent_type="general-purpose",
  model="haiku",
  description="shot: capture and analyze screenshot",
  prompt="You are a screenshot capture and analysis agent.

  CAPTURE MODE: [mode from step 1]
  WINDOW NAME: [if --mode window, the target name]
  USER QUESTION: [the specific thing the user wants to know, or 'general overview']

  INSTRUCTIONS:
  1. Run the capture script from the shot skill directory:
     python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py --mode [mode] [--name 'window name']

  2. Read the full-resolution image from the JSON output path.

  3. Analyze and return:
     - **Overview**: What application/content is visible (1-2 sentences)
     - **Key elements**: Main UI elements, buttons, text fields
     - **State**: Current state (forms filled, errors shown, loading, etc.)
     - **Actionable items**: Buttons, links, inputs that can be interacted with

  4. If the user asked a specific question, answer it directly.

  Be concise. Return text only, no images."
)
```

### 3. Return Summary

Provide the agent's analysis to the user.

**If you need more visual context:** Read the thumbnail (`Read [thumbnail.path]`) — it's small enough (~35KB) to not blow up context.

**Do NOT read the full-res image** — that's what the agent already did.

---

## Dependencies

```bash
pip install mss Pillow
```

**For named window capture (`--mode window`):**
- Requires [thegrid](https://github.com/ryanthedev/thegrid) with `grid-server` running
- Uses `thegrid window find` to locate windows by name and `screencapture -l` to capture

**Platform-specific (for active window `--mode active`):**
- macOS: Uses AppleScript (built-in)
- Windows: Uses ctypes (built-in)
- Linux: Requires `xdotool` (`sudo apt install xdotool`)

---

## Context Efficiency

| Item | Size | In Main Context? |
|------|------|------------------|
| Full-res image | ~2-5 MB | NO (agent only) |
| Thumbnail | ~20-50 KB | Optional |
| Summary text | ~200-500 chars | YES |

**Result:** Main agent stays lean, shot agent handles heavy lifting.

---

## Integration

- **code-foundations:debug**: Capture screen state when debugging visual issues
- **code-foundations:building**: Screenshot milestones during UI implementation
