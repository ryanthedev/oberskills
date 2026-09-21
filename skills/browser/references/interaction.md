# browser skill — Interaction reference

Tools for connecting, tab management, snapshot-based interaction, navigation, and reading/extracting page content.

---

## Connection and tabs

| Tool | What it does |
|---|---|
| `browser_connect` | Establishes the persistent connection. `mode=launch` spawns (or reuses) a Chrome via `executable_path` or `channel` (`headless` defaults to `true`; pass `false` to watch it); `mode=attach` connects via exactly one of `browser_url` or `ws_endpoint`. Call this first. |
| `browser_tabs` | `action=list` returns all tabs with their `tab_id`; `action=new` opens a tab (optional `url`); `action=select` and `action=close` take the `tab_id` of the tab to activate or close. |

---

## Snapshot and refs (primary interaction model)

| Tool | What it does |
|---|---|
| `browser_snapshot` | Returns a compact AX tree. Every interactive node carries a stable `ref` id. Use refs for all subsequent actions. Each snapshot invalidates the refs from the one before it — re-snapshot after navigation or DOM changes. `max_depth` / `max_nodes` clip a huge tree (`truncated: true`); `interesting_only=false` keeps the pruned nodes. |
| `browser_click` | Click by `ref` (primary), CSS `selector`, or `x`/`y` coordinates. Optional `button` (`left`/`right`/`middle`) and `click_count` (2 = double-click). |
| `browser_type` | Type text into a target. Same targeting order: ref → selector → x/y. |
| `browser_hover` | Hover over a target. Same targeting order. |
| `browser_select` | Select option(s) in a `<select>`. Same targeting order. |
| `browser_fill_form` | Fill multiple form fields in one call — each entry is a target + value. Prefer over repeated `browser_type` calls. |
| `browser_press_key` | Press a key on a target with optional modifier bitmask (Alt=1, Ctrl=2, Meta=4, Shift=8 — sum them). |
| `browser_drag` | Drag from a source target to a drop target. The source uses the standard target fields; the drop target is `to_ref`, `to_selector`, or `to_x` + `to_y`. |

### Targeting

Each tool above takes one flat target, resolved in fixed order ref → selector →
x/y: when `ref` is present, the selector fields are ignored. `browser_scroll`
(below) and `browser_upload` (`references/storage-capture.md` in this skill
directory) take the same fields.

| Field | What it does |
|---|---|
| `ref` | Primary. A ref id from the most recent `browser_snapshot`. |
| `selector` | Fallback. A CSS selector that must resolve to exactly one element after the refinements below. |
| `match_text` | Selector refinement: keep only elements whose text content contains this substring (case-sensitive). |
| `visible` | Selector refinement: `true` keeps only elements that have a layout box. |
| `pierce` | Selector refinement: match through shadow DOM. The only shadow-DOM path outside `browser_evaluate`. |
| `nth` | Selector refinement: 0-based pick among the matches left after the other refinements. |
| `x` + `y` | Last resort. Viewport coordinates; a point outside the viewport returns `coord_out_of_viewport`. |

Which tools accept the refinements:

- **All four** (`match_text`, `visible`, `pierce`, `nth`): `browser_click`, `browser_type`, `browser_hover`, `browser_select`, `browser_press_key`, `browser_scroll`, `browser_upload`, the source endpoint of `browser_drag`, and each entry in `browser_fill_form`'s `fields`.
- **None on the drop endpoint of `browser_drag`**: `to_selector` is a bare CSS selector, so it must match exactly one element on its own — otherwise use `to_ref`.
- **`pierce` only**: `browser_extract` and `browser_collect` (default `false`; it applies to the container and the child/read selectors).
- **Bare `selector`, no refinements**: `browser_wait`, `browser_dom`, `browser_screenshot`, `browser_form`.
- `browser_select` and `browser_upload` need an element, so they reject `x`/`y` targets (`interaction_failed` and `upload_failed` respectively).

Targeting errors and their fixes:

