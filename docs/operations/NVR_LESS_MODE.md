# NVR-less mode (Home Assistant only)

Owner request, 2026-09-29: "I want the system to come up without an NVR, in case I want it only for electricity
control" - an installation with Home Assistant only (device control, floor plans, WisKey) and no Hikvision NVR.
Branch `pilot/nvr-less-mode` (from `g0/intake` at `ed76db1`).

## 1. What happened without `nvr_host` before this change (investigation)

Method: the backend at `ed76db1` started with empty NVR / go2rtc / HA options against a fresh temporary data dir
(`SW_OPTIONS_FILE` pointing at nothing, no `NVR_*` / `GO2RTC_URL` / `HA_*` variables, developer identity), walked for
~20 minutes: every parameterless GET route of the API inventory (53), the NVR POST routes, and every shell route in
real Chromium (Playwright, design A, 1440 px) with the API errors each screen triggered. Read-only; no device existed.

### 1.1 What already held

- `/healthz` answers `{"status": "ok"}` at once: the Supervisor watchdog stays green.
- `/health` answers `status: ok` (it is a static field) with `nvr_configured: false`.
- No crash, no 500, no timeout anywhere. The NVR client (`services/nvr._client`) refuses at once with 503
  `source_not_configured` when host, user or password is missing, so no route waits for a device. All 53 GET routes
  answered 200 (lists empty) except `GET /nvr/notify` and `GET /nvr/system` (503 `source_not_configured`) and the
  expected 422s of routes that need a query.
- No retry storm and no lock holding: the alertStream listener (`events_ingest.LISTENER.start`) returns before it
  creates its threads; start-up discovery (`autosync.run_once`) and recording-derived events (`events_derive.run_once`)
  return at once with `nvr_not_configured`; the HA sync does not start without HA.
- Backup / restore, the release check (`scripts/release_check.py`, repository consistency only), the demo mode (no
  backend) and the smoke script (`scripts/smoke_after_upgrade.py` marks the NVR steps `skip` when
  `nvr_configured` is false) have no NVR dependency.

### 1.2 What broke or misled

| Area | Behaviour without an NVR |
|---|---|
| `/health/report` | Overall `status: error` **forever**: `discovery` is `error` (`cameras_last_error = nvr_not_configured`) and `events_derive` is `error` (`last_error = nvr_not_configured`); `nvr`, `go2rtc` and `events_ingest` are `warn`. |
| `/health/summary` (top-bar pill) | `warn` forever with the item "ה־NVR לא הוגדר" - "יש מה לבדוק" on every screen for every user. |
| Setup wizard | NVR step `failed` ("פרטי ה־NVR לא הוגדרו"), go2rtc `failed`, camera `skipped` "waiting for the NVR": "מוכן לעבודה" was unreachable; the shell's "השלם את ההתקנה · 1 מתוך 6" hint stayed for good. Opening the wizard ran a live NVR / go2rtc check on each visit. |
| Background threads | Started although useless: the export worker thread (wakes every 15 s), the event-thumbnail worker thread, the janitor's storage-report warm-up (a thread plus an INFO line `storage report warmed in 0.0 s` every 8 minutes - the only recurring log noise), the janitor's periodic discovery + derive pass every 10 minutes (silent, returns at once) and `nvr_write.stop_expired_manual` every 30 s (local query). |
| Shell navigation | Every NVR area stayed in the navigation: לייב (overview, all cameras, saved views, camera health), חקירה (events, recordings, sync, historical map, reviews, AI search, cases, rules, exports). Each opened on an empty state that tells the user to configure the NVR ("המצלמות מתגלות אוטומטית מה־NVR…", "סנכרן מצלמות מה־NVR…"); the historical map answered 404 for the default floor. No system banner (the summary never reached `error`). |
| Settings › חיבורים | Two failing calls on every open (`/nvr/notify`, `/nvr/system` → 503) and the NVR card marked red ("לא מוגדר", alertStream "מנותק · nvr_not_configured"). |
| Settings › כללי / וידאו ומדיה | Video, wall, kiosk, playback, snapshot and export forms shown and savable although nothing uses them; the start-screen choice offered live / wall / events / playback. |
| Storage screen | "ה־NVR לא מוגדר" empty state as the main content; refresh button "רענון מול ה־NVR". |
| Map | Works (sites, floors, plans, HA anchors, 3D). The cameras layer toggle and "בחירת מצלמות" stay; cameras left over from an earlier NVR (a restored backup) would still be drawn and lead to live / history screens. |
| Lovelace card | Its default view is `events` (`/investigate/events`): an empty event centre inside the dashboard; `camera` and `wall` views empty too. |
| Kiosk (`#/kiosk/...`) | An empty wall. |
| WisKey, device control, search box, backups | Unaffected. |

