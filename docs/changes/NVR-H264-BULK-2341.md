# NVR-H264-BULK-2341 - switch every camera stream to H.264 from the UI

Branch `pilot/NVR-H264-BULK-2341` (from `release/2340-train`). No version bump, no merge. Code and tests only: no device was
contacted while building this (owner decision 2026-10-04: the first real bulk change is done by the owner from the UI).

## Why

Live view plays only H.264 in Chrome / Edge (WebRTC); H.265 saves recording space but does not play there. The owner asked for one
action that moves every stream (or the chosen cameras, main / sub / both) to H.264, through the existing safe path, with an undo.

## What existed (reused unchanged)

- CR-020 phase D bulk encoding engine (`services/nvr_encoding_batch.py`): read-only plan per stream (`plan_stream`): the profile the
  new codec needs (same name, else Main), a resolution the new codec does not offer moved to the closest, every other field kept, a
  stream that cannot be changed listed with a Hebrew reason; `POST /nvr/encoding-batches/preview` and the confirmed start that re-plans
  from a fresh read (409 `stale` / `plan_changed`).
- The phase C batch runner (`services/nvr_batch.py`): one stream at a time, the S2A two-phase guarded write per item, stops at the
  first failure, unknown-outcome check, device lock, recovery at start-up; every item's `nvr_changes` row keeps the stream as it was
  before (`before_xml`) and `{field: [from, to]}`. Undo-all (`POST /nvr/stream-batches/{id}/rollback`) is a new reversed batch that
  writes those previous values back.
- Owner decisions 2026-10-04: partial apply (refused / unsupported streams are listed and left out), Arx picks the profile, an
  unsupported field stays as it is with a note.
- Provision-ISR write gate: `nvr_extra.writes_enabled` (no UI). Hikvision had no per-recorder gate (writes on since CR-020 S2).

## What is new

1. **Per-recorder switch "אפשר שינויי הגדרות ב־NVR"** (`services/nvr_write_switch.py`, `routers/recorders.py`).
   - `GET /api/v1/recorders/{id}/writes` (`system.configure`): `{supported, enabled, explicit, default, last_change{at, by, enabled}, can_change}`.
   - `PATCH /api/v1/recorders/{id}/writes` `{enabled, confirm}`: needs `system.configure` AND `nvr.configure` (the sensitive NVR-write
     permission), checked before the body is parsed; strict JSON booleans; turning ON needs `confirm: true` (422 `confirm_required`
     otherwise); turning OFF never needs it. Vendors without encoding writes (Frigate, "no NVR"): 409 `writes_not_supported`.
   - Audit `nvr.writes.switch` (resource `recorder/<id>`, details `enabled / previous / changed / vendor`) for every change and every
     refused attempt; "who / when" in the screen comes from the latest allowed row.
   - Stored in `settings` (`nvr.writes_enabled:<id>`), loaded at start-up into `recorder_scope.WRITES`; a change applies AT ONCE (no
     restart): Provision-ISR's and Hikvision's `writes_enabled` read it first. Off = the stream is not writable (`writes_disabled`):
     the preview skips it with "שינויי הגדרות ב־NVR הזה כבויים...", a forged start is 422 `batch_target_not_allowed`, a single write is
     409 `nvr_not_supported` (`details.reason = writes_disabled`; was a misleading 503 `capabilities_unreadable` on Provision-ISR), the
     adapters refuse before a request is built, a running batch stops at its next stream, and an undo is refused too.
   - Defaults when never switched: Provision-ISR off (or the legacy `nvr_extra.writes_enabled`); **Hikvision on** (keeps the behaviour
     shipped since CR-020 S2, so existing installations do not lose single-stream editing). See open question 1.
   - UI: `components/nvr-writes-switch.ts` inside the connection form (Settings › connections, view mode, Hikvision / Provision-ISR).
     Turning on opens a Hebrew dialog: Arx will write encoding settings to the NVR (only after a preview and your confirmation), every
     change is recorded (who / when), it can be turned off at any time and that applies at once. Read-only without `nvr.configure`.
2. **One-click preset "המר את כל הזרמים ל־H.264"** in "שינוי קידוד לכמה מצלמות" (`screens/nvr-encoding-batch.ts`, logic in
   `screens/nvr-h264-preset.ts`). Scope: all cameras / the cameras already ticked; streams: main / sub / both. The button ticks those
   streams and runs the EXISTING preview with exactly `{codec: "H.264"}` - no new write path. The preview shows per stream the codec
   before -> after, the profile Arx picked (marked as adjusted), a resolution that had to move (adjusted, with the note), "כבר מוגדרים"
   for streams already on H.264 and "לא ניתן" with the reason for refused / offline / writes-off streams. Then the same single
   confirmation, progress, and the undo-all, which for an encoding batch now reads **"החזר לערכים הקודמים"** (toast and result
   dialog); the SVC batch keeps "בטל" / "בטל את מה שנשמר".
