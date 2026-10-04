# CR-024 — Multi-NVR: one Arx installation managing more than one recorder

**Status:** in implementation (task K58, target release 0.1.163), branch `pilot/multi-nvr` from `main` 0.1.161 (3d5039bb).
**Owner request:** "multi-NVR in full". The remaining capability-model work (NN1 P4, P5, P7; `private/nn1/PLAN.md` sections 4-6)
was moved into the same release by the owner and is part of this CR. **Builds on:** CR-020 (adapter seam, ADP =
`docs/architecture/NVR_VENDOR_ADAPTERS.md` sections 1-7, decisions D4/D6), CR-022 (`recorder_connections`, migration 0052, one row
per recorder), NN1 P0-P2 (capabilities, released in 0.1.158). **Migration:** `0055_multi_recorder.sql` (one number; 0056 not
needed). No device, go2rtc, Home Assistant or lab system was contacted; every test uses fakes.

Paths: `B/` = `smplwise_vms/backend/smplwise/`, `F/` = `frontend/src/`.

## 1. Owner decisions this CR applies (already taken)

| # | Decision | Effect |
|---|---|---|
| O1 | An NVR needs go2rtc; without go2rtc the installation is never "ready" | unchanged capability rule, applied per installation (go2rtc is shared by all recorders) |
| O2 | Removing an NVR keeps its camera rows disabled and invisible, history intact | `recorders.removed_at`; cameras `enabled=0`, left out of every camera list; events, cases, anchors, bindings, change log kept |
| O3 | NVR connection settings live in Arx settings, not the add-on options | every recorder (including `nvr-1`) has its row in `recorder_connections` (CR-022 table reused, no second credentials table) |
| O4 | Provision-ISR is the first additional vendor, but its adapter is NOT in this task | a clean registration seam (`registry.register_vendor`) plus a fake second vendor used by tests only |
| O5 | Connection changes apply through an explicit restart (CR-022 D3, NN1 Q6 a) | add / edit / enable / disable / remove of a recorder answer `restart_required`; per-recorder `pending_restart` |
| O6 | Leftover-camera policy (NN1 Q7 a) | as O2; the rows come back (disabled, for review) when a connection is saved for that recorder again |

## 2. What is built

### 2.1 Data model (migration 0055)

- `recorders`: `vendor` (default `hikvision`), `enabled` (1), `sort_order` (0), `time_zone` (NULL = installation zone),
  `capabilities_json` (`{}`), `removed_at` (NULL). No `connection_ref` (ADP section 7 note: the connection is the
  `recorder_connections` row with the same id).
- `cameras`: `source_ref` (back-filled `CAST(channel AS TEXT)`, unique with `recorder_id`), `device_fingerprint` (keyed hash,
  never the serial).
- `events`: `recorder_id` (NULL = not a recorder event, e.g. Home Assistant), back-filled from the camera, `nvr-1` for old
  device-level alert-stream rows; index `(recorder_id, occurred_at)`.
- Additive only; older code ignores the columns (rollback = run the previous version; the columns stay).

### 2.2 Backend

1. **Recorders as first-class entities.** `B/recorder_scope.py`: one function `settings_for(settings, recorder_id)` returns
   the connection a recorder runs with. `nvr-1` keeps the process-wide `Settings` (the ~20 modules that read `settings.nvr_*`
   do not change); every further recorder gets its own effective `Settings` overlaid ONCE at start-up from its
   `recorder_connections` row (same crypto, same source policy re-check, same fail-closed states `unreadable` / `refused`).
   A recorder without a usable connection answers 409 `recorder_unavailable` at the device boundary.
2. **Recorder ids** are `nvr-<n>`, assigned once, never reused (a removed `nvr-2` stays `nvr-2` in history; the next
   recorder is `nvr-3`), matching go2rtc's name rule. Stream names already carry the id
   (`smplwise_{recorder_id}_ch{n}_{main|sub}`).
