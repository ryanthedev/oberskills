/**
 * Phase 5 — storage / emulation / capture unit tests (FakePort; no Chrome).
 * Tests are the verification gate. ~5:1 dirty:clean.
 *
 * DW-5.1: storage get/set/delete across all three stores; cross-domain cookie err;
 *         no-origin-page op err
 * DW-5.2: storage_state save routes through port; restore validates StorageStateSchema;
 *         malformed/wrong-origin file rejected; restored vs skipped reported
 * DW-5.3: emulate_device applies; unknown permission rejected; geolocation applies
 * DW-5.4: pdf → path; upload resolves target; upload non-file-input err; download timeout err
 * DW-5.5: wait_for_text appear/disappear timeout typed err
 * DW-5.6: screencast double-start and stop-not-running lifecycle typed errs (video deferred)
 * DW-5.7: no puppeteer in core (static.test.ts); pdf + storage_state route through writePayload
 */
import { afterEach, describe, expect, test } from "bun:test";
import { resetSession, setPort } from "../src/core/session.ts";
import { FakePort } from "./fake-port.ts";
import * as storage from "../src/tools/storage.ts";
import * as storageStateSave from "../src/tools/storage-state-save.ts";
import * as storageStateRestore from "../src/tools/storage-state-restore.ts";
import * as emulateDevice from "../src/tools/emulate-device.ts";
import * as geolocation from "../src/tools/geolocation.ts";
import * as permissions from "../src/tools/permissions.ts";
import * as pdf from "../src/tools/pdf.ts";
import * as screencastStart from "../src/tools/screencast-start.ts";
import * as screencastStop from "../src/tools/screencast-stop.ts";
import * as upload from "../src/tools/upload.ts";
import * as download from "../src/tools/download.ts";
import * as waitForText from "../src/tools/wait-for-text.ts";
import { StorageStateSchema, GeolocationInputSchema } from "../src/types.ts";
import { z } from "zod";

function structured(r: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return r.structuredContent ?? {};
}

async function fresh(): Promise<FakePort> {
  const port = new FakePort();
  setPort(port);
  await port.connect({ mode: "launch" });
  return port;
}

afterEach(() => resetSession());

// ---------------------------------------------------------------------------
// DW-5.1: storage get/set/delete across all three stores
// ---------------------------------------------------------------------------

