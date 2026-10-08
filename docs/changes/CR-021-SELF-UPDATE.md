# CR-021 - Self-update ("עדכון זמין"): Arx finds, shows and installs its own new version

**Status:** PROPOSED (architecture and probe only, 2026-10-02). Nothing implemented in the product. Release: on the owner's word.
**Owner request:** 2026-10-02. **Builds on:** `services/notify_sources.py` (`update_tick`, the existing `update.available` notification, read-only
`GET /addons/self/info` every 6 h), CR-018 (notifications), the pre-upgrade backup (`services/backup.py: pre_upgrade`, `auto-pre-upgrade` zips),
the add-on manifest (`smplwise_vms/config.yaml`: `hassio_api: true`, no `hassio_role` today, `backup: hot`).
**Evidence:** `scripts/self_update_probe.py` (read-only, stdlib only) run against one lab system on 2026-10-02 (section 2). No write call of any
kind was sent to any system for this CR.

## 1. Request, goals, non-goals

The owner wants Arx to notice a newer Arx by itself, show it in the user menu to system administrators only, and let an administrator install
it and restart the platform from Arx. Settings (system) gets a "בדוק אם יש עדכון" button that first forces a store refresh (the Supervisor store
reload, the same as the refresh button in Home Assistant, because the store often does not see a new version until refreshed) and then reads
`version` / `version_latest`. The last check (time, result) is shown, and a scheduled check runs automatically (default every 6 h, configurable).

**Goals**
- G1 detect: scheduled check + manual check (store reload first); last-check time and result persisted and shown.
- G2 show: a quiet "עדכון זמין" marker in the user menu, system administrators only.
- G3 install: administrator-confirmed update of the Arx add-on, with an optional / default pre-update backup, and an async status screen that
  survives the add-on restart; a health check afterwards; clear failure and rollback guidance.
- G4 platform restart: a separate, confirmed action for releases whose notes say the bridge integration changed and the platform must restart.
- G5 safe by construction: one new system permission, audited, rate-limited, no secrets stored, a "not permitted" state when the add-on token is
  not allowed to do it.

**Non-goals**
- Updating anything but the Arx add-on (no Music Assistant, no other add-on, no OS, no Supervisor update, no platform core update) in v1.
- Auto-install without a human (a possible later option, listed as owner decision D7, off by default and not built).
- Any change to other add-ons' options or to the platform's users / groups / admin flags.
- Naming Home Assistant, HA, Supervisor, Ingress or Companion in operator UI. Operator text says "תשתית המערכת" (owner 2026-09-29). The words may
  appear only on the system diagnostics/settings screens that already carry them, and this feature does not add to them.
- Replacing the existing notification (`update.available`, managers + email): it stays and now deep-links to the Settings page.

## 2. Probe findings (anonymised; `scripts/self_update_probe.py`, 2026-10-02, one lab system, read-only)

The probe sent only `auth` and `supervisor/api` GET on `/addons`, `/addons/<slug>/info` (Arx and Music Assistant add-ons), `/store`,
`/supervisor/info`, `/core/info`. It refuses (ProbeRefused) any other message type, any method other than GET, any other endpoint, and extra
fields. It printed key names, types and version strings only. Findings:

| Fact | Observed |
|---|---|
| The owner's token can read all five endpoints | yes, all `success`; no error codes |
| `GET /addons` | 17 add-ons; each row has `advanced, available, build, description, detached, homeassistant, icon, logo, name, repository, slug, stage, state, system_managed, update_available, url, version, version_latest`; 3 add-ons had `update_available: true` |
| Arx add-on `/info` | 73 keys. `version` 0.1.151, `version_latest` 0.1.152, `update_available: true` (the store DID have the new version here), `state: started`, `stage: stable`, `build: true` (built locally from source, not a pulled image), `auto_update: false`, `ingress: true`, `watchdog: false`, `boot: auto`, `hassio_api: true`, `homeassistant_api: true`, **`hassio_role: default`** |
| Music Assistant add-on `/info` | same 73-key shape; `build: false` (pulled image), `auto_update: false`, `hassio_role: default`, `update_available: true` (2.10.4 to 2.10.5) |
| Role-related keys in `/info` | `hassio_role`, `hassio_api`, `homeassistant_api`, `auth_api`, `docker_api` |
| `GET /store` | keys `addons`, `repositories`; 14 repositories, each `maintainer, name, slug, source, url` |
| `GET /supervisor/info` | keys include `version`, `version_latest`, `update_available`, `channel`, `healthy`, `supported`, `auto_update`; versions equal (current), channel stable, healthy and supported true |
| `GET /core/info` | keys include `version`, `version_latest`, `update_available`, `watchdog`; versions equal (current) |
| Locally built add-on | `build: true` means the update step rebuilds the image on the device (slower; the status screen must tolerate minutes, not seconds) |

**Verdict from the real answers:** the Arx add-on runs with `hassio_role: default`. That role is enough for the existing read-only
`GET /addons/self/info` (the current update check) and for nothing in the write path of this CR (section 3). The feature therefore needs a
documented, owner-approved change of the add-on manifest (section 3.2).

## 3. Permissions the add-on's own token needs (Supervisor role matrix)

### 3.1 Matrix