3. **Hebrew hint** in the preset and in its preview: "H.264 מנגן בשידור חי בכל דפדפן; H.265 חוסך נפח הקלטה אך לא מנגן ב-Chrome/Edge."
   plus "נפח ההקלטה עשוי לגדול אחרי המעבר ל־H.264." and that resolution / frame rate / bitrate stay unless the camera requires otherwise.

Note on "partial": the plan is partial (unsupported, refused and offline streams are left out and listed). The runner itself keeps the
CR-020 S2C rule: it works one stream at a time and stops at the first failure; what was applied stays applied and can be undone.

## Owner step by step (Hebrew)

1. הגדרות › חיבורים › ה־NVR › "חיבור": מפעילים את "אפשר שינויי הגדרות ב־NVR". נפתח חלון אישור - קוראים ולוחצים "הפעל".
2. מערכת › אבטחה › מצלמות › "שינוי קידוד לכמה מצלמות".
3. בראש החלון, "המר את כל הזרמים ל־H.264": בוחרים "כל המצלמות" (או "המצלמות שנבחרו" אחרי שמסמנים מצלמות ברשימה) ו"ראשי ומשני" / "ראשי" / "משני".
   מומלץ להתחיל ממצלמה אחת: "המצלמות שנבחרו" + מצלמה אחת מסומנת.
4. לוחצים "המר N זרמים ל־H.264". נפתחת תצוגה מקדימה: "ישתנו" (קודק לפני ← אחרי, פרופיל שהותאם מסומן *), "כבר מוגדרים", "לא ניתן" עם הסיבה. עדיין לא נכתב דבר.
5. לוחצים "החל על N זרמים" ומאשרים פעם אחת. השידור של כל מצלמה נקטע לכמה שניות; השינוי עובר מצלמה אחרי מצלמה ונעצר בשגיאה הראשונה.
6. בסוף מופיעה הודעה עם "החזר לערכים הקודמים" (גם בחלון התוצאה אם השינוי נעצר). לחיצה מחזירה כל זרם שהשתנה לערכים שהיו לפני השינוי.
7. בודקים שידור חי ב־Chrome / Edge. שימו לב: נפח ההקלטה עשוי לגדול.
8. בסיום אפשר לכבות את "אפשר שינויי הגדרות ב־NVR" - הכיבוי חל מיד וחוסם כל כתיבה ל־NVR (גם החזרה לערכים הקודמים; כדי להחזיר מפעילים שוב).

## Tests

Backend (`smplwise_vms/backend/tests/test_nvr_h264_bulk_2341.py`, fake NVR): switch state + vendor default + who/when; confirm
required to turn on, strict body, both permissions (a `system.configure`-only and an `nvr.configure`-only role are 403 before the body),
audit rows allowed/denied; unknown recorder 404; local-only prefix; start-up load; switch off = preview skip `writes_disabled`, forged
start 422, single write 409, undo refused, zero PUTs, on again plans; adapters obey the switch (Provision-ISR off by default, override
wins over the legacy flag, Hikvision legacy on, local refusal); the H.264 preset changes only codec (+ profile / resolution when needed),
main-only / sub-only targets; partial plan (capabilities refused + offline listed, the rest applied, only planned streams PUT); the undo
restores the captured previous values. `test_provision_isr_p2.py::test_route_refuses_when_writes_disabled` now expects the 409.

Frontend: `tests/unit-nvr-h264-preset.spec.ts` (Node): preset stream selection per scope / role, blocked counts and the writes-off line,
the settings sent (`{codec: 'H.264'}` only), labels, the undo wording, the switch's words and status line, source guards (one preview /
one start call, the switch calls only its own route, turning off sends no confirm).

Runner evidence (NOT run on the workstation; low-memory rule): `tests/evidence-nvr-h264-bulk.spec.ts` (preset flow with the batch mock,
selected-cameras scope, the switch dialog in Settings › connections)
`~/run_remote.sh spec pilot/NVR-H264-BULK-2341 tests/evidence-nvr-h264-bulk.spec.ts` and the existing
`tests/evidence-nvr-encoding-batch.spec.ts`, `tests/layout-nvr-encoding-batch.spec.ts` (the select step is taller now: check the
no-scroll rule), `tests/evidence-multi-nvr.spec.ts`, `tests/evidence-nvr-cameras-batch.spec.ts`. Pixel baselines of
`pixel-nvr-encoding-batch.spec.ts` cover the settings and preview phases of the manual flow, which this change does not alter; a pixel
of the select step / the switch row does not exist yet (refresh on the runner if one is added). `contracts/API_INVENTORY.md` gains the
two `/recorders/{id}/writes` routes at the next release (generated by `scripts/api_inventory.py`).

## Open questions for the owner

1. Hikvision default: keep "on when never switched" (no change for existing installations), or "off until switched on" like Provision-ISR?
2. Should turning the switch off also cancel a batch that is running (today it stops at its next stream with a refusal)?