3. **Routes** (new router `B/routers/recorders.py`, all under `/api/v1`):
   `GET /recorders` (list with status, camera counts, capabilities; connection detail for `system.configure` only),
   `POST /recorders` (add: vendor, connection, name; tested server-side like CR-022 section 6.4, offline save with the
   typed word), `PATCH /recorders/{id}` (name, order, time zone, enable / disable), `GET|PUT /recorders/{id}/connection`,
   `POST /recorders/{id}/connection/test`, `DELETE /recorders/{id}` (typed word "הסר"; O2), `GET /recorders/{id}/health`
   (read-only, one `deviceInfo` GET). The CR-022 routes `/nvr/connection*` stay as the `nvr-1` aliases, unchanged.
4. **Every existing NVR API gains an explicit recorder id, `nvr-1` by default:** camera-bound routes (snapshot, zones,
   capabilities, OSD, schedules, smart, motion, manual recording, recordings search, playback, frames, exports, thumbnails,
   live stream ensure, video settings and stream writes) use the camera's own recorder; installation-level NVR routes
   (`/nvr/system`, `/nvr/time`, `/nvr/ntp`, outputs, disk test, reboot, notify linkage, storage report, `/cameras/sync`,
   `POST /cameras`) take `recorder_id` (query or body), default `nvr-1`; `GET /cameras` and `GET /events` take a
   `recorder_id` filter; the change-log undo uses the change's recorder.
5. **Per-recorder background work:** discovery and stream sync, the alert stream (one listener per recorder with its own
   state and queue), recording-derived events, the storage report. One recorder failing never stops another (each runs in
   its own try / thread). `/health` gains a `recorders` block (state per recorder, no address).
6. **Capability model per recorder** (NN1 P5): `capabilities.recorders[]` lists every configured recorder with its adapter's
   declaration; `nvr` is true when any recorder is configured; `recorders.capabilities_json` keeps the last declaration.