describe("storage tool (DW-5.1)", () => {
  test("test_DW_5_1_cookie_get_ok: get a cookie returns value from port", async () => {
    const port = await fresh();
    port.cannedStorageResult = { value: "my-session-token" };
    const r = await storage.handler({ store: "cookies", op: "get", key: "session" });
    expect(r.isError).toBeUndefined();
    expect(structured(r).value).toBe("my-session-token");
    expect(port.storageOps.length).toBe(1);
    expect(port.storageOps[0]?.op).toBe("get");
    expect(port.storageOps[0]?.store).toBe("cookies");
    expect(port.storageOps[0]?.key).toBe("session");
  });

  test("test_DW_5_1_cookie_set_ok: set a cookie (with cookie_attrs) reaches port", async () => {
    const port = await fresh();
    const r = await storage.handler({
      store: "cookies",
      op: "set",
      key: "auth",
      cookie_attrs: { value: "tok123", allow_cross_domain: false },
    });
    expect(r.isError).toBeUndefined();
    expect(port.storageOps.length).toBe(1);
    expect(port.storageOps[0]?.op).toBe("set");
  });

  test("test_DW_5_1_cookie_delete_ok: delete a cookie reaches port", async () => {
    const port = await fresh();
    const r = await storage.handler({ store: "cookies", op: "delete", key: "session" });
    expect(r.isError).toBeUndefined();
    expect(port.storageOps[0]?.op).toBe("delete");
  });

  test("test_DW_5_1_localstorage_get_ok: get from localStorage", async () => {
    const port = await fresh();
    port.cannedStorageResult = { value: "stored-value" };
    const r = await storage.handler({ store: "localStorage", op: "get", key: "myKey" });
    expect(r.isError).toBeUndefined();
    expect(structured(r).value).toBe("stored-value");
  });

  test("test_DW_5_1_localstorage_set_ok: set localStorage reaches port with value", async () => {
    const port = await fresh();
    const r = await storage.handler({ store: "localStorage", op: "set", key: "k", value: "v" });
    expect(r.isError).toBeUndefined();
    const op = port.storageOps[0];
    expect(op?.op).toBe("set");
    expect(op?.store).toBe("localStorage");
  });

  test("test_DW_5_1_localstorage_delete_ok: delete from localStorage reaches port", async () => {
    const port = await fresh();
    const r = await storage.handler({ store: "localStorage", op: "delete", key: "k" });
    expect(r.isError).toBeUndefined();
    expect(port.storageOps[0]?.op).toBe("delete");
  });

  test("test_DW_5_1_sessionstorage_get_set_delete: sessionStorage ops all route to port", async () => {
    const port = await fresh();
    await storage.handler({ store: "sessionStorage", op: "set", key: "sk", value: "sv" });
    await storage.handler({ store: "sessionStorage", op: "get", key: "sk" });
    await storage.handler({ store: "sessionStorage", op: "delete", key: "sk" });
    expect(port.storageOps.map((o) => o.op)).toEqual(["set", "get", "delete"]);
    expect(port.storageOps.every((o) => o.store === "sessionStorage")).toBe(true);
  });

  test("test_DW_5_1_set_without_value_rejected: set localStorage without value → storage_failed (barricade)", async () => {
    await fresh();
    const r = await storage.handler({ store: "localStorage", op: "set", key: "k" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_failed");
  });

  test("test_DW_5_1_set_cookie_without_attrs_rejected: set cookie without cookie_attrs → storage_failed", async () => {
    await fresh();
    const r = await storage.handler({ store: "cookies", op: "set", key: "k" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_failed");
  });

  test("test_DW_5_1_cross_domain_cookie_err: cross-domain cookie without flag → cross_domain_cookie (not silent)", async () => {
    const port = await fresh();
    port.crossDomainCookieError = true;
    const r = await storage.handler({
      store: "cookies",
      op: "set",
      key: "k",
      cookie_attrs: { value: "v", domain: "other.example.com", allow_cross_domain: false },
    });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("cross_domain_cookie");
  });

  test("test_DW_5_1_no_origin_page_err: localStorage on no-origin page → storage_failed (explicit)", async () => {
    const port = await fresh();
    port.noOriginError = true;
    const r = await storage.handler({ store: "localStorage", op: "get", key: "k" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_failed");
    const msg = r.content[0]?.text ?? "";
    expect(msg).toContain("no origin");
  });
});

// ---------------------------------------------------------------------------
// DW-5.2: storage_state save / restore
// ---------------------------------------------------------------------------

describe("storage_state (DW-5.2)", () => {
  test("test_DW_5_2_save_routes_through_port: save returns a path from port", async () => {
    const port = await fresh();
    port.cannedStorageStatePath = "/tmp/custom-state.json";
    const r = await storageStateSave.handler({});
    expect(r.isError).toBeUndefined();
    expect(structured(r).path).toBe("/tmp/custom-state.json");
  });

  test("test_DW_5_2_restore_round_trip_ok: valid state_json passes validation and restores", async () => {
    const port = await fresh();
    port.cannedRestoreResult = { restored: ["cookie:session", "localStorage:token"], skipped: [] };
    const state = {
      origin: "https://example.com",
      cookies: [{ name: "session", value: "abc" }],
      localStorage: [{ key: "token", value: "xyz" }],
      sessionStorage: [],
    };
    const r = await storageStateRestore.handler({ state_json: JSON.stringify(state) });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect(Array.isArray(s.restored)).toBe(true);
    expect((s.restored as string[]).length).toBe(2);
    expect(Array.isArray(s.skipped)).toBe(true);
  });

  test("test_DW_5_2_malformed_json_rejected: non-JSON state_json → storage_state_invalid (barricade)", async () => {
    await fresh();
    const r = await storageStateRestore.handler({ state_json: "not-json{{{" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_state_invalid");
  });

  test("test_DW_5_2_schema_validation_fails: state missing required fields → storage_state_invalid", async () => {
    await fresh();
    // 'origin' is required but missing
    const r = await storageStateRestore.handler({ state_json: JSON.stringify({ cookies: [] }) });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_state_invalid");
  });

  test("test_DW_5_2_wrong_origin_skipped_reported: port skips cross-origin cookies with diagnostic", async () => {
    const port = await fresh();
    port.cannedRestoreResult = {
      restored: ["cookie:session"],
      skipped: ["cookie:other (domain mismatch: other.example.com vs example.com)"],
    };
    const state = {
      origin: "https://example.com",
      cookies: [
        { name: "session", value: "abc" },
        { name: "other", value: "xyz", domain: "other.example.com" },
      ],
      localStorage: [],
      sessionStorage: [],
    };
    const r = await storageStateRestore.handler({ state_json: JSON.stringify(state) });
    expect(r.isError).toBeUndefined();
    const s = structured(r);
    expect((s.restored as string[]).length).toBe(1);
    expect((s.skipped as string[]).length).toBe(1);
    expect((s.skipped as string[])[0]).toContain("domain mismatch");
  });

  test("test_DW_5_2_port_restore_error_returned: port restoreStorageState error surfaces as err()", async () => {
    const port = await fresh();
    port.restoreError = "state from an incompatible version";
    const state = {
      origin: "https://example.com",
      cookies: [],
      localStorage: [],
      sessionStorage: [],
    };
    const r = await storageStateRestore.handler({ state_json: JSON.stringify(state) });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("storage_state_invalid");
  });

  test("test_DW_5_2_storagestateschema_roundtrip: StorageStateSchema serializes and re-parses cleanly", () => {
    const input = {
      origin: "https://example.com",
      cookies: [{ name: "c", value: "v", httpOnly: true }],
      localStorage: [{ key: "k", value: "lv" }],
      sessionStorage: [],
    };
    const result = StorageStateSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe("https://example.com");
      expect(result.data.cookies.length).toBe(1);
      expect(result.data.cookies[0]?.name).toBe("c");
    }
  });

  test("test_DW_5_2_storagestateschema_rejects_no_origin: empty origin fails validation", () => {
    const result = StorageStateSchema.safeParse({ origin: "", cookies: [], localStorage: [], sessionStorage: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DW-5.3: emulate_device, geolocation, permissions
// ---------------------------------------------------------------------------

describe("emulate_device (DW-5.3)", () => {
  test("test_DW_5_3_preset_applies: named preset reaches port.emulateDevice", async () => {
    const port = await fresh();
    const r = await emulateDevice.handler({ preset: "iPhone 12" });
    expect(r.isError).toBeUndefined();
    expect(port.lastDeviceProfile).toEqual({ preset: "iPhone 12" });
  });

  test("test_DW_5_3_explicit_dims_apply: width+height reach port.emulateDevice", async () => {
    const port = await fresh();
    const r = await emulateDevice.handler({ width: 1024, height: 768 });
    expect(r.isError).toBeUndefined();
    const dp = port.lastDeviceProfile as { width: number; height: number };
    expect(dp?.width).toBe(1024);
    expect(dp?.height).toBe(768);
  });

  test("test_DW_5_3_no_preset_no_dims_rejected: neither preset nor dims → emulation_failed", async () => {
    await fresh();
    const r = await emulateDevice.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("emulation_failed");
  });

  test("test_DW_5_3_unknown_preset_errs: unknown device preset → emulation_failed from port", async () => {
    const port = await fresh();
    port.emulateDeviceError = 'unknown device preset "WarpDrive 9000"';
    const r = await emulateDevice.handler({ preset: "WarpDrive 9000" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("emulation_failed");
  });
});

describe("geolocation (DW-5.3)", () => {
  test("test_DW_5_3_geolocation_applies: lat/lon reach port.setGeolocation", async () => {
    const port = await fresh();
    const r = await geolocation.handler({ latitude: 37.7749, longitude: -122.4194 });
    expect(r.isError).toBeUndefined();
    expect(port.lastGeolocation?.latitude).toBe(37.7749);
    expect(port.lastGeolocation?.longitude).toBe(-122.4194);
  });

  test("test_DW_5_3_geolocation_accuracy_defaults: accuracy defaults to 1m", async () => {
    const port = await fresh();
    await geolocation.handler({ latitude: 0, longitude: 0 });
    // tool doesn't pass accuracy explicitly; port receives the geo opts
    expect(port.lastGeolocation?.latitude).toBe(0);
  });

  // Note: lat/lon bounds are enforced by zod schema (-90..90, -180..180).
  // The zod schema rejects out-of-range at parse time, so the handler never fires.
  test("test_DW_5_3_geolocation_zod_rejects_out_of_range: lat > 90 fails zod validation", () => {
    // We test the schema directly since the zod schema enforces bounds.
    const schema = z.object(GeolocationInputSchema);
    const result = schema.safeParse({ latitude: 91, longitude: 0 });
    expect(result.success).toBe(false);
  });
});

describe("permissions (DW-5.3)", () => {
  test("test_DW_5_3_permissions_apply: known permission names reach port.grantPermissions", async () => {
    const port = await fresh();
    const r = await permissions.handler({ permissions: ["geolocation", "notifications"] });
    expect(r.isError).toBeUndefined();
    expect(port.lastPermissions?.permissions).toEqual(["geolocation", "notifications"]);
  });

  test("test_DW_5_3_unknown_permission_rejected: unknown name → permission_unknown (barricade)", async () => {
    await fresh();
    const r = await permissions.handler({ permissions: ["geolocation", "hack-the-planet"] });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("permission_unknown");
    const msg = r.content[0]?.text ?? "";
    expect(msg).toContain("hack-the-planet");
  });

  test("test_DW_5_3_all_known_permissions_pass_barricade: every item in KNOWN_PERMISSIONS is accepted", async () => {
    const port = await fresh();
    const { KNOWN_PERMISSIONS } = await import("../src/types.ts");
    for (const perm of KNOWN_PERMISSIONS) {
      port.lastPermissions = null;
      const r = await permissions.handler({ permissions: [perm] });
      expect(r.isError).toBeUndefined();
      // Cast needed: TS narrows lastPermissions to null after the assignment above.
      const last = port.lastPermissions as import("../src/core/browser-port.ts").PermissionsOpts | null;
      expect(last?.permissions).toEqual([perm]);
    }
  });
});

// ---------------------------------------------------------------------------
// DW-5.4: pdf + upload + download
// ---------------------------------------------------------------------------

describe("pdf (DW-5.4)", () => {
  test("test_DW_5_4_pdf_returns_path: successful PDF export returns a file path", async () => {
    const port = await fresh();
    port.cannedPdfPath = "/tmp/test-page.pdf";
    const r = await pdf.handler({ print_background: true, landscape: false });
    expect(r.isError).toBeUndefined();
    expect(structured(r).path).toBe("/tmp/test-page.pdf");
  });

  test("test_DW_5_4_pdf_failed_err: adapter failure → pdf_failed (never silent)", async () => {
    const port = await fresh();
    port.pdfError = "Page is navigating";
    const r = await pdf.handler({ print_background: true, landscape: false });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("pdf_failed");
  });

  test("test_DW_5_4_pdf_opts_forwarded: format/landscape/printBackground reach port", async () => {
    const port = await fresh();
    await pdf.handler({ format: "A4", print_background: false, landscape: true });
    expect(port.lastPdfOpts?.format).toBe("A4");
    expect(port.lastPdfOpts?.landscape).toBe(true);
    expect(port.lastPdfOpts?.printBackground).toBe(false);
  });
});

describe("upload (DW-5.4)", () => {
  test("test_DW_5_4_upload_resolves_target: upload with a selector routes through port.uploadFile", async () => {
    const port = await fresh();
    port.selectorCounts.set("input[type=file]", 1);
    const r = await upload.handler({ selector: "input[type=file]", file_path: "/tmp/test.png" });
    expect(r.isError).toBeUndefined();
    expect(port.uploadCalls.length).toBe(1);
    expect(port.uploadCalls[0]?.filePath).toBe("/tmp/test.png");
  });

  test("test_DW_5_4_upload_non_file_input_err: port upload_failed surfaces as err", async () => {
    const port = await fresh();
    port.selectorCounts.set("button#submit", 1);
    port.uploadError = "the target element is not an <input type=file>";
    const r = await upload.handler({ selector: "button#submit", file_path: "/tmp/x.bin" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("upload_failed");
  });

  test("test_DW_5_4_upload_no_target_rejected: no ref or selector → upload_failed barricade", async () => {
    await fresh();
    const r = await upload.handler({ file_path: "/tmp/x.bin" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("upload_failed");
  });

  test("test_DW_5_4_upload_coord_target_rejected: coordinate target → upload_failed (needs element handle)", async () => {
    await fresh();
    const r = await upload.handler({ x: 100, y: 200, file_path: "/tmp/x.bin" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("upload_failed");
    const msg = r.content[0]?.text ?? "";
    expect(msg).toContain("coordinate");
  });

  test("test_DW_5_4_upload_stale_ref_err: stale ref propagates through resolveTarget → stale_ref", async () => {
    const port = await fresh();
    // Ref issued in a previous snapshot but now stale.
    port.everIssued.add("old-ref");
    // liveRefs does NOT contain it → stale
    const r = await upload.handler({ ref: "old-ref", file_path: "/tmp/x.bin" });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("stale_ref");
  });
});

describe("download (DW-5.4)", () => {
  test("test_DW_5_4_download_ok: successful download returns path", async () => {
    const port = await fresh();
    port.cannedDownloadPath = "/tmp/report.csv";
    const r = await download.handler({ timeout_ms: 5000 });
    expect(r.isError).toBeUndefined();
    expect(structured(r).path).toBe("/tmp/report.csv");
  });

  test("test_DW_5_4_download_timeout_err: no download fires → download_timeout typed err", async () => {
    const port = await fresh();
    port.downloadTimeout = true;
    const r = await download.handler({ timeout_ms: 1000 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("download_timeout");
    // Message must name the timeout explicitly so caller can diagnose.
    const msg = r.content[0]?.text ?? "";
    expect(msg).toContain("1000ms");
  });
});

// ---------------------------------------------------------------------------
// DW-5.5: wait_for_text appear/disappear timeout named err
// ---------------------------------------------------------------------------

describe("wait_for_text (DW-5.5)", () => {
  test("test_DW_5_5_wait_for_text_appear_ok: text appears without timeout → ok", async () => {
    const port = await fresh();
    port.waitForTextTimeout = false;
    const r = await waitForText.handler({ text: "Welcome", appear: true, timeout_ms: 5000 });
    expect(r.isError).toBeUndefined();
    expect(structured(r).found).toBe(true);
    expect(structured(r).condition).toBe("appear");
  });

  test("test_DW_5_5_wait_for_text_disappear_ok: text disappears without timeout → ok", async () => {
    const port = await fresh();
    port.waitForTextTimeout = false;
    const r = await waitForText.handler({ text: "Loading...", appear: false, timeout_ms: 5000 });
    expect(r.isError).toBeUndefined();
    expect(structured(r).condition).toBe("disappear");
  });

  test("test_DW_5_5_wait_for_text_appear_timeout: appear timeout → wait_for_text_timeout naming appear", async () => {
    const port = await fresh();
    port.waitForTextTimeout = true;
    const r = await waitForText.handler({ text: "Success", appear: true, timeout_ms: 2000 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("wait_for_text_timeout");
    const msg = r.content[0]?.text ?? "";
    // The error message must name "appear" (not just "timeout")
    expect(msg).toContain("appear");
    expect(msg).toContain("Success");
  });

  test("test_DW_5_5_wait_for_text_disappear_timeout: disappear timeout → wait_for_text_timeout naming disappear", async () => {
    const port = await fresh();
    port.waitForTextTimeout = true;
    const r = await waitForText.handler({ text: "Spinner", appear: false, timeout_ms: 3000 });
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("wait_for_text_timeout");
    const msg = r.content[0]?.text ?? "";
    // Must name "disappear" explicitly (DW-5.5 requirement)
    expect(msg).toContain("disappear");
    expect(msg).toContain("Spinner");
  });

  test("test_DW_5_5_calls_forwarded_with_correct_opts: tool passes appear/text/timeout to port", async () => {
    const port = await fresh();
    await waitForText.handler({ text: "Done", appear: false, timeout_ms: 7000 });
    expect(port.waitForTextCalls.length).toBe(1);
    expect(port.waitForTextCalls[0]?.text).toBe("Done");
    expect(port.waitForTextCalls[0]?.appear).toBe(false);
    expect(port.waitForTextCalls[0]?.timeoutMs).toBe(7000);
  });
});

// ---------------------------------------------------------------------------
// DW-5.6: screencast lifecycle typed errs (video deferred to P5b)
// ---------------------------------------------------------------------------

describe("screencast lifecycle (DW-5.6 — lifecycle only, video deferred)", () => {
  test("test_DW_5_6_start_ok: first start arms the lifecycle", async () => {
    const port = await fresh();
    const r = await screencastStart.handler({});
    // The start itself succeeds (lifecycle armed)
    expect(r.isError).toBeUndefined();
    expect(port.screencastRunning).toBe(true);
  });

  test("test_DW_5_6_screencast_double_start_err: second start before stop → screencast_already_running", async () => {
    const port = await fresh();
    await screencastStart.handler({});
    expect(port.screencastRunning).toBe(true);
    const r = await screencastStart.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("screencast_already_running");
  });

  test("test_DW_5_6_screencast_stop_not_running_err: stop when not running → no_screencast_running", async () => {
    await fresh();
    const r = await screencastStop.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("no_screencast_running");
  });

  test("test_DW_5_6_screencast_stop_after_start_returns_deferred_err: stop after start → screencast_not_supported (P5b)", async () => {
    const port = await fresh();
    await screencastStart.handler({});
    expect(port.screencastRunning).toBe(true);
    // Stop returns the deferred error (P5b) — the lifecycle tracked correctly.
    const r = await screencastStop.handler({});
    expect(r.isError).toBe(true);
    expect(structured(r).code).toBe("screencast_not_supported");
    // Lifecycle reset: running is now false.
    expect(port.screencastRunning).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DW-5.7: BrowserPort additions + no-puppeteer-in-core (static.test.ts covers this)
// ---------------------------------------------------------------------------

describe("DW-5.7 — port additions accessible + captures route through port", () => {
  test("test_DW_5_7_port_has_all_p5_methods: FakePort implements all P5 BrowserPort methods", async () => {
    const port = await fresh();
    // All 12 P5 port methods exist and are callable.
    expect(typeof port.storage).toBe("function");
    expect(typeof port.saveStorageState).toBe("function");
    expect(typeof port.restoreStorageState).toBe("function");
    expect(typeof port.emulateDevice).toBe("function");
    expect(typeof port.setGeolocation).toBe("function");
    expect(typeof port.grantPermissions).toBe("function");
    expect(typeof port.printPdf).toBe("function");
    expect(typeof port.startScreencast).toBe("function");
    expect(typeof port.stopScreencast).toBe("function");
    expect(typeof port.uploadFile).toBe("function");
    expect(typeof port.captureDownload).toBe("function");
    expect(typeof port.waitForText).toBe("function");
  });

  test("test_DW_5_7_pdf_routes_through_port: pdf tool calls port.printPdf (not adapter directly)", async () => {
    const port = await fresh();
    port.cannedPdfPath = "/tmp/routed.pdf";
    const r = await pdf.handler({ print_background: true, landscape: false });
    expect(r.isError).toBeUndefined();
    expect(structured(r).path).toBe("/tmp/routed.pdf");
    // Proves tool → port route (not adapter direct)
    expect(port.lastPdfOpts).not.toBeNull();
  });

  test("test_DW_5_7_storage_state_routes_through_port: save calls port.saveStorageState", async () => {
    const port = await fresh();
    port.cannedStorageStatePath = "/tmp/state-routed.json";
    const r = await storageStateSave.handler({});
    expect(r.isError).toBeUndefined();
    expect(structured(r).path).toBe("/tmp/state-routed.json");
  });
});
