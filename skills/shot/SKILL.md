---
name: shot
description: Captures and summarizes screenshots from the local desktop or a named window using the bundled capture script. Use when the user asks for a screenshot, screen capture, active-window capture, visual inspection of the current screen, or named-window screenshot. Not for browser-page screenshots when browser MCP tools are already controlling a page.
---

# shot

Capture a local screenshot, then summarize the visual result without loading large image data unnecessarily.

## Workflow

1. Choose mode: `full`, `active`, or `window`.
2. From the plugin root, run `python3 skills/shot/scripts/capture.py --mode <mode>`. For a named window, add `--name '<window name>'`.
3. Inspect the returned thumbnail path when the user asks for visual interpretation.
4. Return the relevant summary and the saved screenshot path.

If the host has a subagent tool, pass the screenshot path to a fresh reviewer for visual summary. Otherwise use the host's image-inspection tool directly.

## Dependencies

The capture script requires Python packages `mss` and `Pillow` and may require OS screen-recording permissions.
