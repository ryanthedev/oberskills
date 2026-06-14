# browser skill — Interaction reference

Tools for connecting, tab management, snapshot-based interaction, navigation, and reading/extracting page content.

---

## Connection and tabs

| Tool | What it does |
|---|---|
| `browser_connect` | Establishes the persistent connection. `mode=launch` spawns (or reuses) a Chrome via `executable_path` or `channel`; `mode=attach` connects via `browser_url` or `ws_endpoint`. Call this first. |
| `browser_tabs` | `action=list` returns all tabs; `action=new` opens a tab (optional URL); `action=select` activates a tab; `action=close` closes one. |

---

## Snapshot and refs (primary interaction model)

| Tool | What it does |
|---|---|
| `browser_snapshot` | Returns a compact AX tree. Every interactive node carries a stable `ref` id. Use refs for all subsequent actions — refs survive minor DOM updates. |
| `browser_click` | Click by `ref` (primary), CSS `selector`, or `x`/`y` coordinates. Stale ref → take a new snapshot. |
| `browser_type` | Type text into a target. Same targeting order: ref → selector → x/y. |
| `browser_hover` | Hover over a target. Same targeting order. |
| `browser_select` | Select option(s) in a `<select>`. Same targeting order. |
| `browser_fill_form` | Fill multiple form fields in one call — each entry is a target + value. Prefer over repeated `browser_type` calls. |
| `browser_press_key` | Press a key on a target with optional modifier bitmask (Alt=1, Ctrl=2, Meta=4, Shift=8 — sum them). |
| `browser_drag` | Drag from a source target to a drop target. Both endpoints use the same targeting strategy. |

---

## Navigation and lifecycle

| Tool | What it does |
|---|---|
| `browser_navigate` | Navigates to an http/https URL. Other schemes (`file://`, `javascript:`, etc.) are blocked. |
| `browser_wait` | Waits for: `navigation` (page load completes), `selector` (element appears — requires `selector` param), or `idle` (network settles). Returns a typed timeout error on expiry. |
| `browser_wait_for_text` | Waits until a text substring appears (default) or disappears in the page body. |
| `browser_scroll` | Scroll by `dx`/`dy`, or scroll a target element into view (ref → selector → x/y). |
| `browser_dismiss` | Finds and dismisses the topmost dialog, modal, or overlay via close-button scoring, falling back to Escape. |

---

## Read and extract

All large outputs (DOM, AX tree, evaluated result) are written to `/tmp` when they exceed the inline threshold — the tool returns the path. Route the path to a Haiku subagent for reading.

| Tool | What it does |
|---|---|
| `browser_dom` | Full page outer HTML, or scoped to a CSS selector. Large output → `/tmp` path. |
| `browser_accessibility` | Full AX tree as JSON. Large output → `/tmp` path. |
| `browser_screenshot` | Captures a PNG, writes to file, returns `{ path, bytes }`. Route the path to a subagent. |
| `browser_extract` | Selects container elements and extracts named child fields as structured JSON. Pass `fields` as `"name:.selector,price:.price"` comma-separated pairs. |
| `browser_collect` | Clicks each element matching `selector` (accordion/expand triggers), reads content from `read_selector` after a delay, optionally closes. Returns a JSON array of text strings. |
| `browser_evaluate` | Runs arbitrary JavaScript in the page context. `querySelectorDeep` and `querySelectorAllDeep` are auto-injected for shadow DOM. Large output → `/tmp` path. |
| `browser_form` | Reads the current value, checked state, and selectedOptions of a form element by CSS selector. |
