---
name: obershot
description: Context-efficient screenshot capture and analysis. Use when needing to see, analyze, or interact with screen content. Dispatches haiku subagent to analyze full-res image, returns summary + thumbnail to preserve context. Triggers on "take a screenshot", "screenshot", "what's on my screen", "capture screen", "show me the screen", "analyze this window".
---

# Skill: obershot

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

---

## Workflow

### 1. Capture

```bash
python scripts/capture.py --mode [full|active]
```

**Output (JSON to stdout):**
```json
{
  "full_resolution": {"path": "/tmp/obershot_full.png", "width": 2560, "height": 1440},
  "thumbnail": {"path": "/tmp/obershot_thumb.png", "width": 480, "height": 270}
}
```

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

**Platform-specific (for active window):**
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

- **oberdebug**: Capture screen state when debugging visual issues
- **oberplan**: Screenshot milestones during UI implementation
- **oberhack**: Quick screenshot for visual verification