Every place that assumes an NVR (code references): `main.py` start-up (export worker, discovery task, alertStream,
thumbnails) and `janitor_tick` (storage warm-up, manual-recording stop, periodic discovery);
`services/health_report.py` (`build`, `summary`); `services/setup_wizard.py` (NVR, go2rtc and camera steps);
`services/autosync.py`, `events_ingest.py`, `events_derive.py`, `thumbnails.py`, `exports.py`, `storage.py`,
`nvr.py`, `nvr_system.py`, `nvr_write.py`, `recordings.py`, `playback*.py`, `go2rtc.py` (stream sync);
routers `cameras` (sync, snapshot, capabilities, zones, manual channel), `media` (live, stream sync), `recordings`,
`frames`, `playback`, `playback_groups`, `exports`, `nvr_write`, `cases` (preserve = an NVR export); frontend
`shell/nav.ts` + `shell/sw-app.ts` (navigation, start screen), the live / investigate / kiosk screens,
`system-setup.ts`, `system-diagnostics.ts` (media + general tabs), `system-storage.ts`, `system-wizard.ts`,
`explore-floor-map.ts` (camera layer), the Lovelace card's `events` / `camera` / `wall` views.

## 2. Design

**One derived mode, never stored.** `smplwise/mode.py`: `installation_mode(settings)` is `ha_only` when the add-on
options name no `nvr_host`, `full` otherwise (a host without credentials stays `full` - the existing "not configured"
wording applies there). It is computed on every start from the options, so switching needs no migration in either
direction and nothing in the database refers to it. Reported as `mode` in `GET /me`, `GET /health` (with an `nvr`
block `{configured, state: not_configured, label: "לא מוגדר - מצב ללא NVR"}`), `GET /health/summary`,
`GET /health/report` and `GET /setup/state`.

**Background work.** In `ha_only` the start-up does not start the export worker, the discovery task, the alertStream
listener or the thumbnail worker; the janitor skips the storage warm-up, the manual-recording stop and the periodic
discovery. It still runs its local housekeeping (retention, audit / HA-history pruning, WAL checkpoint), the HA sync,
the WisKey feed, the bridge install and the daily backup. One INFO line at start-up:
`installation mode: ha_only (no nvr_host in the add-on options) - …`.

**Health.** A new neutral check status `off` ("לא מוגדר") that never lowers the overall status. In `ha_only` the NVR
check is `off`, go2rtc is `off` while it is not configured (probed normally when it is), and the NVR job checks
(`events_ingest`, `events_derive`, `discovery`, `thumbnails`, `exports`) are not reported. The summary drops the
"ה־NVR לא הוגדר" item, so with HA connected and a backup present the pill is green. Home Assistant is the product in
this mode: HA not configured, or disconnected for more than `HA_GRACE_S` (60 s, measured by `ha_sync.STATE.down_for()`),
is an `error` in the summary (the system banner) and in the report's `ha_sync` check; the full mode keeps its warnings.

**Wizard.** A new step status `not_applicable` with a `status_label`: NVR and camera are "דילוג - מצב ללא NVR" (problem
code `nvr_less_mode`, next action = how to add the NVR later, link to הגדרות › חיבורים); go2rtc is
"דילוג - לא מוגדר (רשות)" while neither `go2rtc_url` nor `wiskey_username` is set (WisKey station stills and video go
through go2rtc, so with WisKey credentials it is a required step). A configured go2rtc is checked for reachability only
(no camera streams are expected) and the last successful check is kept past the live cache, because no stream sync runs
without an NVR to refresh the background state. `total`
counts the required steps only, so "מוכן לעבודה" is reached with install, Home Assistant, floor (and go2rtc when
configured - the four remaining steps of the brief). The NVR check probes nothing. *Recorded decision:* go2rtc is
optional in `ha_only`; the brief's "four remaining steps" holds when go2rtc is configured, and an electricity-only
installation without go2rtc is ready with three.

