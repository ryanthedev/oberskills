---
name: browser
description: >-
  Controls a live Chrome browser through a persistent puppeteer-core MCP
  connection — click, type, hover, drag, fill forms; navigate pages; take
  screenshots and export PDFs; read the DOM and accessibility tree; run
  Lighthouse audits and Core Web Vitals traces; intercept, record, stub, or
  block network requests; export HAR traffic; emulate devices and network
  conditions; manage browser storage; upload and download files. Use when
  interacting with or automating a running browser, clicking elements, taking
  screenshots, running Lighthouse, capturing network traffic as HAR, checking the
  accessibility tree, intercepting or stubbing requests, or emulating a device or
  viewport. Not for: web search or fetching public URLs without a browser session
  (use web-research), reading a static HTML file already on disk, fixing
  TypeScript or JavaScript build or compile errors, debugging source code
  without a running page, or tasks that don't require controlling a live browser.
when_to_use: >-
  take a screenshot of the page, click a button on the page, fill out the form
  in the browser, navigate to a URL in the browser, run a Lighthouse audit,
  Lighthouse performance audit, capture network requests as a HAR file, record
  network traffic HAR, check or inspect the accessibility tree, intercept network
  requests, stub an API response in the browser, mock network calls, emulate an
  iPhone or Android device, browser automation, automate the browser, end-to-end
  testing in Chrome. Not for build failures, compiler errors, or code edits.
---

# browser

Persistent Chrome/CDP control via puppeteer-core. The primary interaction model
is snapshot → stable ref → action. Selectors and coordinates are fallbacks only.
Large outputs (screenshots, DOM, AX trees, HAR, traces) are always written to
disk — the tool returns a file path, never raw bytes.

## Prerequisites

Call `browser_connect` before any other tool. Mode `launch` spawns (or reuses)
a Chrome process; mode `attach` connects to a running Chrome via `browser_url`
or `ws_endpoint`.

## Primary loop: snapshot → ref → act

```
browser_snapshot          → returns compact AX tree; every interactive node carries a stable ref id
browser_click(ref=...)    → act on the ref (also: browser_type, browser_hover, browser_select, browser_fill_form, browser_press_key, browser_drag)
browser_snapshot          → verify the new state
```

A `stale_ref` error means the page changed; take a new snapshot. Selector/coordinate
targeting is the fallback when a ref is unavailable.

## Screenshot, DOM, and AX — always route to a subagent

Screenshots, DOM trees, and accessibility trees are large (50 KB–5 MB).
Loading them directly bloats the main context. Dispatch a Haiku subagent that
reads the file path and returns a text summary — the artifact never enters this
conversation.

```
Dispatch Agent:
  model: haiku
  description: "browser: analyze [screenshot|dom|accessibility]"
  prompt: |
    The browser tool wrote an artifact to: <PATH>
    Read that file with the Read tool.
    Return a concise text summary: what the page shows, key elements,
    errors or state, and the specific answer to: <USER_QUESTION>
    Return text only — no raw HTML, JSON, or image data.
```

Tools that produce large artifacts: `browser_screenshot`, `browser_dom`,
`browser_accessibility`, `browser_export_har`, `browser_performance_stop_trace`,
`browser_pdf`. Always pass the returned path to a subagent for reading.

## Navigation and waiting

`browser_navigate` accepts http/https only. After navigation, use `browser_wait`
(strategy `navigation` or `selector`) to confirm the page settled before
interacting. For text-triggered flows use `browser_wait_for_text`.

## Tool surface by group

Full parameter details in the references below. Load the relevant one when
planning work in that group.

| Group | Reference |
|---|---|
| Snapshot + refs interaction · Navigation · Read + extract | `${CLAUDE_SKILL_DIR}/references/interaction.md` |
| Performance · Lighthouse · HAR · Network routing · Throttling | `${CLAUDE_SKILL_DIR}/references/perf-network.md` |
| Storage · Device emulation · Geolocation · Capture (PDF / screencast / upload / download) | `${CLAUDE_SKILL_DIR}/references/storage-capture.md` |

## Payload discipline

| Artifact | Where it lives | In main context? |
|---|---|---|
| Screenshot PNG | file path from `browser_screenshot` | No — subagent only |
| DOM HTML | file path from `browser_dom` | No — subagent only |
| AX tree JSON | file path from `browser_accessibility` | No — subagent only |
| HAR file | file path from `browser_export_har` | No — subagent only |
| Performance trace | file path from `browser_performance_stop_trace` | No — analyze via `browser_analyze_insight` |
| PDF | file path from `browser_pdf` | No — subagent only |
| Subagent text summary | returned text | Yes |
| Direct tool output (small) | inlined in result | Yes |