Source: Supervisor API security middleware (`supervisor/api/middleware/security.py`, read 2026-10-02) and the add-on configuration docs
(`developers.home-assistant.io/docs/add-ons/configuration/`, `hassio_api`, `hassio_role`). Roles: default < homeassistant / backup < manager < admin
(admin = every path). The role patterns are path regular expressions; the method is not part of the role check.

| Role | Paths it matches (relevant subset) |
|---|---|
| `default` | `/<anything>/info` only (so `GET /addons/self/info`, `/core/info`, `/supervisor/info`, `/store/...` info paths) |
| `homeassistant` | default + `/core/.+` + `/homeassistant/.+` |
| `backup` | default + `/backups.*` |
| `manager` | default + `/addons`, `/addons/<slug>/<anything except security>`, `/addons/reload`, `/core/.+`, `/backups.*`, `/store.*`, `/supervisor/.+`, `/host/.+`, `/network/.+`, `/os/...`, `/refresh_updates`, `/available_updates`, `/resolution/.+`, etc. |
| `admin` | everything |

| Needed call (Arx action) | Endpoint (v1 paths; the lab Supervisor also serves `/v2/...` "apps" aliases, to be confirmed in S1) | Minimum role |
|---|---|---|
| Read version / latest / update flag | `GET /addons/self/info` | `default` (works today) |
| Read the store contents / repositories | `GET /store`, `GET /store/addons/<slug>` | `manager` (the `/store.*` pattern; `default` only gets `.../info` sub-paths) |
| Force store refresh (the "refresh" button) | `POST /store/reload` (`/refresh_updates` is a lighter alternative) | `manager` |
| Update the Arx add-on | `POST /store/addons/self/update` or `POST /addons/self/update`, body `{"backup": bool, "background": bool}` (the handler returns a `job_id` when `background` is true and the job is not yet done) | `manager`. Note: the "self" bypass for token-only access explicitly excludes `update`, so the role is required even for the add-on's own slug |
| Restart the platform core (bridge integration change) | `POST /core/restart` | `homeassistant` or `manager` (the `/core/.+` pattern) |
| Pre-update backup of the add-on only | `POST /backups/new/partial` (or `/backups/new/full`) | `backup` or `manager` |
| Poll the update job | `GET /jobs/info` (`/jobs/.+`) | `manager` |
| Check the add-on's state after restart | `GET /addons/self/info` | `default` |

**Smallest sufficient role: `manager`** (covers store reload, add-on update, core restart, backup and job polling). `admin` is not needed and
must not be requested. `homeassistant` alone is not enough (no store reload, no add-on update). The role is checked per request path, so with
`default` every write returns HTTP 403 from the Supervisor; Arx maps that to the "not permitted" state (section 6).

### 3.2 The one-line manifest change (documented, NOT made by this CR)

In `smplwise_vms/config.yaml`, next to `hassio_api: true`:

```yaml
hassio_role: manager
```

Effects: the add-on token can manage add-ons, the store, backups and the core, within what Arx itself exposes (only routes in section 5 call
them, all behind `system.update`). Cost: a compromised Arx process could do more to the platform than today, which is why it is owner decision
D1. The change takes effect only after the add-on is reinstalled or updated (the Supervisor re-reads the manifest on update/rebuild), so the
first release that ships it is itself updated by hand. Documentation for installers: one paragraph in the add-on README.

### 3.3 How a self-update behaves

- Updating the add-on stops its container. The process that issued the update call is killed mid-request. Therefore the request is
  **fire-and-forget**: Arx sends `POST .../update` with `background: true` when possible, treats a dropped connection as "started", records an
  `update_run` row (state `requested`) BEFORE sending, and never waits for the HTTP answer to decide success.
- The browser cannot depend on Arx while it is down. The status screen polls `/api/system/update/status`; while Arx is unreachable it shows
  "מעדכן, ממתין לחזרת המערכת" and keeps retrying with back-off (up to a limit, default 15 min because the add-on may be built locally).
- After the new container starts, its startup code (migrations, `record_version`) runs; then `update_run` is closed by a startup hook that
  compares the stored target version with the running version: equal -> `succeeded`, different -> `failed` with the reason "version unchanged".
- Authoritative status after return: `GET /addons/self/info` (`version`, `state`) plus Arx's own `/healthz`. A job id is not required after the
  restart because the run row lives in Arx's database (which survives: `/data` is kept across updates).
- Platform restart is a second action, never chained silently. It also kills the Ingress channel for the duration (the platform's own UI
  disconnects), so the same status screen applies.
- Rollback note: the add-on store offers no downgrade in the UI. Rollback = restore the pre-update backup (add-on partial backup, taken by the
  Supervisor with `backup: true`, plus the existing `auto-pre-upgrade` data zip written by Arx on first start of the new version). Documented
  steps are shown on the failure screen.

## 4. UX

All operator text Hebrew, RTL, no technical words (owner "clean operator screens" rule: no hints, badges or paragraphs on operator screens beyond
what is needed; management only in Settings).

1. **User menu (system administrators only, permission `system.update`):** one extra row "עדכון זמין" with a small dot, only when
   `update_available` is true. Tapping opens Settings > System > Updates. Nothing is shown to other roles, nothing when current. Quiet: no toast,
   no badge on the avatar beyond the dot inside the menu (the existing CR-018 notification remains the loud channel for managers).