**Routes.** 409 `nvr_not_configured` with the "how to add it" message, always AFTER the route's own identity and
permission checks - a caller without the permission gets the same audited 403 as in the full mode, and only an
authorised caller learns that the NVR is absent. `mode.ensure_nvr` sits at the NVR boundary - the ISAPI client
(`nvr._client`, used by every NVR read and write), the live and playback RTSP URL builders - and in the handlers that
reach no device or check go2rtc first: camera sync, manual channel, snapshot / capabilities / zones, live media info,
stream sync, playback session and group create (before the go2rtc check), case snapshot / preserve. Local reads keep
answering (camera list, stored events, the export list, cases, storage report, floor maps, search). A stored event of a
leftover camera gets no thumbnail request (the list marks it `unavailable`, the thumbnail route answers 404
`thumbnail_unavailable`), never a 202 that waits for a worker that does not run. `PUT /nvr/connection` (outside
the add-on) answers `mode` and `restart_required` - the NVR routes answer at once, the background work starts with the
next start.

**Shell.** `nav.ts`: `NVR_LESS` (set from the session) filters every NVR href out of both designs' tabs, rail and phone
bottom nav, and drops the live area / overview group that are otherwise always kept - the navigation is מפה, חשמל
והתקנים, WisKey, הגדרות (plus the "מסכים" index). `sw-app.ts` answers an NVR route (live, investigate, camera health,
kiosk) with a "מצב ללא NVR" panel pointing at the options and at הגדרות › חיבורים; inside the Lovelace card
(`embed=1`) it shows the floor map instead, so every card view degrades to the map without a card update. A start
screen that needs the NVR opens the map (or device control with the map hidden); `devices` is a new start-screen
choice in both modes. Screens: the wizard (skipped steps, no "בדוק שוב" on them, summary with map / devices buttons),
הגדרות › חיבורים (a neutral NVR card plus the connection card, no NVR calls), כללי / וידאו ומדיה (a neutral notice
instead of the video, playback, export, AI-search and history forms; display, map and retention settings stay),
אחסון (local disk only), the floor map (no camera anchors, no cameras layer, no multi-camera selection).

**Developer and test launches keep the full mode (central).** Only the add-on (options in `/data/options.json`) derives
`ha_only` from a missing `nvr_host`. Every other launch - the owner's dev backend, any throwaway `python -m smplwise`,
every Playwright fixture backend - goes through `config.load_settings`, which fills a missing NVR host with
`DEV_NVR_PLACEHOLDER` = `nvr-placeholder.test` (a reserved name that never resolves; no NVR user is ever filled in, so
nothing connects and the NVR stays "not configured" exactly as before) unless the caller sets `SW_MODE=ha_only`. The
start-up log says which. The NVR-less fixture `frontend/tests/fixtures/nvr_less_backend.py` sets `SW_MODE=ha_only`;
the backend test settings (`tests/conftest.py`, built directly, not through `load_settings`) name the same placeholder.
Case routes that used to check the host alone (coverage probe, snapshot / preserve) now require host and credentials,
so the placeholder behaves exactly like no NVR there.

## 3. Evidence

- Backend: `smplwise_vms/backend/tests/test_nvr_less.py` (start-up threads per mode, INFO line, janitor, health /
  summary / report, wizard skip + ready + no probe, 19 NVR routes → 409 within 2 s, 401 before 409, local reads,
  unchanged permissions, full ↔ ha_only on the same data without migration).
- UI: `frontend/tests/evidence-nvr-less.spec.ts` against `nvr_less_backend.py`, desktop + phone; screenshots in
  `docs/evidence/nvr-less/`.

## 4. Known limits / open points

- Home Assistant security events (door / motion transitions, `source = ha`) are still recorded in `ha_only`, but the
  event centre is hidden with the rest of the investigate area as the brief asks. Showing an HA-only event list is a
  possible follow-up (owner decision).
- A fresh installation without any backup still shows "אין עדיין גיבוי" (warn) until the first daily backup - the same
  in both modes.
- The mode switch takes effect on restart (inside Home Assistant the Supervisor restarts the add-on when the options
  change). On a workstation, saving an NVR connection in הגדרות › חיבורים switches the routes at once and asks for a
  restart for the background work (`restart_required`).
