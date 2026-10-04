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

- **Recorders list** in Settings › connections (replaces the single connection card): name, vendor, status, cameras,
  "pending restart"; add (the existing connection form in a wizard sheet: type → fields → test → save), edit connection,
  rename, disable / enable, remove (typed "הסר", one line that the cameras stay disabled).
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
| **Synchronized playback across recorders** | AGENTS: a playback stream is not a proven synchronized recording until media anchors, seek generations and rendered time are measured per recorder. Two recorders have their own clocks, zones and drift (KNOWN_QUIRKS T2); no measurement against two real recorders exists, and this task may not touch real devices. A sync group with cameras of two recorders is refused 409 `sync_cross_recorder_unproven`; playback of each camera alone works | A lab session with two real recorders (owner's word): drift and anchor measurements per recorder, the per-member seek conversion with `recorders.time_zone` and `clock_drift_s`, then lifting the refusal |
| **Provision-ISR (and Frigate) adapters** | Owner: Provision-ISR's API is not available yet (NN1 P6); Frigate is later | A read-only probe of a real unit, then an adapter registered through `register_vendor` |
| **A "recorder" RBAC scope type** | `nvr.configure` and `system.configure` are system permissions held only by the built-in system administrator at installation scope, so a recorder scope would grant nothing today; a new scope type changes the binding model, the scope picker and every `authorize` call and needs its own security review | An owner decision that a non-system role should configure one recorder only |
| **Applying recorder changes without a restart** | Owner decision O5 (restart semantics) | NN1 Q6 b, if ever wanted |
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

---

## סיכום בעברית

**מה נבנה:** מערכת Arx אחת מנהלת כמה מקליטי NVR. כל מקליט הוא ישות עם מזהה קבוע (nvr-1, nvr-2...), חיבור משלו
(בטבלת החיבורים הקיימת, סיסמה מוצפנת), מצב חיבור משלו, רשימת מצלמות ויכולות משלו. הוספה, עריכה, השבתה והסרה דרך
הגדרות › חיבורים (רשימת מקליטים, הוספה בתבנית האשף הקיימת), כל שינוי דורש הפעלה מחדש כמו היום. הסרת מקליט משאירה את
המצלמות שלו מושבתות ומוסתרות וההיסטוריה נשמרת. כל ממשקי ה־NVR הקיימים מקבלים מזהה מקליט (ברירת מחדל nvr-1, כך שהתקנה
עם מקליט אחד לא משתנה). גילוי מצלמות, זרם האירועים והזרמים ב־go2rtc רצים לכל מקליט בנפרד, ותקלה במקליט אחד לא משפיעה
על השני. שינויים מרובים לעולם לא מערבבים שני מקליטים. במסכים: עמודת מקליט וסינון בטבלת המצלמות, סינון לפי מקליט בקיר
המצלמות וביומן האירועים (מוצג רק כשיש יותר ממקליט אחד).

**מה לא נבנה ולמה:** ניגון מסונכרן בין שני מקליטים (לא הוכח על שני מקליטים אמיתיים, אסור לגעת בציוד אמיתי במשימה הזו;
ניגון מצלמה בודדת מכל מקליט עובד); מתאם Provision-ISR (ה־API שלו עוד לא זמין); הרשאה בהיקף "מקליט" (ההרשאות
הרלוונטיות שמורות למנהל המערכת בלבד); החלה ללא הפעלה מחדש (החלטת בעלים); תקציב צפייה חיה לכל מקליט; אזור זמן נפרד
למקליט בחיפוש הקלטות ובניגון (נשמר ומשמש לזרם האירועים בלבד, עד בדיקה על מקליט אמיתי באזור אחר).