2. **Settings > System > "עדכונים":** the installed version, the latest version, last check (time and result: "עודכן / יש עדכון / לא ניתן
   לבדוק / אין הרשאה"), the button "בדוק אם יש עדכון" (store refresh first, then read), the automatic-check interval (1 / 3 / 6 / 12 / 24 h, off),
   and, when an update exists, the release notes and the button "עדכן".
3. **Release notes:** the bilingual notes (Hebrew and English) for every version between installed and latest, taken from the add-on's
   `CHANGELOG.md` (the Supervisor serves it as `GET /addons/self/changelog`; whether the `default` role may read it, and whether it returns the NEWER version's notes, is NOT assumed
   and is verified read-only in S1. The changelog bundled in the running image only knows the installed version; if the newer notes are
   unreadable the screen says "אין פירוט זמין" and still allows the update). A release note line flagged `[platform-restart]`
   marks versions that require a platform restart.
4. **Confirmation step:** modal "לעדכן את SmplWise Arx מגרסה X לגרסה Y?" listing: the system will be unavailable for a few minutes, live
   views and recordings access pause (recordings on the recorder are not affected), a backup option "צור גיבוי לפני העדכון" (default on, see D2),
   and when the notes flag it, a second checkbox "אתחל גם את תשתית המערכת בסיום". Buttons "עדכן עכשיו" / "ביטול". A second administrator is not
   required.
5. **Status screen (full page, survives the restart):** steps "מגבות / מוריד ובונה / מפעיל מחדש / בודק תקינות", elapsed time, the outcome. On
   success: "המערכת עודכנה לגרסה Y" and a reload button; on failure: reason and the rollback steps (section 3.3).
6. **Platform restart screen:** same screen, step "מאתחל את תשתית המערכת" with an expected duration, then the health check.
7. **After update:** the CR-018 notification `update.available` for that version resolves by itself (existing behaviour).

### 4.1 Hebrew mockup description (text only)

תפריט המשתמש (למנהלי מערכת בלבד): מתחת לשם המשתמש ולפני "התנתק" שורה חדשה, "עדכון זמין", עם נקודה כחולה קטנה בצד הימני. אין שורה כזו כשאין
עדכון ואין אותה לשאר התפקידים. לחיצה מעבירה להגדרות, לשונית "עדכונים".

מסך הגדרות "עדכונים": בראש המסך כרטיס יחיד. מימין: "גרסה מותקנת 0.1.151" ומתחתיו "גרסה אחרונה 0.1.152" (בכחול כשיש עדכון). משמאל כפתור ראשי
"בדוק אם יש עדכון". מתחת: "בדיקה אחרונה: היום 14:05 - יש עדכון" (או "לא ניתן לבדוק" / "אין הרשאה לעדכן"). שורת הגדרה קטנה: "בדיקה אוטומטית
כל" ובורר 1 / 3 / 6 / 12 / 24 שעות / כבוי. כשיש עדכון נפתח מתחת כרטיס "מה חדש" עם הערות הגרסה בעברית ובאנגלית, ובתחתיתו הכפתור "עדכן".
כשאין הרשאה: במקום הכפתור הודעה קצרה "ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה" וקישור להוראות.

חלון אישור: כותרת "לעדכן את SmplWise Arx?", שורה "מגרסה 0.1.151 לגרסה 0.1.152", הערה אחת "המערכת לא תהיה זמינה כמה דקות", תיבת סימון
מסומנת "צור גיבוי לפני העדכון", ותיבה נוספת (רק כשההערות דורשות) "אתחל גם את תשתית המערכת בסיום". כפתורים: "עדכן עכשיו" (ראשי) ו"ביטול".

מסך התקדמות במסך מלא: ארבעה שלבים מסודרים אנכית עם סימון וי / ספינר: "גיבוי", "הורדה והתקנה", "הפעלה מחדש", "בדיקת תקינות". מתחת
שעון זמן שעבר. כשהמערכת אינה זמינה מופיע "ממתין לחזרת המערכת..." והמסך ממשיך לנסות לבד. בסיום: "המערכת עודכנה לגרסה 0.1.152" וכפתור "המשך".
בכשל: סיבה קצרה, וכפתור "הוראות שחזור".

## 5. API contract

All under `/api/system/update`, JSON, system-level (installation) scope. Permission `system.update` on every route except `GET /state`'s
`marker` field (the user-menu call, see 5.1). Mutations require the existing same-origin guard plus the idempotency key below.

### 5.1 Routes

| Route | Purpose | Request | Response |
|---|---|---|---|
| `GET /api/system/update/state` | Marker + page data | - | `{installed, latest, update_available, checked_at, check_result, interval_hours, permitted, notes[], requires_platform_restart, run?}` ; a caller without `system.update` gets `{update_available:false}` ONLY (no versions, no notes) so the menu check leaks nothing |
| `POST /api/system/update/check` | Manual check: store reload, then read | `{}` | `{checked_at, check_result, installed, latest, update_available, refreshed: bool}`; `refreshed:false` + `check_result:"refresh_failed_read_ok"` when the reload was refused but the read succeeded |
| `PUT /api/system/update/settings` | Interval | `{interval_hours: 0\|1\|3\|6\|12\|24}` (0 = off) | `{interval_hours}` |
| `POST /api/system/update/apply` | Start the update | `{target_version, backup: bool, restart_platform: bool, idempotency_key}` | `202 {run_id, state:"requested"}` |
| `POST /api/system/update/restart-platform` | Platform restart alone | `{confirm: true, idempotency_key}` | `202 {run_id}` |
| `GET /api/system/update/runs/{run_id}` | Status (also what the status screen polls) | - | `{run_id, state, step, started_at, finished_at?, from_version, to_version, error_code?, backup_ref?}` |

`state`: `requested -> backing_up -> updating -> restarting -> verifying -> succeeded | failed | abandoned`.

### 5.2 Error codes (envelope as the other routers: `{code, message}`; Hebrew message, English code)

| HTTP | code | Meaning |
|---|---|---|
| 403 | `permission_denied` | caller lacks `system.update` |
| 409 | `update_not_available` | the store reports no newer version (also on a stale `target_version`) |
| 409 | `update_in_progress` | another run is not finished (single run at a time) |
| 409 | `target_version_mismatch` | `target_version` differs from the version read at apply time |
| 422 | `invalid_request` | bad body / interval |
| 429 | `rate_limited` | check or apply too frequent (section 6) |
| 503 | `platform_not_permitted` | the add-on token got 403 from the infrastructure: manifest role is too low; response carries `required_role: "manager"` |
| 503 | `infrastructure_unreachable` | no infrastructure API (developer backend, no token) |
| 502 | `infrastructure_error` | the infrastructure answered with an error; the code of that error, never its body |

## 6. Threat model

| Threat | Control |
|---|---|
| CSRF / drive-by from another page | state-changing routes accept only same-origin requests carrying the app's existing mutation guard; `GET` routes never mutate; Origin check on `apply` and `restart-platform`; remote (CR-008) sessions are allowed only when the actor holds `system.update` AND the second factor policy of CR-011 applies (D5) |
| Replay of an `apply` | `idempotency_key` stored on the run row; the same key returns the same run; a key is single-use per target version |
| Unauthorized trigger | one new system permission `system.update`, member of `SYSTEM_PERMISSIONS` (never delegable, never scoped), granted only to the system administrator role |
| Abuse / loops | `check`: 1 per 30 s and 20 per hour per installation (the store reload is heavy); `apply`: 1 per 10 min; `restart-platform`: 1 per 10 min; single active run |
| Wrong target | `target_version` must equal the version read from the infrastructure within the request; version strings pass the existing `_VERSION` pattern |
| Secrets in audit | audit rows `system.update.check`, `.apply`, `.restart_platform`, `.settings`, `.result` carry: actor, from/to version, backup yes/no, run id, error code. Never a token, URL, slug or host. Slugs are not even needed: the token addresses the add-on as `self` |
| No update in the store yet | the check does the store reload first; if still nothing, result `current`, `update_available:false`; if the owner knows a version exists, the page offers "בדוק שוב" (rate limited) and states "התשתית עדיין לא רואה גרסה חדשה" |
| Role insufficient | the first write returns 403 from the infrastructure; Arx stores `permitted:false` (re-probed on each manual check, cheap `POST /store/reload`), shows the "אין הרשאה" state with the one-line change (section 3.2) and the update button stays hidden |
| Update kills Arx mid-request | fire-and-forget design (3.3); the run row exists before the call; a startup hook closes or fails it; a run stuck beyond the timeout becomes `abandoned` with guidance |
| Failed update leaves a broken system | pre-update backup (D2); the Supervisor keeps the previous image; failure screen with restore steps; health check after |
| Spoofed status / fake "update available" | versions come only from the infrastructure API response, never from request fields; release notes are rendered as text (no HTML) |
| Information leak to non-admins | `state` returns only `update_available:false` to callers without `system.update` (5.1); the marker is rendered only when the permission holds |

## 7. Data model and migration

Migration `0051_self_update.sql` (next free number: 0050 is reserved for CR-020 S1 `0050_recorder_adapters`; 0049 is the last on g0/intake; `Database.migrate()` applies gaps):

- `update_runs(id TEXT PK, created_at, finished_at, actor_user_id, from_version, to_version, backup INTEGER, restart_platform INTEGER, state, step, error_code, idempotency_key UNIQUE, backup_ref)`.
- `settings` rows (existing key/value table, no new table): `update.interval_hours` (default 6), `update.checked_at`, `update.check_result`, `update.latest`, `update.permitted` (`unknown|yes|no`).
- `roles.json`: add `system.update` to `system_admin`; `SYSTEM_PERMISSIONS` in `routers/access.py` gains it; the permission catalog and the role-editor labels gain "עדכון המערכת".
- No change to existing rows; idempotent `CREATE TABLE IF NOT EXISTS` per the project convention. The janitor prunes runs older than 365 days.
- Config: none for the interval beyond the settings row; `config.yaml` gains `hassio_role: manager` only after owner decision D1.

## 8. Backend design notes

- New `services/self_update.py`: an infrastructure client (read: `GET /addons/self/info`; write: `POST /store/reload`, `POST /store/addons/self/update`, `POST /core/restart`, `POST /backups/new/partial`) with the same `UPDATE_FETCHER`-style test seam as `notify_sources`. Allow-list of endpoints in code (like the probe), unit-tested.
- The scheduled check replaces the fixed `UPDATE_EVERY_S` in `update_tick` with the setting; the tick also writes `update.*` settings so the user-menu marker costs one cheap read. The scheduled check does NOT reload the store by default (read only) unless the interval setting says "with refresh" (D4); the manual button always refreshes first.
- Network calls never run while a database connection is held (existing rule).
- Startup hook closes an open run (3.3). No new background thread: the poll runs in the existing notification tick plus the status route.

## 9. Test plan (T-numbers to be allotted in `management/test_catalog.json` at S1)

A fake infrastructure server fixture, `frontend/tests/fixtures/update_fake_supervisor.py`, in the style of `media_fake_ha` and the notify fakes: a
local HTTP server that implements `GET /addons/self/info`, `POST /store/reload`, `POST /store/addons/self/update`, `POST /core/restart`,
`GET /jobs/info`, `POST /backups/new/partial`, with switches: store stale until reload; role 403 on writes; update drops the connection;
update fails; slow update; version flips only after "restart".

| Layer | Cases |
|---|---|
| Unit | version / pattern validation; endpoint allow-list refuses anything else; rate limiter; idempotency; state machine; interval validation |
| API | permission matrix (system admin yes; every other role 403, including project/area admins); `state` leaks nothing to non-admins; check performs reload then read; stale store case; 403 -> `platform_not_permitted`; double apply -> 409; replay with the same key; audit rows without secrets (assert no token/url/slug text) |
| Migration | 0051 on a copy of a populated database; idempotent re-run |
| Restart survival | a test that kills the fake mid-request and asserts the run row stays `requested` then resolves after the fake "comes back" with the new version; stuck run -> `abandoned` |
| Browser (Playwright, fake backend) | marker visible only to the administrator; check button flow; confirmation modal; status screen across a simulated outage; "not permitted" state; Hebrew RTL and mobile width; no forbidden words (the existing no-HA-branding scan) |
| Live (owner approval needed, not in CI) | one real check with store reload on the lab; the actual update only on a system the owner nominates |

## 10. Slices and estimates

| Slice | Content | Estimate |
|---|---|---|
| S1 | Migration 0051, permission `system.update`, `services/self_update.py` (read + check with store reload, settings, scheduled tick with interval), `GET state`, `POST check`, `PUT settings`, fake infrastructure fixture, unit + API tests; confirm the v1 / v2 path forms and the changelog endpoint on the lab (read-only) | 1 day |
| S2 | UI: user-menu marker, Settings > Updates page (versions, last check, button, interval), "not permitted" state, release notes view, Hebrew strings, Playwright | 1 day |
| S3 | `apply` + `restart-platform`, run state machine, backup option, startup hook, status route, confirmation modal and status screen surviving the restart, threat-model tests, audit | 1.5 days |
| S4 | Release-notes feed and `[platform-restart]` flag in CHANGELOG convention, docs (user guide, add-on README paragraph for the role), live check on the lab with the owner, release | 0.5 day |

Total about 4 working days of agent time; S1 and S2 can ship before S3 (visible "update available" and the check, no install yet) because they
need no new role (the read works today; the store reload needs `manager`, so before D1 the check button degrades to read-only with a note
"הרענון מצריך הרשאה").

## 11. Risks

- Role escalation is real (section 3.2); mitigated by narrow routes, one permission, audit, rate limits, and the owner's explicit decision.
- A locally built add-on (`build: true`) may take minutes to update and fails on a flaky link; the status screen's long timeout and the backup mitigate.
- The first release carrying `hassio_role` must be updated manually; documented.
- Supervisor path versions (`/v2/...` aliases) may change between Supervisor releases; the client centralises paths and the fake mirrors them; the existing `management/upstream_watch.json` already watches add-on manifest keys and should add `hassio_role`.

## 12. OWNER DECISIONS (to answer before S3; S1/S2 can start without D1)

- **D1** Is changing the add-on manifest to `hassio_role: manager` acceptable? (Minimum role that allows store refresh, add-on update, core restart and backup. Without it Arx can only read the version and show "עדכון זמין", not refresh or install.) Options: a) yes, manager; b) no, detect-and-show only, update by hand; c) later, ship S1/S2 first.
- **D2** Is a backup before the update mandatory (cannot be unticked), default-on but optional, or optional default-off? Recommendation: default-on, optional.
- **D3** Default automatic-check interval: 6 h (as today)? Options offered in the UI: 1 / 3 / 6 / 12 / 24 h / off.
- **D4** Should the scheduled check also refresh the store (so a new version is noticed within the interval even if the store is stale), or only the manual button? Recommendation: scheduled check refreshes once per interval, not more than every 3 h.
- **D5** Who sees the marker and may update: system administrators only (as requested), also over the remote channel (CR-008) and only with the second factor when it is enabled?
- **D6** Platform restart: automatic tick-box when the notes flag it, or always a separate manual action? Recommendation: tick-box in the confirmation, separate button always available.
- **D7** A later opt-in "update automatically at night" for non-flagged versions: record as a future option, not built now (agree?).
- **D8** Release-notes source: the bilingual CHANGELOG entries as they are today, with a `[platform-restart]` marker line added by convention. Agree?

