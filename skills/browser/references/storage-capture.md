# browser skill — Storage, emulation, and capture reference

Tools for browser storage access, session persistence, device and geo emulation, permissions, and page capture (PDF, screencast, file upload/download).

---

## Browser storage

| Tool | What it does |
|---|---|
| `browser_storage` | Get, set, or delete cookies, localStorage, or sessionStorage entries for the active page. Cross-domain cookie set requires `allow_cross_domain=true` — never a silent no-op. |
| `browser_storage_state_save` | Serializes all cookies, localStorage, and sessionStorage to a JSON file. Returns the file path. |
| `browser_storage_state_restore` | Restores storage from state previously written by `browser_storage_state_save`. Pass `path` — the absolute path save returned; the server reads the file, so the credentials in it never enter the conversation. `state_json` (the state as a JSON string) is the alternative; pass exactly one. Validates the state schema before applying, clears existing state, and returns `{ restored, skipped }` — reuse authenticated sessions across restarts. `storage_state_invalid` covers a missing or unreadable file, both or neither input, and malformed state. |

---

## Device and environment emulation

| Tool | What it does |
|---|---|
| `browser_emulate_device` | Emulate a named device (e.g. `"iPhone 12"`, `"Pixel 5"`) via `preset`, or set an explicit viewport via `width` + `height` (optional `device_scale_factor`, `is_mobile`). A `preset` takes priority over explicit dimensions. |
| `browser_geolocation` | Sets the browser's geolocation (`latitude`, `longitude`, `accuracy` in meters). Latitude must be −90..90, longitude −180..180. |
| `browser_permissions` | Grant browser permissions (`geolocation`, `camera`, `microphone`, `notifications`, etc.) for the active page's origin, or for `origin` when given. An empty `permissions` list clears every permission override in the browser context — all origins, `origin` is ignored — returning to the browser defaults. Unknown permission names return `permission_unknown`. |

---

## Capture

| Tool | What it does |
|---|---|
| `browser_pdf` | Exports the current page to a PDF via CDP Page.printToPDF. Optional `format` (e.g. `"A4"`; default Letter), `landscape`, and `print_background` (default `true`). The `/tmp` path is returned — PDF bytes are never inlined. Route the path to a subagent for reading. |
| `browser_screencast_start` | Arms the screencast lifecycle. Double-start returns `screencast_already_running`. Note: video frame assembly (stop → file) is deferred to a future release. |
| `browser_screencast_stop` | Stops the active screencast. Returns `no_screencast_running` if none was started. Returns `screencast_not_supported` until video frame assembly is implemented. |

---

## File transfer

| Tool | What it does |
|---|---|
| `browser_upload` | Uploads a file to a file-input element located by `ref` (primary) or `selector` (fallback). A selector takes the same refinements as the interaction tools (`references/interaction.md` in this skill directory, Targeting). Coordinate targets are not supported — use a ref or selector; a non-file input returns `upload_failed`. Pass the file as an absolute `file_path`. |
| `browser_download` | Arms download capture via CDP and waits up to `timeout_ms` for a download to complete. Trigger the download action (click a link or button) after calling this tool. |
