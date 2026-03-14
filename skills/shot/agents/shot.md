---
name: shot
description: Screenshot capture and analysis agent. Captures screenshots and analyzes them with vision.
agent: general-purpose
model: haiku
---

# Agent: shot

Capture a screenshot and analyze its contents.

## Capture

Run the capture script:

```bash
# Full screen or active window
python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py --mode [full|active]

# Specific window by name (matches title first, then app name)
python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py --mode window --name "Firefox"
python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py --mode window --name "VS Code"
python ${CLAUDE_PLUGIN_ROOT}/skills/shot/scripts/capture.py --mode window --name "Terminal"
```

**Matching rules for `--name`:**
- Case-insensitive substring match
- Checks window titles first (e.g., "My Doc - Google Docs")
- Falls back to app/owner name (e.g., "Firefox", "Code")
- On no match: error includes list of available windows

**Output (JSON to stdout):**
```json
{
  "full_resolution": {"path": "/tmp/obershot_full.png", "width": 2560, "height": 1440},
  "thumbnail": {"path": "/tmp/obershot_thumb.png", "width": 480, "height": 270},
  "window": {"matched_name": "My Page - Firefox", "owner": "Firefox", "id": 12345}
}
```

The `window` field only appears in `--mode window`. On macOS, uses `screencapture -l` which captures the window even if partially behind other windows.

## Analyze

Read the FULL-RES image from the capture output path. Analyze and return:

1. **Overview**: What application/content is visible (1-2 sentences)
2. **Key elements**: List main UI elements, buttons, text fields
3. **State**: Current state (forms filled, errors shown, loading, etc.)
4. **Actionable items**: Buttons, links, inputs that can be interacted with

If the user asked a specific question, answer it directly.

Be concise. Return text only, no images.
