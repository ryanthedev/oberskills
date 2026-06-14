# browser skill — Storage, emulation, and capture reference

Tools for browser storage access, session persistence, device and geo emulation, permissions, and page capture (PDF, screencast, file upload/download).

---

## Browser storage

| Tool | What it does |
|---|---|
| `browser_storage` | Get, set, or delete cookies, localStorage, or sessionStorage entries for the active page. Cross-domain cookie set requires `allow_cross_domain=true` — never a silent no-op. |
| `browser_storage_state_save` | Serializes all cookies, localStorage, and sessionStorage to a JSON file. Returns the file path. |
| `browser_storage_state_restore` | Restores storage from a file previously written by `browser_storage_state_save`. Validates the state schema before applying — reuse authenticated sessions across restarts. |

---

## Device and environment emulation

| Tool | What it does |
|---|---|
| `browser_emulate_device` | Emulate a named device (e.g. `"iPhone 12"`, `"Pixel 5"`) via `preset`, or set an explicit viewport via `width` + `height`. |
| `browser_geolocation` | Sets the browser's geolocation (`latitude`, `longitude`, `accuracy` in meters). Latitude must be −90..90, longitude −180..180. |
| `browser_permissions` | Grant browser permissions (`geolocation`, `camera`, `microphone`, `notifications`, etc.) for the active page's origin. Unknown permission names return `permission_unknown`. |

---

## Capture

| Tool | What it does |
|---|---|
| `browser_pdf` | Exports the current page to a PDF via CDP Page.printToPDF. The `/tmp` path is returned — PDF bytes are never inlined. Route the path to a subagent for reading. |
| `browser_screencast_start` | Arms the screencast lifecycle. Double-start returns `screencast_already_running`. Note: video frame assembly (stop → file) is deferred to a future release. |
| `browser_screencast_stop` | Stops the active screencast. Returns `no_screencast_running` if none was started. Returns `screencast_not_supported` until video frame assembly is implemented. |

---

## File transfer

| Tool | What it does |
|---|---|
| `browser_upload` | Uploads a file to a file-input element located by `ref` (primary) or `selector` (fallback). Coordinate targets are not supported — use a ref or selector. |
| `browser_download` | Arms download capture via CDP and waits up to `timeout_ms` for a download to complete. Trigger the download action (click a link or button) after calling this tool. |