7. **Adapter registration seam:** `registry.register_vendor(spec, constructor)`; `adapter_for` honours `recorders.vendor`
   (falls back to the connection's vendor) and refuses a vendor without an adapter. A fake vendor (`fakevendor`) is registered
   by tests only; the catalogue shown to installers is unchanged (Hikvision available, Provision-ISR / Frigate "coming soon").
8. **Identity (NN1 P4, ADP section 3):** discovery matches `(recorder_id, source_ref)`; `device_fingerprint` =
   HMAC-SHA256(installation salt, recorder_id | model | serial)[:16] when the device names the camera behind a slot; a changed
   fingerprint disables the camera, audits `cameras.replaced`, and the administrator re-enables it to accept. Same names or
   serials on two recorders never merge rows.
9. **Write batches never mix recorders:** the CR-020 batch runner and the unreleased bulk-encoding change
   (`pilot/nvr-bulk-encoding`, read, not merged) already refuse targets on more than one recorder; this CR keeps that rule,
   makes the adapter per recorder (so the device lock key is the right device) and adds tests. No logic of the batch runner
   is rewritten (the only edits are the adapter lookup in `registry.py`).
10. **Permissions, audit, remote channel:** recorder management = `system.configure` (CR-022 D5); recorder reads = whoever may
    read the NVR configuration (`system.configure` or any `nvr.*`); camera-bound operations keep their camera-scoped
    checks, so a role scoped to recorder A's cameras sees nothing of recorder B. Audit actions `nvr.recorder.add`,
    `.update`, `.remove`, `.test`. Every new route is blocked on the remote channel like the CR-022 routes.
11. **Backups:** `recorders` and `cameras` travel with their new columns; `recorder_connections` and the key stay out
    (CR-022 section 9); restored onto another installation, each recorder asks for its connection again.

### 2.3 Settings UI

- **Recorders card** in Settings › connections: with one recorder it is the familiar connection form plus "הוסף NVR" (a
  single-NVR installation looks as before); with two or more, a recorders list - name, vendor and model, state, cameras,
  "pending restart" - with "חיבור" (that recorder's connection form: edit, test, remove with the typed "הסר" and one line that
  the cameras stay disabled), rename, disable / enable. Add = the existing connection form in a sheet (name → type → fields →
  test → save).
- **Camera screens show the recorder:** the camera settings table gets a recorder column and a recorder filter; camera
  pickers name the recorder when there is more than one; duplicate names across recorders are disambiguated with the
  recorder name.
- **Filters by recorder:** the all-cameras wall and the event log get a recorder filter. Every recorder element is hidden
  while the installation has one recorder (operator screens stay as they are).

### 2.4 Cross-recorder views

The all-cameras wall and the event log already reference `camera_id` only; with the recorder filter they are the
cross-recorder views. The event log is multi-source (`events.recorder_id`).

## 3. What is NOT built, and why

| Item | Why not | What is needed |
|---|---|---|
| ~~Synchronized playback across recorders~~ **built as an EXPERIMENTAL, off-by-default setting (section 7.1)** | Still unproven: no measurement of anchors, seek generations and rendered time on two real recorders (AGENTS). Off (default) = 409 `sync_cross_recorder_unproven` as before | The owner turns it on when he has two NVRs and reports problems; a lab measurement would let it lose the "experimental" mark |
| **Provision-ISR (and Frigate) adapters** | Owner: Provision-ISR's API is not available yet (NN1 P6); Frigate is later | A read-only probe of a real unit, then an adapter registered through `register_vendor` |
| **A "recorder" RBAC scope type** | `nvr.configure` and `system.configure` are system permissions held only by the built-in system administrator at installation scope, so a recorder scope would grant nothing today; a new scope type changes the binding model, the scope picker and every `authorize` call and needs its own security review | An owner decision that a non-system role should configure one recorder only |
| **Applying CONNECTION changes without a restart** | Owner decision O5 (restart semantics) still holds for a connection (address, user, password, vendor) and for a recorder added after the start. Disable / enable apply at once since the owner answer of 2026-10-04 (section 7.2) | NN1 Q6 b, if ever wanted |
| **Per-recorder live-session budget** (`live-budget.ts`) | The budget is installation-wide today and works across recorders; a per-recorder count needs the recorder's session limit, which is not discovered | Capacity discovery per recorder |
| **Confirm-same-place dialog for a swapped camera** | A changed fingerprint disables the camera and is audited; re-enabling it in the camera table is the confirmation. A dedicated review dialog belongs to CR-020 S3 (add / remove channel) | CR-020 S3 |
| **Recorder time zone applied to recording search and playback URLs** | The column is stored and editable; the alert-stream time conversion uses it. Recording search and the playback / export URL builders keep the installation zone, because the NVR wall-clock conversion there is proven only for the installation zone (lab evidence) | A real second recorder in another zone to verify the conversion |

## 4. Tests (all against fakes)

Backend (`tests/test_multi_nvr*.py`): two fake recorders (two `FakeDevices` on two `.test` names); add / edit / disable /
remove; failure of one recorder (down, 401) does not affect the other's discovery, alert stream, snapshot or stream write;
the same camera name and the same serial on both recorders stay two cameras; removal keeps cameras (disabled, invisible),
events, anchors and the change log; ids never reused; every existing route with and without `recorder_id`; batches refuse
mixed recorders; the go2rtc namespace guard (foreign streams untouched, a removed recorder's own streams deleted by exact
name only); permission matrix (403 before 404 / 409, audited), remote channel 404; backups exclude the connection rows.
UI: Playwright on the mocked backend in desktop / tablet / mobile, the layout guard in the four skins for the touched
screens, `tsc --noEmit`.

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | A module still reads `settings.nvr_*` for a camera of another recorder (silent wrong device) | every camera-bound call goes through `settings_for(settings, cam["recorder_id"])`; a test drives every camera route against recorder 2 and asserts the fake of recorder 1 received nothing |
| R2 | Alert dedup across recorders (same channel numbers) | `events.recorder_id` in the merge query and in the dedup key of non-primary recorders |
| R3 | Merge conflicts with `pilot/nvr-bulk-encoding` | no edit to `nvr_batch.py` / `nvr_settings.py` logic; the recorder dimension sits in `registry.py` |
| R4 | Start-up time with several recorders (source policy re-check resolves names) | at most 2 s per stored name, as CR-022; IP addresses avoid it |

## 6. Implementation notes and recorded deviations (2026-10-04)

1. **Route path.** The management routes are `/recorders...` (not `/nvr/recorders`): `GET /nvr/recorders` already serves the CR-020 S1
   recorder cards (`routers/nvr_settings.py`) and the frontend's CR-020 S3 client uses `/nvr/recorders/{id}/channels`. Remote channel:
   the prefix `/api/v1/recorders` is blocked like the CR-022 routes.
2. **The first recorder stays special.** `nvr-1` is the process-wide connection (CR-022 overlay, legacy import, setup wizard). Adding
   an NVR to an installation without any recorder fills `nvr-1` ONLY when no history exists under it (section 7.3); otherwise, and
   for every further recorder, a new id. "No NVR" is a choice for the first recorder only; a further recorder is removed instead.
3. ~~**Disable = restart semantics.**~~ Superseded by section 7.2 (owner 2026-10-04): disable / enable apply at once.
4. **CR-022 "Remove NVR" marks the recorder removed too** (`recorders.removed_at`), so the first recorder follows the same
   keep-history / invisible rule as the others; saving a connection again clears the mark.
5. **Device lock (CR-020 S2C review finding 6).** The test that assumed "every recorder row is the add-on's NVR" was rewritten:
   recorder rows now carry their own connection; a row without one is not the first device (409 `recorder_unavailable`, nothing sent).
   `nvr-1` keeps the lock key `addon-nvr` (a lock written by an older version still matches); a further recorder's key is a hash of
   its destination. Two rows naming one device (host + HTTP port) are refused 409 `recorder_duplicate` (also against the legacy
   connection of the first recorder).
6. **Map.** The cameras of a removed recorder leave the CURRENT floor map and its camera list (`GET /floors/{id}/map`, `.../anchors`);
   their anchor rows stay and the history view (`?at=`) still shows them.
7. **Single-recorder UI unchanged.** With one recorder the settings card is the CR-022 connection form plus "הוסף NVR"; recorder
   filters and names appear only with two or more recorders (`GET /cameras` `recorders`).
8. **Bulk-encoding branch (`pilot/nvr-bulk-encoding`).** Read, not merged. Its `_recorder_of` already refuses a mixed batch; the
   recorder dimension it needs comes from `registry.adapter_for` (per-recorder adapter) - no edit to `nvr_batch.py` or
   `nvr_settings.py`. Expected merge conflicts: `smplwise_vms/CHANGELOG.md` (both add "## Unreleased"),
   `remote_channel.py` (adjacent tuple lines - this branch adds a separate line), `system-security-cameras.ts` (toolbar region;
   both add one element), `contracts/API_INVENTORY.md` (regenerate).
9. **Fixed on the way:** the camera-offline notification source (`notify_sources`) and the WebRTC hint (`stream_codecs.hints`)
   read only the first recorder.

## 7. Owner answers of 2026-10-04 (built on top of 21cd7feb)

### 7.1 Synchronized playback across recorders - EXPERIMENTAL / UNPROVEN, off by default

- Setting `playback.cross_recorder_sync` (`"false"` default) in הגדרות › כללי › וידאו ומדיה, row "ניגון מסונכרן בין מקליטים (ניסיוני)".
  Off: a group with cameras of two recorders is refused 409 `sync_cross_recorder_unproven` (unchanged). Single-recorder groups never
  take the new path, on or off.
- On: once per group, each recorder's zone and clock offset are fixed (`services/recorder_clock.py`): zone = `recorders.time_zone`,
  else the installation's (an unknown name falls back); offset = recorder clock minus server clock from `GET /ISAPI/System/time`
  (4 s budget), read in that same zone. Each member's recording search asks for `[t + offset)` in its zone and the answer is turned
  back into server time; its RTSP playback request asks for `[t + offset, end + offset]` in its zone. Seeks reuse the offsets.
- Defensive rules: |offset| <= 1 s counts as 0; |offset| > 900 s refuses that recorder's members (`clock_offset_too_large`); a
  device time carrying an explicit UTC offset that is neither the zone's current nor its standard offset (Hikvision tags the
  standard offset even in summer) refuses them (`recorder_zone_mismatch` - set the recorder's zone); an unreadable clock keeps the
  member with offset 0 and `clock: "unknown"` (the browser's own drift measurement shows the result); a disabled recorder's members
  are refused (`recorder_unavailable`). Refused members appear in `missing`; the others play. The group answer says
  `sync: "experimental_cross_recorder"`, `experimental: true`, and the per-recorder `{time_zone, offset_s, clock, refused}`; the
  audit row of the group keeps them.
- Not built (why): re-measuring the offset during a long group (once per group is the documented behaviour; a long session can
  drift); an HLS member (no HLS vendor exists); any claim of frame-accurate sync - the browser's existing p95 drift measurement
  stays the only evidence, and it was never run on two real recorders.
- Tests: `tests/test_multi_nvr_live.py` - two fakes, Jerusalem / no drift and London / +45 s (and -30 s with a naive clock):
  search and RTSP requests in each recorder's terms, seek, off by default, too-large offset, zone mismatch, unreadable clock,
  disabled recorder, single-recorder group untouched.

### 7.2 Disable / enable at once (no restart)

- `recorder_scope.DISABLED` (process state, filled at start-up from `recorders.enabled`, flipped by `PATCH /recorders/{id}`) is read
  by every device boundary: `nvr._client`, the live and playback RTSP builders (`mode.ensure_recorder_enabled`, 409
  `recorder_unavailable`), `has_host` / `ready` (discovery, recording-derived events, capabilities), the alert-stream loop, the
  stream sync. A disabled recorder's connection stays loaded, so enabling needs no restart; a disabled first recorder does not
  block the other recorders' cameras (the route-level "is there an NVR" check is separate).
- Stopped right after the answer (`services/recorder_live.py`, a background task, outside the write lock): its alert stream, its
  open playback sessions, its `smplwise_{recorder}_ch{n}_{main|sub}` streams in go2rtc (exact names; foreign streams untouched; the
  stream sync deletes and never re-creates them while disabled). Enabling starts the alert stream, one discovery and the stream sync.
- Visibility: `GET /cameras` marks its cameras `recorder_enabled: false`, `can_view_live: false`; the wall and the playback /
  sync pickers leave them out at once; snapshots answer 409 (no cached copy); the capability set drops the recorder. Settings
  lists keep them. `/me` and `/health` report no pending restart for enable / disable.
- Removal also stops the recorder at once (same stop), while `restart_required` stays true (its loaded connection leaves memory
  with the restart).
- Limit: a recorder added after the start, then enabled, still needs the restart (its connection is not loaded yet).
- Tests: `tests/test_multi_nvr_live.py` (second recorder, first recorder, disabled at the last start, removal).

### 7.3 The first id never carries history onto a new device

- `POST /recorders` hands out `nvr-1` only when no recorder is in use AND nothing references `nvr-1` (its recorder row, cameras,
  events, change-log rows). Otherwise a new id (`nvr-<n>` above every id ever used). The settings card, with no recorder left and
  history under `nvr-1` (`GET /recorders` `primary_has_history`), shows the add form instead of the first recorder's form.
- **CR-022 contract change (owner 2026-10-04, option ב): the wizard follows the same rule.** `PUT /nvr/connection` (the setup
  wizard's NVR step and the first recorder's form) amends CR-022 D7 "the same NVR reconnected after Remove": when `nvr-1` is free
  (removed / "no NVR") AND has history, the save reconnects `nvr-1` only for the SAME physical recorder. Identity =
  `recorders.device_fingerprint` = HMAC-SHA256(installation salt, "recorder" | model | serial)[:16] (column added to the unreleased
  migration 0055), stored at every tested save and every discovery; the serial comes from deviceInfo (the test's `_serial`, stripped
  from every answer by `connection_probe.public`) and is never stored, logged or returned; the address is not part of it (the same
  recorder at a new address is still the same device). The candidate is compared with the stored identity of `nvr-1`: equal = same
  device, `nvr-1` (its cameras come back disabled for review, as CR-022 D7). Different, a device without a serial, an untested save
  ("שמור" while unreachable) or no stored identity = unsure = a NEW id (`nvr-<n>`, audited `nvr.recorder.add` with reason
  `history_under_first_id`); the answer carries `recorder_id` and `new_recorder: true`; the old cameras keep `nvr-1` and stay
  disabled, and the new device's discovery creates its own rows. An edit of an ACTIVE `nvr-1` (not after a removal) is unchanged,
  and a fresh installation still gets `nvr-1`.
- The wizard's NVR step follows a recorder that runs under its new id: `todo / restart_pending` until the restart, then `done` by
  its discovery (`setup_wizard.further_recorders_step`), never "ללא NVR".
- Tests: `tests/test_multi_nvr_live.py` (add route: fresh installation gets `nvr-1`; a removed `nvr-1` with history gets `nvr-2`)
  and `tests/test_multi_nvr_identity.py` (wizard route: fresh gets `nvr-1` and no serial in any answer; the same device reconnected
  keeps `nvr-1` and its camera rows; the same device at a new address keeps `nvr-1`; a different device gets `nvr-2` and its channels
  are new rows while the old ones stay `nvr-1`, disabled, and the wizard step is `done`; no serial or an untested save = a new id;
  an edit of an active `nvr-1` is unchanged).

---

## סיכום בעברית

**מה נבנה:** מערכת Arx אחת מנהלת כמה מקליטי NVR. כל מקליט הוא ישות עם מזהה קבוע (nvr-1, nvr-2...), חיבור משלו
(בטבלת החיבורים הקיימת, סיסמה מוצפנת), מצב חיבור משלו, רשימת מצלמות ויכולות משלו. הוספה, עריכה, השבתה והסרה דרך
הגדרות › חיבורים (רשימת מקליטים, הוספה בתבנית האשף הקיימת), כל שינוי דורש הפעלה מחדש כמו היום. הסרת מקליט משאירה את
המצלמות שלו מושבתות ומוסתרות וההיסטוריה נשמרת. כל ממשקי ה־NVR הקיימים מקבלים מזהה מקליט (ברירת מחדל nvr-1, כך שהתקנה
עם מקליט אחד לא משתנה). גילוי מצלמות, זרם האירועים והזרמים ב־go2rtc רצים לכל מקליט בנפרד, ותקלה במקליט אחד לא משפיעה
על השני. שינויים מרובים לעולם לא מערבבים שני מקליטים. במסכים: עמודת מקליט וסינון בטבלת המצלמות, סינון לפי מקליט בקיר
המצלמות וביומן האירועים (מוצג רק כשיש יותר ממקליט אחד).

**עדכון לפי תשובות הבעלים (4.10):** ניגון מסונכרן בין מקליטים נבנה כהגדרה ניסיונית, כבויה כברירת מחדל ("לא הוכח"),
עם אזור זמן וסטיית שעון לכל מקליט וכללי הגנה (סטייה גדולה, אזור זמן סותר, שעון לא קריא). השבתה והפעלה של מקליט חלות מיד בלי
הפעלה מחדש (זרם אירועים, זרמי go2rtc, קיר ובוררים). המזהה nvr-1 לא מוצמד למכשיר חדש כשקיימת לו היסטוריה - גם באשף ההתקנה: אותו מכשיר
(לפי חתימה מוצפנת של דגם ומספר סידורי, בלי לשמור את המספר עצמו) חוזר ל־nvr-1; מכשיר אחר או מכשיר שלא ניתן לזהות מקבל מזהה חדש.

**מה לא נבנה ולמה (במקור):** ניגון מסונכרן בין שני מקליטים (לא הוכח על שני מקליטים אמיתיים, אסור לגעת בציוד אמיתי במשימה הזו;
ניגון מצלמה בודדת מכל מקליט עובד); מתאם Provision-ISR (ה־API שלו עוד לא זמין); הרשאה בהיקף "מקליט" (ההרשאות
הרלוונטיות שמורות למנהל המערכת בלבד); החלה ללא הפעלה מחדש (החלטת בעלים); תקציב צפייה חיה לכל מקליט; אזור זמן נפרד
למקליט בחיפוש הקלטות ובניגון (נשמר ומשמש לזרם האירועים בלבד, עד בדיקה על מקליט אמיתי באזור אחר).
