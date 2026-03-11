---
name: obershot
description: Capture and analyze screenshots without burning context.
disable-model-invocation: true
---

# Skill: obershot

**On load:** Read `../../.claude-plugin/plugin.json` from this skill's base directory. Display `obershot v{version}` before proceeding.

```
CAPTURE → ANALYZE (haiku) → RETURN summary + thumbnail
```

Main agent never loads full-res image. Haiku does the analysis, returns text.

---

## Quick Reference

| Mode | Command | Use When |
|------|---------|----------|
| Full screen | `--mode full` | See everything |
| Active window | `--mode active` | Focus on current app |
| Named window | `--mode window --name "Firefox"` | Target a specific window by title or app name |
| List windows | `--list-windows` | Show available windows (for debugging) |

---

## Workflow

### 1. Capture

```bash
# Full screen or active window
python scripts/capture.py --mode [full|active]

# Specific window by name (matches title first, then app name)
python scripts/capture.py --mode window --name "Firefox"
python scripts/capture.py --mode window --name "VS Code"
python scripts/capture.py --mode window --name "Terminal"
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

### 2. Analyze with Haiku Subagent

Dispatch haiku to analyze the FULL-RES image:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Analyze screenshot",
  prompt="Read the image at [full_resolution.path].

  Analyze and return:
  1. **Overview**: What application/content is visible (1-2 sentences)
  2. **Key elements**: List main UI elements, buttons, text fields
  3. **State**: Current state (forms filled, errors shown, loading, etc.)
  4. **Actionable items**: Buttons, links, inputs that can be interacted with

  If the user asked a specific question, answer it directly.

  Be concise. Return text only, no images."
)
```

### 3. Return Summary

Provide the haiku analysis summary to the user.

**If you need more visual context:** Read the thumbnail (`Read [thumbnail.path]`) - it's small enough (~35KB) to not blow up context.

**Do NOT read the full-res image** - that's what haiku already did.

---

## Use Cases

### Design Review
```
User: "How does the login screen look?"

1. Capture: python scripts/capture.py --mode active
2. Analyze: Haiku examines full-res
3. Return: "Login screen shows email/password fields, 'Sign In' button is blue,
   social login options below. Form is centered, looks clean on mobile viewport."
```

### Specific Window
```
User: "Take a screenshot of the Slack window"

1. Capture: python scripts/capture.py --mode window --name "Slack"
2. Analyze: Haiku examines full-res
3. Return: "Slack is showing the #engineering channel. Latest message is from
   Alice about the deploy. There are 3 unread channels in the sidebar."
```

### Automation Help
```
User: "Where's the submit button?"

1. Capture: python scripts/capture.py --mode full
2. Analyze: Haiku locates button
3. Return: "Submit button is in the bottom-right corner, green with white text,
   approximately at coordinates (1850, 920). It says 'Place Order'."
```

### Debugging UI
```
User: "Is there an error message showing?"

1. Capture: python scripts/capture.py --mode active
2. Analyze: Haiku checks for errors
3. Return: "Yes, red error banner at top: 'Invalid email format'. The email
   field has a red border. Submit button appears disabled."
```

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
| Full-res image | ~2-5 MB | NO (haiku only) |
| Thumbnail | ~20-50 KB | Optional |
| Summary text | ~200-500 chars | YES |

**Result:** Main agent stays lean, haiku handles heavy lifting.

---

## Integration

- **code-foundations:debug**: Capture screen state when debugging visual issues
- **code-foundations:building**: Screenshot milestones during UI implementation