## Owner decisions (2026-10-02)
- D1: `hassio_role: manager` approved.
- D2: backup before update is on by default but optional.
- D3: scheduled check interval 6 h.
- D4: only the manual button refreshes the store; the scheduled check does not.
- D5: the marker and the update also work over the remote channel, WITHOUT a second factor (owner: it would complicate things). Same permission `system.update` applies.
- D6: platform restart is always a separate action.
- D7: nightly opt-in auto-update recorded as a future option, not built now.
- D8: bilingual CHANGELOG plus a `[platform-restart]` marker line is the release-notes source.

## 13. Slice S3 (backend): owner answers of 2026-10-03 and what was built

Branch `pilot/CR021-s3` (from `pilot/CR021-on-CR020`). Backend, fake infrastructure only; the UI card, modal and status screen
are a later slice. No new migration (`update_runs` is in 0051; the boot counter and the restart reasons are `settings` rows).

### 13.1 Owner answers (binding)

| # | Answer |
|---|---|
| 1 | Platform restart = Supervisor `POST /core/restart`, after `POST /core/check` (needs the manager role) |
| 2 | `hassio_role: manager` ships with the S1/S2 release family; `config.yaml` carries it on this branch; one-time manual install documented (DOCS "Updates and restarts from inside Arx") |
| 3 | The single `system.update` covers update and platform restart |
| 4 | Plain confirmation everywhere (`confirm: true`), no typed confirmation |
| 5 | The owner presses the buttons in the lab; agents build against fakes only (checklist 13.5) |
| 6 | Keep `backup: hot`; Arx's own pre-upgrade zip is the consistent copy; both offered on failure |
| 7 | "Restart required" row in Settings + the user-menu dot, system admins only (backend: `requires_platform_restart` + `platform_restart_reasons` on `GET /state`, holders only) |
| 8 | No rate limit on the platform restart: only the permission and the confirmation are checked |
| 9 | One "הפעלות מחדש" card, two buttons, one shared helper: `services/addon_restart.py` (CR-022's names and behaviour kept) |
| 10 | Rollback is guidance only; no restore / downgrade button |
| 11 | Branch protection + required review on the store repository before S3 ships (release gate 13.4) |

### 13.2 Routes (all `system.update`, installation scope)

| Route | Request | Response / errors |
|---|---|---|
| `POST /api/v1/system/update/apply` | `{target_version, backup, confirm: true, idempotency_key}` | `202 {run_id, kind:"update", state:"requested", ...}`; same key -> `200` same run; 409 `update_in_progress` / `update_not_available` / `target_version_mismatch` / `platform_busy` / `nvr_write_in_progress` / `idempotency_key_reused`; 429 `rate_limited` (1 per 10 min, from `update_runs`, survives the restart); 503 `platform_not_permitted` (`required_role: manager`) / `infrastructure_unreachable`; 502 `infrastructure_error` |
| `POST /api/v1/system/update/restart-platform` | `{confirm: true, idempotency_key}` | `202 {run_id, kind:"platform_restart", step:"config_check", ...}`; 409 `update_in_progress` while any run is active; 503 / 502 as above. No rate limit |
| `GET /api/v1/system/update/runs/{run_id}` | - | `{run_id, kind, state, step, started_at, finished_at, from_version, to_version, backup, backup_requested, backup_state, error_code, timeout_s, expected_s}`; a run past its ceiling (`timeout_s`) is settled `abandoned` here (and by the janitor). `backup` is true only for a CONFIRMED backup (13.7) |

Order on both POST routes (the `auth.read_gate` pattern): permission on the read connection (403 + audit before the body is read)
-> body cap 4 KB -> same origin (the rule of `remote_channel.csrf_ok`: `Sec-Fetch-Site: same-origin` when present, else an `Origin`
equal to the request's scheme + host, neither -> refused; 403 `cross_site_refused`) -> JSON only (415) -> body schema
(422 `invalid_request`) -> `confirm` must be the JSON literal `true` (422 `confirm_required`) -> write connection. Every refusal after
the permission is an audit row (`system.update.apply` / `.restart_platform`, `denied`, `phase:"request"`). The remote channel may use
the routes (D5); its cookie sessions pass `remote_channel.csrf_ok` first. The routes are not on `BLOCKED_ON_REMOTE`.

### 13.3 State machine and audit

`requested -> backing_up | updating -> restarting -> verifying -> succeeded | failed | abandoned` (update) and
`requested (config_check) -> restarting -> verifying -> succeeded | failed | abandoned` (platform restart). `step` and `error_code`
are fixed vocabularies (`services/update_runs.py` STEPS / ERROR_CODES); no upstream text, slug, token, address or backup name is
stored, returned or audited.

Two-phase rule (as CR-020): reads with the write lock released; then, under the lock, ONE `INSERT ... WHERE NOT EXISTS (unfinished
run)` + the audit row `phase:"attempt"`, committed before a worker sends anything; the worker records the outcome
(`system.update.result`, `phase:"outcome"`, `allowed` for success, `denied` + `reason` = error code otherwise). An answer that never
arrives (`dropped`) is an UNKNOWN outcome: never resent, never claimed; the update run goes to `restarting/outcome_unknown` and is
settled by the next start (`update_runs.on_startup`, called once from `main.py` after the migrations): running version = target ->
`verifying` + health check with one retry after 60 s (schema at the newest migration, database writable, infrastructure reports the
target version and `started`) -> `succeeded` / `failed/health_check_failed`; running version = source -> the job state decides (13.7;
`interrupted` when the call was never sent); three starts of the target without a healthy check -> `failed/restart_loop` (starts are
counted before the migrations). A run is abandoned only at the 90-minute ceiling (13.7). The platform restart: the configuration check
fails (HTTP 400) -> `failed/platform_config_invalid`, no restart; otherwise `POST /core/restart` once, then `GET /core/info` every 5 s up
to 10 min: down twice in a row (or 30 s when the restart was accepted), then `running` twice in a row and, when the bridge is paired, a
bridge directory push after the core came back -> `succeeded`; else `platform_not_back` / `bridge_not_loaded` / `restart_not_observed`.
A successful restart clears the stored reasons.

Deviations from the private design: the configuration check runs in the worker (the run row exists first; an Ingress request never
waits for a slow check) - its failure is on the run, not a synchronous 409; `confirm_text` is gone (answer 4); the platform restart has
no rate limit (answer 8); `backup_ref` is not filled (no backup name is kept, nothing in the UI needs it).

### 13.4 Release gate (before S3 ships)

- [ ] Branch protection + required review on the store (release) repository enabled by the owner (answer 11). Agents do not change
      repository settings.
- [ ] Tier L (TEST_POLICY: RBAC + manifest role + update path): full backend + full Playwright on the runner.
- [ ] Security review of `services/self_update.py` (allow-list), `services/update_runs.py`, `routers/system_update.py`.
- [ ] The lab session of 13.5 done with the owner pressing the buttons; any [A] item that failed is fixed or the slice is held.
- [ ] Release notes carry the one-time manual update step (DOCS "One-time manual update to the first release with the role").

### 13.5 Assumptions that need the lab (acceptance checklist for the owner session)

| # | Assumption (built that way) | How the lab confirms it |
|---|---|---|
| A1 | `POST /store/addons/{slug}/update` needs the real slug (the `self` bypass excludes `update`); `GET /addons/self/info` returns `slug` | the in-app update after the manual R1 install reaches the store route (no 404); before it, a 403 shows "אין הרשאה" |
| A2 | the update body keys `backup` / `background` are accepted; `background: true` answers at once with `job_id` | Supervisor log + the run's step `job_running` |
| A3 | `GET /jobs/info` lists the job with `uuid`, `done`, `errors`, `child_jobs` (backup child named `*backup*`) | the run passes `backing_up -> updating -> restarting` while Arx is alive |
| A4 | the Supervisor restarts the add-on after the update by itself | Arx returns on the new version, run `succeeded` |
| A5 | a failed backup aborts the update; a failed build keeps the old image | not provoked in the lab; reviewed from Supervisor source (P0) |
| A6 | the add-on `state` is `started` within 60 s of the new process's start (health check + one retry) | run `succeeded`, not `health_check_failed` |
| A7 | slow migrations do not trip the watchdog (`/healthz`) during a start | measure the start time of R2 |
| A8 | `POST /core/check` exists and answers 400 for an invalid configuration, 200 for a valid one | the restart passes the check (the invalid case is not provoked) |
| A9 | `POST /core/restart` (body `{}`) needs `manager`; it may answer before or after the core is back | run reaches `succeeded`; note how long the call took |
| A10 | `GET /core/info` returns `state` (`running`) and is answered with the default role; it fails or shows another state while the core restarts | run step sequence `restart_accepted -> bridge_wait/waiting_for_platform` |
| A11 | the bridge pushes its directory right after the core loads it (proof the bridge is back) | run `succeeded` without `bridge_not_loaded`; bridge version active |
| A12 | Ingress sessions and HA-identity lookups fail only for seconds during a core restart; Arx stays up | the status screen keeps polling; Arx log clean |
| A13 | browsers send `Sec-Fetch-Site: same-origin` through Ingress and the remote channel | the confirmation buttons work in Chrome (local and remote) |
| A14 | the lower security rating after the role change | Info tab after R1 |
| A15 | WisKey `requires_ha_restart` (release manifest) and its contract version after a restart | WisKey fold-in not written yet: the installer must call `platform_restart.note_component_manifest(conn, "wiskey", manifest)`; a successful restart counts as "loaded" until the contract command exists |

### 13.6 Not built in this slice (and why)

- UI: card "הפעלות מחדש", confirmation modal, status screen surviving the restart, failure / rollback screen, Settings row and
  user-menu dot - the later frontend slice (the backend fields exist).
- `POST /api/system/restart` (the Arx-only restart): CR-022's route on `pilot/nn4-backend`; S3 only provides the shared helper
  (`addon_restart.restart`) with the same names, so that route works unchanged on either merge order.
- Release-notes feed and the `[platform-restart]` reason source (S4); the hook `platform_restart.add_reason(conn, "release", version)`
  exists.
- A refusal while an Arx backup restore is running: there is no restore-in-progress marker to read; the NVR-write interlock is built.
- Restore / downgrade button (answer 10).

### 13.7 Security review fixes (2026-10-04, branch `pilot/CR021-s3-fixes`)

The independent review of S3 (private, findings with file:line) found code-level gaps; these are fixed. Not changed here (owner
decisions pending): the `manager` role itself, the supply chain / branch protection item (13.4), and the platform-restart rate limit
(answer 8 stands: none).

Contract changes for the UI (all additive in shape; one meaning change):

| Where | Change |
|---|---|
| run view (`GET /runs/{id}`, the 202 / 200 of the POST routes) | `backup` now means a CONFIRMED backup (the Supervisor's backup child job finished without errors). New `backup_requested` (bool, what the operator asked) and `backup_state` (`not_requested` / `requested` / `confirmed`). The failure screen offers "restore from the platform backup" only for `confirmed`; for `requested` it says the backup was asked but not confirmed and offers Arx's own pre-upgrade copy. |
| run view | New `expected_s` (update 1200, platform restart 600): what the step usually takes, for the progress text. `timeout_s` of an update is now the ceiling 5400 (90 min); show "still working" between the two, never "failed". |
| `error_code` vocabulary | New `restart_not_observed` (platform restart: the call's answer was lost and no restart was seen; nothing is claimed). |
| both POST routes | Without `Sec-Fetch-Site`, an `Origin` equal to the request's scheme + host is required; neither -> 403 `cross_site_refused`. Browsers send these by themselves (assumption A13); a script or a non-browser client must send `Origin`. |
| on start | An update run whose source version starts again in the middle of the job stays open (state unchanged; `update_in_progress` still answers). |

Behaviour:

- Child processes (`ffmpeg`, `pdftoppm`, `pdfinfo`) run with `services/child_env.minimal_env()` (PATH, TZ, temp dirs, `LANG=C.UTF-8`;
  never `SUPERVISOR_TOKEN` or any other secret). A guard test fails on a `subprocess` call without it.
- Restart in the middle of an update (NVR connection save, the Arx restart button, the watchdog): no verdict at start. `_follow` keeps
  reading `GET /jobs/info` (the job id is kept in the `settings` row `update.job_id`; by name `addon_manager_update` when unknown):
  job errors -> `update_job_failed`; no update job for 2 min and the source version still installed -> `version_unchanged`; otherwise
  wait. The single-run guard is not released early and no wrong failure is audited.
- Long builds: the worker follows the job up to the 90-minute ceiling (`UPDATE_TIMEOUT_S`, documented in `update_runs.py`); a run
  abandoned at the ceiling whose target version then starts (within 24 h) is reopened and verified (audit `system.update.result`
  `phase: "reopened"`, then the usual outcome row). `main.janitor_tick` settles runs past their ceiling every 30 s.
- Restart loop: `update_runs.early_boot` counts a start of the target version BEFORE the migrations, so a crash in a migration or at
  import still ends in `failed/restart_loop` after three starts.
- Allow-list: the update slug must equal the slug `GET /addons/self/info` reported for this add-on (no other add-on such as `core_ssh`
  can be addressed; no update before that read); `nvr_system.supervisor_post` accepts only `/addons/self/options` and
  `/addons/self/restart`; the options body may carry only the manifest's schema keys, each of its type (`OPTION_TYPES`, kept equal to
  `config.yaml` by a test), and `save_connection` changes only the NVR keys. `POST /discovery` (body `{service: "smplwise_bridge",
  config: {addon_url, pairing_code}}`) and the `GET /core/info` read of `ha_user_auth` now go through `self_update.send` too.
- The 10-minute gap between two updates is part of the INSERT's WHERE (two parallel applies cannot both pass).
- Not built: refusing the Arx restart / NVR connection save while an update runs (the start-up logic above makes it harmless); an
  admin notification on each platform restart (finding 4 suggestion; left for the owner's decision).

New lab assumptions: A16 - the Supervisor names the add-on update job `addon_manager_update` and keeps it in `GET /jobs/info` while it
runs; A17 - a local build fits in 90 minutes on the slowest supported device.

## 14. Slice S4 (2026-10-08, branch `pilot/CR021-s3-apply`)

- Built: the `[platform-restart]` marker (D8) is read from the running version's own section of `smplwise_vms/CHANGELOG.md` (now copied into the image) at start; `services/release_notes.py` adds the `release` reason once per version (settings row `platform_restart.release_noted`). Local file only.
- Built: downgrade guard `self_update.is_newer` used by `parse_info`: only a strictly higher release is available or applied, whatever the infrastructure's `update_available` says. The test suites had exercised a downgrade (NEWER 0.1.999 / fixture 0.1.157 below the running 2.4.2); they now use 99.0.0.
- Docs: `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md`, `docs/user-guide/he/83-updates_HE.md`, `docs/release/NEXT-DRAFT.md`.
- Not built: the NEWER version's release-notes text on the Updates page (needs the infrastructure's changelog read, conflicts with 'no upstream text'; owner + security decision); an admin switch that turns the feature off (open owner question); the lab session 13.5 (owner).