| Code | Meaning | Fix |
|---|---|---|
| `stale_ref` | The ref predates the current snapshot, or its element has left the DOM. | Take a new snapshot. |
| `unknown_ref` | The ref was never issued by any snapshot. | Take a snapshot and use a ref from its `refs` list. |
| `interaction_failed` | The target resolved but the action failed — hidden element, no layout box, or a node re-rendered mid-action. | Take a new snapshot and retry, or try a different target. |
| `ambiguous_match` | The selector matched more than one element and no `nth` was given. | Add `nth`, narrow with `match_text` / `visible`, or use a ref. |
| `no_match` | The selector matched nothing, `nth` is past the last match, or no target field was passed. | Fix the selector, lower `nth`, or take a snapshot. |

---

## Navigation and lifecycle

| Tool | What it does |
|---|---|
| `browser_navigate` | Navigates to an http/https URL. `allow_internal=true` (default `false`) also permits `file:` and `about:` — use it to open a local HTML file or `about:blank`. `javascript:` / `vbscript:` are never allowed, and every other scheme (`chrome:`, `data:`, …) is blocked with or without the flag. Blocked scheme → `blocked_url`; unparseable URL → `invalid_url`. |
| `browser_wait` | Waits for: `navigation` (page load completes), `selector` (element appears — requires `selector` param, else `missing_selector`), or `idle` (network settles). `timeout_ms` bounds the wait; expiry returns `wait_timeout` naming the strategy. |
| `browser_wait_for_text` | Waits until a text substring appears (default) or, with `appear=false`, disappears in the page body. `timeout_ms` bounds the wait; expiry returns `wait_for_text_timeout`. |
| `browser_scroll` | Scroll by `dx`/`dy`, or scroll a target element into view (ref → selector → x/y). |
| `browser_dismiss` | Finds and dismisses the topmost dialog, modal, or overlay via close-button scoring, falling back to Escape. |

---

## Read and extract

Reads at or above the server's inline threshold (`PAYLOAD_THRESHOLD_BYTES` in `mcp-browser/src/lib/payload.ts`) are written to a temp file and the tool returns the path; route that path to the host's subagent tool when available (dispatch shape in this skill's `SKILL.md`). Below the threshold the result is inline, in full, and there is no file. Every tool here except `browser_screenshot` (always a file) and `browser_form` (always inline) reports `written` and `bytes` — branch on `written`:

| Tool | `written: true` (spilled) | `written: false` (inline) |
|---|---|---|
| `browser_snapshot` | `tree_path` + `tree_preview` | `tree`. `refs` and `node_count` are inline in both cases. |
| `browser_dom`, `browser_accessibility` | `path` + `preview` | `path` is `""`; `inlined` holds the full content. |
| `browser_extract` | `path` | `path` is `""`; `inlined` holds the full JSON. `count` is inline in both cases. |
| `browser_collect` | `items_path` + `preview` | `items`. `count` and `nothing_expandable` are inline in both cases. |
| `browser_evaluate` | `result_path` + `preview` | `result` |

| Tool | What it does |
|---|---|
| `browser_dom` | Full page outer HTML, or scoped to a CSS `selector` (no match → `read_failed`). |
| `browser_accessibility` | Full AX tree as JSON. |
| `browser_screenshot` | Captures a PNG and returns `{ path, bytes, width, height }`. `full_page=true` captures the whole scrollable page; `selector` scopes the capture to one element (far fewer pixels to read; `full_page` is then ignored; no match → `read_failed`). A screenshot is always a file, however small the capture — `path` is never empty and there is no `written` flag. Route the path to a subagent. |
| `browser_extract` | Selects container elements and extracts named child fields as structured JSON. Pass `fields` as `"name:.selector,price:.price"` comma-separated pairs; omit it for each container's text content. `pierce=true` matches through shadow DOM. |
| `browser_collect` | Clicks each element matching `selector` (accordion/expand triggers), waits `delay_ms`, reads content from `read_selector`, and with `close_after_read=true` clicks again to close. Returns a JSON array of text strings. `pierce=true` matches through shadow DOM. |
| `browser_evaluate` | Runs arbitrary JavaScript in the page context. `querySelectorDeep` and `querySelectorAllDeep` are auto-injected for shadow DOM. |
| `browser_form` | Reads the current value, checked state, and selectedOptions of a form element by CSS selector. |
